"""
Shopping Router - API endpoints for shopping item tracking.
"""
from fastapi import APIRouter, Depends
from typing import List, Optional
from pydantic import BaseModel

from app.core.security import get_current_user

router = APIRouter(prefix="/api/shopping", tags=["Shopping Tracker"])


class ShoppingItemResponse(BaseModel):
    id: int
    item_name: str
    quantity: float
    unit_price: float
    total_price: float
    category: Optional[str]
    source: str


class PriceComparison(BaseModel):
    item_name: str
    current_price: float
    average_price: float
    lowest_price: float
    highest_price: float
    price_trend: str  # "increasing", "decreasing", "stable"


@router.get("/items")
async def get_shopping_items(
    transaction_id: Optional[int] = None,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get shopping items for the user."""
    return {"items": [], "total": 0}


@router.get("/price-history/{item_name}")
async def get_price_history(
    item_name: str,
    current_user = Depends(get_current_user)
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
    current_user = Depends(get_current_user)
):
    """Compare prices across stores/time."""
    return PriceComparison(
        item_name=item_name,
        current_price=0,
        average_price=0,
        lowest_price=0,
        highest_price=0,
        price_trend="stable"
    )


@router.get("/wishlist")
async def get_wishlist(
    current_user = Depends(get_current_user)
):
    """Get user's wishlist."""
    return {"items": [], "total": 0}


@router.post("/wishlist")
async def add_to_wishlist(
    item_name: str,
    target_price: float = None,
    current_user = Depends(get_current_user)
):
    """Add item to wishlist."""
    return {"id": 1, "item_name": item_name}


@router.delete("/wishlist/{item_id}")
async def remove_from_wishlist(
    item_id: int,
    current_user = Depends(get_current_user)
):
    """Remove item from wishlist."""
    return {"status": "deleted"}


@router.post("/extract-items")
async def extract_items_from_receipt(
    ocr_text: str,
    current_user = Depends(get_current_user)
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
