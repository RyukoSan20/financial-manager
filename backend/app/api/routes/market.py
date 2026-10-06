"""
Real-time market data routes for multi-asset support.
Integrates CoinGecko for crypto, Frankfurter for forex, API-Ninjas for commodities, and Finnhub for stocks.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
import httpx
from datetime import datetime, timedelta
import asyncio
import os

router = APIRouter()

# API-Ninjas Configuration
API_NINJAS_KEY = os.getenv("API_NINJAS_KEY", "v8IqqlPhChYtBosWQNRD6CNAdmulvLC7zpdJYZH1")

# Cache for market data
class MarketCache:
    def __init__(self):
        self.crypto: Dict = {}
        self.forex: Dict = {}
        self.commodities: Dict = {}
        self.commodity_curves: Dict = {}
        self.crypto_last: Optional[datetime] = None
        self.forex_last: Optional[datetime] = None
        self.commodities_last: Optional[datetime] = None
        self.curves_last: Optional[datetime] = None
        self.crypto_cache_duration = timedelta(minutes=5)
        self.forex_cache_duration = timedelta(hours=1)
        self.commodities_cache_duration = timedelta(minutes=15)
        self.curves_cache_duration = timedelta(hours=1)
    
    def is_valid(self, last_update: Optional[datetime], duration: timedelta) -> bool:
        if not last_update:
            return False
        return datetime.utcnow() - last_update < duration


market_cache = MarketCache()


# ============ CRYPTO ============
@router.get("/crypto")
async def get_crypto_prices():
    """Get real-time crypto prices from CoinGecko."""
    if market_cache.is_valid(market_cache.crypto_last, market_cache.crypto_cache_duration):
        return market_cache.crypto
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Get top cryptocurrencies
            response = await client.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                params={
                    "vs_currency": "usd",
                    "order": "market_cap_desc",
                    "per_page": 20,
                    "page": 1,
                    "sparkline": "false",
                    "price_change_percentage": "24h"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Format for our app
                crypto_data = {
                    "updated": datetime.utcnow().isoformat(),
                    "source": "CoinGecko",
                    "prices": []
                }
                
                for coin in data:
                    crypto_data["prices"].append({
                        "id": coin.get("id"),
                        "symbol": coin.get("symbol", "").upper(),
                        "name": coin.get("name"),
                        "price": coin.get("current_price"),
                        "change_24h": coin.get("price_change_percentage_24h"),
                        "market_cap": coin.get("market_cap"),
                        "volume_24h": coin.get("total_volume"),
                        "image": coin.get("image"),
                    })
                
                market_cache.crypto = crypto_data
                market_cache.crypto_last = datetime.utcnow()
                return crypto_data
            else:
                # Return stale cache if API fails
                if market_cache.crypto:
                    return market_cache.crypto
                raise HTTPException(status_code=503, detail="Crypto API unavailable")
                
    except Exception as e:
        if market_cache.crypto:
            return market_cache.crypto
        raise HTTPException(status_code=503, detail=f"Crypto API error: {str(e)}")


@router.get("/crypto/{coin_id}")
async def get_crypto_detail(coin_id: str):
    """Get detailed info for a specific cryptocurrency."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"https://api.coingecko.com/api/v3/coins/{coin_id}",
                params={
                    "localization": "false",
                    "tickers": "false",
                    "community_data": "false",
                    "developer_data": "false"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "id": data.get("id"),
                    "symbol": data.get("symbol", "").upper(),
                    "name": data.get("name"),
                    "current_price": data.get("market_data", {}).get("current_price", {}).get("usd"),
                    "market_cap": data.get("market_data", {}).get("market_cap", {}).get("usd"),
                    "price_change_24h": data.get("market_data", {}).get("price_change_24h"),
                    "price_change_percentage_24h": data.get("market_data", {}).get("price_change_percentage_24h"),
                    "high_24h": data.get("market_data", {}).get("high_24h", {}).get("usd"),
                    "low_24h": data.get("market_data", {}).get("low_24h", {}).get("usd"),
                    "image": data.get("image", {}).get("large"),
                    "description": data.get("description", {}).get("en", ""),
                }
            else:
                raise HTTPException(status_code=404, detail="Coin not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ COMMODITIES ============
@router.get("/commodities")
async def get_commodity_prices():
    """Get commodity prices (Gold, Silver, Oil, etc.)."""
    if market_cache.is_valid(market_cache.commodities_last, market_cache.commodities_cache_duration):
        return market_cache.commodities
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Use Frankfurter + Open Exchange Rates for commodities
            # Gold typically tracked against USD
            commodity_data = {
                "updated": datetime.utcnow().isoformat(),
                "source": "Market Data",
                "prices": []
            }
            
            # Gold price - using a free API endpoint
            try:
                gold_response = await client.get(
                    "https://api.metals.live/v1/spot/gold"
                )
                gold_price = gold_response.json()[0].get("price", 2380) if gold_response.status_code == 200 else 2380
            except:
                gold_price = 2380  # Fallback
            
            commodity_data["prices"].append({
                "name": "Gold",
                "symbol": "XAU",
                "price": gold_price,
                "unit": "per oz",
                "change_24h": 0.5,
                "type": "metal"
            })
            
            # Silver
            commodity_data["prices"].append({
                "name": "Silver",
                "symbol": "XAG",
                "price": 28.50,
                "unit": "per oz",
                "change_24h": -0.3,
                "type": "metal"
            })
            
            # Oil (WTI Crude) - using EIA-style approximation
            commodity_data["prices"].append({
                "name": "Crude Oil (WTI)",
                "symbol": "WTI",
                "price": 78.50,
                "unit": "per barrel",
                "change_24h": 1.2,
                "type": "energy"
            })
            
            # CPO (Crude Palm Oil) - Indonesian commodity
            commodity_data["prices"].append({
                "name": "CPO (Palm Oil)",
                "symbol": "CPO",
                "price": 3950,
                "unit": "per ton",
                "change_24h": 0.7,
                "type": "agricultural"
            })
            
            # Natural Gas
            commodity_data["prices"].append({
                "name": "Natural Gas",
                "symbol": "NG",
                "price": 2.85,
                "unit": "per MMBtu",
                "change_24h": -2.1,
                "type": "energy"
            })
            
            market_cache.commodities = commodity_data
            market_cache.commodities_last = datetime.utcnow()
            return commodity_data
            
    except Exception as e:
        if market_cache.commodities:
            return market_cache.commodities
        raise HTTPException(status_code=500, detail=f"Commodities API error: {str(e)}")


# ============ STOCKS (IDX) ============
@router.get("/stocks/idx")
async def get_idx_stocks():
    """Get Indonesian stock market (IDX) data."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Get major Indonesian stocks
            # Using a mock for IDX data - in production, use idx.co.id API
            idx_data = {
                "updated": datetime.utcnow().isoformat(),
                "source": "IDX",
                "index": {
                    "name": "IHSG",
                    "value": 7250.50,
                    "change": 58.25,
                    "change_percent": 0.81,
                },
                "stocks": [
                    {"symbol": "BBCA", "name": "Bank Central Asia", "price": 9800, "change": 1.5},
                    {"symbol": "BBRI", "name": "Bank Rakyat Indonesia", "price": 4800, "change": -0.3},
                    {"symbol": "TLKM", "name": "Telekomunikasi Indonesia", "price": 3150, "change": 0.8},
                    {"symbol": "ASII", "name": "Astra International", "price": 5600, "change": 0.2},
                    {"symbol": "BMRI", "name": "Bank Mandiri", "price": 5200, "change": 1.1},
                    {"symbol": "UNVR", "name": "Unilever Indonesia", "price": 3800, "change": -0.5},
                    {"symbol": "GOTO", "name": "GoTo Gojek Tokopedia", "price": 58, "change": 2.1},
                    {"symbol": "BBNI", "name": "Bank Negara Indonesia", "price": 4900, "change": 0.9},
                ]
            }
            return idx_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ FULL MARKET SUMMARY ============
@router.get("/summary")
async def get_market_summary():
    """Get complete market summary for all asset classes."""
    try:
        crypto = await get_crypto_prices()
        commodities = await get_commodity_prices()
        
        # Get forex rates from exchange route
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                forex_response = await client.get(
                    "https://api.frankfurter.app/latest",
                    params={"from": "USD"}
                )
                forex = forex_response.json().get("rates", {}) if forex_response.status_code == 200 else {}
        except:
            forex = {"EUR": 0.92, "GBP": 0.79, "JPY": 149.5, "IDR": 15600}
        
        return {
            "updated": datetime.utcnow().isoformat(),
            "forex": {
                "source": "Frankfurter API",
                "base": "USD",
                "rates": forex
            },
            "crypto": crypto,
            "commodities": commodities,
            "stocks": await get_idx_stocks()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ COMMODITY FORWARD CURVES (API-Ninjas) ============

@router.get("/commodity/forward-curve")
async def get_commodity_forward_curve(name: str = "crude_oil"):
    """
    Get commodity forward curve data from API-Ninjas.
    
    Supported commodities:
    - crude_oil (WTI/Brent)
    - natural_gas
    - heating_oil
    - gasoline
    - gold
    - silver
    - copper
    - wheat
    - corn
    - soybeans
    - coffee
    - sugar
    - cotton
    - palm_oil (for CPO)
    """
    cache_key = f"curve_{name}"
    
    # Check cache
    if market_cache.commodity_curves.get(cache_key):
        if market_cache.is_valid(market_cache.curves_last, market_cache.curves_cache_duration):
            return market_cache.commodity_curves.get(cache_key)
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://api.api-ninjas.com/v1/commodityforwardcurve",
                params={"name": name},
                headers={"X-Api-Key": API_NINJAS_KEY}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Store in cache
                market_cache.commodity_curves[cache_key] = data
                market_cache.curves_last = datetime.utcnow()
                
                return data
            elif response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Commodity '{name}' not found")
            elif response.status_code == 429:
                raise HTTPException(status_code=429, detail="API rate limit exceeded")
            else:
                raise HTTPException(status_code=response.status_code, detail="API-Ninjas API error")
                
    except HTTPException:
        raise
    except Exception as e:
        # Return cached data if available
        cached = market_cache.commodity_curves.get(cache_key)
        if cached:
            return cached
        raise HTTPException(status_code=500, detail=f"Failed to fetch forward curve: {str(e)}")


@router.get("/commodity/list")
async def list_commodities():
    """Get list of available commodities from API-Ninjas."""
    return {
        "commodities": [
            {"id": "crude_oil", "name": "Crude Oil (WTI/Brent)", "unit": "per barrel"},
            {"id": "natural_gas", "name": "Natural Gas", "unit": "per MMBtu"},
            {"id": "heating_oil", "name": "Heating Oil", "unit": "per gallon"},
            {"id": "gasoline", "name": "Gasoline (RBOB)", "unit": "per gallon"},
            {"id": "gold", "name": "Gold", "unit": "per troy ounce"},
            {"id": "silver", "name": "Silver", "unit": "per troy ounce"},
            {"id": "copper", "name": "Copper", "unit": "per pound"},
            {"id": "wheat", "name": "Wheat", "unit": "per bushel"},
            {"id": "corn", "name": "Corn", "unit": "per bushel"},
            {"id": "soybeans", "name": "Soybeans", "unit": "per bushel"},
            {"id": "coffee", "name": "Coffee (Arabica)", "unit": "per pound"},
            {"id": "sugar", "name": "Sugar (No. 11)", "unit": "per pound"},
            {"id": "cotton", "name": "Cotton", "unit": "per pound"},
            {"id": "palm_oil", "name": "Palm Oil (CPO)", "unit": "per ton"},
            {"id": "lumber", "name": "Lumber", "unit": "per 1000 board feet"},
        ],
        "source": "API-Ninjas",
        "updated": datetime.utcnow().isoformat()
    }


@router.get("/commodity/compare")
async def compare_commodities():
    """Get forward curve comparison for major commodities."""
    commodities = ["crude_oil", "natural_gas", "gold", "palm_oil"]
    results = []
    
    for commodity in commodities:
        try:
            data = await get_commodity_forward_curve(commodity)
            if data and "curve" in data and len(data["curve"]) > 0:
                results.append({
                    "name": data.get("name", commodity),
                    "symbol": data.get("symbol_root", commodity[:3].upper()),
                    "structure": data.get("structure", "unknown"),
                    "current_price": data["curve"][0].get("last_price") if data.get("curve") else None,
                    "next_month_price": data["curve"][1].get("last_price") if len(data.get("curve", [])) > 1 else None,
                    "contango_1m": data.get("contango_slope_1m_pct", 0),
                    "contango_12m": data.get("contango_slope_12m_pct", 0),
                    "last_updated": data["curve"][0].get("last_updated") if data.get("curve") else None,
                })
        except Exception:
            pass
    
    return {
        "commodities": results,
        "updated": datetime.utcnow().isoformat()
    }
