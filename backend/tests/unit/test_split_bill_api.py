"""
The shared bill, over the wire.

These are the checks that a host can make a group, that a guest with
no account can claim their food from a link, and that the money
somebody else owes is not the host's spending.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.api.routes import split_bills, split_guest


@pytest.fixture()
def client():
    """
    The application, with a small database behind it.

    The tables that are made by hand are the ones the shared bill
    needs, plus the ones it points at. The whole schema cannot be
    made on a small database because one of the other tables uses a
    column type that only the big one has.
    """
    from sqlalchemy import (
        Boolean,
        Column,
        Date,
        DateTime,
        ForeignKey,
        Integer,
        MetaData,
        Numeric,
        String,
        Table,
        Text,
        create_engine as ce,
    )

    engine = ce(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    private = MetaData()

    # The tables are copied out of the models rather than written out
    # by hand. A hand-written table drifts away from the model, and
    # the first thing that breaks is a column the model has and the
    # table does not.
    #
    # Only the tables the shared bill needs are copied, because the
    # whole schema cannot be made on a small database: one of the
    # other tables uses a column type that only the big one has.
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.receipt  # noqa: F401

    # A table that is pointed at is copied along with the table that
    # points at it. A foreign key to a table that is not there has
    # nothing to point at, and the database cannot be made.
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

    class _TheReader:
        id = 1
        email = "host@example.test"
        name = "The Host"
        is_active = True

    app = FastAPI()
    app.include_router(split_bills.router, prefix="/api/split")
    app.include_router(split_guest.router, prefix="/api/split")

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: _TheReader()

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


def test_the_host_makes_a_group_and_is_in_it(client):
    group = _group(client)

    assert group["name"] == "Dinner at the Resto"
    assert group["member_count"] == 1
    assert group["members"][0]["is_host"] is True
    assert group["invite_code"]


def test_the_invite_code_has_no_letter_that_looks_like_another(client):
    group = _group(client)

    code = group["invite_code"]

    # No 0, no 1, no I, no O. These are the characters that get
    # typed wrong when somebody is reading a code out over a table.
    for confusing in "01IO":
        assert confusing not in code


def test_a_guest_joins_from_a_link_without_an_account(client):
    group = _group(client)
    code = group["invite_code"]

    peek = client.get(f"/api/split/claim/{code}")
    assert peek.status_code == 200
    assert peek.json()["group_name"] == "Dinner at the Resto"

    joined = client.post(
        f"/api/split/claim/{code}/join",
        json={"display_name": "Budi"},
    )
    assert joined.status_code == 200, joined.text
    assert joined.json()["display_name"] == "Budi"
    assert joined.json()["claim_token"]


def test_a_guest_cannot_claim_without_a_pass(client):
    group = _group(client)
    code = group["invite_code"]

    joined = client.post(
        f"/api/split/claim/{code}/join",
        json={"display_name": "Budi"},
    )
    token = joined.json()["claim_token"]

    # A receipt for the group to claim from.
    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Dinner",
            "subtotal": "100000",
            "grand_total": "100000",
            "items": [{"name": "Steak", "quantity": "1", "unit_price": "100000"}],
        },
    )
    assert created.status_code == 201, created.text
    expense = created.json()
    item_id = expense["items"][0]["id"]

    # With the pass, it works.
    ok = client.post(
        f"/api/split/expenses/{expense['id']}/claim",
        json={"item_id": item_id, "quantity": "1"},
        headers={"X-Split-Guest-Token": token},
    )
    assert ok.status_code == 200, ok.text

    # Without it, it does not.
    no_pass = client.post(
        f"/api/split/expenses/{expense['id']}/claim",
        json={"item_id": item_id, "quantity": "1"},
    )
    assert no_pass.status_code == 401


def test_a_guest_cannot_claim_more_than_is_on_the_receipt(client):
    group = _group(client)
    code = group["invite_code"]

    budi = client.post(
        f"/api/split/claim/{code}/join", json={"display_name": "Budi"}
    ).json()
    caca = client.post(
        f"/api/split/claim/{code}/join", json={"display_name": "Caca"}
    ).json()

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Dinner",
            "subtotal": "80000",
            "grand_total": "80000",
            "items": [
                {"name": "Kopi", "quantity": "2", "unit_price": "40000"}
            ],
        },
    ).json()
    item_id = created["items"][0]["id"]

    first = client.post(
        f"/api/split/expenses/{created['id']}/claim",
        json={"item_id": item_id, "quantity": "1"},
        headers={"X-Split-Guest-Token": budi["claim_token"]},
    )
    assert first.status_code == 200

    # Caca wants both coffees, but Budi has one of them.
    too_much = client.post(
        f"/api/split/expenses/{created['id']}/claim",
        json={"item_id": item_id, "quantity": "2"},
        headers={"X-Split-Guest-Token": caca["claim_token"]},
    )
    assert too_much.status_code == 409


def test_tapping_the_same_plate_twice_does_not_claim_it_twice(client):
    group = _group(client)
    code = group["invite_code"]
    budi = client.post(
        f"/api/split/claim/{code}/join", json={"display_name": "Budi"}
    ).json()

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Dinner",
            "subtotal": "80000",
            "grand_total": "80000",
            "items": [
                {"name": "Kopi", "quantity": "2", "unit_price": "40000"}
            ],
        },
    ).json()
    item_id = created["items"][0]["id"]

    for _ in range(2):
        client.post(
            f"/api/split/expenses/{created['id']}/claim",
            json={"item_id": item_id, "quantity": "1"},
            headers={"X-Split-Guest-Token": budi["claim_token"]},
        )

    live = client.get(
        f"/api/split/expenses/{created['id']}/live",
        headers={"X-Split-Guest-Token": budi["claim_token"]},
    )
    claims = live.json()["items"][0]["claims"]
    assert len(claims) == 1
    assert claims[0]["quantity"] == "1.00"


def test_a_draft_bill_leaves_the_reader_records_alone(client):
    group = _group(client)

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Dinner",
            "subtotal": "100000",
            "grand_total": "100000",
            "items": [{"name": "Steak", "quantity": "1", "unit_price": "100000"}],
        },
    ).json()

    assert created["status"] == "DRAFT"

    db = client.db()
    try:
        rows = db.query(_transaction_model()).all()
        assert rows == []
    finally:
        db.close()


def _transaction_model():
    from app.models.transaction import Transaction

    return Transaction


def test_the_money_others_owe_is_not_the_host_spending(client):
    """
    The rule the whole accounting rests on.

    The host paid Rp100.000 for a table of two and their own share is
    Rp50.000. Only Rp50.000 is their spending. The other Rp50.000 is
    their money on loan.
    """
    group = _group(client)
    code = group["invite_code"]
    budi = client.post(
        f"/api/split/claim/{code}/join", json={"display_name": "Budi"}
    ).json()

    # The host has an account to pay from.
    db = client.db()
    try:
        from app.models.account import Account
        from app.models.category import Category

        db.add(Account(id=1, user_id=1, name="BCA", account_type="bank", balance=1000000))
        db.add(Category(id=1, user_id=1, name="Food", type="expense"))
        db.commit()
    finally:
        db.close()

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Dinner",
            "merchant_name": "Warung Sederhana",
            "subtotal": "100000",
            "grand_total": "100000",
            "payer_account_id": 1,
            "items": [
                {"name": "Steak", "quantity": "1", "unit_price": "60000"},
                {"name": "Es Teh", "quantity": "1", "unit_price": "40000"},
            ],
            "payers": [{"member_id": 1, "amount": "100000"}],
        },
    ).json()
    steak_id = created["items"][0]["id"]
    tea_id = created["items"][1]["id"]

    # Budi claims the steak, which is Rp60.000 of the bill.
    client.post(
        f"/api/split/expenses/{created['id']}/claim",
        json={"item_id": steak_id, "quantity": "1"},
        headers={"X-Split-Guest-Token": budi["claim_token"]},
    )

    # The host claims their own iced tea, which is Rp40.000.
    host_member = group["members"][0]["id"]
    host_claim = client.post(
        f"/api/split/expenses/{created['id']}/claims",
        json={"item_id": tea_id, "quantity": "1", "member_id": host_member},
    )
    assert host_claim.status_code == 200, host_claim.text

    published = client.post(f"/api/split/expenses/{created['id']}/publish")
    assert published.status_code == 200, published.text

    db = client.db()
    try:
        from app.models.transaction import Transaction

        rows = db.query(Transaction).all()
        kinds = {row.split_tx_type: float(row.amount) for row in rows}
        # The host's own share is what they ate: Rp40.000.
        assert kinds.get("PERSONAL_SHARE") == 40000.0
        # The rest is on loan to Budi, not spent.
        assert kinds.get("FRONTED_RECEIVABLE") == 60000.0
    finally:
        db.close()


def test_two_people_cannot_have_the_same_name_at_one_table(client):
    """
    The name is how a line of the receipt is claimed, so a second
    person with the same name would make the claim ambiguous.

    The answer has to say that. A failure that reaches the reader as
    a 500 says the server is broken, and it is not: the reader asked
    for something that cannot be done.
    """
    group = _group(client)

    first = client.post(
        f"/api/split/groups/{group['id']}/members",
        json={"display_name": "Budi", "is_guest": True},
    )
    assert first.status_code == 201, first.text

    second = client.post(
        f"/api/split/groups/{group['id']}/members",
        json={"display_name": "Budi", "is_guest": True},
    )
    assert second.status_code == 409, second.text
    assert "name" in second.json()["detail"].lower()
