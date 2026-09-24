"""Transfer API routes with multi-tenancy."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user_optional, get_current_user
from app.models.transfer import Transfer
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.user import User
from app.schemas.transfer import TransferCreate, TransferUpdate, TransferResponse, TransferWithTransactions

router = APIRouter()


@router.post("/", response_model=TransferWithTransactions, status_code=201)
def create_transfer(
    transfer: TransferCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a transfer between two accounts."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Validate accounts
    from_account = db.query(Account).filter(Account.id == transfer.from_account_id).first()
    if not from_account:
        raise HTTPException(status_code=404, detail="Source account not found")
    
    to_account = db.query(Account).filter(Account.id == transfer.to_account_id).first()
    if not to_account:
        raise HTTPException(status_code=404, detail="Destination account not found")
    
    # Account ownership check
    if from_account.user_id != current_user.id or to_account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot transfer from another user's account")
    
    if transfer.from_account_id == transfer.to_account_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")
    
    # Create transfer record
    db_transfer = Transfer(
        amount=transfer.amount,
        currency=transfer.currency,
        date=transfer.date,
        description=transfer.description,
        notes=transfer.notes,
        from_account_id=transfer.from_account_id,
        to_account_id=transfer.to_account_id,
        user_id=current_user.id,
    )
    db.add(db_transfer)
    db.flush()
    
    # Create transfer_out transaction
    tx_out = Transaction(
        type="transfer_out",
        amount=transfer.amount,
        currency=transfer.currency,
        date=transfer.date,
        description=transfer.description or f"Transfer to {to_account.name}",
        account_id=transfer.from_account_id,
        transfer_id=db_transfer.id,
        user_id=current_user.id,
    )
    db.add(tx_out)
    
    # Update source account balance
    from_account.balance -= transfer.amount
    
    # Create transfer_in transaction
    tx_in = Transaction(
        type="transfer_in",
        amount=transfer.amount,
        currency=transfer.currency,
        date=transfer.date,
        description=transfer.description or f"Transfer from {from_account.name}",
        account_id=transfer.to_account_id,
        transfer_id=db_transfer.id,
        transfer_to_transaction_id=tx_out.id,
        user_id=current_user.id,
    )
    db.add(tx_in)
    
    # Update destination account balance
    to_account.balance += transfer.amount
    
    db.commit()
    db.refresh(db_transfer)
    
    return TransferWithTransactions(
        id=db_transfer.id,
        amount=db_transfer.amount,
        currency=db_transfer.currency,
        date=db_transfer.date,
        description=db_transfer.description,
        notes=db_transfer.notes,
        from_account_id=db_transfer.from_account_id,
        to_account_id=db_transfer.to_account_id,
        created_at=db_transfer.created_at,
        updated_at=db_transfer.updated_at,
        from_transaction_id=tx_out.id,
        to_transaction_id=tx_in.id,
    )


@router.get("/", response_model=List[TransferWithTransactions])
def list_transfers(
    skip: int = 0,
    limit: int = 100,
    start_date: date = None,
    end_date: date = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all transfers for current user."""
    query = db.query(Transfer)
    
    if current_user:
        query = query.filter(Transfer.user_id == current_user.id)
    
    if start_date:
        query = query.filter(Transfer.date >= start_date)
    if end_date:
        query = query.filter(Transfer.date <= end_date)
    
    transfers = query.order_by(Transfer.date.desc()).offset(skip).limit(limit).all()
    
    result = []
    for t in transfers:
        tx_out = db.query(Transaction).filter(
            Transaction.transfer_id == t.id,
            Transaction.type == "transfer_out"
        ).first()
        tx_in = db.query(Transaction).filter(
            Transaction.transfer_id == t.id,
            Transaction.type == "transfer_in"
        ).first()
        
        result.append(TransferWithTransactions(
            id=t.id,
            amount=t.amount,
            currency=t.currency,
            date=t.date,
            description=t.description,
            notes=t.notes,
            from_account_id=t.from_account_id,
            to_account_id=t.to_account_id,
            created_at=t.created_at,
            updated_at=t.updated_at,
            from_transaction_id=tx_out.id if tx_out else None,
            to_transaction_id=tx_in.id if tx_in else None,
        ))
    
    return result


@router.get("/{transfer_id}", response_model=TransferWithTransactions)
def get_transfer(
    transfer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single transfer by ID."""
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # Ownership check
    if transfer.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    tx_out = db.query(Transaction).filter(
        Transaction.transfer_id == transfer.id,
        Transaction.type == "transfer_out"
    ).first()
    tx_in = db.query(Transaction).filter(
        Transaction.transfer_id == transfer.id,
        Transaction.type == "transfer_in"
    ).first()
    
    return TransferWithTransactions(
        id=transfer.id,
        amount=transfer.amount,
        currency=transfer.currency,
        date=transfer.date,
        description=transfer.description,
        notes=transfer.notes,
        from_account_id=transfer.from_account_id,
        to_account_id=transfer.to_account_id,
        created_at=transfer.created_at,
        updated_at=transfer.updated_at,
        from_transaction_id=tx_out.id if tx_out else None,
        to_transaction_id=tx_in.id if tx_in else None,
    )


@router.delete("/{transfer_id}", status_code=204)
def delete_transfer(
    transfer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a transfer with ownership check."""
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # Ownership check
    if transfer.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get linked transactions
    tx_out = db.query(Transaction).filter(
        Transaction.transfer_id == transfer.id,
        Transaction.type == "transfer_out"
    ).first()
    tx_in = db.query(Transaction).filter(
        Transaction.transfer_id == transfer.id,
        Transaction.type == "transfer_in"
    ).first()
    
    # Reverse balance changes
    from_account = db.query(Account).filter(Account.id == transfer.from_account_id).first()
    to_account = db.query(Account).filter(Account.id == transfer.to_account_id).first()
    
    if from_account:
        from_account.balance += transfer.amount
    if to_account:
        to_account.balance -= transfer.amount
    
    if tx_out:
        tx_out.is_deleted = True
    if tx_in:
        tx_in.is_deleted = True
    
    db.delete(transfer)
    db.commit()
    return None


@router.get("/summary/total")
def get_transfer_summary(
    start_date: date = None,
    end_date: date = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transfer summary for a period."""
    query = db.query(Transfer)
    
    if current_user:
        query = query.filter(Transfer.user_id == current_user.id)
    
    if start_date:
        query = query.filter(Transfer.date >= start_date)
    if end_date:
        query.filter(Transfer.date <= end_date)
    
    transfers = query.all()
    
    total_out = sum(t.amount for t in transfers)
    
    return {
        "total_transfers": len(transfers),
        "total_transferred_out": total_out,
        "total_transferred_in": total_out,
        "period": {"start": start_date, "end": end_date}
    }
