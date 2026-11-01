"""
The money you are owed, where the reader expects to find it.

The reader has a debts page. On it are the loans they took out and
the loans they gave. The money that a shared bill left on loan is
neither of those, and it is not a transaction either, because money
on loan is not spending.

So it appears nowhere. The reader has to remember it, or ask.

This is the test that it appears on the debts page, and that it
appears there as what it is: money that is owed back, not a loan
that is being paid.
"""

from decimal import Decimal
from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base

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
    import app.models.debt  # noqa: F401
    import app.models.transfer  # noqa: F401

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
        "debts",
        "debt_payments",
        "transfers",
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


def _setup(db, fronted="60000", settled=False):
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

    when = TODAY - timedelta(days=10)
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

    if settled:
        db.add(
            Transaction(
                user_id=1,
                type="transfer_in",
                amount=Decimal(fronted),
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


def test_the_money_on_loan_is_reported_as_owed_back(db):
    """
    Sixty thousand rupiah that a friend owes the reader.
    """
    from app.services.split_receivable_service import outstanding_receivables

    _setup(db, fronted="60000")
    db.commit()

    receivables = outstanding_receivables(db, 1, today=TODAY)

    assert len(receivables) == 1
    assert receivables[0]["amount"] == 60000.0
    assert receivables[0]["kind"] == "owed_back"
    assert receivables[0]["group_name"] == "Dinner"


def test_the_money_that_has_come_back_is_not_reported(db):
    from app.services.split_receivable_service import outstanding_receivables

    _setup(db, fronted="60000", settled=True)
    db.commit()

    assert outstanding_receivables(db, 1, today=TODAY) == []


def test_the_money_that_has_come_back_is_reported_as_a_payment_back(db):
    """
    The transfers page is where money that moved is listed. The
    payment back belongs there.
    """
    from app.services.split_receivable_service import settled_reimbursements

    _setup(db, fronted="60000", settled=True)
    db.commit()

    payments = settled_reimbursements(db, 1)

    assert len(payments) == 1
    assert payments[0]["amount"] == 60000.0
    assert payments[0]["kind"] == "paid_back"


def test_nothing_of_a_bill_that_was_never_published_is_reported(db):
    """
    A bill that was still being claimed has not left the account, so
    there is nothing owed yet.
    """
    from app.services.split_receivable_service import outstanding_receivables

    from app.models.split_bill import SplitExpense

    group, host, guest, expense = _setup(db)
    expense.status = "DRAFT"
    db.commit()

    assert outstanding_receivables(db, 1, today=TODAY) == []


def test_the_money_of_one_person_does_not_bother_another(db):
    from app.services.split_receivable_service import outstanding_receivables

    _setup(db)
    db.commit()

    assert outstanding_receivables(db, 2, today=TODAY) == []
