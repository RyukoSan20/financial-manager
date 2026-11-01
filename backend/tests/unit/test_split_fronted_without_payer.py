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
    db.flush()

    return group, host, guest, expense


def _setup_without_a_payer_row(db):
    """
    The same bill, but nobody was recorded as having paid it.

    The host is the one who settled the bill at the restaurant, and
    the bill names the account it came out of. That is enough to
    know the host laid out the whole amount. A bill that has no
    payer row is a bill where nobody filled in that part of the
    form, not a bill where nobody paid.
    """
    from app.models.account import Account
    from app.models.category import Category

    db.add(Account(id=1, user_id=1, name="BCA", account_type="bank", balance=Decimal("1000000")))
    db.add(Category(id=1, user_id=1, name="Food", type="expense"))
    db.commit()

    group = SplitGroup(owner_id=1, name="Dinner", invite_code="NOPAY01")
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
    db.flush()

    return group, host, guest, expense




def test_a_bill_with_no_payer_row_still_knows_what_the_host_fronted(db):
    """
    The money that the others owe back must still be written down.

    There is no row saying who paid, but the bill names the account
    it came out of and the host is the member of the group. The host
    laid out the whole amount. The part that is not the host's own
    share is on loan to the table, and it has to be a row of its own,
    or the host will never be told that the money is coming back.
    """
    from app.models.transaction import Transaction
    from app.services.split_publish_service import publish_expense_to_ledger

    group, host, guest, expense = _setup_without_a_payer_row(db)
    recompute_expense(db, expense, [host, guest], currency="IDR")
    db.flush()

    written = publish_expense_to_ledger(
        db,
        expense=expense,
        group=group,
        members=[host, guest],
        user=_Reader(),
    )
    db.flush()

    kinds = sorted(row.split_tx_type for row in written)
    assert kinds == ["FRONTED_RECEIVABLE", "PERSONAL_SHARE"], (
        f"the two rows the host's bill leaves behind are missing: {kinds}"
    )

    by_kind = {row.split_tx_type: row for row in written}
    assert Decimal(str(by_kind["PERSONAL_SHARE"].amount)) == Decimal("40000")
    assert Decimal(str(by_kind["FRONTED_RECEIVABLE"].amount)) == Decimal("60000")


def test_the_fronted_amount_falls_back_to_the_bill_total(db):
    """
    The number the others owe back, worked out on its own.

    When nobody was recorded as paying, the amount that was paid is
    the total of the bill. When somebody was, it is what they were
    recorded as paying.
    """
    from app.services.split_publish_service import the_fronted_amount

    group, host, guest, expense = _setup_without_a_payer_row(db)
    recompute_expense(db, expense, [host, guest], currency="IDR")
    db.flush()

    assert the_fronted_amount(db, expense, host.id) == Decimal("60000")
