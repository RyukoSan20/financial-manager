"""
The sub-category travels with the transaction.

"Makanan & Minuman" says what kind of spending a transaction is. It
does not say whether it was coffee or groceries, and a reader who
buys coffee every morning and groceries once a week has the same
category for both. The list of their spending says nothing about
what they actually spend on.

So the sub-category is written down with the transaction, as a tag.
The parent stays what the budget and the report understand, and the
tag says what the reader actually bought.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.transaction import Transaction


@pytest.fixture()
def session():
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _add_now(dbapi_connection, _record):
        dbapi_connection.create_function("NOW", 0, lambda: "2026-11-07 00:00:00")

    private = Base.metadata
    private.create_all(
        engine,
        tables=[
            private.tables[name]
            for name in ("transactions", "accounts", "categories", "users")
            if name in private.tables
        ],
    )
    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def _make(session):
    from app.models.account import Account
    from app.models.category import Category
    from app.models.user import User

    session.add(User(
        id=1,
        email="reader@example.test",
        hashed_password="x",
        full_name="Reader",
    ))
    session.add(Account(
        id=1,
        user_id=1,
        name="BCA",
        account_type="bank",
        balance=0.0,
        currency="IDR",
    ))
    session.add(Category(id=6, name="Makanan & Minuman", type="expense"))
    session.commit()


def test_a_sub_category_is_kept_when_the_transaction_is_written(session):
    """The tag is written down with the transaction."""
    from app.api.routes.transactions import create_transaction
    from app.schemas.transaction import TransactionCreate

    _make(session)

    class _User:
        id = 1

    created = create_transaction(
        TransactionCreate(
            type="expense",
            amount=Decimal("10000"),
            currency="IDR",
            date=date(2026, 11, 8),
            description="Kopi Jago",
            category_id=6,
            account_id=1,
            tags="coffee_tea",
        ),
        current_user=_User(),
        db=session,
    )

    assert created is not None
    assert created.tags == "coffee_tea", (
        "the sub-category was not written down: %r" % created.tags
    )


def test_a_transaction_without_a_sub_category_is_still_written(session):
    """Not every transaction has one, and that is fine."""
    from app.api.routes.transactions import create_transaction
    from app.schemas.transaction import TransactionCreate

    _make(session)

    class _User:
        id = 1

    created = create_transaction(
        TransactionCreate(
            type="expense",
            amount=Decimal("10000"),
            currency="IDR",
            date=date(2026, 11, 8),
            description="Kopi Jago",
            category_id=6,
            account_id=1,
        ),
        current_user=_User(),
        db=session,
    )

    assert created is not None
    assert not created.tags


def test_the_sub_category_can_be_corrected(session):
    """
    A reader who chose the wrong sub-category has to be able to fix
    it, or the first wrong answer is the last one.
    """
    from app.api.routes.transactions import create_transaction, update_transaction
    from app.schemas.transaction import TransactionCreate, TransactionUpdate

    _make(session)

    class _User:
        id = 1

    created = create_transaction(
        TransactionCreate(
            type="expense",
            amount=Decimal("10000"),
            currency="IDR",
            date=date(2026, 11, 8),
            description="Kopi Jago",
            category_id=6,
            account_id=1,
            tags="coffee_tea",
        ),
        current_user=_User(),
        db=session,
    )

    updated = update_transaction(
        created.id,
        TransactionUpdate(tags="groceries"),
        current_user=_User(),
        db=session,
    )

    assert updated is not None
    assert updated.tags == "groceries", (
        "the sub-category could not be corrected: %r" % updated.tags
    )
