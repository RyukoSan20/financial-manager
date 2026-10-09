"""Dashboard API routes with multi-tenancy and dynamic time intervals."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Literal
from datetime import date, timedelta, datetime
from decimal import Decimal
from calendar import month_abbr

from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.user import User
from app.services.calculation_service import calculation_service

router = APIRouter()

# Month abbreviations for labels
MONTH_LABELS = {i: month_abbr[i] for i in range(1, 13)}
DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


def get_current_month_range():
    """Get start and end of current month."""
    today = date.today()
    start = today.replace(day=1)
    if today.month == 12:
        end = today.replace(month=12, day=31)
    else:
        end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
    return start, end


def get_category_breakdown(db: Session, start: date, end: date, user_id: Optional[int] = None):
    """Get expense breakdown by category for a date range."""
    query = db.query(
        Category.name,
        func.sum(Transaction.amount).label('total')
    ).join(Transaction, Category.id == Transaction.category_id).filter(
        Transaction.type == "expense",
        Transaction.date >= start,
        Transaction.date <= end
    )
    
    if user_id:
        query = query.filter(Transaction.user_id == user_id)
    
    results = query.group_by(Category.name).all()
    return {row.name: float(row.total) for row in results}


@router.get("/summary")
def get_dashboard_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get dashboard summary with all key metrics."""
    
    # Default to current month
    if not start_date:
        start_date, default_end = get_current_month_range()
        end_date = end_date or default_end
    
    # Build base queries with multi-tenancy
    account_query = db.query(Account).filter(Account.is_active == True)
    if current_user:
        account_query = account_query.filter(Account.user_id == current_user.id)
    
    # Get total balance
    total_balance = sum(float(acc.balance or 0) for acc in account_query.all())
    
    # Transaction summaries
    base_tx_query = db.query(
        Transaction.type,
        func.sum(Transaction.amount).label('total')
    ).filter(
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )
    if current_user:
        base_tx_query = base_tx_query.filter(Transaction.user_id == current_user.id)
    
    tx_summary = base_tx_query.group_by(Transaction.type).all()
    
    total_income = sum(float(row.total) for row in tx_summary if row.type == 'income') or 0
    total_expense = sum(float(row.total) for row in tx_summary if row.type == 'expense') or 0
    
    # Budget info
    budget_query = db.query(func.sum(Budget.amount)).filter(Budget.is_active == True)
    if current_user:
        budget_query = budget_query.filter(Budget.user_id == current_user.id)
    total_budget = float(budget_query.scalar() or 0)
    
    return {
        "total_balance": total_balance,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_cash_flow": total_income - total_expense,
        "total_budget": total_budget,
        "total_spent": total_expense,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
    }


@router.get("/cash-flow")
def get_cash_flow(
    timeframe: Literal["daily", "weekly", "monthly", "yearly"] = Query(default="monthly"),
    months: int = Query(default=12, ge=1, le=24),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get cash flow data with dynamic time intervals.
    
    Args:
        timeframe: daily (last 7 days), weekly (last 8 weeks), monthly (last N months), yearly (YTD)
        months: Number of months for monthly/yearly view
    
    Returns:
        JSON with series data for chart rendering
    """
    today = date.today()
    series = []
    
    if timeframe == "daily":
        # Last 7 days - hourly aggregation
        for i in range(6, -1, -1):
            target_date = today - timedelta(days=i)
            start = datetime.combine(target_date, datetime.min.time())
            end = datetime.combine(target_date, datetime.max.time())
            
            income_query = db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "income",
                Transaction.date >= start.date(),
                Transaction.date <= end.date()
            )
            expense_query = db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "expense",
                Transaction.date >= start.date(),
                Transaction.date <= end.date()
            )
            
            if current_user:
                income_query = income_query.filter(Transaction.user_id == current_user.id)
                expense_query = expense_query.filter(Transaction.user_id == current_user.id)
            
            income = float(income_query.scalar() or 0)
            expense = float(expense_query.scalar() or 0)
            
            # Get day name
            day_name = DAY_LABELS[target_date.weekday()]
            label_x = f"{day_name}, {target_date.strftime('%d %b')}"
            
            series.append({
                "timestamp": target_date.isoformat(),
                "labelX": label_x,
                "totalIncome": income,
                "totalExpense": expense,
                "netSavings": income - expense,
                "breakdownExpense": get_category_breakdown(db, start.date(), end.date(), current_user.id if current_user else None)
            })
            
    elif timeframe == "weekly":
        # Last 8 weeks
        for i in range(7, -1, -1):
            week_start = today - timedelta(days=today.weekday() + 7 * i)
            week_end = week_start + timedelta(days=6)
            
            income_query = db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "income",
                Transaction.date >= week_start,
                Transaction.date <= week_end
            )
            expense_query = db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "expense",
                Transaction.date >= week_start,
                Transaction.date <= week_end
            )
            
            if current_user:
                income_query = income_query.filter(Transaction.user_id == current_user.id)
                expense_query = expense_query.filter(Transaction.user_id == current_user.id)
            
            income = float(income_query.scalar() or 0)
            expense = float(expense_query.scalar() or 0)
            
            label_x = f"W{i+1} ({week_start.strftime('%d %b')})"
            
            series.append({
                "timestamp": week_start.isoformat(),
                "labelX": label_x,
                "totalIncome": income,
                "totalExpense": expense,
                "netSavings": income - expense,
                "breakdownExpense": get_category_breakdown(db, week_start, week_end, current_user.id if current_user else None)
            })
            
    elif timeframe == "yearly":
        # Year to date - monthly aggregation
        year_start = date(today.year, 1, 1)
        for month in range(1, today.month + 1):
            start = date(today.year, month, 1)
            if month == 12:
                end = date(today.year + 1, 1, 1) - timedelta(days=1)
            else:
                end = date(today.year, month + 1, 1) - timedelta(days=1)
            
            income_query = db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "income",
                Transaction.date >= start,
                Transaction.date <= end
            )
            expense_query = db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "expense",
                Transaction.date >= start,
                Transaction.date <= end
            )
            
            if current_user:
                income_query = income_query.filter(Transaction.user_id == current_user.id)
                expense_query = expense_query.filter(Transaction.user_id == current_user.id)
            
            income = float(income_query.scalar() or 0)
            expense = float(expense_query.scalar() or 0)
            
            label_x = MONTH_LABELS[month]
            
            series.append({
                "timestamp": start.isoformat(),
                "labelX": label_x,
                "totalIncome": income,
                "totalExpense": expense,
                "netSavings": income - expense,
                "breakdownExpense": get_category_breakdown(db, start, end, current_user.id if current_user else None)
            })
            
    else:  # monthly (default)
        # Last N months
        for i in range(months - 1, -1, -1):
            target_month = today.month - i
            target_year = today.year
            while target_month <= 0:
                target_month += 12
                target_year -= 1
            
            start = date(target_year, target_month, 1)
            if target_month == 12:
                end = date(target_year + 1, 1, 1) - timedelta(days=1)
            else:
                end = date(target_year, target_month + 1, 1) - timedelta(days=1)
            
            income_query = db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "income",
                Transaction.date >= start,
                Transaction.date <= end
            )
            expense_query = db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "expense",
                Transaction.date >= start,
                Transaction.date <= end
            )
            
            if current_user:
                income_query = income_query.filter(Transaction.user_id == current_user.id)
                expense_query = expense_query.filter(Transaction.user_id == current_user.id)
            
            income = float(income_query.scalar() or 0)
            expense = float(expense_query.scalar() or 0)
            
            label_x = f"{MONTH_LABELS[target_month]} {target_year}"
            
            series.append({
                "timestamp": start.isoformat(),
                "labelX": label_x,
                "totalIncome": income,
                "totalExpense": expense,
                "netSavings": income - expense,
                "breakdownExpense": get_category_breakdown(db, start, end, current_user.id if current_user else None)
            })
    
    return {
        "status": "success",
        "meta": {
            "timeframe": timeframe,
            "dataPoints": len(series),
            "startDate": series[0]["timestamp"] if series else None,
            "endDate": series[-1]["timestamp"] if series else None,
        },
        "series": series,
        "chartConfig": {
            "xAxisLabel": "Periode",
            "yAxisLabel": "Jumlah (Rp)",
            "mode": "net_worth" if timeframe in ["monthly", "yearly"] else "delta"
        }
    }


@router.get("/category-breakdown")
def get_category_breakdown_api(
    type: str = Query(..., regex="^(income|expense)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get spending breakdown by category."""
    if not start_date:
        start_date, _ = get_current_month_range()
        end_date = end_date or date.today()
    
    query = db.query(
        Category.name,
        func.sum(Transaction.amount).label('total')
    ).join(Transaction, Category.id == Transaction.category_id).filter(
        Transaction.type == type,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )
    
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
    categories = query.group_by(Category.id, Category.name).all()
    
    return {
        "categories": [{"name": cat.name, "total": float(cat.total)} for cat in categories],
        "total": sum(float(cat.total) for cat in categories),
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
    }
