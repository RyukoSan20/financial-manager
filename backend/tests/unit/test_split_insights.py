"""
The money that is still on loan.

Two things the reader has laid out for other people and has not got
back:

- a bill that was shared weeks ago and has not been settled,
- a group that eats out more than the reader usually does.

These are the two things the shared bill makes visible that the
reader cannot see from their own transactions, because the money
that is on loan is not their spending and therefore does not show up
in the spending chart at all.
"""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.split_bill import (
    SplitExpense,
    SplitGroup,
    SplitItem,
    SplitItemClaim,
    SplitMember,
    SplitPayer,
)
from app.models.transaction import Transaction
from datetime import date, timedelta

# The day the tests pretend it is.
#
# The tests would otherwise depend on which day of the month they are
# run on: a transaction from yesterday is in this month on the second
# of the month and in the month before on the first. A test that
# changes its answer depending on the day it is run is a test that
# cannot be trusted.
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


def _setup(db, days_ago, fronted="60000"):
    """
    A group, a bill published weeks ago, and the host's own money
    still on loan.
    """
    from app.models.account import Account
    from app.models.category import Category

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

    # The money that is on loan: the part the host laid out for the
    # guest, and has not got back.
    db.add(
        Transaction(
            user_id=1,
            type="expense",
            amount=Decimal(fronted),
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
    db.flush()

    return group, host, guest, expense


def test_a_bill_that_was_paid_away_weeks_ago_is_reported(db):
    """
    A hundred thousand rupiah laid out for somebody else three weeks
    ago, and not paid back yet, is worth mentioning.
    """
    from app.services.insight_service import find_unsettled_group_lending

    group, host, guest, expense = _setup(db, days_ago=21)
    db.commit()

    findings = find_unsettled_group_lending(db, 1, today=TODAY)

    assert len(findings) == 1
    assert findings[0]["amount"] == 60000.0
    assert findings[0]["days_outstanding"] >= 21
    assert findings[0]["group_name"] == "Dinner"


def test_a_bill_that_was_paid_away_yesterday_is_not_reported(db):
    """
    Somebody is going to pay it back tomorrow. It is not worth
    mentioning yet.
    """
    from app.services.insight_service import find_unsettled_group_lending

    group, host, guest, expense = _setup(db, days_ago=3)
    db.commit()

    assert find_unsettled_group_lending(db, 1, today=TODAY) == []


def test_a_bill_that_has_been_paid_back_is_not_reported(db):
    """
    The money is back, so there is nothing outstanding.
    """
    from app.services.insight_service import find_unsettled_group_lending

    group, host, guest, expense = _setup(db, days_ago=21)
    db.commit()

    db.add(
        Transaction(
            user_id=1,
            type="transfer_in",
            amount=Decimal("60000"),
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
    db.commit()

    assert find_unsettled_group_lending(db, 1, today=TODAY) == []


def test_the_money_of_one_person_does_not_bother_another(db):
    """
    The reader is told about their own lending and nobody else's.
    """
    from app.services.insight_service import find_unsettled_group_lending

    group, host, guest, expense = _setup(db, days_ago=21)
    db.commit()

    assert find_unsettled_group_lending(db, 2, today=TODAY) == []


def test_a_group_that_eats_out_more_than_usual_is_reported(db):
    """
    Two dinners this month and one last month. That is more than the
    reader usually does.
    """
    from app.services.insight_service import find_group_spending_outlier

    group, host, guest, expense = _setup(db, days_ago=2)
    db.commit()

    db.add(
        Transaction(
            user_id=1,
            type="expense",
            amount=Decimal("40000"),
            currency="IDR",
            date=TODAY - timedelta(days=1),
            description="Dinner (on loan to the group)",
            account_id=1,
            split_expense_id=expense.id,
            split_tx_type="PERSONAL_SHARE",
            status="approved",
            detection_type="MANUAL",
        )
    )
    # A dinner last month, so that this month can be compared with
    # something. Without it there is no average to be above.
    db.add(
        Transaction(
            user_id=1,
            type="expense",
            amount=Decimal("20000"),
            currency="IDR",
            date=TODAY - timedelta(days=60),
            description="Dinner (on loan to the group)",
            account_id=1,
            split_expense_id=expense.id,
            split_tx_type="PERSONAL_SHARE",
            status="approved",
            detection_type="MANUAL",
        )
    )
    db.commit()

    findings = find_group_spending_outlier(db, 1, today=TODAY)

    assert len(findings) >= 1
    assert findings[0]["amount"] > findings[0]["average"]
