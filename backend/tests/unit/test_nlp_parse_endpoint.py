"""
The reading endpoint, end to end.

The text parser and the voice input both call this. It takes a
sentence the reader typed or spoke and answers with what it meant:
the kind of transaction, the lines of the bill, the shop, the place,
the category, and the account the money moved through.

These are the checks on the whole path - the request, the reading, and
the answer - because the engine on its own can be perfect while the
screen shows something else.
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

from app.api.routes import parser as parser_route  # noqa: E402
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
    # Only the tables this endpoint touches. The full set cannot be
    # made on SQLite, because one of the tables has a column SQLite
    # cannot render.
    Base.metadata.create_all(
        bind=engine,
        tables=[
            User.__table__,
            Account.__table__,
        ],
    )
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
    """A client that talks to the reading endpoint as the reader."""
    reader_id = session.query(User).first().id

    class _Reader:
        """The reader asking the question."""

        id = reader_id
        is_guest = False

    app = FastAPI()
    app.include_router(parser_route.router, prefix="/api/parser")
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: _Reader()
    return TestClient(app)


# === The reading ===

def test_a_purchase_is_read(client):
    response = client.post("/api/parser/parse-nlp", json={"text": "beli 2 kopi susu @18rb"})

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "expense"
    assert body["total_amount"] == 36000


def test_a_purchase_of_two_things_has_two_lines(client):
    """
    The upgrade this endpoint exists for. Two things bought is two
    lines and a total that is their sum.
    """
    response = client.post(
        "/api/parser/parse-nlp",
        json={"text": "beli 2 kopi susu @18rb sama 1 roti bakar 22rb"},
    )

    body = response.json()
    assert len(body["items"]) == 2
    assert body["items"][0]["name"] == "Kopi Susu"
    assert body["items"][0]["quantity"] == 2
    assert body["items"][0]["unit_price"] == 18000
    assert body["items"][0]["subtotal"] == 36000
    assert body["items"][1]["name"] == "Roti Bakar"
    assert body["total_amount"] == 58000


def test_a_salary_is_read(client):
    response = client.post("/api/parser/parse-nlp", json={"text": "gajian masuk 8.5jt ke bca"})

    body = response.json()
    assert body["type"] == "income"
    assert body["total_amount"] == 8500000


def test_a_transfer_is_read_with_both_ends(client):
    response = client.post(
        "/api/parser/parse-nlp", json={"text": "transfer 500rb dari bca ke ovo"}
    )

    body = response.json()
    assert body["type"] == "transfer"
    assert body["total_amount"] == 500000
    assert body["source_account_id"]
    assert body["destination_account_id"]
    assert body["source_account_id"] != body["destination_account_id"]


def test_the_account_the_reader_named_is_chosen(client):
    """
    The account box used to be left empty. Now the money goes to the
    place it really came from.
    """
    response = client.post(
        "/api/parser/parse-nlp",
        json={"text": "beli 2 kopi susu @18rb bayar pakai gopay"},
    )

    body = response.json()
    assert body["account_id"] is not None


def test_the_place_is_kept_apart_from_the_shop(client):
    response = client.post(
        "/api/parser/parse-nlp",
        json={"text": "beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran"},
    )

    body = response.json()
    assert body["merchant"] == "Kopi Jago"
    assert body["location"] == "Kemayoran"
    assert body["total_amount"] == 30000
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 2
    assert body["items"][0]["unit_price"] == 15000


# === The magic fix ===

def test_the_magic_fix_fills_in_what_was_missing(client):
    """
    "Tanya Maskot". The reading is asked to be finished: the category
    worked out, the account chosen, the total settled.
    """
    response = client.post(
        "/api/parser/parse-nlp",
        json={"text": "beli 2 kopi susu @18rb", "refine": True},
    )

    body = response.json()
    assert body["category"]
    assert body["total_amount"] == 36000
    assert body["fixes"]


def test_the_magic_fix_never_loses_a_line(client):
    response = client.post(
        "/api/parser/parse-nlp",
        json={"text": "beli 2 kopi susu @18rb sama 1 roti bakar 22rb", "refine": True},
    )

    body = response.json()
    assert len(body["items"]) == 2
    assert body["total_amount"] == 58000


def test_the_magic_fix_works_with_nothing_to_match_against(client):
    """
    A guest, or a reader who is offline. There are no accounts and no
    categories to choose from, and the reading still has to be worth
    something.
    """
    response = client.post(
        "/api/parser/parse-nlp",
        json={
            "text": "beli 2 kopi susu @18rb",
            "refine": True,
            "accounts": [],
            "categories": [],
        },
    )

    body = response.json()
    assert len(body["items"]) == 1
    assert body["total_amount"] == 36000
    assert body["category"]


def test_a_sentence_with_nothing_in_it_does_not_crash(client):
    response = client.post("/api/parser/parse-nlp", json={"text": ""})

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "expense"
    assert body["items"] == []


def test_a_sentence_of_nonsense_does_not_crash(client):
    """
    The voice input sends whatever it heard, and it sometimes hears
    nothing at all. The endpoint has to answer, not fall over.
    """
    response = client.post(
        "/api/parser/parse-nlp", json={"text": "asdkjhaskdjh askdjh"}
    )

    assert response.status_code == 200
    assert "items" in response.json()
