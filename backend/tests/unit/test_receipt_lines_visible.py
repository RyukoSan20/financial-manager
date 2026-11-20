"""
The lines of a receipt have to survive the whole way.

A receipt that was scanned has lines in it: the coffees and the bread
and what each one cost. Those lines have to be the same whether the
reader opens the history or opens the review, and they have to be the
real lines and not a guess.

Before, two things went wrong.

The first was that the lines were not in the history at all: the
history was built by hand and only knew about the lines that came from
a receipt scan, so a receipt saved the ordinary way showed the total
and nothing else.

The second was that the guesser ran over the top of the real lines.
The guesser is there for a transaction that arrived with nothing, but
it ran anyway, and it replaced the coffees and the bread with two
vague lines called "Belanja" and "Lainnya". The review then showed
the guess and the reader could not see what they had bought.
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
from app.models.category import Category
from app.models.receipt import ReceiptItem, ReceiptScan
from app.models.transaction import Transaction
from app.models.user import User


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(
        engine,
        tables=[
            Base.metadata.tables["users"],
            Base.metadata.tables["accounts"],
            Base.metadata.tables["categories"],
            Base.metadata.tables["transactions"],
            Base.metadata.tables["transaction_items"],
            Base.metadata.tables["breakdown_items"],
            Base.metadata.tables["receipt_scans"],
            Base.metadata.tables["receipt_items"],
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
    """A reader with one account and one category."""
    user = User(
        email="receipt-lines@example.com",
        username="receiptlines",
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

    category = Category(
        user_id=user.id,
        name="Makanan",
        type="expense",
        icon="x",
        color="#fff",
    )
    db_session.add(category)
    db_session.commit()
    db_session.refresh(account)
    db_session.refresh(category)
    return user, account, category


def _scanned_receipt(session, user, account, category):
    """A transaction that came from a scanned receipt, with its lines."""
    receipt = ReceiptScan(
        user_id=user.id,
        merchant_name="Kopi Jago",
        total_amount=Decimal("52000"),
        detection_type="receipt_ocr",
        is_processed=True,
    )
    session.add(receipt)
    session.flush()
    session.refresh(receipt)

    session.add_all(
        [
            ReceiptItem(
                receipt_scan_id=receipt.id,
                raw_name="Kopi Jago vanila",
                quantity=2,
                price_per_unit=Decimal("15000"),
                total_price=Decimal("30000"),
            ),
            ReceiptItem(
                receipt_scan_id=receipt.id,
                raw_name="Roti Bakar",
                quantity=1,
                price_per_unit=Decimal("22000"),
                total_price=Decimal("22000"),
            ),
        ]
    )

    transaction = Transaction(
        user_id=user.id,
        type="expense",
        amount=Decimal("52000"),
        currency="IDR",
        date=date(2024, 10, 12),
        description="Kopi Jago",
        account_id=account.id,
        category_id=category.id,
        merchant_name="Kopi Jago",
        detection_type="receipt_ocr",
        receipt_scan_id=receipt.id,
        status="approved",
    )
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction, receipt


def test_the_history_shows_the_lines_of_a_receipt(db_session, reader):
    """The reader can see what they bought."""
    from app.api.routes import transactions as transactions_route

    user, account, category = reader
    _scanned_receipt(db_session, user, account, category)

    app = _app_with(db_session, user, transactions_route.router, "/api/transactions")
    with TestClient(app) as client:
        answer = client.get("/api/transactions/")
        assert answer.status_code == 200
        rows = answer.json()

    assert len(rows) == 1
    lines = rows[0]["items"]
    assert len(lines) == 2, "the lines of the receipt have to come back"
    names = sorted(line["name"] for line in lines)
    assert names == ["Kopi Jago vanila", "Roti Bakar"]
    # The price of one has to be there under both of its names, or a
    # reader that asks for one and gets the other sees a price of
    # nothing.
    for line in lines:
        assert line["unit_price"] is not None
        assert float(line["unit_price"]) > 0
        assert float(line["price_per_unit"]) > 0


def test_the_review_shows_the_lines_of_a_receipt(db_session, reader):
    """The review is where a receipt is looked at, so it has to show them."""
    from app.api.routes import feed as feed_route

    user, account, category = reader
    _scanned_receipt(db_session, user, account, category)

    app = _app_with(db_session, user, feed_route.router, "/api/feed")
    with TestClient(app) as client:
        answer = client.get("/api/feed/all")
        assert answer.status_code == 200
        rows = answer.json()

    assert len(rows) == 1
    lines = rows[0]["items"]
    assert len(lines) == 2, "the lines of the receipt have to be in the review"
    names = sorted(line["name"] for line in lines)
    assert names == ["Kopi Jago vanila", "Roti Bakar"]


def test_the_guesser_does_not_overwrite_the_real_lines(db_session, reader):
    """
    A receipt keeps its own lines.

    The guesser is a fallback for a transaction that arrived with
    nothing. When it ran over a receipt it replaced the coffees and
    the bread with two vague lines, and the review showed the guess.
    """
    from app.api.routes import transactions as transactions_route

    user, account, category = reader
    transaction, receipt = _scanned_receipt(db_session, user, account, category)

    # The lines the receipt really has.
    db_session.add(
        BreakdownItem(
            user_id=user.id,
            parent_type="transaction",
            parent_id=transaction.id,
            name="Kopi Jago vanila",
            quantity=Decimal("2"),
            unit_price=Decimal("15000"),
            total_price=Decimal("30000"),
            source="user",
        )
    )
    db_session.commit()

    # The guesser must leave them alone.
    from app.api.routes.transactions import _has_real_lines

    assert _has_real_lines(db_session, user.id, transaction.id) is True

    # And a transaction with nothing but guesses is not a real one.
    db_session.query(BreakdownItem).filter(
        BreakdownItem.parent_type == "transaction",
        BreakdownItem.parent_id == transaction.id,
    ).delete(synchronize_session=False)
    db_session.add(
        BreakdownItem(
            user_id=user.id,
            parent_type="transaction",
            parent_id=transaction.id,
            name="Belanja",
            quantity=Decimal("1"),
            unit_price=Decimal("52000"),
            total_price=Decimal("52000"),
            source="template",
        )
    )
    db_session.commit()

    assert _has_real_lines(db_session, user.id, transaction.id) is False


def _app_with(session, user, router, prefix):
    """The app, with the database and the reader fixed in place."""
    from fastapi import FastAPI

    from app.core.security import get_current_user

    app = FastAPI()
    app.include_router(router, prefix=prefix)

    def _db():
        yield session

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: user
    return app
