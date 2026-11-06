"""
The place a transaction happened at must survive the save.

The reader can say where they were. The page asks the phone for the
coordinates, or the reader types the name of the place. Either way the
place is drawn on the sheet, with a tick beside it, and the reader
believes it is kept.

It was not kept. The coordinates were collected, put in a corner of
the page, and never sent with the transaction. The place was thrown
away when the transaction was saved.

The map reads the coordinates off the transaction, so a transaction
with no coordinates is a transaction the map has never heard of. The
reader is left looking at a map that does not know where they have
been, and the pin that should be at the shop is nowhere.

These checks are about the place surviving the save, and about the
answer naming the columns that actually exist.
"""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionResponse


@pytest.fixture()
def session():
    """
    A database of our own, so the test never touches a real one.
    """
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


def _reader(db):
    user = User(email="reader@example.test", hashed_password="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    account = Account(
        user_id=user.id,
        name="Rekening",
        account_type="bank",
        currency="IDR",
        balance=Decimal("100000"),
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    category = Category(user_id=user.id, name="Makanan", type="expense")
    db.add(category)
    db.commit()
    db.refresh(category)

    return user, account, category


def test_the_place_the_reader_gave_is_written_down(session):
    """
    The place has to be written with the transaction, not just shown
    on the sheet.
    """
    user, account, category = _reader(session)

    given = TransactionCreate(
        type="expense",
        amount=Decimal("55000"),
        account_id=account.id,
        category_id=category.id,
        date=date(2026, 11, 1),
        description="Kopi",
        latitude=-6.2088,
        longitude=106.8456,
        merchant_address="Jl. Kemang Raya No. 12",
    )

    written = Transaction(
        user_id=user.id,
        amount=given.amount,
        type=given.type,
        currency="IDR",
        date=given.date,
        description=given.description,
        account_id=given.account_id,
        category_id=given.category_id,
        latitude=given.latitude,
        longitude=given.longitude,
        merchant_address=given.merchant_address,
    )
    session.add(written)
    session.commit()
    session.refresh(written)

    assert float(written.latitude) == pytest.approx(-6.2088)
    assert float(written.longitude) == pytest.approx(106.8456)
    assert written.merchant_address == "Jl. Kemang Raya No. 12"


def test_the_place_survives_the_round_trip(session):
    """
    What is written must come back out again. A place that is written
    but never read is the same as a place that was never written.
    """
    user, account, category = _reader(session)

    written = Transaction(
        user_id=user.id,
        amount=Decimal("55000"),
        type="expense",
        currency="IDR",
        date=date(2026, 11, 1),
        description="Kopi",
        account_id=account.id,
        category_id=category.id,
        latitude=-6.2088,
        longitude=106.8456,
        merchant_address="Jl. Kemang Raya No. 12",
    )
    session.add(written)
    session.commit()
    session.refresh(written)

    answer = TransactionResponse.model_validate(written)
    assert float(answer.latitude) == pytest.approx(-6.2088)
    assert float(answer.longitude) == pytest.approx(106.8456)


def test_the_answer_names_only_columns_that_exist():
    """
    The answer is built from the row. A field in the answer that the
    row does not have is a field that is always empty, and it hides
    the fact that the place was never kept.
    """
    columns = {c.name for c in Transaction.__table__.columns}
    fields = set(TransactionResponse.model_fields)

    missing = fields - columns - {"items"}
    assert not missing, (
        "the answer names fields the row does not have: "
        f"{sorted(missing)}"
    )
