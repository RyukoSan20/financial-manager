"""
The map must count every expense the reader has.

The map page was showing "0 Lokasi" and "Rp 0" while the reader had
transactions. The map asked for the transactions that had a shop
name, and a transaction recorded from the quick entry box has no shop
name - it has a description, a category and an amount. So it was
dropped, and the reader was told their own records were empty.

The question the map asks now is "which expenses have not been
placed yet?", not "which expenses have a shop name?".

This file holds that shut, against a database of our own.
"""

from datetime import date

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.transaction import Transaction


@pytest.fixture()
def session():
    """
    A database of our own, so the test never touches a real one.
    """
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.split_bill  # noqa: F401
    from app.modules.ledger.location.models import (  # noqa: F401
        MerchantLocation,
        SpendingByLocation,
        TransactionLocation,
    )

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _add_now(dbapi_connection, _record):
        dbapi_connection.create_function("NOW", 0, lambda: "2026-11-07 00:00:00")

    private = Base.metadata
    wanted = (
        "transactions",
        "accounts",
        "categories",
        "users",
        "split_groups",
        "split_members",
        "split_expenses",
        "split_items",
        "split_settlements",
        "receipt_scans",
        "receipt_items",
        "scan_jobs",
        "transaction_items",
        "transaction_locations",
        "merchant_locations",
        "spending_by_location",
        "breakdown_items",
    )
    private.create_all(
        engine,
        tables=[private.tables[name] for name in wanted if name in private.tables],
    )

    # The map's own tables are on the base of the ledger, which is a
    # different base from the rest, and their foreign keys point at
    # tables that base does not know about. So they are written out
    # by hand, with the keys left out: the test is about which
    # expenses are counted, not about the shape of the table.
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS transaction_locations ("
            " id INTEGER PRIMARY KEY,"
            " transaction_id INTEGER,"
            " merchant_location_id INTEGER,"
            " captured_latitude DOUBLE,"
            " captured_longitude DOUBLE,"
            " captured_address TEXT,"
            " inside_geofence BOOLEAN,"
            " nearest_store_name VARCHAR,"
            " nearest_store_distance_meters DOUBLE,"
            " created_at TIMESTAMP"
            ")"
        ))
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS merchant_locations ("
            " id INTEGER PRIMARY KEY,"
            " name VARCHAR,"
            " latitude DOUBLE,"
            " longitude DOUBLE,"
            " address TEXT"
            ")"
        ))
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS spending_by_location ("
            " id INTEGER PRIMARY KEY,"
            " location_id INTEGER,"
            " amount DOUBLE"
            ")"
        ))

    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def _make_a_quick_entry(session, description="Makan siang", amount=25000.0):
    """
    A transaction the way the quick entry box makes one: a figure, a
    category and a name. No shop name, because a quick entry has no
    shop.
    """
    from app.models.account import Account
    from app.models.category import Category
    from app.models.user import User

    user = User(
        id=1,
        email="reader@example.test",
        hashed_password="x",
        full_name="Reader",
    )
    session.add(user)

    account = Account(
        id=1,
        user_id=1,
        name="BCA",
        account_type="bank",
        balance=0.0,
        currency="IDR",
    )
    session.add(account)

    category = Category(id=6, name="Makanan & Minuman", type="expense")
    session.add(category)
    session.commit()

    tx = Transaction(
        id=901,
        user_id=1,
        type="expense",
        amount=amount,
        currency="IDR",
        date=date(2026, 10, 23),
        description=description,
        category_id=6,
        account_id=1,
    )
    session.add(tx)
    session.commit()
    return tx


def test_a_quick_entry_is_on_the_map(session):
    """The money is accounted for, and the pin says it is a guess."""
    from app.api.routes.analytics import get_merchant_map_data

    _make_a_quick_entry(session)

    class _User:
        id = 1

    answer = get_merchant_map_data(current_user=_User(), db=session)

    assert answer["total_locations"] >= 1, (
        "the expense was left off the map: %r" % answer
    )
    assert answer["total_spent"] >= 25000.0, (
        "the money was not accounted for: %r" % answer["total_spent"]
    )

    estimated = [m for m in answer["markers"] if m.get("is_estimated")]
    assert estimated, "the pin does not say it is an estimate"
    assert estimated[0]["latitude"] is not None
    assert estimated[0]["longitude"] is not None
    # And it has a name, so the pin is not an empty box.
    assert estimated[0]["name"], "the pin has no name"


def test_a_deleted_expense_is_not_on_the_map(session):
    """A transaction the reader threw away is not spending."""
    from app.api.routes.analytics import get_merchant_map_data

    tx = _make_a_quick_entry(session)
    tx.is_deleted = True
    session.commit()

    class _User:
        id = 1

    answer = get_merchant_map_data(current_user=_User(), db=session)

    assert answer["total_spent"] == 0, (
        "a deleted transaction is still being counted: %r" % answer["total_spent"]
    )
