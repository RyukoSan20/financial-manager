"""
One place to attach, read and check a breakdown.

Every kind of financial record can carry a list of lines: a
transaction, a budget, a recurring rule, a goal, a debt. The rules for
how those lines are written are the same everywhere, so they live here
rather than in five routes.
"""

import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.breakdown_item import BreakdownItem

logger = logging.getLogger(__name__)

# The kinds of record that can carry a breakdown.
PARENT_TYPES = ("transaction", "budget", "recurring", "goal", "debt")


def _to_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:  # noqa: BLE001 - a bad number is zero, not a crash
        return Decimal("0")


def set_breakdown(
    db: Session,
    user_id: int,
    parent_type: str,
    parent_id: int,
    lines: List[Dict[str, Any]],
    replace: bool = True,
) -> List[BreakdownItem]:
    """
    Write the lines for a record.

    ``replace`` clears what was there first. That is what the caller
    wants when the breakdown was just recomputed, and what it does not
    want when the user added one line by hand.
    """
    if parent_type not in PARENT_TYPES:
        raise ValueError(f"Unknown parent type: {parent_type}")

    if replace:
        db.query(BreakdownItem).filter(
            BreakdownItem.user_id == user_id,
            BreakdownItem.parent_type == parent_type,
            BreakdownItem.parent_id == parent_id,
        ).delete(synchronize_session=False)

    saved: List[BreakdownItem] = []
    for line in lines or []:
        if not isinstance(line, dict):
            continue
        name = str(line.get("name", "")).strip()
        if not name:
            continue
        quantity = _to_decimal(line.get("quantity", 1)) or Decimal("1")
        unit_price = _to_decimal(line.get("unit_price"))
        total_price = _to_decimal(line.get("total_price"))
        if not total_price and unit_price and quantity:
            total_price = unit_price * quantity
        if not total_price:
            # A line with no price at all is not worth storing.
            continue

        item = BreakdownItem(
            user_id=user_id,
            parent_type=parent_type,
            parent_id=parent_id,
            name=name[:255],
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
            category=(str(line.get("category"))[:50] if line.get("category") else None),
            kind=str(line.get("kind", "expense"))[:20],
            is_discount=bool(line.get("is_discount", False)),
            notes=(str(line.get("note") or line.get("notes") or "")[:1000] or None),
            source=str(line.get("source", "user"))[:20],
            is_estimated=bool(line.get("is_estimated", False)),
        )
        db.add(item)
        saved.append(item)

    return saved


def get_breakdown(
    db: Session,
    user_id: int,
    parent_type: str,
    parent_id: int,
) -> List[Dict[str, Any]]:
    """Read the lines for a record."""
    items = (
        db.query(BreakdownItem)
        .filter(
            BreakdownItem.user_id == user_id,
            BreakdownItem.parent_type == parent_type,
            BreakdownItem.parent_id == parent_id,
        )
        .order_by(BreakdownItem.id)
        .all()
    )
    return [_to_dict(item) for item in items]


def _to_dict(item: BreakdownItem) -> Dict[str, Any]:
    return {
        "id": item.id,
        "name": item.name,
        "quantity": float(item.quantity or 0),
        "unit_price": float(item.unit_price or 0),
        "total_price": float(item.total_price or 0),
        "category": item.category,
        "kind": item.kind,
        "is_discount": item.is_discount,
        "notes": item.notes,
        "source": item.source,
        "is_estimated": item.is_estimated,
    }


def breakdown_total(
    db: Session,
    user_id: int,
    parent_type: str,
    parent_id: int,
) -> float:
    """The sum of the lines, discounts subtracted."""
    items = (
        db.query(BreakdownItem)
        .filter(
            BreakdownItem.user_id == user_id,
            BreakdownItem.parent_type == parent_type,
            BreakdownItem.parent_id == parent_id,
        )
        .all()
    )
    total = Decimal("0")
    for item in items:
        amount = _to_decimal(item.total_price)
        if item.is_discount:
            total -= amount
        else:
            total += amount
    return float(total)


def breakdown_from_amounts(
    lines: List[Dict[str, Any]],
    target: float,
) -> List[Dict[str, Any]]:
    """
    Turn a list of named amounts into lines that add up to a target.

    Used when a caller has a set of parts and wants the sum to match a
    number that was already decided.
    """
    from app.services.goal_breakdown import _scale_to_target

    return _scale_to_target(lines, float(target))
