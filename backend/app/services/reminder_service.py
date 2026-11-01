"""
What the reader should be reminded about.

A reminder is only worth sending if there is something real to say. A
bill that is due, a budget that has run out, or a day that has passed
with nothing recorded. Otherwise the reminder is noise, and a reader
who is reminded about nothing stops reading them.

The server decides this, rather than the browser, because the server
is where the bills, the budgets and the transactions are. The browser
only asks whether there is something to say, and shows the answer.

Nothing here sends anything. It only works out what the reminder
would say.
"""

from datetime import date, timedelta
from typing import Any, Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.services.transaction_filter import counted_transactions_filter


def _days_until(target: Optional[date], today: date) -> Optional[int]:
    if not target:
        return None
    return (target - today).days


def build_reminder(db: Session, user_id: int, today: Optional[date] = None) -> Dict[str, Any]:
    """
    Work out what to remind the reader about.

    The reasons are looked at in the order a reader would think about
    them: money that is due, a limit that has been passed, and then
    the day itself.

    The result says whether to remind at all, and why.
    """
    today = today or date.today()

    from app.models.budget import Budget
    from app.models.debt import Debt
    from app.models.recurring import RecurringRule
    from app.models.transaction import Transaction

    # 1. A bill that is due.
    #
    # The reader is told a few days before, so that there is time to
    # pay it. The number of days is the reader's own setting.
    days_before = 3
    try:
        from app.models.user_settings import UserSettings

        settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        if settings and settings.reminder_days_before is not None:
            days_before = int(settings.reminder_days_before)
    except Exception:  # noqa: BLE001 - the default is fine if this fails
        days_before = 3

    window = timedelta(days=max(0, days_before))
    soon = db.query(Debt).filter(
        Debt.user_id == user_id,
        Debt.is_active == True,
        Debt.is_paid_off == False,
        Debt.next_payment_date.isnot(None),
        Debt.next_payment_date <= today + window,
        Debt.next_payment_date >= today,
    ).order_by(Debt.next_payment_date.asc()).first()

    if soon is not None:
        days = _days_until(soon.next_payment_date, today)
        return {
            "should_remind": True,
            "code": "payment_due",
            "title": soon.name,
            "message": (
                f"{soon.name} is due in {days} day(s)."
                if days is not None
                else f"{soon.name} is due."
            ),
            "due_date": soon.next_payment_date.isoformat(),
            "days_until": days,
            "amount": float(soon.monthly_payment or 0),
            "currency": soon.currency or "IDR",
            "href": "/debts",
        }

    # 2. A budget that has run out.
    #
    # The budget is measured against the spending of the same period,
    # and against the same category and account, so that a category
    # budget is not judged by the whole month's spending. This is the
    # same calculation the budgets page does, so the reminder and the
    # page cannot disagree.
    budgets = db.query(Budget).filter(
        Budget.user_id == user_id,
        Budget.is_active == True,
    ).all()
    for budget in budgets:
        limit = float(budget.amount or 0)
        if not limit:
            continue

        # A budget whose period has finished is not judged any more.
        if budget.end_date and budget.end_date < today:
            continue

        spent_query = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            *counted_transactions_filter(),
            Transaction.date >= budget.start_date,
        )
        if budget.end_date:
            spent_query = spent_query.filter(Transaction.date <= budget.end_date)
        if budget.category_id:
            spent_query = spent_query.filter(Transaction.category_id == budget.category_id)
        if budget.account_id:
            spent_query = spent_query.filter(Transaction.account_id == budget.account_id)

        spent = float(spent_query.scalar() or 0)
        if spent >= limit:
            return {
                "should_remind": True,
                "code": "budget_exceeded",
                "title": budget.name,
                "message": f"{budget.name} is used up.",
                "amount": limit,
                "spent": spent,
                "currency": budget.currency or "IDR",
                "href": "/budgets",
            }

    # 3. A shared bill that has not been paid back.
    #
    # The money on loan is not spending, so it is not in the chart,
    # and it is not a debt the reader set up, so it is not on the
    # debt page. Without this the only way to find out that somebody
    # has not paid back is to remember.
    #
    # It comes after the bills that are due and the budgets that are
    # used up, because those are about money that has not left yet,
    # and this is about money that has already left.
    try:
        from app.services.insight_service import find_unsettled_group_lending

        lending = find_unsettled_group_lending(
            db, user_id, today=today
        )
    except Exception:  # noqa: BLE001 - a reminder is never worth a crash
        lending = []

    if lending:
        oldest = lending[0]
        return {
            "should_remind": True,
            "code": "group_bill_unpaid",
            "title": oldest.get("group_name") or "A shared bill",
            "message": (
                f"{oldest.get('group_name') or 'A shared bill'} has "
                f"{oldest.get('amount', 0):,.0f} outstanding for "
                f"{oldest.get('days_outstanding', 0)} day(s)."
            ),
            "amount": float(oldest.get("amount") or 0),
            "currency": oldest.get("currency") or "IDR",
            "days_outstanding": oldest.get("days_outstanding", 0),
            "group_id": oldest.get("group_id"),
            "href": f"/split/{oldest.get('group_id')}",
        }

    # 4. A recurring bill that is due today.
    recurring = db.query(RecurringRule).filter(
        RecurringRule.user_id == user_id,
        RecurringRule.is_active == True,
        RecurringRule.next_occurrence.isnot(None),
        RecurringRule.next_occurrence <= today,
    ).order_by(RecurringRule.next_occurrence.asc()).first()

    if recurring is not None:
        # A recurring rule has a description, not a name.
        label = recurring.description or "A recurring bill"
        return {
            "should_remind": True,
            "code": "recurring_due",
            "title": label,
            "message": f"{label} is due.",
            "amount": float(recurring.amount or 0),
            "currency": recurring.currency or "IDR",
            "href": "/recurring",
        }

    # 5. The day itself.
    #
    # A reader who has not recorded anything today is nudged to do so,
    # but only when the day is over, so that it is a note about the
    # past rather than a nag about the present.
    yesterday = today - timedelta(days=1)
    recorded = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == user_id,
        Transaction.date == yesterday,
        Transaction.is_deleted.is_(False),
    ).scalar()

    if not recorded:
        return {
            "should_remind": True,
            "code": "nothing_recorded",
            "title": "Nothing recorded yesterday",
            "message": "Nothing was recorded yesterday. A quick note is enough.",
            "href": "/transactions",
        }

    # There is genuinely nothing to say.
    return {
        "should_remind": False,
        "code": "nothing_to_say",
        "title": None,
        "message": None,
        "href": "/",
    }
