"""Enterprise Feed & Review API Routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.transaction import Transaction
from app.models.transaction_item import TransactionItem
from app.models.account import Account
from app.models.category import Category
from app.schemas.feed import (
    ScanReceiptRequest,
    ScanReceiptResponse,
    FeedItemResponse,
    ApproveRejectRequest,
    FeedStatsResponse,
    ParsedReceiptData,
    TransactionItemResponse,
)
from app.services.receipt_parser import parse_receipt_sync

router = APIRouter(prefix="/api/feed", tags=["Feed & Review"])


@router.post("/scan-receipt", response_model=ScanReceiptResponse)
async def scan_receipt(
    request: ScanReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Scan receipt image and create pending transaction.
    
    Accepts base64 encoded image, sends to Gemini 1.5 Flash,
    and creates transaction with status 'pending' for review.
    """
    # Validate account if provided
    account_id = request.account_id
    if not account_id:
        # Use first active account
        account = db.query(Account).filter(
            Account.user_id == current_user.id,
            Account.is_active == True
        ).first()
        if not account:
            raise HTTPException(status_code=400, detail="No active account found")
        account_id = account.id
    else:
        # Verify account ownership
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.user_id == current_user.id
        ).first()
        if not account:
            raise HTTPException(status_code=403, detail="Account not found or access denied")
    
    # Parse receipt with Gemini
    parsed_result = parse_receipt_sync(db, request.image)
    
    if not parsed_result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse receipt: {parsed_result.get('error', 'Unknown error')}"
        )
    
    parsed_data = parsed_result["data"]
    parsed_data["_confidence"] = parsed_result["confidence"]
    
    # Create transaction atomically
    from decimal import Decimal
    
    # Determine status
    confidence = parsed_result["confidence"]
    status = "approved" if (request.auto_approve and confidence >= 0.8) else "pending"
    
    # Parse date
    date_str = parsed_data.get("date")
    try:
        trans_date = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else datetime.utcnow().date()
    except ValueError:
        trans_date = datetime.utcnow().date()
    
    # Create transaction
    transaction = Transaction(
        user_id=current_user.id,
        type="expense",
        amount=parsed_data.get("total_amount", Decimal("0")),
        currency="IDR",
        date=trans_date,
        description=f"Receipt: {parsed_data.get('merchant_name', 'Unknown')}",
        account_id=account_id,
        status=status,
        source=request.source,
        raw_data=parsed_result.get("raw_response"),
        merchant_name=parsed_data.get("merchant_name"),
        merchant_address=parsed_data.get("location"),
        confidence_score=Decimal(str(confidence)),
        detection_type="OCR_RECEIPT"
    )
    
    db.add(transaction)
    db.flush()
    
    # Create transaction items
    items = parsed_data.get("items", [])
    for item_data in items:
        item = TransactionItem(
            transaction_id=transaction.id,
            name=item_data.get("name", "Item"),
            quantity=Decimal(str(item_data.get("quantity", 1))),
            unit_price=Decimal(str(item_data.get("unit_price", 0))),
            total_price=Decimal(str(item_data.get("total_price", 0))),
            category_name=item_data.get("category")
        )
        db.add(item)
    
    db.commit()
    db.refresh(transaction)
    
    return ScanReceiptResponse(
        transaction_id=transaction.id,
        status=status,
        confidence=confidence,
        parsed_data=ParsedReceiptData(
            merchant_name=parsed_data.get("merchant_name"),
            date=parsed_data.get("date"),
            total_amount=str(parsed_data.get("total_amount", 0)),
            items=items,
            category=parsed_data.get("category"),
            location=parsed_data.get("location"),
        ),
        message="Receipt scanned successfully" if status == "approved" else "Receipt pending review"
    )


@router.get("/pending", response_model=List[FeedItemResponse])
async def get_pending_transactions(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all pending transactions for review."""
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.status == "pending",
        Transaction.is_deleted == False
    ).order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()
    
    return [_build_feed_item(t, db) for t in transactions]


@router.get("/all", response_model=List[FeedItemResponse])
async def get_all_feed_transactions(
    status: Optional[str] = Query(default=None, pattern="^(pending|approved|rejected)$"),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all feed transactions with optional status filter."""
    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_deleted == False
    )
    
    if status:
        query = query.filter(Transaction.status == status)
    
    transactions = query.order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()
    
    return [_build_feed_item(t, db) for t in transactions]


@router.get("/stats", response_model=FeedStatsResponse)
async def get_feed_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get feed statistics."""
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    # Pending count
    pending_count = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user.id,
        Transaction.status == "pending",
        Transaction.is_deleted == False
    ).scalar()
    
    # Approved today
    approved_today = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user.id,
        Transaction.status == "approved",
        Transaction.created_at >= today_start,
        Transaction.created_at <= today_end,
        Transaction.is_deleted == False
    ).scalar()
    
    # Rejected today
    rejected_today = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user.id,
        Transaction.status == "rejected",
        Transaction.created_at >= today_start,
        Transaction.created_at <= today_end,
        Transaction.is_deleted == False
    ).scalar()
    
    # Total pending amount
    total_pending = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.status == "pending",
        Transaction.is_deleted == False
    ).scalar() or 0
    
    return FeedStatsResponse(
        pending_count=pending_count or 0,
        approved_today=approved_today or 0,
        rejected_today=rejected_today or 0,
        total_pending_amount=total_pending
    )


@router.post("/approve/{transaction_id}")
async def approve_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a pending transaction."""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction.status != "pending":
        raise HTTPException(status_code=400, detail="Transaction is not pending")
    
    transaction.status = "approved"
    
    # Update account balance
    account = db.query(Account).filter(Account.id == transaction.account_id).first()
    if account:
        if transaction.type == "expense":
            account.balance -= transaction.amount
        elif transaction.type == "income":
            account.balance += transaction.amount
    
    db.commit()
    
    return {"status": "success", "message": "Transaction approved", "transaction_id": transaction_id}


@router.post("/reject/{transaction_id}")
async def reject_transaction(
    transaction_id: int,
    note: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a pending transaction."""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction.status != "pending":
        raise HTTPException(status_code=400, detail="Transaction is not pending")
    
    transaction.status = "rejected"
    if note:
        transaction.notes = f"{transaction.notes or ''}\n\nRejected: {note}".strip()
    
    db.commit()
    
    return {"status": "success", "message": "Transaction rejected", "transaction_id": transaction_id}


@router.post("/batch-approve")
async def batch_approve(
    transaction_ids: List[int],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve multiple transactions at once."""
    approved_count = 0
    
    for tx_id in transaction_ids:
        transaction = db.query(Transaction).filter(
            Transaction.id == tx_id,
            Transaction.user_id == current_user.id,
            Transaction.status == "pending"
        ).first()
        
        if transaction:
            transaction.status = "approved"
            
            # Update account balance
            account = db.query(Account).filter(Account.id == transaction.account_id).first()
            if account:
                if transaction.type == "expense":
                    account.balance -= transaction.amount
                elif transaction.type == "income":
                    account.balance += transaction.amount
            
            approved_count += 1
    
    db.commit()
    
    return {
        "status": "success",
        "approved_count": approved_count,
        "message": f"Approved {approved_count} transactions"
    }


def _build_feed_item(transaction: Transaction, db: Session) -> FeedItemResponse:
    """Build feed item response from transaction."""
    # Get account name
    account_name = None
    if transaction.account_id:
        account = db.query(Account).filter(Account.id == transaction.account_id).first()
        if account:
            account_name = account.name
    
    # Get category name
    category_name = None
    if transaction.category_id:
        category = db.query(Category).filter(Category.id == transaction.category_id).first()
        if category:
            category_name = category.name
    
    # Get items
    items = []
    for item in transaction.items:
        items.append(TransactionItemResponse(
            id=item.id,
            transaction_id=item.transaction_id,
            name=item.name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price,
            category_name=item.category_name,
            created_at=item.created_at
        ))
    
    return FeedItemResponse(
        id=transaction.id,
        type=transaction.type,
        amount=transaction.amount,
        currency=transaction.currency,
        date=transaction.date,
        description=transaction.description,
        merchant_name=transaction.merchant_name,
        status=transaction.status,
        source=transaction.source,
        confidence_score=float(transaction.confidence_score) if transaction.confidence_score else None,
        category_name=category_name,
        account_name=account_name,
        items=items,
        created_at=transaction.created_at
    )
