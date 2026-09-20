"""Recurring rule schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class RecurringRuleBase(BaseModel):
    type: str = Field(..., pattern="^(income|expense|transfer)$")
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=10)
    description: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    account_id: int
    to_account_id: Optional[int] = None
    category_id: Optional[int] = None
    frequency: str = Field(..., pattern="^(daily|weekly|biweekly|monthly|quarterly|yearly|custom)$")
    interval_value: int = Field(default=1, ge=1)
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_date: date
    end_date: Optional[date] = None
    next_occurrence: Optional[date] = None
    is_active: bool = True
    auto_generate: bool = True
    reminder_days_before: Optional[int] = Field(None, ge=1, le=30)


class RecurringRuleCreate(RecurringRuleBase):
    pass


class RecurringRuleUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    category_id: Optional[int] = None
    frequency: Optional[str] = None
    interval_value: Optional[int] = None
    day_of_month: Optional[int] = None
    day_of_week: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    auto_generate: Optional[bool] = None
    reminder_days_before: Optional[int] = None


class RecurringRuleResponse(RecurringRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecurringRuleWithStats(RecurringRuleResponse):
    """Recurring rule with statistics."""
    total_generated: int = 0
    last_generated_at: Optional[datetime] = None
