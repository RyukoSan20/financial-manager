"""
The payment method routes, over the wire.

These are the checks that the account number does not leave the
server by accident: it is not in the list, it is not in the answer to
the save, and it only comes out of the reveal route for somebody who
has to pay it.
"""

from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.api.routes import split_bills, split_payments

import app.models.user  # noqa: F401
import app.models.account  # noqa: F401
import app.models.category  # noqa: F401
import app.models.transaction  # noqa: F401
import app.models.receipt  # noqa: F401

from app.models.split_bill import (
    SplitCalculatedShare,
    SplitExpense,
    SplitGroup,
    SplitMember,
    SplitPayer,
    SplitPaymentMethod,
)

# A made-up number. It is not a real account.
FAKE_NUMBER = "1234567890"
FAKE_NAME = "A. Member"


class TheReader:
    """The person using the application."""

    id = 1
    email = "host@example.test"
    name = "The Host"
    is_active = True


@pytest.fixture()
def client():
    """
    The application, with a small database behind it.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    private = MetaData()

    copied = set()

    def copy_table(name):
        if name in copied or name not in Base.metadata.tables:
            return
        copied.add(name)
        source = Base.metadata.tables[name]
        for column in source.columns:
            for foreign_key in column.foreign_keys:
                copy_table(foreign_key.target_fullname.split(".")[0])
        source.to_metadata(private)

    for name in (
        "users",
        "accounts",
        "categories",
        "transactions",
        "receipt_scans",
        "split_groups",
        "split_members",
        "split_expenses",
        "split_payers",
        "split_items",
        "split_item_claims",
        "split_calculated_shares",
        "split_settlements",
        "split_payment_methods",
    ):
        copy_table(name)

    private.create_all(engine)
    Session = sessionmaker(bind=engine)

    app = FastAPI()
    app.include_router(split_bills.router, prefix="/api/split")
    app.include_router(split_payments.router, prefix="/api/split")

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: TheReader()

    with TestClient(app) as test_client:
        test_client.db = Session
        yield test_client


def _group(client):
    response = client.post(
        "/api/split/groups",
        json={"name": "Dinner at the Resto"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _member(client, group_id, name, user_id=None, is_host=False):
    response = client.post(
        f"/api/split/groups/{group_id}/members",
        json={
            "display_name": name,
            "user_id": user_id,
            "is_host": is_host,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _reader_is(client, user_id):
    """
    Change who is signed in.

    The route only ever asks the reader for their id, so this is
    enough to be somebody else.
    """
    class _Someone:
        id = user_id
        email = "someone@example.test"
        name = "Someone"
        is_active = True

    client.app.dependency_overrides[get_current_user] = lambda: _Someone()


def _bill_where_andi_paid_and_budi_owes(client, group_id, andi_id, budi_id):
    """
    A published dinner: Andi paid for it and Budi owes all of it.
    """
    Session = client.db
    db = Session()
    try:
        expense = SplitExpense(
            group_id=group_id,
            status="PUBLISHED",
            subtotal=Decimal("100000"),
            grand_total=Decimal("100000"),
        )
        db.add(expense)
        db.flush()
        db.add(SplitPayer(
            expense_id=expense.id,
            member_id=andi_id,
            amount=Decimal("100000"),
        ))
        db.add(SplitCalculatedShare(
            expense_id=expense.id,
            member_id=andi_id,
            item_total=Decimal("0"),
            exact_amount=Decimal("0"),
            final_amount=Decimal("0"),
            currency="IDR",
        ))
        db.add(SplitCalculatedShare(
            expense_id=expense.id,
            member_id=budi_id,
            item_total=Decimal("100000"),
            exact_amount=Decimal("100000"),
            final_amount=Decimal("100000"),
            currency="IDR",
        ))
        db.commit()
    finally:
        db.close()


def test_a_member_saves_how_they_want_to_be_paid(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)

    response = client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={
            "method_type": "BANK",
            "label": "BCA",
            "provider_name": "Bank Central Asia",
            "account_number": FAKE_NUMBER,
            "account_name": FAKE_NAME,
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["method_type"] == "BANK"
    assert body["label"] == "BCA"
    # The number is not in the answer, not even in part.
    assert FAKE_NUMBER not in response.text
    assert "account_number" not in body


def test_the_stored_number_is_not_the_plaintext(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)

    client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={
            "method_type": "BANK",
            "account_number": FAKE_NUMBER,
            "account_name": FAKE_NAME,
        },
    )

    db = client.db()
    try:
        row = (
            db.query(SplitPaymentMethod)
            .filter(SplitPaymentMethod.member_id == andi["id"])
            .first()
        )
        assert row is not None
        assert FAKE_NUMBER not in row.account_number_encrypted
        assert row.account_number_hint == "7890"
    finally:
        db.close()


def test_the_list_of_methods_has_no_account_number_in_it(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)

    client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={
            "method_type": "BANK",
            "account_number": FAKE_NUMBER,
            "account_name": FAKE_NAME,
        },
    )

    response = client.get(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["account_number_hint"] == "7890"
    assert FAKE_NUMBER not in response.text
    assert "account_number" not in body[0]


def test_a_cash_method_needs_no_account_number(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)

    response = client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={"method_type": "CASH", "label": "Cash on the table"},
    )

    assert response.status_code == 201, response.text
    assert response.json()["method_type"] == "CASH"


def test_a_bank_method_without_a_number_is_refused(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)

    response = client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={"method_type": "BANK", "label": "BCA"},
    )

    assert response.status_code == 422, response.text


def test_an_unknown_method_type_is_refused(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)

    response = client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={"method_type": "CRYPTO", "account_number": FAKE_NUMBER},
    )

    assert response.status_code == 422, response.text


def test_somebody_else_cannot_save_a_method_for_you(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)

    response = client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={"method_type": "BANK", "account_number": FAKE_NUMBER},
    )

    assert response.status_code == 201, response.text

    # The same reader is not somebody else. Sign in as somebody who
    # is in the group but is not Andi.
    _reader_is(client, 7)
    response = client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={"method_type": "BANK", "account_number": FAKE_NUMBER},
    )

    assert response.status_code == 403, response.text


def test_the_number_is_not_revealed_to_somebody_who_owes_nothing(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)
    caca = _member(client, group["id"], "Caca", user_id=3)

    created = client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={
            "method_type": "BANK",
            "account_number": FAKE_NUMBER,
            "account_name": FAKE_NAME,
        },
    )
    assert created.status_code == 201, created.text
    method_id = created.json()["id"]

    _reader_is(client, 3)
    response = client.get(f"/api/split/payment-methods/{method_id}/reveal")

    assert response.status_code == 403, response.text
    assert FAKE_NUMBER not in response.text


def test_the_number_is_revealed_to_somebody_who_owes_the_money(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)
    budi = _member(client, group["id"], "Budi", user_id=2)

    _bill_where_andi_paid_and_budi_owes(client, group["id"], andi["id"], budi["id"])

    created = client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={
            "method_type": "BANK",
            "account_number": FAKE_NUMBER,
            "account_name": FAKE_NAME,
        },
    )
    assert created.status_code == 201, created.text
    method_id = created.json()["id"]

    _reader_is(client, 2)
    response = client.get(f"/api/split/payment-methods/{method_id}/reveal")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["account_number"] == FAKE_NUMBER
    assert body["account_name"] == FAKE_NAME


def test_the_member_can_read_their_own_method(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)

    created = client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={"method_type": "BANK", "account_number": FAKE_NUMBER},
    )
    method_id = created.json()["id"]

    response = client.get(f"/api/split/payment-methods/{method_id}/reveal")

    assert response.status_code == 200, response.text
    assert response.json()["account_number"] == FAKE_NUMBER


def test_somebody_outside_the_group_cannot_see_the_methods(client):
    group = _group(client)
    andi = _member(client, group["id"], "Andi", user_id=1, is_host=True)

    client.post(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods",
        json={"method_type": "BANK", "account_number": FAKE_NUMBER},
    )

    _reader_is(client, 42)
    response = client.get(
        f"/api/split/groups/{group['id']}/members/{andi['id']}/payment-methods"
    )

    assert response.status_code == 403, response.text
