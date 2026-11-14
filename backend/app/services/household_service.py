"""
The household: who is in it, and what they share.

A household shares what people agree on out loud - the calendar, the
chores, the shopping list, the notes. It does not share anybody's
accounts or transactions. The numbers on the page (how the month is
going, what needs attention) are always the numbers of the person
looking at it, worked out from their own records.

The one thing that crosses over is a target that somebody chose to
share: its name and how far along it is are shown to the others.
"""

import os
import secrets
import string
import weakref
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.models.household import (
    HOUSEHOLD_MODELS,
    HOUSEHOLD_MODES,
    Household,
    HouseholdActivity,
    HouseholdAgenda,
    HouseholdGoalLink,
    HouseholdMember,
    HouseholdNeed,
    HouseholdNote,
    HouseholdTask,
)
from app.services import metrics

# The name a household starts with, for each way of using it.
DEFAULT_NAMES = {
    "family": "Keuangan Keluarga & Partner",
    "business": "Keuangan Rekan Bisnis",
}

INVITE_ALPHABET = string.ascii_uppercase + string.digits
INVITE_LENGTH = 8

# The application's own drawn faces.
# The four plain faces, and the six of the Petit Chibi Guild.
#
# This is the whitelist: an avatar the server does not recognise is
# answered with the default, so a member who picks one of the guild
# and is not listed here would be quietly handed the green circle
# back and never know why.
PLAIN_AVATARS = ("avatar-default", "avatar-sun", "avatar-sky", "avatar-rose")

PETIT_AVATARS = (
    "avatar-petit-mone",
    "avatar-petit-kaneru",
    "avatar-petit-kogane",
    "avatar-petit-zenimaru",
    "avatar-petit-minori",
    "avatar-petit-koneko",
)

AVATARS = PLAIN_AVATARS + PETIT_AVATARS

NOTE_COLORS = ("lemon", "mint", "sky", "rose", "lilac", "peach")

# Somebody who was here in the last five minutes is "online".
ONLINE_WINDOW = timedelta(minutes=5)

# How far ahead a bill counts as "coming up".
UPCOMING_BILL_DAYS = 7

ACTIVITY_LIMIT = 30


class HouseholdError(Exception):
    """Something the reader asked for cannot be done, and why."""

    def __init__(self, status_code: int, code: str):
        super().__init__(code)
        self.status_code = status_code
        self.code = code


# ---------------------------------------------------------------------------
# The tables
# ---------------------------------------------------------------------------

# The engines whose tables have been looked at. It holds them weakly,
# so an engine that is thrown away is forgotten with it.
_engines_checked: "weakref.WeakSet" = weakref.WeakSet()


def ensure_tables(db: Session) -> None:
    """
    Make the household's tables if they are not there.

    The migration makes them, and so does the server's startup. This
    is the third place, and it is here because the startup does its
    work on a thread: a request that arrives in the first moments of
    a new server must not be answered with "no such table".

    It looks once per database engine and then remembers.
    """
    # A session can be bound to an engine or to one connection of it.
    # Both know their engine.
    engine = db.get_bind().engine
    if engine in _engines_checked:
        return
    for model in HOUSEHOLD_MODELS:
        model.__table__.create(bind=engine, checkfirst=True)
    _engines_checked.add(engine)


# ---------------------------------------------------------------------------
# The household and its members
# ---------------------------------------------------------------------------

def app_url() -> str:
    """Where the application is served from, for the links in an invitation."""
    return os.environ.get("PUBLIC_APP_URL", "https://my-financial-manager.online").rstrip("/")


def new_invite_code(db: Session) -> str:
    """Eight capital letters and digits that no other household has."""
    for _ in range(20):
        code = "".join(secrets.choice(INVITE_ALPHABET) for _ in range(INVITE_LENGTH))
        taken = db.query(Household.id).filter(Household.invite_code == code).first()
        if not taken:
            return code
    raise HouseholdError(500, "invite_code_unavailable")


def display_name(user: Any) -> str:
    """What to call somebody on the members list."""
    name = (getattr(user, "full_name", None) or "").strip()
    if name:
        return name
    username = (getattr(user, "username", None) or "").strip()
    if username:
        return username
    email = getattr(user, "email", "") or ""
    return email.split("@")[0] or "Anggota"


def avatar_of(user: Any) -> str:
    """
    The drawn face the reader chose, or the default one.

    The guild names are tested before the plain ones. They are longer
    and more specific, and a substring test that ran the other way
    could answer a longer id with a shorter one that happens to sit
    inside it.
    """
    value = (getattr(user, "avatar_url", None) or "").lower()
    for avatar in PETIT_AVATARS + PLAIN_AVATARS:
        if avatar in value:
            return avatar
    return PLAIN_AVATARS[0]


def membership_of(db: Session, user_id: int) -> Optional[HouseholdMember]:
    """
    The household the reader is in now.

    Somebody who joined another household still has the one they
    started with; nothing is thrown away. The one they are in is the
    one they joined last.
    """
    return (
        db.query(HouseholdMember)
        .filter(
            HouseholdMember.user_id == user_id,
            HouseholdMember.status == "active",
        )
        .order_by(HouseholdMember.joined_at.desc(), HouseholdMember.id.desc())
        .first()
    )


def get_or_create(db: Session, user: Any) -> Household:
    """The reader's household, made on the first visit."""
    ensure_tables(db)

    member = membership_of(db, user.id)
    if member is not None:
        household = db.query(Household).filter(Household.id == member.household_id).first()
        if household is not None:
            return household

    household = Household(
        owner_id=user.id,
        name=DEFAULT_NAMES["family"],
        mode="family",
        invite_code=new_invite_code(db),
    )
    db.add(household)
    db.flush()
    db.add(
        HouseholdMember(
            household_id=household.id,
            user_id=user.id,
            name=display_name(user),
            email=getattr(user, "email", None),
            role="host",
            avatar=avatar_of(user),
            status="active",
            last_active_at=datetime.utcnow(),
        )
    )
    log(db, household.id, display_name(user), "household_created", household.name)
    db.commit()
    db.refresh(household)
    return household


def member_of(db: Session, household_id: int, user_id: int) -> Optional[HouseholdMember]:
    return (
        db.query(HouseholdMember)
        .filter(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == user_id,
        )
        .first()
    )


def can_manage(member: Optional[HouseholdMember]) -> bool:
    """Whether somebody may rename the household or change what it is for."""
    return member is not None and member.role in ("host", "partner")


def log(db: Session, household_id: int, actor: str, action: str, detail: str = "") -> None:
    """Write down that something happened. The caller commits."""
    db.add(
        HouseholdActivity(
            household_id=household_id,
            actor=(actor or "")[:100],
            action=action,
            detail=(detail or "")[:255],
        )
    )


def touch(db: Session, household: Household, user: Any) -> None:
    """Note that the reader is here now, and keep their name and face current."""
    member = member_of(db, household.id, user.id)
    if member is None:
        return
    member.last_active_at = datetime.utcnow()
    member.name = display_name(user)
    member.avatar = avatar_of(user)
    db.commit()


def switch_mode(
    db: Session,
    user: Any,
    mode: Optional[str] = None,
    name: Optional[str] = None,
) -> Household:
    """Change what the household is for, or what it is called."""
    household = get_or_create(db, user)
    member = member_of(db, household.id, user.id)
    if not can_manage(member):
        raise HouseholdError(403, "not_allowed")

    actor = display_name(user)
    if mode is not None:
        if mode not in HOUSEHOLD_MODES:
            raise HouseholdError(400, "unknown_mode")
        if mode != household.mode:
            # A household that still carries the name it was given is
            # renamed with the mode. One the reader named keeps its name.
            if household.name == DEFAULT_NAMES.get(household.mode) and not name:
                household.name = DEFAULT_NAMES[mode]
            household.mode = mode
            log(db, household.id, actor, "mode_changed", mode)

    if name is not None:
        cleaned = name.strip()
        if not cleaned:
            raise HouseholdError(400, "name_required")
        if cleaned != household.name:
            household.name = cleaned[:120]
            log(db, household.id, actor, "renamed", household.name)

    db.commit()
    db.refresh(household)
    return household


def join(db: Session, user: Any, invite_code: str) -> Household:
    """Join the household that the code belongs to."""
    ensure_tables(db)

    code = (invite_code or "").strip().upper()
    if len(code) != INVITE_LENGTH or any(ch not in INVITE_ALPHABET for ch in code):
        raise HouseholdError(400, "invalid_code")

    household = db.query(Household).filter(Household.invite_code == code).first()
    if household is None:
        raise HouseholdError(404, "code_not_found")

    now = datetime.utcnow()
    existing = member_of(db, household.id, user.id)
    if existing is not None:
        # Already in it. Coming back makes it the current one again.
        existing.status = "active"
        existing.joined_at = now
        existing.last_active_at = now
        db.commit()
        return household

    # Somebody invited by email is already on the list, waiting. The
    # place that was kept for them is the one they take.
    email = (getattr(user, "email", None) or "").strip().lower()
    placeholder = None
    if email:
        placeholder = (
            db.query(HouseholdMember)
            .filter(
                HouseholdMember.household_id == household.id,
                HouseholdMember.user_id.is_(None),
                HouseholdMember.email == email,
            )
            .first()
        )

    role = "partner" if household.mode == "business" else "member"
    if placeholder is not None:
        placeholder.user_id = user.id
        placeholder.name = display_name(user)
        placeholder.avatar = avatar_of(user)
        placeholder.status = "active"
        placeholder.joined_at = now
        placeholder.last_active_at = now
    else:
        db.add(
            HouseholdMember(
                household_id=household.id,
                user_id=user.id,
                name=display_name(user),
                email=email or None,
                role=role,
                avatar=avatar_of(user),
                status="active",
                joined_at=now,
                last_active_at=now,
            )
        )

    log(db, household.id, display_name(user), "member_joined", display_name(user))
    db.commit()
    return household


def invite(
    db: Session,
    user: Any,
    name: str,
    email: Optional[str] = None,
    role: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Put somebody on the list and make the links to send them.

    Nothing is sent from here. The reader gets a link and a WhatsApp
    link with the message already written, and sends it themselves.
    """
    household = get_or_create(db, user)

    cleaned = (name or "").strip()
    if not cleaned:
        raise HouseholdError(400, "name_required")
    address = (email or "").strip().lower() or None
    if address and ("@" not in address or " " in address):
        raise HouseholdError(400, "invalid_email")

    if role not in ("partner", "member"):
        role = "partner" if household.mode == "business" else "member"

    member = None
    if address:
        member = (
            db.query(HouseholdMember)
            .filter(
                HouseholdMember.household_id == household.id,
                HouseholdMember.email == address,
            )
            .first()
        )
    if member is None:
        count = (
            db.query(HouseholdMember)
            .filter(HouseholdMember.household_id == household.id)
            .count()
        )
        member = HouseholdMember(
            household_id=household.id,
            user_id=None,
            name=cleaned[:100],
            email=address,
            role=role,
            # A different face from the one before, so the list is not
            # a row of the same picture.
            avatar=AVATARS[count % len(AVATARS)],
            status="invited",
        )
        db.add(member)
        log(db, household.id, display_name(user), "member_invited", cleaned)
        db.commit()
        db.refresh(member)

    link = f"{app_url()}/household?join={household.invite_code}"
    message = (
        f"Halo {cleaned}! Yuk gabung ke \"{household.name}\" di Financial Manager. "
        f"Buka {link} atau masukkan kode undangan {household.invite_code}."
    )
    return {
        "member": member_payload(member),
        "invite_code": household.invite_code,
        "invite_link": link,
        "whatsapp_link": f"https://wa.me/?text={quote(message)}",
        "message": message,
    }


# ---------------------------------------------------------------------------
# What the page is given
# ---------------------------------------------------------------------------

def member_payload(member: HouseholdMember, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or datetime.utcnow()
    seen = member.last_active_at
    online = bool(
        member.status == "active" and seen is not None and now - seen <= ONLINE_WINDOW
    )
    return {
        "id": member.id,
        "name": member.name,
        "role": member.role,
        "avatar": member.avatar,
        "status": member.status,
        "online": online,
        "joined_at": member.joined_at.isoformat() if member.joined_at else None,
        "last_active_at": seen.isoformat() if seen else None,
    }


def agenda_payload(agenda: HouseholdAgenda) -> Dict[str, Any]:
    return {
        "id": agenda.id,
        "title": agenda.title,
        "date": agenda.date.isoformat() if agenda.date else None,
        "time": agenda.time,
        "location": agenda.location,
        "kind": agenda.kind,
        "status": agenda.status,
        "created_by": agenda.created_by,
    }


def task_payload(task: HouseholdTask) -> Dict[str, Any]:
    return {
        "id": task.id,
        "title": task.title,
        "assignee": task.assignee,
        "completed": bool(task.completed),
        "reward_points": int(task.reward_points or 0),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


def need_payload(need: HouseholdNeed) -> Dict[str, Any]:
    return {
        "id": need.id,
        "title": need.title,
        "estimated_price": float(need.estimated_price or 0),
        "assignee": need.assignee,
        "purchased": bool(need.purchased),
        "transaction_id": need.transaction_id,
        "wishlist_item_id": need.wishlist_item_id,
        "purchased_at": need.purchased_at.isoformat() if need.purchased_at else None,
    }


def note_payload(note: HouseholdNote) -> Dict[str, Any]:
    return {
        "id": note.id,
        "author": note.author,
        "body": note.body,
        "color": note.color,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


def activity_payload(activity: HouseholdActivity) -> Dict[str, Any]:
    return {
        "id": activity.id,
        "actor": activity.actor,
        "action": activity.action,
        "detail": activity.detail,
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
    }


def shared_goals(db: Session, household_id: int, user_id: int) -> List[Dict[str, Any]]:
    """
    The targets somebody chose to share with the household.

    Only the name, the two amounts and the date are shown. The goal
    stays its owner's: they are the one who can put money into it.
    """
    from app.models.goal import Goal

    rows = (
        db.query(Goal, HouseholdGoalLink)
        .join(HouseholdGoalLink, HouseholdGoalLink.goal_id == Goal.id)
        .filter(
            HouseholdGoalLink.household_id == household_id,
            Goal.is_active.is_(True),
        )
        .order_by(HouseholdGoalLink.id.asc())
        .all()
    )
    goals = []
    for goal, link in rows:
        target = float(goal.target_amount or 0)
        current = float(goal.current_amount or 0)
        percent = (current / target * 100) if target > 0 else 0.0
        goals.append(
            {
                "id": goal.id,
                "name": goal.name,
                "target_amount": target,
                "current_amount": current,
                "currency": goal.currency or "IDR",
                "progress_percent": round(max(0.0, min(100.0, percent)), 2),
                "target_date": goal.target_date.isoformat() if goal.target_date else None,
                "is_completed": bool(goal.is_completed),
                "icon": goal.icon,
                "shared_by": link.shared_by,
                "mine": goal.user_id == user_id,
            }
        )
    return goals


def attention_items(db: Session, user_id: int, today: Optional[date] = None) -> List[Dict[str, Any]]:
    """
    What the reader should look at, from their own records.

    Three kinds: a bill that is due within the week, a budget this
    month's spending has gone past, and money laid out for a shared
    bill that has not come back. Each one says where to go to deal
    with it.

    A part that cannot be worked out is left out, and the others are
    still shown.
    """
    import logging

    logger = logging.getLogger(__name__)
    today = today or date.today()
    items: List[Dict[str, Any]] = []

    try:
        from app.models.recurring import RecurringRule

        horizon = today + timedelta(days=UPCOMING_BILL_DAYS)
        bills = (
            db.query(RecurringRule)
            .filter(
                RecurringRule.user_id == user_id,
                RecurringRule.is_active.is_(True),
                RecurringRule.type == "expense",
                RecurringRule.next_occurrence.isnot(None),
                RecurringRule.next_occurrence <= horizon,
            )
            .order_by(RecurringRule.next_occurrence.asc())
            .limit(5)
            .all()
        )
        for bill in bills:
            items.append(
                {
                    "kind": "upcoming_bill",
                    "severity": "warning" if bill.next_occurrence <= today else "info",
                    "title": bill.description or "Tagihan",
                    "amount": float(bill.amount or 0),
                    "date": bill.next_occurrence.isoformat(),
                    "days_left": (bill.next_occurrence - today).days,
                    "href": "/recurring",
                }
            )
    except Exception as exc:  # pragma: no cover - one part must not hide the rest
        logger.warning("household attention: the bills could not be read: %s", exc)
        db.rollback()

    try:
        for row in metrics.over_budget_categories(db, user_id, today)[:5]:
            items.append(
                {
                    "kind": "over_budget",
                    "severity": "danger",
                    "title": row["name"],
                    "amount": row["over_by"],
                    "spent": row["spent"],
                    "limit": row["limit"],
                    "href": "/budgets",
                }
            )
    except Exception as exc:  # pragma: no cover
        logger.warning("household attention: the budgets could not be read: %s", exc)
        db.rollback()

    try:
        from app.services.split_receivable_service import outstanding_receivables

        for row in outstanding_receivables(db, user_id, today)[:5]:
            items.append(
                {
                    "kind": "unsettled_split",
                    "severity": "info",
                    "title": row.get("name") or "Patungan",
                    "amount": float(row.get("amount") or 0),
                    "days_outstanding": int(row.get("days_outstanding") or 0),
                    "href": "/split",
                }
            )
    except Exception as exc:  # pragma: no cover
        logger.warning("household attention: the shared bills could not be read: %s", exc)
        db.rollback()

    return items


def pacing_payload(db: Session, user_id: int, today: Optional[date] = None) -> Dict[str, Any]:
    """How the reader's month is going, under the names the page uses."""
    pacing = metrics.budget_pacing(db, user_id, today)
    return {
        "kebutuhan": pacing["needs"],
        "keinginan": pacing["wants"],
        "tabungan": pacing["savings"],
        "current_day": pacing["current_day"],
        "days_in_month": pacing["days_in_month"],
        "month": pacing["month"],
        "year": pacing["year"],
    }


def overview(db: Session, user: Any, today: Optional[date] = None) -> Dict[str, Any]:
    """Everything the household page shows."""
    household = get_or_create(db, user)
    touch(db, household, user)

    now = datetime.utcnow()
    me = member_of(db, household.id, user.id)

    members = (
        db.query(HouseholdMember)
        .filter(HouseholdMember.household_id == household.id)
        .order_by(HouseholdMember.id.asc())
        .all()
    )
    agendas = (
        db.query(HouseholdAgenda)
        .filter(HouseholdAgenda.household_id == household.id)
        .order_by(HouseholdAgenda.date.asc(), HouseholdAgenda.id.asc())
        .all()
    )
    tasks = (
        db.query(HouseholdTask)
        .filter(HouseholdTask.household_id == household.id)
        .order_by(HouseholdTask.completed.asc(), HouseholdTask.id.desc())
        .all()
    )
    needs = (
        db.query(HouseholdNeed)
        .filter(HouseholdNeed.household_id == household.id)
        .order_by(HouseholdNeed.purchased.asc(), HouseholdNeed.id.desc())
        .all()
    )
    notes = (
        db.query(HouseholdNote)
        .filter(HouseholdNote.household_id == household.id)
        .order_by(HouseholdNote.id.desc())
        .all()
    )
    activity = (
        db.query(HouseholdActivity)
        .filter(HouseholdActivity.household_id == household.id)
        .order_by(HouseholdActivity.id.desc())
        .limit(ACTIVITY_LIMIT)
        .all()
    )

    return {
        "id": household.id,
        "name": household.name,
        "mode": household.mode,
        "invite_code": household.invite_code,
        "invite_link": f"{app_url()}/household?join={household.invite_code}",
        "created_at": household.created_at.isoformat() if household.created_at else None,
        "can_manage": can_manage(me),
        "me": member_payload(me, now) if me else None,
        "members": [member_payload(member, now) for member in members],
        "budget_pacing": pacing_payload(db, user.id, today),
        "attention_items": attention_items(db, user.id, today),
        "agendas": [agenda_payload(agenda) for agenda in agendas],
        "tasks": [task_payload(task) for task in tasks],
        "needs": [need_payload(need) for need in needs],
        "goals": shared_goals(db, household.id, user.id),
        "notes": [note_payload(note) for note in notes],
        "activity": [activity_payload(row) for row in activity],
        "reward_points": sum(int(t.reward_points or 0) for t in tasks if t.completed),
    }


# ---------------------------------------------------------------------------
# The things in it
# ---------------------------------------------------------------------------

def _owned(db: Session, model: Any, household_id: int, row_id: int) -> Any:
    """A row of this household, or a 404. Another household's row is not found."""
    row = (
        db.query(model)
        .filter(model.id == row_id, model.household_id == household_id)
        .first()
    )
    if row is None:
        raise HouseholdError(404, "not_found")
    return row


def add_agenda(
    db: Session,
    user: Any,
    title: str,
    on: date,
    time: Optional[str] = None,
    location: Optional[str] = None,
    kind: str = "meeting",
) -> HouseholdAgenda:
    household = get_or_create(db, user)
    cleaned = (title or "").strip()
    if not cleaned:
        raise HouseholdError(400, "title_required")
    agenda = HouseholdAgenda(
        household_id=household.id,
        title=cleaned[:200],
        date=on,
        time=(time or "").strip()[:20] or None,
        location=(location or "").strip()[:200] or None,
        kind=kind if kind in ("meeting", "bill") else "meeting",
        status="upcoming",
        created_by=display_name(user),
    )
    db.add(agenda)
    log(db, household.id, display_name(user), "agenda_added", cleaned)
    db.commit()
    db.refresh(agenda)
    return agenda


def toggle_agenda(db: Session, user: Any, agenda_id: int) -> HouseholdAgenda:
    household = get_or_create(db, user)
    agenda = _owned(db, HouseholdAgenda, household.id, agenda_id)
    agenda.status = "upcoming" if agenda.status == "done" else "done"
    if agenda.status == "done":
        log(db, household.id, display_name(user), "agenda_done", agenda.title)
    db.commit()
    db.refresh(agenda)
    return agenda


def add_task(
    db: Session,
    user: Any,
    title: str,
    assignee: Optional[str] = None,
    reward_points: int = 10,
) -> HouseholdTask:
    household = get_or_create(db, user)
    cleaned = (title or "").strip()
    if not cleaned:
        raise HouseholdError(400, "title_required")
    task = HouseholdTask(
        household_id=household.id,
        title=cleaned[:200],
        assignee=(assignee or "").strip()[:100] or None,
        completed=False,
        reward_points=max(0, min(1000, int(reward_points or 0))),
    )
    db.add(task)
    log(db, household.id, display_name(user), "task_added", cleaned)
    db.commit()
    db.refresh(task)
    return task


def toggle_task(db: Session, user: Any, task_id: int) -> HouseholdTask:
    household = get_or_create(db, user)
    task = _owned(db, HouseholdTask, household.id, task_id)
    task.completed = not task.completed
    task.completed_at = datetime.utcnow() if task.completed else None
    if task.completed:
        log(db, household.id, display_name(user), "task_done", task.title)
    db.commit()
    db.refresh(task)
    return task


def add_need(
    db: Session,
    user: Any,
    title: str,
    estimated_price: float = 0,
    assignee: Optional[str] = None,
) -> HouseholdNeed:
    household = get_or_create(db, user)
    cleaned = (title or "").strip()
    if not cleaned:
        raise HouseholdError(400, "title_required")
    price = float(estimated_price or 0)
    if price < 0:
        raise HouseholdError(400, "invalid_price")
    need = HouseholdNeed(
        household_id=household.id,
        title=cleaned[:200],
        estimated_price=price,
        assignee=(assignee or "").strip()[:100] or None,
        purchased=False,
    )
    db.add(need)
    log(db, household.id, display_name(user), "need_added", cleaned)
    db.commit()
    db.refresh(need)
    return need


def import_wishlist(db: Session, user: Any) -> List[HouseholdNeed]:
    """
    Put the reader's own wishlist on the household's shopping list.

    It happens when the reader asks for it and not before: a wishlist
    is private until somebody decides to share it. An item that is
    already on the list is not added twice.
    """
    from app.models.shopping_item import WishlistItem

    household = get_or_create(db, user)
    already = {
        row[0]
        for row in db.query(HouseholdNeed.wishlist_item_id)
        .filter(
            HouseholdNeed.household_id == household.id,
            HouseholdNeed.wishlist_item_id.isnot(None),
        )
        .all()
    }
    wishes = (
        db.query(WishlistItem)
        .filter(WishlistItem.user_id == user.id)
        .order_by(WishlistItem.id.asc())
        .all()
    )
    added = []
    for wish in wishes:
        if wish.id in already:
            continue
        need = HouseholdNeed(
            household_id=household.id,
            title=(wish.name or "")[:200],
            estimated_price=float(wish.target_price or 0),
            assignee=display_name(user),
            purchased=False,
            wishlist_item_id=wish.id,
        )
        db.add(need)
        added.append(need)
    if added:
        log(db, household.id, display_name(user), "wishlist_imported", str(len(added)))
        db.commit()
        for need in added:
            db.refresh(need)
    return added


def wishlist_waiting(db: Session, user: Any, household_id: int) -> int:
    """
    How many of the reader's wishlist items are not on the list yet.

    The wishlist is another feature's table. If it cannot be read,
    the answer is "none waiting" and the household page still opens.
    """
    import logging

    from app.models.shopping_item import WishlistItem

    try:
        mine = [
            row[0]
            for row in db.query(WishlistItem.id)
            .filter(WishlistItem.user_id == user.id)
            .all()
        ]
        if not mine:
            return 0
        linked = (
            db.query(HouseholdNeed.id)
            .filter(
                HouseholdNeed.household_id == household_id,
                HouseholdNeed.wishlist_item_id.in_(mine),
            )
            .count()
        )
        return max(0, len(mine) - linked)
    except Exception as exc:
        logging.getLogger(__name__).warning(
            "household: the wishlist could not be read: %s", exc
        )
        db.rollback()
        return 0


def add_note(db: Session, user: Any, body: str, color: Optional[str] = None) -> HouseholdNote:
    household = get_or_create(db, user)
    cleaned = (body or "").strip()
    if not cleaned:
        raise HouseholdError(400, "body_required")
    count = db.query(HouseholdNote).filter(HouseholdNote.household_id == household.id).count()
    note = HouseholdNote(
        household_id=household.id,
        author=display_name(user),
        body=cleaned[:2000],
        color=color if color in NOTE_COLORS else NOTE_COLORS[count % len(NOTE_COLORS)],
    )
    db.add(note)
    log(db, household.id, display_name(user), "note_added", cleaned[:80])
    db.commit()
    db.refresh(note)
    return note


def remove(db: Session, user: Any, kind: str, row_id: int) -> None:
    """Take an agenda, a task, a need or a note off the list."""
    models = {
        "agenda": HouseholdAgenda,
        "task": HouseholdTask,
        "need": HouseholdNeed,
        "note": HouseholdNote,
    }
    household = get_or_create(db, user)
    row = _owned(db, models[kind], household.id, row_id)
    label = getattr(row, "title", None) or (getattr(row, "body", "") or "")[:80]
    db.delete(row)
    log(db, household.id, display_name(user), f"{kind}_removed", label)
    db.commit()


def share_goal(db: Session, user: Any, goal_id: int) -> None:
    """Show one of the reader's own targets to the household."""
    from app.models.goal import Goal

    household = get_or_create(db, user)
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user.id).first()
    if goal is None:
        # Somebody else's target is not theirs to share.
        raise HouseholdError(404, "not_found")
    linked = (
        db.query(HouseholdGoalLink)
        .filter(
            HouseholdGoalLink.household_id == household.id,
            HouseholdGoalLink.goal_id == goal.id,
        )
        .first()
    )
    if linked is None:
        db.add(
            HouseholdGoalLink(
                household_id=household.id,
                goal_id=goal.id,
                shared_by=display_name(user),
            )
        )
        log(db, household.id, display_name(user), "goal_shared", goal.name)
        db.commit()


def unshare_goal(db: Session, user: Any, goal_id: int) -> None:
    """Take a target back off the household's shared list.

    This only removes the link - the goal itself, and whatever has
    been saved toward it, stays exactly as it was. Only the member
    who shared it, or the one who owns it, may take it back off.
    """
    from app.models.goal import Goal

    household = get_or_create(db, user)
    link = (
        db.query(HouseholdGoalLink)
        .filter(
            HouseholdGoalLink.household_id == household.id,
            HouseholdGoalLink.goal_id == goal_id,
        )
        .first()
    )
    if link is None:
        raise HouseholdError(404, "not_found")

    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    is_owner = goal is not None and goal.user_id == user.id
    is_sharer = link.shared_by == display_name(user)
    if not (is_owner or is_sharer):
        raise HouseholdError(403, "not_allowed")

    label = goal.name if goal is not None else "Target"
    db.delete(link)
    log(db, household.id, display_name(user), "goal_unshared", label)
    db.commit()

