"""
The transactions that count towards the reader's money.

Every number on the Dashboard - the money in, the money out and the
cash flow - is worked out from the transaction rows. Which rows count
is decided here, and it is decided in one place, so that two pages
showing the same fact cannot disagree about it.

A transaction only counts once it is approved. A pending transaction is
waiting in the Feed & Review queue and a rejected one was thrown away,
so neither of them has moved the balance and neither of them may show
up in the totals, the category breakdown or the cash flow. A soft-
deleted row is not there any more, so it counts for nothing either.

Two things are worth spelling out, because both of them were wrong and
both of them made the Dashboard say "Rp 0" while the balance said
something else.

**A row with no status counts.** Older rows, a data import and a
direct write all leave `status` empty, and an empty status means the
transaction was never held back - it counts. The filter used to say
`status IN ('approved', NULL, '')`, which reads as though a missing
status counts. In SQL it does not: `NULL IN (...)` is never true, and
a list that holds a `NULL` is never true for anything. So the row was
silently left out of every total, while its money was still in the
account balance. The missing status has to be asked about on its own.

**A row with no `is_deleted` counts.** The same story: the column was
never filled in, so the row was never deleted. Asking
`is_deleted IS false` skips a row whose flag is empty; asking whether
it is false *or* empty asks the question that was meant.

**A row that is somebody else's money is not spending.** This one
came with the shared bill. When a host pays for a table of four, the
money that the other three owe back has left the account but it is
not the host's spending - it is the host's money on loan. Counting it
would make the host's monthly chart show a dinner that cost four
times what it cost them, and every budget built on that chart would
be wrong from the first day.

The same is true in the other direction. When the others pay back,
the money comes into the account, but it is not income: it is the
host's own money returning. Counting it as income would make the host
look like they earned a dinner that they paid for themselves.

So the kinds of row that a shared bill leaves behind are kept out of
the spending and the income totals, while they still move the account
balance - because the money really did move.

The same rule is written twice below, once for each column, so that
the two can be read on their own.
"""

from sqlalchemy import or_
from sqlalchemy.orm import Session  # noqa: F401  (kept for the type of a caller)

from app.models.transaction import Transaction

# A transaction counts once it is approved. The empty string is what
# an older row holds, and it means approved too.
APPROVED_STATUSES = ("approved", "")

# The kinds of row a shared bill leaves behind. The first is the
# host's own share of the bill and it is ordinary spending. The
# second is the money the others owe back, which is on loan rather
# than spent. The third is the money coming back, which is a return
# rather than earnings.
PERSONAL_SHARE = "PERSONAL_SHARE"
FRONTED_RECEIVABLE = "FRONTED_RECEIVABLE"
SPLIT_REIMBURSEMENT = "SPLIT_REIMBURSEMENT"

# The kinds that are not the reader's own spending or income.
NOT_PERSONAL_MONEY = (FRONTED_RECEIVABLE, SPLIT_REIMBURSEMENT)


def counted_transactions_filter() -> list:
    """
    The filter for the transactions that actually count.

    It is a list of conditions, so it can be spread into a query:

        db.query(Transaction).filter(*counted_transactions_filter())
    """
    return [
        # The status is either not filled in, or filled in with one of
        # the states that mean "this counts".
        or_(
            Transaction.status.is_(None),
            Transaction.status.in_(APPROVED_STATUSES),
        ),
        # The row was either never deleted, or the flag was never
        # filled in.
        or_(
            Transaction.is_deleted.is_(None),
            Transaction.is_deleted.is_(False),
        ),
    ]


def personal_money_filter() -> list:
    """
    The filter for the transactions that are the reader's own money.

    The rows that a shared bill left behind are left out, unless the
    row is the reader's own share of that bill. The money on loan is
    not spending, and the money coming back is not income.
    """
    return [
        or_(
            Transaction.split_tx_type.is_(None),
            Transaction.split_tx_type == PERSONAL_SHARE,
        )
    ]


def personal_expense_filter() -> list:
    """
    The filter for the expenses that are the reader's own spending.

    It is the counted filter and the personal money filter together.
    """
    return counted_transactions_filter() + personal_money_filter()


def personal_income_filter() -> list:
    """
    The filter for the income that is the reader's own earnings.

    The money coming back from a shared bill is left out. It is the
    reader's own money returning, not something they were paid.
    """
    return counted_transactions_filter() + [
        or_(
            Transaction.split_tx_type.is_(None),
            Transaction.split_tx_type != SPLIT_REIMBURSEMENT,
        )
    ]
