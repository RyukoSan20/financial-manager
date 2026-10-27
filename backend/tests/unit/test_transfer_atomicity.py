"""
A transfer moves the money, or it does not move at all.

The add screen used to write a transfer as two separate transactions:
one expense out of the source account and one income into the
destination. That was wrong in three ways, and each of them loses or
mislabels money:

- the two halves were not linked to each other, so nothing could tell
  them apart later;
- the destination was credited the same number as the source was
  debited, even when the two accounts hold different currencies;
- if the second half failed, the first was already saved, so the money
  had left the source account and arrived nowhere.

The server has one endpoint that does the whole transfer in one go.
These are the checks that it does, and that it refuses to do a
half-finished one.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.transfer import Transfer
from app.models.user import User
from app.services.currency_rules import account_currency


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(
        engine,
        tables=[
            Base.metadata.tables["users"],
            Base.metadata.tables["accounts"],
            Base.metadata.tables["transactions"],
            Base.metadata.tables["transfers"],
        ],
    )
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def reader(db):
    user = User(email="reader@example.com", hashed_password="x", full_name="Reader")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_account(db, user_id, name, balance, currency="IDR"):
    account = Account(
        user_id=user_id,
        name=name,
        account_type="cash",
        balance=balance,
        initial_balance=balance,
        currency=currency,
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def test_the_two_ends_of_a_transfer_are_linked(db, reader):
    """
    The two transactions a transfer writes point at each other.

    Without the link, nothing could tell them apart from two ordinary
    transactions that happened to be the same amount.
    """
    from app.api.routes.transfers import create_transfer
    from app.schemas.transfer import TransferCreate

    source = make_account(db, reader.id, "Dompet", 1000000)
    destination = make_account(db, reader.id, "Bank", 0)

    transfer = TransferCreate(
        amount=250000,
        currency="IDR",
        date="2026-03-10",
        from_account_id=source.id,
        to_account_id=destination.id,
    )

    # The endpoint is async because it may need a live rate. This
    # transfer is between two accounts of the same currency, so no rate
    # is needed.
    import asyncio

    result = asyncio.run(create_transfer(transfer, current_user=reader, db=db))

    assert result.from_account_id == source.id
    assert result.to_account_id == destination.id

    rows = db.query(Transaction).order_by(Transaction.id).all()
    assert len(rows) == 2

    out_row = next(r for r in rows if r.type == "transfer_out")
    in_row = next(r for r in rows if r.type == "transfer_in")

    # The two halves point at each other and at the transfer.
    assert out_row.transfer_id == in_row.transfer_id
    assert in_row.transfer_to_transaction_id == out_row.id
    assert db.query(Transfer).count() == 1

    # The money left one account and arrived in the other.
    assert out_row.amount == 250000
    assert in_row.amount == 250000
    assert source.balance == 750000
    assert destination.balance == 250000


def test_a_transfer_to_the_same_account_is_refused(db, reader):
    """Moving money to the account it is already in is not a transfer."""
    from app.api.routes.transfers import create_transfer
    from app.schemas.transfer import TransferCreate
    from fastapi import HTTPException

    source = make_account(db, reader.id, "Dompet", 1000000)

    transfer = TransferCreate(
        amount=250000,
        currency="IDR",
        date="2026-03-10",
        from_account_id=source.id,
        to_account_id=source.id,
    )

    import asyncio

    with pytest.raises(HTTPException) as caught:
        asyncio.run(create_transfer(transfer, current_user=reader, db=db))

    assert caught.value.status_code == 400


def test_a_transfer_with_no_destination_is_refused(db, reader):
    """
    The transfer needs both ends.

    This is the case that used to lose money: the source was debited
    and saved, and the credit then failed, so the money had gone.
    """
    from app.api.routes.transfers import create_transfer
    from app.schemas.transfer import TransferCreate
    from fastapi import HTTPException

    source = make_account(db, reader.id, "Dompet", 1000000)

    transfer = TransferCreate(
        amount=250000,
        currency="IDR",
        date="2026-03-10",
        from_account_id=source.id,
        to_account_id=999999,  # no such account
    )

    import asyncio

    with pytest.raises(HTTPException) as caught:
        asyncio.run(create_transfer(transfer, current_user=reader, db=db))

    assert caught.value.status_code == 404

    # Nothing was written, and the money did not move.
    assert db.query(Transaction).count() == 0
    assert db.query(Transfer).count() == 0
    assert source.balance == 1000000


def test_each_account_holds_its_own_currency(db, reader):
    """
    A record is in the currency of the account it belongs to.

    This is the rule that makes the two halves of a transfer correct
    when the two accounts do not hold the same money.
    """
    source = make_account(db, reader.id, "Dompet", 1000000, "IDR")
    other = make_account(db, reader.id, "Dollar", 500, "USD")

    assert account_currency(source) == "IDR"
    assert account_currency(other) == "USD"
