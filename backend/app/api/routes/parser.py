"""Parser API routes for OCR, SMS, and QRIS transaction detection."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel
import base64
import io

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
from app.services.geocoding_service import geocoding_service, geocode_merchant

router = APIRouter(prefix="/parser", tags=["Parser"])


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


@router.post("/parse-receipt")
async def parse_receipt_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Parse receipt image using OCR.
    
    Accepts image file (PNG, JPG) and returns extracted transaction data.
    Note: This endpoint requires OCR integration (Tesseract or cloud API).
    For now, it returns a placeholder response.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read file content
    content = await file.read()
    
    # Check file size (max 5MB)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    # For actual OCR, you would integrate with:
    # 1. Tesseract OCR: pytesseract.image_to_string()
    # 2. Google Cloud Vision API
    # 3. AWS Textract
    # 4. OpenAI/Gemini Vision API
    
    # Placeholder response - requires OCR integration
    return {
        "status": "requires_ocr",
        "message": "OCR processing not configured. Please provide OCR API credentials.",
        "alternatives": [
            "1. Install Tesseract: brew install tesseract",
            "2. Use Google Cloud Vision API",
            "3. Use OpenAI/Gemini Vision API",
        ],
        "file_received": {
            "filename": file.filename,
            "size": len(content),
            "content_type": file.content_type,
        }
    }


@router.post("/parse-receipt-base64")
def parse_receipt_base64(
    request: dict,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Parse receipt from base64-encoded image.
    
    Accepts JSON: { "image_base64": "...", "ocr_text": "..." }
    Either provide base64 image for server-side OCR, or OCR text directly.
    """
    ocr_text = request.get("ocr_text")
    image_base64 = request.get("image_base64")
    
    if not ocr_text and not image_base64:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'ocr_text' or 'image_base64'"
        )
    
    # If OCR text provided, parse it directly
    if ocr_text:
        parsed = parse_receipt(ocr_text)
        return ParsedTransactionResponse(
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
            suggested_type="expense",
        )
    
    # If base64 image, would need OCR integration
    return {
        "status": "requires_ocr",
        "message": "Base64 image processing requires OCR integration",
    }


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
