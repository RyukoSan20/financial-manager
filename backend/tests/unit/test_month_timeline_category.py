"""
The month, day by day.

The dashboard shows the month as a list of days, and a reader can
open a day to see the transactions in it. Each of those transactions
carries the name of its category.

The name, and not the row of the category in the database. A row of
the database is a whole thing with fourteen fields in it, and the
browser was asked to show it as a piece of text, which is not
something a browser can do: it says "Objects are not valid as a React
child" and the page goes blank.

So this test says what the browser is given. The browser is given a
word, or nothing at all.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture()
def db():
    from app.core.database import Base
    from app.models.account import Account
    from app.models.category import Category
    from app.models.transaction import Transaction
    from app.models.user import User

    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            User.__table__,
            Account.__table__,
            Category.__table__,
            Transaction.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def _user(db):
    from app.models.user import User

    user = User(email="reader@example.com", hashed_password="x", full_name="Reader")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _category(db, name):
    from app.models.category import Category

    category = Category(name=name, type="expense", color="bg-gray-100", icon="📁")
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def _account(db, user):
    from app.models.account import Account

    account = Account(
        user_id=user.id,
        name="BCA",
        account_type="bank",
        balance=1000000,
        currency="IDR",
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def _transaction(db, user, account, category=None, description=None):
    from app.models.transaction import Transaction

    row = Transaction(
        user_id=user.id,
        account_id=account.id,
        category_id=category.id if category else None,
        type="expense",
        amount=50000,
        currency="IDR",
        description=description,
        status="approved",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


class TestTheMonthTimeline:
    def test_the_category_is_a_name_and_not_a_row(self, db):
        """
        The whole point. The browser is given a word it can show.
        """
        from app.api.routes.dashboard import get_month_timeline

        user = _user(db)
        account = _account(db, user)
        category = _category(db, "Makanan & Minuman")
        _transaction(db, user, account, category)

        class _Current:
            id = user.id

        result = get_month_timeline(None, None, _Current(), db)

        days = result["days"]
        assert days, "the month should have a day in it"
        transactions = days[0]["transactions"]
        assert len(transactions) == 1

        given = transactions[0]["category"]
        assert isinstance(given, str), (
            f"the category was given as {type(given).__name__}, "
            "but the browser can only show a name"
        )
        assert given == "Makanan & Minuman"

    def test_a_transaction_with_no_description_still_shows_something(self, db):
        """
        A transaction with no description of its own falls back to the
        name of its category. That is the case that used to break the
        page.
        """
        from app.api.routes.dashboard import get_month_timeline

        user = _user(db)
        account = _account(db, user)
        category = _category(db, "Transportasi")
        _transaction(db, user, account, category, description=None)

        class _Current:
            id = user.id

        result = get_month_timeline(None, None, _Current(), db)
        transactions = result["days"][0]["transactions"]

        assert transactions[0]["category"] == "Transportasi"
        assert isinstance(transactions[0]["category"], str)

    def test_a_transaction_with_no_category_at_all_is_not_given_a_row(self, db):
        from app.api.routes.dashboard import get_month_timeline

        user = _user(db)
        account = _account(db, user)
        _transaction(db, user, account, category=None, description=None)

        class _Current:
            id = user.id

        result = get_month_timeline(None, None, _Current(), db)
        transactions = result["days"][0]["transactions"]

        given = transactions[0]["category"]
        assert given is None or isinstance(given, str)

    def test_the_name_of_the_category_is_the_one_the_reader_wrote(self, db):
        """
        A category the reader made has no key and no translation. Its
        own name is used, in its own spelling.
        """
        from app.api.routes.dashboard import get_month_timeline

        user = _user(db)
        account = _account(db, user)
        category = _category(db, "Kopi Gula Aren")
        _transaction(db, user, account, category)

        class _Current:
            id = user.id

        result = get_month_timeline(None, None, _Current(), db)
        assert result["days"][0]["transactions"][0]["category"] == "Kopi Gula Aren"
