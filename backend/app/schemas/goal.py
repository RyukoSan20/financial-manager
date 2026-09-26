"""Goal schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class GoalBase(BaseModel):
    name: str
    description: Optional[str] = None
    target_amount: float
    currency: str = "IDR"
    target_date: Optional[str] = None
    goal_type: str = "savings"
    account_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class GoalCreate(GoalBase):
    current_amount: float = 0


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = None
    target_date: Optional[str] = None
    goal_type: Optional[str] = None
    account_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class GoalResponse(GoalBase):
    id: int
    current_amount: float
    is_completed: bool
    completed_at: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class GoalContributionCreate(BaseModel):
    """Create contribution - only amount is required."""
    amount: float = Field(..., gt=0)
    currency: str = "IDR"
    date: Optional[str] = None
    notes: Optional[str] = None


class GoalContributionResponse(BaseModel):
    id: int
    goal_id: int
    amount: float
    currency: str
    date: str
    notes: Optional[str] = None
    transaction_id: Optional[int] = None
    created_at: str

    class Config:
        from_attributes = True
