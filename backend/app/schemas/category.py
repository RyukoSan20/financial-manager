"""Category schemas."""

from app.schemas.base import EmptyStringAsNone
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CategoryBase(EmptyStringAsNone):
    name: str = Field(..., max_length=100)
    type: str = Field(..., pattern="^(income|expense)$")
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[int] = None


class CategoryCreate(CategoryBase, EmptyStringAsNone):
    pass


class CategoryUpdate(EmptyStringAsNone):
    name: Optional[str] = Field(None, max_length=100)
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True
