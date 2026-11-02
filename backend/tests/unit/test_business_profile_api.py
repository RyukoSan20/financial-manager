"""
What the browser is told about a shop.

The browser must not keep its own copy of which fields apply to which
kind of shop, because a copy drifts. These tests check that the
server tells it, and that it tells it correctly.
"""

import sys
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


def _merchant(db, user, profile="UMKM"):
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


class TestTheThreeKindsOfShop:
    def test_the_three_are_listed(self, db):
        """
        The browser asks the server what the modes are, rather than
        knowing them.
        """
        from app.api.routes.merchant import list_business_profiles

        result = list_business_profiles(_user(db))
        assert len(result["profiles"]) == 3

    def test_the_list_carries_what_each_mode_is_asked_for(self, db):
        from app.api.routes.merchant import list_business_profiles

        result = list_business_profiles(_user(db))
        by_profile = {p["profile"]: p for p in result["profiles"]}

        assert by_profile["UMKM"]["fields"]["customs_fields"]["shown"] is False
        assert by_profile["B2B"]["fields"]["payment_terms"]["required"] is True
        assert by_profile["CROSS_BORDER"]["fields"]["multi_currency"]["shown"] is True


class TestTheShopItself:
    def test_a_new_shop_is_a_warung(self, db):
        """
        A shop that has not said what it is has not been asked for too
        much.
        """
        from app.api.routes.merchant import create_merchant
        from app.api.routes.merchant import MerchantCreate

        user = _user(db)

        class _Current:
            id = user.id

        merchant = create_merchant(
            MerchantCreate(store_name="Warung Madura"), _Current(), db
        )
        assert merchant.business_profile == "UMKM"

    def test_a_shop_may_say_what_it_is(self, db):
        from app.api.routes.merchant import create_merchant
        from app.api.routes.merchant import MerchantCreate

        user = _user(db)

        class _Current:
            id = user.id

        merchant = create_merchant(
            MerchantCreate(store_name="Studio", business_profile="B2B"),
            _Current(),
            db,
        )
        assert merchant.business_profile == "B2B"

    def test_a_name_written_the_way_a_person_would_write_it_is_understood(self, db):
        from app.api.routes.merchant import create_merchant
        from app.api.routes.merchant import MerchantCreate

        user = _user(db)

        class _Current:
            id = user.id

        merchant = create_merchant(
            MerchantCreate(store_name="X", business_profile="cross-border"),
            _Current(),
            db,
        )
        assert merchant.business_profile == "CROSS_BORDER"

    def test_the_profile_of_a_shop_is_read_back(self, db):
        from app.api.routes.merchant import get_business_profile

        user = _user(db)
        merchant = _merchant(db, user, profile="B2B")

        class _Current:
            id = user.id

        result = get_business_profile(merchant.id, _Current(), db)

        assert result.profile == "B2B"
        assert result.capabilities["fields"]["payment_terms"]["required"] is True
        assert result.capabilities["fields"]["customs_fields"]["shown"] is False

    def test_the_shop_of_another_reader_is_not_found(self, db):
        from fastapi import HTTPException

        from app.api.routes.merchant import get_business_profile

        user = _user(db)
        merchant = _merchant(db, user)

        class _Other:
            id = user.id + 999

        with pytest.raises(HTTPException) as caught:
            get_business_profile(merchant.id, _Other(), db)

        assert caught.value.status_code == 404


class TestTheSettingsOfTheShop:
    def test_a_warung_has_no_settings_row_until_it_needs_one(self, db):
        """
        The warung is not asked for anything it does not have.
        """
        from app.api.routes.merchant import get_business_profile
        from app.models.merchant_business_profile import MerchantBusinessProfile

        user = _user(db)
        merchant = _merchant(db, user)

        class _Current:
            id = user.id

        result = get_business_profile(merchant.id, _Current(), db)
        assert result.settings.payment_terms_days is None

        rows = db.query(MerchantBusinessProfile).filter(
            MerchantBusinessProfile.merchant_id == merchant.id
        ).all()
        assert rows == []

    def test_a_studio_keeps_its_payment_term(self, db):
        from app.api.routes.merchant import (
            get_business_profile,
            update_business_profile,
        )
        from app.api.routes.merchant import BusinessProfileSettings

        user = _user(db)
        merchant = _merchant(db, user, profile="B2B")

        class _Current:
            id = user.id

        update_business_profile(
            merchant.id,
            BusinessProfileSettings(payment_terms_days=30, invoice_prefix="INV"),
            _Current(),
            db,
        )

        result = get_business_profile(merchant.id, _Current(), db)
        assert result.settings.payment_terms_days == 30
        assert result.settings.invoice_prefix == "INV"

    def test_the_settings_are_saved_once_and_then_kept(self, db):
        from app.api.routes.merchant import update_business_profile
        from app.api.routes.merchant import BusinessProfileSettings
        from app.models.merchant_business_profile import MerchantBusinessProfile

        user = _user(db)
        merchant = _merchant(db, user, profile="CROSS_BORDER")

        class _Current:
            id = user.id

        update_business_profile(
            merchant.id,
            BusinessProfileSettings(transaction_currency="EUR", seller_country="DE"),
            _Current(),
            db,
        )
        update_business_profile(
            merchant.id,
            BusinessProfileSettings(transaction_currency="SGD"),
            _Current(),
            db,
        )

        rows = db.query(MerchantBusinessProfile).filter(
            MerchantBusinessProfile.merchant_id == merchant.id
        ).all()
        assert len(rows) == 1, "the settings should be kept once, not made again"
        assert rows[0].transaction_currency == "SGD"
