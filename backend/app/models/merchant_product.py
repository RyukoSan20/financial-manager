"""
The products a merchant sells, described for a till.

There is already a table of the products a merchant sells: the one the
receipt scanner and the quick-sale screen write to. It was made for
scanning, so it keeps a float price and a whole-number stock, and it
has no room for the things a till needs: a barcode to scan, a unit the
stock is counted in, a box that holds twelve pieces, or a price that is
known to two decimal places.

So this is a second table, and not a change to the first one. The old
table keeps its columns and its meaning, because the screens that read
it are still there and they must not start answering differently. The
new table is the one a till writes to, and it is the one the tax engine
reads prices and units from.

`conversion_factor` is the number of base units in one selling unit.
A box of twelve eggs is sold by the box, and the stock is counted in
eggs, so one box is twelve eggs and the factor is 12. A kilo of rice
sold by the kilo has a factor of 1. Without this the stock cannot be
kept straight, because the same thing is bought one way and sold
another.

`unit_price` is the price of one selling unit, in the money of the
merchant, and it is kept as a decimal with two places. It is never a
float: a float cannot hold a third of a rupiah, and a till that is
out by a fraction of a rupiah on every line is a till nobody can
reconcile at the end of the day.
"""

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
from datetime import datetime

from app.core.database import Base


class MerchantPosProduct(Base):
    """
    One thing a merchant sells, described the way a till needs it.

    The name is what the shop calls it, and the SKU and the barcode
    are how it is found again: the SKU by a person, the barcode by a
    scanner.

    `unit_of_measure` says what a single selling unit is. The values
    are `pcs`, `kg`, `liter`, `jam`, `meter`, `box` and `renceng`.
    `jam` is the Indonesian bundle of five, and `renceng` is the small
    pack of rice or spices; both are units the shop actually counts
    in, and neither of them has a name outside Indonesia.

    `min_qty`, `max_qty` and `free_quantity` are the promotion: buy
    three and get one free, so the minimum that triggers the offer is
    three, the maximum the offer applies to is four, and the free one
    is one. They are kept on the product so that the till can check
    the basket without being told the rules again for every basket.

    `stock_quantity` is how many base units are on the shelf, and it
    is counted in base units, so it can be compared with the
    conversion factor rather than with the selling unit.
    """

    __tablename__ = "merchant_pos_products"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(
        Integer, ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # What the shop calls the thing.
    name = Column(String(255), nullable=False)

    # How the shop finds it again. The SKU is written by a person and
    # the barcode is read by a scanner, and either may be missing for
    # a loose item that has no label.
    sku = Column(String(50), nullable=True, index=True)
    barcode = Column(String(64), nullable=True, index=True)

    # A picture of the thing, so the till screen can show it. It is a
    # data address, not a file: the picture lives wherever the
    # merchant's pictures live.
    image_url = Column(String(255), nullable=True)

    # The shelf the thing is on, in the merchant's own words.
    category = Column(String(100), nullable=True)

    # How many base units are on the shelf.
    stock_quantity = Column(Numeric(18, 6), default=0, nullable=False)

    # What one selling unit is. See the note in the module docstring.
    unit_of_measure = Column(String(20), default="pcs", nullable=False)

    # How many base units one selling unit holds. A box of twelve is
    # twelve, a kilo is one.
    conversion_factor = Column(Numeric(18, 6), default=1, nullable=False)

    # The price of one selling unit.
    unit_price = Column(Numeric(20, 2), default=0, nullable=False)

    # The promotion: the smallest and the largest quantity the offer
    # applies to, and how many of them come free.
    min_qty = Column(Numeric(18, 6), nullable=True)
    max_qty = Column(Numeric(18, 6), nullable=True)
    free_quantity = Column(Numeric(18, 6), default=0, nullable=False)

    # Whether the thing is still sold. A product is never deleted,
    # because a receipt that names it is a record of what happened.
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    merchant = relationship("Merchant")

    def __repr__(self):
        return f"<MerchantPosProduct {self.name}>"
