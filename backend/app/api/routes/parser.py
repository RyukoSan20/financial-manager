"""Parser API routes for OCR, SMS, and QRIS transaction detection."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel
import base64
import io
import logging

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.services.parser_service import (
    parse_sms_or_qris,
    parse_receipt,
    ParsedTransaction
)
from app.services.ocr_service import ocr_service, OCRResult
from app.services.geocoding_service import geocoding_service, geocode_merchant
from app.services.catalog_service import match_items_to_catalog

router = APIRouter(tags=["Parser"])


# === Pydantic Models ===

class ParsedTransactionResponse(BaseModel):
    """Response model for parsed transaction."""
    amount: str
    transaction_type: str
    merchant_name: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    account_source: Optional[str] = None
    reference_number: Optional[str] = None
    confidence_score: float
    detection_type: str
    raw_text: Optional[str] = None
    suggested_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    merchant_address: Optional[str] = None

    class Config:
        from_attributes = True


# === API Endpoints ===

@router.post("/parse-text", response_model=List[ParsedTransactionResponse])
def parse_text(
    request: dict,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Parse raw SMS/QRIS text and extract transaction data.
    
    Accepts JSON: { "raw_text": "..." }
    Returns list of detected transactions with confidence scores.
    """
    raw_text = request.get("raw_text", "")
    
    if not raw_text or len(raw_text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Text too short to parse")
    
    if len(raw_text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long (max 5000 characters)")
    
    # Parse the text
    results = parse_sms_or_qris(raw_text)
    
    # Convert to response models with geocoding
    response = []
    for parsed in results:
        # Try to geocode merchant location
        latitude = None
        longitude = None
        merchant_address = None
        
        if parsed.merchant_name:
            geo = geocode_merchant(parsed.merchant_name)
            if geo:
                latitude = geo.latitude
                longitude = geo.longitude
                merchant_address = geo.formatted_address
        
        response.append(ParsedTransactionResponse(
            amount=str(parsed.amount),
            transaction_type=parsed.transaction_type,
            merchant_name=parsed.merchant_name,
            description=parsed.description,
            date=parsed.date_time.isoformat() if parsed.date_time else None,
            account_source=parsed.account_source,
            reference_number=parsed.reference_number,
            confidence_score=parsed.confidence_score,
            detection_type=parsed.detection_type,
            raw_text=parsed.raw_text[:500] if parsed.raw_text else None,
            suggested_type="expense" if parsed.transaction_type == "DEBIT" else "income",
            latitude=latitude,
            longitude=longitude,
            merchant_address=merchant_address,
        ))
    
    return response


# ============================================================
# CPU-Bound Task Wrapper (Non-blocking)
# ============================================================

def _process_receipt_cpu_bound(image_bytes: bytes) -> dict:
    """
    CPU-bound OCR processing wrapped for thread pool execution.
    This runs synchronously in a separate thread to avoid blocking FastAPI event loop.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # 1. OCR Extraction (RapidOCR/Tesseract)
    receipt = ocr_service.process_image(image_bytes)
    
    # 2. Geocoding
    latitude = None
    longitude = None
    merchant_address = receipt.address or receipt.merchant_name
    
    if merchant_address:
        try:
            geo = geocode_merchant(merchant_address)
            if geo:
                latitude = geo.latitude
                longitude = geo.longitude
                merchant_address = geo.formatted_address or merchant_address
        except Exception as e:
            logger.warning(f"Geocoding failed: {e}")
    
    # 3. Catalog matching
    enriched_items = []
    if receipt.items:
        try:
            enriched_items = match_items_to_catalog(receipt.items)
        except Exception as e:
            logger.warning(f"Catalog matching failed: {e}")
            enriched_items = receipt.items
    
    return {
        "receipt": receipt,
        "latitude": latitude,
        "longitude": longitude,
        "merchant_address": merchant_address,
        "enriched_items": enriched_items
    }


@router.post("/parse-receipt")
async def parse_receipt_image_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Parse receipt image using Enterprise OCR Engine.
    
    Uses RapidOCR ONNX + Dynamic Y-Threshold + FAISS catalog matching.
    CPU-bound tasks run in thread pool to avoid blocking FastAPI event loop.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read file content
    content = await file.read()
    
    # Check file size (max 10MB)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    try:
        # Run CPU-bound OCR processing in thread pool (non-blocking)
        result = await run_in_threadpool(_process_receipt_cpu_bound, content)
        
        receipt = result["receipt"]
        
        # Determine transaction type
        transaction_type = "DEBIT" if receipt.amount else "DEBIT"
        
        # Get holistic confidence from parser engine (includes math validation)
        holistic_confidence = 0.7  # Default
        if hasattr(receipt, 'confidence') and receipt.confidence:
            # Blend OCR confidence with parser confidence
            holistic_confidence = (receipt.confidence / 100 * 0.5) + 0.5
        
        return {
            "status": "success",
            "detection_type": "ENTERPRISE_LOCAL_OCR",
            "merchant_name": receipt.merchant_name,
            "amount": str(int(receipt.amount_value)) if receipt.amount_value else "0",
            "transaction_type": transaction_type,
            "date": receipt.date,
            "payment_method": receipt.payment_method,
            "address": result["merchant_address"],
            "items_count": len(result["enriched_items"]) if result["enriched_items"] else 0,
            "items": result["enriched_items"] if result["enriched_items"] else [],
            "confidence_score": round(holistic_confidence * 100, 1),
            "ocr_confidence": round(receipt.confidence, 1) if receipt.confidence else 0,
            "category_hint": "shopping",
            "suggested_type": "expense",
            "description": f"Purchase at {receipt.merchant_name}" if receipt.merchant_name else "Purchase",
            "raw_text": receipt.text[:2000] if receipt.text else None,
            "raw_lines": receipt.text.split('\n')[:100] if receipt.text else [],
            "latitude": result["latitude"],
            "longitude": result["longitude"],
            "merchant_address": result["merchant_address"],
        }
        
    except Exception as e:
        logger.error(f"OCR processing failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )


@router.post("/parse-receipt-base64")
def parse_receipt_base64_endpoint(
    request: dict,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Parse receipt from base64-encoded image or OCR text.
    
    Accepts JSON with either:
    - image_base64: base64-encoded image for OCR
    - ocr_text: pre-OCR'd text to parse directly
    """
    ocr_text = request.get("ocr_text")
    image_base64 = request.get("image_base64")
    
    if not ocr_text and not image_base64:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'ocr_text' or 'image_base64'"
        )
    
    try:
        if image_base64:
            # Process image with OCR
            receipt = parse_receipt_image(image_base64)
        else:
            # Parse pre-OCR'd text
            receipt = parse_receipt_text(ocr_text)
        
        return {
            "status": "success",
            "merchant_name": receipt.merchant_name,
            "amount": str(receipt.total_amount) if receipt.total_amount else "0",
            "transaction_type": "DEBIT",
            "date": receipt.date.isoformat() if receipt.date else None,
            "payment_method": receipt.payment_method,
            "confidence_score": receipt.confidence_score,
            "category_hint": receipt.category_hint,
            "suggested_type": "expense",
            "description": f"Pembelian di {receipt.merchant_name}" if receipt.merchant_name else "Pembelian",
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Parsing failed: {str(e)}"
        )


@router.post("/confirm")
def confirm_transaction(
    request: dict,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Confirm and save a parsed transaction to the database.
    
    Accepts JSON with transaction details extracted from parser.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Validate required fields
    required = ["amount", "transaction_type", "description", "date", "account_id"]
    for field in required:
        if field not in request:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Validate account ownership
    account = db.query(Account).filter(
        Account.id == request["account_id"],
        Account.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Create transaction
    tx = Transaction(
        user_id=current_user.id,
        type=request["transaction_type"],  # income, expense
        amount=Decimal(str(request["amount"])),
        currency=request.get("currency", "IDR"),
        date=request["date"],
        description=request.get("description", ""),
        notes=request.get("notes"),
        account_id=request["account_id"],
        category_id=request.get("category_id"),
        merchant_name=request.get("merchant_name"),
        raw_source_text=request.get("raw_source_text"),
        confidence_score=Decimal(str(request.get("confidence_score", 0))),
        detection_type=request.get("detection_type", "MANUAL"),
    )
    
    # Update account balance
    if tx.type == "income":
        account.balance += tx.amount
    else:
        account.balance -= tx.amount
    
    db.add(tx)
    db.commit()
    db.refresh(tx)
    
    return {
        "message": "Transaction created successfully",
        "transaction_id": tx.id,
        "account_new_balance": float(account.balance),
    }


@router.get("/detection-types")
def get_detection_types(
    current_user: User = Depends(get_current_user_optional),
):
    """
    Get list of supported detection types.
    """
    return {
        "types": [
            {"id": "MANUAL", "label": "Manual Entry", "description": "User manually entered transaction"},
            {"id": "OCR_RECEIPT", "label": "OCR Receipt", "description": "Scanned from receipt image"},
            {"id": "QRIS_TEXT", "label": "QRIS Text", "description": "Parsed from QRIS payment text"},
            {"id": "SMS_BANK", "label": "SMS Bank", "description": "Parsed from bank SMS notification"},
        ]
    }


@router.get("/ocr-status")
def get_ocr_status():
    """
    Check OCR service status - is EasyOCR ready?
    """
    from app.services.ocr_service import ocr_initialized, ocr_init_error, easyocr_reader
    
    is_ready = easyocr_reader is not None and ocr_init_error is None
    
    return {
        "status": "ready" if is_ready else ("loading" if not ocr_initialized else "error"),
        "ready": is_ready,
        "error": str(ocr_init_error) if ocr_init_error else None,
        "message": "OCR ready" if is_ready else ("Downloading models..." if not ocr_initialized else "OCR error"),
    }


@router.post("/ocr-warmup")
def warmup_ocr():
    """
    Trigger OCR model download/warmup.
    This pre-loads the EasyOCR models so the first scan is fast.
    """
    import threading
    
    def init_ocr():
        from app.services.ocr_service import get_easyocr_reader
        try:
            get_easyocr_reader(timeout_seconds=120)
        except Exception as e:
            pass
    
    # Start in background thread
    thread = threading.Thread(target=init_ocr, daemon=True)
    thread.start()
    
    return {"status": "started", "message": "OCR warmup started in background"}


@router.get("/sample-texts")
def get_sample_texts():
    """
    Get sample SMS/text formats for testing the parser.
    """
    return {
        "samples": [
            {
                "bank": "BCA",
                "type": "debit",
                "text": "PEMBAYARAN GOJEK 15/09/26 17:30 ke GOPAY-8612 Sejumlah Rp50.000. info: 14000",
            },
            {
                "bank": "BCA",
                "type": "credit",
                "text": "Transfer masuk dari JOHN DOE Sejumlah Rp1.500.000.00 tgl 15/09/26 jam 14:30. BCA.",
            },
            {
                "bank": "MANDIRI",
                "type": "debit",
                "text": "MANDIRI: Pembayaran TELKOMSEL 089612345678 Sejumlah Rp100.000.00. Saldo: Rp500.000.00",
            },
            {
                "bank": "OVO",
                "type": "debit",
                "text": "OVO Payment ke GRAB sejumah Rp35.000. Saldo OVO: Rp50.000. Ref: ABC123",
            },
            {
                "bank": "QRIS",
                "type": "debit",
                "text": "QRIS Payment di WARKOP MAMA Sejumlah Rp25.000. No.Merchant: 123456789",
            },
        ]
    }
