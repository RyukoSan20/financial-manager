"""
The insights.

Four things the records already say, worked out by the server and
handed to the browser:

- bills that look paid twice,
- subscriptions that were never set up,
- the balance on each day of the coming month,
- what the reader bought last month and has not bought this month.

Nothing here sends anything and nothing here changes anything. The
browser asks, the server works it out, the browser shows it.

Every answer carries a code as well as the numbers, for the same
reason as everywhere else in this application: a sentence written in
one language cannot be put into another, so the screen translates the
code and the code is what travels.

The endpoints need a signed-in reader, because they read their
records. They do not write to them.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.insight_service import (
    find_duplicate_charges,
    find_forgotten_subscriptions,
    project_balance_calendar,
    suggest_monthly_shopping,
)

router = APIRouter(tags=["Insights"])


@router.get("/duplicates")
def get_duplicate_charges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days_back: int = Query(30, ge=7, le=180),
) -> Dict[str, Any]:
    """
    Bills that look like they were paid twice.

    The answer carries the transactions involved, so the reader can
    see which two they are. Nothing is deleted: that is the reader's
    call, not the server's.
    """
    duplicates = find_duplicate_charges(db, current_user.id, days_back=days_back)
    return {
        "duplicates": duplicates,
        "count": len(duplicates),
        "days_back": days_back,
    }


@router.get("/subscriptions")
def get_forgotten_subscriptions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    months: int = Query(3, ge=2, le=6),
) -> Dict[str, Any]:
    """
    Subscriptions that keep taking money and were never set up.

    A subscription the reader already has a rule for is not in this
    answer; those are the ones they know about.
    """
    subscriptions = find_forgotten_subscriptions(db, current_user.id, months=months)
    return {
        "subscriptions": subscriptions,
        "count": len(subscriptions),
        "months": months,
    }


@router.get("/balance-calendar")
async def get_balance_calendar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(30, ge=7, le=90),
) -> Dict[str, Any]:
    """
    The balance on each day of the coming month.

    It starts from the balance the dashboard shows and moves it by
    the bills and income that are already set up. Spending that has
    not happened is not guessed at.
    """
    calendar = await project_balance_calendar(db, current_user.id, days=days)
    return {
        "calendar": calendar,
        "count": len(calendar),
        "days": days,
    }


@router.get("/shopping-suggestion")
def get_shopping_suggestion(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    What the reader bought last month and has not bought this month.

    This is worked out from the records, not from a rule, because what
    a household actually buys is more useful than what a rule says it
    should buy.
    """
    suggestions = suggest_monthly_shopping(db, current_user.id)
    return {
        "suggestions": suggestions,
        "count": len(suggestions),
    }
