"""Transaction API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from decimal import Decimal

from app.core.database import get_db
from app.models.transaction import Transaction
from app.models.account import Account
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse

router = APIRouter()


@router.get("/", response_model=List[TransactionResponse])
def list_transactions(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = None,
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    
    if type:
        query = query.filter(Transaction.type == type)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    return query.order_by(Transaction.date.desc()).offset(skip).limit(limit).all()


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(transaction: TransactionCreate, db: Session = Depends(get_db)):
    # Verify account exists
    account = db.query(Account).filter(Account.id == transaction.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    db_transaction = Transaction(**transaction.model_dump())
    
    # Update account balance
    if transaction.type == "income":
        account.balance += transaction.amount
    else:
        account.balance -= transaction.amount
    
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int, 
    transaction: TransactionUpdate, 
    db: Session = Depends(get_db)
):
    db_transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = transaction.model_dump(exclude_unset=True)
    
    # If amount changes, adjust account balance
    old_amount = db_transaction.amount
    old_type = db_transaction.type
    
    for key, value in update_data.items():
        setattr(db_transaction, key, value)
    
    # Update account balance if amount changed
    if "amount" in update_data or "type" in update_data:
        # Reverse old transaction
        account = db.query(Account).filter(Account.id == db_transaction.account_id).first()
        if old_type == "income":
            account.balance -= old_amount
        else:
            account.balance += old_amount
        
        # Apply new transaction
        if db_transaction.type == "income":
            account.balance += db_transaction.amount
        else:
            account.balance -= db_transaction.amount
    
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    db_transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Reverse the balance change
    account = db.query(Account).filter(Account.id == db_transaction.account_id).first()
    if db_transaction.type == "income":
        account.balance -= db_transaction.amount
    else:
        account.balance += db_transaction.amount
    
    db.delete(db_transaction)
    db.commit()
    return None


@router.get("/summary/by-period")
def get_transactions_by_period(
    start_date: date,
    end_date: date,
    group_by: str = "day",
    db: Session = Depends(get_db)
):
    """Get transaction summary grouped by period."""
    transactions = db.query(Transaction).filter(
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).all()
    
    summary = {"income": Decimal("0"), "expense": Decimal("0")}
    daily_data = {}
    
    for t in transactions:
        if t.type == "income":
            summary["income"] += t.amount
        else:
            summary["expense"] += t.amount
        
        # Group by date
        date_key = str(t.date)
        if date_key not in daily_data:
            daily_data[date_key] = {"income": Decimal("0"), "expense": Decimal("0")}
        
        if t.type == "income":
            daily_data[date_key]["income"] += t.amount
        else:
            daily_data[date_key]["expense"] += t.amount
    
    return {
        "period": {"start": start_date, "end": end_date},
        "summary": summary,
        "daily": daily_data,
        "net": summary["income"] - summary["expense"]
    }


@router.get("/summary/by-category")
def get_transactions_by_category(
    start_date: date,
    end_date: date,
    type: str,
    db: Session = Depends(get_db)
):
    """Get transaction summary grouped by category."""
    from app.models.category import Category
    
    transactions = db.query(Transaction).join(Category).filter(
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == type
    ).all()
    
    category_totals = {}
    for t in transactions:
        cat_name = t.category.name if t.category else "Uncategorized"
        if cat_name not in category_totals:
            category_totals[cat_name] = Decimal("0")
        category_totals[cat_name] += t.amount
    
    return {
        "period": {"start": start_date, "end": end_date},
        "type": type,
        "by_category": category_totals
    }
