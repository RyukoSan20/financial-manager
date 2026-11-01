"""
Moving a balance, without a round trip through the middle.

A transaction row says what happened. The account balance says what
is there now. The two have to move together, or the reader's money
starts drifting away from their records.

Every place that changes a balance uses this module, so that an
ordinary expense, a shared bill and a payment back between friends
cannot disagree about the sign of the change.

The change is made in the database rather than in Python: the
balance is read, changed and written back in one statement. Two
things happening at once cannot both read the same balance and both
write it back.
"""

from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction

# The signed effect a transaction has on an account balance.
#
# Income adds, an expense subtracts, a transfer out leaves the
# account and a transfer in arrives. This is the same decision the
# transactions route makes, in one place, so that an approve, a
# delete and a transfer cannot disagree about the sign.
ADDS = ("income", "transfer_in")
TAKES = ("expense", "transfer_out")


def balance_delta(tx_type: str, amount) -> float:
    """
    What a transaction does to the balance of its account.

    A positive number means the balance goes up.
    """
    value = float(amount or 0)
    if tx_type in ADDS:
        return value
    if tx_type in TAKES:
        return -value
    return 0.0


def move_balance(
    db: Session,
    account_id: int,
    tx_type: str,
    amount,
) -> float:
    """
    Move the balance of an account by the effect of a transaction.

    The change is made in one statement, so two changes happening at
    the same time cannot both read the same balance and both write
    it back.

    The account is not touched when the transaction does not change
    anything: a pending row, or a row of a kind nobody knows, leaves
    the balance alone.
    """
    delta = balance_delta(tx_type, amount)
    if delta == 0 or not account_id:
        return 0.0

    db.execute(
        text(
            """
            UPDATE accounts
            SET balance = balance + :delta,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :account_id
            """
        ),
        {"delta": delta, "account_id": account_id},
    )
    return delta


def reverse_balance(
    db: Session,
    account_id: int,
    tx_type: str,
    amount,
) -> float:
    """
    Undo what a transaction did to a balance.

    This is what happens when a transaction is thrown away. The
    amount is subtracted rather than the type being flipped, because
    the type may have been changed in the meantime and the balance
    has to go back to where it was.
    """
    return move_balance(db, account_id, tx_type, -Decimal(str(amount or 0)))
