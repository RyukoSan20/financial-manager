"""
The quick actions always answer.

The top of the dashboard has a bar. The reader presses one of the
four things under "Aksi Cepat" - "Analisis Keuangan", "Catat Cepat",
"Cek Target", "Ringkasan Budget" - and the bar asks the agent.

Pressing "Analisis Keuangan" answered with a 500.

The cause was not the analysis. It was the shape of the answer. The
path that works out several answers at once handed the response a
list of results in a field that was typed to hold one, and the answer
was a validation error. So the requests that understood the reader
best - the ones with several questions in them - were the ones that
failed hardest, and the failure was a server error rather than a
sentence.

Three things are held here:

- every quick action answers 200;
- the answer is a real answer, with words in it, not a stack trace;
- and when the language model is not there - no key, no credit, rate
  limited - the answer still comes, built from the reader's own
  ledger, because the reader's ledger is on our own computer and
  does not need anybody's permission.

The third one is the important one. A reader who asks about their own
money and gets a 500 has been told that their money is too much
trouble to look at.

Nothing here touches the production server or a real database.
"""

import sys
from datetime import date
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

from app.api.routes import ai_advisor  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.core.security import get_current_user  # noqa: E402


class _User:
    """The reader whose money the agent is about to look at."""

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
    """A reader with money, spending, and something to look at."""
    from app.models.account import Account
    from app.models.category import Category
    from app.models.transaction import Transaction
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
        balance=1500000.0,
        currency="IDR",
    ))
    session.add(Category(
        id=6, name="Makanan & Minuman", type="expense", system_key="food_drink"
    ))
    session.add(Category(
        id=1, name="Gaji", type="income", system_key="salary"
    ))
    session.add(Transaction(
        user_id=1,
        account_id=1,
        type="income",
        amount=5000000.0,
        description="Gaji November",
        date=date(2026, 11, 1),
        category_id=1,
    ))
    session.add(Transaction(
        user_id=1,
        account_id=1,
        type="expense",
        amount=45000.0,
        description="Indomie Goreng",
        date=date(2026, 11, 3),
        category_id=6,
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

    return TestClient(application, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# The four quick actions
# ---------------------------------------------------------------------------

# The four things under "Aksi Cepat", and the words the bar sends for
# each of them. These are the reader's four buttons.
QUICK_ACTIONS = [
    ("analysis", "Analisis keuangan saya bulan ini. Di mana uang saya paling banyak keluar, dan apa satu hal yang paling sebaiknya saya perbaiki?"),
    ("quick_record", "Catat pengeluaran Rp25.000 untuk nasi goreng"),
    ("check_goal", "Cek target tabungan saya"),
    ("budget_summary", "Berapa budget saya bulan ini?"),
]


@pytest.mark.parametrize("name,message", QUICK_ACTIONS)
def test_every_quick_action_answers_200(client, reader, name, message):
    """Every quick action answers with 200.

    Not 200 for the ones that happen to work today. Every one of
    them, because a reader who presses one button and sees a server
    error has no way to know that the other three would have been
    fine.
    """
    response = client.post("/api/ai/agent", json={"message": message})

    assert response.status_code == 200, (
        "the %s quick action answered with %r: %s"
        % (name, response.status_code, response.text[:400])
    )


@pytest.mark.parametrize("name,message", QUICK_ACTIONS)
def test_every_quick_action_answers_with_words(client, reader, name, message):
    """The answer has words in it.

    A 200 with an empty body is not an answer. The reader pressed a
    button and something has to come back that they can read.
    """
    response = client.post("/api/ai/agent", json={"message": message})
    assert response.status_code == 200, response.text[:400]

    body = response.json()
    assert isinstance(body, dict), "the answer is not a shape: %r" % body
    assert body.get("success") is True, (
        "the agent did not do what was asked: %r" % body
    )

    reply = body.get("reply") or ""
    assert isinstance(reply, str), "the answer is not words: %r" % reply
    assert len(reply.strip()) > 10, (
        "the answer says nothing: %r" % reply
    )
    assert "Traceback" not in reply, "the answer is a stack trace: %r" % reply


@pytest.mark.parametrize("name,message", QUICK_ACTIONS)
def test_every_quick_action_carries_a_shape(client, reader, name, message):
    """The answer has the fields the bar reads.

    The bar reads `reply`, `success` and `intent`. If one of them is
    missing the bar renders something empty, and the reader sees a
    panel with nothing in it.
    """
    response = client.post("/api/ai/agent", json={"message": message})
    assert response.status_code == 200, response.text[:400]

    body = response.json()
    for field in ("success", "intent", "reply", "message"):
        assert field in body, "the answer has no %r: %r" % (field, body)


# ---------------------------------------------------------------------------
# Several questions in one line
# ---------------------------------------------------------------------------

def test_several_questions_in_one_line_answer_200(client, reader):
    """A line that holds several questions answers with 200.

    This is the exact shape of the fault: several answers worked out
    at once, handed to a field typed for one, and the answer was a
    validation error.
    """
    response = client.post(
        "/api/ai/agent",
        json={
            "message": "berapa saldo saya, berapa budget makan saya, dan "
                       "berapa target tabungan saya?"
        },
    )

    assert response.status_code == 200, (
        "a line with several questions answered with %r: %s"
        % (response.status_code, response.text[:400])
    )

    body = response.json()
    assert body.get("success") is True, body
    assert (body.get("reply") or "").strip(), "there is no answer: %r" % body


# ---------------------------------------------------------------------------
# When the language model is not there
# ---------------------------------------------------------------------------

def test_the_ledger_answers_when_the_advisor_is_gone(client, reader, monkeypatch):
    """The answer comes from the reader's own numbers.

    The advisor is on someone else's computer, behind a key that runs
    out and a rate that is limited. When it is not there, the answer
    is built from the ledger, which is on our own computer and always
    there.
    """
    import app.services.ai_advisor_service as advisor_service

    class _BrokenAdvisor:
        def chat(self, *args, **kwargs):
            raise RuntimeError("no api key / rate limited")

    monkeypatch.setattr(advisor_service, "ai_advisor", _BrokenAdvisor())

    async def _broken_summary(*args, **kwargs):
        raise RuntimeError("no api key / rate limited")

    monkeypatch.setattr(advisor_service, "get_financial_summary", _broken_summary)

    response = client.post(
        "/api/ai/agent",
        json={"message": "Analisis keuangan saya bulan ini"},
    )

    assert response.status_code == 200, (
        "without the advisor the answer was %r: %s"
        % (response.status_code, response.text[:400])
    )

    body = response.json()
    reply = body.get("reply") or ""
    assert len(reply.strip()) > 10, (
        "the ledger did not answer either: %r" % body
    )
    # And the answer is about the reader's money, not about how the
    # application failed.
    assert "Traceback" not in reply
    assert "api key" not in reply.lower()


def test_the_ledger_answers_when_the_advisor_returns_nothing(client, reader, monkeypatch):
    """An empty answer from the advisor is still an answer.

    The advisor can succeed and say nothing. The reader is still owed
    a sentence.
    """
    import app.services.ai_advisor_service as advisor_service

    class _SilentAdvisor:
        def chat(self, *args, **kwargs):
            return {"response": ""}

    monkeypatch.setattr(advisor_service, "ai_advisor", _SilentAdvisor())

    response = client.post(
        "/api/ai/agent",
        json={"message": "Analisis keuangan saya bulan ini"},
    )

    assert response.status_code == 200, response.text[:400]
    body = response.json()
    assert len((body.get("reply") or "").strip()) > 10, body


# ---------------------------------------------------------------------------
# The ledger's own arithmetic
# ---------------------------------------------------------------------------

def test_the_analysis_survives_a_reader_with_no_income(client, reader):
    """A reader with no income this month still gets an answer.

    There is no savings rate without income, and no ratio to divide.
    The answer says so rather than dividing by nothing.
    """
    from app.models.transaction import Transaction

    reader.query(Transaction).filter(
        Transaction.type == "income"
    ).delete()
    reader.commit()

    response = client.post(
        "/api/ai/agent",
        json={"message": "Analisis keuangan saya bulan ini"},
    )

    assert response.status_code == 200, response.text[:400]
    body = response.json()
    assert len((body.get("reply") or "").strip()) > 10, body


def test_the_analysis_survives_an_empty_ledger(client, reader):
    """A reader who has written nothing yet still gets an answer.

    There are no categories, no totals, no rate. The answer is short
    but it is an answer, and it is not a server error.
    """
    from app.models.transaction import Transaction

    reader.query(Transaction).delete()
    reader.commit()

    response = client.post(
        "/api/ai/agent",
        json={"message": "Analisis keuangan saya bulan ini"},
    )

    assert response.status_code == 200, response.text[:400]
    body = response.json()
    assert len((body.get("reply") or "").strip()) > 10, body


@pytest.mark.asyncio
async def test_the_analysis_never_raises(client, reader, monkeypatch):
    """The deterministic analysis never raises.

    Every part of it is caught where it fails, so a part that cannot
    be read is left out rather than taking the whole answer down.
    """
    import app.services.financial_analysis as analysis_module

    async def _broken(*args, **kwargs):
        raise RuntimeError("the database went away")

    monkeypatch.setattr(analysis_module.metrics, "period_totals", _broken)
    monkeypatch.setattr(analysis_module.metrics, "total_balance", _broken)
    monkeypatch.setattr(analysis_module.metrics, "total_debt", _broken)

    result = await analysis_module.deterministic_analysis(reader, 1, "IDR")

    assert isinstance(result, dict)
    assert result["income"] == 0.0
    assert result["expense"] == 0.0
    # The report is still readable.
    words = analysis_module.render_analysis(result)
    assert len(words.strip()) > 10


@pytest.mark.asyncio
async def test_a_reader_with_no_income_has_no_savings_rate(client, reader):
    """No income means there is no rate, and the answer says so.

    Saying "0%" would be a claim: it would say they saved nothing.
    What is true is that there was nothing to save.
    """
    from app.services.financial_analysis import deterministic_analysis

    from app.models.transaction import Transaction

    reader.query(Transaction).filter(
        Transaction.type == "income"
    ).delete()
    reader.commit()

    result = await deterministic_analysis(reader, 1, "IDR")

    assert result["savings_rate_measurable"] is False, (
        "a savings rate was invented: %r" % result
    )
    assert result["savings_rate"] is None, (
        "a savings rate was invented: %r" % result
    )


@pytest.mark.asyncio
async def test_the_analysis_knows_where_the_money_went(client, reader):
    """The biggest category is named, and it is the right one.

    The reader asked "di mana uang saya paling banyak keluar" and the
    answer comes from the ledger.
    """
    from app.services.financial_analysis import (
        deterministic_analysis,
        render_analysis,
    )

    result = await deterministic_analysis(reader, 1, "IDR")

    assert result["top_categories"], "the breakdown is empty: %r" % result
    biggest = result["top_categories"][0]
    assert biggest["category"] == "Makanan & Minuman", biggest
    assert biggest["amount"] == 45000.0, biggest

    words = render_analysis(result)
    assert "Makanan" in words, words


# ---------------------------------------------------------------------------
# The question reaches the right table
# ---------------------------------------------------------------------------

# A question, and the read that should answer it. The words are the
# reader's own, and the table is the one that holds the answer.
#
# Before this, three of these were answered with the budget table,
# because there was no read for the income and no read for the
# analysis, and the fallback was the budgets.
#
#   "berapa pemasukan saya"  -> the budgets, which is the opposite
#                                question: the money that was planned
#                                instead of the money that came in.
#   "analisis keuangan saya"  -> the balance, which is one number
#                                instead of the picture the reader
#                                asked for.
#   "cek target tabungan"     -> the goals, which happened to be
#                                right, but only by luck.
ROUTING = [
    ("query_income", "Berapa pemasukan saya bulan ini?"),
    ("query_income", "berapa gaji saya?"),
    ("query_expenses", "Berapa pengeluaran saya bulan ini?"),
    ("query_balance", "Berapa saldo saya?"),
    ("query_budgets", "Berapa budget saya?"),
    ("query_goals", "Cek target tabungan saya"),
    ("query_transactions", "Tampilkan transaksi terbaru"),
    ("query_analysis", "Analisis keuangan saya bulan ini"),
]


@pytest.mark.parametrize("expected,message", ROUTING)
def test_the_question_reaches_the_right_read(client, reader, expected, message):
    """The question is answered from the table that holds the answer.

    The agent picks the read by the words the reader used. So the
    words are the test: "pemasukan" is the income, "pengeluaran" is
    the spending, and they are not the same table.
    """
    response = client.post("/api/ai/agent", json={"message": message})

    assert response.status_code == 200, response.text[:400]

    body = response.json()
    kinds = [a.get("kind") for a in (body.get("actions") or [])]

    assert expected in kinds, (
        "%r was answered by %r, not %r" % (message, kinds, expected)
    )


def test_the_income_is_the_income_and_not_the_budget(client, reader):
    """"Berapa pemasukan saya" is answered with the income.

    The reader has Rp5.000.000 of salary in the ledger and no
    budgets at all. An answer that says "belum ada anggaran" is
    answering a different question than the one that was asked.
    """
    response = client.post(
        "/api/ai/agent", json={"message": "Berapa pemasukan saya bulan ini?"}
    )

    assert response.status_code == 200, response.text[:400]

    reply = response.json().get("reply") or ""

    assert "5,000,000" in reply, (
        "the income was not in the answer: %r" % reply
    )
    assert "anggaran" not in reply.lower(), (
        "the income question was answered with the budgets: %r" % reply
    )


def test_the_expenses_are_the_expenses(client, reader):
    """The spending is reported from the spending table."""
    response = client.post(
        "/api/ai/agent", json={"message": "Berapa pengeluaran saya bulan ini?"}
    )

    assert response.status_code == 200, response.text[:400]

    reply = response.json().get("reply") or ""

    assert "45,000" in reply, "the spending was not in the answer: %r" % reply


def test_the_analysis_is_the_analysis_and_not_the_balance(client, reader):
    """"Analisis keuangan saya" is answered with the analysis.

    The balance is one number. The analysis is the picture: what came
    in, what went out, what is left, and what to do about it.
    """
    response = client.post(
        "/api/ai/agent",
        json={"message": "Analisis keuangan saya bulan ini"},
    )

    assert response.status_code == 200, response.text[:400]

    body = response.json()
    kinds = [a.get("kind") for a in (body.get("actions") or [])]

    assert "query_analysis" in kinds, (
        "the analysis was answered by %r" % (kinds,)
    )
