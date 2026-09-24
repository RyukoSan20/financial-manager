"""Budget API routes with multi-tenancy."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user_optional, get_current_user
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse
from app.services.calculation_service import calculation_service

router = APIRouter()


@router.get("/", response_model=List[BudgetResponse])
def list_budgets(
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all budgets for current user."""
    query = db.query(Budget)
    if active_only:
        query = query.filter(Budget.is_active == True)
    
    if current_user:
        query = query.filter(Budget.user_id == current_user.id)
    
    return query.all()


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
    
    db_budget = Budget(**budget_data)
    db.add(db_budget)
    db.commit()
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
    
    db.commit()
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
