"""Schemas for Enterprise Feed/Review System."""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class TransactionItemCreate(BaseModel):
    """Schema for creating transaction items."""
    name: str = Field(..., min_length=1, max_length=255)
    quantity: Decimal = Field(default=Decimal("1"), ge=0)
    unit_price: Decimal = Field(..., ge=0)
    total_price: Decimal = Field(..., ge=0)
    category_name: Optional[str] = Field(None, max_length=100)


class TransactionItemResponse(BaseModel):
    """Schema for transaction item response."""
    id: int
    transaction_id: int
    name: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    category_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ScanReceiptRequest(BaseModel):
    """Schema for receipt scanning request."""
    image: str = Field(..., description="Base64 encoded image")
    source: str = Field(default="camera_scan", pattern="^(camera_scan|email_forward|whatsapp|manual|ocr|api)$")
    account_id: Optional[int] = None
    auto_approve: bool = Field(default=False, description="Auto-approve if confidence is high")


class ParsedReceiptData(BaseModel):
    """Schema for Gemini parsed receipt data."""
    nama_toko: Optional[str] = None
    merchant_name: Optional[str] = None
    tanggal: Optional[str] = None
    date: Optional[str] = None
    total_harga: Optional[str] = None
    total_price: Optional[str] = None
    total_amount: Optional[str] = None
    items: Optional[List[dict]] = Field(default_factory=list)
    category: Optional[str] = None
    location: Optional[str] = None
    payment_method: Optional[str] = None


class ScanReceiptResponse(BaseModel):
    """Schema for scan receipt response."""
    transaction_id: Optional[int] = None
    status: str  # pending, approved, rejected
    confidence: float
    parsed_data: ParsedReceiptData
    message: str


class FeedItemResponse(BaseModel):
    """Schema for feed item response."""
    id: int
    type: str
    amount: Decimal
    currency: str
    date: date
    description: Optional[str]
    merchant_name: Optional[str]
    status: str  # pending, approved, rejected
    source: str  # camera_scan, email_forward, whatsapp, manual, ocr, api
    confidence_score: Optional[float]
    category_name: Optional[str]
    account_name: Optional[str]
    items: List[TransactionItemResponse] = Field(default_factory=list)
    created_at: datetime

    class Config:
        from_attributes = True


class ApproveRejectRequest(BaseModel):
    """Schema for approve/reject request."""
    status: str = Field(..., pattern="^(approved|rejected)$")
    note: Optional[str] = None


class FeedStatsResponse(BaseModel):
    """Schema for feed statistics."""
    pending_count: int
    approved_today: int
    rejected_today: int
    total_pending_amount: Decimal
