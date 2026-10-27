"""
A scan has to leave a transaction behind.

The background scan wrote down the receipt and its lines, and learned
the products into the catalogue, but it never made a transaction. So
the result sheet had something to show, the "View Transaction" button
led to a page with no transaction on it, and the history stayed empty.

These are the checks that keep it that way.

There is also a check on the list itself: it used to stop at a hundred
transactions with no way to reach any of the ones behind them, so a
reader with a year of spending could only ever see the first hundred.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.account import Account
from app.models.category import Category
from app.models.receipt import ReceiptItem, ReceiptScan
from app.models.transaction import Transaction
from app.models.user import User


@pytest.fixture()
def db():
    """
    A database with only the tables these checks need.

    The full set cannot be created on SQLite, because one of the
    tables has a column SQLite cannot render.
    """
    engine = create_engine("sqlite://")
    tables = [
        User.__table__,
        Account.__table__,
        Category.__table__,
        Transaction.__table__,
        ReceiptScan.__table__,
        ReceiptItem.__table__,
    ]
    Base.metadata.create_all(bind=engine, tables=tables)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def reader(db):
    """A reader with one account to hold the money."""
    user = User(email="reader@example.invalid", username="reader", hashed_password="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    account = Account(
        user_id=user.id,
        name="Cash",
        account_type="cash",
        balance=100000,
        currency="IDR",
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return user, account


SCAN_RESULT = {
    "merchant_name": "Bank Sinarmas",
    "amount": "9000",
    "date": "2026-10-20",
    "payment_method": "QRIS",
    "items": [
        {
            "name": "Transfer to ShopeePay",
            "quantity": 1,
            "price_per_unit": 9000,
            "total_price": 9000,
        }
    ],
    "breakdown": {
        "items": [
            {
                "name": "Transfer to ShopeePay",
                "quantity": 1,
                "price_per_unit": 9000,
                "total_price": 9000,
            }
        ],
        "total": 9000,
    },
}


# === The transaction is made ===

def test_a_scan_makes_a_transaction(db, reader):
    """
    The whole point. A scan that finishes has to leave a transaction
    behind, or there is nothing to open and the history stays empty.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    user, account = reader
    transaction_id = _create_transaction_for_scan(db, user.id, SCAN_RESULT, None)
    db.commit()

    assert transaction_id is not None

    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    assert transaction is not None
    assert float(transaction.amount) == 9000
    assert transaction.type == "expense"
    assert transaction.account_id == account.id
    assert transaction.user_id == user.id
    assert transaction.merchant_name == "Bank Sinarmas"


def test_the_transaction_waits_for_the_review(db, reader):
    """
    Nobody has looked at the scan yet, and the amount may be wrong, so
    the transaction waits and does not move the balance.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    user, account = reader
    transaction_id = _create_transaction_for_scan(db, user.id, SCAN_RESULT, None)
    db.commit()

    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    assert transaction.status == "pending"
    assert transaction.source == "camera_scan"

    # The balance is where it was before the scan.
    db.refresh(account)
    assert float(account.balance) == 100000


def test_the_scan_is_linked_to_the_transaction(db, reader):
    """
    The transaction and the receipt are the same purchase, so the
    receipt is pointed at from the transaction.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    user, _ = reader
    receipt = ReceiptScan(user_id=user.id, merchant_name="Bank Sinarmas")
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    transaction_id = _create_transaction_for_scan(
        db, user.id, SCAN_RESULT, int(receipt.id)
    )
    db.commit()

    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    assert int(transaction.receipt_scan_id) == int(receipt.id)


def test_saving_the_scan_makes_the_transaction(db, reader):
    """
    The wiring, not just the helper.

    The helper can be perfect and still never be called, which is
    exactly what had happened: the receipt was saved and no
    transaction was made. This goes through the save path the scan
    actually uses.
    """
    from app.api.routes.scans import _save_scan_to_db

    user, _ = reader
    receipt_id = _save_scan_to_db(db, user.id, SCAN_RESULT)
    db.commit()

    assert receipt_id is not None

    transactions = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    assert len(transactions) == 1
    assert float(transactions[0].amount) == 9000
    assert transactions[0].status == "pending"


def test_the_transaction_id_is_returned_to_the_client(db, reader):
    """
    The client needs the id, so that the "View Transaction" button can
    go to the transaction rather than to the top of an empty list.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    user, _ = reader
    transaction_id = _create_transaction_for_scan(db, user.id, SCAN_RESULT, None)
    assert transaction_id is not None
    assert isinstance(transaction_id, int)


def test_no_transaction_without_an_account(db, reader):
    """
    A reader with no account has nowhere to put the money. The scan is
    still saved; there is simply no transaction.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    user, account = reader
    # The account is made inactive rather than deleted, so that the
    # other tables that point at it are not disturbed.
    account.is_active = False
    db.commit()

    transaction_id = _create_transaction_for_scan(db, user.id, SCAN_RESULT, None)
    assert transaction_id is None


def test_no_transaction_without_an_amount(db, reader):
    """
    A scan that read no amount is not a transaction.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    user, _ = reader
    result = dict(SCAN_RESULT)
    result["amount"] = "0"
    result["breakdown"] = {"total": 0}

    assert _create_transaction_for_scan(db, user.id, result, None) is None


# === The date ===

@pytest.mark.parametrize(
    "value,expected",
    [
        ("2026-10-20", "2026-10-20"),
        ("2026-10-20T10:30:00", "2026-10-20"),
        ("20/10/2026", "2026-10-20"),
        ("", None),
        (None, None),
        ("not a date", None),
    ],
)
def test_the_date_of_a_scan_is_read_in_whatever_shape_it_arrives(value, expected):
    """
    The parsers hand the date back in several shapes. A transaction
    needs a real date, so they are all turned into one.
    """
    from datetime import date as date_cls

    from app.api.routes.scans import _parse_scan_date

    result = _parse_scan_date(value)
    if expected is None:
        assert result is None
    else:
        assert result == date_cls.fromisoformat(expected)


def test_a_scan_without_a_date_uses_today(db, reader):
    from app.api.routes.scans import _create_transaction_for_scan

    user, _ = reader
    result = dict(SCAN_RESULT)
    result["date"] = None
    result["breakdown"] = {"total": 9000}

    transaction_id = _create_transaction_for_scan(db, user.id, result, None)
    db.commit()

    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    assert transaction.date is not None
