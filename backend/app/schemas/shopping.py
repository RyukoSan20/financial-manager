"""Shopping Kanban Board Schemas"""
from typing import List, Optional, Dict
from datetime import datetime
from pydantic import BaseModel, Field


class ShoppingItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(default=1, ge=1)
    price: Optional[int] = Field(default=None, description="Harga satuan (Rupiah)")
    stage: str = Field(default='wishlist', pattern="^(wishlist|to_buy|ordered|shipped|received|cancelled)$")
    marketplace: Optional[str] = Field(default=None, max_length=50, description="shopee, tokopedia, dll")
    product_url: Optional[str] = Field(default=None, max_length=500)
    category_id: Optional[int] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    rating: Optional[int] = Field(default=None, ge=1, le=5, description="1-5 stars")
    tracking_number: Optional[str] = Field(default=None, max_length=64)
    courier: Optional[str] = Field(default=None, max_length=32)


class ShoppingItemCreate(ShoppingItemBase):
    pass


class ShoppingItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    quantity: Optional[int] = Field(default=None, ge=1)
    price: Optional[int] = None
    stage: Optional[str] = Field(default=None, pattern="^(wishlist|to_buy|ordered|shipped|received|cancelled)$")
    marketplace: Optional[str] = Field(default=None, max_length=50)
    product_url: Optional[str] = Field(default=None, max_length=500)
    category_id: Optional[int] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    tracking_number: Optional[str] = Field(default=None, max_length=64)
    courier: Optional[str] = Field(default=None, max_length=32)


class ShoppingItemMove(BaseModel):
    stage: str = Field(..., pattern="^(wishlist|to_buy|ordered|shipped|received|cancelled)$")
    position: Optional[int] = Field(default=None, ge=0, description="New position in stage")


class ShoppingItemResponse(BaseModel):
    id: int
    user_id: int
    name: str
    quantity: int
    price: Optional[int]
    stage: str
    position: int
    marketplace: Optional[str]
    product_url: Optional[str]
    category_id: Optional[int]
    tracking_number: Optional[str]
    courier: Optional[str]
    rating: Optional[int]
    notes: Optional[str]
    purchased_at: Optional[datetime]
    received_at: Optional[datetime]
    transaction_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class StageSummary(BaseModel):
    stage: str
    label: str
    icon: str
    count: int
    total: int


class ShoppingBoardResponse(BaseModel):
    stages: List[StageSummary]
    items_by_stage: Dict[str, List[ShoppingItemResponse]]
    total_budget: int
    total_spent: int
    remaining_budget: int
