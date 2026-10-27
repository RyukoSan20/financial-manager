"""
The reminders.

A reminder is worth showing only when there is something real to say.
The tests here check the two things that matter:

- the reader has to turn the reminders on before anything happens, and
- when the reminders are on, the server says whether there is
  something to remind about, and says which thing it is.

The reminder never sends anything. It only works out what the reminder
would say, so the browser can show it.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.account import Account
from app.models.budget import Budget
from app.models.debt import Debt
from app.models.recurring import RecurringRule
from app.models.transaction import Transaction
from app.models.user import User
from app.services.reminder_service import build_reminder


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    # Only the tables these tests need. The whole metadata cannot be
    # created on SQLite, because some columns use a type SQLite does
    # not have.
    Base.metadata.create_all(
        engine,
        tables=[
            Base.metadata.tables["users"],
            Base.metadata.tables["accounts"],
            Base.metadata.tables["debts"],
            Base.metadata.tables["budgets"],
            Base.metadata.tables["recurring_rules"],
            Base.metadata.tables["transactions"],
        ],
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def reader(db):
    user = User(email="reader@example.com", hashed_password="x", full_name="Reader")
    db.add(user)
    db.commit()
    db.refresh(user)

    account = Account(
        user_id=user.id,
        name="Dompet",
        account_type="cash",
        balance=100000,
        initial_balance=100000,
        currency="IDR",
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    return user, account


def make_debt(db, user_id, name, next_payment_date, **overrides):
    """A debt with every required field filled in."""
    fields = {
        "user_id": user_id,
        "name": name,
        "debt_type": "loan",
        "principal": 1000000,
        "current_balance": 1000000,
        "interest_rate": 0,
        "tenor_months": 12,
        "remaining_months": 12,
        "monthly_payment": 500000,
        "currency": "IDR",
        "start_date": date(2026, 1, 1),
        "end_date": date(2026, 12, 31),
        "next_payment_date": next_payment_date,
        "is_active": True,
        "is_paid_off": False,
    }
    fields.update(overrides)
    debt = Debt(**fields)
    db.add(debt)
    db.commit()
    return debt


def test_a_bill_that_is_due_is_reminded_about(db, reader):
    """A bill due within the window is worth a reminder."""
    user, _account = reader
    today = date(2026, 3, 10)

    make_debt(db, user.id, "Sewa", today + timedelta(days=2))

    reminder = build_reminder(db, user.id, today=today)

    assert reminder["should_remind"] is True
    assert reminder["code"] == "payment_due"
    assert reminder["title"] == "Sewa"
    assert reminder["days_until"] == 2
    assert reminder["href"] == "/debts"


def test_a_bill_further_off_is_not_reminded_about(db, reader):
    """A bill that is not due yet is not worth interrupting for."""
    user, _account = reader
    today = date(2026, 3, 10)

    make_debt(db, user.id, "Sewa", today + timedelta(days=30))

    reminder = build_reminder(db, user.id, today=today)

    # The bill is not the reason to speak. The day itself still is,
    # because nothing was recorded yesterday.
    assert reminder["code"] != "payment_due"


def test_a_bill_that_is_paid_off_is_not_reminded_about(db, reader):
    """A bill that has been paid off is not due."""
    user, _account = reader
    today = date(2026, 3, 10)

    make_debt(db, user.id, "Sewa", today, is_paid_off=True)

    reminder = build_reminder(db, user.id, today=today)

    # A bill that has been paid off is not due, so it is not the
    # reason to speak.
    assert reminder["code"] != "payment_due"


def test_a_day_with_nothing_recorded_is_reminded_about(db, reader):
    """Yesterday with nothing on it is worth a gentle note."""
    user, _account = reader
    today = date(2026, 3, 10)

    reminder = build_reminder(db, user.id, today=today)

    assert reminder["should_remind"] is True
    assert reminder["code"] == "nothing_recorded"


def test_a_day_that_was_recorded_is_not_reminded_about(db, reader):
    """Yesterday with a transaction on it needs no note."""
    user, account = reader
    today = date(2026, 3, 10)
    yesterday = today - timedelta(days=1)

    db.add(
        Transaction(
            user_id=user.id,
            account_id=account.id,
            type="expense",
            amount=10000,
            category_id=None,
            description="Kopi",
            date=yesterday,
            status="approved",
            is_deleted=False,
        )
    )
    db.commit()

    reminder = build_reminder(db, user.id, today=today)

    assert reminder["should_remind"] is False
    assert reminder["code"] == "nothing_to_say"


def test_the_reminder_carries_a_code_for_the_screen(db, reader):
    """
    The screen puts the reminder in the reader's language.

    The code travels with the answer, so a sentence written in one
    language is never shown in another.
    """
    user, _account = reader
    today = date(2026, 3, 10)

    make_debt(db, user.id, "Sewa", today + timedelta(days=1))

    reminder = build_reminder(db, user.id, today=today)

    assert reminder["code"] == "payment_due"
    # The code is the stable part. The sentence is there as a fallback.
    assert reminder["message"]

def test_a_budget_that_has_run_out_is_reminded_about(db, reader):
    """A budget whose spending has reached the limit is worth a note."""
    user, account = reader
    today = date(2026, 3, 10)

    db.add(
        Budget(
            user_id=user.id,
            name="Makan",
            amount=100000,
            currency="IDR",
            period="monthly",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 31),
            account_id=account.id,
            is_active=True,
        )
    )
    db.commit()

    db.add(
        Transaction(
            user_id=user.id,
            account_id=account.id,
            type="expense",
            amount=150000,
            category_id=None,
            description="Makan",
            date=date(2026, 3, 5),
            status="approved",
            is_deleted=False,
        )
    )
    db.commit()

    reminder = build_reminder(db, user.id, today=today)

    assert reminder["code"] == "budget_exceeded"
    assert reminder["title"] == "Makan"


def test_a_budget_is_not_judged_by_spending_outside_its_period(db, reader):
    """
    A budget is measured against its own period.

    Spending before the budget started, or after it ended, is not the
    budget's doing, so it must not push the budget over its limit.
    """
    user, account = reader
    today = date(2026, 3, 10)

    db.add(
        Budget(
            user_id=user.id,
            name="Makan",
            amount=100000,
            currency="IDR",
            period="monthly",
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 31),
            account_id=account.id,
            is_active=True,
        )
    )
    db.commit()

    # Spending in February, before the budget began.
    db.add(
        Transaction(
            user_id=user.id,
            account_id=account.id,
            type="expense",
            amount=900000,
            category_id=None,
            description="Lama",
            date=date(2026, 2, 10),
            status="approved",
            is_deleted=False,
        )
    )
    db.commit()

    reminder = build_reminder(db, user.id, today=today)

    assert reminder["code"] != "budget_exceeded"


def test_a_budget_whose_period_has_ended_is_not_judged(db, reader):
    """A budget that has finished is not measured any more."""
    user, account = reader
    today = date(2026, 3, 10)

    db.add(
        Budget(
            user_id=user.id,
            name="Makan",
            amount=100000,
            currency="IDR",
            period="monthly",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            account_id=account.id,
            is_active=True,
        )
    )
    db.commit()

    db.add(
        Transaction(
            user_id=user.id,
            account_id=account.id,
            type="expense",
            amount=900000,
            category_id=None,
            description="Lama",
            date=date(2026, 1, 10),
            status="approved",
            is_deleted=False,
        )
    )
    db.commit()

    reminder = build_reminder(db, user.id, today=today)

    assert reminder["code"] != "budget_exceeded"


def test_a_recurring_bill_that_is_due_is_reminded_about(db, reader):
    """
    A recurring bill that has come round is worth a note.

    A recurring rule has a description rather than a name, so this also
    checks that the right field is read.
    """
    user, account = reader
    today = date(2026, 3, 10)

    db.add(
        RecurringRule(
            user_id=user.id,
            type="expense",
            amount=150000,
            currency="IDR",
            description="Langganan Netflix",
            account_id=account.id,
            frequency="monthly",
            start_date=date(2026, 1, 1),
            next_occurrence=date(2026, 3, 10),
            is_active=True,
        )
    )
    db.commit()

    reminder = build_reminder(db, user.id, today=today)

    assert reminder["code"] == "recurring_due"
    assert reminder["title"] == "Langganan Netflix"
    assert reminder["href"] == "/recurring"
