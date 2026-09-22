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
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False
        ).scalar() or Decimal("0")
        
        expense = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False
        ).scalar() or Decimal("0")
        
        # Transfer totals (for reference)
        transfer_out = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "transfer_out",
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False
        ).scalar() or Decimal("0")
        
        transfer_in = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "transfer_in",
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False
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
            "income_change_pct": float(income_change / previous["income"] * 100) if previous["income"] > 0 else 0,
            "expense_change_pct": float(expense_change / previous["expense"] * 100) if previous["expense"] > 0 else 0,
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
    if not start_date:
        start_date, _ = get_month_range(date.today().year, date.today().month)
    if not end_date:
        end_date = date.today()
    
    # Query expenses with category
    transactions = db.query(Transaction).filter(
        Transaction.type == "expense",
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False
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
            "category": t.category.name if t.category else None,
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
    if not start_date:
        start_date, _ = get_month_range(date.today().year, date.today().month)
    if not end_date:
        end_date = date.today()
    
    transactions = db.query(Transaction).filter(
        Transaction.type == "expense",
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False
    ).order_by(Transaction.amount.desc()).limit(limit).all()
    
    return {
        "period": {"start": start_date, "end": end_date},
        "expenses": [
            {
                "id": t.id,
                "amount": t.amount,
                "date": t.date,
                "description": t.description,
                "category": t.category.name if t.category else "Uncategorized",
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
            "amount": rule.amount,
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
    if not start_date:
        start_date, _ = get_month_range(date.today().year, date.today().month)
    if not end_date:
        end_date = date.today()
    
    transactions = db.query(Transaction).filter(
        Transaction.type == "income",
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False
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
            "amount": rule.amount,
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
            Transaction.date >= budget.start_date,
            Transaction.date <= (budget.end_date or end_date),
            Transaction.is_deleted == False
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
    today = date.today()
    start_date = today - timedelta(days=90)  # Last 3 months
    
    transactions = db.query(Transaction).filter(
        Transaction.type == "expense",
        Transaction.date >= start_date,
        Transaction.date <= today,
        Transaction.is_deleted == False
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
    accounts = db.query(Account).filter(Account.is_active == True).all()
    debts = db.query(Debt).filter(Debt.is_active == True, Debt.is_paid_off == False).all()
    
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
def create_net_worth_snapshot(db: Session = Depends(get_db)):
    """Create a net worth snapshot for today."""
    
    # Get current values
    accounts = db.query(Account).filter(Account.is_active == True).all()
    debts = db.query(Debt).filter(Debt.is_active == True, Debt.is_paid_off == False).all()
    
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
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False
        ).scalar() or Decimal("0")
        
        expense = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_deleted == False
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
    today = date.today()
    start_date, end_date = get_month_range(today.year, today.month)
    
    # Get key metrics
    income = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == "income",
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False
    ).scalar() or Decimal("0")
    
    expense = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == "expense",
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_deleted == False
    ).scalar() or Decimal("0")
    
    # Get accounts
    accounts = db.query(Account).filter(Account.is_active == True).all()
    total_balance = sum(a.balance for a in accounts)
    
    # Get debts
    debts = db.query(Debt).filter(
        Debt.is_active == True,
        Debt.is_paid_off == False
    ).all()
    total_debt = sum(d.current_balance for d in debts)
    
    # Get goals
    goals = db.query(Goal).filter(Goal.is_active == True, Goal.is_completed == False).all()
    
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
    max_score += 25
    monthly_expense = expense
    emergency_target = monthly_expense * 6
    if total_balance >= emergency_target:
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
    max_score += 25
    if goals:
        on_track_count = 0
        for g in goals:
            on_track = calculate_goal_on_track(g.current_amount, g.target_amount, g.target_date)
            if on_track["on_track"]:
                on_track_count += 1
        goal_score = int(on_track_count / len(goals) * 25)
        scores["goals_progress"] = goal_score
    else:
        scores["goals_progress"] = 25  # No goals = no penalty
    
    total_score = sum(scores.values())
    overall_score = int(total_score / max_score * 100) if max_score > 0 else 0
    
    # Determine rating
    if overall_score >= 80:
        rating = "excellent"
        message = "Your financial health is excellent!"
    elif overall_score >= 60:
        rating = "good"
        message = "Your financial health is good, but there's room for improvement."
    elif overall_score >= 40:
        rating = "fair"
        message = "Your financial health needs attention."
    else:
        rating = "poor"
        message = "Your financial health needs significant improvement."
    
    return {
        "overall_score": overall_score,
        "rating": rating,
        "message": message,
        "breakdown": {
            "savings_rate": {
                "score": scores["savings_rate"],
                "max": 25,
                "label": "Savings Rate",
                "description": "aim for 20%+ savings rate" if scores["savings_rate"] < 25 else "Great savings rate!"
            },
            "emergency_fund": {
                "score": scores["emergency_fund"],
                "max": 25,
                "label": "Emergency Fund",
                "description": f"Target: 6x monthly expenses ({_round(emergency_target):,})" if total_balance < emergency_target else "Fully funded!"
            },
            "debt_level": {
                "score": scores["debt_level"],
                "max": 25,
                "label": "Debt Level",
                "description": f"DTI: {float(total_debt/income)*100:.0f}% (target: <36%)" if income > 0 else "No income data"
            },
            "goals_progress": {
                "score": scores["goals_progress"],
                "max": 25,
                "label": "Goals Progress",
                "description": f"{len(goals)} active goals" if goals else "No active goals"
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
    Get merchant data formatted for map visualization.
    
    Returns list of merchants with coordinates for map markers.
    """
    # Get merchants with coordinates
    query = db.query(
        Transaction.merchant_name,
        func.count(Transaction.id).label("visit_count"),
        func.sum(Transaction.amount).label("total_spent"),
        func.avg(Transaction.amount).label("avg_spent"),
        func.max(Transaction.latitude).label("latitude"),
        func.max(Transaction.longitude).label("longitude"),
    ).filter(
        Transaction.merchant_name.isnot(None),
        Transaction.merchant_name != "",
        Transaction.type == "expense",
    )
    
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
    query = query.group_by(Transaction.merchant_name)
    
    merchants = query.all()
    
    markers = []
    for m in merchants:
        if m.latitude and m.longitude:
            markers.append({
                "merchant_name": m.merchant_name,
                "latitude": float(m.latitude),
                "longitude": float(m.longitude),
                "visit_count": m.visit_count,
                "total_spent": float(m.total_spent or 0),
                "avg_spent": float(m.avg_spent or 0),
            })
    
    return {
        "markers": markers,
        "total_merchants_with_location": len(markers),
        "total_unique_merchants": len(merchants),
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
