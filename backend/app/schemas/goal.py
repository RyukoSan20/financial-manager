"""Goal schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class GoalBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    target_amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=10)
    target_date: date
    goal_type: str = Field(..., pattern="^(savings|debt_payoff|investment|purchase|emergency_fund)$")
    account_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class GoalCreate(GoalBase):
    current_amount: Decimal = Field(default=Decimal("0"))


class GoalUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    target_amount: Optional[Decimal] = None
    target_date: Optional[date] = None
    goal_type: Optional[str] = None
    account_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class GoalResponse(GoalBase):
    id: int
    current_amount: Decimal
    is_completed: bool
    completed_at: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GoalWithProgress(GoalResponse):
    """Goal with calculated progress."""
    progress_percent: float  # 0-100+
    remaining_amount: Decimal
    days_remaining: int
    required_monthly: Decimal
    required_weekly: Decimal
    required_daily: Decimal
    on_track: bool
    estimated_completion: Optional[date]
    status: str  # on_track, behind_track, completed, overdue


class GoalContributionBase(BaseModel):
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="IDR", max_length=10)
    date: Optional[date] = None
    notes: Optional[str] = None


class GoalContributionCreate(BaseModel):
    """Create contribution - all fields optional except amount."""
    amount: Decimal = Field(..., gt=0)
    currency: Optional[str] = "IDR"
    date: Optional[date] = None
    notes: Optional[str] = None


class GoalContributionResponse(GoalContributionBase):
    id: int
    goal_id: int
    transaction_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
