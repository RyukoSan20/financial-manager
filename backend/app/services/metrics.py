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
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.debt import Debt
from app.models.transaction import Transaction
from app.models.user import User
from app.services.currency_totals import total_in_currency
from app.services.transaction_filter import (
    counted_transactions_filter,
    personal_expense_filter,
    personal_income_filter,
)

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

    The money that a shared bill left behind is left out of both
    totals. When a host pays for a table of four, the money the
    others owe back is on loan rather than spent, and when it comes
    back it is a return rather than earnings. It still moves the
    account balance, because the money really did move; it just does
    not belong in a chart of what the reader spent and earned.
    """
    def _sum(kind: str) -> float:
        conditions = (
            personal_income_filter() if kind == "income" else personal_expense_filter()
        )
        total = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.type == kind,
                Transaction.user_id == user_id,
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                *conditions,
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


def daily_spending(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
) -> List[Dict[str, Any]]:
    """
    What was spent on each day of a date range.

    The calendar of spending is the question "which day was the worst
    one?", and the answer cannot be a monthly total - the whole point
    is that the money came out on one day rather than spread across
    thirty.

    So this is one row per day that has spending on it, with the
    amount and the number of transactions. The days with nothing on
    them are not in the answer, because there is nothing to say about
    a day with no spending, and the calendar that draws this makes the
    empty days itself.

    Only the money the reader spent is here. The money that moved
    between their own accounts is not spending, and the money that
    came in is not spending either, so neither is counted.
    """
    rows = (
        db.query(
            Transaction.date.label("day"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .filter(
            Transaction.type == "expense",
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            *personal_expense_filter(),
        )
        .group_by(Transaction.date)
        .order_by(Transaction.date)
        .all()
    )

    return [
        {
            "date": row.day.isoformat() if hasattr(row.day, "isoformat") else str(row.day),
            "total": float(row.total or 0),
            "count": int(row.count or 0),
        }
        for row in rows
    ]


def transactions_in_range(
    db: Session,
    user_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    types: Optional[List[str]] = None,
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
) -> List[Any]:
    """
    The reader's transactions, narrowed by what the reader asked for.

    The export screen lets a reader choose a date range, the kinds of
    transaction, and the account. So the query has to be able to do
    all three, and it has to do them together - a reader who asks for
    "the last month, only the spending, from BCA" means all three at
    once.

    A filter that is not given is not applied. An empty list of types
    means "every kind", because that is what a list of nothing says
    when the reader has not chosen anything yet.

    Only approved transactions are here. A pending one is not part of
    the reader's money yet, so it is not part of their backup either.
    """
    query = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        *counted_transactions_filter(),
    )

    if start_date is not None:
        query = query.filter(Transaction.date >= start_date)
    if end_date is not None:
        query = query.filter(Transaction.date <= end_date)

    if types:
        wanted = [t for t in types if t]
        if wanted:
            query = query.filter(Transaction.type.in_(wanted))

    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)

    if category_id is not None:
        query = query.filter(Transaction.category_id == category_id)

    return query.order_by(Transaction.date.desc(), Transaction.id.desc()).all()


# ---------------------------------------------------------------------------
# Needs, wants and savings
# ---------------------------------------------------------------------------

# Which of the application's own categories is which.
#
# A need is what the month cannot go without. A want is what it can.
# Savings is the money that was put aside rather than spent.
#
# The categories are named by their system key, which does not change
# when the wording does. A category the reader made themselves has no
# key, and nothing here can know what it is for, so it is counted as a
# want: calling an unknown spending a need would make the month look
# more disciplined than anybody can vouch for.
NEEDS_KEYS = frozenset(
    {"food_drink", "transportation", "health", "education", "bills_utilities"}
)
SAVINGS_KEYS = frozenset({"savings_investment"})

# The rule of thumb for a month with no budgets: half for needs, three
# tenths for wants, a fifth put aside.
BUCKET_SHARES = {"needs": 0.5, "wants": 0.3, "savings": 0.2}

BUCKETS = ("needs", "wants", "savings")


def bucket_of_category(system_key: Optional[str]) -> str:
    """Whether a category is a need, a want, or savings."""
    if system_key in SAVINGS_KEYS:
        return "savings"
    if system_key in NEEDS_KEYS:
        return "needs"
    return "wants"


def spending_by_category(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
) -> Dict[Optional[int], float]:
    """
    What was spent in each category over a date range.

    The key is the category's id, and ``None`` is the spending that
    has no category. It is the reader's own spending, counted the way
    ``period_totals`` counts it, so the parts add up to that total.
    """
    rows = (
        db.query(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .filter(
            Transaction.type == "expense",
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            *personal_expense_filter(),
        )
        .group_by(Transaction.category_id)
        .all()
    )
    return {category_id: float(total or 0) for category_id, total in rows}


def monthly_budget_amount(amount: Any, period: Optional[str]) -> float:
    """
    What a budget comes to in a month.

    A weekly budget is fifty-two weeks spread over twelve months, and
    a yearly one is a twelfth. Anything else is taken as monthly.
    """
    value = float(amount or 0)
    if period == "weekly":
        return value * 52 / 12
    if period == "yearly":
        return value / 12
    return value


def _category_buckets(db: Session) -> Dict[int, str]:
    """
    The bucket of every category, by id.

    A sub-category belongs where its parent belongs, so "Kopi" under
    "Makanan & Minuman" is a need because the food is.
    """
    from app.models.category import Category

    rows = db.query(Category.id, Category.system_key, Category.parent_id).all()
    keys = {row[0]: row[1] for row in rows}
    parents = {row[0]: row[2] for row in rows}

    buckets: Dict[int, str] = {}
    for category_id in keys:
        key = keys.get(category_id)
        parent = parents.get(category_id)
        # One step up is enough: the tree is two levels deep.
        if not key and parent:
            key = keys.get(parent)
        buckets[category_id] = bucket_of_category(key)
    return buckets


def budget_pacing(
    db: Session,
    user_id: int,
    today: Optional[date] = None,
) -> Dict[str, Any]:
    """
    How the month is going, in three numbers.

    For needs, wants and savings: what has gone there this month, and
    what the limit is. With the day of the month beside them, a reader
    can see whether they are ahead of the calendar or behind it.

    The limit of a bucket is the reader's own budgets for the
    categories in it, each brought to a month. A bucket with no
    budget falls back to its share of this month's income. With
    neither, the limit is zero and ``limit_source`` says ``none``, so
    the page can say "no limit set" rather than draw a full bar
    against nothing.

    Savings counts the spending filed under the savings category and
    the money put into goals this month. A contribution to a goal is
    not a transaction, so the two do not overlap.
    """
    from calendar import monthrange

    from app.models.budget import Budget
    from app.models.goal import Goal, GoalContribution

    if today is None:
        today = date.today()
    start, end = month_range(today)
    days_in_month = monthrange(today.year, today.month)[1]

    buckets = _category_buckets(db)

    spent = {name: 0.0 for name in BUCKETS}
    for category_id, total in spending_by_category(db, user_id, start, end).items():
        spent[buckets.get(category_id, "wants")] += total

    contributed = (
        db.query(func.coalesce(func.sum(GoalContribution.amount), 0))
        .join(Goal, Goal.id == GoalContribution.goal_id)
        .filter(
            Goal.user_id == user_id,
            GoalContribution.date >= start,
            GoalContribution.date <= end,
        )
        .scalar()
    )
    spent["savings"] += float(contributed or 0)

    limits = {name: 0.0 for name in BUCKETS}
    budgets = (
        db.query(Budget)
        .filter(
            Budget.user_id == user_id,
            Budget.is_active.is_(True),
            Budget.category_id.isnot(None),
            Budget.start_date <= today,
        )
        .all()
    )
    for budget in budgets:
        if budget.end_date and budget.end_date < today:
            continue
        bucket = buckets.get(budget.category_id, "wants")
        limits[bucket] += monthly_budget_amount(budget.amount, budget.period)

    income, _ = period_totals(db, user_id, start, end)

    rows: Dict[str, Any] = {}
    for name in BUCKETS:
        limit = limits[name]
        source = "budgets"
        if limit <= 0:
            limit = income * BUCKET_SHARES[name]
            source = "income_rule" if limit > 0 else "none"
        rows[name] = {
            "spent": round(spent[name], 2),
            "limit": round(limit, 2),
            "limit_source": source,
        }

    return {
        "needs": rows["needs"],
        "wants": rows["wants"],
        "savings": rows["savings"],
        "current_day": today.day,
        "days_in_month": days_in_month,
        "month": today.month,
        "year": today.year,
        "income": round(income, 2),
    }


def over_budget_categories(
    db: Session,
    user_id: int,
    today: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """
    The budgets that this month's spending has gone past.

    One row per budget that is over, with how far over it is. A
    budget for a week or a year is compared as a month, the same way
    the pacing compares it.
    """
    from app.models.budget import Budget
    from app.models.category import Category

    if today is None:
        today = date.today()
    start, end = month_range(today)
    by_category = spending_by_category(db, user_id, start, end)

    rows = (
        db.query(Budget, Category.name)
        .join(Category, Category.id == Budget.category_id)
        .filter(
            Budget.user_id == user_id,
            Budget.is_active.is_(True),
            Budget.start_date <= today,
        )
        .all()
    )

    over: List[Dict[str, Any]] = []
    for budget, category_name in rows:
        if budget.end_date and budget.end_date < today:
            continue
        limit = monthly_budget_amount(budget.amount, budget.period)
        used = by_category.get(budget.category_id, 0.0)
        if limit > 0 and used > limit:
            over.append(
                {
                    "budget_id": budget.id,
                    "name": budget.name or category_name,
                    "category": category_name,
                    "spent": round(used, 2),
                    "limit": round(limit, 2),
                    "over_by": round(used - limit, 2),
                }
            )
    over.sort(key=lambda row: row["over_by"], reverse=True)
    return over
