"""
The books of a merchant.

A sale is a fact about a sale. The entry is the same fact written
down the way an accountant writes it: something was debited and
something was credited, and the two sides are equal.

Each row is one side of one entry. A sale of 100 with 10 of tax on
it is two rows for the sale itself — the customer owes 110, so the
receivable is debited 110 and the revenue is credited 100 and the
tax payable is credited 10 — plus a row for the money when it
arrives.

`account_code` is a small fixed set, because the merchant of this
application is a shop and not an enterprise:

- `REVENUE` — what was sold.
- `TAX_PAYABLE_PPN` — the sales tax that is owed to the tax office.
- `PREPAID_TAX_PPH23` — the income tax that was withheld from the
  merchant's own payment and that the merchant has to pay over.
- `ACCOUNTS_RECEIVABLE` — what the customer owes.
- `CASH_BANK` — the money that arrived.
- `COGS` — what the goods sold cost.
- `INVENTORY` — the goods themselves.

`debit_amount` and `credit_amount` are kept as two columns rather
than as one signed amount, because an accountant reads a debit and a
credit on their own columns and a book that has to be read that way
is a book nobody can check.

`functional_currency` is the currency of the merchant's books, which
is not always the currency of the sale.
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


class AccountingEntry(Base):
    """
    One side of one entry in the merchant's books.

    The side is named by `account_code`, the money by `debit_amount`
    and `credit_amount`, and the entry is tied to the sale it came
    from by `transaction_id`.
    """

    __tablename__ = "accounting_entries"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(
        Integer,
        ForeignKey("business_transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # REVENUE, TAX_PAYABLE_PPN, PREPAID_TAX_PPH23, ACCOUNTS_RECEIVABLE,
    # CASH_BANK, COGS, or INVENTORY.
    account_code = Column(String(40), nullable=False, index=True)

    # The two sides of the entry. One of them is zero.
    debit_amount = Column(Numeric(20, 2), default=0, nullable=False)
    credit_amount = Column(Numeric(20, 2), default=0, nullable=False)

    # The currency of the books.
    functional_currency = Column(String(10), default="IDR", nullable=False)

    # The period the entry belongs to, which is what the tax return
    # is read from.
    fiscal_period = Column(String(20), nullable=True, index=True)

    # What the entry is for, in the merchant's own words.
    memo = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    transaction = relationship("BusinessTransaction", back_populates="accounting_entries")

    def __repr__(self):
        return f"<AccountingEntry {self.account_code}>"
