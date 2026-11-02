"""
The settings that only make sense in one kind of shop.

A warung has no payment term and no customs value. A studio has both.
A company that sells across borders has three currencies and a rate
between them.

Rather than give every shop every field and leave the person at the
counter to look past the ones that do not apply, the fields that only
belong to one mode are kept in a table of their own, one row per
shop. A warung simply has no row.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class MerchantBusinessProfile(Base):
    """The settings of one shop, for the mode it runs in."""

    __tablename__ = "merchant_business_profiles"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(
        Integer,
        ForeignKey("merchants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # --- invoicing ------------------------------------------------------
    invoice_prefix = Column(String(20), nullable=True)
    payment_terms_days = Column(Integer, nullable=True)
    default_invoice_type = Column(String(30), nullable=True)

    # --- cross-border ---------------------------------------------------
    transaction_currency = Column(String(3), nullable=True)
    functional_currency = Column(String(3), nullable=True)
    settlement_currency = Column(String(3), nullable=True)
    default_exchange_rate = Column(Numeric(20, 6), nullable=True)
    exchange_rate_source = Column(String(50), nullable=True)
    seller_country = Column(String(2), nullable=True)
    default_tax_region = Column(String(30), nullable=True)

    # --- the journal ----------------------------------------------------
    revenue_account_code = Column(String(50), nullable=True)
    cogs_account_code = Column(String(50), nullable=True)
    tax_payable_account_code = Column(String(50), nullable=True)
    withholding_account_code = Column(String(50), nullable=True)
    receivable_account_code = Column(String(50), nullable=True)
    auto_post_journal = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    merchant = relationship("Merchant")

    def __repr__(self):
        return f"<MerchantBusinessProfile merchant_id={self.merchant_id}>"
