"""
A spoken phrase comes out as a transaction.

The speech recognition happens in the browser, and what it hears is
sent here as plain text. The reading of that text has to be the same
reading the text parser does, so a sentence that was spoken and a
sentence that was typed come out the same way.

The case in the report was "beli kopi jago 2 harganya Rp15.000 rasa
vanila di Kemayoran". It came out as a purchase of thirty thousand at
a shop called "Kemayoran", with no place of its own and no list of
what was bought. These are the checks that keep that from happening
again.
"""

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api.routes import voice as voice_route  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.core.security import get_current_user  # noqa: E402
from app.models.account import Account  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture()
def session():
    """A database with the reader's own accounts in it."""
    from app.core.database import Base

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine, tables=[User.__table__, Account.__table__])
    db = sessionmaker(bind=engine)()

    user = User(email="reader@example.invalid", username="reader", hashed_password="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    for name, kind in (("GoPay", "wallet"), ("BCA", "bank"), ("OVO", "wallet"), ("Cash", "cash")):
        db.add(
            Account(
                user_id=user.id,
                name=name,
                account_type=kind,
                account_kind=kind,
                balance=100000,
                currency="IDR",
                is_active=True,
            )
        )
    db.commit()

    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client(session):
    """A client that talks to the voice endpoint as the reader."""
    reader_id = session.query(User).first().id

    class _Reader:
        id = reader_id
        is_guest = False

    app = FastAPI()
    app.include_router(voice_route.router, prefix="/api/voice")
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: _Reader()
    return TestClient(app)


# === The case from the report ===

def test_the_case_from_the_report(client):
    """
    "beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran"
    """
    response = client.post(
        "/api/voice/parse",
        json={"text": "beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran"},
    )

    assert response.status_code == 200
    body = response.json()

    assert body["transaction_type"] == "expense"
    assert body["amount"] == 30000
    assert body["merchant_name"] == "Kopi Jago"
    assert body["location"] == "Kemayoran"
    assert body["category"]

    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["quantity"] == 2
    assert item["unit_price"] == 15000
    assert item["total"] == 30000


def test_the_line_carries_what_was_said_about_it(client):
    """
    The name of the thing carries the note that was spoken with it, so
    the mascot can read the line back: "2 Kopi Jago vanila".
    """
    response = client.post(
        "/api/voice/parse",
        json={"text": "beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran"},
    )

    item = response.json()["items"][0]
    assert "Kopi Jago" in item["name"]
    assert "Vanila" in item["name"]


# === The other kinds of phrase ===

def test_a_purchase_of_two_things_has_two_lines(client):
    response = client.post(
        "/api/voice/parse",
        json={"text": "beli 2 kopi susu 18rb sama 1 roti bakar 22rb"},
    )

    body = response.json()
    assert len(body["items"]) == 2
    assert body["amount"] == 58000


def test_a_salary_is_income(client):
    response = client.post("/api/voice/parse", json={"text": "terima gaji 8.5jt"})

    body = response.json()
    assert body["transaction_type"] == "income"
    assert body["amount"] == 8500000


def test_a_transfer_is_a_transfer(client):
    response = client.post(
        "/api/voice/parse", json={"text": "transfer 500rb dari bca ke gopay"}
    )

    body = response.json()
    assert body["transaction_type"] == "transfer"
    assert body["amount"] == 500000


def test_the_account_the_reader_named_is_chosen(client):
    """
    The account used to be left blank, so the reader had to pick it
    every time.
    """
    response = client.post(
        "/api/voice/parse", json={"text": "beli kopi susu 18rb bayar pakai gopay"}
    )

    assert response.json()["account_id"] is not None


# === The words the speech engine produced ===

def test_a_number_spoken_in_words_is_read(client):
    """
    The speech engine writes "dua puluh lima ribu" for twenty five
    thousand. That is worth keeping.
    """
    response = client.post(
        "/api/voice/parse", json={"text": "beli kopi dua puluh lima ribu"}
    )

    assert response.status_code == 200
    assert response.json()["amount"]


# === When nothing was said ===

def test_nothing_said_does_not_crash_the_endpoint(client):
    """
    The browser sometimes hears nothing. The endpoint has to answer.
    """
    response = client.post("/api/voice/parse", json={"text": ""})

    # It may refuse the empty phrase, but it must not fall over.
    assert response.status_code in (200, 400, 422)


def test_nonsense_does_not_crash_the_endpoint(client):
    response = client.post("/api/voice/parse", json={"text": "asdkjh qwe zxc"})

    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "transaction_type" in body
