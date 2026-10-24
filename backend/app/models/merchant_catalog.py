"""
Catalogue of the shops and products the user actually deals with.

The existing `Merchant` model describes a business *the user runs*: it
has a QRIS configuration, a settlement schedule and a link to the sales
account. That is the wrong shape for "the minimarket I buy my coffee at".

This model is the catalogue of the merchants the user *spends money at*.
It is created automatically the first time a receipt from an unknown shop
is scanned, and it is what makes a receipt from a shop the user has never
scanned before work: the shop is learned instead of discarded.

`ProductCatalog` already exists for products but it is global. The user
column added here makes the product catalogue per user, so one user's
"Chilsung Cider" does not become a global truth.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class MerchantCatalog(Base):
    """
    A shop the user spends money at.

    Created automatically by the receipt scanner the first time a shop is
    seen, and by the AI agent when the user names a merchant in a
    conversation.
    """

    __tablename__ = "merchant_catalog"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # The name as it was read from the receipt.
    name = Column(String(255), nullable=False)
    # A cleaned-up version used for matching.
    normalized_name = Column(String(255), nullable=True, index=True)
    # minimarket, supermarket, apotek, restoran, ...
    merchant_type = Column(String(50), nullable=True)
    # The icon the user picked for this shop. The system fills in a
    # sensible one when the shop is first learned, and the user can
    # change it to any of the icons in the catalogue.
    icon = Column(String(16), nullable=True)
    address = Column(Text, nullable=True)

    # How many times this shop has been seen.
    scan_count = Column(Integer, default=0)
    # How much has been spent here in total.
    total_spent = Column(Numeric(20, 2), default=0)
    last_seen_at = Column(DateTime, default=datetime.utcnow)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="merchant_catalog")

    __table_args__ = (
        Index("ix_merchant_catalog_user_name", "user_id", "normalized_name"),
    )

    def __repr__(self):
        return f"<MerchantCatalog {self.name!r}>"


class UserProduct(Base):
    """
    A product the user has bought.

    The global `ProductCatalog` holds the shared reference data. This
    table holds what *this* user has bought, under the name it appears on
    *their* receipts, so the scanner can recognise it next time.

    A product is never rejected for being unknown: it is created here on
    first sight and matched by fuzzy comparison afterwards.
    """

    __tablename__ = "user_products"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # The name as it was read from the receipt.
    name = Column(String(255), nullable=False)
    normalized_name = Column(String(255), nullable=True, index=True)
    # The cleaned name the system prefers to show.
    canonical_name = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True)
    # The icon the user picked for this product.
    icon = Column(String(16), nullable=True)

    # The shop this product was bought at. Without it the catalogue
    # cannot say "these three things came from Indomaret".
    merchant_catalog_id = Column(
        Integer,
        ForeignKey("merchant_catalog.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Reference prices, learned from the receipts.
    typical_price = Column(Numeric(20, 2), nullable=True)
    min_price = Column(Numeric(20, 2), nullable=True)
    max_price = Column(Numeric(20, 2), nullable=True)
    purchase_count = Column(Integer, default=0)
    last_seen_at = Column(DateTime, default=datetime.utcnow)

    # Link to the shared catalogue entry, when there is one.
    catalog_id = Column(Integer, ForeignKey("product_catalog.id", ondelete="SET NULL"), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="user_products")
    catalog = relationship("ProductCatalog")
    merchant = relationship("MerchantCatalog", backref="products")

    __table_args__ = (
        Index("ix_user_products_user_name", "user_id", "normalized_name"),
    )

    def __repr__(self):
        return f"<UserProduct {self.name!r}>"
