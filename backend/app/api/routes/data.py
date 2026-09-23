"""Data export routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.debt import Debt

router = APIRouter(prefix="/data", tags=["Data"])


@router.get("/export")
def export_data(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Export all user data as JSON."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = current_user.id
    
    # Get all user data
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    categories = db.query(Category).filter(Category.user_id == user_id).all()
    transactions = db.query(Transaction).filter(Transaction.user_id == user_id).all()
    budgets = db.query(Budget).filter(Budget.user_id == user_id).all()
    goals = db.query(Goal).filter(Goal.user_id == user_id).all()
    debts = db.query(Debt).filter(Debt.user_id == user_id).all()
    
    # Format export data
    export = {
        "exported_at": datetime.utcnow().isoformat(),
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "default_currency": current_user.default_currency,
        },
        "accounts": [
            {
                "id": a.id,
                "name": a.name,
                "type": a.account_type,
                "balance": float(a.balance),
                "currency": a.currency,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in accounts
        ],
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "icon": c.icon,
                "color": c.color,
                "is_active": c.is_active,
            }
            for c in categories
        ],
        "transactions": [
            {
                "id": t.id,
                "type": t.type,
                "amount": float(t.amount),
                "currency": t.currency,
                "description": t.description,
                "date": t.date.isoformat() if t.date else None,
                "account_id": t.account_id,
                "category_id": t.category_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transactions
        ],
        "budgets": [
            {
                "id": b.id,
                "name": b.name,
                "amount": float(b.amount),
                "period": b.period,
                "start_date": b.start_date.isoformat() if b.start_date else None,
                "end_date": b.end_date.isoformat() if b.end_date else None,
                "is_active": b.is_active,
            }
            for b in budgets
        ],
        "goals": [
            {
                "id": g.id,
                "name": g.name,
                "target_amount": float(g.target_amount),
                "current_amount": float(g.current_amount),
                "target_date": g.target_date.isoformat() if g.target_date else None,
                "goal_type": g.goal_type,
                "is_completed": g.is_completed,
            }
            for g in goals
        ],
        "debts": [
            {
                "id": d.id,
                "name": d.name,
                "principal": float(d.principal),
                "current_balance": float(d.current_balance),
                "interest_rate": float(d.interest_rate),
                "tenor_months": d.tenor_months,
                "monthly_payment": float(d.monthly_payment) if d.monthly_payment else None,
                "is_paid_off": d.is_paid_off,
            }
            for d in debts
        ],
        "summary": {
            "total_accounts": len(accounts),
            "total_transactions": len(transactions),
            "total_budgets": len(budgets),
            "total_goals": len(goals),
            "total_debts": len(debts),
        }
    }
    
    return export


@router.get("/export/csv")
def export_transactions_csv(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Export transactions as CSV format."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(Transaction.date.desc()).all()
    
    # Generate CSV
    csv_lines = ["Date,Type,Amount,Currency,Description,Account,Category"]
    
    for t in transactions:
        account = db.query(Account).filter(Account.id == t.account_id).first()
        category = db.query(Category).filter(Category.id == t.category_id).first()
        
        line = f"{t.date},{t.type},{t.amount},{t.currency},{t.description or ''},{account.name if account else ''},{category.name if category else ''}"
        csv_lines.append(line)
    
    csv_content = "\n".join(csv_lines)
    
    return {
        "filename": f"finmanager_transactions_{datetime.utcnow().strftime('%Y%m%d')}.csv",
        "content": csv_content,
    }


@router.delete("/delete-all")
def delete_all_user_data(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Delete ALL user data. This action is irreversible."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = current_user.id
    
    # Delete in order (respecting foreign keys)
    # 1. Delete transactions first (they reference accounts)
    db.query(Transaction).filter(Transaction.user_id == user_id).delete(synchronize_session=False)
    
    # 2. Delete budgets
    db.query(Budget).filter(Budget.user_id == user_id).delete(synchronize_session=False)
    
    # 3. Delete goals
    db.query(Goal).filter(Goal.user_id == user_id).delete(synchronize_session=False)
    
    # 4. Delete debts
    db.query(Debt).filter(Debt.user_id == user_id).delete(synchronize_session=False)
    
    # 5. Delete accounts (balances will be lost)
    db.query(Account).filter(Account.user_id == user_id).delete(synchronize_session=False)
    
    # 6. Delete categories (only user-created ones, not defaults)
    db.query(Category).filter(
        Category.user_id == user_id,
        Category.is_default == False
    ).delete(synchronize_session=False)
    
    db.commit()
    
    return {"message": "All user data has been deleted successfully"}
