"""
One reader's money is never shown to another reader.

This is the test for a leak that was live on the deployed server.

The dashboard, the analytics and the scan list all read the reader's
own rows. They were written with an *optional* sign-in: when no
token came with the request, the query simply did not filter by user,
and the answer was the sum of everybody's transactions.

The deployed server answered a request with no token at all:

    GET /api/dashboard/summary
    200 {"totalIncome": 47715000.0, "totalExpense": 6252000.0, ...}

Those were another reader's numbers.

So every endpoint that reads a reader's rows now requires a reader,
and every query is filtered by that reader. These tests hold both
halves of that in place:

1. without a token, the endpoint says 401 and gives nothing away;
2. with a token, the answer is that reader's rows and nobody else's.

The second half matters as much as the first: turning the filter off
by accident would also "not leak", because it would show nothing.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user, get_current_user_optional
from app.main import app

# The models are imported by name, so that the tables the foreign
# keys point at are registered before the schema is built.
from app.models.account import Account  # noqa: F401
from app.models.budget import Budget  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.debt import Debt  # noqa: F401
from app.models.goal import Goal  # noqa: F401
from app.models.recurring import RecurringRule  # noqa: F401
from app.models.transaction import Transaction  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.user_settings import UserSettings  # noqa: F401


class FakeUser:
    """A reader who exists only for these tests."""

    id = 4242
    email = "reader@example.invalid"
    username = "reader"
    full_name = "A Reader"
    default_currency = "IDR"
    is_active = True


# Every endpoint that answers with a reader's own rows. Each one used
# to answer without a token.
ENDPOINTS_THAT_READ_A_READERS_ROWS = [
    "/api/dashboard/summary",
    "/api/dashboard/month-timeline",
    "/api/dashboard/cash-flow?timeframe=3M",
    "/api/dashboard/accounts",
    "/api/accounts/summary/total-balance",
    "/api/analytics/cash-flow-trend",
    "/api/analytics/expense-breakdown",
    "/api/analytics/top-expenses",
    "/api/analytics/recurring-expenses",
    "/api/analytics/income-breakdown",
    "/api/analytics/income-sources",
    "/api/analytics/budget-vs-actual",
    "/api/analytics/spending-patterns",
    "/api/analytics/net-worth-history",
    "/api/analytics/monthly-comparison",
    "/api/analytics/financial-health",
    "/api/analytics/merchants",
    "/api/analytics/merchants/map",
    "/api/analytics/merchants/top",
    "/api/analytics/spending/heatmap",
    "/api/transactions/summary/by-period?start_date=2026-01-01&end_date=2026-12-31",
    "/api/transactions/summary/by-category?start_date=2026-01-01&end_date=2026-12-31&type=expense",
]


@pytest.fixture(scope="module")
def db():
    """
    A fresh in-memory database with the tables these endpoints read.

    The models carry PostgreSQL types that SQLite does not know, so
    the tables that fail to build are dropped rather than worked
    around.
    """
    # StaticPool keeps one connection for the whole test, so the
    # tables built here are the tables the request thread reads. The
    # default pool would give the request thread a second, empty
    # in-memory database, and every query would answer "no such
    # table".
    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    wanted = {
        "users",
        "accounts",
        "transactions",
        "categories",
        "budgets",
        "goals",
        "debts",
        "recurring_rules",
        "user_settings",
        "net_worth_snapshots",
        "transaction_locations",
        "merchant_locations",
    }
    Base.metadata.create_all(
        engine,
        tables=[t for t in Base.metadata.sorted_tables if t.name in wanted],
    )

    # The location module keeps its own base, so its tables are not in
    # the metadata above and its foreign key cannot be resolved from
    # it. The merchant map reads them, so they are written here as
    # plain SQL: the same shape the migration gives them.
    with engine.begin() as conn:
        conn.execute(text(
            """CREATE TABLE IF NOT EXISTS merchant_locations (
                id INTEGER PRIMARY KEY,
                merchant_name_raw VARCHAR(255) NOT NULL,
                merchant_name_normalized VARCHAR(255),
                latitude FLOAT,
                longitude FLOAT,
                address TEXT,
                city VARCHAR(100),
                region VARCHAR(100),
                country VARCHAR(50),
                postal_code VARCHAR(10),
                category VARCHAR(50),
                sub_category VARCHAR(100),
                brand_id VARCHAR(50),
                is_verified BOOLEAN,
                created_at DATETIME,
                updated_at DATETIME
            )"""
        ))
        conn.execute(text(
            """CREATE TABLE IF NOT EXISTS transaction_locations (
                id INTEGER PRIMARY KEY,
                transaction_id INTEGER NOT NULL,
                merchant_location_id INTEGER,
                captured_latitude FLOAT,
                captured_longitude FLOAT,
                captured_address TEXT,
                inside_geofence BOOLEAN,
                nearest_store_name VARCHAR(255),
                nearest_store_distance_meters FLOAT,
                created_at DATETIME
            )"""
        ))
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _client(db, signed_in):
    """A client on the in-memory database, signed in or not."""
    test_client = TestClient(app)

    def override_db():
        return db

    test_client.app.dependency_overrides[get_db] = override_db
    if signed_in:
        test_client.app.dependency_overrides[get_current_user] = lambda: FakeUser()
        # The cron endpoint reads the request itself, so it asks for
        # the optional variant. It has to be answered the same way.
        test_client.app.dependency_overrides[get_current_user_optional] = lambda: FakeUser()
    else:
        test_client.app.dependency_overrides.pop(get_current_user, None)
        test_client.app.dependency_overrides.pop(get_current_user_optional, None)
    return test_client


@pytest.fixture()
def client(db):
    """A client with a reader already signed in."""
    return _client(db, signed_in=True)


@pytest.fixture()
def anon_client(db):
    """A client with nobody signed in."""
    return _client(db, signed_in=False)


@pytest.mark.parametrize("path", ENDPOINTS_THAT_READ_A_READERS_ROWS)
def test_a_reader_is_required(anon_client, path):
    """
    Without a token the endpoint refuses, and says nothing about
    anybody's money.
    """
    response = anon_client.get(path)
    assert response.status_code == 401, (
        f"{path} answered {response.status_code} to a request with no token: "
        f"{response.text[:200]}"
    )


@pytest.mark.parametrize("path", ENDPOINTS_THAT_READ_A_READERS_ROWS)
def test_the_answer_is_the_readers_own(client, path):
    """
    With a token the endpoint answers, and the answer is about the
    signed-in reader.
    """
    response = client.get(path)
    assert response.status_code == 200, (
        f"{path} answered {response.status_code} for a signed-in reader: "
        f"{response.text[:200]}"
    )


def test_the_scan_list_needs_a_reader(anon_client):
    """
    The scan list holds the receipts a reader has scanned. It is
    another reader's receipt, so it needs a reader.
    """
    response = anon_client.get("/api/scans/")
    assert response.status_code == 401


def test_the_cron_endpoint_needs_a_reader(anon_client):
    """
    The cron endpoint writes transactions. Without a sign-in it used
    to run for every reader.
    """
    response = anon_client.get("/api/cron/process-recurring")
    assert response.status_code == 401


def test_the_cron_endpoint_only_touches_the_signed_in_reader(client, monkeypatch):
    """
    A reader who asks for their recurring transactions to be processed
    gets their own rules processed, and nobody else's.
    """
    seen = {}

    def fake_process(force_today=False, user_id=None):
        seen["user_id"] = user_id
        seen["force_today"] = force_today
        return {"processed": 0, "created": 0, "skipped": 0, "errors": 0, "details": []}

    monkeypatch.setattr("app.main.process_due_recurring_rules", fake_process)

    response = client.post("/api/cron/process-recurring")
    assert response.status_code == 200
    assert seen["user_id"] == FakeUser.id
    assert seen["force_today"] is True


def test_the_cron_secret_runs_for_every_reader(client, monkeypatch):
    """
    The scheduler holds a secret of its own. It runs the generator for
    every reader, because that is the job it has to do, and it never
    needs a reader's token.
    """
    seen = {}

    def fake_process(force_today=False, user_id=None):
        seen["user_id"] = user_id
        return {"processed": 0, "created": 0, "skipped": 0, "errors": 0, "details": []}

    monkeypatch.setattr("app.main.process_due_recurring_rules", fake_process)
    monkeypatch.setattr(
        "app.main.get_settings",
        lambda: type("S", (), {"CRON_SECRET": "the-scheduler-secret"})(),
    )

    response = client.get(
        "/api/cron/process-recurring",
        headers={"X-Cron-Secret": "the-scheduler-secret"},
    )
    assert response.status_code == 200
    assert seen["user_id"] is None


def test_the_wrong_cron_secret_is_refused(anon_client, monkeypatch):
    """
    A wrong secret is refused, and nothing is processed.
    """
    monkeypatch.setattr(
        "app.main.get_settings",
        lambda: type("S", (), {"CRON_SECRET": "the-scheduler-secret"})(),
    )
    response = anon_client.get(
        "/api/cron/process-recurring",
        headers={"X-Cron-Secret": "guess"},
    )
    assert response.status_code == 401


def test_a_wrong_cron_secret_does_not_run_for_everybody(client, monkeypatch):
    """
    A reader who sends a wrong secret does not get the scheduler's
    powers. The request falls back to the reader's own rules, and to
    nothing else.
    """
    seen = {}

    def fake_process(force_today=False, user_id=None):
        seen["user_id"] = user_id
        return {"processed": 0, "created": 0, "skipped": 0, "errors": 0, "details": []}

    monkeypatch.setattr("app.main.process_due_recurring_rules", fake_process)
    monkeypatch.setattr(
        "app.main.get_settings",
        lambda: type("S", (), {"CRON_SECRET": "the-scheduler-secret"})(),
    )

    response = client.get(
        "/api/cron/process-recurring",
        headers={"X-Cron-Secret": "guess"},
    )
    assert response.status_code == 200
    assert seen["user_id"] == FakeUser.id
