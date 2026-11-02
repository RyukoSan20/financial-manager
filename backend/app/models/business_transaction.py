"""
A sale, from the side of the shop that made it.

This is not the reader's own spending. The reader's spending lives in
`transactions`. This is the other side of the counter: what a merchant
sold, what tax was charged on it, what the customer paid and what is
still owed.

The row is deliberately wide. A sale crosses borders, it is written in
one currency and paid in another, it is taxed in one country and
delivered in another, and it may be a tax invoice for the tax office
rather than a receipt for the customer. All of that is recorded on
the sale itself, because a sale that has to be looked up in six other
tables to be understood is a sale nobody will be able to audit.

The money on the row falls into two groups, and the difference between
them matters:

- **What the customer owes.** `subtotal_gross` is what the lines
  came to before any discount. `grand_total` is what the customer
  pays, and it is the sum of the lines after discount, plus the
  taxes that are added to the bill, plus the shipping and the fees
  and the rounding.

- **What the customer hands over.** `net_receivable_amount` is what
  the merchant actually keeps. It is the grand total minus the taxes
  that are withheld from it, because a tax withheld at the till is
  never the merchant's money: it is the tax office's, and the merchant
  holds it for a while before paying it over.

Every one of those numbers is worked out by the server. The client
sends the lines and the discounts; it never sends a total. A total
that the client can set is a total that can be wrong, and a wrong
total on a tax invoice is an audit.

`fiscal_period` is the period the sale belongs to for tax purposes
("2026-11", "2026-Q4"), which is not always the period the calendar
says it is.
"""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class BusinessTransaction(Base):
    """
    One sale, with the tax on it and the money that settled it.

    `invoice_type` says what the document is:

    - `POS_RECEIPT` — a receipt from a till.
    - `TAX_INVOICE` — an invoice that the tax office has to see.
    - `PROFORMA` — a quotation. No money has changed hands.
    - `CREDIT_NOTE` — a note that takes money back.

    `cross_border_flag` says whether the seller and the buyer are in
    different countries, and `incoterms` says who carries the risk and
    the cost of the carriage, which is what decides where the tax is
    due. `customs_value` is the value the customs office is to be
    told, which is not always the value the customer pays.

    `payment_status` is `UNPAID`, `PARTIAL`, `PAID` or `REFUNDED`.
    """

    __tablename__ = "business_transactions"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(
        Integer, ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # The number of the document. It is the merchant's own numbering,
    # so it is not unique across merchants.
    invoice_number = Column(String(60), nullable=False, index=True)

    # POS_RECEIPT, TAX_INVOICE, PROFORMA, or CREDIT_NOTE.
    invoice_type = Column(String(20), default="POS_RECEIPT", nullable=False, index=True)

    # Who bought it, when the shop knows its customers.
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # When the sale happened, in the local time of the shop, and where
    # that time is. The timezone is kept beside the date because a
    # date without a timezone is a date nobody can place.
    transaction_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    timezone = Column(String(60), default="Asia/Jakarta", nullable=True)
    locale = Column(String(20), default="id-ID", nullable=True)

    # The three currencies of a sale that crosses borders. The
    # transaction currency is what the price is written in. The
    # functional currency is the currency the merchant accounts in.
    # The settlement currency is the currency the money actually
    # arrives in.
    transaction_currency = Column(String(10), default="IDR", nullable=False)
    functional_currency = Column(String(10), default="IDR", nullable=False)
    settlement_currency = Column(String(10), default="IDR", nullable=False)

    # The rate between the transaction currency and the settlement
    # currency, when they are not the same, and where the rate came
    # from and what day it was taken on. A rate without a day cannot
    # be checked later.
    exchange_rate = Column(Numeric(20, 10), default=1, nullable=True)
    exchange_rate_date = Column(Date, nullable=True)
    exchange_rate_source = Column(String(60), nullable=True)

    # Where the two sides of the sale are, and the region whose tax
    # applies.
    seller_country = Column(String(2), default="ID", nullable=True, index=True)
    customer_country = Column(String(2), nullable=True, index=True)
    tax_region_code = Column(String(30), nullable=True, index=True)
    cross_border_flag = Column(Boolean, default=False, nullable=False)

    # Who carries the goods, and what the customs office is told the
    # goods are worth.
    incoterms = Column(String(10), nullable=True)
    customs_value = Column(Numeric(20, 2), nullable=True)

    # The format the electronic invoice is in, when there is one.
    e_invoice_format = Column(String(30), nullable=True)

    # The period the sale belongs to for tax purposes.
    fiscal_period = Column(String(20), nullable=True, index=True)

    # --- the money -----------------------------------------------------------
    #
    # What the lines came to before any discount.
    subtotal_gross = Column(Numeric(20, 2), default=0, nullable=False)

    # The discounts taken off the lines themselves.
    total_line_discount = Column(Numeric(20, 2), default=0, nullable=False)

    # The discount taken off the whole sale. The type is PERCENTAGE,
    # FIXED_AMOUNT or NONE, and the rate is a percentage when the type
    # says so. How it is shared out over the lines is given by
    # `discount_allocation_method`: PROPORTIONAL_VALUE shares it in
    # proportion to the value of the line, and EQUAL shares it in
    # equal parts.
    transaction_discount_type = Column(String(20), default="NONE", nullable=True)
    transaction_discount_rate = Column(Numeric(9, 4), default=0, nullable=True)
    transaction_discount_amount = Column(Numeric(20, 2), default=0, nullable=False)
    discount_allocation_method = Column(
        String(20), default="PROPORTIONAL_VALUE", nullable=True
    )

    # The total of what the tax was charged on, and the two kinds of
    # tax that come out of the sale. The additive tax is added to the
    # customer's bill. The withholding tax is taken out of what the
    # merchant receives.
    total_taxable_amount = Column(Numeric(20, 2), default=0, nullable=False)
    total_tax_additive = Column(Numeric(20, 2), default=0, nullable=False)
    total_withholding_tax = Column(Numeric(20, 2), default=0, nullable=False)

    # The charges on top of the goods.
    shipping_fee = Column(Numeric(20, 2), default=0, nullable=False)
    transaction_fee = Column(Numeric(20, 2), default=0, nullable=False)
    processing_fee = Column(Numeric(20, 2), default=0, nullable=False)
    import_duty_fee = Column(Numeric(20, 2), default=0, nullable=False)

    # The last few rupiah, so that the customer hands over a round
    # amount and the till has no coins. It is a signed amount: it can
    # be added or taken away.
    rounding_amount = Column(Numeric(20, 2), default=0, nullable=False)

    # What the customer pays.
    grand_total = Column(Numeric(20, 2), default=0, nullable=False)

    # What the merchant keeps, once the withheld tax has been taken
    # out of it.
    net_receivable_amount = Column(Numeric(20, 2), default=0, nullable=False)

    # What is still owed.
    outstanding_amount = Column(Numeric(20, 2), default=0, nullable=False)

    # UNPAID, PARTIAL, PAID, or REFUNDED.
    payment_status = Column(String(20), default="UNPAID", nullable=False, index=True)

    # Anything the shop wants to remember about the sale that has no
    # column of its own.
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    merchant = relationship("Merchant")
    items = relationship(
        "BusinessTransactionItem",
        back_populates="transaction",
        cascade="all, delete-orphan",
        order_by="BusinessTransactionItem.id",
    )
    taxes = relationship(
        "BusinessTransactionTax",
        back_populates="transaction",
        cascade="all, delete-orphan",
        order_by="BusinessTransactionTax.id",
    )
    payments = relationship(
        "BusinessTransactionPayment",
        back_populates="transaction",
        cascade="all, delete-orphan",
        order_by="BusinessTransactionPayment.id",
    )
    accounting_entries = relationship(
        "AccountingEntry",
        back_populates="transaction",
        cascade="all, delete-orphan",
        order_by="AccountingEntry.id",
    )

    def __repr__(self):
        return f"<BusinessTransaction {self.invoice_number}>"
