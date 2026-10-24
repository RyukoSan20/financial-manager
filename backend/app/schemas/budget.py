"""Budget schemas."""

from app.schemas.base import EmptyStringAsNone
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date as _date, datetime
from decimal import Decimal


class BudgetBase(EmptyStringAsNone):
    name: str = Field(..., max_length=100)
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=10)
    period: str = Field(..., pattern="^(weekly|monthly|yearly)$")
    # The start date is worked out from the period when it is not given,
    # so the form does not have to ask for it.
    start_date: Optional[_date] = None
    end_date: Optional[_date] = None
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    rollover: bool = False
    # Auto-allocation: deduct from account balance on budget period reset
    auto_allocate: bool = False
    allocation_account_id: Optional[int] = None


class BreakdownLineInput(BaseModel):
    """One line of a breakdown the user sends."""
    name: str = Field(max_length=255)
    quantity: float = 1
    unit_price: float = 0
    total_price: float = 0
    category: Optional[str] = Field(None, max_length=50)
    kind: str = "expense"
    is_discount: bool = False
    notes: Optional[str] = None
    source: str = "user"
    is_estimated: bool = False


class BudgetCreate(BudgetBase, EmptyStringAsNone):
    items: Optional[List[BreakdownLineInput]] = None


class BudgetUpdate(EmptyStringAsNone):
    name: Optional[str] = Field(None, max_length=100)
    amount: Optional[Decimal] = None
    period: Optional[str] = None
    start_date: Optional[_date] = None
    end_date: Optional[_date] = None
    is_active: Optional[bool] = None
    rollover: Optional[bool] = None
    auto_allocate: Optional[bool] = None
    allocation_account_id: Optional[int] = None


class BudgetResponse(BudgetBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
