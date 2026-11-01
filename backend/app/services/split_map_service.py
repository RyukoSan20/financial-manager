"""
Where the group spent its money.

The reader already has a map, on the merchant page, that puts the
shops they spend at on a map. A shared bill often has a place on it
too, and the question "where did we eat out this month" is asked of
a group in the same way it is asked of the reader.

So the group's bills that know where they were are collected here and
put on the same kind of map.

Two things are deliberate:

- a bill that does not know where it was is left off the map. Putting
  it at the wrong place would be worse than leaving it off;
- two bills at the same place are one place with two bills at it.
  Three dinners at the same restaurant are one restaurant.

Nothing here writes anything. It only reads.
"""

from typing import Any, Dict, List

from sqlalchemy.orm import Session

# Two places are the same place when they are this close, in degrees.
#
# A tenth of a degree is about eleven kilometres. Two bills at the
# same restaurant have the same coordinates exactly, so any small
# tolerance will do; this one is loose enough to survive a phone
# giving slightly different readings for the same doorway, and tight
# enough that two different restaurants are not merged into one.
SAME_PLACE_TOLERANCE = 0.001


def _dec(value) -> float:
    if value is None:
        return 0.0
    return float(value)


def group_places(
    db: Session,
    user_id: int,
) -> List[Dict[str, Any]]:
    """
    The places the reader's shared bills were at.

    Only bills that were published are counted: a bill that is still
    being claimed has not happened yet.
    """
    from app.models.split_bill import SplitExpense, SplitGroup

    expenses = (
        db.query(SplitExpense)
        .filter(
            SplitExpense.user_id == user_id,
            SplitExpense.status == "PUBLISHED",
        )
        .all()
    )

    bills = [
        expense
        for expense in expenses
        if expense.latitude is not None and expense.longitude is not None
    ]
    if not bills:
        return []

    groups = {
        group.id: group
        for group in db.query(SplitGroup)
        .filter(SplitGroup.owner_id == user_id)
        .all()
    }

    places: List[Dict[str, Any]] = []
    for expense in bills:
        latitude = _dec(expense.latitude)
        longitude = _dec(expense.longitude)

        found = None
        for place in places:
            if (
                abs(place["latitude"] - latitude) <= SAME_PLACE_TOLERANCE
                and abs(place["longitude"] - longitude) <= SAME_PLACE_TOLERANCE
            ):
                found = place
                break

        group = groups.get(expense.group_id)
        group_name = (group.name if group else "") or ""

        if found is None:
            places.append(
                {
                    "latitude": latitude,
                    "longitude": longitude,
                    "place_name": expense.place_name or expense.merchant_name or "",
                    "amount": _dec(expense.grand_total),
                    "bills": 1,
                    "group_id": expense.group_id,
                    "group_name": group_name,
                }
            )
        else:
            found["amount"] = round(found["amount"] + _dec(expense.grand_total), 2)
            found["bills"] += 1
            if not found["place_name"]:
                found["place_name"] = expense.place_name or expense.merchant_name or ""

    places.sort(key=lambda p: -p["amount"])
    return places
