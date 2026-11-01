"""
Money coming back.

When a friend pays the host back, the money goes into the account it
came out of. This is the one place where it is most tempting to
count it as income, and it must not be counted as income.

The host's own money left the account when the bill was paid. It
comes back when the friend settles up. Counting the return as
earnings would say the host earned the price of a dinner they paid
for themselves, and every income figure in the application would be
wrong by exactly the amount of the meals the host fronted.

So the row is written as a transfer in. It moves the balance, and it
is kept out of the income figure by the column that says what kind
of row it is.

The settlement is written once. A second call for the same
settlement returns the row that is already there, because a payment
that is confirmed twice is still one payment.
"""

from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.split_bill import (
    SplitGroup,
    SplitMember,
    SplitSettlement,
)
from app.models.transaction import Transaction
from app.models.user import User
from app.services.account_balance import move_balance

ZERO = Decimal("0")

# The kind of row a payment back leaves behind.
SPLIT_REIMBURSEMENT = "SPLIT_REIMBURSEMENT"

# The kinds of payment that are finished. A payment that is still
# waiting for its proof does not move any money yet.
COMPLETED = ("COMPLETED", "CONFIRMED", "PAID")


def _dec(value) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value) -> Decimal:
    return _dec(value).quantize(Decimal("0.01"))


def settle_payment(
    db: Session,
    group: SplitGroup,
    settlement: SplitSettlement,
    to_account_id: Optional[int],
    user: User,
) -> Optional[Transaction]:
    """
    Write a payment back into the reader's records.

    Nothing is written when the payment has not finished, when there
    is no account to put the money into, or when the payment has
    already been written. The row that is already there is returned
    in that last case, so that a second confirmation does not double
    the money.
    """
    if settlement.status not in COMPLETED:
        return None

    # A payment that was already written is found through the
    # settlement, so that confirming twice does not write it twice.
    if settlement.transaction_id:
        existing = (
            db.query(Transaction)
            .filter(Transaction.id == settlement.transaction_id)
            .first()
        )
        if existing is not None:
            return existing

    if not to_account_id:
        return None

    amount = _money(settlement.amount)
    if amount <= ZERO:
        return None

    payer = (
        db.query(SplitMember)
        .filter(SplitMember.id == settlement.from_member_id)
        .first()
    )
    payee = (
        db.query(SplitMember)
        .filter(SplitMember.id == settlement.to_member_id)
        .first()
    )

    label = f"Shared bill paid back by {payer.display_name if payer else 'a friend'}"
    if group.name:
        label = f"{label} ({group.name})"

    from datetime import date as _date

    when = settlement.settled_at.date() if settlement.settled_at else _date.today()

    row = Transaction(
        user_id=user.id,
        type="transfer_in",
        amount=amount,
        currency=settlement.currency or group.currency or "IDR",
        date=when,
        description=label,
        account_id=to_account_id,
        split_tx_type=SPLIT_REIMBURSEMENT,
        status="approved",
        detection_type="MANUAL",
    )
    db.add(row)
    db.flush()

    # The money is in the account now.
    move_balance(db, to_account_id, row.type, row.amount)

    # The settlement points at the row it made, so that the payment
    # is written once however many times it is confirmed.
    settlement.transaction_id = row.id
    settlement.status = "COMPLETED"
    if settlement.settled_at is None:
        from datetime import datetime

        settlement.settled_at = datetime.utcnow()

    return row


def settle_many(
    db: Session,
    group: SplitGroup,
    settlements: List[SplitSettlement],
    to_account_id: Optional[int],
    user: User,
) -> List[Transaction]:
    """
    Write several payments back at once.

    This is what the reader asks for when they press the button that
    says everybody has paid. Every payment that has finished is
    written, and the ones that have not are left alone.
    """
    written: List[Transaction] = []
    for settlement in settlements:
        row = settle_payment(
            db,
            group=group,
            settlement=settlement,
            to_account_id=to_account_id,
            user=user,
        )
        if row is not None:
            written.append(row)
    return written
