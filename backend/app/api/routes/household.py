"""
The household page's API.

Everything here is about the household the reader is in. A row that
belongs to another household is answered with "not found", the same
as a row that does not exist.

The numbers on the page are the reader's own. Being in a household
with somebody does not show them your accounts.
"""

from datetime import date as _date
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.household import HouseholdNeed
from app.models.user import User
from app.services import household_service as service
from app.services.household_service import HouseholdError

router = APIRouter()


def _refuse(error: HouseholdError) -> HTTPException:
    """The reason as a code, so the page can say it in the reader's language."""
    return HTTPException(status_code=error.status_code, detail=error.code)


# ---------------------------------------------------------------------------
# What the page sends
# ---------------------------------------------------------------------------

class SwitchModeBody(BaseModel):
    mode: Optional[str] = Field(None, max_length=20)
    name: Optional[str] = Field(None, max_length=120)


class JoinBody(BaseModel):
    invite_code: str = Field(max_length=16)


class InviteBody(BaseModel):
    name: str = Field(max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field(None, max_length=20)


class AgendaBody(BaseModel):
    title: str = Field(max_length=200)
    date: _date
    time: Optional[str] = Field(None, max_length=20)
    location: Optional[str] = Field(None, max_length=200)
    kind: str = Field("meeting", max_length=20)


class TaskBody(BaseModel):
    title: str = Field(max_length=200)
    assignee: Optional[str] = Field(None, max_length=100)
    reward_points: int = Field(10, ge=0, le=1000)


class NeedBody(BaseModel):
    title: str = Field(max_length=200)
    estimated_price: float = Field(0, ge=0)
    assignee: Optional[str] = Field(None, max_length=100)


class NoteBody(BaseModel):
    body: str = Field(max_length=2000)
    color: Optional[str] = Field(None, max_length=20)


class PurchaseBody(BaseModel):
    # The account the money left. The reader says which; it is never
    # guessed, because guessing wrong moves the wrong balance.
    account_id: int
    # What it actually cost. Left out, it is the estimate.
    amount: Optional[float] = Field(None, gt=0)
    category_id: Optional[int] = None
    date: Optional[_date] = None


class ShareGoalBody(BaseModel):
    goal_id: int


# ---------------------------------------------------------------------------
# The household
# ---------------------------------------------------------------------------

@router.get("")
@router.get("/", include_in_schema=False)
def get_household(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The household the reader is in, with everything the page shows."""
    try:
        payload = service.overview(db, current_user)
        payload["wishlist_waiting"] = service.wishlist_waiting(db, current_user, payload["id"])
        return payload
    except HouseholdError as error:
        raise _refuse(error)


@router.post("/switch-mode")
def switch_mode(
    body: SwitchModeBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change what the household is for, or what it is called."""
    try:
        household = service.switch_mode(db, current_user, mode=body.mode, name=body.name)
    except HouseholdError as error:
        raise _refuse(error)
    return {"id": household.id, "name": household.name, "mode": household.mode}


@router.post("/join")
def join_household(
    body: JoinBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Join a household with its eight-character code."""
    try:
        household = service.join(db, current_user, body.invite_code)
    except HouseholdError as error:
        raise _refuse(error)
    return {"id": household.id, "name": household.name, "mode": household.mode}


@router.post("/invite", status_code=201)
def invite_member(
    body: InviteBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Put somebody on the list and get the links to send them."""
    try:
        return service.invite(db, current_user, body.name, body.email, body.role)
    except HouseholdError as error:
        raise _refuse(error)


# ---------------------------------------------------------------------------
# The calendar
# ---------------------------------------------------------------------------

@router.post("/agendas", status_code=201)
def create_agenda(
    body: AgendaBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        agenda = service.add_agenda(
            db, current_user, body.title, body.date, body.time, body.location, body.kind
        )
    except HouseholdError as error:
        raise _refuse(error)
    return service.agenda_payload(agenda)


@router.patch("/agendas/{agenda_id}/toggle")
def toggle_agenda(
    agenda_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.agenda_payload(service.toggle_agenda(db, current_user, agenda_id))
    except HouseholdError as error:
        raise _refuse(error)


@router.delete("/agendas/{agenda_id}", status_code=204)
def delete_agenda(
    agenda_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        service.remove(db, current_user, "agenda", agenda_id)
    except HouseholdError as error:
        raise _refuse(error)


# ---------------------------------------------------------------------------
# The chores
# ---------------------------------------------------------------------------

@router.post("/tasks", status_code=201)
def create_task(
    body: TaskBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        task = service.add_task(db, current_user, body.title, body.assignee, body.reward_points)
    except HouseholdError as error:
        raise _refuse(error)
    return service.task_payload(task)


@router.patch("/tasks/{task_id}/toggle")
def toggle_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.task_payload(service.toggle_task(db, current_user, task_id))
    except HouseholdError as error:
        raise _refuse(error)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        service.remove(db, current_user, "task", task_id)
    except HouseholdError as error:
        raise _refuse(error)


# ---------------------------------------------------------------------------
# The shopping list
# ---------------------------------------------------------------------------

@router.post("/needs", status_code=201)
def create_need(
    body: NeedBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        need = service.add_need(db, current_user, body.title, body.estimated_price, body.assignee)
    except HouseholdError as error:
        raise _refuse(error)
    return service.need_payload(need)


@router.post("/needs/import-wishlist")
def import_wishlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Put the reader's own wishlist on the household's list."""
    try:
        added = service.import_wishlist(db, current_user)
    except HouseholdError as error:
        raise _refuse(error)
    return {"added": [service.need_payload(need) for need in added]}


@router.post("/needs/{need_id}/purchase")
def purchase_need(
    need_id: int,
    body: PurchaseBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    The thing was bought: write the expense down and tick it off.

    The expense is written by the same code that writes every other
    transaction, so the balance moves the same way and the same rules
    are applied. It is the buyer's own transaction, on the buyer's
    own account.

    Asking twice writes it once. The second answer is the first one.
    """
    from app.api.routes.transactions import create_transaction
    from app.models.category import Category
    from app.models.transaction import Transaction
    from app.schemas.transaction import TransactionCreate

    try:
        household = service.get_or_create(db, current_user)
        need = service._owned(db, HouseholdNeed, household.id, need_id)
    except HouseholdError as error:
        raise _refuse(error)

    if need.purchased:
        # Already bought, by this reader or by somebody else in the
        # household. It is not bought again.
        return {"need": service.need_payload(need), "transaction_id": need.transaction_id, "created": False}

    amount = body.amount if body.amount is not None else float(need.estimated_price or 0)
    if amount <= 0:
        # A need with no estimate and no price given. There is no
        # number to write down, and zero would be a lie.
        raise HTTPException(status_code=400, detail="amount_required")

    category_id = body.category_id
    if category_id is None:
        # Shopping, when the reader did not say. Their own category
        # first, and the shared one otherwise.
        shopping = (
            db.query(Category)
            .filter(
                Category.system_key == "shopping",
                Category.type == "expense",
                (Category.user_id == current_user.id) | (Category.user_id.is_(None)),
            )
            .order_by(Category.user_id.is_(None).asc())
            .first()
        )
        category_id = shopping.id if shopping else None

    request_id = f"household-need-{need.id}"
    before = (
        db.query(Transaction.id)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.client_request_id == request_id,
        )
        .first()
    )

    transaction = create_transaction(
        TransactionCreate(
            type="expense",
            amount=amount,
            date=body.date or _date.today(),
            description=need.title,
            notes=f"{household.name}",
            account_id=body.account_id,
            category_id=category_id,
            client_request_id=request_id,
            # The reader said what this is. There is nothing to work out.
            expand_breakdown=False,
        ),
        current_user=current_user,
        db=db,
    )

    need = service._owned(db, HouseholdNeed, household.id, need_id)
    need.purchased = True
    need.purchased_at = datetime.utcnow()
    need.transaction_id = transaction.id
    service.log(db, household.id, service.display_name(current_user), "need_bought", need.title)
    db.commit()
    db.refresh(need)

    return {
        "need": service.need_payload(need),
        "transaction_id": transaction.id,
        "created": before is None,
    }


@router.delete("/needs/{need_id}", status_code=204)
def delete_need(
    need_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        service.remove(db, current_user, "need", need_id)
    except HouseholdError as error:
        raise _refuse(error)


# ---------------------------------------------------------------------------
# The notes
# ---------------------------------------------------------------------------

@router.post("/notes", status_code=201)
def create_note(
    body: NoteBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        note = service.add_note(db, current_user, body.body, body.color)
    except HouseholdError as error:
        raise _refuse(error)
    return service.note_payload(note)


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        service.remove(db, current_user, "note", note_id)
    except HouseholdError as error:
        raise _refuse(error)


# ---------------------------------------------------------------------------
# The shared targets
# ---------------------------------------------------------------------------

@router.post("/goals/share")
def share_goal(
    body: ShareGoalBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Show one of the reader's own targets to the household."""
    try:
        service.share_goal(db, current_user, body.goal_id)
        household = service.get_or_create(db, current_user)
    except HouseholdError as error:
        raise _refuse(error)
    return {"goals": service.shared_goals(db, household.id, current_user.id)}


@router.delete("/goals/{goal_id}/share")
def unshare_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Take a shared target back off the household's list."""
    try:
        service.unshare_goal(db, current_user, goal_id)
        household = service.get_or_create(db, current_user)
    except HouseholdError as error:
        raise _refuse(error)
    return {"goals": service.shared_goals(db, household.id, current_user.id)}
