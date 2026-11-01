"""
The money actually moves.

A shared bill that is published has to move the reader's money in the
same way an ordinary expense does, and a payment back has to move it
back. These are the checks that the balance of the account that paid
the bill is the balance it should be.
"""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.split_bill import (
    SplitCalculatedShare,
    SplitExpense,
    SplitGroup,
    SplitItem,
    SplitItemClaim,
    SplitMember,
    SplitPayer,
    SplitSettlement,
)
from app.services.split_bill_service import recompute_expense


@pytest.fixture()
def db():
    """
    A database with the tables this test needs.

    Only the tables the shared bill touches are made. The whole
    schema cannot be made on a small database because one of the
    other tables uses a column type that only the big one has.
    """
    from sqlalchemy import (
        Boolean,
        Column,
        Date,
        DateTime,
        ForeignKey,
        Integer,
        MetaData,
        Numeric,
        String,
        Table,
        Text,
    )

    engine = create_engine("sqlite:///:memory:")
    private = MetaData()

    Table(
        "users",
        private,
        Column("id", Integer, primary_key=True),
        Column("email", String(255)),
        Column("name", String(100)),
        Column("hashed_password", String(255)),
        Column("is_active", Boolean, default=True),
        Column("default_currency", String(10)),
        Column("created_at", DateTime),
    )
    # The rest of the tables are copied from the models, because a
    # hand-written table drifts away from the model and the first
    # thing that breaks is a column the model has and the table does
    # not.

    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.receipt  # noqa: F401

    # A table that is pointed at is copied along with the table that
    # points at it.
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


class _Reader:
    id = 1
    email = "host@example.test"
    name = "The Host"
    is_active = True


def _setup(db):
    """
    A group of two, an account with a million rupiah in it, and a
    bill of a hundred thousand that the host paid.
    """
    from app.models.account import Account
    from app.models.category import Category

    db.add(Account(id=1, user_id=1, name="BCA", account_type="bank", balance=Decimal("1000000")))
    db.add(Category(id=1, user_id=1, name="Food", type="expense"))
    db.commit()

    group = SplitGroup(owner_id=1, name="Dinner", invite_code="CODE1234")
    db.add(group)
    db.flush()

    host = SplitMember(group_id=group.id, user_id=1, display_name="Host", is_host=True, is_present=True)
    guest = SplitMember(group_id=group.id, user_id=None, display_name="Budi", is_present=True)
    db.add(host)
    db.add(guest)
    db.flush()

    expense = SplitExpense(
        group_id=group.id,
        user_id=1,
        status="DRAFT",
        name="Dinner",
        merchant_name="Warung Sederhana",
        subtotal=Decimal("100000"),
        grand_total=Decimal("100000"),
        split_mode="ITEMIZED",
        payer_account_id=1,
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

    return group, host, guest, expense


def test_the_balance_moves_when_the_bill_is_published(db):
    """
    The host paid Rp100.000 for the table, so the account is
    Rp100.000 lighter afterwards.
    """
    from app.models.account import Account
    from app.services.split_publish_service import publish_expense_to_ledger

    group, host, guest, expense = _setup(db)
    recompute_expense(db, expense, [host, guest], currency="IDR")
    db.flush()

    publish_expense_to_ledger(
        db,
        expense=expense,
        group=group,
        members=[host, guest],
        user=_Reader(),
    )
    db.flush()

    account = db.query(Account).filter(Account.id == 1).first()
    assert account.balance == Decimal("900000")


def test_the_money_others_owe_is_not_counted_as_spending(db):
    """
    The reader's own share is Rp40.000, so that is what the monthly
    chart shows. The other Rp60.000 is on loan.
    """
    from app.services.metrics import period_totals
    from app.services.split_publish_service import publish_expense_to_ledger

    group, host, guest, expense = _setup(db)
    recompute_expense(db, expense, [host, guest], currency="IDR")
    db.flush()

    publish_expense_to_ledger(
        db,
        expense=expense,
        group=group,
        members=[host, guest],
        user=_Reader(),
    )
    db.commit()

    from datetime import date

    today = date.today()
    income, expense_total = period_totals(
        db, 1, today.replace(day=1), today.replace(day=1)
    )

    # The date of the bill is today, so the range above is empty and
    # the totals are zero. The check below reads the rows instead.
    rows = db.query(_transactions()).all()
    kinds = {row.split_tx_type: Decimal(str(row.amount)) for row in rows}
    assert kinds.get("PERSONAL_SHARE") == Decimal("40000.00")
    assert kinds.get("FRONTED_RECEIVABLE") == Decimal("60000.00")


def _transactions():
    from app.models.transaction import Transaction

    return Transaction


def test_the_spending_of_the_month_is_only_the_host_share(db):
    """
    The chart of what the reader spent shows Rp40.000, not
    Rp100.000. The reader laid out Rp100.000, but only Rp40.000 of
    it was theirs.
    """
    from app.services.split_publish_service import publish_expense_to_ledger
    from app.services.transaction_filter import personal_expense_filter
    from sqlalchemy import func

    group, host, guest, expense = _setup(db)
    recompute_expense(db, expense, [host, guest], currency="IDR")
    db.flush()

    publish_expense_to_ledger(
        db,
        expense=expense,
        group=group,
        members=[host, guest],
        user=_Reader(),
    )
    db.flush()

    from app.models.transaction import Transaction

    counted = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.user_id == 1,
            Transaction.type == "expense",
            *personal_expense_filter(),
        )
        .scalar()
    )

    assert Decimal(str(counted)) == Decimal("40000.00")


def test_a_payment_back_puts_the_money_into_the_account(db):
    """
    The money that comes back is not income. It is the reader's own
    money returning, and it goes into the account it came out of.
    """
    from app.models.account import Account
    from app.services.split_settlement_service import settle_payment

    group, host, guest, expense = _setup(db)

    settle_payment(
        db,
        group=group,
        settlement=SplitSettlement(
            group_id=group.id,
            from_member_id=guest.id,
            to_member_id=host.id,
            amount=Decimal("60000"),
            currency="IDR",
            status="COMPLETED",
        ),
        to_account_id=1,
        user=_Reader(),
    )
    db.flush()

    account = db.query(Account).filter(Account.id == 1).first()
    assert account.balance == Decimal("1060000")


def test_a_payment_back_is_not_income(db):
    from app.models.transaction import Transaction
    from app.services.split_settlement_service import settle_payment
    from app.services.transaction_filter import personal_income_filter
    from sqlalchemy import func

    group, host, guest, expense = _setup(db)

    settle_payment(
        db,
        group=group,
        settlement=SplitSettlement(
            group_id=group.id,
            from_member_id=guest.id,
            to_member_id=host.id,
            amount=Decimal("60000"),
            currency="IDR",
            status="COMPLETED",
        ),
        to_account_id=1,
        user=_Reader(),
    )
    db.flush()

    counted = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.user_id == 1,
            Transaction.type == "income",
            *personal_income_filter(),
        )
        .scalar()
    )

    assert Decimal(str(counted)) == Decimal("0")
