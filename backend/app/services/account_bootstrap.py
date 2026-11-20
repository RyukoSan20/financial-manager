"""
A place to put the money.

Every transaction belongs to an account, and every account belongs to a
reader. So a reader with no account has nowhere to put anything.

That was not a rare state. A guest reader - somebody who chose "try
it without an account" - was given a user and nothing else. Their
first scan was read, the receipt was shown, and then the save failed,
because there was no account to hold it. The transaction did not
vanish; it was never written down, and the screen said nothing about
it.

So the first time a reader needs an account and has none, one is made
for them: a cash account in their own currency, holding nothing, ready
to be used. Every path that writes a transaction goes through here
first, so the money always has somewhere to go.

The account is made once and kept. It is not made again on every
request, and the reader's own accounts are never touched.
"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def ensure_account(
    db: Session,
    user_id: int,
    *,
    kind: str = "cash",
    currency: str = "IDR",
    name: Optional[str] = None,
):
    """
    The reader's first active account, made if there is none.

    Returns the account, or nothing when one could not be made. A
    failure here is not fatal: the caller reports that the transaction
    could not be saved, which is better than saving it nowhere.
    """
    from app.models.account import Account

    try:
        existing = (
            db.query(Account)
            .filter(
                Account.user_id == user_id,
                Account.is_active == True,  # noqa: E712 - the column is a flag
            )
            .order_by(Account.id)
            .first()
        )
        if existing is not None:
            return existing

        # The reader has accounts, but none of them are open. That is a
        # choice somebody made - a closed account is not a mistake - so
        # it is respected. Only a reader with no accounts at all gets
        # one made for them.
        closed = (
            db.query(Account)
            .filter(Account.user_id == user_id)
            .order_by(Account.id)
            .first()
        )
        if closed is not None:
            return None
    except Exception as exc:  # noqa: BLE001 - the caller reports the failure
        logger.warning("Could not look up the accounts of %s: %s", user_id, exc)
        return None

    try:
        from app.services.account_kinds import default_account_name

        account = Account(
            user_id=user_id,
            name=name or default_account_name(kind, currency),
            account_type=kind,
            account_kind=kind,
            balance=0,
            currency=(currency or "IDR").upper(),
            is_active=True,
            is_credit=False,
        )
        db.add(account)
        db.flush()
        logger.info("Made the first account for %s: %s", user_id, account.name)
        return account
    except Exception as exc:  # noqa: BLE001 - the caller reports the failure
        logger.warning("Could not make an account for %s: %s", user_id, exc)
        db.rollback()
        return None


def ensure_account_id(db: Session, user_id: int, *, currency: str = "IDR") -> Optional[int]:
    """
    The id of the reader's account, made if there is none.

    This is the shape the callers want: an id they can put in a
    transaction, or nothing when there is nowhere to put it.
    """
    account = ensure_account(db, user_id, currency=currency)
    return int(account.id) if account is not None else None


__all__ = ["ensure_account", "ensure_account_id"]
