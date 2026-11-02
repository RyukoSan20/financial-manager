"""
The shop's day, as the till and the dashboard agree on it.

There were two sets of books.

The till sold through `business_transactions`, which is where the
lines of a sale and the tax on them live. The dashboard read
`transactions`, which is the older table of the reader's own money.
So a shop could sell all morning and the dashboard would say it had
made nothing, and the reader would be looking at a number that was
not wrong about anything except being about a different thing.

The two are now read together: the sales are the sales of the till,
and the older rows are still counted, because a reader who recorded a
sale by hand has still made a sale.

Also checked here: a payment made through the till is what the shop
has taken, so it counts towards the day's takings even before the
sale itself is marked as paid.
"""

import os
import sys
from datetime import date, datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture()
def db():
    """A database of the shop's own tables, and nothing else."""
    from app.core.database import Base
    from app.models.business_transaction import BusinessTransaction
    from app.models.business_transaction_item import BusinessTransactionItem
    from app.models.business_transaction_payment import BusinessTransactionPayment
    from app.models.merchant import DailySettlement, Merchant
    from app.models.transaction import Transaction
    from app.models.user import User

    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            User.__table__,
            Transaction.__table__,
            Merchant.__table__,
            DailySettlement.__table__,
            BusinessTransaction.__table__,
            BusinessTransactionItem.__table__,
            BusinessTransactionPayment.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def _make_user(db):
    from app.models.user import User

    user = User(email="shop@example.com", hashed_password="x", full_name="Shop")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_merchant(db, user):
    from app.models.merchant import Merchant

    merchant = Merchant(
        user_id=user.id,
        store_name="Warung Madura",
        business_type="retail",
        is_active=True,
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    return merchant


def _make_sale(db, merchant, total, when=None, invoice="INV-1"):
    from app.models.business_transaction import BusinessTransaction

    when = when or datetime.now()
    sale = BusinessTransaction(
        merchant_id=merchant.id,
        invoice_number=invoice,
        invoice_type="POS_RECEIPT",
        transaction_date=when,
        grand_total=total,
        net_receivable_amount=total,
        payment_status="UNPAID",
        seller_country="ID",
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)
    return sale


def test_a_sale_through_the_till_is_counted_in_the_day(db):
    """
    The whole point. A sale made through the till has to show up in
    the day's takings.
    """
    from app.api.routes.merchant import get_merchant_summary
    from app.models.user import User

    user = _make_user(db)
    merchant = _make_merchant(db, user)
    _make_sale(db, merchant, 3885)

    class _Current:
        id = user.id

    summary = get_merchant_summary(merchant.id, _Current(), db)

    assert float(summary.today_sales) == 3885.0, (
        "a sale through the till was not counted in the day's takings"
    )
    assert summary.today_transactions == 1


def test_a_sale_from_another_day_is_not_counted(db):
    """
    Yesterday is not today.
    """
    from app.api.routes.merchant import get_merchant_summary

    user = _make_user(db)
    merchant = _make_merchant(db, user)
    yesterday = datetime.now().replace(day=1)
    _make_sale(db, merchant, 5000, when=yesterday, invoice="INV-old")

    class _Current:
        id = user.id

    summary = get_merchant_summary(merchant.id, _Current(), db)

    assert float(summary.today_sales) == 0.0
    assert summary.today_transactions == 0


def test_the_money_taken_by_cash_and_by_qris_is_told_apart(db):
    """
    A shopkeeper needs to know how much came in as cash and how much
    came in by QRIS, because they are not the same money.
    """
    from app.api.routes.merchant import get_merchant_summary
    from app.models.business_transaction_payment import BusinessTransactionPayment

    user = _make_user(db)
    merchant = _make_merchant(db, user)

    cash_sale = _make_sale(db, merchant, 10000, invoice="INV-cash")
    qris_sale = _make_sale(db, merchant, 20000, invoice="INV-qris")

    db.add(
        BusinessTransactionPayment(
            transaction_id=cash_sale.id,
            payment_method="CASH",
            payment_currency="IDR",
            amount_paid=10000,
        )
    )
    db.add(
        BusinessTransactionPayment(
            transaction_id=qris_sale.id,
            payment_method="QRIS",
            payment_currency="IDR",
            amount_paid=20000,
        )
    )
    db.commit()

    class _Current:
        id = user.id

    summary = get_merchant_summary(merchant.id, _Current(), db)

    assert float(summary.total_cash) == 10000.0
    assert float(summary.total_qris) == 20000.0
    assert float(summary.today_sales) == 30000.0


def test_the_shop_of_another_reader_is_not_counted(db):
    """
    A reader only sees their own shop.
    """
    from app.api.routes.merchant import get_merchant_summary
    from fastapi import HTTPException

    user = _make_user(db)
    merchant = _make_merchant(db, user)

    class _Other:
        id = user.id + 999

    with pytest.raises(HTTPException) as caught:
        get_merchant_summary(merchant.id, _Other(), db)

    assert caught.value.status_code == 404
