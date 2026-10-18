"""Product Search Router - Price comparison via marketplace search"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import urllib.parse
import hashlib
from datetime import datetime, timedelta

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
        "search_templates": {
            "shopee": "https://shopee.co.id/search?keyword={query}",
            "tokopedia": "https://www.tokopedia.com/search?st=product&q={query}",
            "lazada": "https://www.lazada.co.id/catalog/?q={query}",
            "blibli": "https://www.blibli.com/search/{query}",
            "tiktok": "https://www.tiktok.com/search?q={query}",
        },
        "affiliate_templates": {}
    },
    "SG": {
        "name": "Singapore",
        "currency": "SGD",
        "search_templates": {
            "shopee": "https://shopee.sg/search?keyword={query}",
            "lazada": "https://www.lazada.sg/catalog/?q={query}",
            "amazon": "https://www.amazon.sg/s?k={query}",
        },
        "affiliate_templates": {}
    },
    "MY": {
        "name": "Malaysia",
        "currency": "MYR",
        "search_templates": {
            "shopee": "https://shopee.com.my/search?keyword={query}",
            "lazada": "https://www.lazada.com.my/catalog/?q={query}",
            "amazon": "https://www.amazon.com.my/s?k={query}",
        },
        "affiliate_templates": {}
    }
}


def get_user_country(user: User) -> str:
    """Get user's country from profile or default to ID."""
    country = getattr(user, 'country', None) or 'ID'
    return country if country in MARKETPLACES else 'ID'


def generate_search_links(query: str, country: str = 'ID') -> list:
    """Generate search links for all marketplaces in a country."""
    if country not in MARKETPLACES:
        country = 'ID'
    
    config = MARKETPLACES[country]
    encoded_query = urllib.parse.quote(query)
    
    links = []
    for market_id, template in config['search_templates'].items():
        url = template.format(query=encoded_query)
        links.append({
            "id": f"{market_id}_{hashlib.md5(f'{query}_{market_id}'.encode()).hexdigest()[:8]}",
            "marketplace": market_id,
            "name": market_id.capitalize(),
            "search_url": url,
            "type": "search"
        })
    
    return links


# In-memory click tracking (for affiliate redirect)
click_logs = {}


@router.get("/price")
async def search_prices(
    q: str = Query(..., description="Search query"),
    country: str = Query("ID", description="Country code"),
    current_user: User = Depends(get_current_user)
):
    """
    Get price comparison links for a product.
    Returns search links for each marketplace.
    
    This is Stage A - direct search links without AI extraction.
    Stage B will add price extraction after validation.
    """
    if not q or len(q) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    
    # Normalize query
    query = q.strip().lower()
    
    # Get user's country
    user_country = get_user_country(current_user)
    if country not in MARKETPLACES:
        country = user_country
    
    # Generate search links
    links = generate_search_links(query, country)
    
    return {
        "query": query,
        "country": country,
        "currency": MARKETPLACES[country]['currency'],
        "searches": links,
        "note": "Prices shown are estimates from search results. Verify final price at store."
    }


@router.get("/go/{result_id}")
async def redirect_to_store(
    result_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Redirect to marketplace and log click.
    This is the affiliate redirect gateway.
    
    For Stage A: Direct redirect (no affiliate tracking yet)
    For Stage D: Will add affiliate URL transformation
    """
    # Parse result_id to get marketplace and query
    parts = result_id.split('_')
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid result ID")
    
    marketplace = parts[0]
    query_hash = '_'.join(parts[1:])
    
    # Log click
    log_key = f"{current_user.id}_{result_id}"
    click_logs[log_key] = {
        "user_id": current_user.id,
        "marketplace": marketplace,
        "timestamp": datetime.utcnow().isoformat(),
        "redirect_url": None  # Will be set after URL transformation
    }
    
    # Get user's country for marketplace selection
    country = get_user_country(current_user)
    if country not in MARKETPLACES:
        country = 'ID'
    
    # Generate redirect URL (Stage A: direct search)
    if marketplace in MARKETPLACES[country]['search_templates']:
        # This is a search link, redirect to search
        # We don't have the original query here, so redirect to main page
        base_urls = {
            "shopee": "https://shopee.co.id",
            "tokopedia": "https://www.tokopedia.com",
            "lazada": "https://www.lazada.co.id",
            "blibli": "https://www.blibli.com",
            "tiktok": "https://www.tiktok.com",
            "amazon": "https://www.amazon.com"
        }
        redirect_url = base_urls.get(marketplace, "https://shopee.co.id")
    else:
        redirect_url = "https://shopee.co.id"
    
    # Update log with URL
    click_logs[log_key]["redirect_url"] = redirect_url
    
    return {
        "redirect_url": redirect_url,
        "marketplace": marketplace,
        "logged": True
    }


@router.get("/history")
async def get_search_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """Get user's recent searches (for Stage C: caching)."""
    # For now, return empty - will implement search history later
    return {
        "searches": [],
        "note": "Search history coming soon"
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
    for market_id, template in config['search_templates'].items():
        marketplaces.append({
            "id": market_id,
            "name": market_id.capitalize(),
            "search_url_template": template.replace("{query}", "")
        })
    
    return {
        "country": country,
        "currency": config['currency'],
        "marketplaces": marketplaces
    }
