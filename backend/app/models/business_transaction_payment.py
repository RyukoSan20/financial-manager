"""
The money that settled a sale.

A sale is often paid in more than one piece: cash in the till and the
rest on a card, or two cards, or a card and a transfer that arrives
the next morning. Each piece is a row here.

`amount_paid` is what the customer handed over. `refund_amount` is
what was handed back, and it is kept on the same row rather than as a
negative payment, because a refund is not the opposite of a payment:
it is a different event, and the shop may want to know how much came
back in the week rather than in the year.

`settlement_exchange_rate` is the rate between the currency the
customer paid in and the currency the merchant keeps, when the two are
not the same. A card machine that pays out in a different currency
from the one it charges in is the ordinary case for a shop that
accepts tourists.

`processing_fee` is what the card company took. It is kept beside
the payment rather than on the sale, because the fee belongs to the
payment that incurred it and not to the sale as a whole.
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


class BusinessTransactionPayment(Base):
    """
    One payment, or one refund, of a sale.

    `payment_method` is `CASH`, `BANK_TRANSFER`, `CARD`, `QRIS` or
    `EWALLET`. `payment_reference` is the trace the payer or the
    provider gave, so that the payment can be found again on the
    bank statement.
    """

    __tablename__ = "business_transaction_payments"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(
        Integer,
        ForeignKey("business_transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # CASH, BANK_TRANSFER, CARD, QRIS, or EWALLET.
    payment_method = Column(String(20), default="CASH", nullable=False, index=True)

    # The currency the customer paid in, which is not always the
    # currency of the sale.
    payment_currency = Column(String(10), default="IDR", nullable=False)

    # What was handed over, and what was handed back.
    amount_paid = Column(Numeric(20, 2), default=0, nullable=False)
    refund_amount = Column(Numeric(20, 2), default=0, nullable=False)

    # The rate between the payment currency and the currency of the
    # sale, when they are not the same.
    settlement_exchange_rate = Column(Numeric(20, 10), default=1, nullable=True)

    # What the provider took.
    processing_fee = Column(Numeric(20, 2), default=0, nullable=False)

    # The trace of the payment.
    payment_reference = Column(String(120), nullable=True, index=True)

    # When the money arrived.
    paid_at = Column(DateTime, default=datetime.utcnow)

    created_at = Column(DateTime, default=datetime.utcnow)

    transaction = relationship("BusinessTransaction", back_populates="payments")

    def __repr__(self):
        return f"<BusinessTransactionPayment {self.payment_method}>"
