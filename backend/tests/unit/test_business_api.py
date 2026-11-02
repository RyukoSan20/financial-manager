"""
The till of a merchant, tested over the wire.

The application is built here with a small database behind it, so
that a test can make a merchant, sell something, and check what came
back.

The tables are copied out of the models rather than written out by
hand, the same way the shared bill is tested. A hand-written table
drifts away from the model, and the first thing that breaks is a
column the model has and the table does not.

The case that matters most here is the last one: a client that sends
a total of its own has it ignored. The server works the money out,
because a total that the client can set is a total that can be wrong,
and a wrong total on a tax invoice is an audit.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.api.routes import business

# The tables the till needs, and the ones they point at.
BUSINESS_TABLES = (
    "users",
    "accounts",
    "merchants",
    "merchant_pos_products",
    "tax_rules",
    "business_transactions",
    "business_transaction_items",
    "business_transaction_taxes",
    "business_transaction_payments",
    "accounting_entries",
)


class TheReader:
    """
    The person using the application.

    A stand-in for the signed-in reader, with the two things the
    routes ask for: who it is and whether it is active.
    """

    id = 1
    email = "owner@example.test"
    is_active = True
    full_name = "The Owner"
    username = None


@pytest.fixture()
def business_client():
    """The application, with a small database behind it."""
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.merchant  # noqa: F401
    import app.models.merchant_product  # noqa: F401
    import app.models.tax_rule  # noqa: F401
    import app.models.business_transaction  # noqa: F401
    import app.models.business_transaction_item  # noqa: F401
    import app.models.business_transaction_tax  # noqa: F401
    import app.models.business_transaction_payment  # noqa: F401
    import app.models.accounting_entry  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    private = MetaData()

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

    for name in BUSINESS_TABLES:
        copy_table(name)

    private.create_all(engine)
    Session = sessionmaker(bind=engine)

    app = FastAPI()
    app.include_router(business.router, prefix="/api/business")

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


@pytest.fixture()
def a_merchant(business_client):
    """A merchant of the reader."""
    from app.models.merchant import Merchant

    session = business_client.db()
    merchant = Merchant(user_id=1, store_name="Toko uji", business_type="grocery")
    session.add(merchant)
    session.commit()
    merchant_id = merchant.id
    session.close()
    return merchant_id


def test_a_product_can_be_added_and_read_back(business_client, a_merchant):
    """A product of a till is written down and read back as it was."""
    answer = business_client.post(
        f"/api/business/merchants/{a_merchant}/products",
        json={
            "name": "Telur ayam",
            "sku": "TEL-01",
            "barcode": "8991234567890",
            "unit_of_measure": "box",
            "conversion_factor": "12",
            "unit_price": "36000",
            "stock_quantity": "24",
        },
    )

    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert body["name"] == "Telur ayam"
    assert body["conversion_factor"] == "12.000000"
    assert body["unit_price"] == "36000.00"

    listed = business_client.get(f"/api/business/merchants/{a_merchant}/products")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_the_money_of_a_sale_is_worked_out_by_the_server(business_client, a_merchant):
    """
    Two eggs at 5.000 each, with the sales tax on it. The tax is 11%
    of the price because ordinary goods are taxed on eleven twelfths
    of it.
    """
    answer = business_client.post(
        "/api/business/transactions",
        json={
            "merchant_id": a_merchant,
            "invoice_type": "POS_RECEIPT",
            "transaction_currency": "IDR",
            "seller_country": "ID",
            "items": [
                {
                    "item_name": "Telur ayam",
                    "quantity": "2",
                    "unit_price": "5000",
                    "unit_of_measure": "pcs",
                }
            ],
            "taxes": [{"tax_code": "PPN", "tax_type": "PPN"}],
        },
    )

    assert answer.status_code == 200, answer.text
    body = answer.json()

    assert body["subtotal_gross"] == "10000.00"
    assert body["total_tax_additive"] == "1100.00"
    assert body["grand_total"] == "11100.00"
    assert body["net_receivable_amount"] == "11100.00"
    assert body["items"][0]["gross_amount"] == "10000.00"
    assert body["items"][0]["net_item_amount"] == "10000.00"


def test_a_discount_on_the_whole_sale_is_shared_over_the_lines(business_client, a_merchant):
    """
    A discount of 1.000 over lines of 6.000 and 4.000 is shared 600
    and 400, and the total comes down by the whole discount.
    """
    answer = business_client.post(
        "/api/business/transactions",
        json={
            "merchant_id": a_merchant,
            "transaction_currency": "IDR",
            "items": [
                {"item_name": "A", "quantity": "1", "unit_price": "6000"},
                {"item_name": "B", "quantity": "1", "unit_price": "4000"},
            ],
            "transaction_discount_type": "FIXED_AMOUNT",
            "transaction_discount_amount": "1000",
            "discount_allocation_method": "PROPORTIONAL_VALUE",
        },
    )

    assert answer.status_code == 200, answer.text
    body = answer.json()

    assert body["items"][0]["allocated_header_discount"] == "600.00"
    assert body["items"][1]["allocated_header_discount"] == "400.00"
    assert body["items"][0]["net_item_amount"] == "5400.00"
    assert body["items"][1]["net_item_amount"] == "3600.00"
    assert body["grand_total"] == "9000.00"


def test_a_tax_that_is_withheld_does_not_make_the_bill_bigger(business_client, a_merchant):
    """
    The tax is taken out of what the merchant receives. It never goes
    on to the customer's bill.
    """
    answer = business_client.post(
        "/api/business/transactions",
        json={
            "merchant_id": a_merchant,
            "transaction_currency": "IDR",
            "items": [
                {"item_name": "Jasa", "quantity": "1", "unit_price": "1000000"}
            ],
            "taxes": [
                {
                    "tax_code": "PPh23",
                    "tax_type": "PH_WITHHOLDING",
                    "tax_behavior": "WITHHOLDING",
                    "tax_rate": "2",
                }
            ],
        },
    )

    assert answer.status_code == 200, answer.text
    body = answer.json()

    assert body["total_withholding_tax"] == "20000.00"
    assert body["total_tax_additive"] == "0.00"
    assert body["grand_total"] == "1000000.00"
    assert body["net_receivable_amount"] == "980000.00"


def test_a_total_the_client_sends_is_ignored(business_client, a_merchant):
    """
    The client does not compute the money.

    The request below sends a grand total of one rupiah and a net
    receivable of a thousand. Neither of them is in the request
    schema at all, and neither of them reaches the answer: the total
    is the sum of the lines and the tax, whatever the client said.
    """
    answer = business_client.post(
        "/api/business/transactions",
        json={
            "merchant_id": a_merchant,
            "transaction_currency": "IDR",
            "grand_total": "1",
            "net_receivable_amount": "999999",
            "subtotal_gross": "7",
            "total_tax_additive": "0",
            "items": [
                {"item_name": "A", "quantity": "1", "unit_price": "10000"}
            ],
            "taxes": [{"tax_code": "PPN", "tax_type": "PPN"}],
        },
    )

    assert answer.status_code == 200, answer.text
    body = answer.json()

    assert body["grand_total"] == "11100.00"
    assert body["net_receivable_amount"] == "11100.00"
    assert body["subtotal_gross"] == "10000.00"
    assert body["total_tax_additive"] == "1100.00"


def test_a_sale_can_be_paid_and_the_books_are_written(business_client, a_merchant):
    """
    A payment settles the sale, and the sale leaves entries in the
    merchant's books.
    """
    made = business_client.post(
        "/api/business/transactions",
        json={
            "merchant_id": a_merchant,
            "transaction_currency": "IDR",
            "items": [
                {"item_name": "A", "quantity": "1", "unit_price": "10000"}
            ],
        },
    )
    assert made.status_code == 200, made.text
    transaction_id = made.json()["id"]

    paid = business_client.post(
        f"/api/business/transactions/{transaction_id}/payments",
        json={"payment_method": "CASH", "amount_paid": "10000"},
    )
    assert paid.status_code == 200, paid.text

    entries = business_client.get(
        f"/api/business/transactions/{transaction_id}/accounting-entries"
    )
    assert entries.status_code == 200, entries.text
    codes = {entry["account_code"] for entry in entries.json()}
    assert "REVENUE" in codes
    assert "ACCOUNTS_RECEIVABLE" in codes

    # The sale is settled.
    after = business_client.get(f"/api/business/transactions/{transaction_id}")
    assert after.json()["payment_status"] == "PAID"
    assert after.json()["outstanding_amount"] == "0.00"


def test_a_sale_of_another_merchant_is_not_found(business_client, a_merchant):
    """
    A merchant of somebody else is not found at all. Saying "that is
    not yours" would tell a stranger that a merchant of that number
    exists.
    """
    from app.models.merchant import Merchant

    session = business_client.db()
    other = Merchant(user_id=99, store_name="Toko orang lain")
    session.add(other)
    session.commit()
    other_id = other.id
    session.close()

    answer = business_client.post(
        f"/api/business/merchants/{other_id}/products",
        json={"name": "Telur", "unit_price": "5000"},
    )
    assert answer.status_code == 404
