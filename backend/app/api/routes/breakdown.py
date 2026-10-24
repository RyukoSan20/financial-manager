"""
Breakdown API.

The lines inside a financial record, and the preview of what a goal is
made of before it is saved.
"""

import logging
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.schemas.base import EmptyStringAsNone
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.breakdown_service import (
    PARENT_TYPES,
    breakdown_total,
    get_breakdown,
    set_breakdown,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class BreakdownLine(EmptyStringAsNone):
    """One line of a breakdown."""

    name: str = Field(max_length=255)
    quantity: float = 1
    unit_price: float = 0
    total_price: float = 0
    category: Optional[str] = Field(None, max_length=50)
    kind: str = "expense"
    is_discount: bool = False
    notes: Optional[str] = None
    source: str = "user"
    is_estimated: bool = False


class BreakdownRequest(EmptyStringAsNone):
    """The lines for a record."""

    lines: List[BreakdownLine] = Field(default_factory=list)
    replace: bool = True


class BreakdownResponse(BaseModel):
    """The lines for a record, with the sum."""

    parent_type: str
    parent_id: int
    lines: List[Dict[str, Any]] = Field(default_factory=list)
    total: float = 0
    count: int = 0


class GoalPreviewRequest(EmptyStringAsNone):
    """A goal the user is thinking about, before it is saved."""

    name: str = Field(max_length=200, default="")
    description: Optional[str] = None
    target_amount: float = Field(gt=0)
    target_date: Optional[date] = None
    use_model: bool = True


class GoalPreviewResponse(BaseModel):
    """What the goal is made of, before the user commits to it."""

    lines: List[Dict[str, Any]] = Field(default_factory=list)
    total: float = 0
    target_amount: float = 0
    source: str = "template"
    used_model: bool = False
    message: str = ""


def _check_parent(parent_type: str) -> None:
    if parent_type not in PARENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"parent_type harus salah satu dari: {', '.join(PARENT_TYPES)}",
        )


@router.post("/goal/preview", response_model=GoalPreviewResponse)
def preview_goal(
    payload: GoalPreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Work out what a goal is made of, before the user saves it.

    "Target ke Jepang 4 juta" is a wish with one number in it. This
    turns it into the parts that number has to cover: the flight, the
    stay, the food, the documents. The user sees the parts and can
    correct them before the goal exists.
    """
    from app.services.goal_breakdown import expand_goal

    text = " ".join(
        part for part in (payload.name, payload.description) if part
    ) or "target"

    result = expand_goal(
        message=text,
        target_amount=payload.target_amount,
        target_date=payload.target_date,
        use_model=payload.use_model,
    )

    lines = result.get("lines") or []
    total = round(sum(float(line.get("amount", 0)) for line in lines), 2)

    if result.get("used_model"):
        message = (
            "Rinciannya perkiraan. Nominal bisa kamu ubah sebelum disimpan."
        )
    else:
        message = (
            "Rincian awal dari template umum. Nominalnya bisa kamu ubah, "
            "dan AI bisa membantu kalau model sedang tidak tersedia."
        )

    return GoalPreviewResponse(
        lines=lines,
        total=total,
        target_amount=payload.target_amount,
        source=result.get("source", "template"),
        used_model=bool(result.get("used_model")),
        message=message,
    )


@router.get("/{parent_type}/{parent_id}", response_model=BreakdownResponse)
def read_breakdown(
    parent_type: str,
    parent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The lines that make up a record."""
    _check_parent(parent_type)
    lines = get_breakdown(db, current_user.id, parent_type, parent_id)
    return BreakdownResponse(
        parent_type=parent_type,
        parent_id=parent_id,
        lines=lines,
        total=breakdown_total(db, current_user.id, parent_type, parent_id),
        count=len(lines),
    )


@router.put("/{parent_type}/{parent_id}", response_model=BreakdownResponse)
def write_breakdown(
    parent_type: str,
    parent_id: int,
    payload: BreakdownRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace the lines that make up a record."""
    _check_parent(parent_type)

    lines = [line.model_dump() for line in payload.lines]
    set_breakdown(db, current_user.id, parent_type, parent_id, lines, replace=payload.replace)
    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.error(f"Could not save the breakdown: {exc}")
        raise HTTPException(status_code=400, detail=f"Breakdown tidak valid: {exc}")

    saved = get_breakdown(db, current_user.id, parent_type, parent_id)
    return BreakdownResponse(
        parent_type=parent_type,
        parent_id=parent_id,
        lines=saved,
        total=breakdown_total(db, current_user.id, parent_type, parent_id),
        count=len(saved),
    )


@router.post("/{parent_type}/{parent_id}/lines", response_model=BreakdownResponse)
def add_breakdown_line(
    parent_type: str,
    parent_id: int,
    line: BreakdownLine,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add one line without touching the rest."""
    _check_parent(parent_type)
    set_breakdown(
        db,
        current_user.id,
        parent_type,
        parent_id,
        [line.model_dump()],
        replace=False,
    )
    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Baris breakdown tidak valid: {exc}")

    saved = get_breakdown(db, current_user.id, parent_type, parent_id)
    return BreakdownResponse(
        parent_type=parent_type,
        parent_id=parent_id,
        lines=saved,
        total=breakdown_total(db, current_user.id, parent_type, parent_id),
        count=len(saved),
    )


@router.delete("/{parent_type}/{parent_id}/lines/{line_id}", response_model=BreakdownResponse)
def delete_breakdown_line(
    parent_type: str,
    parent_id: int,
    line_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove one line."""
    _check_parent(parent_type)

    from app.models.breakdown_item import BreakdownItem

    item = (
        db.query(BreakdownItem)
        .filter(
            BreakdownItem.id == line_id,
            BreakdownItem.user_id == current_user.id,
            BreakdownItem.parent_type == parent_type,
            BreakdownItem.parent_id == parent_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Baris breakdown tidak ditemukan")

    db.delete(item)
    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Tidak bisa menghapus baris: {exc}")

    saved = get_breakdown(db, current_user.id, parent_type, parent_id)
    return BreakdownResponse(
        parent_type=parent_type,
        parent_id=parent_id,
        lines=saved,
        total=breakdown_total(db, current_user.id, parent_type, parent_id),
        count=len(saved),
    )
