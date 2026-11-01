"""
Writing a shared bill into the reader's own records.

This is where the rule that matters most lives: the money somebody
else owes is not the reader's spending.

When a host pays Rp1.000.000 for a table of four and their own share
is Rp250.000, only Rp250.000 is the host's spending. The other
Rp750.000 is the host's own money that is on loan to the others. If
it were counted as spending, the host's monthly chart would show a
dinner that cost four times what it cost them, and every budget
built on that chart would be wrong from the first day.

So the bill is written down in two parts:

- The host's own share, as an ordinary expense. This is what the
  charts and the budgets read.
- The rest, as a receivable. It is money that has left the account
  and is owed back. It is not spending, and it is not income either.

Both parts move the account balance, because the money really did
leave the account. Only the first part is spending. The kind of each
row is written in the column that says what kind of row it is, and
the metrics read that column before they add anything up.

When the others pay back, the money comes back to the account. That
is not income. It is the host's own money returning, and it must
never be counted as earnings.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.split_bill import (
    SplitCalculatedShare,
    SplitExpense,
    SplitGroup,
    SplitMember,
    SplitPayer,
)
from app.models.transaction import Transaction
from app.models.user import User
from app.services.account_balance import move_balance
from app.services.split_bill_service import read_receipt_totals

ZERO = Decimal("0")

# The three kinds of row a shared bill can leave behind. They are the
# three cases in the accounting rules, and nothing else is written.
PERSONAL_SHARE = "PERSONAL_SHARE"
FRONTED_RECEIVABLE = "FRONTED_RECEIVABLE"
SPLIT_REIMBURSEMENT = "SPLIT_REIMBURSEMENT"

# The status a bill carries once it has been written into the
# reader's records. Publishing twice must not write it twice.
PUBLISHED = "PUBLISHED"


def _dec(value) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value) -> Decimal:
    return _dec(value).quantize(Decimal("0.01"))


def the_host_share(
    db: Session, expense: SplitExpense, host_member_id: int
) -> Decimal:
    """
    What the host owes for their own part of the bill.

    The host is the member who paid. When the host has also claimed
    their own food, that claim is what they owe. When they have not
    claimed anything, they owe nothing - they fronted the money, but
    the host is not eating the whole table.
    """
    share = (
        db.query(SplitCalculatedShare)
        .filter(
            SplitCalculatedShare.expense_id == expense.id,
            SplitCalculatedShare.member_id == host_member_id,
        )
        .first()
    )
    if share is None:
        return ZERO
    return _money(share.final_amount)


def the_fronted_amount(
    db: Session, expense: SplitExpense, host_member_id: int
) -> Decimal:
    """
    What the host laid out that the others owe back.

    The amount that was paid is taken from the payer rows when there
    are any. When there are none, it is the total of the bill: the
    host is the member of the group, the bill names the account it
    came out of, and a bill where nobody filled in the payer part is
    a bill where nobody wrote it down, not a bill where nobody
    paid. Leaving the amount at zero in that case would say that the
    host owes the table nothing, and the money that is coming back
    would never be written down at all.
    """
    host_share = the_host_share(db, expense, host_member_id)
    paid = ZERO
    payers = (
        db.query(SplitPayer).filter(SplitPayer.expense_id == expense.id).all()
    )
    for payer in payers:
        paid += _dec(payer.amount)

    if paid <= ZERO:
        totals = read_receipt_totals(expense)
        paid = _dec(totals.get("grand_total"))

    fronted = paid - host_share
    if fronted < ZERO:
        fronted = ZERO
    return _money(fronted)


def _host_member(members: List[SplitMember], user: User) -> Optional[SplitMember]:
    """The member of the group who is the reader."""
    for member in members:
        if member.user_id == user.id:
            return member
    return None


def publish_expense_to_ledger(
    db: Session,
    expense: SplitExpense,
    group: SplitGroup,
    members: List[SplitMember],
    user: User,
) -> List[Transaction]:
    """
    Write the host's own share into the reader's records.

    Two rows may be written, and they are different kinds of row:

    - the host's own share, which is spending;
    - the money the others owe back, which is money on loan.

    Both move the account balance, because the money really did
    leave the account. Only the first is spending, and the metrics
    know the difference because of the column that says what kind of
    row this is.

    When the host paid in cash, or did not record which account they
    paid from, nothing is written. A bill that cannot be traced to an
    account is still a bill the group owes each other; it is simply
    not part of the reader's own accounts.
    """
    if not expense.payer_account_id:
        return []

    # Publishing twice must not write the bill twice. The status is
    # the record of the fact, and it is set before the rows are
    # written so that a second call sees it.
    if expense.status == PUBLISHED:
        return []

    host_member = _host_member(members, user)
    if host_member is None:
        return []

    personal_share = the_host_share(db, expense, host_member.id)
    fronted = the_fronted_amount(db, expense, host_member.id)

    if personal_share <= ZERO and fronted <= ZERO:
        return []

    label = expense.merchant_name or expense.name or "Shared bill"
    when = expense.receipt_date or datetime.utcnow().date()
    written: List[Transaction] = []

    if personal_share > ZERO:
        own = Transaction(
            user_id=user.id,
            type="expense",
            amount=personal_share,
            currency=group.currency or "IDR",
            date=when,
            description=label,
            account_id=expense.payer_account_id,
            split_expense_id=expense.id,
            split_tx_type=PERSONAL_SHARE,
            status="approved",
            detection_type="MANUAL",
        )
        db.add(own)
        written.append(own)

    if fronted > ZERO:
        # This is not spending. The column says so, and the metrics
        # read it, so the host's monthly chart shows what they spent
        # and not what they laid out for other people.
        lent = Transaction(
            user_id=user.id,
            type="expense",
            amount=fronted,
            currency=group.currency or "IDR",
            date=when,
            description=f"{label} (on loan to the group)",
            account_id=expense.payer_account_id,
            split_expense_id=expense.id,
            split_tx_type=FRONTED_RECEIVABLE,
            status="approved",
            detection_type="MANUAL",
        )
        db.add(lent)
        written.append(lent)

    db.flush()

    # The money really did leave the account, so the balance moves.
    # Both rows move it, because both parts of the bill were paid for
    # out of the same account. Only one of them is spending, and that
    # is what the column says.
    for row in written:
        move_balance(db, row.account_id, row.type, row.amount)

    if written:
        expense.transaction_id = written[0].id
    expense.status = PUBLISHED

    return written
