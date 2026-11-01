"""
Where the group's money went.

A shared bill often has a place on it: a restaurant, a cafe, a
hawker stall. The reader already has a page that puts places on a
map, for the shops they spend at. A shared bill belongs there too,
because the question "where did we eat out this month" is asked of
the group the same way it is asked of the reader.

Nothing is sent and nothing changes. This only reads the bills that
were already there.
"""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base


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


def _setup(db, with_place=True, status="PUBLISHED"):
    from app.models.account import Account
    from app.models.category import Category
    from app.models.split_bill import SplitExpense, SplitGroup, SplitMember

    db.add(Account(id=1, user_id=1, name="BCA", account_type="bank", balance=Decimal("1000000")))
    db.add(Category(id=1, user_id=1, name="Food", type="expense"))
    db.flush()

    group = SplitGroup(owner_id=1, name="Dinner", invite_code="CODE1234")
    db.add(group)
    db.flush()

    db.add(SplitMember(group_id=group.id, user_id=1, display_name="Host", is_host=True))
    db.flush()

    expense = SplitExpense(
        group_id=group.id,
        user_id=1,
        status=status,
        name="Dinner",
        merchant_name="Warung Sederhana",
        place_name="Warung Sederhana, Sudirman" if with_place else None,
        latitude=Decimal("-6.208763") if with_place else None,
        longitude=Decimal("106.800600") if with_place else None,
        subtotal=Decimal("100000"),
        grand_total=Decimal("100000"),
        split_mode="ITEMIZED",
        payer_account_id=1,
    )
    db.add(expense)
    db.flush()
    return group, expense


def test_a_bill_with_a_place_is_shown_on_the_map(db):
    """
    The bill knows where it was, so it goes on the map.
    """
    from app.services.split_map_service import group_places

    _setup(db)
    db.commit()

    places = group_places(db, 1)

    assert len(places) == 1
    assert places[0]["latitude"] == pytest.approx(-6.208763)
    assert places[0]["longitude"] == pytest.approx(106.8006)
    assert places[0]["amount"] == 100000.0
    assert places[0]["group_name"] == "Dinner"


def test_a_bill_without_a_place_is_not_on_the_map(db):
    """
    A bill that was paid in cash on a stall with no address is not
    on a map. Putting it at the wrong place would be worse than
    leaving it off.
    """
    from app.services.split_map_service import group_places

    _setup(db, with_place=False)
    db.commit()

    assert group_places(db, 1) == []


def test_a_bill_that_was_never_published_is_not_on_the_map(db):
    """
    A bill that is still being claimed is not yet a thing that
    happened.
    """
    from app.services.split_map_service import group_places

    _setup(db, status="DRAFT")
    db.commit()

    assert group_places(db, 1) == []


def test_the_places_of_one_person_are_not_shown_to_another(db):
    from app.services.split_map_service import group_places

    _setup(db)
    db.commit()

    assert group_places(db, 2) == []


def test_two_bills_at_the_same_place_are_one_place(db):
    """
    Three dinners at the same restaurant are one place with three
    bills at it, not three places.
    """
    from app.models.split_bill import SplitExpense
    from app.services.split_map_service import group_places

    group, expense = _setup(db)
    db.flush()

    second = SplitExpense(
        group_id=group.id,
        user_id=1,
        status="PUBLISHED",
        name="Lunch",
        merchant_name="Warung Sederhana",
        place_name="Warung Sederhana, Sudirman",
        latitude=expense.latitude,
        longitude=expense.longitude,
        subtotal=Decimal("50000"),
        grand_total=Decimal("50000"),
        split_mode="ITEMIZED",
        payer_account_id=1,
    )
    db.add(second)
    db.commit()

    places = group_places(db, 1)

    assert len(places) == 1
    assert places[0]["amount"] == 150000.0
    assert places[0]["bills"] == 2
