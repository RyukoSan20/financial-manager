"""
The agent has to write before it says it wrote.

The bar at the top of the dashboard asks the agent what a line of
Indonesian means. When the line means "record this", the agent
records it and then says so.

It used to do it the other way round. The answer was built from a
prompt, and the prompt was allowed to say "sudah saya catat" - "I
have recorded it" - whether or not anything was written. A reader
was told their lunch was in the ledger, and the ledger did not have
it in it. The row of money on the dashboard did not move. The
balance did not move. And the reader had no way of telling the
difference between a transaction that was saved and one that was
only claimed.

So the order is now fixed. The row is written, the account is moved,
the commit happens, and only then is the answer built - and the
answer carries the id of the row that was written, so the bar can
point at it.

The other half of the fault was quieter. The answer could carry one
result or several, and it was typed as one. The path that works out
several answers handed it a list, and the answer was a validation
error - a 500 - on exactly the request that had understood the
reader best.

These checks hold both halves shut:

- the request answers with 200;
- a row is really in the table, with the right amount and description;
- the account balance really moved;
- the answer says what was written, and names the row.

Nothing here touches the production server or a real database.
"""

import sys
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api.routes import ai_advisor  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.core.security import get_current_user  # noqa: E402
from app.models.transaction import Transaction  # noqa: E402


class _User:
    """The reader whose money the agent is about to move."""

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
    """A reader with one account and a category to spend from."""
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
        balance=1000000.0,
        currency="IDR",
    ))
    session.add(Category(
        id=6, name="Makanan & Minuman", type="expense", system_key="food_drink"
    ))
    session.commit()
    return session


@pytest.fixture()
def client(session):
    """The application, with the agent route mounted."""
    application = FastAPI()
    application.include_router(ai_advisor.router, prefix="/api/ai")

    application.dependency_overrides[get_db] = lambda: session
    application.dependency_overrides[get_current_user] = lambda: _User()

    return TestClient(application)


def test_recording_a_transaction_answers_200(client, reader):
    """The request that records something answers with 200.

    It used to answer with a 500, because the answer carried a list
    of results in a field that held one.
    """
    response = client.post(
        "/api/ai/agent",
        json={
            "message": "catat pengeluaran Rp45.000 untuk Indomie Goreng di Warteg Mba Sari"
        },
    )

    assert response.status_code == 200, (
        "the agent answered with %r: %s" % (response.status_code, response.text[:400])
    )

    body = response.json()
    assert body["success"] is True, "the agent did not do what was asked: %r" % body
    assert body["intent"] == "add_transaction", "the intent was not understood: %r" % body


def test_the_row_is_really_in_the_table(client, reader):
    """The transaction is written, not claimed.

    This is the whole point. The reader was told "sudah saya catat"
    and nothing was in the ledger. The row has to be there.
    """
    response = client.post(
        "/api/ai/agent",
        json={
            "message": "catat pengeluaran Rp45.000 untuk Indomie Goreng di Warteg Mba Sari"
        },
    )
    assert response.status_code == 200, response.text[:400]

    rows = (
        reader.query(Transaction)
        .filter(Transaction.user_id == 1)
        .all()
    )

    assert len(rows) == 1, "the transaction was not written: %r" % rows

    row = rows[0]
    assert float(row.amount) == 45000.0, (
        "the wrong amount was written: %r" % row.amount
    )
    assert "indomie goreng" in (row.description or "").lower(), (
        "the wrong description was written: %r" % row.description
    )
    assert row.type == "expense", "the wrong direction was written: %r" % row.type
    assert row.account_id == 1, "the wrong account was used: %r" % row.account_id


def test_the_account_balance_moved(client, reader):
    """The money left the account."""
    from app.models.account import Account

    before = reader.query(Account).filter(Account.id == 1).one().balance
    assert float(before) == 1000000.0

    response = client.post(
        "/api/ai/agent",
        json={
            "message": "catat pengeluaran Rp45.000 untuk Indomie Goreng di Warteg Mba Sari"
        },
    )
    assert response.status_code == 200, response.text[:400]

    after = reader.query(Account).filter(Account.id == 1).one().balance
    assert float(after) == 955000.0, (
        "the balance did not move by the right amount: %r" % after
    )


def test_the_answer_says_what_was_written(client, reader):
    """The answer carries the row, so the bar can point at it.

    The reply is the sentence the reader reads. The transaction is
    the thing they can go and look at. The answer carries both, and
    the id is the proof that the row is real.
    """
    response = client.post(
        "/api/ai/agent",
        json={
            "message": "catat pengeluaran Rp45.000 untuk Indomie Goreng di Warteg Mba Sari"
        },
    )
    assert response.status_code == 200, response.text[:400]

    body = response.json()

    assert body.get("action_executed") == "transaction_created", (
        "the answer does not say what was written: %r" % body
    )

    written = body.get("transaction")
    assert written, "the answer carries no transaction: %r" % body
    assert written.get("id"), "the written transaction has no id: %r" % written
    assert float(written.get("amount")) == 45000.0, (
        "the written transaction has the wrong amount: %r" % written
    )

    # And the id is the id of the row that is really there.
    real = reader.query(Transaction).filter(Transaction.id == written["id"]).one()
    assert float(real.amount) == 45000.0


def test_the_answer_carries_the_new_figures(client, reader):
    """The balance in the answer is the balance after the writing.

    A reply that says "Sisa Saldo: Rp5.920.000" when the account
    holds something else is the exact failure that was reported.
    """
    response = client.post(
        "/api/ai/agent",
        json={
            "message": "catat pengeluaran Rp45.000 untuk Indomie Goreng di Warteg Mba Sari"
        },
    )
    assert response.status_code == 200, response.text[:400]

    body = response.json()
    metrics = body.get("updated_metrics")
    assert metrics, "the answer carries no updated figures: %r" % body
    assert "total_balance" in metrics, (
        "the answer carries no balance: %r" % metrics
    )
    assert float(metrics["total_balance"]) == 955000.0, (
        "the balance in the answer is not the balance: %r" % metrics
    )


def test_a_question_still_answers_200(client, reader):
    """The read path is not broken by the write path.

    The same field carries one result or several, and the read path
    carries one. Both have to answer.
    """
    response = client.post(
        "/api/ai/agent",
        json={"message": "berapa saldo saya?"},
    )
    assert response.status_code == 200, (
        "a question answered with %r: %s" % (response.status_code, response.text[:300])
    )


def test_the_route_is_under_the_path_the_bar_asks_for(client, reader):
    """The bar asks for this exact path."""
    response = client.post("/api/ai/agent", json={"message": "berapa saldo saya?"})
    assert response.status_code == 200
    assert "reply" in response.json()
