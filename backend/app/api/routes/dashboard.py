"""
Dashboard Cash Flow API - Dynamic Timeframe dengan Granularity
Implementasi Stockbit-style untuk Financial Dashboard
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional, Literal, Dict, List
from datetime import date, datetime, timedelta
from decimal import Decimal
from calendar import month_abbr

from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.category import Category
from app.models.user import User

router = APIRouter()

# Constants
MONTH_LABELS = {i: month_abbr[i] for i in range(1, 13)}
DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

# Granularity configs
GRANULARITY_CONFIG = {
    '1D': {'granularity': 'hourly', 'max_points': 24},
    '1W': {'granularity': 'daily', 'max_points': 7},
    '1M': {'granularity': 'daily', 'max_points': 30},
    '3M': {'granularity': 'weekly', 'max_points': 13},
    'YTD': {'granularity': 'monthly', 'max_points': 12},
    '1Y': {'granularity': 'monthly', 'max_points': 12},
    '3Y': {'granularity': 'monthly', 'max_points': 36},
    '5Y': {'granularity': 'monthly', 'max_points': 60},
}


def format_currency_short(value: float) -> str:
    """Format currency for display."""
    if value >= 1_000_000_000:
        return f"Rp {value / 1_000_000_000:.1f}B"
    elif value >= 1_000_000:
        return f"Rp {value / 1_000_000:.1f}M"
    elif value >= 1_000:
        return f"Rp {value / 1_000:.0f}K"
    return f"Rp {value:,.0f}"


def get_date_range(timeframe: str) -> tuple:
    """Calculate start and end dates based on timeframe."""
    today = date.today()
    
    ranges = {
        '1D': (today - timedelta(days=1), today),
        '1W': (today - timedelta(days=7), today),
        '1M': (today - timedelta(days=30), today),
        '3M': (today - timedelta(days=90), today),
        'YTD': (date(today.year, 1, 1), today),
        '1Y': (today - timedelta(days=365), today),
        '3Y': (today - timedelta(days=365 * 3), today),
        '5Y': (today - timedelta(days=365 * 5), today),
    }
    
    return ranges.get(timeframe, (today - timedelta(days=90), today))


def get_category_breakdown_by_date(
    db: Session, 
    start: date, 
    end: date, 
    tx_type: str,
    user_id: Optional[int] = None
) -> Dict[str, float]:
    """Get category breakdown for a date range."""
    query = db.query(
        Category.name,
        func.sum(Transaction.amount).label('total')
    ).join(Transaction, Category.id == Transaction.category_id).filter(
        Transaction.type == tx_type,
        Transaction.date >= start,
        Transaction.date <= end
    )
    
    if user_id:
        query = query.filter(Transaction.user_id == user_id)
    
    results = query.group_by(Category.name).all()
    return {row.name: float(row.total) for row in results}


def get_totals_by_date(
    db: Session,
    start: date,
    end: date,
    user_id: Optional[int] = None,
    account_id: Optional[int] = None
) -> Dict:
    """Get income and expense totals for a date range."""
    base_filter = [
        Transaction.date >= start,
        Transaction.date <= end
    ]
    
    if user_id:
        base_filter.append(Transaction.user_id == user_id)
    
    if account_id:
        base_filter.append(Transaction.account_id == account_id)
    
    # Income
    income_query = db.query(
        func.sum(Transaction.amount).label('total')
    ).filter(*base_filter, Transaction.type == 'income')
    total_income = float(income_query.scalar() or 0)
    
    # Expense
    expense_query = db.query(
        func.sum(Transaction.amount).label('total')
    ).filter(*base_filter, Transaction.type == 'expense')
    total_expense = float(expense_query.scalar() or 0)
    
    return {
        'totalIncome': total_income,
        'totalExpense': total_expense,
        'netSavings': total_income - total_expense
    }


@router.get("/cash-flow")
def get_cash_flow(
    timeframe: Literal["1D", "1W", "1M", "3M", "YTD", "1Y", "3Y", "5Y"] = Query(default="3M"),
    account_id: Optional[int] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get cash flow data with dynamic timeframe and granularity.
    
    Timeframes:
    - 1D: 1 Day (hourly)
    - 1W: 1 Week (daily)
    - 1M: 1 Month (daily)
    - 3M: 3 Months (weekly)
    - YTD: Year to Date (monthly)
    - 1Y: 1 Year (monthly)
    - 3Y: 3 Years (monthly)
    - 5Y: 5 Years (monthly)
    
    Args:
        timeframe: Time period selection
        account_id: Filter by specific account (null = all accounts)
        start_date: Custom start date (optional)
        end_date: Custom end date (optional)
    """
    
    # Determine date range
    if start_date and end_date:
        start = start_date
        end = end_date
    else:
        start, end = get_date_range(timeframe)
    
    granularity = GRANULARITY_CONFIG[timeframe]['granularity']
    user_id = current_user.id if current_user else None
    
    series = []
    running_balance = 0
    
    # Build base query filter
    base_filter = [
        Transaction.date >= start,
        Transaction.date <= end
    ]
    
    if user_id:
        base_filter.append(Transaction.user_id == user_id)
    
    if account_id:
        base_filter.append(Transaction.account_id == account_id)
    
    # Generate time periods based on granularity
    if granularity == 'hourly':
        # For 1D - hourly breakdown
        current = datetime.combine(start, datetime.min.time())
        end_dt = datetime.combine(end, datetime.max.time())
        
        while current <= end_dt:
            hour_start = current.date()
            hour_end = min(hour_start, end)
            
            totals = get_totals_by_date(db, hour_start, hour_end, user_id, account_id)
            income_by_cat = get_category_breakdown_by_date(db, hour_start, hour_end, 'income', user_id)
            expense_by_cat = get_category_breakdown_by_date(db, hour_start, hour_end, 'expense', user_id)
            
            running_balance += totals['netSavings']
            
            series.append({
                "timestamp": hour_start.isoformat(),
                "labelX": current.strftime("%H:%M"),
                "labelXShort": current.strftime("%H:%M"),
                "labelXFull": current.strftime("%d %b %Y, %H:%M"),
                "granularity": "hourly",
                "totalIncome": totals['totalIncome'],
                "incomeByCategory": income_by_cat,
                "totalExpense": totals['totalExpense'],
                "expenseByCategory": expense_by_cat,
                "netSavings": totals['netSavings'],
                "runningBalance": running_balance,
                "isPositiveMonth": totals['netSavings'] >= 0,
            })
            
            current += timedelta(hours=1)
    
    elif granularity == 'daily':
        # For 1W, 1M - daily breakdown
        current = start
        while current <= end:
            totals = get_totals_by_date(db, current, current, user_id, account_id)
            income_by_cat = get_category_breakdown_by_date(db, current, current, 'income', user_id)
            expense_by_cat = get_category_breakdown_by_date(db, current, current, 'expense', user_id)
            
            running_balance += totals['netSavings']
            day_name = DAY_NAMES[current.weekday()]
            
            # Find highest expense category
            highest_exp_cat = max(expense_by_cat.items(), key=lambda x: x[1]) if expense_by_cat else (None, 0)
            
            series.append({
                "timestamp": current.isoformat(),
                "labelX": f"{day_name}, {current.strftime('%d %b')}",
                "labelXShort": current.strftime("%d/%m"),
                "labelXFull": f"{DAY_NAMES[current.weekday()]}, {current.strftime('%d %B %Y')}",
                "granularity": "daily",
                "totalIncome": totals['totalIncome'],
                "incomeByCategory": income_by_cat,
                "totalExpense": totals['totalExpense'],
                "expenseByCategory": expense_by_cat,
                "netSavings": totals['netSavings'],
                "runningBalance": running_balance,
                "isPositiveMonth": totals['netSavings'] >= 0,
                "highestExpenseCategory": highest_exp_cat[0],
                "highestExpenseAmount": highest_exp_cat[1],
            })
            
            current += timedelta(days=1)
    
    elif granularity == 'weekly':
        # For 3M - weekly breakdown
        current = start
        while current <= end:
            week_end = min(current + timedelta(days=6), end)
            
            totals = get_totals_by_date(db, current, week_end, user_id, account_id)
            income_by_cat = get_category_breakdown_by_date(db, current, week_end, 'income', user_id)
            expense_by_cat = get_category_breakdown_by_date(db, current, week_end, 'expense', user_id)
            
            running_balance += totals['netSavings']
            
            highest_exp_cat = max(expense_by_cat.items(), key=lambda x: x[1]) if expense_by_cat else (None, 0)
            
            series.append({
                "timestamp": current.isoformat(),
                "labelX": f"{current.strftime('%d %b')} - {week_end.strftime('%d %b')}",
                "labelXShort": f"{current.strftime('%d/%m')}",
                "labelXFull": f"{current.strftime('%d %B %Y')} - {week_end.strftime('%d %B %Y')}",
                "granularity": "weekly",
                "totalIncome": totals['totalIncome'],
                "incomeByCategory": income_by_cat,
                "totalExpense": totals['totalExpense'],
                "expenseByCategory": expense_by_cat,
                "netSavings": totals['netSavings'],
                "runningBalance": running_balance,
                "isPositiveMonth": totals['netSavings'] >= 0,
                "highestExpenseCategory": highest_exp_cat[0],
                "highestExpenseAmount": highest_exp_cat[1],
            })
            
            current += timedelta(days=7)
    
    elif granularity == 'monthly':
        # For YTD, 1Y, 3Y, 5Y - monthly breakdown
        current_month = start.month
        current_year = start.year
        
        while (current_year < end.year or 
               (current_year == end.year and current_month <= end.month)):
            
            month_start = date(current_year, current_month, 1)
            if current_month == 12:
                month_end = date(current_year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(current_year, current_month + 1, 1) - timedelta(days=1)
            
            # Don't go past end date
            if month_start < start:
                month_start = start
            if month_end > end:
                month_end = end
            
            totals = get_totals_by_date(db, month_start, month_end, user_id, account_id)
            income_by_cat = get_category_breakdown_by_date(db, month_start, month_end, 'income', user_id)
            expense_by_cat = get_category_breakdown_by_date(db, month_start, month_end, 'expense', user_id)
            
            running_balance += totals['netSavings']
            
            highest_exp_cat = max(expense_by_cat.items(), key=lambda x: x[1]) if expense_by_cat else (None, 0)
            
            series.append({
                "timestamp": month_start.isoformat(),
                "labelX": f"{MONTH_LABELS[current_month]}",
                "labelXShort": MONTH_LABELS[current_month],
                "labelXFull": f"{MONTH_LABELS[current_month]} {current_year}",
                "granularity": "monthly",
                "totalIncome": totals['totalIncome'],
                "incomeByCategory": income_by_cat,
                "totalExpense": totals['totalExpense'],
                "expenseByCategory": expense_by_cat,
                "netSavings": totals['netSavings'],
                "runningBalance": running_balance,
                "isPositiveMonth": totals['netSavings'] >= 0,
                "highestExpenseCategory": highest_exp_cat[0],
                "highestExpenseAmount": highest_exp_cat[1],
            })
            
            current_month += 1
            if current_month > 12:
                current_month = 1
                current_year += 1
    
    # Calculate totals
    total_income = sum(s['totalIncome'] for s in series)
    total_expense = sum(s['totalExpense'] for s in series)
    net_savings = total_income - total_expense
    
    # Calculate period (in days)
    period_days = (end - start).days + 1 if start and end else 1
    avg_daily_income = total_income / period_days if period_days > 0 else 0
    avg_daily_expense = total_expense / period_days if period_days > 0 else 0
    
    # Category summary
    all_income_cats = {}
    all_expense_cats = {}
    
    for s in series:
        for cat, amount in s.get('incomeByCategory', {}).items():
            all_income_cats[cat] = all_income_cats.get(cat, 0) + amount
        for cat, amount in s.get('expenseByCategory', {}).items():
            all_expense_cats[cat] = all_expense_cats.get(cat, 0) + amount
    
    # Convert to percentage
    category_summary = {
        'income': {
            cat: {
                'total': amount,
                'percentage': round((amount / total_income * 100) if total_income > 0 else 0, 1)
            }
            for cat, amount in all_income_cats.items()
        },
        'expense': {
            cat: {
                'total': amount,
                'percentage': round((amount / total_expense * 100) if total_expense > 0 else 0, 1)
            }
            for cat, amount in all_expense_cats.items()
        }
    }
    
    # Sort by total
    category_summary['income'] = dict(sorted(
        category_summary['income'].items(),
        key=lambda x: x[1]['total'],
        reverse=True
    ))
    category_summary['expense'] = dict(sorted(
        category_summary['expense'].items(),
        key=lambda x: x[1]['total'],
        reverse=True
    ))
    
    return {
        "status": "success",
        "meta": {
            "timeframe": timeframe,
            "account_id": account_id if account_id else "all",
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "granularity": granularity,
            "totalDataPoints": len(series),
            "totalIncome": total_income,
            "totalExpense": total_expense,
            "netSavings": net_savings,
            "averageDailyIncome": round(avg_daily_income, 0),
            "averageDailyExpense": round(avg_daily_expense, 0),
            "periodDays": period_days,
        },
        "series": series,
        "categorySummary": category_summary,
        "chartConfig": {
            "mode": "cash_flow",
            "showArea": granularity in ['weekly', 'monthly'],
            "positiveColor": "#22c55e",
            "negativeColor": "#ef4444",
            "neutralColor": "#3b82f6",
            "yAxisFormat": "currency",
            "xAxisFormat": "date",
            "suggestedMaxLabels": GRANULARITY_CONFIG[timeframe]['max_points'],
        }
    }


@router.get("/accounts")
def get_accounts_for_filter(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get all accounts for filter dropdown."""
    query = db.query(Account).filter(Account.is_active == True)
    
    if current_user:
        query = query.filter(Account.user_id == current_user.id)
    
    accounts = query.all()
    
    return {
        "accounts": [
            {
                "id": acc.id,
                "name": acc.name,
                "balance": float(acc.balance or 0),
                "currency": acc.currency or "IDR",
                "type": acc.type,
            }
            for acc in accounts
        ],
        "total": len(accounts)
    }
