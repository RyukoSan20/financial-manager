"""
The list of transactions must not fall over because one row is thin.

A transaction row is allowed to leave its flags empty in the database.
The column has no "not null" on it, so a row written by an older
version of the app, or by a script, can carry a NULL in the flag
columns. When that row is put into the answer, the answer does not
match the shape that was promised, and the whole list fails.

A reader then sees "no transactions" while the sidebar, which reads a
different door, shows them the real number. The money is there and the
page says it is not. That is the bug this file holds shut.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionResponse


@pytest.fixture()
def session():
    """
    A database of our own, so the test never touches a real one.

    Only the tables this test needs are copied over. The whole schema
    cannot be made in SQLite, because some of the columns are a type
    SQLite has never heard of.
    """
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    private = Base.metadata
    private.create_all(engine, tables=[
        private.tables[name]
        for name in ("transactions", "accounts", "categories", "users")
        if name in private.tables
    ])
    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def _make(db, **overrides):
    row = {
        "user_id": 1,
        "type": "expense",
        "amount": Decimal("42000"),
        "currency": "IDR",
        "date": date(2026, 11, 1),
        "description": "Makan siang",
        "account_id": 1,
        "category_id": 6,
    }
    row.update(overrides)
    db.add(Transaction(**row))
    db.commit()


def test_a_row_with_empty_flags_still_answers_the_schema(session):
    """A row with empty flags must still fit the promised shape."""
    _make(session, is_recurring=None, is_deleted=None, detection_type=None)

    tx = session.query(Transaction).first()
    answer = TransactionResponse.model_validate(tx)

    assert answer.is_recurring is False
    assert answer.is_deleted is False
    assert answer.detection_type == "MANUAL"


def test_a_row_with_empty_flags_does_not_break_the_whole_list(session):
    """One thin row must not take the other rows down with it."""
    _make(session, amount=Decimal("25000"))
    session.add(
        Transaction(
            user_id=1,
            type="expense",
            amount=Decimal("42000"),
            currency="IDR",
            date=date(2026, 11, 2),
            description="Kopi",
            account_id=1,
            category_id=6,
            is_recurring=None,
            is_deleted=None,
            detection_type=None,
        )
    )
    session.commit()

    rows = session.query(Transaction).filter(Transaction.user_id == 1).all()
    answers = [TransactionResponse.model_validate(r) for r in rows]

    assert len(answers) == 2
    assert {a.amount for a in answers} == {Decimal("25000"), Decimal("42000")}


def test_a_row_whose_flags_are_null_in_the_database_still_answers(session):
    """
    A row whose flags are NULL in the table must still fit the shape.

    This is the row that broke production. The flags were NULL in the
    table, the answer did not match the promised shape, and the whole
    list failed with an error. The page then said the reader had no
    transactions at all.
    """
    _make(session)
    session.execute(
        Transaction.__table__.update().values(
            is_recurring=None, is_deleted=None, detection_type=None
        )
    )
    session.commit()
    session.expire_all()

    tx = session.query(Transaction).first()
    assert tx.is_deleted is None

    answer = TransactionResponse.model_validate(tx)

    assert answer.is_recurring is False
    assert answer.is_deleted is False
    assert answer.detection_type == "MANUAL"


def test_the_amount_is_never_a_string_in_the_answer(session):
    """The amount must stay a number, so a total can be added up."""
    _make(session)

    answer = TransactionResponse.model_validate(session.query(Transaction).first())

    assert isinstance(answer.amount, Decimal)


def test_the_route_survives_a_thin_row(session):
    """
    The route is the door the page reads.

    A thin row in the table must not make the door answer with an
    error, because the page then says the reader has no transactions
    at all.
    """
    from app.api.routes import transactions as routes

    class TheReader:
        """The route only ever reads the id off the reader."""

        id = 1

    session.add(
        Transaction(
            user_id=1,
            type="expense",
            amount=Decimal("42000"),
            currency="IDR",
            date=date(2026, 11, 2),
            description="Kopi",
            account_id=1,
            category_id=6,
            is_recurring=None,
            is_deleted=None,
            detection_type=None,
        )
    )
    session.commit()

    rows = routes.list_transactions(
        skip=0,
        limit=100,
        type=None,
        account_id=None,
        category_id=None,
        start_date=None,
        end_date=None,
        current_user=TheReader(),
        db=session,
    )

    assert len(rows) == 1
    assert rows[0]["is_deleted"] is False
    assert rows[0]["detection_type"] == "MANUAL"
