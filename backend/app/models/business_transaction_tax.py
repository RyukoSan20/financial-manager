"""
The tax on a sale, one line at a time.

A tax result is three numbers and they are kept as three columns,
because they answer three different questions and a reader who has
them mixed up gets a different answer:

- `tax_rate` is the rate the rule names. It is the headline number,
  and it is the same whatever the sale came to.
- `taxable_amount` is the base the rate was charged on. It is not the
  price of the goods: it is the price less the part of it that the
  law says is not taxable.
- `tax_amount` is the money that came out.

Indonesian PPN is the clearest case. The rate is 12%. On ordinary
goods the base is eleven twelfths of the price, so the tax actually
paid is 11% of the price. A system that keeps only the rate and the
tax would show 12% and 11% together and no reader could tell which
was which.

`tax_behavior` says what the tax does to the bill. `ADDITIVE` taxes
are added to what the customer pays. `WITHHOLDING` taxes are taken
out of what the merchant receives and are never added to the
customer's bill.

`tax_inclusion` says whether the price already has the tax in it. A
price of 110 that is said to include 10% of tax has a base of 100
and a tax of 10, and the tax is already in the bill, so it is not
added again.

`tax_category` says how the goods are treated: `STANDARD`,
`LUXURY`, `REDUCED`, `ZERO_RATED`, `EXEMPT` or `DTP`. `EXEMPT` and
`DTP` (ditanggung penuh, borne in full by the seller) both mean the
tax is zero, and both say so in `tax_exemption_code` together with
the reason, because a tax of zero with no reason is a bug that looks
like a gift.
"""

from sqlalchemy import (
    Column,
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


class BusinessTransactionTax(Base):
    """
    One tax, on a whole sale or on one line of it.

    `transaction_item_id` is null when the tax is on the whole sale
    rather than on one line, which is the usual case for the sales
    taxes of a country that charges on the invoice.

    `tax_rule_id` points at the rule that was used, so that the sale
    can be read again under the rule of the day.

    `tax_base_method` says how the base was worked out: `FULL_NET`
    is the whole net amount of the line, `DPP_NILAI_LAIN_11_12` is
    eleven twelfths of it, and `CUSTOM_BASE` means the base was given
    for this tax rather than worked out from the line.
    """

    __tablename__ = "business_transaction_taxes"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(
        Integer,
        ForeignKey("business_transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The line this tax belongs to, when it belongs to one.
    transaction_item_id = Column(
        Integer,
        ForeignKey("business_transaction_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # The rule that was used, when the tax came from a rule in the
    # table of rules rather than from a rule written into the code.
    tax_rule_id = Column(
        Integer, ForeignKey("tax_rules.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Which tax this is, in the tax office's own words.
    tax_code = Column(String(30), nullable=False, index=True)

    # PPN, PPNBM, PH_WITHHOLDING, PBJT, VAT, GST, SALES_TAX, or
    # IMPORT_DUTY.
    tax_type = Column(String(30), nullable=False, index=True)

    # ADDITIVE or WITHHOLDING.
    tax_behavior = Column(String(20), default="ADDITIVE", nullable=False, index=True)

    # INCLUSIVE or EXCLUSIVE.
    tax_inclusion = Column(String(20), default="EXCLUSIVE", nullable=False)

    # STANDARD, LUXURY, REDUCED, ZERO_RATED, EXEMPT, or DTP.
    tax_category = Column(String(20), default="STANDARD", nullable=False)

    # FULL_NET, DPP_NILAI_LAIN_11_12, or CUSTOM_BASE.
    tax_base_method = Column(String(20), default="FULL_NET", nullable=False)

    # The three numbers of the result, kept apart on purpose. See the
    # module docstring.
    tax_rate = Column(Numeric(9, 4), default=0, nullable=False)
    taxable_amount = Column(Numeric(20, 2), default=0, nullable=False)
    tax_amount = Column(Numeric(20, 2), default=0, nullable=False)

    # Why the tax is zero, when it is zero. The code is the tax
    # office's own wording, and the reason is in the merchant's own
    # words.
    tax_exemption_code = Column(String(60), nullable=True)
    tax_exemption_reason = Column(Text, nullable=True)

    # The account the tax goes to in the merchant's books.
    tax_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    transaction = relationship("BusinessTransaction", back_populates="taxes")
    item = relationship("BusinessTransactionItem", back_populates="taxes")
    rule = relationship("TaxRule")

    def __repr__(self):
        return f"<BusinessTransactionTax {self.tax_code}>"
