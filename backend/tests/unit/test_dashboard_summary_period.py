"""
The numbers on the Dashboard have to be about the same period as the
chart next to them.

The Dashboard shows the period it is looking at: "2026-07-31 s/d
2026-10-29". That period came from the timeframe the reader chose -
three months - and the chart was drawn over it.

But the four tiles above the chart - the money in, the money out, the
cash flow - were worked out over a different period: the thirty days
that the summary endpoint defaults to. So a reader who chose three
months saw a chart of three months and a total of one month, and the
two did not agree.

The same happened with the account filter. Choosing "BCA" narrowed
the chart to that account and left the totals at every account.

These tests use a database of their own, with figures in it that are
not anybody's money.
"""

import os
import sys

import pytest

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ),
)

from datetime import date, timedelta  # noqa: E402

from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.database import Base, get_db  # noqa: E402
from app.models.account import Account  # noqa: E402
from app.models.category import Category  # noqa: E402
from app.models.transaction import Transaction  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture
def db(tmp_path):
    """A database of our own, thrown away afterwards."""
    engine = create_engine(f"sqlite:///{tmp_path / 'dashboard.db'}")
    # Only the tables this test needs. The whole set of models is not
    # made, because some of them use PostgreSQL-only types that a
    # throwaway SQLite database cannot hold.
    from sqlalchemy import MetaData

    private = MetaData()
    wanted = ("users", "accounts", "categories", "transactions", "budgets")
    for name in wanted:
        Base.metadata.tables[name].to_metadata(private)

    # Follow the foreign keys out of those four tables and bring the
    # tables they point at along too. A foreign key to a table that
    # was not copied has nothing to point at.
    pending = list(wanted)
    while pending:
        name = pending.pop()
        for column in private.tables[name].columns:
            for foreign_key in column.foreign_keys:
                target = foreign_key.target_fullname.split(".")[0]
                if target in private.tables or target not in Base.metadata.tables:
                    continue
                Base.metadata.tables[target].to_metadata(private)
                pending.append(target)

    private.create_all(bind=engine)

    session = sessionmaker(bind=engine)()

    reader = User(
        id=1,
        email="reader@example.test",
        hashed_password="x",
        is_active=True,
    )
    session.add(reader)

    category = Category(id=1, user_id=1, name="Umum", type="expense")
    session.add(category)

    first = Account(
        id=1, user_id=1, name="First", account_type="bank",
        balance=1000000, currency="IDR",
    )
    second = Account(
        id=2, user_id=1, name="Second", account_type="bank",
        balance=500000, currency="IDR",
    )
    session.add_all([first, second])

    today = date.today()
    # An expense inside the last thirty days, and one outside it but
    # inside the last three months. The two are what tells the two
    # periods apart.
    session.add(Transaction(
        id=1, user_id=1, account_id=1, category_id=1,
        type="expense", amount=10000,
        description="recent", date=today - timedelta(days=5),
        status="approved", is_deleted=False,
    ))
    session.add(Transaction(
        id=2, user_id=1, account_id=1, category_id=1,
        type="expense", amount=20000,
        description="older", date=today - timedelta(days=60),
        status="approved", is_deleted=False,
    ))
    session.add(Transaction(
        id=3, user_id=1, account_id=2, category_id=1,
        type="expense", amount=30000,
        description="other account", date=today - timedelta(days=5),
        status="approved", is_deleted=False,
    ))
    session.commit()
    yield session
    session.close()


class _TheReader:
    """Whoever is signed in while the test runs."""

    id = 1
    email = "reader@example.test"
    is_active = True


def _summary(db, **params):
    """Ask the summary endpoint for its figures."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.routes import dashboard as dashboard_route
    from app.core.security import get_current_user

    app = FastAPI()
    app.include_router(dashboard_route.router, prefix="/api/dashboard")
    app.dependency_overrides[get_db] = lambda: db
    # The endpoint needs a reader. A request without one is refused,
    # which is the point of the other test.
    app.dependency_overrides[get_current_user] = lambda: _TheReader()

    client = TestClient(app)
    response = client.get("/api/dashboard/summary", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_the_summary_covers_the_period_that_was_asked_for(db):
    """Three months, not thirty days."""
    body = _summary(db, start_date=str(date.today() - timedelta(days=90)),
                    end_date=str(date.today()))

    # Three expenses: 10000 from five days ago, 20000 from sixty
    # days ago, and 30000 from five days ago in the other account.
    # All three are inside three months.
    assert body["totalExpense"] == 60000


def test_the_summary_covers_only_the_period_that_was_asked_for(db):
    """One month, so the older expense is not counted."""
    body = _summary(db, start_date=str(date.today() - timedelta(days=30)),
                    end_date=str(date.today()))

    # The 20000 from sixty days ago is outside a month, so it is not
    # counted: 10000 + 30000.
    assert body["totalExpense"] == 40000


def test_the_summary_can_be_narrowed_to_one_account(db):
    """Choosing an account narrows the totals as well as the chart."""
    body = _summary(db,
                    start_date=str(date.today() - timedelta(days=90)),
                    end_date=str(date.today()),
                    account_id=1)

    # Account 1 holds the expenses of 10000 and 20000. The 30000 is in
    # the other account and is not in this one.
    assert body["totalExpense"] == 30000


def test_the_summary_says_which_period_it_covered(db):
    """The period is in the answer, so the page can show it."""
    start = str(date.today() - timedelta(days=90))
    end = str(date.today())
    body = _summary(db, start_date=start, end_date=end)

    assert body["period"]["start"] == start
    assert body["period"]["end"] == end
