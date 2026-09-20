"""Debt schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class DebtBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    debt_type: str = Field(..., pattern="^(personal_loan|mortgage|car_loan|credit_card|student_loan|other)$")
    principal: Decimal = Field(..., gt=0)
    current_balance: Decimal = Field(..., ge=0)
    interest_rate: Decimal = Field(..., ge=0, le=1)  # As decimal
    currency: str = Field(default="IDR", max_length=10)
    tenor_months: int = Field(..., gt=0)
    remaining_months: int = Field(..., ge=0)
    monthly_payment: Decimal = Field(..., gt=0)
    start_date: date
    end_date: date
    next_payment_date: Optional[date] = None
    account_id: Optional[int] = None
    lender_name: Optional[str] = Field(None, max_length=100)
    lender_contact: Optional[str] = None


class DebtCreate(DebtBase):
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
    is_paid_off: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DebtWithProgress(DebtResponse):
    """Debt with calculated progress."""
    progress_percent: float  # 0-100
    total_paid: Decimal
    total_interest_paid: Decimal
    total_principal_paid: Decimal
    original_principal: Decimal
    upcoming_payment_date: Optional[date]
    upcoming_payment_amount: Optional[Decimal]
    status: str  # active, upcoming, overdue, paid_off


class DebtPaymentBase(BaseModel):
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=10)
    payment_date: date
    principal_portion: Decimal = Field(..., ge=0)
    interest_portion: Decimal = Field(..., ge=0)
    remaining_balance_after: Decimal = Field(..., ge=0)
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class DebtPaymentCreate(DebtPaymentBase):
    debt_id: int
    transaction_id: Optional[int] = None


class DebtPaymentResponse(DebtPaymentBase):
    id: int
    debt_id: int
    transaction_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class DebtAmortizationEntry(BaseModel):
    """Single entry in amortization schedule."""
    month: int
    payment_date: date
    payment: Decimal
    principal: Decimal
    interest: Decimal
    balance: Decimal


class DebtAmortizationSchedule(BaseModel):
    """Full amortization schedule for a debt."""
    debt_id: int
    debt_name: str
    principal: Decimal
    interest_rate: Decimal
    tenor_months: int
    monthly_payment: Decimal
    total_interest: Decimal
    total_payment: Decimal
    schedule: List[DebtAmortizationEntry]
