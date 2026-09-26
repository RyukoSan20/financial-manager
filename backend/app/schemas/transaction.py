"""Transaction schemas - Updated with transfer types."""

from pydantic import BaseModel, Field
from typing import Optional, List
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


class TransactionCreate(TransactionBase):
    pass


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
