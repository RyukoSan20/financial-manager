"""Transaction API routes with multi-tenancy."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.security import get_current_user_optional, get_current_user
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionResponse, TransactionWithDetails
from app.models.receipt import ReceiptScan

def balance_delta(tx_type: str, amount) -> float:
    """
    The signed effect a transaction has on an account balance.

    Income adds, expense subtracts, a transfer out leaves the account and a
    transfer in arrives. Every place that touches a balance uses this one
    function, so an approve, a delete and a transfer can never disagree
    about what the sign should be.
    """
    amount = float(amount or 0)
    if tx_type == "income" or tx_type == "transfer_in":
        return amount
    if tx_type == "expense" or tx_type == "transfer_out":
        return -amount
    return 0.0


router = APIRouter()


@router.get("/", response_model=List[TransactionWithDetails])
def list_transactions(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = None,
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all transactions for current user with receipt items."""
    query = db.query(Transaction)
    
    # Multi-tenancy filter
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
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
    
    transactions = query.order_by(Transaction.date.desc()).offset(skip).limit(limit).all()
    
    # Fetch all receipt items in 1 query (fix N+1)
    receipt_ids = [t.receipt_scan_id for t in transactions if t.receipt_scan_id]
    receipts_map = {}
    if receipt_ids:
        from sqlalchemy.orm import joinedload
        receipts = db.query(ReceiptScan).options(joinedload(ReceiptScan.items)).filter(ReceiptScan.id.in_(receipt_ids)).all()
        for r in receipts:
            receipts_map[r.id] = r
    
    # Enrich with receipt items
    result = []
    for t in transactions:
        logger.info(f"TX {t.id}: receipt_scan_id={t.receipt_scan_id}")
        data = {
            "id": t.id,
            "user_id": t.user_id,
            "type": t.type,
            "amount": t.amount,
            "currency": t.currency,
            "date": t.date,
            "description": t.description,
            "notes": t.notes,
            "account_id": t.account_id,
            "category_id": t.category_id,
            "transfer_id": t.transfer_id,
            "recurring_rule_id": t.recurring_rule_id,
            "is_recurring": t.is_recurring,
            "is_deleted": t.is_deleted,
            "detection_type": t.detection_type,
            "merchant_name": t.merchant_name,
            "raw_source_text": t.raw_source_text,
            "confidence_score": t.confidence_score,
            "receipt_scan_id": t.receipt_scan_id,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "items": [],
        }
        # Load receipt items from pre-fetched map
        if t.receipt_scan_id and t.receipt_scan_id in receipts_map:
            receipt = receipts_map[t.receipt_scan_id]
            logger.info(f"TX {t.id}: Found receipt {receipt.id} with {len(receipt.items) if receipt.items else 0} items")
            if receipt and receipt.items:
                data["items"] = [
                    {
                        "name": item.raw_name or "Item",
                        "quantity": item.quantity or 1,
                        "price_per_unit": float(item.price_per_unit) if item.price_per_unit else 0,
                        "total_price": float(item.total_price) if item.total_price else 0,
                        "is_discount": getattr(item, 'is_discount', False),
                    }
                    for item in receipt.items
                ]
        result.append(data)
    
    return result


@router.get("/summary/by-period")
def get_transactions_by_period(
    start_date: date,
    end_date: date,
    group_by: str = "day",
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get transaction summary grouped by period."""
    query = db.query(Transaction).filter(
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )
    
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
    transactions = query.all()
    
    summary = {"income": Decimal("0"), "expense": Decimal("0")}
    daily_data = {}
    
    for t in transactions:
        if t.type == "income":
            summary["income"] += t.amount
        else:
            summary["expense"] += t.amount
        
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
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get transaction summary grouped by category."""
    from app.models.category import Category
    
    query = db.query(Transaction).join(Category).filter(
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == type
    )
    
    if current_user:
        query = query.filter(Transaction.user_id == current_user.id)
    
    transactions = query.all()
    
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


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transaction by ID with ownership check."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Ownership check
    if current_user and transaction.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return transaction


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(
    transaction: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new transaction. Requires authentication.
    
    Idempotency: If client_request_id is provided and a transaction with
    the same user_id and client_request_id exists, return that transaction
    instead of creating a duplicate.
    """
    # === IDEMPOTENCY CHECK ===
    if transaction.client_request_id:
        existing = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.client_request_id == transaction.client_request_id
        ).first()
        if existing:
            logger.info(f"Returning existing transaction {existing.id} for idempotency key {transaction.client_request_id}")
            return existing
    
    # Verify account exists and belongs to user
    account = db.query(Account).filter(Account.id == transaction.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Account ownership check
    if account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot add transaction to another user's account")
    
    # === ATOMIC BALANCE UPDATE (only for approved transactions) ===
    # Pending transactions don't affect balance until approved
    from sqlalchemy import text
    # A NULL or empty status counts as approved: that is what the older
    # rows in the database carry, and leaving them out made the balance
    # drift away from the sum of the transactions.
    if transaction.status in (None, "", "approved"):
        delta = balance_delta(transaction.type, transaction.amount)
        # Atomic update: balance = balance + delta
        db.execute(
            text("""
                UPDATE accounts 
                SET balance = balance + :delta,
                    updated_at = NOW()
                WHERE id = :account_id
            """),
            {"delta": delta, "account_id": transaction.account_id}
        )
    
    # Create transaction record
    # items steers the breakdown, it is not a column.
    given_transaction_items = transaction.items or []

    db_transaction = Transaction(
        user_id=current_user.id,
        amount=transaction.amount,
        type=transaction.type,
        currency=transaction.currency,
        date=transaction.date,
        description=transaction.description,
        notes=transaction.notes,
        account_id=transaction.account_id,
        category_id=transaction.category_id,
        recurring_rule_id=transaction.recurring_rule_id,
        detection_type=transaction.detection_type,
        receipt_scan_id=transaction.receipt_scan_id,
        latitude=transaction.latitude,
        longitude=transaction.longitude,
        client_request_id=transaction.client_request_id,
        # Feed/Review Workflow fields
        status=transaction.status,
        source=transaction.source,
        merchant_name=transaction.merchant_name,
    )
    
    db.add(db_transaction)
    db.flush()

    # The lines this transaction paid for. The user can send them, and
    # when they do not, a purchase at a shop gets them worked out so the
    # transaction can be opened and read line by line.
    try:
        from app.services.breakdown_service import set_breakdown

        given_items = [
            item.model_dump() for item in given_transaction_items
        ]

        if given_items:
            set_breakdown(
                db,
                current_user.id,
                "transaction",
                db_transaction.id,
                given_items,
                replace=True,
            )
        elif (
            transaction.expand_breakdown
            and transaction.type == "expense"
            and float(transaction.amount or 0) > 0
            and transaction.merchant_name
        ):
            from app.services.transaction_breakdown import expand_transaction

            expansion = expand_transaction(
                message=transaction.description or "",
                amount=float(transaction.amount),
                merchant=transaction.merchant_name,
                db=db,
                user_id=current_user.id,
            )
            lines = expansion.get("lines") or []
            if lines:
                set_breakdown(
                    db,
                    current_user.id,
                    "transaction",
                    db_transaction.id,
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
    except Exception as exc:  # noqa: BLE001 - the transaction still stands
        logger.warning("Could not attach the transaction breakdown: %s", exc)

    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int, 
    transaction: TransactionUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update transaction with ownership check. Requires authentication."""
    db_transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Ownership check
    if db_transaction.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = transaction.model_dump(exclude_unset=True)

    # The balance is only moved by a transaction that is actually counted.
    # A pending transaction has not moved the balance yet, so changing its
    # amount or its type must not move the balance either.
    old_status = db_transaction.status
    was_counted = old_status in (None, "", "approved")

    old_amount = db_transaction.amount
    old_type = db_transaction.type

    for key, value in update_data.items():
        setattr(db_transaction, key, value)

    new_status = db_transaction.status
    is_counted = new_status in (None, "", "approved")

    # A transaction that just became approved starts counting, and one that
    # stopped being approved stops counting.
    became_counted = (not was_counted) and is_counted
    stopped_counting = was_counted and (not is_counted)

    amount_changed = "amount" in update_data or "type" in update_data
    amount_delta = 0.0

    if was_counted and is_counted:
        # Still counted: apply the difference between the old and the new
        # effect on the balance.
        if amount_changed:
            old_delta = balance_delta(str(old_type), old_amount)
            new_delta = balance_delta(str(db_transaction.type), db_transaction.amount)
            amount_delta = new_delta - old_delta
    elif became_counted:
        # It just started counting: apply its full effect.
        amount_delta = balance_delta(str(db_transaction.type), db_transaction.amount)
    elif stopped_counting:
        # It just stopped counting: undo its full effect.
        amount_delta = -balance_delta(str(old_type), old_amount)
    # was_counted == False and is_counted == False: nothing to do.

    if amount_delta != 0:
        from sqlalchemy import text

        db.execute(
            text(
                "UPDATE accounts SET balance = balance + :delta, updated_at = NOW() "
                "WHERE id = :account_id"
            ),
            {"delta": amount_delta, "account_id": db_transaction.account_id},
        )

    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete transaction with ownership check. Requires authentication."""
    db_transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Ownership check
    if db_transaction.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # === ATOMIC BALANCE UPDATE ===
    # Reverse the balance change atomically - but only for a transaction that
    # actually changed the balance.
    #
    # The balance is only moved when a transaction is approved (see the feed
    # approve endpoint). A pending transaction has not touched the balance
    # yet, and a rejected one never will. Reversing those would ADD money
    # the user never spent, which is exactly the "total saldo tidak kembali
    # ke normal after deleting" symptom.
    from sqlalchemy import text

    affects_balance = (
        db_transaction.status == "approved"
        or db_transaction.status is None
        or db_transaction.status == ""
    )
    # A transaction that was created directly (not through the feed) is
    # already counted, so it has to be reversed on delete.
    if affects_balance:
        # The ORIGINAL effect of the transaction was +amount for an income
        # and -amount for an expense. Reversing it means applying the
        # OPPOSITE sign. Applying the original sign again subtracts the
        # money a second time, which is the "the balance does not go back
        # to normal after a delete" symptom.
        original_delta = balance_delta(db_transaction.type, db_transaction.amount)
        db.execute(
            text("""
                UPDATE accounts
                SET balance = balance + :delta,
                    updated_at = NOW()
                WHERE id = :account_id
            """),
            {"delta": -original_delta, "account_id": db_transaction.account_id},
        )

    db.delete(db_transaction)
    db.commit()
    return None
