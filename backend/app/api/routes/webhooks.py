"""QRIS Payment Webhook Handler."""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, date
import hmac
import hashlib
import json

from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.merchant import Merchant
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.account import Account

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


class QRISNotification(BaseModel):
    """QRIS payment notification from payment gateway."""
    merchant_id: str
    amount: float
    reference: str
    customer_name: str = ""
    timestamp: str = ""
    signature: str = ""


def verify_qris_signature(data: dict, secret: str) -> bool:
    """Verify QRIS webhook signature."""
    # In production, implement proper signature verification
    # For now, allow all (demo mode)
    return True


async def process_qris_payment(
    merchant_db_id: int,
    amount: float,
    reference: str,
    customer_name: str,
    db: Session
):
    """Background task to process QRIS payment."""
    try:
        # Get merchant
        merchant = db.query(Merchant).filter(Merchant.id == merchant_db_id).first()
        if not merchant:
            return {"error": "Merchant not found"}
        
        # Get user
        user = db.query(User).filter(User.id == merchant.user_id).first()
        if not user:
            return {"error": "User not found"}
        
        # Get or create QRIS account
        account_id = merchant.default_qris_account_id
        if not account_id:
            # Look for existing QRIS account
            account = db.query(Account).filter(
                Account.user_id == user.id,
                Account.name.ilike("%qris%"),
                Account.is_active == True
            ).first()
            if account:
                account_id = account.id
        
        if not account_id:
            # Create QRIS account if not exists
            account = Account(
                user_id=user.id,
                name=f"QRIS - {merchant.store_name}",
                type="cash",
                balance=amount,  # Initial balance from this payment
                currency="IDR"
            )
            db.add(account)
            db.commit()
            db.refresh(account)
            account_id = account.id
            
            # Update merchant default
            merchant.default_qris_account_id = account_id
            db.commit()
        
        # Get sales category
        category = db.query(Category).filter(
            Category.user_id == user.id,
            Category.type == "income",
            Category.is_active == True
        ).first()
        
        # Create transaction
        transaction = Transaction(
            user_id=user.id,
            account_id=account_id,
            category_id=category.id if category else None,
            type="income",
            amount=amount,
            description=f"QRIS Payment - {merchant.store_name}",
            date=date.today(),
            is_merchant=True,
            merchant_id=merchant.id,
            payment_method="QRIS",
            reference_number=reference,
            source="qris_webhook"
        )
        
        db.add(transaction)
        
        # Update account balance
        account.balance = account.balance + amount
        
        db.commit()
        
        return {
            "success": True,
            "transaction_id": transaction.id,
            "amount": float(amount)
        }
        
    except Exception as e:
        db.rollback()
        return {"error": str(e)}


@router.post("/qris")
async def qris_webhook(
    notification: QRISNotification,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Receive QRIS payment notifications from payment gateway.
    
    This endpoint is called by the QRIS payment gateway when a customer pays.
    It creates an automatic transaction for the merchant.
    """
    # Find merchant by QRIS merchant ID
    merchant = db.query(Merchant).filter(
        Merchant.qris_merchant_id == notification.merchant_id,
        Merchant.qris_enabled == True,
        Merchant.is_active == True
    ).first()
    
    if not merchant:
        # Demo mode: try to find by any merchant for testing
        merchant = db.query(Merchant).filter(
            Merchant.is_active == True
        ).first()
        
        if not merchant:
            return {"status": "ignored", "message": "Merchant not found"}
    
    # Process in background to not block webhook response
    background_tasks.add_task(
        process_qris_payment,
        merchant.id,
        notification.amount,
        notification.reference,
        notification.customer_name,
        db
    )
    
    return {
        "status": "accepted",
        "merchant_id": merchant.id,
        "amount": notification.amount
    }


@router.post("/qris-test")
def qris_test_webhook(
    merchant_id: int,
    amount: float,
    reference: str,
    db: Session = Depends(get_db)
):
    """
    Test QRIS webhook manually (for development).
    """
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.is_active == True
    ).first()
    
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Process immediately (not background) for testing
    result = process_qris_payment(
        merchant.id,
        amount,
        reference,
        "Test Customer",
        db
    )
    
    return result
