"""Budget schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class BudgetBase(BaseModel):
    name: str = Field(..., max_length=100)
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=10)
    period: str = Field(..., pattern="^(weekly|monthly|yearly)$")
    start_date: date
    end_date: Optional[date] = None
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    rollover: bool = False


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    amount: Optional[Decimal] = None
    period: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    rollover: Optional[bool] = None


class BudgetResponse(BudgetBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
