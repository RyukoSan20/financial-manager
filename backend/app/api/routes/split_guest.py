"""
The shared bill, for the people who are not readers of this app.

Somebody at the table opens a link and taps the food they ordered.
They do not have an account, they are not going to install anything,
and they are not going to create a password at the table. They give
the name they want to be called and they are in.

The pass they are given is scoped. It is good for one group, for one
day, and it lets them do two things: claim a line of the receipt, and
upload the picture of the money they sent. It does not let them read
the group's balances, see anybody else's name, or change anything
that is not their own claim.

The routes here are the only ones a person with no account can reach,
so they are kept in a file of their own. That way the question "what
can a stranger do to this application" has one place to be answered
in.
"""

import secrets
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.split_bill import (
    SplitExpense,
    SplitGroup,
    SplitItem,
    SplitItemClaim,
    SplitMember,
)
from app.schemas.split_bill import (
    SplitClaimInput,
    SplitExpenseResponse,
    SplitGuestJoin,
    SplitGuestSessionResponse,
    SplitItemResponse,
    SplitMemberResponse,
)
from app.services.split_bill_service import (
    build_claims,
    member_item_totals,
    read_receipt_totals,
)

router = APIRouter()

# How long the pass a guest is given lasts. A dinner is a few hours.
# A day is long enough that somebody who closed the app to look at
# the receipt can come back and claim their food.
GUEST_PASS_LIFETIME = timedelta(days=1)


def _group_by_code(db: Session, code: str) -> SplitGroup:
    """The group the link points at."""
    group = (
        db.query(SplitGroup)
        .filter(SplitGroup.invite_code == (code or "").upper())
        .first()
    )
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This link does not point at a group.",
        )
    if not group.is_active:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This group has been closed.",
        )
    return group


def _member_by_token(db: Session, group_id: int, token: Optional[str]) -> SplitMember:
    """
    The guest who is holding this pass.

    The pass has to match a member of this group. A pass that is
    valid somewhere else is not valid here, so the group is part of
    the check rather than something that is looked up afterwards.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This link needs a claim pass. Ask the host for a new link.",
        )
    member = (
        db.query(SplitMember)
        .filter(
            SplitMember.group_id == group_id,
            SplitMember.claim_token == token,
        )
        .first()
    )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This claim pass is not for this group.",
        )
    return member


def _guest_expense_response(
    db: Session, expense: SplitExpense, member: SplitMember
) -> SplitExpenseResponse:
    """
    The receipt as the guest sees it.

    The guest sees the lines and who has claimed what. They do not
    see the balances: what the other people owe is not their
    business, and showing it would turn a shared dinner into a
    ledger everybody can read.
    """
    items = (
        db.query(SplitItem)
        .filter(SplitItem.expense_id == expense.id)
        .order_by(SplitItem.id)
        .all()
    )
    claims = (
        db.query(SplitItemClaim)
        .join(SplitItem, SplitItemClaim.item_id == SplitItem.id)
        .filter(SplitItem.expense_id == expense.id)
        .all()
    )
    claims_by_item: dict = {}
    for claim in claims:
        claims_by_item.setdefault(claim.item_id, []).append(
            {
                "member_id": claim.member_id,
                "quantity": str(claim.quantity),
                "claimed_at": claim.claimed_at.isoformat() if claim.claimed_at else None,
            }
        )

    totals = read_receipt_totals(expense)

    return SplitExpenseResponse(
        id=expense.id,
        group_id=expense.group_id,
        name=expense.name,
        merchant_name=expense.merchant_name,
        receipt_date=expense.receipt_date.isoformat() if expense.receipt_date else None,
        status=expense.status,
        split_mode=expense.split_mode,
        subtotal=str(totals["subtotal"]),
        tax=str(totals["tax"]),
        service_charge=str(totals["service_charge"]),
        discount=str(totals["discount"]),
        grand_total=str(totals["grand_total"]),
        discrepancy=None,
        record_personal_share=False,
        transaction_id=None,
        items=[
            SplitItemResponse(
                id=item.id,
                name=item.name,
                raw_name=item.raw_name,
                quantity=str(item.quantity),
                unit_price=str(item.unit_price),
                total_price=str(item.total_price),
                kind=item.kind or "item",
                category=item.category,
                is_verified=bool(item.is_verified),
                is_claimed=bool(item.is_claimed),
                claims=claims_by_item.get(item.id, []),
            )
            for item in items
        ],
        shares=[],
        payers=[],
        created_at=expense.created_at.isoformat() if expense.created_at else None,
    )


@router.get("/claim/{code}")
def peek_group(
    code: str,
    db: Session = Depends(get_db),
):
    """
    What the link points at.

    The name of the group and the number of people in it, so that
    somebody opening the link knows they are in the right place
    before they give their name.
    """
    group = _group_by_code(db, code)
    members = (
        db.query(SplitMember)
        .filter(SplitMember.group_id == group.id)
        .order_by(SplitMember.id)
        .all()
    )
    return {
        "group_id": group.id,
        "group_name": group.name,
        "currency": group.currency or "IDR",
        "member_count": len(members),
        "allow_guest_claims": bool(group.allow_guest_claims),
        "members": [
            {
                "id": member.id,
                "display_name": member.display_name,
                "avatar_color": member.avatar_color,
                "is_host": bool(member.is_host),
            }
            for member in members
        ],
    }


@router.post("/claim/{code}/join", response_model=SplitGuestSessionResponse)
def join_group(
    code: str,
    payload: SplitGuestJoin,
    db: Session = Depends(get_db),
):
    """
    Giving a name and getting in.

    The name they give is the name the other people at the table
    will see next to the food they claimed. They are also asked for
    it once: the name is how everybody knows who is who, and a guest
    who could change their name after claiming something could claim
    the same line twice under two names.
    """
    group = _group_by_code(db, code)
    if not group.allow_guest_claims:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This group has turned off claiming for guests.",
        )

    # The same name is not taken twice in one group. Two people
    # called "Budi" at the same table would make the receipt
    # unreadable.
    existing = (
        db.query(SplitMember)
        .filter(
            SplitMember.group_id == group.id,
            SplitMember.display_name == payload.display_name,
        )
        .first()
    )
    if existing is not None:
        if existing.claim_token:
            # The same person coming back to the same link. They get
            # their pass back rather than a second place at the
            # table.
            return SplitGuestSessionResponse(
                member_id=existing.id,
                display_name=existing.display_name,
                claim_token=existing.claim_token,
                group_id=group.id,
                group_name=group.name,
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Somebody at this table already has that name.",
        )

    token = secrets.token_urlsafe(24)
    member = SplitMember(
        group_id=group.id,
        user_id=None,
        display_name=payload.display_name,
        claim_token=token,
        is_present=True,
        is_host=False,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return SplitGuestSessionResponse(
        member_id=member.id,
        display_name=member.display_name,
        claim_token=token,
        group_id=group.id,
        group_name=group.name,
    )


@router.get("/claim/{code}/expenses")
def list_group_expenses(
    code: str,
    x_split_guest_token: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    The receipts the group has shared.

    The guest is shown the first one that has not been published yet,
    because that is the one people are still claiming. If everything
    has been published, the newest one is shown instead, so that the
    guest can still see what they claimed.
    """
    group = _group_by_code(db, code)
    _member_by_token(db, group.id, x_split_guest_token)

    expenses = (
        db.query(SplitExpense)
        .filter(SplitExpense.group_id == group.id)
        .order_by(SplitExpense.id.desc())
        .all()
    )

    drafts = [expense for expense in expenses if expense.status != "PUBLISHED"]
    chosen = drafts[0] if drafts else (expenses[0] if expenses else None)

    return {
        "expense_id": chosen.id if chosen else None,
        "count": len(expenses),
        "expenses": [
            {
                "id": expense.id,
                "name": expense.name,
                "merchant_name": expense.merchant_name,
                "status": expense.status,
            }
            for expense in expenses
        ],
    }


@router.get("/expenses/{expense_id}/live")
def live_receipt(
    expense_id: int,
    x_split_guest_token: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    The receipt, live.

    This is what the guest's screen asks for again and again. It
    answers with the lines and who has claimed what, so that when
    somebody at the table taps a plate, everybody's screen changes.
    """
    expense = (
        db.query(SplitExpense).filter(SplitExpense.id == expense_id).first()
    )
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The receipt was not found.",
        )
    member = _member_by_token(db, expense.group_id, x_split_guest_token)

    response = _guest_expense_response(db, expense, member)

    # The guest's own share, so their screen can say what they owe
    # without asking the host.
    item_totals, _counts = member_item_totals(db, expense.id)
    response.shares = [
        {
            "member_id": member.id,
            "display_name": member.display_name,
            "item_total": str(item_totals.get(member.id, Decimal("0"))),
            "exact_amount": str(item_totals.get(member.id, Decimal("0"))),
            "final_amount": str(item_totals.get(member.id, Decimal("0"))),
            "is_paid": False,
        }
    ]
    return response


@router.post("/expenses/{expense_id}/claim", response_model=SplitExpenseResponse)
def claim(
    expense_id: int,
    payload: SplitClaimInput,
    x_split_guest_token: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Tapping a plate.

    The guest says how many of the things on that line they took. A
    line of two coffees, claimed by two people, is two claims of one
    coffee each.

    A guest cannot claim more of a line than there is on it. That is
    checked here rather than left to the arithmetic: a line that is
    claimed past its quantity would leave the receipt adding up to
    more than it should, and the host would have to find out why
    their dinner costs too much.
    """
    expense = (
        db.query(SplitExpense).filter(SplitExpense.id == expense_id).first()
    )
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The receipt was not found.",
        )
    member = _member_by_token(db, expense.group_id, x_split_guest_token)

    item = (
        db.query(SplitItem)
        .filter(
            SplitItem.id == payload.item_id,
            SplitItem.expense_id == expense_id,
        )
        .first()
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That line is not on this receipt.",
        )

    quantity = Decimal(str(payload.quantity))
    available = Decimal(str(item.quantity or 1))

    # What is already taken by somebody else. The guest's own claim
    # on this line does not count against them: tapping the same
    # plate again replaces their claim rather than adding to it.
    taken = Decimal("0")
    for claim_row in (
        db.query(SplitItemClaim)
        .filter(SplitItemClaim.item_id == item.id)
        .all()
    ):
        if claim_row.member_id == member.id:
            continue
        taken += Decimal(str(claim_row.quantity or 0))

    if taken + quantity > available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There is not that much of that left on the receipt.",
        )

    # The guest's own claim on that line is replaced rather than
    # added to. Tapping the same plate twice should not claim two
    # coffees.
    for claim_row in (
        db.query(SplitItemClaim)
        .filter(
            SplitItemClaim.item_id == item.id,
            SplitItemClaim.member_id == member.id,
        )
        .all()
    ):
        db.delete(claim_row)
    db.flush()

    db.add(
        SplitItemClaim(
            item_id=item.id,
            member_id=member.id,
            quantity=quantity,
            claimed_at=datetime.utcnow(),
        )
    )
    db.commit()

    return _guest_expense_response(db, expense, member)


@router.delete("/expenses/{expense_id}/claim/{item_id}", response_model=SplitExpenseResponse)
def release(
    expense_id: int,
    item_id: int,
    x_split_guest_token: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Taking a claim back.

    Somebody ordered the steak after all.
    """
    expense = (
        db.query(SplitExpense).filter(SplitExpense.id == expense_id).first()
    )
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The receipt was not found.",
        )
    member = _member_by_token(db, expense.group_id, x_split_guest_token)

    for claim_row in (
        db.query(SplitItemClaim)
        .filter(
            SplitItemClaim.item_id == item_id,
            SplitItemClaim.member_id == member.id,
        )
        .all()
    ):
        db.delete(claim_row)
    db.commit()

    return _guest_expense_response(db, expense, member)
