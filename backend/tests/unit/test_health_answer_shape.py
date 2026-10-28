"""
The health answer says what the frontend needs to read.

The analytics page shows the same four numbers twice: a strip at the
top of the page and a card further down. The two read them from two
different places in the answer, and only one of those places was where
the numbers actually were, so the page contradicted itself: the strip
said the balance was zero while the card said it was the real amount.

These tests check the shape of the answer, so the two readings cannot
drift apart again. The names the frontend reads are written down here.

Synthetic fixtures only. No real account, no real person, no real
money.
"""

import inspect
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.api.routes import analytics as analytics_route


# ---------------------------------------------------------------------------
# The names the frontend reads
# ---------------------------------------------------------------------------

# The four numbers the analytics page shows in the strip and in the
# card. They are all under `metrics`, because that is where the server
# puts them.
METRIC_NAMES = (
    "total_balance",
    "saving_rate",
    "total_debt",
    "active_goals",
)


def test_the_health_route_puts_its_metrics_under_one_key():
    """The numbers are under `metrics`, and only there."""
    source = inspect.getsource(analytics_route.get_financial_health)
    # There is exactly one place that writes the metrics block.
    assert '"metrics": {' in source, "the health answer has no metrics block"
    # The four names are written inside it.
    for name in METRIC_NAMES:
        assert f'"{name}"' in source, f"{name} is not in the health answer"


def test_the_health_answer_carries_the_transaction_count():
    """
    The frontend needs to know how much the reader has recorded.

    A score of zero out of one transaction is not a verdict, it is a
    measurement that could not be made. The frontend cannot tell that
    apart from a bad score without knowing the count.
    """
    source = inspect.getsource(analytics_route.get_financial_health)
    assert '"transaction_count": metrics_tx_count' in source, (
        "the health answer does not carry the transaction count"
    )


def test_the_transaction_count_comes_from_the_shared_service():
    """
    The count is the one the shared metrics service gives.

    Two counts of the same thing would be two answers, and they would
    eventually differ. The shared service is the one place that counts.
    """
    source = inspect.getsource(analytics_route.get_financial_health)
    assert "metrics_transaction_count(db, user_id)" in source, (
        "the health answer counts the transactions itself"
    )

    # And that name is the shared service's function, not a local one.
    from app.services.metrics import transaction_count

    assert callable(transaction_count)


def test_the_shared_count_and_the_route_count_agree():
    """
    The two counts are the same number.

    The route asks the shared service, so this holds by construction.
    It is written down anyway, because the day someone counts the
    transactions in the route instead, this is what catches it.
    """
    from app.services import metrics

    assert (
        analytics_route.metrics_transaction_count is metrics.transaction_count
    ), "the route is not using the shared transaction count"


# ---------------------------------------------------------------------------
# The count itself
# ---------------------------------------------------------------------------


@pytest.fixture()
def db():
    """A fresh in-memory database with the tables the count reads."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.core.database import Base
    from app.models.transaction import Transaction  # noqa: F401
    from app.models.user import User  # noqa: F401

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        engine,
        tables=[
            t
            for t in Base.metadata.sorted_tables
            if t.name in {"users", "accounts", "transactions"}
        ],
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _make_user(session, email="count@example.test"):
    from app.models.user import User

    user = User(
        email=email,
        hashed_password="not-a-real-password",
        full_name="Count Example",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _make_account(session, user):
    """A transaction belongs to an account, so one is made here."""
    from app.models.account import Account

    account = Account(
        user_id=user.id,
        name="Synthetic Account",
        account_type="checking",
        balance=0,
        currency="IDR",
        is_active=True,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def _make_transaction(session, user, **kwargs):
    from datetime import date

    from app.models.transaction import Transaction

    account = _make_account(session, user)
    fields = {
        "user_id": user.id,
        "account_id": account.id,
        "type": "expense",
        "amount": 10000,
        "description": "A synthetic purchase",
        "date": date(2026, 3, 15),
        "category_id": None,
        "is_deleted": False,
        "status": "approved",
    }
    fields.update(kwargs)
    transaction = Transaction(**fields)
    session.add(transaction)
    session.commit()
    return transaction


def test_the_count_is_zero_for_a_reader_with_nothing(db):
    from app.services.metrics import transaction_count

    user = _make_user(db)
    assert transaction_count(db, user.id) == 0


def test_the_count_counts_every_transaction(db):
    from app.services.metrics import transaction_count

    user = _make_user(db)
    for _ in range(3):
        _make_transaction(db, user)
    assert transaction_count(db, user.id) == 3


def test_a_deleted_transaction_does_not_count(db):
    """A transaction the reader threw away is not one they recorded."""
    from app.services.metrics import transaction_count

    user = _make_user(db)
    _make_transaction(db, user)
    _make_transaction(db, user, is_deleted=True)
    assert transaction_count(db, user.id) == 1


def test_the_count_is_about_this_reader_only(db):
    """One reader's transactions are not another's."""
    from app.services.metrics import transaction_count

    user = _make_user(db)
    other = _make_user(db, email="other@example.test")
    _make_transaction(db, user)
    _make_transaction(db, other)
    _make_transaction(db, other)
    assert transaction_count(db, user.id) == 1
    assert transaction_count(db, other.id) == 2
