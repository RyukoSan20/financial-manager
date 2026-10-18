"""
Location Router - API endpoints for geofinancial analytics.
"""
from fastapi import APIRouter, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.security import get_current_user
from app.core.database import SessionLocal

router = APIRouter(prefix="/api/location", tags=["Location Analytics"])


class LocationStats(BaseModel):
    merchant_name: str
    normalized_name: str
    city: Optional[str]
    category: str
    total_transactions: int
    total_amount: float
    average_transaction: float


class SpendingHeatmap(BaseModel):
    region: str
    total_amount: float
    transaction_count: int
    percentage: float


@router.get("/stats")
async def get_spending_by_location(
    period: str = "current",  # "current", "last_month", "3_months"
    limit: int = 20,
    current_user = Depends(get_current_user)
):
    """Get spending statistics by location/merchant."""
    user_id = current_user.id if hasattr(current_user, 'id') else None
    
    # This would query from spending_by_location table
    # For now, return mock data
    return {
        "stats": [],
        "total_spending": 0,
        "period": period
    }


@router.get("/heatmap")
async def get_spending_heatmap(
    current_user = Depends(get_current_user)
):
    """Get spending heatmap data by region."""
    return {
        "heatmap": [
            {"region": "Jakarta Selatan", "amount": 0, "count": 0},
            {"region": "Jakarta Pusat", "amount": 0, "count": 0},
            {"region": "Jakarta Barat", "amount": 0, "count": 0},
            {"region": "Jakarta Timur", "amount": 0, "count": 0},
            {"region": "Jakarta Utara", "amount": 0, "count": 0},
            {"region": "Tangerang", "amount": 0, "count": 0},
            {"region": "Bandung", "amount": 0, "count": 0},
            {"region": "Surabaya", "amount": 0, "count": 0},
        ]
    }


@router.get("/top-locations")
async def get_top_locations(
    limit: int = 10,
    current_user = Depends(get_current_user)
):
    """Get top spending locations."""
    return {
        "locations": [],
        "total_count": 0
    }


@router.post("/normalize")
async def normalize_merchant_name(
    raw_name: str,
    current_user = Depends(get_current_user)
):
    """Normalize a merchant name using fuzzy matching."""
    from app.modules.ledger.location.normalizer import merchant_normalizer
    
    result = merchant_normalizer.normalize(raw_name)
    
    return {
        "original": result.original,
        "normalized": result.normalized,
        "category": result.category,
        "confidence": result.confidence
    }
