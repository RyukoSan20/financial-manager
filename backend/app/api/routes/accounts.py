"""Account API routes with multi-tenancy."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse

router = APIRouter()


@router.get("/", response_model=List[AccountResponse])
def list_accounts(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get all accounts for current user (or all if not authenticated)."""
    query = db.query(Account)
    if current_user:
        query = query.filter(Account.user_id == current_user.id)
    accounts = query.offset(skip).limit(limit).all()
    return accounts


@router.get("/summary/total-balance")
def get_total_balance(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get total balance across all active accounts for current user."""
    query = db.query(Account).filter(Account.is_active == True)
    if current_user:
        query = query.filter(Account.user_id == current_user.id)
    accounts = query.all()
    total = sum(a.balance for a in accounts)
    return {"total_balance": total, "currency": "IDR", "account_count": len(accounts)}


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get account by ID with ownership check."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Ownership check
    if current_user and account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return account


@router.post("/", response_model=AccountResponse, status_code=201)
def create_account(
    account: AccountCreate,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Create new account."""
    account_data = account.model_dump()
    
    # Assign user_id if authenticated
    if current_user:
        account_data["user_id"] = current_user.id
    
    db_account = Account(**account_data)
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    account: AccountUpdate,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Update account with ownership check."""
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Ownership check
    if current_user and db_account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = account.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_account, key, value)
    
    db.commit()
    db.refresh(db_account)
    return db_account


@router.delete("/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Delete account with ownership check."""
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Ownership check
    if current_user and db_account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(db_account)
    db.commit()
    return None
