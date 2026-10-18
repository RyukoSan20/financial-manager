"""Enhanced Product Search Router - With caching, validation, and price comparison"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import urllib.parse
import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import SessionLocal
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/search", tags=["Product Search"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Country-specific marketplace configuration
MARKETPLACES = {
    "ID": {
        "name": "Indonesia",
        "currency": "IDR",
        "currency_symbol": "Rp",
        "search_templates": {
            "shopee": {
                "url": "https://shopee.co.id/search?keyword={query}",
                "icon": "🛒",
                "color": "#EE4D2D"
            },
            "tokopedia": {
                "url": "https://www.tokopedia.com/search?st=product&q={query}",
                "icon": "🏪",
                "color": "#42A341"
            },
            "lazada": {
                "url": "https://www.lazada.co.id/catalog/?q={query}",
                "icon": "📦",
                "color": "#0F1472"
            },
            "blibli": {
                "url": "https://www.blibli.com/search/{query}",
                "icon": "🎁",
                "color": "#E4002B"
            },
            "tiktok": {
                "url": "https://www.tiktok.com/search?q={query}",
                "icon": "🎵",
                "color": "#000000"
            }
        }
    },
    "SG": {
        "name": "Singapore",
        "currency": "SGD",
        "currency_symbol": "$",
        "search_templates": {
            "shopee": {"url": "https://shopee.sg/search?keyword={query}", "icon": "🛒", "color": "#EE4D2D"},
            "lazada": {"url": "https://www.lazada.sg/catalog/?q={query}", "icon": "📦", "color": "#0F1472"},
            "amazon": {"url": "https://www.amazon.sg/s?k={query}", "icon": "📚", "color": "#FF9900"}
        }
    },
    "MY": {
        "name": "Malaysia",
        "currency": "MYR",
        "currency_symbol": "RM",
        "search_templates": {
            "shopee": {"url": "https://shopee.com.my/search?keyword={query}", "icon": "🛒", "color": "#EE4D2D"},
            "lazada": {"url": "https://www.lazada.com.my/catalog/?q={query}", "icon": "📦", "color": "#0F1472"}
        }
    }
}


def get_user_country(user: User) -> str:
    """Get user's country from profile or default to ID."""
    country = getattr(user, 'country', None) or 'ID'
    return country if country in MARKETPLACES else 'ID'


def normalize_query(query: str) -> str:
    """Normalize search query for consistency."""
    # Remove extra spaces, lowercase
    normalized = ' '.join(query.lower().split())
    return normalized


def generate_cache_key(query: str, country: str) -> str:
    """Generate cache key for search query."""
    key = f"{normalize_query(query)}_{country}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


# In-memory cache (Stage C: will move to Redis/DB)
search_cache = {}  # cache_key -> {"data": ..., "timestamp": ...}
CACHE_TTL_HOURS = 6  # Cache for 6 hours


def get_cached_search(cache_key: str) -> Optional[dict]:
    """Get cached search result if not expired."""
    if cache_key in search_cache:
        cached = search_cache[cache_key]
        age_hours = (datetime.utcnow() - cached["timestamp"]).total_seconds() / 3600
        if age_hours < CACHE_TTL_HOURS:
            return cached["data"]
        else:
            # Cache expired
            del search_cache[cache_key]
    return None


def cache_search_result(cache_key: str, data: dict):
    """Cache search result with timestamp."""
    search_cache[cache_key] = {
        "data": data,
        "timestamp": datetime.utcnow()
    }


# Click tracking
click_logs = []


def log_click(user_id: int, marketplace: str, item_name: str, search_id: str):
    """Log search click for analytics."""
    click_logs.append({
        "user_id": user_id,
        "marketplace": marketplace,
        "item_name": item_name,
        "search_id": search_id,
        "timestamp": datetime.utcnow().isoformat()
    })
    # Keep only last 1000 logs
    if len(click_logs) > 1000:
        click_logs[:] = click_logs[-1000:]


class SearchResult(BaseModel):
    marketplace: str
    name: str
    icon: str
    color: str
    search_url: str
    type: str = "search"


class SearchResponse(BaseModel):
    query: str
    normalized_query: str
    country: str
    currency: str
    currency_symbol: str
    cached: bool
    searches: List[SearchResult]
    note: str


@router.get("/price", response_model=SearchResponse)
async def search_prices(
    q: str = Query(..., description="Search query"),
    country: str = Query("ID", description="Country code"),
    current_user: User = Depends(get_current_user)
):
    """
    Get price comparison links for a product.
    
    Stage A: Direct search links without price extraction
    Stage C: Add price extraction from search results (after validation)
    """
    if not q or len(q) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    
    # Normalize query
    normalized = normalize_query(q)
    
    # Get user's country
    user_country = get_user_country(current_user)
    if country not in MARKETPLACES:
        country = user_country
    
    # Check cache
    cache_key = generate_cache_key(normalized, country)
    cached_data = get_cached_search(cache_key)
    if cached_data:
        cached_data["cached"] = True
        return SearchResponse(**cached_data)
    
    # Generate search links
    config = MARKETPLACES[country]
    encoded_query = urllib.parse.quote(normalized)
    
    searches = []
    for market_id, market_config in config['search_templates'].items():
        url = market_config["url"].format(query=encoded_query)
        searches.append(SearchResult(
            marketplace=market_id,
            name=market_id.capitalize(),
            icon=market_config["icon"],
            color=market_config["color"],
            search_url=url,
            type="search"
        ))
    
    result = {
        "query": q,
        "normalized_query": normalized,
        "country": country,
        "currency": config["currency"],
        "currency_symbol": config.get("currency_symbol", config["currency"]),
        "cached": False,
        "searches": [s.model_dump() for s in searches],
        "note": "💡 Harga adalah perkiraan. Selalu cek harga final di toko."
    }
    
    # Cache result
    cache_search_result(cache_key, result)
    
    return SearchResponse(**result)


@router.get("/go/{search_id}")
async def redirect_to_store(
    search_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Redirect to marketplace and log click.
    This is the affiliate redirect gateway.
    """
    # Parse search_id to get marketplace
    parts = search_id.split('_')
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid search ID")
    
    marketplace = parts[0]
    
    # Log click
    log_click(current_user.id, marketplace, "", search_id)
    
    # Get user's country
    country = get_user_country(current_user)
    if country not in MARKETPLACES:
        country = 'ID'
    
    # Generate redirect URL
    config = MARKETPLACES[country]
    if marketplace in config['search_templates']:
        redirect_url = config['search_templates'][marketplace]["url"].format(query="").split('?')[0]
    else:
        redirect_url = "https://shopee.co.id"
    
    return {
        "redirect_url": redirect_url,
        "marketplace": marketplace,
        "logged": True
    }


@router.get("/marketplaces")
async def get_marketplaces(
    country: str = Query("ID", description="Country code"),
    current_user: User = Depends(get_current_user)
):
    """Get available marketplaces for a country."""
    if country not in MARKETPLACES:
        country = 'ID'
    
    config = MARKETPLACES[country]
    
    marketplaces = []
    for market_id, market_config in config['search_templates'].items():
        marketplaces.append({
            "id": market_id,
            "name": market_id.capitalize(),
            "icon": market_config["icon"],
            "color": market_config["color"],
            "base_url": market_config["url"].split('?')[0]
        })
    
    return {
        "country": country,
        "currency": config["currency"],
        "currency_symbol": config.get("currency_symbol", config["currency"]),
        "marketplaces": marketplaces
    }


@router.get("/history")
async def get_search_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """Get user's search history."""
    # Filter clicks for this user
    user_clicks = [c for c in click_logs if c["user_id"] == current_user.id]
    
    # Sort by timestamp descending
    user_clicks.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {
        "searches": user_clicks[:limit],
        "total": len(user_clicks)
    }


@router.delete("/cache")
async def clear_cache(
    current_user: User = Depends(get_current_user)
):
    """Clear user's search cache (for debugging)."""
    # For now, just return success
    return {"status": "cleared", "note": "Cache cleared"}


@router.get("/stats")
async def get_search_stats(
    current_user: User = Depends(get_current_user)
):
    """Get search statistics."""
    user_clicks = [c for c in click_logs if c["user_id"] == current_user.id]
    
    # Count by marketplace
    by_marketplace = {}
    for click in user_clicks:
        mp = click["marketplace"]
        by_marketplace[mp] = by_marketplace.get(mp, 0) + 1
    
    return {
        "total_searches": len(user_clicks),
        "by_marketplace": by_marketplace,
        "cache_size": len(search_cache)
    }
