"""
How the people in a group are paid.

The routes here do three things:

- a member saves how they want to be paid;
- the group can see that a member has a way of being paid, without
  seeing the number;
- somebody who has to pay that member can read the number, and
  nobody else can.

The last one is the point of the whole feature. An account number is
not a password: it stops being private the moment somebody has to
transfer money to it. So it is encrypted on the way in, and it is
read out only for the person who genuinely has to press "transfer".

These routes need the reader to be signed in. They sit beside the
host routes in `split_bills` and apart from the guest routes in
`split_guest`, because a route that a guest can reach is a route
that has to be checked for what it lets a stranger do.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.split_bill import SplitMember, SplitPaymentMethod
from app.models.user import User
from app.schemas.split_payment import (
    SplitPaymentMethodCreate,
    SplitPaymentMethodResponse,
    SplitPaymentMethodRevealResponse,
)
from app.services.split_payment_service import (
    PaymentMethodAccessDenied,
    list_payment_methods,
    reveal_payment_method,
    save_payment_method,
)

router = APIRouter()


def _member_in_group(db: Session, group_id: int, member_id: int) -> SplitMember:
    """
    The member, if they are in that group.

    A member id from another group is not the member of this group,
    and the two are never the same person.
    """
    member = (
        db.query(SplitMember)
        .filter(
            SplitMember.id == member_id,
            SplitMember.group_id == group_id,
        )
        .first()
    )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That person is not in this group.",
        )
    return member


def _reader_of(db: Session, group_id: int, user: User) -> SplitMember:
    """
    The reader of this application, as a member of this group.

    Somebody who is not in the group at all is not somebody the group
    owes anything to, and so is not somebody who may be shown how the
    people in it are paid.
    """
    member = (
        db.query(SplitMember)
        .filter(
            SplitMember.group_id == group_id,
            SplitMember.user_id == user.id,
        )
        .order_by(SplitMember.id)
        .first()
    )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This group is not yours.",
        )
    return member


@router.post(
    "/groups/{group_id}/members/{member_id}/payment-methods",
    response_model=SplitPaymentMethodResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_payment_method_route(
    group_id: int,
    member_id: int,
    payload: SplitPaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Say how this member wants to be paid.

    Only the member themselves may write this down. Somebody else in
    the group may not put an account number in on their behalf, and
    certainly may not put in one that is not theirs.
    """
    member = _member_in_group(db, group_id, member_id)

    if member.user_id is None or member.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only save a payment method for yourself.",
        )

    try:
        method = save_payment_method(
            db,
            member_id=member.id,
            method_type=payload.method_type,
            label=payload.label,
            provider_name=payload.provider_name,
            account_number=payload.account_number,
            account_name=payload.account_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    db.commit()
    db.refresh(method)
    return SplitPaymentMethodResponse(
        id=method.id,
        member_id=method.member_id,
        method_type=method.method_type,
        label=method.label,
        provider_name=method.provider_name,
        account_number_hint=method.account_number_hint,
        qris_image_url=method.qris_image_url,
        is_default=bool(method.is_default),
        created_at=method.created_at.isoformat() if method.created_at else None,
    )


@router.get(
    "/groups/{group_id}/members/{member_id}/payment-methods",
    response_model=List[SplitPaymentMethodResponse],
)
def list_payment_methods_route(
    group_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    How this member can be paid, without the account number.

    Everybody in the group may see this. It says that a member has a
    bank account and what the last four digits of it are, which is
    what is needed to ask "is this the account you meant?" without
    handing out the whole number.
    """
    _member_in_group(db, group_id, member_id)
    _reader_of(db, group_id, current_user)

    return list_payment_methods(db, member_id)


@router.get(
    "/payment-methods/{method_id}/reveal",
    response_model=SplitPaymentMethodRevealResponse,
)
def reveal_payment_method_route(
    method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The account number, for somebody who has to pay it.

    The check is in the service and it is the check that matters: the
    requester either is the member the method belongs to, or has an
    outstanding balance to pay that member in that group. Anybody
    else gets a 403 and learns nothing.
    """
    method = (
        db.query(SplitPaymentMethod)
        .filter(SplitPaymentMethod.id == method_id)
        .first()
    )
    if method is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The payment method was not found.",
        )

    owner = (
        db.query(SplitMember)
        .filter(SplitMember.id == method.member_id)
        .first()
    )
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The payment method was not found.",
        )

    try:
        revealed = reveal_payment_method(
            db,
            method_id=method_id,
            requester_user_id=current_user.id,
            group_id=owner.group_id,
        )
    except PaymentMethodAccessDenied as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    return revealed
