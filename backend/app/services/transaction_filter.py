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

The same rule is written twice below, once for each column, so that
the two can be read on their own.
"""

from sqlalchemy import or_
from sqlalchemy.orm import Session  # noqa: F401  (kept for the type of a caller)

from app.models.transaction import Transaction

# A transaction counts once it is approved. The empty string is what
# an older row holds, and it means approved too.
APPROVED_STATUSES = ("approved", "")


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
