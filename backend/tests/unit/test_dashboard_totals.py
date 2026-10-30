"""
The dashboard totals, over HTTP.

The Dashboard shows four numbers: the balance, the money in, the money
out and the cash flow. The balance is the sum of the account balances,
which is a column that is written when a transaction is made. The other
three are worked out from the transaction rows themselves.

That is the whole problem this file is about. The balance comes from one
place and the totals come from another, so a row that the totals do not
count is a row the reader cannot see anywhere - but the money is still
in the balance. The Dashboard then shows a balance of five million
rupiah and an income, an expense and a cash flow of zero.

Which rows the totals leave out is decided by `counted_transactions_filter`.
A pending transaction is waiting in the review queue and a rejected one
was thrown away, so neither has moved the balance and neither may be
counted. Everything else counts - including a row whose `status` was
never filled in at all, and a row whose `is_deleted` was never filled in
at all. Those are the rows an older database, a data import or a direct
write leaves behind.

The filter has to say that in SQL. `status IN ('approved', NULL, '')`
does not say it: in SQL, `NULL IN (...)` is never true, and a list that
holds a `NULL` is never true for anything. So a row with no status is
silently left out, even though the code meant to count it.

These tests use synthetic fixtures only. No real account, no real
person, no real money.
"""

import os
import sys
from datetime import date
from decimal import Decimal

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB, TSVECTOR, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.dashboard import router
from app.core.database import Base, get_db
from app.core.security import get_current_user_optional
from app.models.account import Account
from app.models.budget import Budget  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.debt import Debt  # noqa: F401
from app.models.goal import Goal  # noqa: F401
from app.models.net_worth import NetWorthSnapshot  # noqa: F401
from app.models.receipt import ReceiptScan  # noqa: F401
from app.models.recurring import RecurringRule  # noqa: F401
from app.models.transaction import Transaction
from app.models.user import User  # noqa: F401
from app.models.user_settings import UserSettings  # noqa: F401

import app.models  # noqa: F401, E402

USER_ID = 1


class FakeUser:
    """The reader. Only the fields the routes look at."""

    id = USER_ID
    default_currency = "IDR"
    email = "reader@example.invalid"
    full_name = None
    username = None
    is_active = True
    created_at = None
    last_login = None
    preferences = {}


@pytest.fixture()
def client():
    """
    A client over a database of the reader's own.

    The in-memory database is held in one connection, so the tables
    the test creates are the tables the request reads. Without that,
    the request gets a fresh empty database and the answer is "no such
    table".
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @compiles(JSONB, "sqlite")
    def _jsonb_as_text(element, compiler, **kw):
        return "TEXT"

    @compiles(ARRAY, "sqlite")
    def _array_as_text(element, compiler, **kw):
        return "TEXT"

    @compiles(INET, "sqlite")
    def _inet_as_text(element, compiler, **kw):
        return "TEXT"

    @compiles(UUID, "sqlite")
    def _uuid_as_text(element, compiler, **kw):
        return "TEXT"

    @compiles(TSVECTOR, "sqlite")
    def _tsvector_as_text(element, compiler, **kw):
        return "TEXT"

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    app = FastAPI()
    app.include_router(router, prefix="/api/dashboard")

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_optional] = lambda: FakeUser()

    try:
        with TestClient(app) as test_client:
            yield test_client, session
    finally:
        session.close()
        engine.dispose()


def _seed_account(session, balance="5955999"):
    account = Account(
        user_id=USER_ID,
        name="BCA",
        balance=Decimal(balance),
        currency="IDR",
        account_type="bank",
        is_active=True,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def _seed_transaction(
    session,
    account_id,
    amount,
    tx_type="expense",
    day=None,
    status="approved",
    is_deleted=False,
    description="a transaction",
):
    session.add(Transaction(
        user_id=USER_ID,
        account_id=account_id,
        type=tx_type,
        amount=Decimal(str(amount)),
        currency="IDR",
        date=day or date.today(),
        description=description,
        status=status,
        is_deleted=is_deleted,
    ))
    session.commit()


def _seed_row_without_a_status(session, account_id, amount, day=None, tx_type="expense"):
    """
    A row whose `status` and `is_deleted` were never filled in.

    This is what an older database, a data import or a direct write
    leaves behind. It is written with raw SQL on purpose: the ORM would
    fill in the defaults, and the point of the test is the row that the
    ORM never made.
    """
    from sqlalchemy import text

    session.execute(text("""
        INSERT INTO transactions
            (user_id, type, amount, currency, date, description, account_id,
             status, is_deleted, is_draft)
        VALUES
            (:user_id, :type, :amount, 'IDR', :date, :description, :account_id,
             NULL, NULL, false)
    """), {
        "user_id": USER_ID,
        "type": tx_type,
        "amount": amount,
        "date": day or date.today(),
        "description": "a transaction with no status",
        "account_id": account_id,
    })
    session.commit()


def test_the_totals_count_a_row_that_has_no_status(client):
    """
    A row with no status is a row that counts.

    The balance is 5,955,999 rupiah and there are expenses against it.
    The Dashboard shows the balance, so it has to show the expenses too:
    a reader who sees money in the account and zero spending wonders
    what happened to the money.
    """
    test_client, session = client
    account = _seed_account(session)
    _seed_row_without_a_status(session, account.id, 150000)

    response = test_client.get("/api/dashboard/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["totalExpense"] == pytest.approx(150000)
    assert body["netSavings"] == pytest.approx(-150000)


def test_the_totals_count_a_row_that_has_no_status_in_the_cash_flow(client):
    """
    The chart is made of the same rows as the cards.

    The cash flow endpoint answers with a point for every week in the
    window. A row that has no status has to land in one of them, or the
    chart is empty while the money is there.
    """
    test_client, session = client
    account = _seed_account(session)
    _seed_row_without_a_status(session, account.id, 150000)

    response = test_client.get("/api/dashboard/cash-flow?timeframe=1M")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["totalExpense"] == pytest.approx(150000)
    assert body["series"], "the chart has no points at all"
    assert any(point["totalExpense"] > 0 for point in body["series"])


def test_the_totals_count_a_row_whose_status_is_empty(client):
    """An empty status counts too. It is what an older row carries."""
    test_client, session = client
    account = _seed_account(session)
    _seed_transaction(session, account.id, 150000, status="")

    response = test_client.get("/api/dashboard/summary")

    assert response.status_code == 200
    assert response.json()["totalExpense"] == pytest.approx(150000)


def test_a_pending_transaction_is_not_counted(client):
    """
    A pending transaction is waiting in the review queue.

    It has not moved the balance, so it must not move the totals either.
    """
    test_client, session = client
    account = _seed_account(session)
    _seed_transaction(session, account.id, 150000, status="pending")

    response = test_client.get("/api/dashboard/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["totalExpense"] == pytest.approx(0)
    assert body["totalIncome"] == pytest.approx(0)


def test_a_rejected_transaction_is_not_counted(client):
    """A rejected transaction was thrown away, so it counts for nothing."""
    test_client, session = client
    account = _seed_account(session)
    _seed_transaction(session, account.id, 150000, status="rejected")

    response = test_client.get("/api/dashboard/summary")

    assert response.status_code == 200
    assert response.json()["totalExpense"] == pytest.approx(0)


def test_a_deleted_transaction_is_not_counted(client):
    """A soft-deleted row is a row that is not there any more."""
    test_client, session = client
    account = _seed_account(session)
    _seed_transaction(session, account.id, 150000, is_deleted=True)

    response = test_client.get("/api/dashboard/summary")

    assert response.status_code == 200
    assert response.json()["totalExpense"] == pytest.approx(0)


def test_the_income_and_the_expense_are_both_counted(client):
    """
    Money in and money out are both money.

    The Dashboard shows a card for each. A row that has no status has
    to land in the right one of the two.
    """
    test_client, session = client
    account = _seed_account(session)
    _seed_row_without_a_status(session, account.id, 2_000_000, tx_type="income")
    _seed_row_without_a_status(session, account.id, 500_000, tx_type="expense")

    response = test_client.get("/api/dashboard/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["totalIncome"] == pytest.approx(2_000_000)
    assert body["totalExpense"] == pytest.approx(500_000)
    assert body["netSavings"] == pytest.approx(1_500_000)


def test_the_balance_and_the_totals_agree_with_each_other(client):
    """
    The balance and the totals are read from two different places.

    The balance is the sum of the account balances. The totals are the
    sum of the transaction rows. When a row is missing from one of them
    the Dashboard contradicts itself, so this checks the two against
    each other with a reader who has money in and money out.
    """
    test_client, session = client
    account = _seed_account(session, balance="5_955_999")
    _seed_row_without_a_status(session, account.id, 1_500_000, tx_type="income")
    _seed_row_without_a_status(session, account.id, 200_000, tx_type="expense")

    response = test_client.get("/api/dashboard/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["total_balance"] == pytest.approx(5_955_999)
    assert body["totalIncome"] == pytest.approx(1_500_000)
    assert body["totalExpense"] == pytest.approx(200_000)
    assert body["net_cash_flow"] == pytest.approx(1_300_000)
