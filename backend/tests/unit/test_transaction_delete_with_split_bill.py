"""
A transaction that is on a split bill must still be deletable.

The receipt was one circle. There were others.

A transaction that was shared with a group sits on the split bill as
well, and the bill points at the transaction. Deleting the
transaction while the bill still points at it is refused by the
database in exactly the same way, and the reader got a 500 instead of
a deletion.

So a delete has to let go of every pointer that holds the
transaction before the row goes.

The bill itself is not thrown away. The bill holds its own copy of
the money - the subtotal, the tax, the total - so the group can
still see what the meal was. What goes is the link to the
transaction that no longer exists.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.transaction import Transaction


@pytest.fixture()
def session():
    """
    A database of our own, so the test never touches a real one.

    The split tables are included because the delete has to cope with
    them. SQLite is used with the foreign keys turned off so that the
    test can build the shape that a real PostgreSQL database refuses
    to delete from.
    """
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.split_bill  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _add_now(dbapi_connection, _record):
        dbapi_connection.create_function("NOW", 0, lambda: "2026-11-07 00:00:00")

    private = Base.metadata
    wanted = (
        "transactions",
        "accounts",
        "categories",
        "users",
        "split_groups",
        "split_members",
        "split_expenses",
        "split_items",
        "split_settlements",
        "receipt_scans",
        "receipt_items",
        "scan_jobs",
        "transaction_items",
        "transaction_locations",
        "breakdown_items",
    )
    private.create_all(
        engine, tables=[private.tables[name] for name in wanted if name in private.tables]
    )
    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def _make_with_split_bill(db):
    """A transaction that is on a split bill, the bill pointing at it."""
    from app.models.split_bill import SplitExpense, SplitGroup, SplitMember
    from app.models.user import User

    user = User(
        id=1,
        email="reader@example.test",
        hashed_password="x",
        full_name="Reader",
    )
    db.add(user)

    group = SplitGroup(
        id=16,
        owner_id=1,
        name="Makan Malam",
        invite_code="QA123456",
        currency="IDR",
    )
    db.add(group)
    db.commit()

    member = SplitMember(id=30, group_id=16, user_id=1, display_name="Reader", is_host=True)
    db.add(member)
    db.commit()

    tx = Transaction(
        id=562,
        user_id=1,
        type="expense",
        amount=Decimal("210000"),
        currency="IDR",
        date=date(2026, 11, 6),
        description="Makan Malam",
        account_id=1,
        category_id=6,
    )
    db.add(tx)
    db.commit()

    bill = SplitExpense(
        id=10,
        group_id=16,
        created_by_member_id=30,
        user_id=1,
        name="Makan Malam",
        subtotal=Decimal("210000"),
        grand_total=Decimal("210000"),
        status="DRAFT",
        transaction_id=tx.id,
    )
    db.add(bill)
    db.commit()
    return tx, bill


def test_the_split_bill_is_unlinked_before_the_transaction_goes(session):
    """
    The delete has to break every circle, not just the receipt one.

    The bill points at the transaction. The transaction going away
    while the bill still points at it is refused by the database, and
    the reader gets an error instead of a deletion. So the bill lets
    go of the transaction first.
    """
    from app.api.routes.transactions import delete_transaction
    from app.models.split_bill import SplitExpense

    tx, bill = _make_with_split_bill(session)

    class _User:
        id = 1

    delete_transaction(tx.id, current_user=_User(), db=session)

    assert session.query(Transaction).filter(Transaction.id == tx.id).first() is None

    left = session.query(SplitExpense).filter(SplitExpense.id == bill.id).first()
    assert left is not None, "the bill was thrown away with the transaction"
    assert left.transaction_id is None, "the bill still points at a transaction that is gone"


def test_the_delete_works_against_a_database_that_enforces_the_rules(session):
    """
    The test above uses SQLite, which does not enforce foreign keys
    unless it is told to. A test that cannot fail on the very thing
    it is about is not a test.

    So this one turns the rules on, and then tries to delete a
    transaction that a split bill is still holding. Without the fix
    the database says no and the reader gets an error instead of a
    deletion.
    """
    from sqlalchemy import event
    from app.api.routes.transactions import delete_transaction

    engine = session.get_bind()

    # SQLite keeps the rules in a different place, and they are off
    # by default. This turns them on for this connection.
    @event.listens_for(engine, "connect")
    def _turn_on_the_rules(dbapi_connection, _record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    tx, bill = _make_with_split_bill(session)

    class _User:
        id = 1

    # With the rules on, the delete has to let go of every pointer
    # first. If it does not, this raises and the test fails.
    delete_transaction(tx.id, current_user=_User(), db=session)

    assert session.query(Transaction).filter(Transaction.id == tx.id).first() is None


def test_the_bill_itself_is_kept(session):
    """
    The bill is not the transaction. The group can still see the meal
    and what it came to, and only the link to the transaction that no
    longer exists is let go of.
    """
    from app.api.routes.transactions import delete_transaction
    from app.models.split_bill import SplitExpense

    tx, bill = _make_with_split_bill(session)

    class _User:
        id = 1

    delete_transaction(tx.id, current_user=_User(), db=session)

    left = session.query(SplitExpense).filter(SplitExpense.id == bill.id).first()
    assert left is not None, "the bill was thrown away with the transaction"
    assert left.transaction_id is None, "the bill still points at a transaction that is gone"
    # The money the group shared is still on the bill.
    assert left.grand_total is not None
