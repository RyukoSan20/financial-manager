"""
Bringing a receipt out of the reader's own records, and saying who
had what.

Two things are checked here.

The first: a receipt that is already in the transactions can be pulled
into a bill. The lines come with it, and so do the tax and the
discount, because a bill that has the lines but not the tax would not
add up to what was paid. And only the reader's own transactions are
ever looked at.

The second: the assigner says who had what in one go, and the bill is
worked out again straight away. The money has to add up: the shares
of the people have to be the total of the bill, to the last rupiah.
"""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.receipt import ReceiptItem, ReceiptScan
from app.models.transaction import Transaction


@pytest.fixture()
def db():
    """
    A database with the tables the shared bill and the receipts touch.

    Only those tables are made. The whole schema cannot be made on a
    small database, because one of the other tables uses a column type
    that only the big one has.
    """
    from sqlalchemy import MetaData

    engine = create_engine("sqlite:///:memory:")
    private = MetaData()

    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.receipt  # noqa: F401

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
        "receipt_items",
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
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _make_transaction(db, receipt_lines, tax=0, discount=0, total=None):
    """
    A transaction of the reader's, with a receipt behind it.

    The receipt is a real one, with the lines on it, so that the
    import has something to bring in.
    """
    receipt = ReceiptScan(
        user_id=1,
        merchant_name="Warung Sederhana",
        subtotal=Decimal(str(sum(line["total"] for line in receipt_lines))),
        discount_total=Decimal(str(discount)),
        tax_total=Decimal(str(tax)),
        total_amount=Decimal(
            str(
                total
                if total is not None
                else sum(line["total"] for line in receipt_lines) + tax - discount
            )
        ),
    )
    db.add(receipt)
    db.flush()

    for index, line in enumerate(receipt_lines):
        db.add(
            ReceiptItem(
                receipt_scan_id=receipt.id,
                raw_name=line["name"],
                canonical_name=line["name"],
                quantity=line.get("quantity", 1),
                price_per_unit=Decimal(str(line["price"])),
                total_price=Decimal(str(line["total"])),
                is_discount=line.get("is_discount", False),
                line_number=index + 1,
            )
        )
    db.flush()

    transaction = Transaction(
        user_id=1,
        type="expense",
        amount=Decimal(str(receipt.total_amount)),
        currency="IDR",
        description="Makan siang",
        merchant_name="Warung Sederhana",
        receipt_scan_id=receipt.id,
        account_id=1,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


# ---------------------------------------------------------------------------
# The import
# ---------------------------------------------------------------------------


def test_the_receipts_of_the_reader_can_be_brought_in(db):
    from app.services.split_import_service import importable_transactions

    _make_transaction(
        db,
        [
            {"name": "Nasi goreng", "price": 25000, "total": 25000},
            {"name": "Es teh", "price": 5000, "total": 5000},
        ],
        tax=3000,
    )

    rows = importable_transactions(db, 1)

    assert len(rows) == 1
    assert rows[0]["merchant_name"] == "Warung Sederhana"
    assert len(rows[0]["items"]) == 2


def test_the_tax_and_the_discount_come_with_the_receipt(db):
    from app.services.split_import_service import importable_transactions

    _make_transaction(
        db,
        [{"name": "Nasi goreng", "price": 25000, "total": 25000}],
        tax=3000,
        discount=1000,
    )

    rows = importable_transactions(db, 1)

    assert rows[0]["tax_total"] == 3000.0
    assert rows[0]["discount_total"] == 1000.0


def test_the_bill_of_an_imported_receipt_adds_up(db):
    from app.services.split_import_service import (
        importable_transactions,
        to_bill_payload,
    )

    _make_transaction(
        db,
        [
            {"name": "Nasi goreng", "price": 25000, "total": 25000},
            {"name": "Es teh", "price": 5000, "total": 5000},
        ],
        tax=3000,
    )

    entry = importable_transactions(db, 1)[0]
    payload = to_bill_payload(entry)

    assert payload["subtotal"] == "30000.0"
    assert payload["tax"] == "3000.0"
    assert payload["grand_total"] == "33000.0"


def test_a_discount_comes_off_the_total_of_the_bill(db):
    from app.services.split_import_service import (
        importable_transactions,
        to_bill_payload,
    )

    _make_transaction(
        db,
        [{"name": "Nasi goreng", "price": 25000, "total": 25000}],
        tax=3000,
        discount=1000,
    )

    entry = importable_transactions(db, 1)[0]
    payload = to_bill_payload(entry)

    assert payload["grand_total"] == "27000.0"


def test_the_tax_the_reader_writes_is_the_tax_that_is_used(db):
    from app.services.split_import_service import (
        importable_transactions,
        to_bill_payload,
    )

    _make_transaction(
        db,
        [{"name": "Nasi goreng", "price": 25000, "total": 25000}],
        tax=3000,
    )

    entry = importable_transactions(db, 1)[0]
    payload = to_bill_payload(entry, tax=5000)

    assert payload["tax"] == "5000.0"
    assert payload["grand_total"] == "30000.0"


def test_a_transaction_without_a_receipt_is_not_offered(db):
    from app.services.split_import_service import importable_transactions

    db.add(
        Transaction(
            user_id=1,
            type="expense",
            amount=Decimal("10000"),
            currency="IDR",
            description="Kopi",
            account_id=1,
        )
    )
    db.commit()

    assert importable_transactions(db, 1) == []


def test_somebody_elses_transaction_is_never_offered(db):
    from app.services.split_import_service import importable_transactions

    _make_transaction(
        db,
        [{"name": "Nasi goreng", "price": 25000, "total": 25000}],
    )

    # The reader is number one. Number two sees nothing.
    assert importable_transactions(db, 1) != []
    assert importable_transactions(db, 2) == []


def test_a_discount_line_keeps_its_kind(db):
    from app.services.split_import_service import importable_transactions

    _make_transaction(
        db,
        [
            {"name": "Nasi goreng", "price": 25000, "total": 25000},
            {"name": "Diskon", "price": 0, "total": 5000, "is_discount": True},
        ],
    )

    rows = importable_transactions(db, 1)
    kinds = {line["name"]: line["kind"] for line in rows[0]["items"]}

    assert kinds["Diskon"] == "discount"
    assert kinds["Nasi goreng"] == "item"


def test_the_subtotal_of_an_import_leaves_the_discount_line_out(db):
    from app.services.split_import_service import (
        importable_transactions,
        to_bill_payload,
    )

    _make_transaction(
        db,
        [
            {"name": "Nasi goreng", "price": 25000, "total": 25000},
            {"name": "Diskon", "price": 0, "total": 5000, "is_discount": True},
        ],
    )

    entry = importable_transactions(db, 1)[0]
    payload = to_bill_payload(entry)

    assert payload["subtotal"] == "25000.0"


# ---------------------------------------------------------------------------
# The assigner
# ---------------------------------------------------------------------------


def _group_with_members(client):
    """A group with three people at it."""
    created = client.post(
        "/api/split/groups",
        json={"name": "Makan Malam", "currency": "IDR"},
    )
    assert created.status_code == 201
    group = created.json()

    member_ids = [member["id"] for member in group.get("members", [])]

    for name in ("Budi", "Citra"):
        added = client.post(
            f"/api/split/groups/{group['id']}/members",
            json={"display_name": name},
        )
        assert added.status_code in (200, 201)
        member_ids.append(added.json()["id"])

    return group, member_ids


def test_saying_who_had_what_works_the_bill_out_again(split_client):
    client = split_client

    group, member_ids = _group_with_members(client)
    assert len(member_ids) >= 3

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Makan Malam",
            "merchant_name": "Warung",
            "items": [
                {"name": "Nasi goreng", "quantity": "1", "unit_price": "25000", "total_price": "25000"},
                {"name": "Es teh", "quantity": "1", "unit_price": "5000", "total_price": "5000"},
            ],
            "subtotal": "30000",
            "grand_total": "30000",
            "split_mode": "ITEMIZED",
        },
    )
    assert created.status_code == 201
    expense = created.json()
    items = expense["items"]
    assert len(items) == 2

    assigned = client.post(
        f"/api/split/groups/{group['id']}/expenses/{expense['id']}/assign",
        json={"assignments": {str(items[0]["id"]): member_ids[0], str(items[1]["id"]): member_ids[1]}},
    )
    assert assigned.status_code == 200

    body = assigned.json()
    by_member = {share["member_id"]: share for share in body["shares"]}

    assert float(by_member[member_ids[0]]["final_amount"]) == 25000.0
    assert float(by_member[member_ids[1]]["final_amount"]) == 5000.0


def test_the_shares_add_up_to_the_bill(split_client):
    client = split_client

    group, member_ids = _group_with_members(client)

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Makan Malam",
            "items": [
                {"name": "Steak", "quantity": "1", "unit_price": "60000", "total_price": "60000"},
                {"name": "Salad", "quantity": "1", "unit_price": "40000", "total_price": "40000"},
            ],
            "subtotal": "100000",
            "grand_total": "100000",
            "split_mode": "ITEMIZED",
        },
    )
    assert created.status_code == 201
    expense = created.json()
    items = expense["items"]

    assigned = client.post(
        f"/api/split/groups/{group['id']}/expenses/{expense['id']}/assign",
        json={"assignments": {str(items[0]["id"]): member_ids[0], str(items[1]["id"]): member_ids[1]}},
    )
    body = assigned.json()

    total = sum(float(share["final_amount"]) for share in body["shares"])
    assert total == 100000.0


def test_a_line_with_nobody_on_it_is_free_again(split_client):
    """
    Taking a claim back leaves the line free.

    The server's rule for a bill where nothing has been claimed is to
    split it equally, because there is nothing to split in proportion
    to. So the line is not held by anybody, and the bill is shared
    out evenly again. The check here is that the line itself is no
    longer claimed: the claim is what held it, and it is gone.
    """
    client = split_client

    group, member_ids = _group_with_members(client)

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Makan Malam",
            "items": [
                {"name": "Steak", "quantity": "1", "unit_price": "60000", "total_price": "60000"},
            ],
            "subtotal": "60000",
            "grand_total": "60000",
            "split_mode": "ITEMIZED",
        },
    )
    expense = created.json()
    item_id = expense["items"][0]["id"]

    held = client.post(
        f"/api/split/groups/{group['id']}/expenses/{expense['id']}/assign",
        json={"assignments": {str(item_id): member_ids[0]}},
    )
    assert held.json()["items"][0]["is_claimed"] is True

    freed = client.post(
        f"/api/split/groups/{group['id']}/expenses/{expense['id']}/assign",
        json={"assignments": {str(item_id): None}},
    )
    assert freed.status_code == 200

    body = freed.json()
    assert body["items"][0]["is_claimed"] is False
    assert body["items"][0]["claims"] == []


def test_somebody_outside_the_group_cannot_be_named(split_client):
    client = split_client

    group, member_ids = _group_with_members(client)

    created = client.post(
        f"/api/split/groups/{group['id']}/expenses",
        json={
            "name": "Makan Malam",
            "items": [
                {"name": "Steak", "quantity": "1", "unit_price": "60000", "total_price": "60000"},
            ],
            "subtotal": "60000",
            "grand_total": "60000",
            "split_mode": "ITEMIZED",
        },
    )
    expense = created.json()
    item_id = expense["items"][0]["id"]

    refused = client.post(
        f"/api/split/groups/{group['id']}/expenses/{expense['id']}/assign",
        json={"assignments": {str(item_id): 999999}},
    )
    assert refused.status_code == 404
