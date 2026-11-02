"""
The lines of a sale.

Each line is one thing that was sold, and it holds both what was
asked for and what it came to. The two are kept apart because they
answer different questions: `quantity` is what the customer wanted,
and `gross_amount` is what it cost.

The discount on the line is kept in two parts. `line_discount_amount`
is the discount that belongs to this line on its own. The discount
that belongs to the whole sale is shared out over the lines, and
`allocated_header_discount` is this line's share of it. Both are
subtracted before the tax is worked out, because a discount on a
sale is a discount on the price, and the price is what the tax is
charged on.

The unit is kept twice as well. `unit_of_measure` is the unit the
price is written in, and `base_uom_quantity` is the same amount
counted in the base unit, which is what the stock is counted in. A
line of two boxes of eggs is two boxes and twenty-four eggs.
"""

from sqlalchemy import (
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


class BusinessTransactionItem(Base):
    """
    One line of a sale.

    `quantity_precision` says how many decimal places the quantity is
    written with, so that a line of 1.5 kilos of rice is not shown as
    1 kg when it is printed.

    `discount_type` is PERCENTAGE, FIXED_AMOUNT or NONE, and
    `discount_rate` is the percentage when the type says so.

    `coupon_code` and `promotion_id` are why the discount was given.
    They are kept so that the shop can see which coupon is worth
    keeping and which is not.
    """

    __tablename__ = "business_transaction_items"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(
        Integer,
        ForeignKey("business_transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The product this line came from, when the sale was made from
    # the catalogue. It is null for a line the cashier typed in.
    product_id = Column(
        Integer,
        ForeignKey("merchant_pos_products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # What the line is called, and how it is found again. Both are
    # written down on the line, so that a sale still reads properly
    # after the product it names has been renamed or withdrawn.
    item_name = Column(String(255), nullable=False)
    sku = Column(String(50), nullable=True, index=True)

    # How many, and in what unit.
    quantity = Column(Numeric(18, 6), default=1, nullable=False)
    quantity_precision = Column(Integer, default=0, nullable=False)
    unit_of_measure = Column(String(20), default="pcs", nullable=False)

    # How many base units one selling unit holds, and the same
    # quantity counted in base units.
    conversion_factor = Column(Numeric(18, 6), default=1, nullable=False)
    base_uom_quantity = Column(Numeric(18, 6), default=1, nullable=False)

    # The price of one selling unit, before any discount.
    unit_price = Column(Numeric(20, 2), default=0, nullable=False)

    # How many came free, and the promotion that gave them.
    free_quantity = Column(Numeric(18, 6), default=0, nullable=False)
    min_qty = Column(Numeric(18, 6), nullable=True)
    max_qty = Column(Numeric(18, 6), nullable=True)

    # The discount on this line, and the part of the discount on the
    # whole sale that was shared out to this line.
    discount_type = Column(String(20), default="NONE", nullable=True)
    discount_rate = Column(Numeric(9, 4), default=0, nullable=True)
    line_discount_amount = Column(Numeric(20, 2), default=0, nullable=False)
    allocated_header_discount = Column(Numeric(20, 2), default=0, nullable=False)

    # Why the discount was given.
    coupon_code = Column(String(50), nullable=True)
    promotion_id = Column(Integer, nullable=True, index=True)

    # What the line came to: the gross amount before any discount, and
    # the net amount after the line discount and the shared discount.
    gross_amount = Column(Numeric(20, 2), default=0, nullable=False)
    net_item_amount = Column(Numeric(20, 2), default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    transaction = relationship("BusinessTransaction", back_populates="items")
    product = relationship("MerchantPosProduct")
    taxes = relationship(
        "BusinessTransactionTax",
        back_populates="item",
        order_by="BusinessTransactionTax.id",
    )

    def __repr__(self):
        return f"<BusinessTransactionItem {self.item_name}>"
