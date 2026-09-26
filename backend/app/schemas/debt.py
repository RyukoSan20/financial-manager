"""Debt schemas - simplified for frontend compatibility."""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class DebtBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    debt_type: str = Field(default="personal_loan")
    principal: Decimal = Field(..., gt=0)
    current_balance: Decimal = Field(default=Decimal("0"))
    interest_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    currency: str = Field(default="IDR", max_length=10)
    tenor_months: int = Field(default=12, gt=0)
    remaining_months: Optional[int] = None
    monthly_payment: Optional[Decimal] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    next_payment_date: Optional[date] = None
    account_id: Optional[int] = None
    lender_name: Optional[str] = Field(None, max_length=100)
    lender_contact: Optional[str] = None


class DebtCreate(DebtBase):
    """Create debt - inherits all fields from DebtBase."""
    pass


class DebtUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    current_balance: Optional[Decimal] = None
    remaining_months: Optional[int] = None
    monthly_payment: Optional[Decimal] = None
    next_payment_date: Optional[date] = None
    account_id: Optional[int] = None
    is_active: Optional[bool] = None


class DebtResponse(DebtBase):
    id: int
    is_paid_off: bool = False
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DebtWithProgress(DebtResponse):
    """Debt with calculated progress."""
    progress_percent: float = 0
    total_paid: Decimal = Decimal("0")
    total_interest_paid: Decimal = Decimal("0")
    total_principal_paid: Decimal = Decimal("0")
    original_principal: Decimal = Decimal("0")
    upcoming_payment_date: Optional[date] = None
    upcoming_payment_amount: Optional[Decimal] = None
    status: str = "active"


class DebtPaymentBase(BaseModel):
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=10)
    payment_date: Optional[date] = None
    principal_portion: Optional[Decimal] = None
    interest_portion: Optional[Decimal] = None
    remaining_balance_after: Optional[Decimal] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class DebtPaymentCreate(BaseModel):
    """Create payment - only amount is required."""
    amount: Optional[float] = None
    currency: Optional[str] = None
    payment_date: Optional[str] = None
    principal_portion: Optional[float] = None
    interest_portion: Optional[float] = None
    remaining_balance_after: Optional[float] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    debt_id: Optional[int] = None
    transaction_id: Optional[int] = None


class DebtPaymentResponse(DebtPaymentBase):
    id: int
    debt_id: int
    transaction_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DebtAmortizationEntry(BaseModel):
    """Single entry in amortization schedule."""
    month: int
    payment_date: Optional[date] = None
    payment: Decimal = Decimal("0")
    principal: Decimal = Decimal("0")
    interest: Decimal = Decimal("0")
    balance: Decimal = Decimal("0")


class DebtAmortizationSchedule(BaseModel):
    """Full amortization schedule for a debt."""
    debt_id: int
    debt_name: str
    principal: Decimal = Decimal("0")
    interest_rate: Decimal = Decimal("0")
    tenor_months: int = 12
    monthly_payment: Decimal = Decimal("0")
    total_interest: Decimal = Decimal("0")
    total_payment: Decimal = Decimal("0")
    schedule: List[DebtAmortizationEntry] = []
