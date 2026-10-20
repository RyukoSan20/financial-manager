"""Transaction schemas - Updated with transfer types and idempotency."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal


class TransactionBase(BaseModel):
    type: str = Field(..., pattern="^(income|expense|transfer_out|transfer_in)$")
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=10)
    date: date
    description: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    category_id: Optional[int] = None
    account_id: int
    recurring_rule_id: Optional[int] = None
    detection_type: str = Field(default="MANUAL")  # MANUAL, OCR_RECEIPT, QRIS_TEXT, SMS_BANK
    receipt_scan_id: Optional[int] = None  # Link to receipt scan
    # Feed/Review Workflow fields
    status: str = Field(default="pending")  # pending, approved, rejected
    source: str = Field(default="manual")  # camera_scan, email_forward, whatsapp, manual, ocr, api
    merchant_name: Optional[str] = Field(None, max_length=100)
    # Location fields
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TransactionCreate(TransactionBase):
    # Idempotency key - prevents duplicate transactions from double-tap or retry
    client_request_id: Optional[str] = Field(
        None,
        description="Client-generated UUID for idempotency. Same ID returns existing transaction.",
        max_length=64
    )


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    date: Optional[date] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    category_id: Optional[int] = None
    account_id: Optional[int] = None


class TransactionResponse(BaseModel):
    id: int
    user_id: Optional[int]
    type: str
    amount: Decimal
    currency: str
    date: date
    description: Optional[str]
    notes: Optional[str]
    account_id: int
    category_id: Optional[int]
    transfer_id: Optional[int]
    recurring_rule_id: Optional[int]
    is_recurring: bool
    is_deleted: bool
    detection_type: str
    merchant_name: Optional[str]
    raw_source_text: Optional[str]
    confidence_score: Optional[float]
    receipt_scan_id: Optional[int] = None
    # Location fields
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    # Idempotency
    client_request_id: Optional[str] = None
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TransactionWithDetails(TransactionResponse):
    """Transaction with related details."""
    account_name: Optional[str] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    items: List[Dict[str, Any]] = []  # Receipt items from OCR


class TransactionFilter(BaseModel):
    """Filter options for transaction listing."""
    type: Optional[str] = None
    account_id: Optional[int] = None
    category_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    search: Optional[str] = None
    exclude_transfers: bool = False  # Filter out transfers from income/expense totals
