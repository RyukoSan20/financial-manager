"""Dashboard API routes with multi-tenancy."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.user import User
from app.services.calculation_service import calculation_service

router = APIRouter()


def get_current_month_range():
    """Get start and end of current month."""
    today = date.today()
    start = today.replace(day=1)
    if today.month == 12:
        end = today.replace(month=12, day=31)
    else:
        end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
    return start, end


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
    accounts = account_query.all()
    total_balance = sum(a.balance for a in accounts)
    
    # Get income/expense for period
    income_query = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == "income",
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )
    expense_query = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == "expense",
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )
    
    if current_user:
        income_query = income_query.filter(Transaction.user_id == current_user.id)
        expense_query = expense_query.filter(Transaction.user_id == current_user.id)
    
    total_income = income_query.scalar() or Decimal("0")
    total_expense = expense_query.scalar() or Decimal("0")
    
    # Get budget info
    budget_query = db.query(Budget).filter(Budget.is_active == True)
    if current_user:
        budget_query = budget_query.filter(Budget.user_id == current_user.id)
    budgets = budget_query.all()
    total_budget = sum(b.amount for b in budgets)
    
    # Calculate spending within budget periods
    total_spent = Decimal("0")
    for budget in budgets:
        query = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "expense",
            Transaction.date >= budget.start_date,
        )
        if current_user:
            query = query.filter(Transaction.user_id == current_user.id)
        if budget.account_id:
            query = query.filter(Transaction.account_id == budget.account_id)
        if budget.category_id:
            query = query.filter(Transaction.category_id == budget.category_id)
        if budget.end_date:
            query = query.filter(Transaction.date <= budget.end_date)
        
        spent = query.scalar() or Decimal("0")
        total_spent += min(spent, budget.amount)
    
    # Calculate days
    today = date.today()
    days_in_period = (end_date - start_date).days + 1
    days_elapsed = (min(today, end_date) - start_date).days + 1
    
    # Use calculation service for all metrics
    metrics = calculation_service.get_dashboard_metrics(
        total_balance=total_balance,
        total_income=total_income,
        total_expense=total_expense,
        total_budget=total_budget,
        total_spent=total_spent,
        days_elapsed=days_elapsed,
        days_in_period=days_in_period
    )
    
    # Get expense breakdown by category
    expense_by_category = {}
    expense_query = db.query(
        Category.name,
        func.sum(Transaction.amount).label("total")
    ).join(Transaction).filter(
        Transaction.type == "expense",
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )
    if current_user:
        expense_query = expense_query.filter(Transaction.user_id == current_user.id)
    expense_transactions = expense_query.group_by(Category.name).all()
    
    for cat_name, total in expense_transactions:
        expense_by_category[cat_name] = total
    
    # Get income breakdown by category
    income_by_category = {}
    income_query = db.query(
        Category.name,
        func.sum(Transaction.amount).label("total")
    ).join(Transaction).filter(
        Transaction.type == "income",
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )
    if current_user:
        income_query = income_query.filter(Transaction.user_id == current_user.id)
    income_transactions = income_query.group_by(Category.name).all()
    
    for cat_name, total in income_transactions:
        income_by_category[cat_name] = total
    
    return {
        **metrics,
        "period": {"start": start_date, "end": end_date},
        "expense_by_category": expense_by_category,
        "income_by_category": income_by_category,
        "account_count": len(accounts)
    }


@router.get("/cash-flow")
def get_cash_flow(
    months: int = Query(default=6, ge=1, le=24),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get cash flow trend for last N months."""
    today = date.today()
    monthly_data = []
    
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
        
        income = income_query.scalar() or Decimal("0")
        expense = expense_query.scalar() or Decimal("0")
        
        monthly_data.append({
            "month": start.strftime("%Y-%m"),
            "income": income,
            "expense": expense,
            "net": income - expense
        })
    
    return {"monthly": monthly_data}


@router.get("/category-breakdown")
def get_category_breakdown(
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
        Category,
        func.sum(Transaction.amount).label("total")
    ).join(Transaction, Category.id == Transaction.category_id).filter(
        Transaction.type == type,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )
    
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
    categories = query.group_by(Category.id).all()
    
    total = sum(cat[1] for cat in categories)
    
    breakdown = []
    for category, total_amount in categories:
        percentage = (total_amount / total * 100) if total > 0 else 0
        breakdown.append({
            "id": category.id,
            "name": category.name,
            "icon": category.icon,
            "color": category.color,
            "amount": total_amount,
            "percentage": round(float(percentage), 2)
        })
    
    breakdown.sort(key=lambda x: x["amount"], reverse=True)
    
    return {
        "type": type,
        "period": {"start": start_date, "end": end_date},
        "total": total,
        "categories": breakdown
    }
