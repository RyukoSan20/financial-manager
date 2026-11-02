"""
What a mode does to a sale, once the sale is being made.

A warung is not asked about customs value, and if a client sends it
anyway it does not reach the table. A studio may say that tax was
withheld, and the money the studio keeps is less than the money the
customer paid. A company that sells across borders may sell in euros,
and the rate between the euro and the rupiah is kept with the sale so
that the rate of the day can be looked up later.

These are the tests of the behaviour, not of the labels.
"""

import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture()
def db():
    from app.core.database import Base
    from app.models.account import Account
    from app.models.merchant import Merchant
    from app.models.merchant_business_profile import MerchantBusinessProfile
    from app.models.merchant_product import MerchantPosProduct
    from app.models.business_transaction import BusinessTransaction
    from app.models.business_transaction_item import BusinessTransactionItem
    from app.models.business_transaction_payment import BusinessTransactionPayment
    from app.models.business_transaction_tax import BusinessTransactionTax
    from app.models.accounting_entry import AccountingEntry
    from app.models.tax_rule import TaxRule
    from app.models.transaction import Transaction
    from app.models.user import User

    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            User.__table__,
            Account.__table__,
            Transaction.__table__,
            Merchant.__table__,
            MerchantBusinessProfile.__table__,
            MerchantPosProduct.__table__,
            BusinessTransaction.__table__,
            BusinessTransactionItem.__table__,
            BusinessTransactionTax.__table__,
            BusinessTransactionPayment.__table__,
            AccountingEntry.__table__,
            TaxRule.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def _user(db):
    from app.models.user import User

    user = User(email="shop@example.com", hashed_password="x", full_name="Shop")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _merchant(db, user, profile):
    from app.models.merchant import Merchant

    merchant = Merchant(
        user_id=user.id,
        store_name="Warung Madura",
        business_type="retail",
        business_profile=profile,
        is_active=True,
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    return merchant


def _line(name="Indomie Goreng", price="3500", qty="1"):
    return {
        "item_name": name,
        "quantity": Decimal(qty),
        "unit_of_measure": "pcs",
        "unit_price": Decimal(price),
    }


def _make(db, user, merchant, payload, taxes=None):
    from app.api.routes.business import create_transaction
    from app.api.routes.business import TransactionCreate

    data = TransactionCreate(
        merchant_id=merchant.id,
        items=[_line()],
        taxes=taxes or [],
        **payload,
    )

    class _Current:
        id = user.id

    return create_transaction(data, _Current(), db)


class TestTheWarungDoesNotAskAboutCustoms:
    def test_a_customs_value_sent_anyway_does_not_reach_the_table(self, db):
        """
        A client that sends a field the shop is never asked for should
        not be able to put it in the table. An empty customs value
        would look like a fact about the sale.
        """
        from app.models.business_transaction import BusinessTransaction

        user = _user(db)
        merchant = _merchant(db, user, "UMKM")

        _make(
            db,
            user,
            merchant,
            {
                "invoice_number": "INV-1",
                "customs_value": Decimal("5000000"),
                "incoterms": "FOB",
                "transaction_currency": "EUR",
                "exchange_rate": Decimal("16250"),
            },
        )

        row = db.query(BusinessTransaction).one()
        assert row.customs_value is None
        assert row.incoterms is None
        assert row.transaction_currency == "IDR"
        # There was no conversion, so the rate is one and the source
        # says that is what it means.
        assert float(row.exchange_rate) == 1.0
        assert row.exchange_rate_source == "identity"

    def test_the_receipt_of_a_warung_is_a_receipt(self, db):
        from app.models.business_transaction import BusinessTransaction

        user = _user(db)
        merchant = _merchant(db, user, "UMKM")

        _make(db, user, merchant, {"invoice_type": "TAX_INVOICE"})

        row = db.query(BusinessTransaction).one()
        assert row.invoice_type == "POS_RECEIPT"


class TestTheStudioWithholdsTheTax:
    def test_the_money_the_studio_keeps_is_less_than_what_the_customer_paid(self, db):
        """
        A tax that is withheld is the seller's own money being taken.
        The customer is not charged extra for it, but the studio does
        not bank it.
        """
        from app.models.business_transaction import BusinessTransaction

        user = _user(db)
        merchant = _merchant(db, user, "B2B")

        result = _make(
            db,
            user,
            merchant,
            {"invoice_number": "INV-2"},
            taxes=[
                {
                    "tax_code": "PPH_23",
                    "tax_type": "PPH_WITHHOLDING",
                    "tax_rate": Decimal("2"),
                    "tax_base_method": "FULL_NET",
                    "tax_behavior": "WITHHOLDING",
                }
            ],
        )

        row = db.query(BusinessTransaction).one()
        # The customer pays the price of the noodles.
        assert float(row.grand_total) == 3500.0
        # The studio keeps less, because two percent was taken.
        assert float(row.total_withholding_tax) == 70.0
        assert float(row.net_receivable_amount) == 3430.0

    def test_the_withheld_tax_is_kept_as_its_own_row(self, db):
        from app.models.business_transaction_tax import BusinessTransactionTax

        user = _user(db)
        merchant = _merchant(db, user, "B2B")

        _make(
            db,
            user,
            merchant,
            {"invoice_number": "INV-3"},
            taxes=[
                {
                    "tax_code": "PPH_23",
                    "tax_type": "PPH_WITHHOLDING",
                    "tax_rate": Decimal("2"),
                    "tax_base_method": "FULL_NET",
                    "tax_behavior": "WITHHOLDING",
                }
            ],
        )

        tax = db.query(BusinessTransactionTax).one()
        assert tax.tax_behavior == "WITHHOLDING"
        assert float(tax.taxable_amount) == 3500.0
        assert float(tax.tax_amount) == 70.0
        # The rate, the base and the result are kept apart.
        assert float(tax.tax_rate) == 2.0

    def test_a_warung_cannot_withhold(self, db):
        """
        The warung is never offered the tax to withhold, so a client
        that sends it anyway does not get it applied.
        """
        from app.models.business_transaction import BusinessTransaction

        user = _user(db)
        merchant = _merchant(db, user, "UMKM")

        _make(
            db,
            user,
            merchant,
            {"invoice_number": "INV-4"},
            taxes=[
                {
                    "tax_code": "PPH_23",
                    "tax_type": "PPH_WITHHOLDING",
                    "tax_rate": Decimal("2"),
                    "tax_base_method": "FULL_NET",
                    "tax_behavior": "WITHHOLDING",
                }
            ],
        )

        row = db.query(BusinessTransaction).one()
        assert float(row.total_withholding_tax) == 0.0
        assert float(row.net_receivable_amount) == 3500.0


class TestTheCompanyAcrossBorders:
    def test_the_three_currencies_are_kept_apart(self, db):
        from app.models.business_transaction import BusinessTransaction

        user = _user(db)
        merchant = _merchant(db, user, "CROSS_BORDER")

        _make(
            db,
            user,
            merchant,
            {
                "invoice_number": "INV-5",
                "transaction_currency": "EUR",
                "functional_currency": "IDR",
                "settlement_currency": "EUR",
                "exchange_rate": Decimal("16250.50"),
                "exchange_rate_date": datetime(2026, 11, 3),
                "exchange_rate_source": "bi",
                "seller_country": "ID",
                "customer_country": "DE",
                "incoterms": "DAP",
                "customs_value": Decimal("100"),
            },
        )

        row = db.query(BusinessTransaction).one()
        assert row.transaction_currency == "EUR"
        assert row.functional_currency == "IDR"
        assert row.settlement_currency == "EUR"
        assert float(row.exchange_rate) == 16250.50
        assert row.exchange_rate_source == "bi"
        assert row.incoterms == "DAP"

    def test_where_the_rate_was_not_told_it_is_one(self, db):
        """
        A rate of zero would be a claim that the currency is
        worthless.
        """
        from app.models.business_transaction import BusinessTransaction

        user = _user(db)
        merchant = _merchant(db, user, "CROSS_BORDER")

        _make(db, user, merchant, {"invoice_number": "INV-6"})

        row = db.query(BusinessTransaction).one()
        assert float(row.exchange_rate) == 1.0
        assert row.exchange_rate_source == "identity"

    def test_a_warung_cannot_sell_in_euros(self, db):
        from app.models.business_transaction import BusinessTransaction

        user = _user(db)
        merchant = _merchant(db, user, "UMKM")

        _make(
            db,
            user,
            merchant,
            {
                "invoice_number": "INV-7",
                "transaction_currency": "EUR",
                "exchange_rate": Decimal("16250"),
            },
        )

        row = db.query(BusinessTransaction).one()
        assert row.transaction_currency == "IDR"


class TestTheShopOfAnotherReader:
    def test_the_sale_of_another_shop_is_not_made(self, db):
        from fastapi import HTTPException

        from app.api.routes.business import create_transaction
        from app.api.routes.business import TransactionCreate

        user = _user(db)
        merchant = _merchant(db, user, "UMKM")

        data = TransactionCreate(merchant_id=merchant.id, items=[_line()])

        class _Other:
            id = user.id + 999

        with pytest.raises(HTTPException) as caught:
            create_transaction(data, _Other(), db)

        assert caught.value.status_code == 404
