"""Budget API routes with multi-tenancy."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.services.currency_rules import assert_record_currency
from app.core.security import get_current_user_optional, get_current_user
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.models.user import User
from app.models.account import Account
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse
from app.services.calculation_service import calculation_service

router = APIRouter()
logger = logging.getLogger(__name__)

# Fix redirect to HTTPS
def _attach_budget_breakdown(db, user_id, budget, given_items):
    """
    Give a budget its lines.

    A budget can carry them from the request, and when it does not, the
    parts are worked out from the budget's own name and category. The
    numbers are an estimate, and they are marked as one.
    """
    try:
        from app.services.breakdown_service import set_breakdown

        if given_items:
            set_breakdown(
                db, user_id, "budget", budget.id, given_items, replace=True
            )
            return

        amount = float(budget.amount or 0)
        if amount <= 0:
            return

        from app.services.transaction_breakdown import expand_transaction

        name = budget.name or "Budget"
        expansion = expand_transaction(
            message=name,
            amount=amount,
            merchant=name,
        )
        lines = expansion.get("lines") or []
        if not lines:
            return

        set_breakdown(
            db,
            user_id,
            "budget",
            budget.id,
            [
                {
                    "name": line.get("name"),
                    "quantity": 1,
                    "unit_price": line.get("amount", 0),
                    "total_price": line.get("amount", 0),
                    "category": line.get("category"),
                    "kind": "expense",
                    "source": expansion.get("source", "template"),
                    "is_estimated": True,
                }
                for line in lines
            ],
            replace=True,
        )
    except Exception as exc:  # noqa: BLE001 - the budget still gets saved
        logger.warning("Could not attach the budget breakdown: %s", exc)

@router.get("", include_in_schema=False)
def redirect_to_slash():
    return RedirectResponse(url="/api/budgets/", status_code=308)

@router.get("/", response_model=List[dict])
def list_budgets(
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all budgets for current user WITH spent calculation."""
    query = db.query(Budget)
    if active_only:
        query = query.filter(Budget.is_active == True)
    
    if current_user:
        query = query.filter(Budget.user_id == current_user.id)
    
    budgets = query.all()
    result = []
    
    for budget in budgets:
        # Calculate actual spent in budget period
        spent_query = db.query(Transaction).filter(
            Transaction.type == "expense",
            Transaction.date >= budget.start_date,
        )
        
        if budget.user_id:
            spent_query = spent_query.filter(Transaction.user_id == budget.user_id)
        if budget.end_date:
            spent_query = spent_query.filter(Transaction.date <= budget.end_date)
        if budget.category_id:
            spent_query = spent_query.filter(Transaction.category_id == budget.category_id)
        if budget.account_id:
            spent_query = spent_query.filter(Transaction.account_id == budget.account_id)
        
        actual_spent = sum(t.amount for t in spent_query.all())
        
        # Calculate remaining and utilization
        remaining = float(budget.amount) - float(actual_spent)
        utilization = (float(actual_spent) / float(budget.amount) * 100) if budget.amount > 0 else 0
        
        budget_dict = {
            "id": budget.id,
            "name": budget.name,
            "amount": budget.amount,
            "spent": actual_spent,
            "remaining": remaining,
            "utilization": utilization,
            "start_date": budget.start_date,
            "end_date": budget.end_date,
            "category_id": budget.category_id,
            "account_id": budget.account_id,
            "is_active": budget.is_active,
            # The frontend and the schema call this field "period". The
            # old name is kept alongside it so a client that was
            # written against "period_type" still works.
            "period": budget.period,
            "period_type": budget.period,
        }
        result.append(budget_dict)
    
    return result


@router.get("/{budget_id}", response_model=BudgetResponse)
def get_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get budget by ID with ownership check."""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Ownership check
    if budget.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return budget


@router.post("/", response_model=BudgetResponse, status_code=201)
def create_budget(
    budget: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new budget."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    budget_data = budget.model_dump()
    budget_data["user_id"] = current_user.id

    # The start date is required by the database. A budget without one
    # starts at the beginning of the current period.
    if not budget_data.get("start_date"):
        from datetime import date as date_type

        today = date_type.today()
        if budget_data.get("period") == "weekly":
            budget_data["start_date"] = today - timedelta(days=today.weekday())
        elif budget_data.get("period") == "yearly":
            budget_data["start_date"] = date_type(today.year, 1, 1)
        else:
            budget_data["start_date"] = date_type(today.year, today.month, 1)

    # items steers the breakdown, it is not a column.
    budget_items = budget_data.pop("items", None)


    # A record lives in the currency of the account it belongs to. A
    # record that names a different currency is refused, so a goal in
    # dollars can never be counted against a rupiah account.
    if budget_data.get("account_id"):
        _account = db.query(Account).filter(Account.id == budget_data["account_id"]).first()
        if _account and _account.user_id == current_user.id:
            budget_data["currency"] = assert_record_currency(budget_data.get("currency"), _account)
    db_budget = Budget(**budget_data)
    db.add(db_budget)
    try:
        db.flush()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Data budget tidak valid: {exc}")

    # A budget is a pot of money. What it is meant for is worth showing,
    # so the parts can be read back with the budget.
    _attach_budget_breakdown(db, current_user.id, db_budget, budget_items)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"Could not create the budget: {exc}")
        raise HTTPException(
            status_code=400, detail=f"Data anggaran tidak valid: {exc}"
        )
    db.refresh(db_budget)
    return db_budget


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: int,
    budget: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update budget with ownership check."""
    db_budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not db_budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Ownership check
    if db_budget.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = budget.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_budget, key, value)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"Could not update the budget: {exc}")
        raise HTTPException(
            status_code=400, detail=f"Data anggaran tidak valid: {exc}"
        )
    db.refresh(db_budget)
    return db_budget


@router.delete("/{budget_id}", status_code=204)
def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete budget with ownership check."""
    db_budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not db_budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Ownership check
    if db_budget.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db_budget.is_active = False
    db.commit()
    return None


@router.get("/{budget_id}/progress")
def get_budget_progress(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get budget progress with calculations."""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Ownership check
    if budget.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate actual spending in budget period
    query = db.query(Transaction).filter(
        Transaction.type == "expense",
        Transaction.date >= budget.start_date
    )
    
    # Multi-tenancy filter
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
    if budget.end_date:
        query = query.filter(Transaction.date <= budget.end_date)
    if budget.category_id:
        query = query.filter(Transaction.category_id == budget.category_id)
    if budget.account_id:
        query = query.filter(Transaction.account_id == budget.account_id)
    
    actual_expense = sum(t.amount for t in query.all())
    
    # Calculate days elapsed
    today = date.today()
    start_date = budget.start_date
    end_date = budget.end_date or today
    
    if end_date > today:
        end_date = today
    
    days_elapsed = (end_date - start_date).days + 1
    total_days = (budget.end_date - budget.start_date).days + 1 if budget.end_date else 30
    
    # Use calculation service
    remaining = calculation_service.get_remaining_budget(budget.amount, actual_expense)
    utilization = calculation_service.get_budget_utilization(budget.amount, actual_expense)
    prorated = calculation_service.get_prorated_budget(budget.amount, total_days, days_elapsed)
    safe_limit = calculation_service.get_safe_daily_limit(remaining.value, total_days - days_elapsed)
    
    return {
        "budget_id": budget.id,
        "budget_name": budget.name,
        "budget_amount": budget.amount,
        "actual_spent": actual_expense,
        "remaining": remaining.value,
        "utilization_percent": utilization.value,
        "prorated_amount": prorated.value,
        "days_elapsed": days_elapsed,
        "days_remaining": total_days - days_elapsed,
        "safe_daily_limit": safe_limit.value,
        "status": "over" if remaining.value < 0 else "active"
    }


@router.post("/seed-defaults")
def seed_default_budgets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create default monthly budget template."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    from app.models.category import Category
    
    # Get expense categories for this user
    categories = db.query(Category).filter(
        Category.type == "expense",
        Category.is_active == True,
        Category.user_id == current_user.id
    ).all()
    
    created = []
    for cat in categories[:5]:
        existing = db.query(Budget).filter(
            Budget.category_id == cat.id,
            Budget.is_active == True,
            Budget.user_id == current_user.id
        ).first()
        if not existing:
            budget = Budget(
                name=f"Budget {cat.name}",
                period="monthly",
                amount=Decimal("0"),
                category_id=cat.id,
                start_date=date.today().replace(day=1),
                user_id=current_user.id
            )
            db.add(budget)
            created.append(cat.name)
    
    db.commit()
    return {"message": f"Created {len(created)} budget templates", "budgets": created}
