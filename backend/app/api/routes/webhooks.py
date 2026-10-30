"""QRIS Payment Webhook Handler."""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, date
import hmac
import hashlib
import json
import logging

from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import get_current_user
from app.models.user import User
from app.models.merchant import Merchant
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.account import Account

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


class QRISNotification(BaseModel):
    """QRIS payment notification from payment gateway."""
    merchant_id: str
    amount: float
    reference: str
    customer_name: str = ""
    timestamp: str = ""
    signature: str = ""


def _canonical_qris_body(data: dict) -> str:
    """
    The exact text the gateway signs.

    Written here rather than left to the caller's json.dumps, because
    two ways of spelling the same JSON give two different digests:
    an amount of 50000 and an amount of 50000.0 are the same money but
    not the same bytes. The numbers are put into one shape first.
    """
    fields = {
        "merchant_id": str(data.get("merchant_id") or ""),
        "amount": float(data.get("amount") or 0),
        "reference": str(data.get("reference") or ""),
        "customer_name": str(data.get("customer_name") or ""),
        "timestamp": str(data.get("timestamp") or ""),
    }
    return json.dumps(fields, sort_keys=True, separators=(",", ":"))


def sign_qris_payload(data: dict, secret: str) -> str:
    """
    The digest the gateway is expected to send.

    The gateway signs the body with the shared secret and puts the
    digest in the signature field.
    """
    return hmac.new(
        secret.encode("utf-8"),
        _canonical_qris_body(data).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_qris_signature(data: dict, secret: str) -> bool:
    """
    Check the gateway's signature on a notification.

    The two digests are compared with hmac.compare_digest so that a
    wrong answer does not leak how far it got.

    There is no "allow all" path. A webhook that trusts every caller
    is a webhook that anybody can use to write transactions into
    somebody's ledger.
    """
    if not secret:
        return False

    presented = (data.get("signature") or "").strip()
    if not presented:
        return False

    expected = sign_qris_payload(data, secret)

    return hmac.compare_digest(expected, presented)


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


async def _process_qris_payment_safely(
    merchant_db_id: int,
    amount: float,
    reference: str,
    customer_name: str,
    db: Session
):
    """Run the QRIS worker, and keep its failure out of the response."""
    try:
        return await process_qris_payment(
            merchant_db_id, amount, reference, customer_name, db
        )
    except Exception as exc:
        logger.error("QRIS payment processing failed: %s", exc)
        return {"error": str(exc)}


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
    # The gateway has to prove it is the gateway before anything is
    # written. An unsigned notification is not a payment.
    secret = get_settings().QRIS_WEBHOOK_SECRET
    if not verify_qris_signature(notification.model_dump(), secret):
        logger.warning(
            "QRIS notification refused: bad signature for merchant %s",
            notification.merchant_id,
        )
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Find merchant by QRIS merchant ID
    merchant = db.query(Merchant).filter(
        Merchant.qris_merchant_id == notification.merchant_id,
        Merchant.qris_enabled == True,
        Merchant.is_active == True
    ).first()

    if not merchant:
        # No guessing. Falling back to "any active merchant" meant a
        # notification for an unknown shop was booked against
        # somebody else's shop.
        logger.warning(
            "QRIS notification for unknown merchant %s", notification.merchant_id
        )
        return {"status": "ignored", "message": "Merchant not found"}
    
    # Process in background to not block webhook response.
    # The worker is a coroutine, so the background task has to await
    # it -- handing the coroutine over unawaited made it run
    # nothing and crash the response.
    background_tasks.add_task(
        _process_qris_payment_safely,
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
async def qris_test_webhook(
    merchant_id: int,
    amount: float,
    reference: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Test QRIS webhook manually (for development).

    It writes a real transaction, so it needs a reader, and it has
    to be that reader's merchant.
    """
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id,
        Merchant.is_active == True
    ).first()
    
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Process immediately (not background) for testing
    result = await process_qris_payment(
        merchant.id,
        amount,
        reference,
        "Test Customer",
        db
    )

    return result
