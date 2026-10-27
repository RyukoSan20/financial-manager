"""
The insights, over HTTP.

The four endpoints, called the way the browser calls them. Synthetic
fixtures only: no real account, no real person, no real money.

The dates are worked out from today, so the fixtures never drift into
the past and the tests keep meaning what they meant when they were
written.
"""

import os
import sys
from datetime import date
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB, TSVECTOR, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.insights import router
from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.models.account import Account
from app.models.budget import Budget  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.debt import Debt  # noqa: F401
from app.models.goal import Goal  # noqa: F401
from app.models.net_worth import NetWorthSnapshot  # noqa: F401
from app.models.receipt import ReceiptScan  # noqa: F401
from app.models.recurring import RecurringRule  # noqa: F401
from app.models.transaction import Transaction
from app.models.user import User  # noqa: F401
from app.models.user_settings import UserSettings  # noqa: F401

import app.models  # noqa: F401, E402

USER_ID = 1


class FakeUser:
    """The reader. Only the fields the routes look at."""
    id = USER_ID
    default_currency = "IDR"
    email = "reader@example.invalid"
    full_name = None
    username = None
    is_active = True
    created_at = None
    last_login = None
    preferences = {}


def _months_ago(day: date, months: int) -> date:
    """The same day of the month, that many months back."""
    year = day.year
    month = day.month - months
    year += (month - 1) // 12
    month = (month - 1) % 12 + 1
    last_day = (date(year + (month == 12), (month % 12) + 1, 1) - date.resolution).day
    return date(year, month, min(day.day, last_day))


@pytest.fixture()
def client():
    """
    A client over a database of the reader's own.

    The in-memory database is held in one connection, so the tables
    the test creates are the tables the request reads. Without that,
    the request gets a fresh empty database and the answer is "no such
    table".
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @compiles(JSONB, "sqlite")
    def _jsonb_as_text(element, compiler, **kw):
        return "TEXT"

    @compiles(ARRAY, "sqlite")
    def _array_as_text(element, compiler, **kw):
        return "TEXT"

    @compiles(INET, "sqlite")
    def _inet_as_text(element, compiler, **kw):
        return "TEXT"

    @compiles(UUID, "sqlite")
    def _uuid_as_text(element, compiler, **kw):
        return "TEXT"

    @compiles(TSVECTOR, "sqlite")
    def _tsvector_as_text(element, compiler, **kw):
        return "TEXT"

    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    app = FastAPI()
    app.include_router(router, prefix="/api/insights")

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: FakeUser()

    try:
        with TestClient(app) as test_client:
            yield test_client, session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def no_rates(monkeypatch):
    """
    A rate table that does not change.

    The converter reaches out to a live feed, which a test must not
    depend on. Every amount in these tests is in rupiah, so no
    conversion is needed and the table only has to be there.
    """
    async def fake_rates(base):
        class Table:
            rates = {"IDR": 1.0}
            as_of = "2026-01-01"

        return Table()

    async def fake_rate(src, dst):
        src, dst = src.upper(), dst.upper()
        if src == dst:
            return 1.0
        return None

    import app.services.currency_totals as ct

    monkeypatch.setattr(ct.converter, "get_rates", fake_rates)
    monkeypatch.setattr(ct.converter, "rate", fake_rate)


def _seed_account(session, balance="5000000"):
    account = Account(
        user_id=USER_ID,
        name="Tabungan",
        balance=Decimal(balance),
        currency="IDR",
        account_type="bank",
        is_active=True,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def _seed_expense(session, account_id, day, amount, description="", merchant=None):
    session.add(Transaction(
        user_id=USER_ID,
        account_id=account_id,
        type="expense",
        amount=Decimal(str(amount)),
        currency="IDR",
        description=description,
        merchant_name=merchant,
        date=day,
        is_deleted=False,
    ))
    session.commit()


def test_the_duplicates_endpoint_finds_the_double_charge(client):
    """Two charges of the same amount on the same day, over HTTP."""
    test_client, session = client
    account = _seed_account(session)
    today = date.today()
    _seed_expense(session, account.id, today, 150000, "IndiHome tagihan", "IndiHome")
    _seed_expense(session, account.id, today, 150000, "IndiHome tagihan", "IndiHome")

    response = test_client.get("/api/insights/duplicates")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["duplicates"][0]["confidence"] == "high"
    assert body["duplicates"][0]["amount"] == pytest.approx(150000)
    assert len(body["duplicates"][0]["transactions"]) == 2


def test_the_subscriptions_endpoint_finds_the_forgotten_one(client):
    """Three months of Netflix and no rule set up for it."""
    test_client, session = client
    account = _seed_account(session)
    today = date.today()
    for months in (0, 1, 2):
        _seed_expense(
            session, account.id, _months_ago(today, months), 186000,
            "NETFLIX.COM", "Netflix",
        )

    response = test_client.get("/api/insights/subscriptions")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["subscriptions"][0]["merchant"] == "Netflix"
    assert body["subscriptions"][0]["months_found"] == 3
    assert body["subscriptions"][0]["amount"] == pytest.approx(186000)


def test_the_calendar_endpoint_gives_one_line_for_each_day(client, no_rates):
    """One line for every day of the window asked for."""
    test_client, session = client
    _seed_account(session)

    response = test_client.get("/api/insights/balance-calendar?days=10")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 11
    assert body["calendar"][0]["date"] == date.today().isoformat()
    assert body["calendar"][0]["balance"] == pytest.approx(5000000)


def test_the_shopping_suggestion_endpoint(client):
    """Something bought in each of the last two months, not yet this month."""
    test_client, session = client
    account = _seed_account(session)
    today = date.today()
    for months in (1, 2):
        _seed_expense(
            session, account.id, _months_ago(today, months), 80000,
            "Beras", "Indomaret",
        )

    response = test_client.get("/api/insights/shopping-suggestion")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["suggestions"][0]["merchant"] == "Indomaret"
    assert body["suggestions"][0]["estimated_amount"] == pytest.approx(80000)


def test_the_endpoints_answer_with_an_empty_set_when_there_is_nothing(client, no_rates):
    """
    No records means no suggestions, not an error.

    The three that look for something to point out answer with an
    empty list. The calendar still has a line for every day, because
    the days are the answer, not the findings.
    """
    test_client, session = client

    for path in (
        "/api/insights/duplicates",
        "/api/insights/subscriptions",
        "/api/insights/shopping-suggestion",
    ):
        response = test_client.get(path)
        assert response.status_code == 200
        assert response.json()["count"] == 0

    response = test_client.get("/api/insights/balance-calendar?days=7")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 8
    assert all(day["events"] == [] for day in body["calendar"])
