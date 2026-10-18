"""
Shopping Router - Full CRUD for shopping items and wishlist.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import SessionLocal
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/shopping", tags=["Shopping"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic Models
class ShoppingItemCreate(BaseModel):
    name: str
    current_price: float = 0
    category: str = "general"
    notes: Optional[str] = None


class ShoppingItemResponse(BaseModel):
    id: int
    name: str
    current_price: float
    category: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class WishlistItemCreate(BaseModel):
    name: str
    target_price: float = 0
    priority: str = "medium"
    notes: Optional[str] = None
    target_date: Optional[str] = None


class WishlistItemResponse(BaseModel):
    id: int
    name: str
    target_price: float
    priority: str
    notes: Optional[str] = None
    target_date: Optional[str] = None
    purchased: bool = False

    class Config:
        from_attributes = True


# In-memory storage (per user)
shopping_items_db = {}
wishlist_items_db = {}


def get_user_items(user_id: int):
    if user_id not in shopping_items_db:
        shopping_items_db[user_id] = []
    return shopping_items_db[user_id]


def get_user_wishlist(user_id: int):
    if user_id not in wishlist_items_db:
        wishlist_items_db[user_id] = []
    return wishlist_items_db[user_id]


@router.get("/items")
async def get_shopping_items(
    transaction_id: Optional[int] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get shopping items for the user."""
    items = get_user_items(current_user.id)
    return items[:limit]


@router.post("/items", response_model=ShoppingItemResponse)
async def add_shopping_item(
    item: ShoppingItemCreate,
    current_user: User = Depends(get_current_user)
):
    """Add new item to track."""
    items = get_user_items(current_user.id)
    
    # Check if item already exists
    existing = next((i for i in items if i.get("name", "").lower() == item.name.lower()), None)
    if existing:
        return existing
    
    new_item = {
        "id": len(items) + 1,
        "name": item.name,
        "current_price": item.current_price,
        "category": item.category,
        "notes": item.notes
    }
    items.append(new_item)
    return new_item


@router.put("/items/{item_id}", response_model=ShoppingItemResponse)
async def update_shopping_item(
    item_id: int,
    item: ShoppingItemCreate,
    current_user: User = Depends(get_current_user)
):
    """Update a shopping item."""
    items = get_user_items(current_user.id)
    
    for i, existing in enumerate(items):
        if existing.get("id") == item_id:
            items[i] = {
                "id": item_id,
                "name": item.name,
                "current_price": item.current_price,
                "category": item.category,
                "notes": item.notes
            }
            return items[i]
    
    raise HTTPException(status_code=404, detail="Item not found")


@router.delete("/items/{item_id}")
async def delete_shopping_item(
    item_id: int,
    current_user: User = Depends(get_current_user)
):
    """Delete a shopping item."""
    items = get_user_items(current_user.id)
    
    for i, item in enumerate(items):
        if item.get("id") == item_id:
            items.pop(i)
            return {"status": "deleted"}
    
    raise HTTPException(status_code=404, detail="Item not found")


@router.get("/wishlist")
async def get_wishlist(current_user: User = Depends(get_current_user)):
    """Get user's wishlist."""
    return get_user_wishlist(current_user.id)


@router.post("/wishlist", response_model=WishlistItemResponse)
async def add_to_wishlist(
    item: WishlistItemCreate,
    current_user: User = Depends(get_current_user)
):
    """Add item to wishlist."""
    wishlist = get_user_wishlist(current_user.id)
    
    new_item = {
        "id": len(wishlist) + 1,
        "name": item.name,
        "target_price": item.target_price,
        "priority": item.priority,
        "notes": item.notes,
        "target_date": item.target_date,
        "purchased": False
    }
    wishlist.append(new_item)
    return new_item


@router.delete("/wishlist/{item_id}")
async def remove_from_wishlist(
    item_id: int,
    current_user: User = Depends(get_current_user)
):
    """Remove item from wishlist."""
    wishlist = get_user_wishlist(current_user.id)
    
    for i, item in enumerate(wishlist):
        if item.get("id") == item_id:
            wishlist.pop(i)
            return {"status": "deleted"}
    
    raise HTTPException(status_code=404, detail="Item not found")


@router.post("/wishlist/{item_id}/purchase")
async def mark_purchased(
    item_id: int,
    current_user: User = Depends(get_current_user)
):
    """Mark wishlist item as purchased."""
    wishlist = get_user_wishlist(current_user.id)
    
    for item in wishlist:
        if item.get("id") == item_id:
            item["purchased"] = True
            return {"status": "purchased", "item": item}
    
    raise HTTPException(status_code=404, detail="Item not found")


@router.get("/price-history/{item_name}")
async def get_price_history(
    item_name: str,
    current_user: User = Depends(get_current_user)
):
    """Get price history for an item."""
    return {
        "item_name": item_name,
        "history": [],
        "average": 0,
        "trend": "stable"
    }


@router.get("/price-comparison")
async def compare_prices(
    item_name: str,
    current_user: User = Depends(get_current_user)
):
    """Compare prices across stores/time."""
    return {
        "item_name": item_name,
        "current_price": 0,
        "average_price": 0,
        "lowest_price": 0,
        "highest_price": 0,
        "price_trend": "stable"
    }


@router.post("/extract-items")
async def extract_items_from_receipt(
    ocr_text: str,
    current_user: User = Depends(get_current_user)
):
    """Extract items from OCR text."""
    from app.modules.ledger.shopping.receipt_item_extractor import extract_receipt_items
    
    items = extract_receipt_items(ocr_text)
    
    return {
        "items": [
            {
                "name": item.name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price
            }
            for item in items
        ],
        "total_items": len(items)
    }
