"""
The accounts a new reader starts with.

A reader who chooses to try the app without an account is a reader
who is trying it. The first thing they do is scan a receipt or say a
sentence, and both of those have to put the money somewhere.

Before, a guest was given a user and nothing else. So their first
purchase had nowhere to go: the receipt was read, the total was shown,
and then the save failed at the last step. The transaction was never
written down, and the screen said nothing about it.

So a guest is given the accounts a reader would make for themselves in
the first minute anyway: the cash in their pocket, the bank card they
pay with, and the two wallets most people here pay with. They can be
renamed, they can be closed, and they can add more - but they are
there from the start, so the money always has a home.

A reader with an account already is never touched. This only ever
runs for a reader who has none.
"""

import logging
from typing import List

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# The accounts a reader in Indonesia starts with.
#
# The names are the ones people actually say: "Cash" for the money in
# their pocket, "BCA" for the card most of them are paid into, and the
# two wallets that are everywhere.
STARTER_ACCOUNTS = [
    {"name": "Cash", "account_type": "cash", "currency": "IDR"},
    {"name": "BCA", "account_type": "bank", "currency": "IDR"},
    {"name": "GoPay", "account_type": "e-wallet", "currency": "IDR"},
    {"name": "OVO", "account_type": "e-wallet", "currency": "IDR"},
]


def seed_starter_accounts(db: Session, user_id: int) -> List[int]:
    """
    The accounts a reader starts with, made if they have none.

    Returns the ids of the accounts that were made, so the caller can
    say what happened. A failure here is not fatal: the reader can
    still make their own accounts, and the transaction path makes an
    account of its own when there is none.
    """
    from app.models.account import Account

    try:
        existing = db.query(Account).filter(Account.user_id == user_id).count()
        if existing:
            # The reader has accounts. They are their own, and they are
            # not replaced.
            return []
    except Exception as exc:  # noqa: BLE001 - the caller reports the failure
        logger.warning("Could not look up the accounts of %s: %s", user_id, exc)
        return []

    made: List[int] = []
    for spec in STARTER_ACCOUNTS:
        try:
            account = Account(
                user_id=user_id,
                name=spec["name"],
                account_type=spec["account_type"],
                account_kind=spec["account_type"],
                balance=0,
                currency=spec["currency"],
                is_active=True,
                is_credit=False,
            )
            db.add(account)
            db.flush()
            made.append(int(account.id))
        except Exception as exc:  # noqa: BLE001 - one account is not worth losing the rest
            logger.warning("Could not make the %s account for %s: %s", spec["name"], user_id, exc)
            db.rollback()
            break

    if made:
        try:
            db.commit()
            logger.info("Made %s starter accounts for %s", len(made), user_id)
        except Exception as exc:  # noqa: BLE001 - the caller reports the failure
            logger.warning("Could not save the starter accounts of %s: %s", user_id, exc)
            db.rollback()
            return []

    return made


__all__ = ["seed_starter_accounts", "STARTER_ACCOUNTS"]
