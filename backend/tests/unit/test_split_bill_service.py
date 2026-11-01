"""
The shared bill, from a receipt to a settled debt.

These are the checks that a bill adds up, that a draft changes
nothing, and that a member who paid for everybody is owed for what
the others ate.
"""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base

# The tables that point at each other are brought in together, so
# that the database can be made with all of them at once.
import app.models.user  # noqa: F401
import app.models.account  # noqa: F401
import app.models.category  # noqa: F401
import app.models.transaction  # noqa: F401
import app.models.receipt  # noqa: F401
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
from app.services.split_bill_service import (
    group_balances,
    recompute_expense,
    settlement_plan,
)


@pytest.fixture()
def db():
    """
    A database with only the tables this test needs.

    The whole schema cannot be made on a small database because one
    of the other tables uses a column type that only the big one has.
    The tables that are needed here are made by hand instead, which
    is also quicker.
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
        create_engine,
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
        Column("created_at", DateTime),
    )
    Table(
        "accounts",
        private,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("name", String(100)),
        Column("type", String(50)),
        Column("balance", Numeric(20, 2), default=0),
        Column("initial_balance", Numeric(20, 2), default=0),
        Column("currency", String(10), default="IDR"),
        Column("is_deleted", Boolean, default=False),
        Column("created_at", DateTime),
    )
    Table(
        "categories",
        private,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("name", String(100)),
        Column("type", String(50)),
        Column("is_adjustment", Boolean, default=False),
        Column("created_at", DateTime),
    )
    Table(
        "transactions",
        private,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("type", String(20), nullable=False),
        Column("amount", Numeric(20, 2), nullable=False),
        Column("currency", String(10), nullable=False, server_default="IDR"),
        Column("date", Date, nullable=False),
        Column("description", String(255)),
        Column("account_id", Integer, ForeignKey("accounts.id"), nullable=False),
        Column("category_id", Integer, ForeignKey("categories.id")),
        Column("is_deleted", Boolean, default=False),
        Column("status", String(20)),
        Column("split_expense_id", Integer),
        Column("split_tx_type", String(30)),
        Column("created_at", DateTime),
        Column("updated_at", DateTime),
    )
    Table(
        "receipt_scans",
        private,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("image_path", String(255)),
        Column("raw_text", Text),
        Column("created_at", DateTime),
    )

    # The tables of the shared bill, made the way the application
    # makes them.
    for name in (
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
        Base.metadata.tables[name].to_metadata(private)

    private.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _group(db, name="Dinner"):
    group = SplitGroup(owner_id=1, name=name, invite_code=f"code-{name}")
    db.add(group)
    db.flush()
    return group


def _member(db, group, name, is_host=False):
    member = SplitMember(
        group_id=group.id,
        display_name=name,
        is_host=is_host,
        is_present=True,
    )
    db.add(member)
    db.flush()
    return member


def _expense(db, group, **kwargs):
    expense = SplitExpense(
        group_id=group.id,
        status=kwargs.pop("status", "DRAFT"),
        **kwargs,
    )
    db.add(expense)
    db.flush()
    return expense


def _item(db, expense, name, quantity, unit_price, kind="item"):
    item = SplitItem(
        expense_id=expense.id,
        name=name,
        quantity=Decimal(str(quantity)),
        unit_price=Decimal(str(unit_price)),
        total_price=Decimal(str(quantity)) * Decimal(str(unit_price)),
        kind=kind,
    )
    db.add(item)
    db.flush()
    return item


def test_a_draft_bill_owes_nobody_anything(db):
    group = _group(db)
    andi = _member(db, group, "Andi", is_host=True)
    budi = _member(db, group, "Budi")
    expense = _expense(db, group, subtotal=Decimal("100000"), grand_total=Decimal("100000"))
    _item(db, expense, "Steak", 1, 100000)
    db.add(SplitPayer(expense_id=expense.id, member_id=andi.id, amount=Decimal("100000")))
    db.flush()

    balances = group_balances(db, group, [andi, budi])

    assert balances[andi.id] == Decimal("0")
    assert balances[budi.id] == Decimal("0")


def test_a_published_bill_splits_by_what_each_person_ate(db):
    group = _group(db)
    andi = _member(db, group, "Andi", is_host=True)
    budi = _member(db, group, "Budi")
    expense = _expense(
        db,
        group,
        status="PUBLISHED",
        subtotal=Decimal("200000"),
        grand_total=Decimal("200000"),
    )
    coffee = _item(db, expense, "Kopi", 1, 40000)
    steak = _item(db, expense, "Steak", 1, 160000)
    db.add(SplitItemClaim(item_id=coffee.id, member_id=andi.id, quantity=Decimal("1")))
    db.add(SplitItemClaim(item_id=steak.id, member_id=budi.id, quantity=Decimal("1")))
    db.add(SplitPayer(expense_id=expense.id, member_id=andi.id, amount=Decimal("200000")))
    db.flush()

    recompute_expense(db, expense, [andi, budi])
    db.flush()

    balances = group_balances(db, group, [andi, budi])

    assert balances[andi.id] == Decimal("160000")
    assert balances[budi.id] == Decimal("-160000")


def test_the_tax_is_shared_in_proportion_to_what_was_eaten(db):
    group = _group(db)
    andi = _member(db, group, "Andi", is_host=True)
    budi = _member(db, group, "Budi")
    expense = _expense(
        db,
        group,
        status="PUBLISHED",
        subtotal=Decimal("200000"),
        tax=Decimal("20000"),
        discount=Decimal("40000"),
        grand_total=Decimal("180000"),
    )
    rice = _item(db, expense, "Nasi Goreng", 1, 50000)
    steak = _item(db, expense, "Steak", 1, 150000)
    db.add(SplitItemClaim(item_id=rice.id, member_id=andi.id, quantity=Decimal("1")))
    db.add(SplitItemClaim(item_id=steak.id, member_id=budi.id, quantity=Decimal("1")))
    db.add(SplitPayer(expense_id=expense.id, member_id=andi.id, amount=Decimal("180000")))
    db.flush()

    recompute_expense(db, expense, [andi, budi])
    db.flush()

    shares = {
        share.member_id: share.final_amount
        for share in db.query(SplitCalculatedShare)
        .filter(SplitCalculatedShare.expense_id == expense.id)
        .all()
    }

    assert shares[andi.id] == Decimal("45000.00")
    assert shares[budi.id] == Decimal("135000.00")
    assert sum(shares.values()) == Decimal("180000.00")


def test_two_people_can_share_one_line_of_two_coffees(db):
    group = _group(db)
    andi = _member(db, group, "Andi", is_host=True)
    budi = _member(db, group, "Budi")
    expense = _expense(
        db,
        group,
        status="PUBLISHED",
        subtotal=Decimal("80000"),
        grand_total=Decimal("80000"),
    )
    coffees = _item(db, expense, "Kopi Susu", 2, 40000)
    db.add(SplitItemClaim(item_id=coffees.id, member_id=andi.id, quantity=Decimal("1")))
    db.add(SplitItemClaim(item_id=coffees.id, member_id=budi.id, quantity=Decimal("1")))
    db.add(SplitPayer(expense_id=expense.id, member_id=andi.id, amount=Decimal("80000")))
    db.flush()

    recompute_expense(db, expense, [andi, budi])
    db.flush()

    balances = group_balances(db, group, [andi, budi])

    assert balances[andi.id] == Decimal("40000")
    assert balances[budi.id] == Decimal("-40000")


def test_the_group_is_settled_with_one_payment_instead_of_three(db):
    """
    Three people owing each other in a circle.

    Budi paid for Andi's meal, Caca paid for Budi's meal, and Andi
    paid for Caca's meal. Everybody owes somebody, and everybody is
    owed by somebody, but the circle cancels out: one payment from
    Andi to Caca settles all three debts at once.
    """
    group = _group(db)
    andi = _member(db, group, "Andi", is_host=True)
    budi = _member(db, group, "Budi")
    caca = _member(db, group, "Caca")

    # Budi fronted Andi's meal.
    first = _expense(
        db,
        group,
        status="PUBLISHED",
        subtotal=Decimal("50000"),
        grand_total=Decimal("50000"),
    )
    _item(db, first, "Makan", 1, 50000)
    db.add(SplitPayer(expense_id=first.id, member_id=budi.id, amount=Decimal("50000")))
    db.add(SplitCalculatedShare(
        expense_id=first.id, member_id=andi.id, item_total=Decimal("50000"),
        exact_amount=Decimal("50000"), final_amount=Decimal("50000"), currency="IDR",
    ))
    db.add(SplitCalculatedShare(
        expense_id=first.id, member_id=budi.id, item_total=Decimal("0"),
        exact_amount=Decimal("0"), final_amount=Decimal("0"), currency="IDR",
    ))

    # Caca fronted Budi's meal.
    second = _expense(
        db,
        group,
        status="PUBLISHED",
        subtotal=Decimal("50000"),
        grand_total=Decimal("50000"),
    )
    _item(db, second, "Makan", 1, 50000)
    db.add(SplitPayer(expense_id=second.id, member_id=caca.id, amount=Decimal("50000")))
    db.add(SplitCalculatedShare(
        expense_id=second.id, member_id=budi.id, item_total=Decimal("50000"),
        exact_amount=Decimal("50000"), final_amount=Decimal("50000"), currency="IDR",
    ))
    db.add(SplitCalculatedShare(
        expense_id=second.id, member_id=caca.id, item_total=Decimal("0"),
        exact_amount=Decimal("0"), final_amount=Decimal("0"), currency="IDR",
    ))
    db.flush()

    balances = group_balances(db, group, [andi, budi, caca])
    assert balances[andi.id] == Decimal("-50000")
    assert balances[budi.id] == Decimal("0")
    assert balances[caca.id] == Decimal("50000")

    plan = settlement_plan(db, group, [andi, budi, caca])

    assert len(plan) == 1
    assert plan[0]["from_member_id"] == andi.id
    assert plan[0]["to_member_id"] == caca.id
    assert plan[0]["amount"] == Decimal("50000.00")


def test_a_settlement_takes_the_debt_off_both_of_them(db):
    group = _group(db)
    andi = _member(db, group, "Andi", is_host=True)
    budi = _member(db, group, "Budi")
    expense = _expense(
        db,
        group,
        status="PUBLISHED",
        subtotal=Decimal("100000"),
        grand_total=Decimal("100000"),
    )
    _item(db, expense, "Makan", 1, 100000)
    db.add(SplitPayer(expense_id=expense.id, member_id=andi.id, amount=Decimal("100000")))
    db.add(SplitCalculatedShare(
        expense_id=expense.id, member_id=andi.id,
        item_total=Decimal("0"), exact_amount=Decimal("0"),
        final_amount=Decimal("0"), currency="IDR",
    ))
    db.add(SplitCalculatedShare(
        expense_id=expense.id, member_id=budi.id,
        item_total=Decimal("100000"), exact_amount=Decimal("100000"),
        final_amount=Decimal("100000"), currency="IDR",
    ))
    db.flush()

    before = group_balances(db, group, [andi, budi])
    assert before[andi.id] == Decimal("100000")
    assert before[budi.id] == Decimal("-100000")

    db.add(SplitSettlement(
        group_id=group.id,
        from_member_id=budi.id,
        to_member_id=andi.id,
        amount=Decimal("100000"),
        status="COMPLETED",
    ))
    db.flush()

    after = group_balances(db, group, [andi, budi])
    assert after[andi.id] == Decimal("0")
    assert after[budi.id] == Decimal("0")


def test_a_settlement_that_is_waiting_for_its_proof_settles_nothing(db):
    group = _group(db)
    andi = _member(db, group, "Andi", is_host=True)
    budi = _member(db, group, "Budi")
    expense = _expense(
        db,
        group,
        status="PUBLISHED",
        subtotal=Decimal("100000"),
        grand_total=Decimal("100000"),
    )
    _item(db, expense, "Makan", 1, 100000)
    db.add(SplitPayer(expense_id=expense.id, member_id=andi.id, amount=Decimal("100000")))
    db.add(SplitCalculatedShare(
        expense_id=expense.id, member_id=budi.id,
        item_total=Decimal("100000"), exact_amount=Decimal("100000"),
        final_amount=Decimal("100000"), currency="IDR",
    ))
    db.flush()

    db.add(SplitSettlement(
        group_id=group.id,
        from_member_id=budi.id,
        to_member_id=andi.id,
        amount=Decimal("100000"),
        status="PENDING",
    ))
    db.flush()

    balances = group_balances(db, group, [andi, budi])

    assert balances[andi.id] == Decimal("100000")
    assert balances[budi.id] == Decimal("-100000")


def test_a_receipt_whose_lines_do_not_add_up_says_so(db):
    group = _group(db)
    andi = _member(db, group, "Andi", is_host=True)
    expense = _expense(
        db,
        group,
        status="DRAFT",
        subtotal=Decimal("150000"),
        grand_total=Decimal("150000"),
    )
    _item(db, expense, "Nasi", 1, 140000)
    db.flush()

    recompute_expense(db, expense, [andi])
    db.flush()

    assert expense.discrepancy == Decimal("-10000.00")
