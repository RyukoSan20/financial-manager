"""
How a member of a group wants to be paid.

A person in a split group should be able to say "pay me into this
bank account" without their account number lying around in the open
where anybody in the group can read it. So the number is encrypted
before it is written down, and it is only read back when somebody in
the group actually has to pay them.

That last part is the whole point of this module. An account number
is not a secret in the way a password is: it is a private detail
that stops being private the moment somebody has to transfer money to
it. So the rule here is simple and is enforced in one place:

    the number is revealed to somebody who owes that member money.

Not to the group owner, not to a guest with a link, not to the person
who is owed money by somebody else. Only to the person who is going
to press "transfer".

The encryption itself is done by the KMS helper, which uses
AES-256-GCM with a random salt and a random nonce on every call. Two
encryptions of the same number are therefore different strings, and
the number cannot be found by comparing encrypted values. The lookup
of "which account is this" is done by the last four digits, which are
kept in the clear on purpose so that a list can be shown without
revealing anything.
"""

from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.kms_encryption import decrypt_token, encrypt_token
from app.models.split_bill import (
    SplitCalculatedShare,
    SplitExpense,
    SplitGroup,
    SplitMember,
    SplitPayer,
    SplitPaymentMethod,
    SplitSettlement,
)

ZERO = Decimal("0")

# The kinds of payment a member can say they want. CASH is the odd
# one out: there is nothing to reveal, because there is no number.
METHOD_TYPES = ("CASH", "BANK", "EWALLET", "QRIS")

# A settlement in one of these states has actually moved the money,
# so it takes the debt off both of the two people involved. This is
# the same set that `split_settlement_service` treats as finished.
SETTLED_STATUSES = ("COMPLETED", "CONFIRMED", "PAID")


class PaymentMethodAccessDenied(PermissionError):
    """
    Somebody asked to read an account number that is not theirs to read.

    It is a `PermissionError` so that the code which decides what to
    say about it does not have to know about this module.
    """


class PaymentMethodSummary(dict):
    """
    One payment method, without the private parts.

    It is a dictionary so that it can be handed straight to the
    screen, but it also answers to attribute access so that the
    service can be used without turning everything into dictionaries.
    """

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name)


def _dec(value) -> Decimal:
    """Any number that came from the database, as a decimal."""
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value) -> Decimal:
    """A number of money, to the smallest unit."""
    return _dec(value).quantize(Decimal("0.01"))


def _hint(account_number: Optional[str]) -> Optional[str]:
    """
    The last four digits of an account number, if there are any.

    It is kept in the clear so that a list of methods can say which
    account it is without anybody reading the whole number. It is
    four digits: enough to recognise, not enough to use.
    """
    if not account_number:
        return None
    digits = "".join(ch for ch in account_number if ch.isdigit())
    if not digits:
        return None
    return digits[-4:]


def save_payment_method(
    db: Session,
    member_id: int,
    method_type: str,
    label: Optional[str] = None,
    provider_name: Optional[str] = None,
    account_number: Optional[str] = None,
    account_name: Optional[str] = None,
) -> SplitPaymentMethod:
    """
    Write down how this member wants to be paid.

    The account number and the name on the account are encrypted
    before they are written down, so the row on disk holds no
    readable number. The last four digits are kept in the clear, so
    that a list can be shown without revealing anything.

    CASH needs no number: there is nothing to pay into. Anything else
    does, and is refused without one.
    """
    kind = (method_type or "").strip().upper()
    if kind not in METHOD_TYPES:
        raise ValueError(
            "A payment method must be one of: " + ", ".join(METHOD_TYPES) + "."
        )

    number = (account_number or "").strip()
    if kind != "CASH" and not number:
        raise ValueError(
            "A "
            + kind
            + " payment method needs an account number to pay into."
        )

    holder = (account_name or "").strip() or None

    method = SplitPaymentMethod(
        member_id=member_id,
        method_type=kind,
        label=(label or "").strip() or None,
        provider_name=(provider_name or "").strip() or None,
        # The KMS helper is randomised, so the same number written
        # twice gives two different ciphertexts. That is what makes
        # the stored value useless to anybody who reads the table.
        account_number_encrypted=encrypt_token(number) if number else None,
        account_holder_encrypted=encrypt_token(holder) if holder else None,
        account_number_hint=_hint(number),
    )
    db.add(method)
    db.flush()
    return method


def list_payment_methods(db: Session, member_id: int) -> List[PaymentMethodSummary]:
    """
    The payment methods of one member, with nothing private in them.

    The encrypted fields are not in the answer at all, not even in
    their encrypted form: there is no reason for a screen to be able
    to see the ciphertext, and a ciphertext that leaks is a ciphertext
    that is one step closer to being read.
    """
    rows = (
        db.query(SplitPaymentMethod)
        .filter(SplitPaymentMethod.member_id == member_id)
        .order_by(SplitPaymentMethod.id)
        .all()
    )
    return [
        PaymentMethodSummary(
            id=row.id,
            member_id=row.member_id,
            method_type=row.method_type,
            label=row.label,
            provider_name=row.provider_name,
            account_number_hint=row.account_number_hint,
            qris_image_url=row.qris_image_url,
            is_default=bool(row.is_default),
            created_at=row.created_at.isoformat() if row.created_at else None,
        )
        for row in rows
    ]


def member_for_user(
    db: Session, group_id: int, user_id: int
) -> Optional[SplitMember]:
    """
    The row that ties a reader of this application to a group.

    Somebody who is in the same group as the member is not the same
    person as the member. A reader has to be the member themselves,
    and this is where that is found out.
    """
    return (
        db.query(SplitMember)
        .filter(
            SplitMember.group_id == group_id,
            SplitMember.user_id == user_id,
        )
        .order_by(SplitMember.id)
        .first()
    )


def outstanding_balance(
    db: Session,
    group_id: int,
    from_member_id: int,
    to_member_id: int,
) -> Decimal:
    """
    What one member owes another member, in this group.

    `split_bill_service.group_balances` was looked at first and it is
    not quite the right question. It gives every member one net
    number for the whole group, which is what the balances screen
    shows: Budi may be a thousand down overall while still owing
    Andi nothing at all, and owing Caca the whole thousand. A net
    number cannot say "does this person owe that person", and that is
    the question that decides whether an account number may be read.

    So the pairwise figure is worked out here from the same two
    tables the balances are worked out from: `SplitCalculatedShare`
    for what a member owes for a bill, and `SplitPayer` for who put
    the money down. For every published bill, the share of the
    member who owes is divided between the people who paid, in
    proportion to how much each of them paid. A settlement that has
    actually happened takes the debt off again.

    Only bills that have been published count. A draft bill owes
    nobody anything.
    """
    if from_member_id == to_member_id:
        return ZERO

    expenses = (
        db.query(SplitExpense)
        .filter(
            SplitExpense.group_id == group_id,
            SplitExpense.status == "PUBLISHED",
        )
        .all()
    )

    debt = ZERO
    for expense in expenses:
        share = (
            db.query(SplitCalculatedShare)
            .filter(
                SplitCalculatedShare.expense_id == expense.id,
                SplitCalculatedShare.member_id == from_member_id,
            )
            .first()
        )
        if share is None:
            continue
        owed = _dec(share.final_amount)
        if owed <= ZERO:
            continue

        payers = (
            db.query(SplitPayer)
            .filter(SplitPayer.expense_id == expense.id)
            .all()
        )
        if not payers:
            continue

        total_paid = sum((_dec(payer.amount) for payer in payers), ZERO)
        if total_paid <= ZERO:
            continue

        for payer in payers:
            if payer.member_id != to_member_id:
                continue
            # The share is divided between the payers in proportion to
            # what each of them put down. When there is only one payer
            # this is simply the whole share.
            debt += owed * (_dec(payer.amount) / total_paid)

    settlements = (
        db.query(SplitSettlement)
        .filter(
            SplitSettlement.group_id == group_id,
            SplitSettlement.from_member_id == from_member_id,
            SplitSettlement.to_member_id == to_member_id,
            SplitSettlement.status.in_(SETTLED_STATUSES),
        )
        .all()
    )
    for settlement in settlements:
        debt -= _dec(settlement.amount)

    if debt < ZERO:
        debt = ZERO
    return _money(debt)


def reveal_payment_method(
    db: Session,
    method_id: int,
    requester_user_id: int,
    group_id: int,
) -> Dict[str, object]:
    """
    The account number, for somebody who has to pay it.

    Two people may read this: the member the method belongs to, and
    somebody in the same group who has an outstanding balance to pay
    that member. Anybody else is refused.

    The refusal is a `PaymentMethodAccessDenied`, which is a
    `PermissionError`. The route turns that into a 403.
    """
    method = (
        db.query(SplitPaymentMethod)
        .filter(SplitPaymentMethod.id == method_id)
        .first()
    )
    if method is None:
        raise PaymentMethodAccessDenied("The payment method was not found.")

    owner = (
        db.query(SplitMember)
        .filter(SplitMember.id == method.member_id)
        .first()
    )
    if owner is None:
        raise PaymentMethodAccessDenied("The payment method was not found.")

    if owner.group_id != group_id:
        raise PaymentMethodAccessDenied(
            "That payment method is not in this group."
        )

    # The member themselves may always read their own method.
    if owner.user_id is not None and owner.user_id == requester_user_id:
        return _revealed(method)

    requester = member_for_user(db, group_id, requester_user_id)
    if requester is None:
        raise PaymentMethodAccessDenied(
            "You are not in this group."
        )

    if requester.id == owner.id:
        return _revealed(method)

    owed = outstanding_balance(db, group_id, requester.id, owner.id)
    if owed <= ZERO:
        raise PaymentMethodAccessDenied(
            "The account number can only be read by somebody who owes this member."
        )

    return _revealed(method)


def _revealed(method: SplitPaymentMethod) -> Dict[str, object]:
    """
    The method, with the private parts read back.

    The decryption is done here and nowhere else. Everything else in
    this module works on the encrypted value or on the hint.
    """
    return {
        "id": method.id,
        "member_id": method.member_id,
        "method_type": method.method_type,
        "label": method.label,
        "provider_name": method.provider_name,
        "account_number": decrypt_token(method.account_number_encrypted or ""),
        "account_name": decrypt_token(method.account_holder_encrypted or ""),
        "account_number_hint": method.account_number_hint,
        "qris_image_url": method.qris_image_url,
        "is_default": bool(method.is_default),
    }
