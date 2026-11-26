"""
The lines of a transaction have to be there afterwards.

A transaction saved with a list of items is saved with those items. And
when the history is read back, the items are in the answer.

Before, the history was built by hand and only knew about the lines
that came from a receipt scan. A transaction saved the ordinary way
kept its lines as a breakdown, so the history showed the total and
nothing else, and the reader could not see what they had bought.
"""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.models.account import Account
from app.models.breakdown_item import BreakdownItem
from app.models.user import User
from app.schemas.transaction import TransactionCreate


@pytest.fixture
def db_session():
    """A database of its own, so the test writes nothing real."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    # Only the tables this test touches. The whole schema has columns
    # that SQLite cannot draw, and they are not needed here.
    Base.metadata.create_all(
        engine,
        tables=[
            Base.metadata.tables["users"],
            Base.metadata.tables["accounts"],
            Base.metadata.tables["transactions"],
            Base.metadata.tables["breakdown_items"],
        ],
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def reader(db_session):
    """A reader with one account."""
    user = User(
        email="lines-reader@example.com",
        username="linesreader",
        hashed_password="x",
        is_guest=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    account = Account(
        user_id=user.id,
        name="BCA",
        account_type="bank",
        account_kind="bank",
        balance=Decimal("0"),
        currency="IDR",
        is_active=True,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return user, account


def test_the_lines_of_a_saved_transaction_come_back(db_session, reader):
    """The items are still there when the history is read."""
    from app.models.transaction import Transaction

    user, account = reader
    transaction = Transaction(
        user_id=user.id,
        type="expense",
        amount=Decimal("37000"),
        currency="IDR",
        date=date(2024, 10, 12),
        description="Belanja",
        account_id=account.id,
        merchant_name="Warung Sederhana",
        status="approved",
    )
    db_session.add(transaction)
    db_session.commit()
    db_session.refresh(transaction)

    db_session.add_all(
        [
            BreakdownItem(
                user_id=user.id,
                parent_type="transaction",
                parent_id=transaction.id,
                name="Kopi Jago vanila",
                quantity=Decimal("2"),
                unit_price=Decimal("15000"),
                total_price=Decimal("30000"),
            ),
            BreakdownItem(
                user_id=user.id,
                parent_type="transaction",
                parent_id=transaction.id,
                name="Roti Bakar",
                quantity=Decimal("1"),
                unit_price=Decimal("22000"),
                total_price=Decimal("22000"),
            ),
        ]
    )
    db_session.commit()

    app = _app_with(db_session, user)
    with TestClient(app) as client:
        answer = client.get("/api/transactions/")
        assert answer.status_code == 200
        rows = answer.json()

    assert len(rows) == 1
    lines = rows[0]["items"]
    assert len(lines) == 2, "the lines of the transaction have to come back"
    assert lines[0]["name"] == "Kopi Jago vanila"
    assert float(lines[0]["quantity"]) == 2.0
    assert float(lines[0]["unit_price"]) == 15000.0
    assert lines[1]["name"] == "Roti Bakar"


def test_a_transaction_with_no_lines_is_still_listed(db_session, reader):
    """A transaction with no lines is not lost."""
    from app.models.transaction import Transaction

    user, account = reader
    transaction = Transaction(
        user_id=user.id,
        type="expense",
        amount=Decimal("10000"),
        currency="IDR",
        date=date(2024, 10, 12),
        description="Sekali jalan",
        account_id=account.id,
        status="approved",
    )
    db_session.add(transaction)
    db_session.commit()

    app = _app_with(db_session, user)
    with TestClient(app) as client:
        answer = client.get("/api/transactions/")
        assert answer.status_code == 200
        rows = answer.json()

    assert len(rows) == 1
    assert rows[0]["items"] == []


def _app_with(session, user):
    """The app, with the database and the reader fixed in place."""
    from fastapi import FastAPI

    from app.api.routes import transactions as transactions_route
    from app.core.security import create_access_token

    app = FastAPI()
    app.include_router(transactions_route.router, prefix="/api/transactions")

    def _db():
        yield session

    app.dependency_overrides[get_db] = _db

    token = create_access_token(user.id)

    from app.core.security import get_current_user

    app.dependency_overrides[get_current_user] = lambda: user
    app.state.token = token
    return app
