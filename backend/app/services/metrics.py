"""
The numbers, defined once.

`docs/metrics.md` says what each of these means and where each one is
used. This module is the implementation of that document.

The point of having it in one place is that two pages showing the
same fact must show the same number. Before this, the total balance
was added up in five different files, and three of them added rupiah
to yen without converting. The tests in `backend/tests/` check that
the same fixtures produce the same answer everywhere.

Nothing here changes the shape of an API response. The callers keep
returning the keys they always returned; they just get their value
from here.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.debt import Debt
from app.models.transaction import Transaction
from app.models.user import User
from app.services.currency_totals import total_in_currency
from app.services.transaction_filter import counted_transactions_filter

# The four parts of the health score, each worth the same.
HEALTH_PART_MAX = 25


@dataclass
class SavingsRate:
    """The savings rate, and whether it can be measured at all."""
    rate: float = 0.0
    measurable: bool = False
    income: float = 0.0
    expense: float = 0.0

    def as_dict(self) -> dict:
        return {
            "rate": round(self.rate, 4),
            "measurable": self.measurable,
            "income": round(self.income, 2),
            "expense": round(self.expense, 2),
        }


@dataclass
class HealthScore:
    """
    The health score, and the parts behind it.

    `measured_parts` names the parts that could be measured. A part
    that could not be measured is left out of both the sum and the
    maximum, so it neither adds to the score nor holds it down.
    """
    overall_score: int = 0
    parts: Dict[str, int] = field(default_factory=dict)
    measurable: Dict[str, bool] = field(default_factory=dict)
    measured_parts: List[str] = field(default_factory=list)
    measured_max: int = 0
    has_enough_data: bool = False
    rating: str = "poor"

    def as_dict(self) -> dict:
        return {
            "overall_score": self.overall_score,
            "parts": self.parts,
            "measurable": self.measurable,
            "measured_parts": list(self.measured_parts),
            "measured_max": self.measured_max,
            "has_enough_data": self.has_enough_data,
            "rating": self.rating,
        }


def saved_display_currency(db: Session, user_id: int) -> str:
    """
    The currency the reader is seeing their money in.

    A choice of its own, saved in their settings. It is not the
    interface language: reading the app in Japanese does not change
    the currency, and changing the currency does not change the
    language.
    """
    from app.models.user_settings import UserSettings

    if user_id is None:
        return "IDR"
    settings = (
        db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    )
    chosen = getattr(settings, "currency", None) if settings else None
    if not chosen:
        user = db.query(User).filter(User.id == user_id).first()
        chosen = getattr(user, "default_currency", None) if user else None
    return (chosen or "IDR").upper()


async def total_balance(
    db: Session,
    user_id: int,
    display_currency: Optional[str] = None,
) -> dict:
    """
    The sum of the active account balances, in the display currency.

    Accounts do not all hold the same currency, so they are converted
    before they are added. A balance that cannot be converted is left
    out and listed separately, so the total is never a mixture.
    """
    if display_currency is None:
        display_currency = saved_display_currency(db, user_id)
    target = (display_currency or "IDR").upper()
    accounts = (
        db.query(Account)
        .filter(Account.user_id == user_id, Account.is_active == True)
        .all()
    )
    result = await total_in_currency(
        [(float(a.balance or 0), (a.currency or "IDR").upper()) for a in accounts],
        target=target,
    )
    return {
        "total": result.total,
        "currency": target,
        "by_currency": result.by_currency,
        "unconverted": result.unconverted,
    }


def period_totals(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
) -> Tuple[float, float]:
    """
    The income and the expense over a date range.

    Only approved transactions count. A pending one must not move a
    balance, so it must not move a report either.
    """
    def _sum(kind: str) -> float:
        total = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.type == kind,
                Transaction.user_id == user_id,
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                *counted_transactions_filter(),
            )
            .scalar()
        )
        return float(total or 0)

    return _sum("income"), _sum("expense")


def savings_rate(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
) -> SavingsRate:
    """
    The savings rate over a date range.

    With no income in the range there is no rate to speak of, so the
    figure is reported as not measurable rather than as zero.
    """
    income, expense = period_totals(db, user_id, start_date, end_date)
    if income <= 0:
        return SavingsRate(rate=0.0, measurable=False, income=income, expense=expense)
    return SavingsRate(
        rate=(income - expense) / income,
        measurable=True,
        income=income,
        expense=expense,
    )


def total_debt(db: Session, user_id: int) -> float:
    """The money still owed: active debts that are not paid off."""
    total = (
        db.query(func.coalesce(func.sum(Debt.current_balance), 0))
        .filter(
            Debt.user_id == user_id,
            Debt.is_active == True,
            Debt.is_paid_off == False,
        )
        .scalar()
    )
    return float(total or 0)


def emergency_months(
    cash: float,
    monthly_expense: float,
) -> Optional[float]:
    """
    How many months of normal spending the cash on hand covers.

    With no spending there is no burn rate, so there are no emergency
    months. None is returned rather than a number, because zero months
    of cover is a different statement from "nothing to measure".
    """
    if monthly_expense <= 0:
        return None
    daily = monthly_expense / 30
    if daily <= 0:
        return None
    # The number of days the cash covers, expressed in months.
    return round(cash / daily / 30, 1)


def health_score(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
    balance: float,
    goals: Optional[Sequence] = None,
) -> HealthScore:
    """
    The health score, built from the four parts.

    The caller passes the balance in, because getting it needs a
    currency conversion that is asynchronous, and because the caller
    usually has it already.
    """
    from app.services.calculation.formulas import calculate_goal_on_track

    income, expense = period_totals(db, user_id, start_date, end_date)
    debt = total_debt(db, user_id)

    if goals is None:
        from app.models.goal import Goal

        goals = (
            db.query(Goal)
            .filter(
                Goal.user_id == user_id,
                Goal.is_active == True,
                Goal.is_completed == False,
            )
            .all()
        )

    parts: Dict[str, int] = {}
    measurable: Dict[str, bool] = {}

    # 1. Savings rate. Needs income to be a rate at all.
    if income > 0:
        measurable["savings_rate"] = True
        rate = (income - expense) / income
        if rate >= 0.2:
            parts["savings_rate"] = HEALTH_PART_MAX
        elif rate >= 0.1:
            parts["savings_rate"] = 15
        elif rate >= 0:
            parts["savings_rate"] = 5
        else:
            parts["savings_rate"] = 0
    else:
        measurable["savings_rate"] = False
        parts["savings_rate"] = 0

    # 2. Emergency fund. Needs spending, because without it there is
    #    no target to measure the balance against.
    if expense > 0:
        measurable["emergency_fund"] = True
        if balance >= expense * 6:
            parts["emergency_fund"] = HEALTH_PART_MAX
        elif balance >= expense * 3:
            parts["emergency_fund"] = 15
        elif balance >= expense:
            parts["emergency_fund"] = 5
        else:
            parts["emergency_fund"] = 0
    else:
        measurable["emergency_fund"] = False
        parts["emergency_fund"] = 0

    # 3. Debt level. Needs income, because the ratio is against it.
    if income > 0:
        measurable["debt_level"] = True
        ratio = debt / income
        if ratio == 0:
            parts["debt_level"] = HEALTH_PART_MAX
        elif ratio <= 0.36:
            parts["debt_level"] = 20
        elif ratio <= 0.5:
            parts["debt_level"] = 10
        else:
            parts["debt_level"] = 0
    else:
        measurable["debt_level"] = False
        parts["debt_level"] = 0

    # 4. Goals progress. Needs a goal. No goals is not the same as
    #    being on track with every goal.
    if goals:
        measurable["goals_progress"] = True
        on_track = 0
        for goal in goals:
            result = calculate_goal_on_track(
                goal.current_amount, goal.target_amount, goal.target_date
            )
            if result.get("on_track"):
                on_track += 1
        parts["goals_progress"] = int(on_track / len(goals) * HEALTH_PART_MAX)
    else:
        measurable["goals_progress"] = False
        parts["goals_progress"] = 0

    # The total is over the parts that could be measured. A part with
    # no data is out of both the sum and the maximum.
    measured_parts = [key for key, ok in measurable.items() if ok]
    measured_max = HEALTH_PART_MAX * len(measured_parts)
    total = sum(parts[key] for key in measured_parts)
    overall = int(total / measured_max * 100) if measured_max else 0

    if overall >= 80:
        rating = "excellent"
    elif overall >= 60:
        rating = "good"
    elif overall >= 40:
        rating = "fair"
    else:
        rating = "poor"

    return HealthScore(
        overall_score=overall,
        parts=parts,
        measurable=measurable,
        measured_parts=measured_parts,
        measured_max=measured_max,
        has_enough_data=measured_max > 0 and len(measured_parts) >= 2,
        rating=rating,
    )


def transaction_count(db: Session, user_id: int) -> int:
    """
    How many transactions the reader has recorded.

    Every transaction counts, including pending ones: the question is
    "how much has this reader recorded", not "how much has been
    approved".
    """
    total = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.user_id == user_id, Transaction.is_deleted == False)
        .scalar()
    )
    return int(total or 0)


def month_range(today: Optional[date] = None) -> Tuple[date, date]:
    """The first and the last day of the month that holds `today`."""
    from calendar import monthrange

    if today is None:
        today = date.today()
    _, last = monthrange(today.year, today.month)
    return date(today.year, today.month, 1), date(today.year, today.month, last)

