"""
The shared bill, for the host.

Everything here needs the reader to be signed in. A group is their
group, and the people in it are theirs to invite and to settle with.

The guest routes - the ones a friend opens from a link in a chat
window - are in `split_guest`. They are kept apart on purpose: a
route that a guest can reach is a route that has to be checked for
what it lets a stranger do, and it is easier to check a file that
holds nothing else.
"""

import secrets
import string
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.split_bill import (
    SplitCalculatedShare,
    SplitExpense,
    SplitGroup,
    SplitItem,
    SplitItemClaim,
    SplitMember,
    SplitPayer,
    SplitSettlement,
)
from app.models.user import User
from app.schemas.split_bill import (
    SplitBalanceResponse,
    SplitClaimInput,
    SplitExpenseCreate,
    SplitExpenseResponse,
    SplitGroupCreate,
    SplitGroupResponse,
    SplitItemResponse,
    SplitMemberCreate,
    SplitMemberResponse,
    SplitSettlementCreate,
    SplitSettlementResponse,
    SplitShareResponse,
    SplitTransferResponse,
)
from app.services.split_bill_service import (
    add_claim,
    group_balances,
    recompute_expense,
    settlement_plan,
)

router = APIRouter()


def _settlement_account_id(db: Session, settlement: SplitSettlement):
    """
    The account a payment back should arrive in.

    It is the account the receipt was paid from, because that is
    where the money left from and it should come back to the same
    place. When the receipt does not say, there is no account to
    put the money into, and the payment is recorded without touching
    a balance.
    """
    if settlement.expense_id:
        expense = (
            db.query(SplitExpense)
            .filter(SplitExpense.id == settlement.expense_id)
            .first()
        )
        if expense is not None and expense.payer_account_id:
            return expense.payer_account_id
    return None


def _invite_code() -> str:
    """
    A code that can be read out over a noisy restaurant.

    No letter that is easy to mistake for another one, and no letter
    that a person might read as a number. The code goes into a chat
    window and gets typed on a phone, so it has to survive both.
    """
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def _group_for(db: Session, group_id: int, user: User) -> SplitGroup:
    """
    The group, if the reader is allowed to see it.

    A group belongs to the reader who made it and to the people in
    it. Somebody else's group is not theirs to read.
    """
    group = (
        db.query(SplitGroup)
        .filter(SplitGroup.id == group_id)
        .first()
    )
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The group was not found.",
        )
    if group.owner_id != user.id:
        member = (
            db.query(SplitMember)
            .filter(
                SplitMember.group_id == group.id,
                SplitMember.user_id == user.id,
            )
            .first()
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This group is not yours.",
            )
    return group


def _members_of(db: Session, group_id: int) -> List[SplitMember]:
    """Everybody in the group, in the order they joined."""
    return (
        db.query(SplitMember)
        .filter(SplitMember.group_id == group_id)
        .order_by(SplitMember.id)
        .all()
    )


def _member_response(member: SplitMember) -> SplitMemberResponse:
    """One person, as the screen sees them."""
    return SplitMemberResponse(
        id=member.id,
        group_id=member.group_id,
        user_id=member.user_id,
        display_name=member.display_name,
        avatar_url=member.avatar_url,
        avatar_color=member.avatar_color,
        is_host=member.is_host,
        is_present=bool(member.is_present),
        has_claim_token=bool(member.claim_token),
    )


def _group_response(db: Session, group: SplitGroup) -> SplitGroupResponse:
    """A group, with the people in it."""
    members = _members_of(db, group.id)
    return SplitGroupResponse(
        id=group.id,
        owner_id=group.owner_id,
        name=group.name,
        description=group.description,
        invite_code=group.invite_code,
        currency=group.currency or "IDR",
        is_active=bool(group.is_active),
        allow_guest_claims=bool(group.allow_guest_claims),
        members=[_member_response(member) for member in members],
        member_count=len(members),
        created_at=group.created_at.isoformat() if group.created_at else None,
    )


def _expense_response(db: Session, expense: SplitExpense) -> SplitExpenseResponse:
    """A receipt, shared, with everything that was worked out."""
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

    member_names = {
        member.id: member.display_name
        for member in db.query(SplitMember)
        .filter(SplitMember.group_id == expense.group_id)
        .all()
    }

    shares = (
        db.query(SplitCalculatedShare)
        .filter(SplitCalculatedShare.expense_id == expense.id)
        .all()
    )

    payers = (
        db.query(SplitPayer).filter(SplitPayer.expense_id == expense.id).all()
    )

    return SplitExpenseResponse(
        id=expense.id,
        group_id=expense.group_id,
        name=expense.name,
        merchant_name=expense.merchant_name,
        receipt_date=expense.receipt_date.isoformat() if expense.receipt_date else None,
        status=expense.status,
        split_mode=expense.split_mode,
        subtotal=str(expense.subtotal) if expense.subtotal is not None else None,
        tax=str(expense.tax) if expense.tax is not None else None,
        service_charge=str(expense.service_charge) if expense.service_charge is not None else None,
        discount=str(expense.discount) if expense.discount is not None else None,
        grand_total=str(expense.grand_total) if expense.grand_total is not None else None,
        discrepancy=str(expense.discrepancy) if expense.discrepancy is not None else None,
        record_personal_share=bool(expense.record_personal_share),
        transaction_id=expense.transaction_id,
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
        shares=[
            SplitShareResponse(
                member_id=share.member_id,
                display_name=member_names.get(share.member_id, ""),
                item_total=str(share.item_total),
                exact_amount=str(share.exact_amount),
                final_amount=str(share.final_amount),
                is_paid=bool(share.is_paid),
            )
            for share in shares
        ],
        payers=[
            {
                "member_id": payer.member_id,
                "amount": str(payer.amount),
                "currency": payer.currency,
            }
            for payer in payers
        ],
        created_at=expense.created_at.isoformat() if expense.created_at else None,
    )


# --- the groups ------------------------------------------------------------


@router.get("/groups", response_model=List[SplitGroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The groups the reader is in.

    The ones they made come first, then the ones they were invited
    to. A reader who has never shared a bill sees an empty list,
    which is the truth rather than a page with a spinner on it.
    """
    member_rows = (
        db.query(SplitMember)
        .filter(SplitMember.user_id == current_user.id)
        .all()
    )
    group_ids = [row.group_id for row in member_rows]
    owned = (
        db.query(SplitGroup)
        .filter(SplitGroup.owner_id == current_user.id)
        .all()
    )

    groups = {group.id: group for group in owned}
    if group_ids:
        for group in (
            db.query(SplitGroup).filter(SplitGroup.id.in_(group_ids)).all()
        ):
            groups.setdefault(group.id, group)

    ordered = sorted(
        groups.values(),
        key=lambda group: (group.owner_id != current_user.id, group.id),
    )
    return [_group_response(db, group) for group in ordered]


@router.post(
    "/groups",
    response_model=SplitGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_group(
    payload: SplitGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    A new group, with the reader in it.

    The reader is the host. A group with nobody in it is not a
    group, so the host is added before the group is written down.
    """
    code = _invite_code()
    # The code has to be free. It is eight characters, so this
    # almost never loops, but a group whose code belongs to another
    # group would send people to the wrong table.
    for _ in range(5):
        clash = (
            db.query(SplitGroup)
            .filter(SplitGroup.invite_code == code)
            .first()
        )
        if clash is None:
            break
        code = _invite_code()

    group = SplitGroup(
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description,
        currency=(payload.currency or "IDR").upper(),
        invite_code=code,
        allow_guest_claims=payload.allow_guest_claims,
    )
    db.add(group)
    db.flush()

    db.add(
        SplitMember(
            group_id=group.id,
            user_id=current_user.id,
            display_name=current_user.name or current_user.email,
            is_host=True,
            is_present=True,
        )
    )
    db.commit()
    db.refresh(group)
    return _group_response(db, group)


@router.get("/groups/{group_id}", response_model=SplitGroupResponse)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One group, with the people in it."""
    group = _group_for(db, group_id, current_user)
    return _group_response(db, group)


@router.post(
    "/groups/{group_id}/members",
    response_model=SplitMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    group_id: int,
    payload: SplitMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Somebody at the table.

    A member may be a reader of this application, or they may be
    somebody with no account at all who will claim their food from a
    link. The second kind is given a claim token, which is the pass
    that lets them do that.
    """
    group = _group_for(db, group_id, current_user)

    member = SplitMember(
        group_id=group.id,
        user_id=payload.user_id,
        display_name=payload.display_name,
        avatar_url=payload.avatar_url,
        avatar_color=payload.avatar_color,
        is_host=payload.is_host,
        is_present=payload.is_present,
        claim_token=secrets.token_urlsafe(24) if payload.user_id is None else None,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return _member_response(member)


@router.get("/groups/{group_id}/balances", response_model=List[SplitBalanceResponse])
def get_balances(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    What everybody owes the group, or is owed by it.

    A positive number means the group owes them. A negative number
    means they owe the group.
    """
    group = _group_for(db, group_id, current_user)
    members = _members_of(db, group.id)
    balances = group_balances(db, group, members)
    return [
        SplitBalanceResponse(
            member_id=member.id,
            display_name=member.display_name,
            net_position=str(balances.get(member.id, Decimal("0"))),
            total_paid="0",
            total_owed="0",
        )
        for member in members
    ]


@router.get("/groups/{group_id}/settlement-plan", response_model=List[SplitTransferResponse])
def get_settlement_plan(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The fewest payments that clear the group.
    """
    group = _group_for(db, group_id, current_user)
    members = _members_of(db, group.id)
    plan = settlement_plan(db, group, members)
    return [
        SplitTransferResponse(
            from_member=step["from_member"],
            to_member=step["to_member"],
            amount=str(step["amount"]),
        )
        for step in plan
    ]


# --- the receipts ----------------------------------------------------------


@router.get("/groups/{group_id}/expenses", response_model=List[SplitExpenseResponse])
def list_expenses(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The receipts the group has shared."""
    group = _group_for(db, group_id, current_user)
    expenses = (
        db.query(SplitExpense)
        .filter(SplitExpense.group_id == group.id)
        .order_by(SplitExpense.id.desc())
        .all()
    )
    return [_expense_response(db, expense) for expense in expenses]


@router.post(
    "/groups/{group_id}/expenses",
    response_model=SplitExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_expense(
    group_id: int,
    payload: SplitExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    A receipt, shared with the group.

    The bill starts as a draft. A draft changes nothing: nothing is
    written to the reader's records, nothing moves in their
    accounts, and nobody owes anything. It becomes real when it is
    published, and the host chooses to do that.
    """
    group = _group_for(db, group_id, current_user)
    members = _members_of(db, group.id)

    expense = SplitExpense(
        group_id=group.id,
        user_id=current_user.id,
        name=payload.name,
        merchant_name=payload.merchant_name,
        receipt_scan_id=payload.receipt_scan_id,
        subtotal=payload.subtotal,
        tax=payload.tax,
        service_charge=payload.service_charge,
        discount=payload.discount,
        grand_total=payload.grand_total,
        split_mode=payload.split_mode,
        payer_account_id=payload.payer_account_id,
        record_personal_share=payload.record_personal_share,
        status="DRAFT",
    )
    db.add(expense)
    db.flush()

    if payload.receipt_date:
        from datetime import date as _date

        try:
            expense.receipt_date = datetime.fromisoformat(
                payload.receipt_date
            ).date()
        except ValueError:
            try:
                expense.receipt_date = _date.fromisoformat(
                    payload.receipt_date
                )
            except ValueError:
                expense.receipt_date = None

    for item in payload.items:
        # The total of a line is what the line costs in all. When the
        # reader gave the price of one and how many, the total is
        # worked out from those two. When they gave the total
        # itself, that is what is used.
        total = item.total_price
        if not total:
            total = (item.unit_price or 0) * (item.quantity or 0)

        db.add(
            SplitItem(
                expense_id=expense.id,
                name=item.name,
                raw_name=item.raw_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=total,
                kind=item.kind,
                category=item.category,
                line_number=item.line_number,
            )
        )

    for payer in payload.payers:
        db.add(
            SplitPayer(
                expense_id=expense.id,
                member_id=payer.member_id,
                amount=payer.amount,
                currency=group.currency or "IDR",
            )
        )

    db.flush()
    recompute_expense(db, expense, members, currency=group.currency or "IDR")
    db.commit()
    db.refresh(expense)
    return _expense_response(db, expense)


@router.get("/expenses/{expense_id}", response_model=SplitExpenseResponse)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One receipt, shared."""
    expense = db.query(SplitExpense).filter(SplitExpense.id == expense_id).first()
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The receipt was not found.",
        )
    _group_for(db, expense.group_id, current_user)
    return _expense_response(db, expense)


@router.post("/expenses/{expense_id}/claims", response_model=SplitExpenseResponse)
def claim_item(
    expense_id: int,
    payload: SplitClaimInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The host claiming a line for somebody.

    This is the other way round from the guest claiming their own
    food: here the host says who had what, and the bill is worked
    out again straight away.
    """
    expense = db.query(SplitExpense).filter(SplitExpense.id == expense_id).first()
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The receipt was not found.",
        )
    group = _group_for(db, expense.group_id, current_user)

    item = (
        db.query(SplitItem)
        .filter(SplitItem.id == payload.item_id, SplitItem.expense_id == expense_id)
        .first()
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That line is not on this receipt.",
        )

    if payload.member_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Somebody has to be named on the claim.",
        )

    member = (
        db.query(SplitMember)
        .filter(SplitMember.id == payload.member_id)
        .first()
    )
    if member is None or member.group_id != group.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That person is not in this group.",
        )

    # A line cannot be claimed past what is on it. The receipt has to
    # add up, and the host is the one who notices a line that has
    # been claimed twice.
    already = Decimal("0")
    for claim_row in (
        db.query(SplitItemClaim)
        .filter(SplitItemClaim.item_id == item.id)
        .all()
    ):
        if claim_row.member_id == member.id:
            continue
        already += Decimal(str(claim_row.quantity or 0))

    quantity = Decimal(str(payload.quantity))
    if already + quantity > Decimal(str(item.quantity or 1)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There is not that much of that left on the receipt.",
        )

    add_claim(db, item, member.id, quantity)
    db.flush()

    members = _members_of(db, group.id)
    recompute_expense(db, expense, members, currency=group.currency or "IDR")
    db.commit()
    db.refresh(expense)
    return _expense_response(db, expense)


@router.delete("/expenses/{expense_id}/claims/{claim_id}", response_model=SplitExpenseResponse)
def release_claim(
    expense_id: int,
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    A claim taken back.

    Somebody changed their mind about the food, or the host noticed
    the claim was on the wrong line. The bill is worked out again.
    """
    expense = db.query(SplitExpense).filter(SplitExpense.id == expense_id).first()
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The receipt was not found.",
        )
    group = _group_for(db, expense.group_id, current_user)

    claim = (
        db.query(SplitItemClaim)
        .filter(SplitItemClaim.id == claim_id)
        .first()
    )
    if claim is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That claim was not found.",
        )

    item = (
        db.query(SplitItem)
        .filter(SplitItem.id == claim.item_id)
        .first()
    )
    if item is None or item.expense_id != expense_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That claim is not on this receipt.",
        )

    db.delete(claim)
    db.flush()

    members = _members_of(db, group.id)
    recompute_expense(db, expense, members, currency=group.currency or "IDR")
    db.commit()
    db.refresh(expense)
    return _expense_response(db, expense)


@router.post("/expenses/{expense_id}/publish", response_model=SplitExpenseResponse)
def publish_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The bill becomes real.

    Before this, nothing is owed by anybody and nothing has been
    written to the reader's records. After it, everybody owes their
    share of the bill, and the host's own share is written down
    against the account they paid from.

    The accounting of the host's own money is on the service that
    publishes it, so that the rule that the money somebody else owes
    is not the reader's spending lives in one place.
    """
    expense = db.query(SplitExpense).filter(SplitExpense.id == expense_id).first()
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The receipt was not found.",
        )
    group = _group_for(db, expense.group_id, current_user)

    if expense.status == "PUBLISHED":
        return _expense_response(db, expense)

    members = _members_of(db, group.id)
    recompute_expense(db, expense, members, currency=group.currency or "IDR")

    # A receipt whose lines do not add up to its own subtotal was
    # read wrong somewhere. Publishing it would mean somebody pays
    # for a line that was never on the receipt, so the bill is
    # refused until the reader has dealt with the gap.
    if expense.discrepancy is not None:
        from app.services.split_bill_service import describe_discrepancy

        words = describe_discrepancy(
            expense.discrepancy, group.currency or "IDR"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=words
            or "The lines of this receipt do not add up to its subtotal.",
        )

    from app.services.split_publish_service import publish_expense_to_ledger

    publish_expense_to_ledger(
        db,
        expense=expense,
        group=group,
        members=members,
        user=current_user,
    )

    expense.status = "PUBLISHED"
    db.commit()
    db.refresh(expense)
    return _expense_response(db, expense)


# --- the settlements -------------------------------------------------------


@router.get(
    "/groups/{group_id}/settlements",
    response_model=List[SplitSettlementResponse],
)
def list_settlements(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The payments between the people in the group."""
    group = _group_for(db, group_id, current_user)
    settlements = (
        db.query(SplitSettlement)
        .filter(SplitSettlement.group_id == group.id)
        .order_by(SplitSettlement.id.desc())
        .all()
    )
    names = {
        member.id: member.display_name for member in _members_of(db, group.id)
    }
    return [
        SplitSettlementResponse(
            id=settlement.id,
            group_id=settlement.group_id,
            from_member_id=settlement.from_member_id,
            to_member_id=settlement.to_member_id,
            from_member_name=names.get(settlement.from_member_id, ""),
            to_member_name=names.get(settlement.to_member_id, ""),
            amount=str(settlement.amount),
            currency=settlement.currency or "IDR",
            status=settlement.status,
            proof_url=settlement.proof_url,
            proof_amount=(
                str(settlement.proof_amount)
                if settlement.proof_amount is not None
                else None
            ),
            proof_date=(
                settlement.proof_date.isoformat()
                if settlement.proof_date
                else None
            ),
            settled_at=(
                settlement.settled_at.isoformat() if settlement.settled_at else None
            ),
            created_at=(
                settlement.created_at.isoformat() if settlement.created_at else None
            ),
        )
        for settlement in settlements
    ]


@router.post(
    "/groups/{group_id}/settlements",
    response_model=SplitSettlementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_settlement(
    group_id: int,
    payload: SplitSettlementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Somebody paid somebody back.

    The payment starts as waiting for its proof. It counts towards
    clearing the group only once it is marked as done, because until
    then the money has not moved.
    """
    group = _group_for(db, group_id, current_user)

    member_ids = {
        member.id for member in _members_of(db, group.id)
    }
    if payload.from_member_id not in member_ids or payload.to_member_id not in member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both people have to be in this group.",
        )
    if payload.from_member_id == payload.to_member_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Somebody cannot pay themselves back.",
        )

    settlement = SplitSettlement(
        group_id=group.id,
        from_member_id=payload.from_member_id,
        to_member_id=payload.to_member_id,
        amount=payload.amount,
        currency=group.currency or "IDR",
        expense_id=payload.expense_id,
        status="PENDING",
        proof_url=payload.proof_url,
        proof_amount=payload.proof_amount,
        proof_note=payload.proof_note,
    )
    if payload.proof_date:
        from datetime import date as _date

        try:
            settlement.proof_date = _date.fromisoformat(payload.proof_date)
        except ValueError:
            settlement.proof_date = None

    db.add(settlement)
    db.commit()
    db.refresh(settlement)

    names = {
        member.id: member.display_name for member in _members_of(db, group.id)
    }
    return SplitSettlementResponse(
        id=settlement.id,
        group_id=settlement.group_id,
        from_member_id=settlement.from_member_id,
        to_member_id=settlement.to_member_id,
        from_member_name=names.get(settlement.from_member_id, ""),
        to_member_name=names.get(settlement.to_member_id, ""),
        amount=str(settlement.amount),
        currency=settlement.currency or "IDR",
        status=settlement.status,
        proof_url=settlement.proof_url,
        proof_amount=(
            str(settlement.proof_amount) if settlement.proof_amount is not None else None
        ),
        proof_date=settlement.proof_date.isoformat() if settlement.proof_date else None,
        settled_at=None,
        created_at=settlement.created_at.isoformat() if settlement.created_at else None,
    )


@router.post(
    "/settlements/{settlement_id}/confirm",
    response_model=SplitSettlementResponse,
)
def confirm_settlement(
    settlement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The payment is done.

    Only the person who was paid can say that the money has arrived.
    From this moment the debt is off the books of both of them.
    """
    settlement = (
        db.query(SplitSettlement)
        .filter(SplitSettlement.id == settlement_id)
        .first()
    )
    if settlement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The payment was not found.",
        )
    group = _group_for(db, settlement.group_id, current_user)

    if settlement.to_member_id not in {
        member.id for member in _members_of(db, group.id)
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This payment is not yours to confirm.",
        )

    # The money goes into the account it came out of. This is not
    # income: it is the reader's own money coming back, and the
    # service that writes it knows that.
    from app.services.split_settlement_service import settle_payment

    settle_payment(
        db,
        group=group,
        settlement=settlement,
        to_account_id=_settlement_account_id(db, settlement),
        user=current_user,
    )

    settlement.status = "COMPLETED"
    settlement.settled_at = datetime.utcnow()
    db.commit()
    db.refresh(settlement)

    names = {
        member.id: member.display_name for member in _members_of(db, group.id)
    }
    return SplitSettlementResponse(
        id=settlement.id,
        group_id=settlement.group_id,
        from_member_id=settlement.from_member_id,
        to_member_id=settlement.to_member_id,
        from_member_name=names.get(settlement.from_member_id, ""),
        to_member_name=names.get(settlement.to_member_id, ""),
        amount=str(settlement.amount),
        currency=settlement.currency or "IDR",
        status=settlement.status,
        proof_url=settlement.proof_url,
        proof_amount=(
            str(settlement.proof_amount) if settlement.proof_amount is not None else None
        ),
        proof_date=settlement.proof_date.isoformat() if settlement.proof_date else None,
        settled_at=settlement.settled_at.isoformat() if settlement.settled_at else None,
        created_at=settlement.created_at.isoformat() if settlement.created_at else None,
    )
