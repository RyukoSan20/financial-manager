"""
The tax simulator, and the rules of the world, tested over the wire.

The simulator is the screen a merchant opens before they have decided
anything: they type a price, they choose a tax, and the screen says
what the sale would come to.

Two things are checked here, and they are the two things that could go
wrong.

The first: the simulator and the real sale must agree. A simulator
that says one thing and a till that writes down another is worse than
no simulator at all, because the merchant trusted the number on the
screen.

The second: the simulator must write nothing down. A merchant who
tries a price a hundred times must not have sold a hundred times.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.api.routes import business


def same_money(left, right):
    """
    Are these two the same amount of money?

    The engine rounds to the exponent of the currency, so a rupiah
    amount comes back as "11100". The column it is written to keeps
    two places, so the same amount comes back from the database as
    "11100.00". They are the same number, and the comparison is made
    on the number rather than on the writing of it.
    """
    return Decimal(str(left)) == Decimal(str(right))

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
    """The person using the application."""

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


def test_the_simulator_and_the_real_sale_agree(business_client, a_merchant):
    """
    The number on the screen is the number that would be written down.

    The simulator works a sale out and throws it away. The real sale
    works the same sale out and keeps it. They have to come to the
    same figure, because the merchant trusted the one on the screen.
    """
    payload = {
        "merchant_id": a_merchant,
        "transaction_currency": "IDR",
        "seller_country": "ID",
        "items": [
            {"item_name": "Telur ayam", "quantity": "2", "unit_price": "5000"}
        ],
        "taxes": [{"tax_code": "PPN", "tax_type": "PPN"}],
    }

    simulated = business_client.post("/api/business/simulate", json=payload)
    assert simulated.status_code == 200, simulated.text
    estimated = simulated.json()

    sold = business_client.post("/api/business/transactions", json=payload)
    assert sold.status_code == 200, sold.text
    written = sold.json()

    assert same_money(estimated["totals"]["grand_total"], written["grand_total"])
    assert same_money(
        estimated["totals"]["total_tax_additive"], written["total_tax_additive"]
    )
    assert same_money(
        estimated["totals"]["net_receivable_amount"],
        written["net_receivable_amount"],
    )


def test_the_simulator_writes_nothing_down(business_client, a_merchant):
    """
    A merchant who tries a price a hundred times has sold nothing.

    This is the whole point of the simulator. If it wrote the sale
    down, every attempt would take an invoice number and leave an
    entry in the books, and the merchant would have to reconcile a
    hundred sales they never made.
    """
    from app.models.business_transaction import BusinessTransaction

    for _ in range(5):
        answer = business_client.post(
            "/api/business/simulate",
            json={
                "merchant_id": a_merchant,
                "transaction_currency": "IDR",
                "items": [
                    {"item_name": "A", "quantity": "1", "unit_price": "10000"}
                ],
            },
        )
        assert answer.status_code == 200, answer.text

    session = business_client.db()
    try:
        count = session.query(BusinessTransaction).count()
    finally:
        session.close()

    assert count == 0, "the simulator wrote a sale down"


def test_the_simulator_gives_the_rate_the_base_and_the_amount(business_client, a_merchant):
    """
    Three separate numbers, because they answer three separate
    questions.

    The rate is what the law says. The base is what the rate is
    charged on, which for ordinary goods is eleven twelfths of the
    price. The amount is what comes to. A reader who is shown only
    one of the three cannot check the other two.
    """
    answer = business_client.post(
        "/api/business/simulate",
        json={
            "merchant_id": a_merchant,
            "transaction_currency": "IDR",
            "items": [
                {"item_name": "A", "quantity": "1", "unit_price": "10000"}
            ],
            "taxes": [{"tax_code": "PPN", "tax_type": "PPN"}],
        },
    )

    assert answer.status_code == 200, answer.text
    taxes = answer.json()["taxes"]
    assert len(taxes) == 1

    tax = taxes[0]
    assert same_money(tax["tax_rate"], 12)
    # The base is eleven twelfths of 10.000, which is 9.166,67. A
    # rupiah has no cents, so the base is shown as a whole rupiah:
    # 9.167. The tax is not a guess though - twelve percent of the
    # exact base is exactly 1.100, so the tax is 1.100 and not 1.100
    # and a bit.
    assert same_money(tax["taxable_amount"], "9167")
    assert abs(Decimal(str(tax["taxable_amount"])) - Decimal("9166.67")) < 1
    assert same_money(tax["tax_amount"], "1100.00")
    assert tax["tax_base_method"] == "DPP_NILAI_LAIN_11_12"


def test_the_rules_of_the_world_can_be_read(business_client, a_merchant):
    """
    A screen that offers the taxes needs to know which ones are
    loaded, because a tax that is not in the table is a tax the engine
    cannot work out.
    """
    from app.services.tax_rule_seed import seed_tax_rules

    session = business_client.db()
    try:
        written = seed_tax_rules(session)
    finally:
        session.close()
    assert written > 0

    answer = business_client.get("/api/business/tax-rules?country_code=ID")
    assert answer.status_code == 200, answer.text
    rules = answer.json()

    codes = {rule["tax_code"] for rule in rules}
    assert "PPN" in codes
    assert "PBJT" in codes

    for rule in rules:
        assert rule["country_code"] == "ID"
        assert rule["nominal_rate"] is not None
        assert rule["tax_behavior"]


def test_seeding_the_rules_twice_does_not_duplicate_them(business_client):
    """
    The rules are written at every start of the application. A rule
    that is already there is left alone, so the second start does not
    put a second copy of the law in the table.
    """
    from app.services.tax_rule_seed import seed_tax_rules

    session = business_client.db()
    try:
        first = seed_tax_rules(session)
        second = seed_tax_rules(session)
    finally:
        session.close()

    assert first > 0
    assert second == 0


def test_a_thing_on_the_shelf_can_be_changed(business_client, a_merchant):
    """
    A price that was repriced this morning has to show the new price
    this morning. A till that shows yesterday's price cannot be
    reconciled at the end of the day.
    """
    made = business_client.post(
        f"/api/business/merchants/{a_merchant}/products",
        json={"name": "Telur", "unit_price": "5000", "stock_quantity": "10"},
    )
    assert made.status_code == 200, made.text
    product_id = made.json()["id"]

    changed = business_client.put(
        f"/api/business/merchants/{a_merchant}/products/{product_id}",
        json={"unit_price": "5500"},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["unit_price"] == "5500.00"


def test_a_thing_taken_off_the_shelf_is_still_in_the_books(business_client, a_merchant):
    """
    A receipt that names a thing is a record of what happened, so the
    row stays. The shelf only shows what is still being sold.
    """
    made = business_client.post(
        f"/api/business/merchants/{a_merchant}/products",
        json={"name": "Telur", "unit_price": "5000", "stock_quantity": "10"},
    )
    assert made.status_code == 200, made.text
    product_id = made.json()["id"]

    taken = business_client.put(
        f"/api/business/merchants/{a_merchant}/products/{product_id}",
        json={"is_active": False},
    )
    assert taken.status_code == 200, taken.text
    assert taken.json()["is_active"] is False

    on_the_shelf = business_client.get(
        f"/api/business/merchants/{a_merchant}/products"
    )
    assert on_the_shelf.status_code == 200
    assert len(on_the_shelf.json()) == 0, "the thing is still on the shelf"

    in_the_books = business_client.get(
        f"/api/business/merchants/{a_merchant}/products?include_inactive=true"
    )
    assert in_the_books.status_code == 200
    assert len(in_the_books.json()) == 1, "the thing is not in the books"
