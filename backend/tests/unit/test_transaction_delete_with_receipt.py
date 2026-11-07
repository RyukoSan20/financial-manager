"""
A transaction that came from a receipt must still be deletable.

A receipt scan points at the transaction it produced, and the
transaction points back at the scan. The two are joined by two
foreign keys, and they point at each other.

When the transaction was deleted, the scan was still pointing at it,
so the database refused. The reader clicked the bin, the server said
500, and the money stayed in the list where it was. The reader could
not get rid of the purchase they had already recorded.

So a delete has to clear the two pointers before the row goes, and
the lines of the receipt have to go with it. A delete that leaves the
lines behind is a delete that leaves half the record behind.

This file holds that shut.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.receipt import ReceiptItem, ReceiptScan
from app.models.transaction import Transaction


@pytest.fixture()
def session():
    """
    A database of our own, so the test never touches a real one.

    The receipt tables are included because the delete has to cope with
    them. SQLite is used with the foreign keys turned off so that the
    test can build the circular shape - which is exactly the shape
    that a real PostgreSQL database refuses to delete from.
    """
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # The server writes NOW() when it touches an account. SQLite has
    # never heard of it, so it is given one here. Without it the delete
    # fails on the balance update before it ever reaches the receipt.
    @event.listens_for(engine, "connect")
    def _add_now(dbapi_connection, _record):
        dbapi_connection.create_function("NOW", 0, lambda: "2026-11-07 00:00:00")

    private = Base.metadata
    private.create_all(engine, tables=[
        private.tables[name]
        for name in (
            "transactions",
            "accounts",
            "categories",
            "users",
            "receipt_scans",
            "receipt_items",
            "scan_jobs",
            "transaction_items",
            "transaction_locations",
            "breakdown_items",
        )
        if name in private.tables
    ])
    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def _make_with_receipt(db):
    """A transaction that came from a receipt, the two pointing at each other."""
    from app.models.user import User

    user = User(
        id=1,
        email="reader@example.test",
        hashed_password="x",
        full_name="Reader",
    )
    db.add(user)

    tx = Transaction(
        id=562,
        user_id=1,
        type="expense",
        amount=Decimal("210000"),
        currency="IDR",
        date=date(2026, 11, 6),
        description="Belanja",
        account_id=1,
        category_id=6,
    )
    db.add(tx)
    db.commit()

    scan = ReceiptScan(
        id=149,
        user_id=1,
        transaction_id=tx.id,
        total_amount=Decimal("210000"),
    )
    db.add(scan)
    db.commit()

    # The transaction points back at the scan.
    db.execute(
        text("UPDATE transactions SET receipt_scan_id = :scan WHERE id = :tx"),
        {"scan": scan.id, "tx": tx.id},
    )
    db.commit()

    db.add(
        ReceiptItem(
            receipt_scan_id=scan.id,
            raw_name="Indomie Goreng",
            quantity=2.0,
            price_per_unit=3500.0,
            total_price=7000.0,
        )
    )
    db.commit()
    return tx, scan


def test_the_receipt_scan_is_unlinked_before_the_transaction_goes(session):
    """
    The delete has to break the circle first.

    Two foreign keys point at each other: the scan points at the
    transaction and the transaction points at the scan. Deleting the
    transaction while the scan still points at it is refused by the
    database, and the reader gets an error instead of a deletion.
    """
    from app.api.routes.transactions import delete_transaction

    tx, scan = _make_with_receipt(session)

    class _User:
        id = 1

    delete_transaction(tx.id, current_user=_User(), db=session)

    # The transaction is gone.
    assert session.query(Transaction).filter(Transaction.id == tx.id).first() is None


def test_the_lines_of_the_receipt_go_with_the_transaction(session):
    """A delete that leaves the lines behind is half a delete."""
    from app.api.routes.transactions import delete_transaction

    tx, scan = _make_with_receipt(session)

    class _User:
        id = 1

    delete_transaction(tx.id, current_user=_User(), db=session)

    # The scan that produced the transaction is gone.
    assert session.query(ReceiptScan).filter(ReceiptScan.id == scan.id).first() is None
    # And so are the lines that were on it.
    left = session.query(ReceiptItem).filter(
        ReceiptItem.receipt_scan_id == scan.id
    ).all()
    assert left == []
