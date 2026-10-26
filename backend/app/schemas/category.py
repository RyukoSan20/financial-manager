"""Category schemas."""

from app.schemas.base import EmptyStringAsNone
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CategoryBase(EmptyStringAsNone):
    name: str = Field(..., max_length=100)
    # The name of the same category in the other languages.
    name_en: Optional[str] = Field(None, max_length=100)
    name_ja: Optional[str] = Field(None, max_length=100)
    # Names a built-in category without depending on any language.
    system_key: Optional[str] = Field(None, max_length=60)
    type: str = Field(..., pattern="^(income|expense)$")
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[int] = None


class CategoryCreate(CategoryBase, EmptyStringAsNone):
    pass


class CategoryUpdate(EmptyStringAsNone):
    name: Optional[str] = Field(None, max_length=100)
    name_en: Optional[str] = Field(None, max_length=100)
    name_ja: Optional[str] = Field(None, max_length=100)
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True
