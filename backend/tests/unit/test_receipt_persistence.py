"""
A scanned receipt has to end up somewhere the reader can find it.

The transaction that came out of a scan used to vanish. The receipt was
read, the total was shown, and then the save failed: a reader with no
account had nowhere to put the money, so the transaction was never
written down and the screen said nothing about it.

A guest reader - somebody who chose "try it without an account" - was
given a user and no accounts at all, so their very first scan was
always the one that vanished.

These are the checks that keep the purchase where the reader left it:
in the history, and in the review.
"""

import pytest
from datetime import date as date_cls
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.account import Account
from app.models.breakdown_item import BreakdownItem
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.transaction_item import TransactionItem
from app.models.user import User


@pytest.fixture()
def db():
    """
    A database with only the tables these checks need.
    """
    engine = create_engine("sqlite://")
    tables = [
        User.__table__,
        Account.__table__,
        Category.__table__,
        Transaction.__table__,
        BreakdownItem.__table__,
        TransactionItem.__table__,
    ]
    Base.metadata.create_all(bind=engine, tables=tables)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def guest(db):
    """
    A reader who chose to try it without an account.

    They have a user and nothing else. This is the state that made the
    scanned transactions disappear.
    """
    user = User(
        email="guest@example.invalid",
        username="guest_reader",
        hashed_password="x",
        is_guest=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def reader(db):
    """A reader with one account to hold the money."""
    user = User(email="reader@example.invalid", username="reader", hashed_password="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    account = Account(
        user_id=user.id,
        name="BCA",
        account_type="bank",
        balance=100000,
        currency="IDR",
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return user, account


# === The account ===

def test_a_guest_with_no_accounts_is_given_one(db, guest):
    """
    The root of the vanishing transaction. A guest with no accounts
    gets one, so their first scan has a home.
    """
    from app.services.account_bootstrap import ensure_account

    assert db.query(Account).filter(Account.user_id == guest.id).count() == 0

    account = ensure_account(db, guest.id)

    assert account is not None
    assert account.user_id == guest.id
    assert account.is_active is True
    assert account.currency == "IDR"
    assert account.balance == 0


def test_the_account_is_made_only_once(db, guest):
    """
    A reader who has an account keeps it. The account is not made
    again on every request.
    """
    from app.services.account_bootstrap import ensure_account

    first = ensure_account(db, guest.id)
    second = ensure_account(db, guest.id)

    assert first.id == second.id
    assert db.query(Account).filter(Account.user_id == guest.id).count() == 1


def test_a_reader_keeps_their_own_account(db, reader):
    """
    The reader's own account is never replaced. It is theirs.
    """
    from app.services.account_bootstrap import ensure_account

    user, account = reader
    found = ensure_account(db, user.id)

    assert found.id == account.id
    assert found.name == "BCA"


def test_a_closed_account_is_respected(db, reader):
    """
    A reader who closed their account made a decision. It is not
    undone behind their back.
    """
    from app.services.account_bootstrap import ensure_account

    user, account = reader
    account.is_active = False
    db.commit()

    assert ensure_account(db, user.id) is None


# === The transaction from a scan ===

def test_a_scan_becomes_a_transaction_for_a_guest(db, guest):
    """
    The check that used to fail. The guest has no account, so the scan
    used to end with no transaction at all and the reader was left
    looking at an empty history.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    scan = {
        "merchant_name": "Kopi Jago",
        "amount": "55000",
        "date": "2026-10-20",
        "payment_method": "QRIS",
        "items": [
            {
                "name": "Kopi Jago vanila",
                "quantity": 2,
                "unit_price": 15000,
                "total_price": 30000,
            }
        ],
        "breakdown": {"total": 55000},
    }

    transaction_id = _create_transaction_for_scan(db, guest.id, scan, None)
    db.commit()

    assert transaction_id is not None

    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    assert transaction is not None
    assert transaction.user_id == guest.id
    assert float(transaction.amount) == 55000
    assert transaction.merchant_name == "Kopi Jago"

    # And the account it was put in exists.
    account = db.query(Account).filter(Account.id == transaction.account_id).first()
    assert account is not None
    assert account.user_id == guest.id


def test_a_scan_becomes_a_transaction_for_a_reader(db, reader):
    """
    The ordinary case still works, and still uses the reader's own
    account.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    user, account = reader
    scan = {
        "merchant_name": "Kopi Jago",
        "amount": "55000",
        "date": "2026-10-20",
        "items": [],
        "breakdown": {"total": 55000},
    }

    transaction_id = _create_transaction_for_scan(db, user.id, scan, None)
    db.commit()

    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    assert transaction.account_id == account.id
    assert transaction.status == "pending"


def test_the_lines_of_a_scan_travel_with_it(db, guest):
    """
    A receipt is a list of things, and the list has to survive into the
    history and the review.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    scan = {
        "merchant_name": "Kopi Jago",
        "amount": "55000",
        "date": "2026-10-20",
        "items": [
            {
                "name": "Kopi Jago vanila",
                "quantity": 2,
                "unit_price": 15000,
                "total_price": 30000,
            },
            {
                "name": "Roti Bakar",
                "quantity": 1,
                "unit_price": 22000,
                "total_price": 22000,
            },
        ],
        "breakdown": {"total": 55000},
    }

    transaction_id = _create_transaction_for_scan(db, guest.id, scan, None)
    db.commit()

    from app.models.breakdown_item import BreakdownItem

    items = (
        db.query(BreakdownItem)
        .filter(BreakdownItem.parent_type == "transaction")
        .filter(BreakdownItem.parent_id == transaction_id)
        .all()
    )

    assert len(items) == 2
    names = sorted(item.name for item in items)
    assert names == ["Kopi Jago vanila", "Roti Bakar"]


def test_a_scan_with_no_amount_makes_no_transaction(db, guest):
    """
    A receipt nothing could read is not a transaction. There is no
    number to write down.
    """
    from app.api.routes.scans import _create_transaction_for_scan

    scan = {
        "merchant_name": "Kopi Jago",
        "amount": "0",
        "items": [],
        "breakdown": {"total": 0},
    }

    assert _create_transaction_for_scan(db, guest.id, scan, None) is None


# === The review ===

def test_a_scanned_receipt_is_queued_for_the_review(db, guest):
    """
    The review is where the reader checks the things that came in from
    outside. A scanned receipt has to be there, with its lines, waiting
    to be looked at.
    """
    from app.api.routes.feed import _build_feed_item

    account = Account(
        user_id=guest.id,
        name="Cash",
        account_type="cash",
        balance=0,
        currency="IDR",
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    transaction = Transaction(
        user_id=guest.id,
        type="expense",
        amount=55000,
        currency="IDR",
        date=date_cls(2026, 10, 20),
        description="Receipt: Kopi Jago",
        account_id=account.id,
        status="pending",
        source="camera_scan",
        merchant_name="Kopi Jago",
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    item = _build_feed_item(transaction, db)

    assert item is not None
    assert item.id == transaction.id
    assert item.status == "pending"
    assert item.merchant_name == "Kopi Jago"
