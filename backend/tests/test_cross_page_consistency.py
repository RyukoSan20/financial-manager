"""
The same reader, the same accounts, the same number.

This is the acceptance test for "one source of truth". Five different
pages show a balance: the Dashboard, the Analytics page, the profile,
the accounts list, and the AI Advisor. They used to work it out five
different ways, and a reader with more than one currency saw a
different number on each.

These tests use synthetic fixtures only. No real account, no real
person, no real money.
"""

import asyncio
import os
import sys
from datetime import date, timedelta
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB, TSVECTOR, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
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

# Every model is imported, so that every table is registered before
# the schema is built. A table that is missing shows up as "no such
# table" halfway through a test, which says nothing about the thing
# being tested.
import app.models  # noqa: F401, E402


@pytest.fixture()
def db():
    """A fresh in-memory database with the tables the balances read."""
    # The models are written for PostgreSQL, and some of them use
    # column types SQLite does not know. Those types are taught to
    # SQLite as plain text, which is enough for the balances and the
    # counts that these tests read.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
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
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


class FakeUser:
    """The reader. Only the fields the routes look at."""

    id = 1
    default_currency = "IDR"
    email = "reader@example.invalid"
    full_name = None
    username = None
    is_active = True
    created_at = None
    last_login = None
    preferences = {}


def _account(db, balance, currency, name, is_active=True):
    acc = Account(
        user_id=1,
        name=name,
        balance=Decimal(str(balance)),
        currency=currency,
        account_type="bank",
        is_active=is_active,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


def _read_balance(db, monkeypatch, rate=0.01):
    """
    What every page should report, read through the shared service.

    The rate is fixed so the numbers are exact and do not depend on a
    live price feed. One unit of the foreign currency is worth this
    many rupiah, which is what a rate table in the shape this code
    uses expresses.
    """
    from app.services import metrics

    async def fake_rates(base):
        class Table:
            rates = {"JPY": rate, "IDR": 1.0}
            as_of = "2026-01-01"

        return Table()

    async def fake_rate(src, dst):
        src, dst = src.upper(), dst.upper()
        if src == dst:
            return 1.0
        table = {"JPY": rate, "IDR": 1.0}
        if src in table and dst in table:
            return table[dst] / table[src]
        return None

    import app.services.currency_totals as ct

    monkeypatch.setattr(ct.converter, "get_rates", fake_rates)
    monkeypatch.setattr(ct.converter, "rate", fake_rate)
    return asyncio.run(metrics.total_balance(db, 1, "IDR"))


def test_every_page_reports_the_same_balance(db, monkeypatch):
    """
    One reader, two currencies, one number.

    5,950,000 rupiah and 98,000 yen, with a yen worth 100 rupiah, is
    5,950,000 + 9,800,000 = 15,750,000 rupiah. Not 6,048,000, which
    is what adding the two numbers face to face gives.
    """
    _account(db, 5_950_000, "IDR", "Tabungan")
    _account(db, 98_000, "JPY", "Yen")

    result = _read_balance(db, monkeypatch)

    assert result["total"] == pytest.approx(15_750_000, rel=1e-6)
    assert result["by_currency"]["IDR"] == pytest.approx(5_950_000, rel=1e-6)
    assert result["by_currency"]["JPY"] == pytest.approx(98_000, rel=1e-6)


def test_a_closed_account_is_the_same_everywhere(db, monkeypatch):
    """
    A closed account is not part of the balance.

    The profile used to add closed accounts while the Dashboard left
    them out, so the header and the page underneath it disagreed.
    """
    _account(db, 5_950_000, "IDR", "Tabungan")
    _account(db, 500_000, "IDR", "Tutup", is_active=False)

    result = _read_balance(db, monkeypatch)

    assert result["total"] == pytest.approx(5_950_000, rel=1e-6)


def test_the_analytics_balance_equals_the_service_balance(db, monkeypatch):
    """
    The Analytics page reads the same number as everything else.
    """
    from app.api.routes.analytics import get_financial_health

    _account(db, 5_950_000, "IDR", "Tabungan")
    _account(db, 98_000, "JPY", "Yen")

    service = _read_balance(db, monkeypatch)

    today = date.today()
    start, end = today.replace(day=1), today

    reported = asyncio.run(
        get_financial_health(FakeUser(), db)
    )["metrics"]["total_balance"]

    assert float(reported) == pytest.approx(service["total"], rel=1e-6)


def test_the_profile_balance_equals_the_service_balance(db, monkeypatch):
    """
    The profile header reads the same number as everything else.

    A closed account is left out, the same as on the Dashboard. The
    profile used to add closed accounts while the Dashboard left them
    out, so the header and the page underneath it disagreed.
    """
    from app.api.routes.profile import get_profile_summary

    _account(db, 5_950_000, "IDR", "Tabungan")
    _account(db, 98_000, "JPY", "Yen")
    _account(db, 500_000, "IDR", "Tutup", is_active=False)

    service = _read_balance(db, monkeypatch)

    result = asyncio.run(get_profile_summary(FakeUser(), db))
    reported = result["stats"]["account_balance"]

    assert float(reported) == pytest.approx(service["total"], rel=1e-6)


def test_the_ai_advisor_balance_equals_the_service_balance(db, monkeypatch):
    """
    The AI Advisor reads the same number as everything else.

    The advisor puts this number into a sentence the reader reads, so
    a wrong one is spoken out loud as if it were true.
    """
    from app.modules.ai_advisor.router import _build_user_context

    _account(db, 5_950_000, "IDR", "Tabungan")
    _account(db, 98_000, "JPY", "Yen")

    service = _read_balance(db, monkeypatch)

    context = asyncio.run(_build_user_context(db, 1))

    assert f"{service['total']:,.0f}" in context
    # And the wrong number must not be in there.
    assert f"{5_950_000 + 98_000:,.0f}" not in context


def test_the_transaction_count_is_the_same_everywhere(db):
    """
    The profile said one transaction and the history said two.

    Both read the same rows now, and a deleted row is not a row.
    """
    from app.services.metrics import transaction_count

    today = date.today()
    db.add(Transaction(
        user_id=1, account_id=1, amount=Decimal("25000"),
        type="expense", date=today, description="a",
        status="approved", is_deleted=False,
    ))
    db.add(Transaction(
        user_id=1, account_id=1, amount=Decimal("30000"),
        type="expense", date=today, description="b",
        status="approved", is_deleted=False,
    ))
    db.commit()

    assert transaction_count(db, 1) == 2

    db.query(Transaction).filter(Transaction.user_id == 1).update(
        {"is_deleted": True}
    )
    db.commit()

    assert transaction_count(db, 1) == 0
