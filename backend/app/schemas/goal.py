"""Goal schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class GoalBase(BaseModel):
    name: str = Field(max_length=100)
    description: Optional[str] = None
    target_amount: float = Field(gt=0)
    currency: str = "IDR"
    target_date: Optional[date] = None
    goal_type: str = "savings"
    account_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class GoalCreate(GoalBase):
    current_amount: float = 0


class GoalUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    target_amount: Optional[float] = None
    target_date: Optional[date] = None
    goal_type: Optional[str] = None
    account_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class GoalResponse(GoalBase):
    id: int
    current_amount: float
    is_completed: bool
    completed_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GoalWithProgress(GoalResponse):
    """Goal with calculated progress."""
    progress_percent: float
    remaining_amount: float
    days_remaining: int
    required_monthly: float
    required_weekly: float
    required_daily: float
    on_track: bool
    estimated_completion: Optional[date] = None
    status: str


class GoalContributionCreate(BaseModel):
    """Create contribution - only amount is required."""
    amount: Optional[float] = None
    currency: Optional[str] = None
    date: Optional[str] = None
    notes: Optional[str] = None


class GoalContributionResponse(BaseModel):
    id: int
    goal_id: int
    amount: float
    currency: str
    date: date
    notes: Optional[str] = None
    transaction_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
