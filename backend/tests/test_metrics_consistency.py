"""
The same accounts, the same answer, everywhere.

Before this file existed, the total balance was worked out in five
different places. Three of them added rupiah to yen without
converting, so a reader with a rupiah account and a yen account saw
different totals on the Dashboard, in Analytics, in Health Coach and
in their profile.

These tests use synthetic fixtures only. No real account, no real
person, no real money.
"""

import os
import sys
from datetime import date, timedelta
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base

# The models are imported by name, not with a wildcard, so that the
# tables the foreign keys point at are registered before the schema is
# built.
from app.models.account import Account
from app.models.category import Category
from app.models.debt import Debt
from app.models.goal import Goal
from app.models.transaction import Transaction
from app.models.user import User  # noqa: F401  (registers the users table)
from app.services import metrics


@pytest.fixture()
def db():
    """A fresh in-memory database with the tables the metrics read."""
    engine = create_engine("sqlite:///:memory:")
    # The models carry PostgreSQL types that SQLite does not know.
    # The columns the metrics touch are plain enough, so the ones that
    # fail to build are dropped rather than worked around.
    Base.metadata.create_all(
        engine,
        tables=[
            t
            for t in Base.metadata.sorted_tables
            if t.name
            in {
                "users",
                "accounts",
                "transactions",
                "debts",
                "goals",
                "categories",
            }
        ],
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _account(db, user_id, balance, currency, name):
    acc = Account(
        user_id=user_id,
        name=name,
        balance=Decimal(str(balance)),
        currency=currency,
        account_type="bank",
        is_active=True,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


def _transaction(db, user_id, amount, kind, when, status="approved"):
    tx = Transaction(
        user_id=user_id,
        account_id=1,
        amount=Decimal(str(amount)),
        type=kind,
        date=when,
        description="test",
        status=status,
        is_deleted=False,
    )
    db.add(tx)
    db.commit()


# ---------------------------------------------------------------------------
# Total balance
# ---------------------------------------------------------------------------

def test_total_balance_does_not_add_currencies_raw(db):
    """
    Two accounts in different currencies must not be added at face value.

    Before the fix this produced 5,950,000 + 98,000 = 6,048,000, which
    is a number in no currency at all.
    """
    import asyncio

    user_id = 1
    _account(db, user_id, 5_950_000, "IDR", "Tabungan")
    _account(db, user_id, 98_000, "JPY", "Yen")

    result = asyncio.run(metrics.total_balance(db, user_id, "IDR"))

    # The two currencies are kept apart in the breakdown.
    assert result["by_currency"]["IDR"] == pytest.approx(5_950_000, rel=1e-6)
    assert result["by_currency"]["JPY"] == pytest.approx(98_000, rel=1e-6)

    # And the total is not their sum. It is the rupiah, plus the yen
    # converted at whatever rate is live.
    assert result["total"] != pytest.approx(5_950_000 + 98_000, rel=1e-9)


def test_total_balance_of_one_currency_is_exact(db):
    """One currency, one account: the total is the balance."""
    import asyncio

    _account(db, 1, 5_975_000, "IDR", "BCA")
    result = asyncio.run(metrics.total_balance(db, 1, "IDR"))
    assert result["total"] == pytest.approx(5_975_000, rel=1e-6)
    assert result["unconverted"] == []


def test_total_balance_ignores_inactive_accounts(db):
    """A closed account is not part of the balance."""
    import asyncio

    _account(db, 1, 1_000_000, "IDR", "Aktif")
    closed = _account(db, 1, 500_000, "IDR", "Tutup")
    closed.is_active = False
    db.commit()

    result = asyncio.run(metrics.total_balance(db, 1, "IDR"))
    assert result["total"] == pytest.approx(1_000_000, rel=1e-6)


# ---------------------------------------------------------------------------
# Savings rate
# ---------------------------------------------------------------------------

def test_savings_rate_needs_income_to_be_measurable(db):
    """
    No income in the month means no rate, not a rate of zero.

    Zero percent is a statement about money. "Nothing was recorded" is
    a different statement, and the two must not look the same.
    """
    today = date.today()
    start, end = metrics.month_range(today)
    _transaction(db, 1, 25_000, "expense", start + timedelta(days=1))

    result = metrics.savings_rate(db, 1, start, end)
    assert result.measurable is False
    assert result.rate == 0.0


def test_savings_rate_with_income(db):
    today = date.today()
    start, end = metrics.month_range(today)
    _transaction(db, 1, 5_000_000, "income", start + timedelta(days=1))
    _transaction(db, 1, 2_000_000, "expense", start + timedelta(days=2))

    result = metrics.savings_rate(db, 1, start, end)
    assert result.measurable is True
    assert result.rate == pytest.approx(0.6, rel=1e-6)


def test_pending_transactions_do_not_move_the_savings_rate(db):
    """A pending transaction is not money that has moved."""
    today = date.today()
    start, end = metrics.month_range(today)
    _transaction(db, 1, 5_000_000, "income", start + timedelta(days=1))
    _transaction(db, 1, 999_999, "expense", start + timedelta(days=2), status="pending")

    result = metrics.savings_rate(db, 1, start, end)
    assert result.rate == pytest.approx(1.0, rel=1e-6)


def test_rejected_transactions_do_not_move_the_savings_rate(db):
    today = date.today()
    start, end = metrics.month_range(today)
    _transaction(db, 1, 5_000_000, "income", start + timedelta(days=1))
    _transaction(db, 1, 999_999, "expense", start + timedelta(days=2), status="rejected")

    result = metrics.savings_rate(db, 1, start, end)
    assert result.rate == pytest.approx(1.0, rel=1e-6)


# ---------------------------------------------------------------------------
# Emergency months
# ---------------------------------------------------------------------------

def test_emergency_months_needs_a_burn_rate():
    """With no spending there is no burn rate, so there are no months."""
    assert metrics.emergency_months(5_975_000, 0) is None


def test_emergency_months_with_spending():
    """
    Cash divided by the daily burn rate, expressed in months.

    100,000 a month is about 3,333.33 a day. 600,000 of cash is 180
    days, which is six months of cover.
    """
    result = metrics.emergency_months(600_000, 100_000)
    assert result == pytest.approx(6.0, rel=1e-3)


# ---------------------------------------------------------------------------
# Health score
# ---------------------------------------------------------------------------

def test_health_score_has_no_parts_without_data(db):
    """
    An empty month produces no score, not a perfect one and not a zero.

    This is the bug that showed "25/25" for the emergency fund and
    the goals when there was nothing to measure.
    """
    today = date.today()
    start, end = metrics.month_range(today)

    score = metrics.health_score(db, 1, start, end, balance=0, goals=[])

    assert score.measured_parts == []
    assert score.measured_max == 0
    assert score.overall_score == 0
    assert score.has_enough_data is False
    assert score.measurable["emergency_fund"] is False
    assert score.measurable["goals_progress"] is False


def test_health_score_leaves_unmeasured_parts_out_of_the_total(db):
    """
    A part with no data is out of both the sum and the maximum.

    With income and spending but no goals, the goals part must not
    hold the score down, and must not add to it either. Four parts are
    possible; only the three that could be measured count.
    """
    today = date.today()
    start, end = metrics.month_range(today)
    _transaction(db, 1, 5_000_000, "income", start + timedelta(days=1))
    _transaction(db, 1, 1_000_000, "expense", start + timedelta(days=2))

    score = metrics.health_score(db, 1, start, end, balance=10_000_000, goals=[])

    assert "goals_progress" not in score.measured_parts
    assert "savings_rate" in score.measured_parts
    assert "emergency_fund" in score.measured_parts
    assert "debt_level" in score.measured_parts
    # Three parts measured, 25 points each.
    assert score.measured_max == 75
    # The maximum is the measured parts only, so the goals part does
    # not drag the score to 75%.
    assert score.overall_score == 100


def test_health_score_needs_two_parts_to_be_a_verdict(db):
    """
    One measured part is a guess, and it says so.

    Income alone makes the savings rate and the debt level measurable.
    The emergency fund needs spending, and the goals need a goal, so
    with neither of those only two parts can be read.
    """
    today = date.today()
    start, end = metrics.month_range(today)
    _transaction(db, 1, 5_000_000, "income", start + timedelta(days=1))

    score = metrics.health_score(db, 1, start, end, balance=0, goals=[])
    assert len(score.measured_parts) == 2
    assert score.measured_max == 50
    assert score.has_enough_data is True


# ---------------------------------------------------------------------------
# Transaction count
# ---------------------------------------------------------------------------

def test_transaction_count_ignores_deleted(db):
    today = date.today()
    start, _ = metrics.month_range(today)
    _transaction(db, 1, 25_000, "expense", start + timedelta(days=1))
    _transaction(db, 1, 30_000, "expense", start + timedelta(days=2))
    db.query(Transaction).filter(Transaction.user_id == 1).update({"is_deleted": True})
    db.commit()

    assert metrics.transaction_count(db, 1) == 0
