"""
Each budget card spends only its own category.

The bug read as this: on /budgets every card - Kebutuhan Pokok,
Transportasi, Tagihan, Kesehatan - showed the exact same "Terpakai:
Rp 77.000", which was the reader's *total* monthly spending across
every category. It happened because a budget whose category did not
match fell back to summing all expenses.

The rule these tests pin down:

  - A budget spends only the transactions in its own category (and its
    sub-categories).
  - A budget whose category has no transactions this month spends
    nothing - Rp 0 - and never the reader's whole monthly outgoings.
  - A budget saved with no category_id but a name that matches a
    category ("Makanan & Minuman Budget") measures that category.

Synthetic fixtures only. No real account, no real person, no real money.
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

from app.api.routes.budgets import router
from app.core.database import Base, get_db
from app.core.security import get_current_user, get_current_user_optional
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.debt import Debt  # noqa: F401
from app.models.goal import Goal  # noqa: F401
from app.models.net_worth import NetWorthSnapshot  # noqa: F401
from app.models.receipt import ReceiptScan  # noqa: F401
from app.models.recurring import RecurringRule  # noqa: F401
from app.models.transaction import Transaction
from app.models.user import User  # noqa: F401
from app.models.user_settings import UserSettings  # noqa: F401
from app.services.metrics import budget_spent

import app.models  # noqa: F401

USER_ID = 1
TODAY = date.today()
MONTH_START = TODAY.replace(day=1)


class FakeUser:
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
    app.include_router(router, prefix="/api/budgets")

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_optional] = lambda: FakeUser()
    app.dependency_overrides[get_current_user] = lambda: FakeUser()

    try:
        with TestClient(app) as test_client:
            yield test_client, session
    finally:
        session.close()
        engine.dispose()


def _account(session):
    account = Account(
        user_id=USER_ID,
        name="Dompet",
        balance=Decimal("1000000"),
        currency="IDR",
        account_type="cash",
        is_active=True,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def _category(session, name, parent_id=None):
    cat = Category(user_id=USER_ID, name=name, type="expense", parent_id=parent_id)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


def _budget(session, name, amount, category_id=None):
    budget = Budget(
        user_id=USER_ID,
        name=name,
        amount=Decimal(str(amount)),
        currency="IDR",
        period="monthly",
        start_date=MONTH_START,
        category_id=category_id,
        is_active=True,
    )
    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


def _expense(session, account_id, amount, category_id=None, day=None):
    session.add(Transaction(
        user_id=USER_ID,
        account_id=account_id,
        category_id=category_id,
        type="expense",
        amount=Decimal(str(amount)),
        currency="IDR",
        date=day or TODAY,
        description="belanja",
        status="approved",
        is_deleted=False,
    ))
    session.commit()


def test_each_budget_only_counts_its_own_category(client):
    """
    The production scene exactly: food has spending, the other three
    categories have none. Only the food budget shows it; the rest are
    at Rp 0, not at the Rp 77.000 total.
    """
    _test_client, session = client
    account = _account(session)

    food = _category(session, "Kebutuhan Pokok")
    transport = _category(session, "Transportasi")
    bills = _category(session, "Tagihan & Utilitas")
    health = _category(session, "Kesehatan")

    # 12.000 + 10.000 + 30.000 + 25.000 = 77.000, all food.
    for amount in (12000, 10000, 30000, 25000):
        _expense(session, account.id, amount, category_id=food.id)

    b_food = _budget(session, "Kebutuhan Pokok", 600000, category_id=food.id)
    b_transport = _budget(session, "Transportasi", 600000, category_id=transport.id)
    b_bills = _budget(session, "Tagihan & Utilitas", 600000, category_id=bills.id)
    b_health = _budget(session, "Kesehatan", 600000, category_id=health.id)

    assert budget_spent(session, b_food) == pytest.approx(77000)
    assert budget_spent(session, b_transport) == pytest.approx(0)
    assert budget_spent(session, b_bills) == pytest.approx(0)
    assert budget_spent(session, b_health) == pytest.approx(0)


def test_list_endpoint_reports_per_category_spend(client):
    """The HTTP list carries the same per-category figure, not the total."""
    test_client, session = client
    account = _account(session)

    food = _category(session, "Kebutuhan Pokok")
    health = _category(session, "Kesehatan")
    for amount in (12000, 10000, 30000, 25000):
        _expense(session, account.id, amount, category_id=food.id)

    _budget(session, "Kebutuhan Pokok", 600000, category_id=food.id)
    _budget(session, "Kesehatan", 600000, category_id=health.id)

    response = test_client.get("/api/budgets/")
    assert response.status_code == 200
    by_name = {b["name"]: b for b in response.json()}

    assert float(by_name["Kebutuhan Pokok"]["spent"]) == pytest.approx(77000)
    assert float(by_name["Kebutuhan Pokok"]["remaining"]) == pytest.approx(523000)
    assert float(by_name["Kesehatan"]["spent"]) == pytest.approx(0)
    assert float(by_name["Kesehatan"]["remaining"]) == pytest.approx(600000)


def test_a_budget_with_no_matching_category_spends_nothing(client):
    """
    A budget that matches no category must not inherit the total spend.
    This is the regression guard against the Rp 77.000-on-every-card bug.
    """
    _test_client, session = client
    account = _account(session)

    food = _category(session, "Kebutuhan Pokok")
    for amount in (12000, 10000, 30000, 25000):
        _expense(session, account.id, amount, category_id=food.id)

    orphan = _budget(session, "Tanpa Kategori Khusus", 600000, category_id=None)
    assert budget_spent(session, orphan) == pytest.approx(0)


def test_a_budget_counts_its_sub_categories(client):
    """A parent-category budget also counts spending in its children."""
    _test_client, session = client
    account = _account(session)

    food = _category(session, "Makanan & Minuman")
    coffee = _category(session, "Kopi & Kafe", parent_id=food.id)

    _expense(session, account.id, 40000, category_id=food.id)
    _expense(session, account.id, 18000, category_id=coffee.id)

    b_food = _budget(session, "Makanan & Minuman", 600000, category_id=food.id)
    assert budget_spent(session, b_food) == pytest.approx(58000)


def test_a_budget_matched_by_name_measures_that_category(client):
    """
    A budget saved with no category_id but a name that names a category
    still measures that category - not the whole month.
    """
    _test_client, session = client
    account = _account(session)

    food = _category(session, "Makanan & Minuman")
    transport = _category(session, "Transportasi")
    _expense(session, account.id, 50000, category_id=food.id)
    _expense(session, account.id, 20000, category_id=transport.id)

    # No category_id; the name carries the category.
    by_name = _budget(session, "Makanan & Minuman Budget", 600000, category_id=None)
    assert budget_spent(session, by_name) == pytest.approx(50000)


def test_spending_outside_the_period_is_not_counted(client):
    """Only spending on or after the budget's start date counts."""
    _test_client, session = client
    account = _account(session)

    food = _category(session, "Kebutuhan Pokok")
    # A month before the budget period.
    last_month = (MONTH_START - __import__("datetime").timedelta(days=5))
    _expense(session, account.id, 99000, category_id=food.id, day=last_month)
    _expense(session, account.id, 12000, category_id=food.id)

    b_food = _budget(session, "Kebutuhan Pokok", 600000, category_id=food.id)
    assert budget_spent(session, b_food) == pytest.approx(12000)
