"""
Being reminded about a bill that has not been paid back.

The other reminders in this application are about money leaving the
reader: a bill that is due, a budget that has run out. This one is
about money that has already left and has not come back.

It is worth a reminder for the same reason the others are: the money
on loan does not appear anywhere else. It is not spending, so it is
not in the chart, and it is not a debt the reader set up, so it is
not in the debt page. Without this, the only way to find out that
somebody has not paid back is to remember.
"""

from decimal import Decimal
from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base

# The day the tests pretend it is.
TODAY = date(2026, 11, 15)


@pytest.fixture()
def db():
    from sqlalchemy import MetaData

    engine = create_engine("sqlite:///:memory:")
    private = MetaData()

    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.receipt  # noqa: F401
    import app.models.budget  # noqa: F401
    import app.models.debt  # noqa: F401
    import app.models.recurring  # noqa: F401

    copied = set()

    def copy_table(name):
        if name in copied or name not in Base.metadata.tables:
            return
        copied.add(name)
        source = Base.metadata.tables[name]
        for column in source.columns:
            for foreign_key in column.foreign_keys:
                copy_table(foreign_key.target_fullname.split(".")[0])
        source.to_metadata(private)

    for name in (
        "users",
        "accounts",
        "categories",
        "transactions",
        "receipt_scans",
        "budgets",
        "debts",
        "recurring_rules",
        "split_groups",
        "split_members",
        "split_expenses",
        "split_payers",
        "split_items",
        "split_item_claims",
        "split_calculated_shares",
        "split_settlements",
        "split_payment_methods",
    ):
        copy_table(name)

    private.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _setup(db, days_ago, amount="60000", settled=False):
    from app.models.account import Account
    from app.models.category import Category
    from app.models.split_bill import (
        SplitExpense,
        SplitGroup,
        SplitItem,
        SplitItemClaim,
        SplitMember,
        SplitPayer,
    )
    from app.models.transaction import Transaction

    db.add(Account(id=1, user_id=1, name="BCA", account_type="bank", balance=Decimal("1000000")))
    db.add(Category(id=1, user_id=1, name="Food", type="expense"))
    db.flush()

    group = SplitGroup(owner_id=1, name="Dinner", invite_code="CODE1234")
    db.add(group)
    db.flush()

    host = SplitMember(group_id=group.id, user_id=1, display_name="Host", is_host=True)
    guest = SplitMember(group_id=group.id, user_id=None, display_name="Budi")
    db.add(host)
    db.add(guest)
    db.flush()

    when = TODAY - timedelta(days=days_ago)
    expense = SplitExpense(
        group_id=group.id,
        user_id=1,
        status="PUBLISHED",
        name="Dinner",
        merchant_name="Warung Sederhana",
        subtotal=Decimal("100000"),
        grand_total=Decimal("100000"),
        split_mode="ITEMIZED",
        payer_account_id=1,
        receipt_date=when,
    )
    db.add(expense)
    db.flush()

    tea = SplitItem(
        expense_id=expense.id,
        name="Es Teh",
        quantity=Decimal("1"),
        unit_price=Decimal("40000"),
        total_price=Decimal("40000"),
        kind="item",
    )
    steak = SplitItem(
        expense_id=expense.id,
        name="Steak",
        quantity=Decimal("1"),
        unit_price=Decimal("60000"),
        total_price=Decimal("60000"),
        kind="item",
    )
    db.add(tea)
    db.add(steak)
    db.flush()

    db.add(SplitItemClaim(item_id=tea.id, member_id=host.id, quantity=Decimal("1")))
    db.add(SplitItemClaim(item_id=steak.id, member_id=guest.id, quantity=Decimal("1")))
    db.add(SplitPayer(expense_id=expense.id, member_id=host.id, amount=Decimal("100000")))
    db.flush()

    db.add(
        Transaction(
            user_id=1,
            type="expense",
            amount=Decimal(amount),
            currency="IDR",
            date=when,
            description="Dinner (on loan to the group)",
            account_id=1,
            split_expense_id=expense.id,
            split_tx_type="FRONTED_RECEIVABLE",
            status="approved",
            detection_type="MANUAL",
        )
    )

    if settled:
        db.add(
            Transaction(
                user_id=1,
                type="transfer_in",
                amount=Decimal(amount),
                currency="IDR",
                date=TODAY,
                description="Shared bill paid back by Budi",
                account_id=1,
                split_expense_id=expense.id,
                split_tx_type="SPLIT_REIMBURSEMENT",
                status="approved",
                detection_type="MANUAL",
            )
        )

    db.flush()
    return group, host, guest, expense


def test_a_bill_that_has_not_been_paid_back_is_reminded_about(db):
    """
    Three weeks is long enough that somebody has forgotten.
    """
    from app.services.reminder_service import build_reminder

    _setup(db, days_ago=21)
    db.commit()

    reminder = build_reminder(db, 1, today=TODAY)

    assert reminder["should_remind"] is True
    assert reminder["code"] == "group_bill_unpaid"


def test_a_bill_that_is_still_fresh_is_not_reminded_about(db):
    """
    The people are still at the table. It would be silly to say
    anything.
    """
    from app.services.reminder_service import build_reminder

    _setup(db, days_ago=3)
    db.commit()

    reminder = build_reminder(db, 1, today=TODAY)

    assert reminder.get("code") != "group_bill_unpaid"


def test_a_bill_that_has_been_paid_back_is_not_reminded_about(db):
    from app.services.reminder_service import build_reminder

    _setup(db, days_ago=21, settled=True)
    db.commit()

    reminder = build_reminder(db, 1, today=TODAY)

    assert reminder.get("code") != "group_bill_unpaid"


def test_the_reminder_says_how_much_and_for_how_long(db):
    """
    A reminder that says nothing useful is noise. It says how much,
    how long it has been out, and whose it is.
    """
    from app.services.reminder_service import build_reminder

    _setup(db, days_ago=21, amount="75000")
    db.commit()

    reminder = build_reminder(db, 1, today=TODAY)

    assert reminder["code"] == "group_bill_unpaid"
    assert "75" in str(reminder["message"]).replace(",", "")
    assert "21" in str(reminder["message"])
