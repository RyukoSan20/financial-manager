"""Shopping Tracker Router - Items, Wishlist, Budget"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
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


# Pydantic models
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
    last_price: Optional[float] = None

    class Config:
        from_attributes = True


class WishlistItemCreate(BaseModel):
    name: str
    target_price: float = 0
    priority: str = "medium"  # low, medium, high
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


# In-memory storage (replace with DB table in production)
shopping_items_db = {}  # user_id -> list of items
wishlist_items_db = {}  # user_id -> list of items


def get_user_items(user_id: int):
    if user_id not in shopping_items_db:
        shopping_items_db[user_id] = []
    return shopping_items_db[user_id]


def get_user_wishlist(user_id: int):
    if user_id not in wishlist_items_db:
        wishlist_items_db[user_id] = []
    return wishlist_items_db[user_id]


@router.get("/items", response_model=List[ShoppingItemResponse])
async def get_shopping_items(current_user: User = Depends(get_current_user)):
    """Get all tracked shopping items for user."""
    items = get_user_items(current_user.id)
    return items


@router.post("/items", response_model=ShoppingItemResponse)
async def add_shopping_item(
    item: ShoppingItemCreate,
    current_user: User = Depends(get_current_user)
):
    """Add new item to track."""
    items = get_user_items(current_user.id)
    
    # Check if item already exists
    existing = next((i for i in items if i["name"].lower() == item.name.lower()), None)
    if existing:
        return existing
    
    new_item = {
        "id": len(items) + 1,
        "name": item.name,
        "current_price": item.current_price,
        "category": item.category,
        "notes": item.notes,
        "last_price": None
    }
    items.append(new_item)
    return new_item


@router.put("/items/{item_id}", response_model=ShoppingItemResponse)
async def update_shopping_item(
    item_id: int,
    item: ShoppingItemCreate,
    current_user: User = Depends(get_current_user)
):
    """Update tracked item."""
    items = get_user_items(current_user.id)
    
    for i, existing in enumerate(items):
        if existing["id"] == item_id:
            items[i] = {
                **existing,
                "name": item.name,
                "current_price": item.current_price,
                "category": item.category,
                "notes": item.notes,
                "last_price": existing["current_price"] if existing["current_price"] != item.current_price else existing.get("last_price")
            }
            return items[i]
    
    raise HTTPException(status_code=404, detail="Item not found")


@router.delete("/items/{item_id}")
async def delete_shopping_item(
    item_id: int,
    current_user: User = Depends(get_current_user)
):
    """Remove item from tracking."""
    items = get_user_items(current_user.id)
    
    for i, item in enumerate(items):
        if item["id"] == item_id:
            items.pop(i)
            return {"status": "deleted"}
    
    raise HTTPException(status_code=404, detail="Item not found")


# Wishlist endpoints
@router.get("/wishlist", response_model=List[WishlistItemResponse])
async def get_wishlist(current_user: User = Depends(get_current_user)):
    """Get user wishlist."""
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
        if item["id"] == item_id:
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
        if item["id"] == item_id:
            item["purchased"] = True
            return {"status": "purchased", "item": item}
    
    raise HTTPException(status_code=404, detail="Item not found")
