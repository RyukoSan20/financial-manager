"""Account schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class AccountBase(BaseModel):
    name: str = Field(..., max_length=100)
    account_type: str = Field(..., pattern="^(cash|bank|e-wallet|credit_card)$")
    currency: str = Field(default="IDR", max_length=10)
    is_credit: bool = False
    credit_limit: Optional[Decimal] = None


class AccountCreate(AccountBase):
    balance: Decimal = Field(default=Decimal("0"))


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    account_type: Optional[str] = None
    currency: Optional[str] = None
    balance: Optional[Decimal] = None
    is_active: Optional[bool] = None
    is_credit: Optional[bool] = None
    credit_limit: Optional[Decimal] = None


class AccountResponse(AccountBase):
    id: int
    balance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
