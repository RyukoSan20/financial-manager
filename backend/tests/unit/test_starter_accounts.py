"""
A guest has somewhere to put their money.

Before, a guest was given a user and nothing else. So the very first
purchase had nowhere to go: the receipt was read, the total was
shown, and then the save failed at the last step. The transaction was
never written down, and the screen said nothing about it.

So a guest is given the accounts a reader would make for themselves in
the first minute anyway, and a reader who already has accounts is never
touched.
"""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.account import Account
from app.models.user import User
from app.services.starter_accounts import seed_starter_accounts


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(
        engine,
        tables=[
            Base.metadata.tables["users"],
            Base.metadata.tables["accounts"],
        ],
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _reader(session, email):
    user = User(
        email=email,
        username=email.split("@")[0].replace(".", ""),
        hashed_password="x",
        is_guest=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def test_a_guest_is_given_the_accounts_they_need(db_session):
    """The money has somewhere to go."""
    reader = _reader(db_session, "starter-guest@example.com")

    made = seed_starter_accounts(db_session, reader.id)
    db_session.commit()

    assert len(made) == 4, "a guest needs cash, a bank and the two wallets"

    accounts = db_session.query(Account).filter(Account.user_id == reader.id).all()
    names = [a.name for a in accounts]
    assert "Cash" in names
    assert "BCA" in names
    assert "GoPay" in names
    assert "OVO" in names


def test_the_accounts_are_the_kinds_the_app_understands(db_session):
    """The kinds are the ones the app uses everywhere else."""
    reader = _reader(db_session, "kinds-guest@example.com")
    seed_starter_accounts(db_session, reader.id)
    db_session.commit()

    accounts = db_session.query(Account).filter(Account.user_id == reader.id).all()
    kinds = {a.name: a.account_type for a in accounts}

    assert kinds["GoPay"] == "e-wallet"
    assert kinds["OVO"] == "e-wallet"
    assert kinds["BCA"] == "bank"
    assert kinds["Cash"] == "cash"


def test_a_reader_who_has_accounts_is_left_alone(db_session):
    """Their accounts are their own."""
    reader = _reader(db_session, "has-accounts@example.com")
    db_session.add(
        Account(
            user_id=reader.id,
            name="Tabungan Saya",
            account_type="savings",
            account_kind="savings",
            balance=Decimal("50000"),
            currency="IDR",
            is_active=True,
        )
    )
    db_session.commit()

    made = seed_starter_accounts(db_session, reader.id)
    db_session.commit()

    assert made == []
    accounts = db_session.query(Account).filter(Account.user_id == reader.id).all()
    assert len(accounts) == 1
    assert accounts[0].name == "Tabungan Saya"


def test_the_accounts_are_made_only_once(db_session):
    """Signing in again does not double them up."""
    reader = _reader(db_session, "twice-guest@example.com")

    seed_starter_accounts(db_session, reader.id)
    db_session.commit()
    made_again = seed_starter_accounts(db_session, reader.id)
    db_session.commit()

    assert made_again == []
    accounts = db_session.query(Account).filter(Account.user_id == reader.id).all()
    assert len(accounts) == 4
