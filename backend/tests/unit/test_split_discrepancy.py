"""
A receipt that does not add up to itself.

Some receipts are read wrong. A line is missed, a price is read as
one digit short, a voucher is put in the wrong place. The lines then
do not add up to the receipt's own subtotal.

When that happens, the reader is told how much the gap is, and the
bill cannot be published until they have dealt with it. A bill that
is published with a gap in it is a bill where somebody pays for
something they did not order.
"""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.split_bill import SplitExpense, SplitGroup, SplitItem, SplitMember
from app.services.split_bill_service import find_discrepancy, lines_total


@pytest.fixture()
def db():
    from sqlalchemy import MetaData

    engine = create_engine("sqlite:///:memory:")
    private = MetaData()

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

    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.receipt  # noqa: F401

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


class _Reader:
    id = 1
    email = "host@example.test"
    name = "The Host"
    is_active = True


def _setup(db, subtotal, item_total):
    """
    A receipt with one line that does not add up to its own subtotal.
    """
    group = SplitGroup(owner_id=1, name="Dinner", invite_code="CODE1234")
    db.add(group)
    db.flush()

    host = SplitMember(group_id=group.id, user_id=1, display_name="Host", is_host=True)
    db.add(host)
    db.flush()

    expense = SplitExpense(
        group_id=group.id,
        user_id=1,
        status="DRAFT",
        name="Dinner",
        subtotal=Decimal(str(subtotal)),
        grand_total=Decimal(str(subtotal)),
        split_mode="ITEMIZED",
        payer_account_id=1,
    )
    db.add(expense)
    db.flush()

    item = SplitItem(
        expense_id=expense.id,
        name="Steak",
        quantity=Decimal("1"),
        unit_price=Decimal(str(item_total)),
        total_price=Decimal(str(item_total)),
        kind="item",
    )
    db.add(item)
    db.flush()

    return group, host, expense, item


def test_the_gap_between_the_lines_and_the_subtotal_is_found(db):
    """
    The line says Rp140.000 and the subtotal says Rp150.000, so
    there is a gap of Rp10.000.
    """
    group, host, expense, item = _setup(db, 150000, 140000)

    totals = {
        "subtotal": Decimal("150000"),
        "tax": Decimal("0"),
        "service_charge": Decimal("0"),
        "discount": Decimal("0"),
        "grand_total": Decimal("150000"),
    }

    # The gap is signed: the lines are short of the subtotal, so the
    # gap is negative. What the reader is told is how much it is.
    assert abs(find_discrepancy([item], totals)) == Decimal("10000.00")


def test_a_receipt_that_adds_up_has_no_gap(db):
    group, host, expense, item = _setup(db, 140000, 140000)

    totals = {
        "subtotal": Decimal("140000"),
        "tax": Decimal("0"),
        "service_charge": Decimal("0"),
        "discount": Decimal("0"),
        "grand_total": Decimal("140000"),
    }

    assert find_discrepancy([item], totals) is None


def test_a_receipt_with_no_subtotal_has_no_gap(db):
    """
    There is nothing to compare against, so there is nothing to say.
    """
    group, host, expense, item = _setup(db, 0, 140000)

    totals = {
        "subtotal": Decimal("0"),
        "tax": Decimal("0"),
        "service_charge": Decimal("0"),
        "discount": Decimal("0"),
        "grand_total": Decimal("0"),
    }

    assert find_discrepancy([item], totals) is None


def test_a_receipt_with_nothing_on_it_has_no_gap(db):
    group, host, expense, item = _setup(db, 150000, 140000)
    db.delete(item)
    db.flush()

    totals = {
        "subtotal": Decimal("150000"),
        "tax": Decimal("0"),
        "service_charge": Decimal("0"),
        "discount": Decimal("0"),
        "grand_total": Decimal("150000"),
    }

    assert find_discrepancy([], totals) is None


def test_the_lines_of_a_receipt_add_up_on_their_own(db):
    group, host, expense, item = _setup(db, 150000, 140000)

    assert lines_total([item]) == Decimal("140000.00")


def test_the_bill_cannot_be_published_while_there_is_a_gap(db):
    """
    This is the whole point. A bill with a gap in it is refused, so
    that nobody ends up paying for a line that was read wrong.
    """
    from fastapi import HTTPException

    from app.api.routes.split_bills import publish_expense

    group, host, expense, item = _setup(db, 150000, 140000)
    db.commit()

    with pytest.raises(HTTPException) as raised:
        publish_expense(expense.id, db=db, current_user=_Reader())

    assert raised.value.status_code == 409
    assert "10000" in raised.value.detail.replace(".", "").replace(",", "")


def test_the_bill_can_be_published_once_the_gap_is_gone(db):
    """
    The reader fixes the line, and the bill goes through.
    """
    from app.api.routes.split_bills import publish_expense

    group, host, expense, item = _setup(db, 140000, 140000)
    db.commit()

    result = publish_expense(expense.id, db=db, current_user=_Reader())

    assert result.status == "PUBLISHED"


def test_the_reader_is_told_what_the_gap_is_in_words(db):
    """
    The warning says how much the gap is, in the currency of the
    bill, so that the reader can see at once whether it is a tax
    line they missed or a price they have to correct.
    """
    from app.services.split_bill_service import describe_discrepancy

    group, host, expense, item = _setup(db, 150000, 140000)

    totals = {
        "subtotal": Decimal("150000"),
        "tax": Decimal("0"),
        "service_charge": Decimal("0"),
        "discount": Decimal("0"),
        "grand_total": Decimal("150000"),
    }

    gap = find_discrepancy([item], totals)
    words = describe_discrepancy(gap, "IDR")

    assert "Rp" in words
    assert "10.000" in words
    assert "subtotal" in words.lower()
