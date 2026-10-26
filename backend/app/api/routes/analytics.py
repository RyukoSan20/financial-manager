"""Analytics API routes for financial insights and trends."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, List
from datetime import date, timedelta
from decimal import Decimal
from collections import defaultdict

from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.category import Category
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.debt import Debt
from app.models.net_worth import NetWorthSnapshot
from app.models.user import User
from app.services.calculation.formulas import (
    calculate_goal_on_track,
    calculate_spending_velocity,
    _round
)

router = APIRouter()


def get_month_range(year: int, month: int):
    """Get start and end dates for a month."""
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return start, end


def get_period_range(period_type: str, reference_date: date = None):
    """Get start and end dates for a period."""
    if reference_date is None:
        reference_date = date.today()
    
    if period_type == "daily":
        return reference_date, reference_date
    elif period_type == "weekly":
        start = reference_date - timedelta(days=reference_date.weekday())
        end = start + timedelta(days=6)
        return start, end
    elif period_type == "monthly":
        return get_month_range(reference_date.year, reference_date.month)
    elif period_type == "quarterly":
        quarter = (reference_date.month - 1) // 3
        start_month = quarter * 3 + 1
        start = date(reference_date.year, start_month, 1)
        if start_month == 10:
            end = date(reference_date.year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(reference_date.year, start_month + 3, 1) - timedelta(days=1)
        return start, end
    elif period_type == "yearly":
        return date(reference_date.year, 1, 1), date(reference_date.year, 12, 31)
    else:
        return get_month_range(reference_date.year, reference_date.month)


# =============================================================================
# CASH FLOW TRENDS
# =============================================================================

@router.get("/cash-flow-trend")
def get_cash_flow_trend(
    months: int = Query(default=6, ge=1, le=24),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get monthly cash flow trend for N months."""
    user_id = current_user.id if current_user else None
    today = date.today()
    monthly_data = []
    
    for i in range(months - 1, -1, -1):
        # Calculate month range
        target_month = today.month - i
        target_year = today.year
        while target_month <= 0:
            target_month += 12
            target_year -= 1
        
        start, end = get_month_range(target_year, target_month)
        
        # Query transactions (exclude transfers)
        income = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "income",
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False,
            Transaction.status.in_(('approved', None, ''))
        ).scalar() or Decimal("0")
        
        expense = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "expense",
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False,
            Transaction.status.in_(('approved', None, ''))
        ).scalar() or Decimal("0")
        
        # Transfer totals (for reference)
        transfer_out = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "transfer_out",
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False,
            Transaction.status.in_(('approved', None, ''))
        ).scalar() or Decimal("0")
        
        transfer_in = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "transfer_in",
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False,
            Transaction.status.in_(('approved', None, ''))
        ).scalar() or Decimal("0")
        
        monthly_data.append({
            "month": start.strftime("%Y-%m"),
            "month_name": start.strftime("%b %Y"),
            "income": income,
            "expense": expense,
            "net": income - expense,
            "transfer_out": transfer_out,
            "transfer_in": transfer_in,
            "saving_rate": float((income - expense) / income * 100) if income > 0 else 0,
        })
    
    # Calculate trends
    previous = None
    if len(monthly_data) >= 2:
        latest = monthly_data[-1]
        previous = monthly_data[-2]
        income_change = float(latest["income"] - previous["income"]) if previous["income"] > 0 else 0
        expense_change = float(latest["expense"] - previous["expense"]) if previous["expense"] > 0 else 0
        
        income_trend = "up" if income_change > 0 else "down" if income_change < 0 else "stable"
        expense_trend = "up" if expense_change > 0 else "down" if expense_change < 0 else "stable"
    else:
        income_trend = expense_trend = "stable"
        income_change = expense_change = 0
    
    return {
        "months": monthly_data,
        # The frontend has always read "monthly". Without this alias the cash
        # flow chart rendered empty even though the data was there.
        "monthly": monthly_data,
        "summary": {
            "total_income": sum(m["income"] for m in monthly_data),
            "total_expense": sum(m["expense"] for m in monthly_data),
            "total_net": sum(m["net"] for m in monthly_data),
            "avg_monthly_income": sum(m["income"] for m in monthly_data) / len(monthly_data),
            "avg_monthly_expense": sum(m["expense"] for m in monthly_data) / len(monthly_data),
            "avg_saving_rate": sum(m["saving_rate"] for m in monthly_data) / len(monthly_data),
        },
        "trends": {
            "income_trend": income_trend,
            "expense_trend": expense_trend,
            "income_change_pct": (
                float(income_change / previous["income"] * 100)
                if previous is not None and previous["income"] > 0 else 0
            ),
            "expense_change_pct": (
                float(expense_change / previous["expense"] * 100)
                if previous is not None and previous["expense"] > 0 else 0
            ),
        }
    }


# =============================================================================
# EXPENSE ANALYSIS
# =============================================================================

@router.get("/expense-breakdown")
def get_expense_breakdown(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    group_by: str = Query(default="category", regex="^(category|account|day|week)$"),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get expense breakdown by category, account, or time period."""
    user_id = current_user.id if current_user else None
    if not start_date:
        start_date, _ = get_month_range(date.today().year, date.today().month)
    if not end_date:
        end_date = date.today()
    
    # Query expenses with category
    transactions = db.query(Transaction).filter(
        Transaction.type == "expense",
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False,
        Transaction.status.in_(('approved', None, ''))
    ).all()
    
    total_expense = sum(t.amount for t in transactions)
    
    breakdown = defaultdict(Decimal)
    details = defaultdict(list)
    
    for t in transactions:
        if group_by == "category":
            key = t.category.name if t.category else "Uncategorized"
        elif group_by == "account":
            key = t.account.name if t.account else "Unknown"
        elif group_by == "day":
            key = str(t.date)
        elif group_by == "week":
            week_num = t.date.isocalendar()[1]
            key = f"{t.date.year}-W{week_num:02d}"
        
        breakdown[key] += t.amount
        details[key].append({
            "id": t.id,
            "amount": t.amount,
            "date": t.date,
            "description": t.description,

                "message": t.description,            "category": t.category.name if t.category else None,
            "category_icon": t.category.icon if t.category else None,
            "category_color": t.category.color if t.category else None,
        })
    
    result = []
    for key, total in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
        percentage = float(total / total_expense * 100) if total_expense > 0 else 0
        result.append({
            "name": key,
            "total": total,
            "percentage": percentage,
            "transaction_count": len(details[key]),
            "details": details[key][:5] if len(details[key]) > 5 else details[key],  # Top 5 for performance
        })
    
    return {
        "period": {"start": start_date, "end": end_date},
        "group_by": group_by,
        "total_expense": total_expense,
        "breakdown": result,
    }


@router.get("/top-expenses")
def get_top_expenses(
    limit: int = Query(default=10, ge=1, le=50),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get top individual expenses."""
    user_id = current_user.id if current_user else None
    if not start_date:
        start_date, _ = get_month_range(date.today().year, date.today().month)
    if not end_date:
        end_date = date.today()
    
    transactions = db.query(Transaction).filter(
        Transaction.type == "expense",
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False,
        Transaction.status.in_(('approved', None, ''))
    ).order_by(Transaction.amount.desc()).limit(limit).all()
    
    return {
        "period": {"start": start_date, "end": end_date},
        "expenses": [
            {
                "id": t.id,
                "amount": t.amount,
                "date": t.date,
                "description": t.description,

                "message": t.description,                "category": t.category.name if t.category else "Uncategorized",
                "category_icon": t.category.icon if t.category else None,
                "account": t.account.name if t.account else None,
            }
            for t in transactions
        ]
    }


@router.get("/recurring-expenses")
def get_recurring_expenses(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get summary of recurring expenses (from recurring rules)."""
    from app.models.recurring import RecurringRule
    
    rules = db.query(RecurringRule).filter(
        RecurringRule.type == "expense",
        RecurringRule.is_active == True
    ).all()
    
    monthly_total = Decimal("0")
    items = []
    
    for rule in rules:
        # Calculate monthly equivalent
        freq = rule.frequency
        if freq == "daily":
            monthly = rule.amount * 30
        elif freq == "weekly":
            monthly = rule.amount * 4.33
        elif freq == "biweekly":
            monthly = rule.amount * 2.17
        elif freq == "monthly":
            monthly = rule.amount
        elif freq == "quarterly":
            monthly = rule.amount / 3
        elif freq == "yearly":
            monthly = rule.amount / 12
        else:
            monthly = rule.amount
        
        monthly_total += monthly
        
        items.append({
            "id": rule.id,
            "description": rule.description,

                "message": rule.description,            "amount": rule.amount,
            "frequency": freq,
            "monthly_equivalent": _round(Decimal(str(monthly))),
            "next_date": rule.next_occurrence,
            "category": rule.category.name if rule.category else None,
        })
    
    return {
        "total_monthly_recurring": _round(monthly_total),
        "yearly_recurring": _round(monthly_total * 12),
        "count": len(items),
        "items": items,
    }


# =============================================================================
# INCOME ANALYSIS
# =============================================================================

@router.get("/income-breakdown")
def get_income_breakdown(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get income breakdown by category."""
    user_id = current_user.id if current_user else None
    if not start_date:
        start_date, _ = get_month_range(date.today().year, date.today().month)
    if not end_date:
        end_date = date.today()
    
    transactions = db.query(Transaction).filter(
        Transaction.type == "income",
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False,
        Transaction.status.in_(('approved', None, ''))
    ).all()
    
    total_income = sum(t.amount for t in transactions)
    
    breakdown = defaultdict(Decimal)
    for t in transactions:
        key = t.category.name if t.category else "Other"
        breakdown[key] += t.amount
    
    result = []
    for key, total in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
        percentage = float(total / total_income * 100) if total_income > 0 else 0
        result.append({
            "name": key,
            "total": total,
            "percentage": percentage,
        })
    
    return {
        "period": {"start": start_date, "end": end_date},
        "total_income": total_income,
        "breakdown": result,
    }


@router.get("/income-sources")
def get_income_sources(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get recurring income sources."""
    from app.models.recurring import RecurringRule
    
    rules = db.query(RecurringRule).filter(
        RecurringRule.type == "income",
        RecurringRule.is_active == True
    ).all()
    
    monthly_total = Decimal("0")
    items = []
    
    for rule in rules:
        freq = rule.frequency
        if freq == "monthly":
            monthly = rule.amount
        elif freq == "yearly":
            monthly = rule.amount / 12
        else:
            monthly = rule.amount * 4.33  # Approximate
        
        monthly_total += monthly
        
        items.append({
            "id": rule.id,
            "description": rule.description,

                "message": rule.description,            "amount": rule.amount,
            "frequency": freq,
            "monthly_equivalent": _round(Decimal(str(monthly))),
        })
    
    return {
        "total_recurring_income": _round(monthly_total),
        "count": len(items),
        "sources": items,
    }


# =============================================================================
# BUDGET ANALYSIS
# =============================================================================

@router.get("/budget-vs-actual")
def get_budget_vs_actual(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Compare budgets vs actual spending."""
    user_id = current_user.id if current_user else None
    if not start_date:
        start_date, _ = get_month_range(date.today().year, date.today().month)
    if not end_date:
        end_date = date.today()
    
    budgets = db.query(Budget).filter(
        Budget.is_active == True,
        Budget.start_date <= end_date,
        or_(Budget.end_date == None, Budget.end_date >= start_date)
    ).all()
    
    results = []
    total_budget = Decimal("0")
    total_actual = Decimal("0")
    
    for budget in budgets:
        # Calculate actual spending for this budget
        query = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "expense",
            Transaction.user_id == user_id,
            Transaction.date >= budget.start_date,
            Transaction.date <= (budget.end_date or end_date),
            Transaction.is_deleted == False,
        Transaction.status.in_(('approved', None, ''))
        )
        
        if budget.category_id:
            query = query.filter(Transaction.category_id == budget.category_id)
        if budget.account_id:
            query = query.filter(Transaction.account_id == budget.account_id)
        
        actual = query.scalar() or Decimal("0")
        
        utilization = float(actual / budget.amount * 100) if budget.amount > 0 else 0
        remaining = budget.amount - actual
        
        results.append({
            "id": budget.id,
            "name": budget.name,
            "budget_amount": budget.amount,
            "actual_spent": actual,
            "remaining": remaining,
            "utilization": utilization,
            "status": "over" if remaining < 0 else "on_track" if utilization < 80 else "warning" if utilization < 100 else "good",
            "category": budget.category.name if budget.category else "All Categories",
        })
        
        total_budget += budget.amount
        total_actual += min(actual, budget.amount)  # Cap at budget
    
    return {
        "period": {"start": start_date, "end": end_date},
        "budgets": results,
        "summary": {
            "total_budget": total_budget,
            "total_actual": total_actual,
            "total_remaining": total_budget - total_actual,
            "overall_utilization": float(total_actual / total_budget * 100) if total_budget > 0 else 0,
        }
    }


# =============================================================================
# SPENDING PATTERNS
# =============================================================================

@router.get("/spending-patterns")
def get_spending_patterns(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Analyze spending patterns by day of week and time of month."""
    user_id = current_user.id if current_user else None
    today = date.today()
    start_date = today - timedelta(days=90)  # Last 3 months
    
    transactions = db.query(Transaction).filter(
        Transaction.type == "expense",
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
        Transaction.date <= today,
        Transaction.is_deleted == False,
        Transaction.status.in_(('approved', None, ''))
    ).all()
    
    if not transactions:
        return {"message": "No spending data available"}
    
    # By day of week
    by_weekday = defaultdict(lambda: {"total": Decimal("0"), "count": 0})
    weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    # By time of month
    by_period = defaultdict(lambda: {"total": Decimal("0"), "count": 0})
    
    for t in transactions:
        # Day of week
        dow = t.date.weekday()
        by_weekday[dow]["total"] += t.amount
        by_weekday[dow]["count"] += 1
        
        # Time of month
        if t.date.day <= 10:
            period = "early"  # 1-10
        elif t.date.day <= 20:
            period = "mid"  # 11-20
        else:
            period = "late"  # 21-31
        
        by_period[period]["total"] += t.amount
        by_period[period]["count"] += 1
    
    # Format results
    weekday_results = []
    for i in range(7):
        data = by_weekday[i]
        avg = data["total"] / data["count"] if data["count"] > 0 else Decimal("0")
        weekday_results.append({
            "day": weekday_names[i],
            "total": data["total"],
            "count": data["count"],
            "average": _round(avg),
        })
    
    period_results = []
    for period in ["early", "mid", "late"]:
        data = by_period[period]
        avg = data["total"] / data["count"] if data["count"] > 0 else Decimal("0")
        period_results.append({
            "period": period,
            "label": f"{period.capitalize()} Month (Day {1 if period=='early' else 11 if period=='mid' else 21}-{(10 if period=='early' else 20 if period=='mid' else 31)})",
            "total": data["total"],
            "count": data["count"],
            "average": _round(avg),
        })
    
    return {
        "period": {"start": start_date, "end": today},
        "by_weekday": weekday_results,
        "by_month_period": period_results,
    }


# =============================================================================
# NET WORTH ANALYSIS
# =============================================================================

@router.get("/net-worth-history")
def get_net_worth_history(
    months: int = Query(default=12, ge=1, le=36),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get historical net worth data."""
    user_id = current_user.id if current_user else None
    today = date.today()
    
    # First, try to get from snapshots
    start_date = date(today.year, today.month, 1) - timedelta(days=30 * months)
    
    snapshots = db.query(NetWorthSnapshot).filter(
        NetWorthSnapshot.date >= start_date
    ).order_by(NetWorthSnapshot.date).all()
    
    if snapshots:
        return {
            "source": "snapshots",
            "history": [
                {
                    "date": s.date,
                    "net_worth": s.net_worth,
                    "total_assets": s.total_assets,
                    "total_liabilities": s.total_liabilities,
                    "change": s.change_from_previous,
                }
                for s in snapshots
            ]
        }
    
    # Calculate from accounts if no snapshots
    accounts = db.query(Account).filter(
        Account.is_active == True, Account.user_id == user_id
    ).all()
    debts = db.query(Debt).filter(
        Debt.user_id == user_id,
        Debt.is_active == True,
        Debt.is_paid_off == False,
    ).all()
    
    total_assets = sum(a.balance for a in accounts if a.balance > 0)
    total_liabilities = sum(a.balance for a in accounts if a.balance < 0)
    total_liabilities += sum(d.current_balance for d in debts)
    
    current_net_worth = total_assets - total_liabilities
    
    # Return current values with a note
    return {
        "source": "calculated",
        "current": {
            "net_worth": current_net_worth,
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
        },
        "history": [],
        "message": "No historical snapshots available. Take a snapshot to track net worth over time."
    }


@router.post("/net-worth-snapshot")
def create_net_worth_snapshot(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Create a net worth snapshot for today."""
    user_id = current_user.id if current_user else None
    
    # Get current values
    accounts = db.query(Account).filter(
        Account.is_active == True, Account.user_id == user_id
    ).all()
    debts = db.query(Debt).filter(
        Debt.user_id == user_id,
        Debt.is_active == True,
        Debt.is_paid_off == False,
    ).all()
    
    # Calculate totals by type
    cash = sum(a.balance for a in accounts if a.account_type == "cash")
    bank = sum(a.balance for a in accounts if a.account_type == "bank")
    investment = sum(a.balance for a in accounts if a.account_type == "investment")
    ewallet = sum(a.balance for a in accounts if a.account_type == "e-wallet")
    credit_card = sum(abs(a.balance) for a in accounts if a.account_type == "credit_card")
    
    total_assets = sum(a.balance for a in accounts)
    total_debt = credit_card + sum(d.current_balance for d in debts)
    net_worth = total_assets - total_debt
    
    # Get previous snapshot
    prev_snapshot = db.query(NetWorthSnapshot).order_by(
        NetWorthSnapshot.date.desc()
    ).first()
    
    change = net_worth - prev_snapshot.net_worth if prev_snapshot else Decimal("0")
    change_pct = float(change / prev_snapshot.net_worth * 100) if prev_snapshot and prev_snapshot.net_worth != 0 else 0
    
    # Create snapshot
    snapshot = NetWorthSnapshot(
        date=date.today(),
        total_assets=total_assets,
        total_liabilities=total_debt,
        net_worth=net_worth,
        cash_balance=cash,
        bank_balance=bank,
        investment_balance=investment,
        other_assets=ewallet,
        total_debt=total_debt,
        change_from_previous=change,
        change_percent=Decimal(str(change_pct)),
    )
    
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    
    return {
        "id": snapshot.id,
        "date": snapshot.date,
        "net_worth": snapshot.net_worth,
        "total_assets": snapshot.total_assets,
        "total_liabilities": snapshot.total_liabilities,
        "change_from_previous": snapshot.change_from_previous,
        "change_percent": float(snapshot.change_percent),
    }


# =============================================================================
# MONTHLY COMPARISON
# =============================================================================

@router.get("/monthly-comparison")
def get_monthly_comparison(
    months: int = Query(default=3, ge=2, le=6),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Compare current month with previous N months."""
    user_id = current_user.id if current_user else None
    today = date.today()
    current_month = (today.year, today.month)
    
    comparisons = []
    
    for i in range(months):
        target_month = today.month - i
        target_year = today.year
        while target_month <= 0:
            target_month += 12
            target_year -= 1
        
        start, end = get_month_range(target_year, target_month)
        
        income = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "income",
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False,
            Transaction.status.in_(('approved', None, ''))
        ).scalar() or Decimal("0")
        
        expense = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "expense",
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False,
            Transaction.status.in_(('approved', None, ''))
        ).scalar() or Decimal("0")
        
        # Budget comparison
        budgets = db.query(Budget).filter(
            Budget.is_active == True,
            Budget.start_date <= end
        ).all()
        
        total_budget = sum(b.amount for b in budgets)
        
        comparisons.append({
            "month": start.strftime("%Y-%m"),
            "month_name": start.strftime("%B %Y"),
            "is_current": i == 0,
            "income": income,
            "expense": expense,
            "net": income - expense,
            "budget": total_budget,
            "budget_used": float(expense / total_budget * 100) if total_budget > 0 else 0,
            "saving_rate": float((income - expense) / income * 100) if income > 0 else 0,
        })
    
    comparisons.reverse()  # Oldest first
    
    # The percentage change against the month before. The frontend reads
    # change_pct, and without it the table showed "NaN%".
    for index, row in enumerate(comparisons):
        if index == 0:
            row["change_pct"] = 0
            continue
        previous = comparisons[index - 1]
        previous_expense = float(previous["expense"] or 0)
        if previous_expense > 0:
            row["change_pct"] = float(
                (float(row["expense"] or 0) - previous_expense) / previous_expense * 100
            )
        else:
            row["change_pct"] = 0
    
    return {
        "comparisons": comparisons,
    }


# =============================================================================
# FINANCIAL HEALTH SCORE
# =============================================================================

@router.get("/financial-health")
def get_financial_health(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Calculate overall financial health score."""
    user_id = current_user.id if current_user else None
    today = date.today()
    start_date, end_date = get_month_range(today.year, today.month)
    
    # Get key metrics
    income = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == "income",
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False,
        Transaction.status.in_(('approved', None, ''))
    ).scalar() or Decimal("0")
    
    expense = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == "expense",
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False,
        Transaction.status.in_(('approved', None, ''))
    ).scalar() or Decimal("0")
    
    # Get accounts
    accounts = db.query(Account).filter(
        Account.is_active == True, Account.user_id == user_id
    ).all()
    total_balance = sum(a.balance for a in accounts)
    
    # Get debts
    debts = db.query(Debt).filter(
        Debt.user_id == user_id,
        Debt.is_active == True,
        Debt.is_paid_off == False
    ).all()
    total_debt = sum(d.current_balance for d in debts)
    
    # Get goals
    goals = db.query(Goal).filter(
        Goal.user_id == user_id,
        Goal.is_active == True,
        Goal.is_completed == False,
    ).all()
    
    # Calculate scores
    scores = {}
    total_score = 0
    max_score = 0
    
    # 1. Savings Rate (25 points max)
    max_score += 25
    if income > 0:
        saving_rate = float((income - expense) / income)
        if saving_rate >= 0.2:
            scores["savings_rate"] = 25
        elif saving_rate >= 0.1:
            scores["savings_rate"] = 15
        elif saving_rate >= 0:
            scores["savings_rate"] = 5
        else:
            scores["savings_rate"] = 0
    else:
        scores["savings_rate"] = 0
    
    # 2. Emergency Fund (25 points max)
    #
    # With no spending recorded there is no target to measure against.
    # Giving the full points for that would show a perfect score for
    # an empty month, which is not true. The score is left out of the
    # total instead, and the card says there is not enough to go on.
    max_score += 25
    monthly_expense = expense
    emergency_target = monthly_expense * 6
    emergency_measurable = monthly_expense > 0
    if not emergency_measurable:
        scores["emergency_fund"] = 0
    elif total_balance >= emergency_target:
        scores["emergency_fund"] = 25
    elif total_balance >= monthly_expense * 3:
        scores["emergency_fund"] = 15
    elif total_balance >= monthly_expense:
        scores["emergency_fund"] = 5
    else:
        scores["emergency_fund"] = 0
    
    # 3. Debt Level (25 points max)
    max_score += 25
    if income > 0:
        dti = float(total_debt / income)
        if dti == 0:
            scores["debt_level"] = 25
        elif dti <= 0.36:
            scores["debt_level"] = 20
        elif dti <= 0.5:
            scores["debt_level"] = 10
        else:
            scores["debt_level"] = 0
    else:
        scores["debt_level"] = 0
    
    # 4. Goals Progress (25 points max)
    #
    # No goals means there is nothing to be on track with. That is not
    # the same as being on track with everything, so the points are
    # left out of the total rather than given in full.
    max_score += 25
    goals_measurable = bool(goals)
    if goals_measurable:
        on_track_count = 0
        for g in goals:
            on_track = calculate_goal_on_track(g.current_amount, g.target_amount, g.target_date)
            if on_track["on_track"]:
                on_track_count += 1
        goal_score = int(on_track_count / len(goals) * 25)
        scores["goals_progress"] = goal_score
    else:
        scores["goals_progress"] = 0
    
    # The total is the sum over the parts that could be measured. A
    # part that had no data is left out of both the sum and the
    # maximum, so it neither adds to the score nor holds it down.
    measured_keys = []
    if income > 0:
        measured_keys.append("savings_rate")
    if emergency_measurable:
        measured_keys.append("emergency_fund")
    if income > 0:
        measured_keys.append("debt_level")
    if goals_measurable:
        measured_keys.append("goals_progress")

    total_score = sum(scores[k] for k in measured_keys)
    measured_max = 25 * len(measured_keys)
    overall_score = int(total_score / measured_max * 100) if measured_max > 0 else 0

    # When nothing at all could be measured there is no score to show.
    # Saying "0 out of 100" would read as a bad result rather than an
    # empty month.
    has_enough_data = measured_max > 0 and len(measured_keys) >= 2
    
    # Determine rating
    if overall_score >= 80:
        rating = "excellent"
    elif overall_score >= 60:
        rating = "good"
    elif overall_score >= 40:
        rating = "fair"
    else:
        rating = "poor"
    
    # The words are held in the locale files, not here. The backend
    # names each one so the frontend can read it in the language the
    # reader picked.
    return {
        "overall_score": overall_score,
        # The same score under the name the frontend has always read. Without
        # this the health card rendered as an empty block.
        "total_score": overall_score,
        "rating": rating,
        "message_key": "analytics.health_message_" + rating,
        # Whether there was enough to judge. With one transaction the
        # score is a guess, and the card should say so rather than
        # present a number as if it were a verdict.
        "has_enough_data": has_enough_data,
        "measured_parts": measured_keys,
        "measured_max": measured_max,
        "breakdown": {
            "savings_rate": {
                "score": scores["savings_rate"],
                "max": 25,
                "measurable": income > 0,
                "label_key": "analytics.health_savings_rate",
                "description_key": (
                    "analytics.health_savings_aim"
                    if scores["savings_rate"] < 25
                    else "analytics.health_savings_great"
                ),
            },
            "emergency_fund": {
                "score": scores["emergency_fund"],
                "max": 25,
                "measurable": emergency_measurable,
                "label_key": "analytics.health_emergency_fund",
                "description_key": (
                    "analytics.health_emergency_funded"
                    if emergency_measurable
                    else "analytics.health_no_expense_data"
                ),
                "description_values": {"target": _round(emergency_target)},
            },
            "debt_level": {
                "score": scores["debt_level"],
                "max": 25,
                "measurable": income > 0,
                "label_key": "analytics.health_debt_level",
                "description_key": (
                    "analytics.health_debt_dti"
                    if income > 0
                    else "analytics.health_no_income"
                ),
                "description_values": {
                    "dti": float(total_debt / income) * 100 if income > 0 else 0,
                },
            },
            "goals_progress": {
                "score": scores["goals_progress"],
                "max": 25,
                "measurable": goals_measurable,
                "label_key": "analytics.health_goals_progress",
                "description_key": (
                    "analytics.health_goals_active"
                    if goals
                    else "analytics.health_no_goals"
                ),
                "description_values": {"count": len(goals)},
            }
        },
        "metrics": {
            "saving_rate": float((income - expense) / income * 100) if income > 0 else 0,
            "total_balance": total_balance,
            "total_debt": total_debt,
            "active_goals": len(goals),
        }
    }


# =============================================================================
# MERCHANT ANALYTICS
# =============================================================================

@router.get("/merchants", response_model=List[dict])
def get_merchant_analytics(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get merchant spending analytics.
    
    Returns:
    - Top merchants by spending
    - Visit frequency
    - Average transaction
    - Location coordinates (if available)
    """
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    
    # Build query
    query = db.query(
        Transaction.merchant_name,
        func.count(Transaction.id).label("transaction_count"),
        func.sum(Transaction.amount).label("total_spent"),
        func.avg(Transaction.amount).label("avg_transaction"),
        func.min(Transaction.date).label("first_visit"),
        func.max(Transaction.date).label("last_visit"),
    ).filter(
        Transaction.merchant_name.isnot(None),
        Transaction.merchant_name != "",
        Transaction.type == "expense",
        Transaction.date >= start_date,
        Transaction.date <= end_date,
    )
    
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
    # Group by merchant
    query = query.group_by(Transaction.merchant_name)
    query = query.order_by(func.sum(Transaction.amount).desc())
    
    merchants = query.limit(limit).all()
    
    result = []
    for m in merchants:
        # Get coordinates (simplified - would use geocoding service)
        coordinates = None
        
        result.append({
            "merchant_name": m.merchant_name,
            "transaction_count": m.transaction_count,
            "total_spent": float(m.total_spent or 0),
            "avg_transaction": float(m.avg_transaction or 0),
            "first_visit": m.first_visit.isoformat() if m.first_visit else None,
            "last_visit": m.last_visit.isoformat() if m.last_visit else None,
            "coordinates": coordinates,
        })
    
    return result


@router.get("/merchants/map")
def get_merchant_map_data(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get ALL spending locations for interactive map.
    Returns from 3 strategies, sorted by total_spent:
    1. GPS data from transaction_locations table
    2. Transactions with stored lat/lng
    3. Category-based with Jakarta area coordinates
    """
    from app.modules.ledger.location.models import TransactionLocation

    user_id = current_user.id if current_user else None
    all_locations = []

    # Strategy 1: From transaction_locations (captured GPS)
    txl_q = db.query(TransactionLocation).join(
        Transaction, Transaction.id == TransactionLocation.transaction_id
    )
    if user_id:
        txl_q = txl_q.filter(Transaction.user_id == user_id)
    for row in txl_q.all():
        if row.captured_latitude and row.captured_longitude:
            tx_sp = db.query(func.sum(Transaction.amount)).filter(
                Transaction.id == row.transaction_id
            ).scalar() or 0
            all_locations.append({
                "id": f"gps_{row.id}",
                "name": row.nearest_store_name or row.captured_address or "Lokasi GPS",
                "latitude": float(row.captured_latitude),
                "longitude": float(row.captured_longitude),
                "address": row.captured_address or "",
                "visit_count": 1,
                "total_spent": float(tx_sp),
                "avg_transaction": float(tx_sp),
                "source": "gps",
                "category": "GPS",
            })

    # Strategy 2: Transactions with stored lat/lng
    tx_q = db.query(
        Transaction.latitude,
        Transaction.longitude,
        Transaction.description,
        Transaction.merchant_address,
        func.count(Transaction.id).label("visit_count"),
        func.sum(Transaction.amount).label("total_spent"),
        func.avg(Transaction.amount).label("avg_spent"),
    ).filter(
        Transaction.type == "expense",
        Transaction.latitude.isnot(None),
        Transaction.longitude.isnot(None),
    )
    if user_id:
        tx_q = tx_q.filter(Transaction.user_id == user_id)
    tx_q = tx_q.group_by(
        Transaction.latitude, Transaction.longitude,
        Transaction.description, Transaction.merchant_address
    )
    for row in tx_q.all():
        lat_f = float(row.latitude)
        lng_f = float(row.longitude)
        name = row.merchant_address or row.description or f"Lokasi ({lat_f:.4f}, {lng_f:.4f})"
        all_locations.append({
            "id": f"gps_tx_{lat_f}_{lng_f}",
            "name": name,
            "latitude": lat_f,
            "longitude": lng_f,
            "address": row.merchant_address or "",
            "visit_count": row.visit_count,
            "total_spent": float(row.total_spent or 0),
            "avg_transaction": float(row.avg_spent or 0),
            "source": "gps_tx",
            "category": "GPS Transaction",
        })

    # Strategy 3: Category-based (Jakarta area clusters)
    cat_q = db.query(
        Category.name.label("cat_name"),
        Category.icon.label("cat_icon"),
        func.count(Transaction.id).label("visit_count"),
        func.sum(Transaction.amount).label("total_spent"),
        func.avg(Transaction.amount).label("avg_spent"),
    ).join(
        Category, Category.id == Transaction.category_id
    ).filter(Transaction.type == "expense")
    if user_id:
        cat_q = cat_q.filter(Transaction.user_id == user_id)
    cat_q = cat_q.group_by(Category.name, Category.icon)

    CATEGORY_CLUSTERS = {
        "Makanan & Minuman": (-6.1751, 106.8650, "🍔"),
        "Transportasi": (-6.1580, 106.8450, "🚗"),
        "Belanja": (-6.1951, 106.8450, "🛒"),
        "Hiburan": (-6.1700, 106.8200, "🎬"),
        "Kesehatan": (-6.2000, 106.8800, "💊"),
        "Fashion": (-6.1850, 106.8350, "👕"),
        "Tagihan & Utilitas": (-6.1650, 106.8900, "💡"),
        "Pendidikan": (-6.1880, 106.8550, "📚"),
        "Investasi & Tabungan": (-6.1751, 106.8750, "💰"),
        "Investasi": (-6.1751, 106.8750, "💰"),
        "Lainnya (Expense)": (-6.2000, 106.8000, "📍"),
        "Lainnya (Income)": (-6.2000, 106.8000, "📍"),
    }

    for row in cat_q.all():
        name_key = str(row.cat_name)
        default_lat = -6.2 + (hash(name_key) % 100) / 500
        default_lng = 106.8 + (hash(name_key) % 100) / 500
        lat, lng, icon = CATEGORY_CLUSTERS.get(name_key, (default_lat, default_lng, "📍"))
        all_locations.append({
            "id": f"cat_{name_key}",
            "name": f"{icon} {name_key}",
            "latitude": lat,
            "longitude": lng,
            "address": f"Area Jakarta — {name_key}",
            "visit_count": row.visit_count,
            "total_spent": float(row.total_spent or 0),
            "avg_transaction": float(row.avg_spent or 0),
            "source": "category",
            "category": name_key,
        })

    # Deduplicate by id
    seen = {}
    for loc in all_locations:
        if loc["id"] not in seen:
            seen[loc["id"]] = loc
    unique = list(seen.values())
    unique.sort(key=lambda x: x["total_spent"], reverse=True)

    return {
        "markers": unique,
        "total_locations": len(unique),
        "total_spent": sum(m["total_spent"] for m in unique),
        "total_visits": sum(m["visit_count"] for m in unique),
        "sources": {
            "gps": sum(1 for m in unique if m["source"] == "gps"),
            "gps_tx": sum(1 for m in unique if m["source"] == "gps_tx"),
            "category": sum(1 for m in unique if m["source"] == "category"),
        },
    }




@router.get("/merchants/top")
def get_top_merchants(
    metric: str = Query(default="spending", regex="^(spending|frequency)$"),
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get top merchants by spending or visit frequency.
    
    Args:
        metric: "spending" (highest total) or "frequency" (most visits)
        limit: Number of merchants to return
    """
    if metric == "spending":
        order_col = func.sum(Transaction.amount).desc()
    else:
        order_col = func.count(Transaction.id).desc()
    
    query = db.query(
        Transaction.merchant_name,
        func.count(Transaction.id).label("visit_count"),
        func.sum(Transaction.amount).label("total_spent"),
        func.avg(Transaction.amount).label("avg_transaction"),
    ).filter(
        Transaction.merchant_name.isnot(None),
        Transaction.merchant_name != "",
        Transaction.type == "expense",
    )
    
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
    query = query.group_by(Transaction.merchant_name)
    query = query.order_by(order_col)
    
    merchants = query.limit(limit).all()
    
    return {
        "metric": metric,
        "merchants": [
            {
                "rank": i + 1,
                "merchant_name": m.merchant_name,
                "visit_count": m.visit_count,
                "total_spent": float(m.total_spent or 0),
                "avg_transaction": float(m.avg_transaction or 0),
            }
            for i, m in enumerate(merchants)
        ]
    }


@router.get("/spending/heatmap")
def get_spending_heatmap(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get spending data grouped by location for heatmap visualization.
    """
    query = db.query(
        Transaction.merchant_name,
        Transaction.latitude,
        Transaction.longitude,
        func.count(Transaction.id).label("transaction_count"),
        func.sum(Transaction.amount).label("total_spent"),
    ).filter(
        Transaction.merchant_name.isnot(None),
        Transaction.latitude.isnot(None),
        Transaction.longitude.isnot(None),
        Transaction.type == "expense",
    )
    
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
    query = query.group_by(
        Transaction.merchant_name,
        Transaction.latitude,
        Transaction.longitude,
    )
    
    locations = query.all()
    
    return {
        "points": [
            {
                "lat": float(loc.latitude),
                "lng": float(loc.longitude),
                "weight": float(loc.total_spent or 0) / 100000,  # Normalize for heatmap
                "merchant_name": loc.merchant_name,
                "transaction_count": loc.transaction_count,
                "total_spent": float(loc.total_spent or 0),
            }
            for loc in locations
        ]
    }
