"""
The dates the reader chose are the dates that are answered about.

The analytics page and the export screen both let the reader choose a
range of dates. These checks hold that the range is really applied -
against a real database, with transactions inside and outside it.

Nothing here touches the production server or a real database.
"""

import sys
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import export_service, metrics  # noqa: E402


@pytest.fixture()
def db():
    from app.core.database import Base
    import app.models  # noqa: F401
    from app.models.account import Account
    from app.models.category import Category
    from app.models.transaction import Transaction
    from app.models.user import User

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    wanted = (
        "users", "accounts", "categories", "transactions", "transfers",
        "recurring_rules", "receipt_scans", "merchants",
        "transaction_items", "breakdown_items",
    )
    Base.metadata.create_all(
        bind=engine,
        tables=[t for name, t in Base.metadata.tables.items() if name in wanted],
    )
    session = sessionmaker(bind=engine)()

    session.add(User(id=1, email="reader@example.com", hashed_password="x"))
    session.add(User(id=2, email="other@example.com", hashed_password="x"))
    session.add(Account(id=1, user_id=1, name="BCA", account_type="bank", balance=0, currency="IDR"))
    session.add(Account(id=2, user_id=1, name="GoPay", account_type="ewallet", balance=0, currency="IDR"))
    session.add(Account(id=3, user_id=2, name="Lain", account_type="bank", balance=0, currency="IDR"))
    session.add(Category(id=1, name="Gaji", type="income"))
    session.add(Category(id=6, name="Makanan & Minuman", type="expense"))

    def tx(id, user, account, kind, amount, day, category):
        session.add(Transaction(
            id=id, user_id=user, account_id=account, type=kind,
            amount=amount, date=day, category_id=category,
            description=f"tx {id}",
        ))

    tx(1, 1, 1, "expense", 20000, date(2026, 10, 5), 6)
    tx(2, 1, 1, "expense", 30000, date(2026, 10, 5), 6)
    tx(3, 1, 2, "expense", 75000, date(2026, 10, 20), 6)
    tx(4, 1, 1, "income", 5000000, date(2026, 10, 1), 1)
    tx(5, 1, 1, "expense", 99000, date(2026, 11, 2), 6)
    tx(6, 2, 3, "expense", 1000000, date(2026, 10, 5), 6)
    session.commit()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


OCT = (date(2026, 10, 1), date(2026, 10, 31))


def test_the_calendar_has_one_row_per_day_with_spending(db):
    days = metrics.daily_spending(db, 1, *OCT)

    assert [d["date"] for d in days] == ["2026-10-05", "2026-10-20"]
    assert days[0]["total"] == 50000
    assert days[0]["count"] == 2
    assert days[1]["total"] == 75000


def test_the_calendar_leaves_out_the_days_outside_the_range(db):
    days = metrics.daily_spending(db, 1, *OCT)
    assert "2026-11-02" not in [d["date"] for d in days]


def test_the_calendar_is_the_readers_own(db):
    """Another reader's million is not on this reader's calendar."""
    days = metrics.daily_spending(db, 1, *OCT)
    assert sum(d["total"] for d in days) == 125000


def test_the_calendar_counts_spending_and_not_income(db):
    days = metrics.daily_spending(db, 1, *OCT)
    assert "2026-10-01" not in [d["date"] for d in days]


def test_the_export_is_narrowed_by_the_dates(db):
    rows = metrics.transactions_in_range(db, 1, start_date=OCT[0], end_date=OCT[1])
    assert sorted(t.id for t in rows) == [1, 2, 3, 4]


def test_the_export_is_narrowed_by_the_kind(db):
    rows = metrics.transactions_in_range(
        db, 1, start_date=OCT[0], end_date=OCT[1], types=["income"]
    )
    assert [t.id for t in rows] == [4]


def test_the_export_is_narrowed_by_the_account(db):
    rows = metrics.transactions_in_range(db, 1, account_id=2)
    assert [t.id for t in rows] == [3]


def test_the_filters_are_applied_together(db):
    rows = metrics.transactions_in_range(
        db, 1, start_date=OCT[0], end_date=OCT[1],
        types=["expense"], account_id=1,
    )
    assert sorted(t.id for t in rows) == [1, 2]


def test_no_filters_means_everything_of_the_readers_own(db):
    rows = metrics.transactions_in_range(db, 1)
    assert sorted(t.id for t in rows) == [1, 2, 3, 4, 5]


def test_the_export_payload_counts_what_matches(db):
    payload = export_service.export_payload(
        db, 1, start_date=OCT[0], end_date=OCT[1], types=["expense"],
        columns=["date", "amount", "account"],
    )

    assert payload["count"] == 3
    assert payload["total"] == 125000
    assert payload["columns"] == ["date", "amount", "account"]
    assert set(payload["rows"][0].keys()) == {"date", "amount", "account"}


def test_the_total_does_not_depend_on_the_columns(db):
    """Turning the "type" column off must not turn the total to zero."""
    payload = export_service.export_payload(
        db, 1, start_date=OCT[0], end_date=OCT[1], columns=["date"],
    )
    assert payload["total"] == 125000
    assert payload["total_income"] == 5000000


# ---------------------------------------------------------------------------
# Over HTTP, the way the browser asks
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(db):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.routes import analytics, data
    from app.core.database import get_db
    from app.core.security import get_current_user

    class _Reader:
        id = 1
        default_currency = "IDR"

    application = FastAPI()
    application.include_router(data.router, prefix="/api/data")
    application.include_router(analytics.router, prefix="/api/analytics")
    application.dependency_overrides[get_db] = lambda: db
    application.dependency_overrides[get_current_user] = lambda: _Reader()
    return TestClient(application, raise_server_exceptions=False)


def test_the_daily_spending_route_answers_for_the_range(client):
    response = client.get(
        "/api/analytics/spending/daily",
        params={"start_date": "2026-10-01", "end_date": "2026-10-31"},
    )
    assert response.status_code == 200, response.text[:300]
    body = response.json()
    assert [d["date"] for d in body["days"]] == ["2026-10-05", "2026-10-20"]
    assert body["max_total"] == 75000


def test_the_daily_spending_route_answers_with_no_dates(client):
    response = client.get("/api/analytics/spending/daily")
    assert response.status_code == 200, response.text[:300]


def test_a_date_that_is_not_a_date_is_an_empty_answer_and_not_an_error(client):
    response = client.get(
        "/api/analytics/spending/daily", params={"start_date": "kemarin"}
    )
    assert response.status_code == 200, response.text[:300]
    assert response.json()["days"] == []


def test_the_preview_route_says_what_matches(client):
    response = client.get(
        "/api/data/export/studio",
        params={
            "start_date": "2026-10-01", "end_date": "2026-10-31",
            "types": "expense", "columns": "date,amount",
        },
    )
    assert response.status_code == 200, response.text[:300]
    body = response.json()
    assert body["count"] == 3
    assert body["total"] == 125000
    assert body["columns"] == ["date", "amount"]
    assert len(body["preview"]) == 3


def test_the_csv_route_sends_a_file_with_the_mark(client):
    response = client.get(
        "/api/data/export/studio/csv",
        params={"start_date": "2026-10-01", "end_date": "2026-10-31"},
    )
    assert response.status_code == 200, response.text[:300]
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert "attachment" in response.headers["content-disposition"]
    assert "2026-10-01" in response.headers["content-disposition"]
    # The heading and the four rows of October.
    assert len(response.content.decode("utf-8-sig").strip().split("\n")) == 5


def test_the_json_route_sends_the_rows(client):
    response = client.get(
        "/api/data/export/studio/json", params={"account_id": 2}
    )
    assert response.status_code == 200, response.text[:300]
    body = response.json()
    assert body["count"] == 1
    assert body["transactions"][0]["account"] == "GoPay"
