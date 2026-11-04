"""
The itemised receipt, through the API.

The service is checked on its own in `test_receipt_itemizer.py`.
This checks the whole path: the reader opens a transaction, changes
the lines, gives two of them different categories, types a discount
and a tax, and saves. What comes back has to be what was sent, and
the receipt has to add up.

The two categories are the point. A receipt with AYAM PANGGANG and
a RED VELVET LATTE on it is one piece of paper, and the reader
wants the food to go to food and the latte to go to drinks. A
receipt that cannot say that puts everything in one bucket.
"""

import pytest

from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction


@pytest.fixture
def db(receipt_client):
    """The database behind the application, so the tests can set things up."""
    session = receipt_client.db()
    try:
        yield session
    finally:
        session.close()


def _account(db, user_id):
    """An account for the transaction to sit on."""
    account = Account(
        user_id=user_id,
        name="Dompet",
        account_type="cash",
        balance=1000000,
        currency="IDR",
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def _transaction(db, user_id, amount=100000):
    """A transaction to hang a receipt on."""
    transaction = Transaction(
        user_id=user_id,
        type="expense",
        amount=amount,
        description="Makan di warteg",
        account_id=_account(db, user_id).id,
        category_id=None,
        source="OCR_RECEIPT",
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def _categories(db, user_id):
    """The reader's categories."""
    made = []
    for name in ("Makanan & Minuman", "Minuman"):
        category = Category(user_id=user_id, name=name, name_en=name, name_ja=name, type="expense")
        db.add(category)
        made.append(category)
    db.commit()
    for category in made:
        db.refresh(category)
    return {category.name: category.id for category in made}


def test_the_lines_can_be_read_and_written(receipt_client, db):
    """A receipt that was read can be looked at, changed and looked at again."""
    client = receipt_client
    user_id = 1

    categories = _categories(db, user_id)
    transaction = _transaction(db, user_id)

    # A transaction with no receipt behind it has nothing to read.
    # The server says so rather than making one up.
    empty = client.get(f"/api/receipt-items/{transaction.id}")
    assert empty.status_code == 404

    # Now write one.
    written = client.put(
        f"/api/receipt-items/{transaction.id}",
        json={
            "items": [
                {
                    "name": "AYAM PANGGANG",
                    "quantity": 2,
                    "unit_price": 35000,
                    "category_id": categories["Makanan & Minuman"],
                }
            ],
            "discount_total": 0,
            "tax_total": 0,
        },
    )
    assert written.status_code == 200, written.text
    body = written.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["name"] == "AYAM PANGGANG"
    assert body["items"][0]["quantity"] == 2
    assert body["items"][0]["unit_price"] == 35000
    assert body["items"][0]["total_price"] == 70000


def test_two_lines_of_one_receipt_can_have_two_categories(receipt_client, db):
    """
    The food is food and the latte is a drink.

    This is the whole reason the receipt can be edited: one piece of
    paper, and the reader wants the parts to go to different places.
    """
    client = receipt_client
    user_id = 1

    categories = _categories(db, user_id)
    transaction = _transaction(db, user_id)

    written = client.put(
        f"/api/receipt-items/{transaction.id}",
        json={
            "items": [
                {
                    "name": "AYAM PANGGANG",
                    "quantity": 1,
                    "unit_price": 35000,
                    "category_id": categories["Makanan & Minuman"],
                },
                {
                    "name": "RED VELVET LATTE",
                    "quantity": 1,
                    "unit_price": 28000,
                    "category_id": categories["Minuman"],
                },
            ],
            "discount_total": 0,
            "tax_total": 0,
        },
    )
    assert written.status_code == 200, written.text
    items = written.json()["items"]

    by_name = {item["name"]: item for item in items}
    assert by_name["AYAM PANGGANG"]["category"] == "Makanan & Minuman"
    assert by_name["RED VELVET LATTE"]["category"] == "Minuman"


def test_the_discount_and_the_tax_work_out_the_net_total(receipt_client, db):
    """
    The three numbers are kept apart, and the net comes out of them.

    A receipt that says the lines came to 100,000 and that 5,000 was
    taken off and 11,000 was tax has a net of 106,000, and the
    reader paid 106,000.
    """
    client = receipt_client
    user_id = 1

    transaction = _transaction(db, user_id, amount=106000)

    written = client.put(
        f"/api/receipt-items/{transaction.id}",
        json={
            "items": [
                {"name": "NASI GORENG", "quantity": 2, "unit_price": 50000},
            ],
            "discount_total": 5000,
            "tax_total": 11000,
        },
    )
    assert written.status_code == 200, written.text
    body = written.json()

    assert body["subtotal"] == 100000
    assert body["discount_total"] == 5000
    assert body["tax_total"] == 11000
    assert body["total_amount"] == 106000


def test_a_line_that_is_added_and_a_line_that_is_taken_away(receipt_client, db):
    """
    The receipt can be rewritten, not just read.

    A line the reader added is made, and a line they took away is
    taken away.
    """
    client = receipt_client
    user_id = 1

    transaction = _transaction(db, user_id)

    first = client.put(
        f"/api/receipt-items/{transaction.id}",
        json={
            "items": [
                {"name": "NASI", "quantity": 1, "unit_price": 25000},
                {"name": "AYAM", "quantity": 1, "unit_price": 30000},
            ],
            "discount_total": 0,
            "tax_total": 0,
        },
    )
    assert first.status_code == 200, first.text
    assert len(first.json()["items"]) == 2
    keep_id = first.json()["items"][0]["id"]

    second = client.put(
        f"/api/receipt-items/{transaction.id}",
        json={
            "items": [
                {"id": keep_id, "name": "NASI", "quantity": 2, "unit_price": 25000},
                {"name": "ES TEH", "quantity": 1, "unit_price": 5000},
            ],
            "discount_total": 0,
            "tax_total": 0,
        },
    )
    assert second.status_code == 200, second.text
    items = second.json()["items"]
    assert len(items) == 2
    names = sorted(item["name"] for item in items)
    assert names == ["ES TEH", "NASI"]
    nasi = next(item for item in items if item["name"] == "NASI")
    assert nasi["id"] == keep_id
    assert nasi["quantity"] == 2


def test_somebody_elses_transaction_is_not_reached(receipt_client, db):
    """
    A receipt is only ever read by the reader it belongs to.

    This is the same rule the rest of the application follows: a
    reader may not see another reader's rows.
    """
    client = receipt_client

    other = Transaction(
        user_id=999999,
        type="expense",
        amount=50000,
        description="Transaksi orang lain",
        account_id=_account(db, 999999).id,
        category_id=None,
        source="MANUAL",
    )
    db.add(other)
    db.commit()
    db.refresh(other)

    response = client.get(f"/api/receipt-items/{other.id}")
    assert response.status_code == 403

    # And writing to it is refused as well.
    written = client.put(
        f"/api/receipt-items/{other.id}",
        json={"items": [{"name": "X", "quantity": 1, "unit_price": 1}]},
    )
    assert written.status_code == 403
