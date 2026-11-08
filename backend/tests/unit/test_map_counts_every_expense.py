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

def test_the_map_groups_by_every_column_it_names():
    """
    The answer is built from the shop name, the description and the
    address, so the grouping has to name all three.

    PostgreSQL refuses a grouping that leaves a column out, and the
    map answered with a 500. SQLite is happy with a grouping that
    leaves one out, so the test here is not about the database: it is
    about the columns being named together.
    """
    import re

    from app.api.routes import analytics

    source = open(analytics.__file__, encoding="utf-8").read()
    start = source.index("def get_merchant_map_data")
    end = source.index("\n@router.", start + 10)
    body = source[start:end]

    # The columns the answer is built from.
    match = re.search(
        r"func\.coalesce\(\s*func\.nullif\(Transaction\.merchant_name.*?"
        r"Transaction\.merchant_address,\s*\"\"\s*\)",
        body,
        re.S,
    )
    assert match, "the answer does not name the shop, the description and the address"

    named = set(re.findall(r"Transaction\.(\w+)", match.group(0)))

    # The grouping.
    group = re.search(r"merchant_q = merchant_q\.group_by\((.*?)\)", body, re.S)
    assert group, "the map does not group its answer at all"
    grouped = set(re.findall(r"Transaction\.(\w+)", group.group(1)))

    missing = named - grouped
    assert not missing, (
        "the grouping leaves out %s, and PostgreSQL refuses the query "
        "that uses it" % sorted(missing)
    )


def test_two_expenses_are_both_on_the_map(session):
    """
    The two transactions the reader actually has.

    "-Rp 25.000" and "-Rp 10.000 Kopi Jago" - one of them has
    nothing but a name and a figure, and the other has a shop. Both
    of them have to be on the map, and the money has to add up.
    """
    from app.api.routes.analytics import get_merchant_map_data
    from app.models.transaction import Transaction

    _make_a_quick_entry(session, description=None, amount=25000.0)

    # The coffee: a shop, a description, and a category.
    coffee = Transaction(
        id=902,
        user_id=1,
        type="expense",
        amount=10000.0,
        currency="IDR",
        date=date(2026, 11, 8),
        description="Kopi Jago",
        category_id=6,
        account_id=1,
    )
    session.add(coffee)
    session.commit()

    class _User:
        id = 1

    answer = get_merchant_map_data(current_user=_User(), db=session)

    assert answer["total_locations"] >= 1, (
        "the expenses were left off the map: %r" % answer
    )
    assert answer["total_spent"] == 35000.0, (
        "the money did not add up: %r" % answer["total_spent"]
    )

    # Every pin has a place on the map.
    for marker in answer["markers"]:
        assert marker.get("latitude") is not None, (
            "a pin has no place: %r" % marker
        )
        assert marker.get("longitude") is not None, (
            "a pin has no place: %r" % marker
        )
        assert marker.get("name"), "a pin has no name: %r" % marker
