"""
The things the records already say.

Four detectors, worked out from the reader's own records:

- a bill that was paid twice,
- a subscription that was never set up,
- the balance on each day of the coming month,
- what was bought last month and not yet this month.

These use synthetic fixtures only. No real account, no real person,
no real money. The dates are fixed so the answers are fixed too.
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

import app.models  # noqa: F401, E402

from app.services.insight_service import (
    find_duplicate_charges,
    find_forgotten_subscriptions,
    project_balance_calendar,
    suggest_monthly_shopping,
)

# The day the fixtures are built around. Everything is relative to it.
TODAY = date(2026, 10, 15)

USER_ID = 1


@pytest.fixture()
def db():
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


def _account(db, balance=0, currency="IDR", name="Tabungan", is_active=True):
    acc = Account(
        user_id=USER_ID,
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


def _expense(db, day, amount, description="", account_id=1, currency="IDR",
             merchant_name=None):
    tx = Transaction(
        user_id=USER_ID,
        account_id=account_id,
        type="expense",
        amount=Decimal(str(amount)),
        currency=currency,
        description=description,
        merchant_name=merchant_name,
        date=day,
        category_id=None,
        is_deleted=False,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def _rule(db, day_of_month, amount, kind="expense", frequency="monthly",
          description="Tagihan", currency="IDR", next_occurrence=None):
    rule = RecurringRule(
        user_id=USER_ID,
        account_id=1,
        type=kind,
        amount=Decimal(str(amount)),
        currency=currency,
        description=description,
        frequency=frequency,
        interval_value=1,
        day_of_month=day_of_month,
        start_date=date(2026, 1, 1),
        next_occurrence=next_occurrence or date(2026, 10, day_of_month),
        is_active=True,
        auto_generate=False,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def _fake_rates(monkeypatch):
    """A fixed rate table, so the numbers are exact."""
    async def fake_rates(base):
        class Table:
            rates = {"IDR": 1.0, "JPY": 0.01}
            as_of = "2026-01-01"

        return Table()

    async def fake_rate(src, dst):
        src, dst = src.upper(), dst.upper()
        if src == dst:
            return 1.0
        table = {"IDR": 1.0, "JPY": 0.01}
        if src in table and dst in table:
            return table[dst] / table[src]
        return None

    import app.services.currency_totals as ct

    monkeypatch.setattr(ct.converter, "get_rates", fake_rates)
    monkeypatch.setattr(ct.converter, "rate", fake_rate)


# --- a bill paid twice -----------------------------------------------

def test_the_same_charge_twice_on_the_same_day_is_a_duplicate(db):
    """Two charges of the same amount, same account, same day."""
    _account(db, balance=1_000_000)
    _expense(db, date(2026, 10, 5), 150_000, "IndiHome tagihan")
    _expense(db, date(2026, 10, 5), 150_000, "IndiHome tagihan")

    found = find_duplicate_charges(db, USER_ID, today=TODAY)

    assert len(found) == 1
    assert found[0]["confidence"] == "high"
    assert found[0]["amount"] == pytest.approx(150_000)
    assert found[0]["days_apart"] == 0
    assert len(found[0]["transactions"]) == 2


def test_a_different_amount_on_the_same_day_is_not_a_duplicate(db):
    """Two different things bought on one day are two different things."""
    _account(db, balance=1_000_000)
    _expense(db, date(2026, 10, 5), 150_000, "IndiHome tagihan")
    _expense(db, date(2026, 10, 5), 45_000, "Kopi")

    found = find_duplicate_charges(db, USER_ID, today=TODAY)

    assert found == []


def test_the_same_amount_twice_in_a_month_is_not_a_duplicate(db):
    """
    Buying the same thing twice in a month is ordinary, not a mistake.

    The detector only looks a few days ahead, so a repeat a fortnight
    later is left alone.
    """
    _account(db, balance=1_000_000)
    _expense(db, date(2026, 10, 2), 50_000, "Beras 5kg")
    _expense(db, date(2026, 10, 16), 50_000, "Beras 5kg")

    found = find_duplicate_charges(db, USER_ID, today=TODAY)

    assert found == []


def test_a_charge_in_another_account_is_not_a_duplicate(db):
    """The same amount leaving two different accounts is not a mistake."""
    _account(db, balance=1_000_000, name="A")
    _account(db, balance=1_000_000, name="B")
    _expense(db, date(2026, 10, 5), 150_000, "IndiHome", account_id=1)
    _expense(db, date(2026, 10, 5), 150_000, "IndiHome", account_id=2)

    found = find_duplicate_charges(db, USER_ID, today=TODAY)

    assert found == []


def test_a_deleted_charge_is_not_a_duplicate(db):
    """A charge the reader deleted is one they already dealt with."""
    _account(db, balance=1_000_000)
    _expense(db, date(2026, 10, 5), 150_000, "IndiHome tagihan")
    second = _expense(db, date(2026, 10, 5), 150_000, "IndiHome tagihan")
    second.is_deleted = True
    db.commit()

    found = find_duplicate_charges(db, USER_ID, today=TODAY)

    assert found == []


# --- a subscription that was forgotten -------------------------------

def test_a_monthly_charge_with_no_rule_is_a_forgotten_subscription(db):
    """Netflix, three months running, and no rule set up for it."""
    _account(db, balance=1_000_000)
    for month in (8, 9, 10):
        _expense(
            db, date(2026, month, 12), 186_000, "NETFLIX.COM",
            merchant_name="Netflix",
        )

    found = find_forgotten_subscriptions(db, USER_ID, today=TODAY)

    assert len(found) == 1
    assert found[0]["merchant"] == "Netflix"
    assert found[0]["amount"] == pytest.approx(186_000)
    assert found[0]["months_found"] == 3
    assert found[0]["day_of_month"] == 12


def test_a_subscription_with_a_rule_is_not_forgotten(db):
    """The reader knows about it, so it is not a surprise."""
    _account(db, balance=1_000_000)
    for month in (8, 9, 10):
        _expense(
            db, date(2026, month, 12), 186_000, "NETFLIX.COM",
            merchant_name="Netflix",
        )
    _rule(db, day_of_month=12, amount=186_000, description="Netflix")

    found = find_forgotten_subscriptions(db, USER_ID, today=TODAY)

    assert found == []


def test_two_months_is_not_enough_to_call_it_a_subscription(db):
    """Two months may be a coincidence. Three is a habit."""
    _account(db, balance=1_000_000)
    for month in (9, 10):
        _expense(
            db, date(2026, month, 12), 186_000, "NETFLIX.COM",
            merchant_name="Netflix",
        )

    found = find_forgotten_subscriptions(db, USER_ID, today=TODAY)

    assert found == []


def test_an_amount_that_changes_every_month_is_not_a_subscription(db):
    """A bill that goes up is not a subscription."""
    _account(db, balance=1_000_000)
    for month, amount in ((8, 100_000), (9, 200_000), (10, 300_000)):
        _expense(
            db, date(2026, month, 12), amount, "Tagihan listrik",
            merchant_name="PLN",
        )

    found = find_forgotten_subscriptions(db, USER_ID, today=TODAY)

    assert found == []


def test_months_with_a_gap_are_not_a_subscription(db):
    """
    A subscription that was cancelled and started again is not a
    forgotten one, so a gap in the months stops it being reported.
    """
    _account(db, balance=1_000_000)
    for month in (7, 8, 10):
        _expense(
            db, date(2026, month, 12), 186_000, "NETFLIX.COM",
            merchant_name="Netflix",
        )

    found = find_forgotten_subscriptions(db, USER_ID, today=TODAY)

    assert found == []


def test_a_small_charge_is_not_a_subscription(db):
    """A few thousand rupiah a month is not worth the reader's time."""
    _account(db, balance=1_000_000)
    for month in (8, 9, 10):
        _expense(
            db, date(2026, month, 12), 500, "Kopi",
            merchant_name="Kopi Kenangan",
        )

    found = find_forgotten_subscriptions(db, USER_ID, today=TODAY)

    assert found == []


# --- the balance ahead ----------------------------------------------

def test_the_calendar_starts_from_the_balance_now(db, monkeypatch):
    _fake_rates(monkeypatch)
    _account(db, balance=5_000_000)

    calendar = asyncio.run(project_balance_calendar(db, USER_ID, today=TODAY, days=10))

    assert len(calendar) == 11
    assert calendar[0]["date"] == "2026-10-15"
    assert calendar[0]["balance"] == pytest.approx(5_000_000)


def test_a_bill_on_a_later_day_moves_the_balance(db, monkeypatch):
    """A bill on the 20th takes 300,000 out of the balance."""
    _fake_rates(monkeypatch)
    _account(db, balance=5_000_000)
    _rule(db, day_of_month=20, amount=300_000, description="Listrik",
          next_occurrence=date(2026, 10, 20))

    calendar = asyncio.run(project_balance_calendar(db, USER_ID, today=TODAY, days=10))

    before = next(c for c in calendar if c["date"] == "2026-10-19")
    on_the_day = next(c for c in calendar if c["date"] == "2026-10-20")
    assert before["balance"] == pytest.approx(5_000_000)
    assert on_the_day["balance"] == pytest.approx(4_700_000)
    assert len(on_the_day["events"]) == 1
    assert on_the_day["events"][0]["description"] == "Listrik"


def test_income_on_a_day_moves_the_balance_up(db, monkeypatch):
    _fake_rates(monkeypatch)
    _account(db, balance=1_000_000)
    _rule(db, day_of_month=25, amount=2_000_000, kind="income",
          description="Gaji", next_occurrence=date(2026, 10, 25))

    calendar = asyncio.run(project_balance_calendar(db, USER_ID, today=TODAY, days=20))

    on_the_day = next(c for c in calendar if c["date"] == "2026-10-25")
    assert on_the_day["balance"] == pytest.approx(3_000_000)


def test_a_day_with_nothing_on_it_carries_the_balance_forward(db, monkeypatch):
    _fake_rates(monkeypatch)
    _account(db, balance=2_000_000)

    calendar = asyncio.run(project_balance_calendar(db, USER_ID, today=TODAY, days=5))

    assert all(c["balance"] == pytest.approx(2_000_000) for c in calendar)
    assert all(c["events"] == [] for c in calendar)


def test_the_balance_is_converted_into_the_readers_currency(db, monkeypatch):
    """
    A reader with rupiah and yen sees one balance, not two added
    together by hand.
    """
    _fake_rates(monkeypatch)
    _account(db, balance=5_000_000, currency="IDR", name="IDR")
    _account(db, balance=10_000, currency="JPY", name="JPY")

    calendar = asyncio.run(project_balance_calendar(db, USER_ID, today=TODAY, days=5))

    # 5,000,000 + (10,000 yen at 100 rupiah) = 6,000,000
    assert calendar[0]["balance"] == pytest.approx(6_000_000)


# --- what to buy this month -----------------------------------------

def test_what_was_bought_last_month_and_not_this_month_is_suggested(db):
    """
    Something bought in each of the last two months, and not yet this
    month, is on the list.
    """
    _account(db, balance=1_000_000)
    _expense(db, date(2026, 8, 3), 75_000, "Beras", merchant_name="Indomaret")
    _expense(db, date(2026, 9, 4), 80_000, "Beras", merchant_name="Indomaret")
    _expense(db, date(2026, 10, 2), 90_000, "Sabun", merchant_name="Unilever")

    found = suggest_monthly_shopping(db, USER_ID, today=TODAY)

    assert len(found) == 1
    assert found[0]["merchant"] == "Indomaret"
    # The estimate is the most recent amount, not the average of all
    # of them: the last charge is the one that says what it costs now.
    assert found[0]["estimated_amount"] == pytest.approx(80_000)


def test_something_already_bought_this_month_is_not_suggested(db):
    _account(db, balance=1_000_000)
    _expense(db, date(2026, 8, 3), 75_000, "Beras", merchant_name="Indomaret")
    _expense(db, date(2026, 9, 4), 80_000, "Beras", merchant_name="Indomaret")
    _expense(db, date(2026, 10, 5), 80_000, "Beras", merchant_name="Indomaret")

    found = suggest_monthly_shopping(db, USER_ID, today=TODAY)

    assert found == []


def test_something_bought_only_last_month_is_not_suggested(db):
    """One month is not a pattern."""
    _account(db, balance=1_000_000)
    _expense(db, date(2026, 9, 4), 80_000, "Beras", merchant_name="Indomaret")

    found = suggest_monthly_shopping(db, USER_ID, today=TODAY)

    assert found == []
