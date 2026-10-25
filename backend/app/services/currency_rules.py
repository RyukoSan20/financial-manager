"""
Rules about which currency a piece of money is in.

The reader can pick the currency the whole app shows things in. That is
a display choice. It does not change the money itself.

Every account holds one currency. Every transaction, goal, budget,
recurring rule and debt is in the currency of the account it belongs
to. Nothing is converted behind the reader's back.

The only way money changes currency is a transfer that says so: the
source account is debited in its own currency, the destination
account is credited in its own currency, and the rate used is written
down on the transfer.
"""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException


# The account types that hold money the reader chose to set aside.
# These are the ones where swapping the currency silently would change
# the meaning of the balance, so they get extra care.
SAVINGS_TYPES = {"savings", "investment", "emergency_fund", "debt_payoff"}

# The account types that are spent from, where the currency is a
# detail of where the money is.
SPENDING_TYPES = {"cash", "bank", "e_wallet", "credit_card", "ewallet"}


def account_currency(account) -> str:
    """The currency an account holds, always in upper case."""
    return (getattr(account, "currency", None) or "IDR").upper()


def assert_record_currency(record_currency: Optional[str], account) -> str:
    """The currency a record must be in, given the account it belongs to.

    A record that names a currency which is not the account's currency
    is refused. That is what stops a goal in dollars being counted
    against a rupiah account.

    The exception is a record that does not name a currency at all:
    it simply takes the account's currency.
    """
    account_curr = account_currency(account)

    if not record_currency:
        return account_curr

    record_curr = record_currency.upper()
    if record_curr != account_curr:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This account holds {account_curr}, but the record is in "
                f"{record_curr}. A record has to be in the currency of the "
                "account it belongs to. To move money between currencies, "
                "make a transfer instead."
            ),
        )
    return record_curr


def refuse_currency_change(old_currency: Optional[str], new_currency: Optional[str]) -> None:
    """Refuse to change the currency of an account that already holds money.

    Changing the currency of an account would change what its balance
    means without any money being moved. The balance would read as a
    different amount of money, and the totals across the app would no
    longer add up.

    The way to change the currency of money is to create an account in
    the other currency and transfer into it. That way the rate used is
    on record and both sides of the move are visible.
    """
    old = (old_currency or "IDR").upper()
    new = (new_currency or "IDR").upper()

    if old == new:
        return

    raise HTTPException(
        status_code=400,
        detail=(
            f"This account holds {old} and cannot be changed to {new}. "
            "Changing the currency would change what the balance means. "
            "Create an account in the other currency and transfer into it "
            "instead, so the exchange rate is recorded."
        ),
    )


def currency_of_transfer_source(from_account) -> str:
    """The currency a transfer leaves in.

    Always the source account's own currency. The amount in a transfer
    request is read in this currency, whatever the reader picked as
    the display currency.
    """
    return account_currency(from_account)
