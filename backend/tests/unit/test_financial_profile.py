"""
The financial profile, in one answer.

The dashboard shows a card called "Profil Keuangan" - the financial
profile - with nine chapters in it. The first chapter is this month:
what came in, what is left over, and what the next thirty days look
like. The second is the bank accounts. The third is the investments.
And so on, through to the reader's own shop.

Nine chapters could have been nine requests. That would be nine round
trips for one card, nine chances for one of them to be slow, and nine
chances for the card to show a half-filled picture - the first
chapter arrived and the other eight were still in the air.

So there is one request, and it answers all nine.

What is held here:

- the request answers 200, and answers with all nine chapters;
- the chapters carry the reader's own numbers;
- a reader with nothing at all still gets an answer, with zeros
  rather than with a failure - a chapter that has no data says so;
- and one chapter that cannot be read does not take the other eight
  down with it.

Nothing here touches the production server or a real database.
"""

import sys
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api.routes import dashboard  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.core.security import get_current_user  # noqa: E402


class _User:
    """The reader whose money the profile is about."""

    id = 1


@pytest.fixture()
def session():
    """A database of the reader's own."""
    from app.core.database import Base

    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.budget  # noqa: F401
    import app.models.goal  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.debt  # noqa: F401
    import app.models.recurring  # noqa: F401
    import app.models.net_worth  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _add_now(dbapi_connection, _record):
        dbapi_connection.create_function("NOW", 0, lambda: "2026-11-08 00:00:00")

    private = Base.metadata
    wanted = (
        "transactions",
        "accounts",
        "categories",
        "users",
        "budgets",
        "goals",
        "recurring_rules",
        "debts",
        "net_worth_snapshots",
    )
    private.create_all(
        engine,
        tables=[private.tables[name] for name in wanted if name in private.tables],
    )

    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


@pytest.fixture()
def reader(session):
    """A reader with money in three kinds of place."""
    from app.models.account import Account
    from app.models.category import Category
    from app.models.debt import Debt
    from app.models.goal import Goal
    from app.models.transaction import Transaction
    from app.models.user import User

    today = date.today()
    month_start = today.replace(day=1)

    session.add(User(
        id=1,
        email="reader@example.test",
        hashed_password="x",
        full_name="Reader",
    ))
    session.add(Account(
        id=1, user_id=1, name="BCA", account_type="bank",
        account_kind="bank", balance=2500000.0, currency="IDR",
    ))
    session.add(Account(
        id=2, user_id=1, name="Jago", account_type="bank",
        account_kind="digital_bank", balance=750000.0, currency="IDR",
    ))
    session.add(Account(
        id=3, user_id=1, name="GoPay", account_type="e-wallet",
        account_kind="e-wallet", balance=125000.0, currency="IDR",
    ))
    session.add(Account(
        id=4, user_id=1, name="Saham BBCA", account_type="investment",
        account_kind="investment", balance=3000000.0, currency="IDR",
    ))
    session.add(Account(
        id=5, user_id=1, name="Kartu Kredit", account_type="credit_card",
        account_kind="credit_card", balance=-450000.0, currency="IDR",
        is_credit=True, credit_limit=5000000.0,
    ))
    session.add(Category(
        id=1, name="Gaji", type="income", system_key="salary"
    ))
    session.add(Category(
        id=6, name="Makanan & Minuman", type="expense", system_key="food_drink"
    ))
    session.add(Transaction(
        user_id=1, account_id=1, type="income", amount=8000000.0,
        description="Gaji", date=month_start, category_id=1,
    ))
    session.add(Transaction(
        user_id=1, account_id=1, type="expense", amount=450000.0,
        description="Belanja", date=month_start, category_id=6,
    ))
    session.add(Debt(
        id=1, user_id=1, name="Kredit Mobil", debt_type="car_loan",
        principal=20000000.0, current_balance=12000000.0,
        interest_rate=0.10, currency="IDR", tenor_months=24,
        remaining_months=18, monthly_payment=900000.0,
        start_date=today - timedelta(days=180),
        end_date=today + timedelta(days=400),
        next_payment_date=today + timedelta(days=3),
        is_paid_off=False, is_active=True,
    ))
    session.add(Goal(
        id=1, user_id=1, name="Dana Darurat", goal_type="emergency_fund",
        target_amount=10000000.0, current_amount=2000000.0,
        currency="IDR", target_date=today + timedelta(days=20),
        is_completed=False, is_active=True,
    ))
    session.commit()
    return session


@pytest.fixture()
def client(session):
    """The application, with the dashboard route mounted."""
    application = FastAPI()
    application.include_router(dashboard.router, prefix="/api/dashboard")

    application.dependency_overrides[get_db] = lambda: session
    application.dependency_overrides[get_current_user] = lambda: _User()

    return TestClient(application, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# The request
# ---------------------------------------------------------------------------

def test_the_profile_answers_200(client, reader):
    """One request, and it answers."""
    response = client.get("/api/dashboard/financial-profile")
    assert response.status_code == 200, response.text[:400]


def test_the_profile_carries_all_nine_chapters(client, reader):
    """Every chapter is there.

    A chapter that is missing is a chapter the card cannot draw, and
    the reader sees a gap where their own money should be.
    """
    response = client.get("/api/dashboard/financial-profile")
    assert response.status_code == 200, response.text[:400]

    body = response.json()
    chapters = body.get("chapters") or {}

    for key in (
        "month",
        "accounts",
        "portfolio",
        "net_worth",
        "credit",
        "debts",
        "receivables",
        "income",
        "business",
    ):
        assert key in chapters, "the chapter %r is missing: %r" % (key, list(chapters))

    assert "timeline" in chapters, "the timeline is missing"


def test_the_month_chapter_knows_the_figures(client, reader):
    """The first chapter carries this month's numbers."""
    response = client.get("/api/dashboard/financial-profile")
    body = response.json()
    month = body["chapters"]["month"]

    assert month["income"] == 8000000.0, month
    assert month["expense"] == 450000.0, month
    assert month["free_cash"] == 7550000.0, month
    # The instalment is money that is already spoken for.
    assert month["installments"] == 900000.0, month


def test_the_accounts_chapter_groups_the_money(client, reader):
    """The accounts are grouped by the kind of thing they are.

    A reader with a conventional bank, a digital bank and an e-wallet
    has three different kinds of money, and the chapter says so.
    """
    response = client.get("/api/dashboard/financial-profile")
    body = response.json()
    accounts = body["chapters"]["accounts"]

    # The credit card is not money the reader has, and the
    # investments are in their own chapter - counting them here as
    # well would show the reader the same money twice.
    assert accounts["total"] == 3375000.0, accounts

    kinds = {g["kind"] for g in accounts["by_kind"]}
    assert "bank" in kinds, accounts
    assert "digital_bank" in kinds, accounts
    assert "e-wallet" in kinds, accounts
    assert "credit_card" not in kinds, accounts

    assert accounts["top"], "no accounts are shown"


def test_the_portfolio_chapter_knows_the_investments(client, reader):
    """The investments are counted apart from the cash."""
    response = client.get("/api/dashboard/financial-profile")
    body = response.json()
    portfolio = body["chapters"]["portfolio"]

    assert portfolio["total"] == 3000000.0, portfolio
    assert portfolio["count"] == 1, portfolio


def test_the_net_worth_chapter_counts_what_is_owed(client, reader):
    """What the reader has, less what they owe."""
    response = client.get("/api/dashboard/financial-profile")
    body = response.json()
    worth = body["chapters"]["net_worth"]

    # The cash is 3.375 million, the investments 3 million, and the
    # debt is 12 million.
    assert worth["liquid"] == 3375000.0, worth
    assert worth["investments"] == 3000000.0, worth
    assert worth["net_worth"] == -5625000.0, worth


def test_the_credit_chapter_knows_the_limit(client, reader):
    """How much of the limit is used, and how much is left."""
    response = client.get("/api/dashboard/financial-profile")
    body = response.json()
    credit = body["chapters"]["credit"]

    assert credit["used"] == 450000.0, credit
    assert credit["limit"] == 5000000.0, credit
    assert credit["remaining"] == 4550000.0, credit


def test_the_debts_chapter_knows_the_burden(client, reader):
    """What is owed, and how much of the month it takes."""
    response = client.get("/api/dashboard/financial-profile")
    body = response.json()
    debts = body["chapters"]["debts"]

    assert debts["principal"] == 12000000.0, debts
    assert debts["monthly"] == 900000.0, debts
    assert debts["dsr"] is not None, debts
    # The instalment against this month's income.
    assert round(debts["dsr"], 4) == round(900000.0 / 8000000.0, 4), debts
    assert debts["count"] == 1, debts


def test_the_income_chapter_names_the_sources(client, reader):
    """Where the money comes from."""
    response = client.get("/api/dashboard/financial-profile")
    body = response.json()
    income = body["chapters"]["income"]

    assert income["total"] == 8000000.0, income
    assert income["sources"], income
    assert income["sources"][0]["category"] == "Gaji", income


def test_the_timeline_holds_the_next_thirty_days(client, reader):
    """The line of the next thirty days.

    The instalment and the goal both fall inside it, so both are on
    the line, and the line is in order.
    """
    response = client.get("/api/dashboard/financial-profile")
    body = response.json()
    timeline = body["chapters"]["timeline"]

    assert isinstance(timeline, list), timeline

    kinds = {point["kind"] for point in timeline}
    assert "installment" in kinds, timeline
    assert "goal" in kinds, timeline

    # The line runs forward.
    dates = [point["date"] for point in timeline]
    assert dates == sorted(dates), timeline

    # And nothing on it is further away than thirty days ahead or a
    # week behind. The days behind are the reader's own spending, and
    # they are what the line shows a reader who has nothing ahead yet.
    today = date.today()
    for point in timeline:
        when = date.fromisoformat(point["date"])
        assert when <= today + timedelta(days=31), point
        if point["kind"] in ("spent", "earned"):
            assert when >= today - timedelta(days=7), point
        else:
            assert when >= today - timedelta(days=1), point


def test_the_timeline_shows_the_week_behind(client, reader, session):
    """A reader who spent this week sees it on the line.

    Two expenses three days ago become one point of kind `spent`,
    dated that day, carrying their sum; it sits behind today. This is
    the part of the line a reader with nothing ahead yet still has.
    """
    from app.models.transaction import Transaction

    three_days_ago = date.today() - timedelta(days=3)
    session.add(Transaction(
        user_id=1, account_id=1, type="expense", amount=12000.0,
        description="Mie Instan", date=three_days_ago, category_id=6,
    ))
    session.add(Transaction(
        user_id=1, account_id=1, type="expense", amount=25000.0,
        description="Makan Siang", date=three_days_ago, category_id=6,
    ))
    session.commit()

    response = client.get("/api/dashboard/financial-profile")
    timeline = response.json()["chapters"]["timeline"]
    spent = [p for p in timeline if p["kind"] == "spent" and p["date"] == three_days_ago.isoformat()]
    assert len(spent) == 1, timeline
    assert spent[0]["amount"] == 37000.0, spent
    assert "2 transaksi" in spent[0]["label"], spent

    # The month's figures still read the real totals.
    month = response.json()["chapters"]["month"]
    assert month["expense"] == 450000.0 + 37000.0, month


# ---------------------------------------------------------------------------
# The reader who has nothing
# ---------------------------------------------------------------------------

def test_a_reader_with_nothing_still_gets_all_nine_chapters(client, session):
    """An empty ledger is not an error.

    Every chapter comes back with zero in it, and the card draws an
    empty card rather than a broken one.
    """
    from app.models.user import User

    session.add(User(
        id=1, email="empty@example.test", hashed_password="x", full_name="Empty"
    ))
    session.commit()

    response = client.get("/api/dashboard/financial-profile")
    assert response.status_code == 200, response.text[:400]

    body = response.json()
    chapters = body["chapters"]

    for key in (
        "month", "accounts", "portfolio", "net_worth", "credit",
        "debts", "receivables", "income", "business",
    ):
        assert key in chapters, key

    assert chapters["month"]["income"] == 0.0, chapters["month"]
    assert chapters["accounts"]["total"] == 0.0, chapters["accounts"]
    assert chapters["timeline"] == [], chapters["timeline"]


def test_one_broken_chapter_does_not_take_the_others_down(client, reader, monkeypatch):
    """A chapter that cannot be read leaves the others standing.

    The card is one picture of nine things. One of the nine being
    unreadable should cost the reader that one chapter, not the whole
    card.
    """
    import app.services.financial_profile as profile_module

    def _broken(db, user_id):
        raise RuntimeError("that table is not there today")

    monkeypatch.setattr(profile_module, "_chapter_portfolio", _broken)

    response = client.get("/api/dashboard/financial-profile")
    assert response.status_code == 200, response.text[:400]

    body = response.json()
    chapters = body["chapters"]

    assert chapters["portfolio"] == {}, chapters["portfolio"]
    assert chapters["month"]["income"] == 8000000.0, chapters["month"]
    assert chapters["accounts"]["total"] == 3375000.0, chapters["accounts"]
