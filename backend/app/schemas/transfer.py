"""Transfer schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class TransferBase(BaseModel):
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=10)
    date: date
    description: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    from_account_id: int
    to_account_id: int


class TransferCreate(TransferBase):
    pass


class TransferUpdate(BaseModel):
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    date: Optional[date] = None
    description: Optional[str] = None
    notes: Optional[str] = None


class TransferResponse(TransferBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransferWithTransactions(TransferResponse):
    """Transfer with its paired transactions."""
    from_transaction_id: Optional[int] = None
    to_transaction_id: Optional[int] = None
