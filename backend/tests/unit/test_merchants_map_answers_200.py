"""
The map answers with a map, not with a 500.

The `/map` page is fed by `/api/analytics/merchants/map`. That route
builds its pins out of the reader's transactions, and a transaction
recorded by hand - one typed as "Kopi Jago 10rb" - has no latitude
and no longitude. The route has to put such a transaction on the
map anyway, marked as an estimate, because a map that says "0
Lokasi" for money that was spent tells the reader their own records
are empty when they are not.

It used to answer with a 500 instead, because the query that
collects the merchants grouped by some of the columns it named and
not by the others. PostgreSQL refuses that; SQLite accepts it, so
the test passed locally and the page broke in production.

So two things are checked here:

- the query names every column the answer names, so PostgreSQL
  accepts it;
- the route answers with HTTP 200 and with pins that have places on
  them, even when every transaction has no coordinates at all.

Nothing here touches the production server or a real database.
"""

import os
import sys
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api.routes import analytics  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.core.security import get_current_user  # noqa: E402
from app.models.transaction import Transaction  # noqa: E402


class _User:
    """The reader whose transactions are being put on the map."""

    id = 1


@pytest.fixture()
def session():
    """A database of the reader's own, with nothing else in it."""
    from sqlalchemy import create_engine, event, text
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.core.database import Base

    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401

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
    )
    private.create_all(
        engine,
        tables=[private.tables[name] for name in wanted if name in private.tables],
    )

    # The map's own tables are on the base of the ledger, which is a
    # different base from the rest, so they are written out by hand.
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


@pytest.fixture()
def client(session):
    """The application, with the map route mounted."""
    application = FastAPI()
    application.include_router(analytics.router, prefix="/api/analytics")

    application.dependency_overrides[get_db] = lambda: session
    application.dependency_overrides[get_current_user] = lambda: _User()

    return TestClient(application)


def _add(session, description, amount, category_id=1, account_id=1):
    """A transaction the reader wrote by hand."""
    row = Transaction(
        user_id=1,
        type="expense",
        amount=amount,
        currency="IDR",
        date=date(2026, 11, 8),
        description=description,
        category_id=category_id,
        account_id=account_id,
    )
    session.add(row)
    session.commit()
    return row


def test_the_map_answers_200_for_transactions_with_no_coordinates(
    client, session, monkeypatch
):
    """A hand-written transaction is still on the map.

    This is the exact shape of the failure that was in production:
    a transaction with a description and a figure, no latitude and no
    longitude. The page asked for the map and got a 500.

    The place is not looked up: whether the geocoder is reachable is
    not a thing a test about the map answering should depend on.
    """
    import app.api.routes.analytics as analytics_module

    monkeypatch.setattr(
        analytics_module, "resolve_place", lambda *a, **k: None
    )

    _add(session, "Kopi Jago", 10000.0)
    _add(session, None, 25000.0)

    response = client.get("/api/analytics/merchants/map")

    assert response.status_code == 200, (
        "the map answered with %r: %s"
        % (response.status_code, response.text[:400])
    )

    body = response.json()
    assert body["markers"], "the map has no pins at all"
    assert body["total_locations"] >= 1
    assert body["total_spent"] == 35000.0, (
        "the money did not add up: %r" % body["total_spent"]
    )

    # Every pin has a place on the map, and a name to call it by.
    for marker in body["markers"]:
        assert marker.get("latitude") is not None, "a pin has no place: %r" % marker
        assert marker.get("longitude") is not None, "a pin has no place: %r" % marker
        assert marker.get("name"), "a pin has no name: %r" % marker
        assert marker.get("total_spent") is not None


def test_a_pin_that_could_not_be_placed_exactly_says_so(
    client, session, monkeypatch
):
    """A pin that stands for an area is marked as an estimate."""
    import app.api.routes.analytics as analytics_module

    monkeypatch.setattr(
        analytics_module, "resolve_place", lambda *a, **k: None
    )

    _add(session, "Kopi Jago", 10000.0)

    response = client.get("/api/analytics/merchants/map")
    assert response.status_code == 200

    body = response.json()
    for marker in body["markers"]:
        if marker.get("source") == "estimated":
            assert marker.get("is_estimated") is True, (
                "an estimated pin does not say it is estimated: %r" % marker
            )
            assert marker.get("precision") == "district"


def test_one_broken_row_does_not_take_the_whole_map_down(client, session, monkeypatch):
    """A row that cannot be read is skipped, not fatal.

    The reader's records are not always tidy. A transaction whose
    merchant name is a number, or whose figure is not a figure, must
    not take every other pin down with it and answer the page with a
    500.
    """
    _add(session, "Kopi Jago", 10000.0)

    # A row whose place cannot be resolved at all.
    import app.api.routes.analytics as analytics_module

    def explode(*args, **kwargs):
        raise RuntimeError("the place could not be found")

    monkeypatch.setattr(analytics_module, "resolve_place", explode)

    response = client.get("/api/analytics/merchants/map")

    assert response.status_code == 200, (
        "one broken row broke the map: %r" % response.status_code
    )
    body = response.json()
    assert body["markers"], "the map has no pins at all"
    # The spending is still on the map, marked as an estimate.
    assert body["total_spent"] == 10000.0


def test_the_query_names_every_column_the_answer_names():
    """The grouping names every column the answer names.

    This is the check that would have caught the production 500. It
    reads the source, because the fault was in the shape of the
    query and not in what the query returned.
    """
    source = (BACKEND_DIR / "app" / "api" / "routes" / "analytics.py").read_text(
        encoding="utf-8"
    )

    # The part of the file that answers the map.
    start = source.index("def get_merchant_map_data")
    body = source[start:]

    # The grouping of the merchants query - the one that builds the
    # shop name out of the shop name, the description and the
    # address. It is the grouping that the answer named a column
    # without, and the one PostgreSQL refused.
    marker = body.index("merchant_q = merchant_q.group_by(")
    group = body[marker:body.index(")", marker)]

    # The columns the answer is built from.
    for column in (
        "Transaction.merchant_name",
        "Transaction.description",
        "Transaction.merchant_address",
    ):
        assert column in group, (
            "%s is named by the answer but not by the grouping" % column
        )


def test_the_route_is_mounted_under_the_path_the_page_asks_for(
    client, session, monkeypatch
):
    """The page asks for this exact path."""
    import app.api.routes.analytics as analytics_module

    monkeypatch.setattr(
        analytics_module, "resolve_place", lambda *a, **k: None
    )

    response = client.get("/api/analytics/merchants/map")
    assert response.status_code == 200
    assert "markers" in response.json()
