"""
The chips of recent things must not be the same thing three times.

The chips under the quick entry are the reader's own history: the
things they bought before, with the price they paid. They are meant
to be a shortcut, so pressing one fills the form in.

The bug was that one transaction could put three chips on the screen.
The words of a description were pulled out one by one, and each word
became a chip of its own, all carrying the same amount and the same
category. Three chips that say the same thing is worse than one,
because the reader cannot tell them apart and does not know which is
the one they meant.

The chips must also carry the thing itself, not just a word out of it.
A chip that says "Makanan & Minuman · Rp 42.000" tells the reader
nothing about what they bought. A chip that says "Makan siang ·
Rp 42.000" does.

This file holds both of those down.
"""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.transaction import Transaction
from app.api.routes import category_hints as hints


@pytest.fixture()
def session():
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


def _tx(db, description, amount, category_id=6):
    from datetime import date

    db.add(
        Transaction(
            user_id=1,
            type="expense",
            amount=Decimal(amount),
            currency="IDR",
            date=date(2026, 11, 1),
            description=description,
            account_id=1,
            category_id=category_id,
        )
    )
    db.commit()


def test_one_transaction_does_not_make_three_chips(session):
    """One transaction is one chip, not one chip for each of its words."""
    _tx(session, "Makan siang", "42000")

    combos = hints.build_recent_combos(session, user_id=1)

    assert len(combos) == 1


def test_the_chip_carries_the_thing_that_was_bought(session):
    """The chip says what was bought, not just a word out of it."""
    _tx(session, "Makan siang", "42000")

    combos = hints.build_recent_combos(session, user_id=1)

    assert combos[0]["description"] == "Makan siang"


def test_the_same_thing_bought_twice_is_one_chip(session):
    """The same thing, twice, is still one chip."""
    _tx(session, "Makan siang", "42000")
    _tx(session, "Makan siang", "42000")

    combos = hints.build_recent_combos(session, user_id=1)

    assert len(combos) == 1
    assert combos[0]["count"] == 2


def test_different_things_are_different_chips(session):
    """Two different things are two chips."""
    _tx(session, "Makan siang", "42000")
    _tx(session, "Kopi susu", "15000")

    combos = hints.build_recent_combos(session, user_id=1)

    assert len(combos) == 2
    descriptions = {c["description"] for c in combos}
    assert descriptions == {"Makan siang", "Kopi susu"}


def test_a_chip_carries_the_price_that_was_paid(session):
    """The chip carries the amount, so pressing it fills the form in."""
    _tx(session, "Makan siang", "42000")

    combos = hints.build_recent_combos(session, user_id=1)

    assert float(combos[0]["amount"]) == 42000.0


def test_a_transaction_with_no_words_is_still_a_chip(session):
    """
    A description of only a number has no words in it.

    The words are for guessing the category. The chip is for the
    reader, so a transaction with no words in it still deserves one.
    """
    _tx(session, "12345", "42000")

    combos = hints.build_recent_combos(session, user_id=1)

    assert len(combos) == 1
    assert combos[0]["description"] == "12345"


def test_the_most_repeated_thing_comes_first(session):
    """The thing that was bought most often is the most worth offering."""
    _tx(session, "Kopi susu", "15000")
    _tx(session, "Makan siang", "42000")
    _tx(session, "Makan siang", "42000")

    combos = hints.build_recent_combos(session, user_id=1)

    assert combos[0]["description"] == "Makan siang"


def test_the_price_of_a_thing_that_is_bought_often_is_the_newest_one(session):
    """
    The price that is remembered is the price that was paid last.

    A thing that costs more now than it did before is remembered at
    the new price, because that is the price the reader will pay next
    time.
    """
    from datetime import date

    _tx(session, "Indomie", "3500")
    session.add(
        Transaction(
            user_id=1,
            type="expense",
            amount=Decimal("4000"),
            currency="IDR",
            date=date(2026, 11, 5),
            description="Indomie",
            account_id=1,
            category_id=6,
        )
    )
    session.commit()

    combos = hints.build_recent_combos(session, user_id=1)

    assert len(combos) == 1
    assert float(combos[0]["amount"]) == 4000.0
