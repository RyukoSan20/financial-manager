"""
The bill of an ordinary transaction, shared.

A reader who writes down what they bought in `/add` and shares it
does two things: they make a transaction, and they make a bill in a
group. The bill is that transaction, so the two have to point at each
other.

Without that link the bill floats free of the transaction. Nothing
ties the money that left the wallet to the money that was shared, so
the reader's spending and their shared spending tell two different
stories, and there is no way to answer "how much of this did I
actually pay for?".

The numbers of the bill have to survive the journey too. A bill
written down with a zero subtotal and a zero tax cannot be settled
later, because the shares were worked out from the total alone.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine as ce
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.api.routes import split_bills


@pytest.fixture()
def client():
    """
    The application, with a small database behind it.

    The tables that are made by hand are the ones the shared bill
    needs, plus the ones it points at. The whole schema cannot be
    made on a small database because one of the other tables uses a
    column type that only the big one has.
    """
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.receipt  # noqa: F401

    engine = ce(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    private = MetaData()

    copied = set()

    def copy_table(name):
        if name in copied or name not in Base.metadata.tables:
            return
        copied.add(name)
        source = Base.metadata.tables[name]
        for column in source.columns:
            for foreign_key in column.foreign_keys:
                copy_table(foreign_key.target_fullname.split(".")[0])
        source.to_metadata(private)

    for name in (
        "users",
        "accounts",
        "categories",
        "transactions",
        "receipt_scans",
        "split_groups",
        "split_members",
        "split_expenses",
        "split_payers",
        "split_items",
        "split_item_claims",
        "split_calculated_shares",
        "split_settlements",
        "split_payment_methods",
    ):
        copy_table(name)

    private.create_all(engine)
    Session = sessionmaker(bind=engine)

    class _TheReader:
        id = 1
        email = "host@example.test"
        name = "The Host"
        is_active = True

    app = FastAPI()
    app.include_router(split_bills.router, prefix="/api/split")

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: _TheReader()

    with TestClient(app) as test_client:
        test_client.db = Session
        yield test_client


def _group(client):
    response = client.post(
        "/api/split/groups",
        json={"name": "Lunch at the Warung"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_the_bill_can_be_tied_to_the_transaction_it_came_from(client):
    """
    The bill that was made for a transaction keeps the link to it.

    The reader made a transaction for Rp13.200 and shared that same
    purchase. The bill has to know which transaction it is.
    """
    group = _group(client)

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Makan Siang Warung",
            "subtotal": "12000",
            "tax": "1200",
            "service_charge": "0",
            "discount": "0",
            "grand_total": "13200",
            "split_mode": "EQUAL",
            "transaction_id": 555,
            "items": [
                {"name": "Indomie Goreng", "quantity": "2", "unit_price": "3500"},
                {"name": "Es Teh Manis", "quantity": "1", "unit_price": "5000"},
            ],
        },
    )
    assert created.status_code == 201, created.text
    expense = created.json()

    assert expense["transaction_id"] == 555


def test_the_numbers_of_the_bill_are_kept(client):
    """
    The subtotal, the tax and the total survive the journey.

    The bill is written down from what the reader saw on the screen.
    If the numbers are lost on the way, the bill cannot be settled:
    the shares were worked out from the total alone.
    """
    group = _group(client)

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Makan Siang Warung",
            "subtotal": "12000",
            "tax": "1200",
            "service_charge": "500",
            "discount": "1000",
            "grand_total": "12700",
            "split_mode": "EQUAL",
            "items": [
                {"name": "Indomie Goreng", "quantity": "2", "unit_price": "3500"},
            ],
        },
    )
    assert created.status_code == 201, created.text
    expense = created.json()

    assert float(expense["subtotal"]) == 12000
    assert float(expense["tax"]) == 1200
    assert float(expense["service_charge"]) == 500
    assert float(expense["discount"]) == 1000
    assert float(expense["grand_total"]) == 12700


def test_a_bill_without_a_transaction_is_still_a_bill(client):
    """
    A bill made on its own, without a transaction behind it, is
    allowed. The link is there when there is one to make.
    """
    group = _group(client)

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "A bill of its own",
            "grand_total": "50000",
            "items": [
                {"name": "Steak", "quantity": "1", "unit_price": "50000"},
            ],
        },
    )
    assert created.status_code == 201, created.text
    expense = created.json()

    assert expense["transaction_id"] is None
