"""
The line items inside a financial record.

The receipt scanner already produced something like this: a list of
things, each with a name, a quantity and a price. It was stored on the
transaction and then never used again outside the receipt flow.

The idea here is that a line item is not a receipt concept. A budget
for groceries is made of groceries. A recurring rule for the monthly
rent is made of the rent. A goal for a trip to Japan is made of a
flight, a hotel, food and the rest, and those are the numbers the user
actually needs to see. A debt has the principal and the interest that
will be paid on it.

So one table holds the breakdown for every kind of financial record, and
the record points at it. That way "show me what my money is going to" is
one question, not one query per feature.
"""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class BreakdownItem(Base):
    """
    One line inside a financial record.

    ``parent_type`` says which kind of record this belongs to
    ("transaction", "budget", "recurring", "goal", "debt") and
    ``parent_id`` says which one. That keeps a single table instead of
    five nearly identical ones.
    """

    __tablename__ = "breakdown_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Which record this belongs to.
    parent_type = Column(String(20), nullable=False, index=True)
    parent_id = Column(Integer, nullable=False, index=True)

    # The item itself.
    name = Column(String(255), nullable=False)
    quantity = Column(Numeric(10, 2), default=1, nullable=False)
    unit_price = Column(Numeric(20, 2), default=0, nullable=False)
    total_price = Column(Numeric(20, 2), default=0, nullable=False)

    # A rough bucket for the item, so the UI can group them.
    # "transport", "accommodation", "food", "ticket", "shopping", ...
    category = Column(String(50), nullable=True)

    # Whether this line is money going out, coming in, or neither.
    kind = Column(String(20), default="expense", nullable=False)

    # True when the line is a discount rather than a thing bought.
    is_discount = Column(Boolean, default=False, nullable=False)

    # Free text. For a goal breakdown the model explains why the number
    # is what it is; for a receipt it is the line as it was printed.
    notes = Column(Text, nullable=True)

    # Where this line came from: "llm", "user", "rule", "ocr".
    source = Column(String(20), default="user", nullable=False)

    # Set when the line was added by the model and the user has not
    # looked at it yet. The UI can show these differently.
    is_estimated = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<BreakdownItem {self.name!r} x{self.quantity} @ {self.unit_price}>"
