"""
Real-time market data routes for multi-asset support.
Integrates CoinGecko, Finnhub, API-Ninjas for comprehensive market data.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
import httpx
from datetime import datetime, timedelta
import os

router = APIRouter()

# API-Ninjas Configuration  
API_NINJAS_KEY = os.getenv("API_NINJAS_KEY", "v8IqqlPhChYtBosWQNRD6CNAdmulvLC7zpdJYZH1")
FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")

# Cache for market data
class MarketCache:
    def __init__(self):
        self.crypto: Dict = {}
        self.forex: Dict = {}
        self.commodities: Dict = {}
        self.crypto_last: Optional[datetime] = None
        self.forex_last: Optional[datetime] = None
        self.commodities_last: Optional[datetime] = None
        self.crypto_cache_duration = timedelta(minutes=5)
        self.forex_cache_duration = timedelta(hours=1)
        self.commodities_cache_duration = timedelta(minutes=15)
    
    def is_valid(self, last_update: Optional[datetime], duration: timedelta) -> bool:
        if not last_update:
            return False
        return datetime.utcnow() - last_update < duration

market_cache = MarketCache()


# ============ CRYPTO (CoinGecko + API-Ninjas) ============
@router.get("/crypto")
async def get_crypto_prices():
    """Get real-time crypto prices from CoinGecko."""
    if market_cache.is_valid(market_cache.crypto_last, market_cache.crypto_cache_duration):
        return market_cache.crypto
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
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
                if market_cache.crypto:
                    return market_cache.crypto
                raise HTTPException(status_code=503, detail="CoinGecko API unavailable")
                
    except Exception as e:
        if market_cache.crypto:
            return market_cache.crypto
        raise HTTPException(status_code=500, detail=f"Crypto API error: {str(e)}")


# ============ CRYPTO via API-Ninjas ============
@router.get("/crypto-ninjas/{symbol}")
async def get_crypto_ninjas(symbol: str):
    """Get single crypto price from API-Ninjas."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"https://api.api-ninjas.com/v1/cryptoprice",
                params={"symbol": symbol.upper()},
                headers={"X-Api-Key": API_NINJAS_KEY}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "symbol": data.get("symbol", symbol.upper()),
                    "price": float(data.get("price", 0)),
                    "timestamp": data.get("timestamp"),
                    "source": "API-Ninjas"
                }
            else:
                raise HTTPException(status_code=404, detail="Crypto not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ COMMODITIES (API-Ninjas + Finnhub) ============
@router.get("/commodities")
async def get_commodity_prices():
    """Get commodity prices from API-Ninjas and Finnhub."""
    if market_cache.is_valid(market_cache.commodities_last, market_cache.commodities_cache_duration):
        return market_cache.commodities
    
    commodity_data = {
        "updated": datetime.utcnow().isoformat(),
        "source": "API-Ninjas",
        "prices": []
    }
    
    # Commodities to fetch from API-Ninjas
    ninjas_commodities = [
        ("gold", "Gold", "metal"),
        ("silver", "Silver", "metal"),
        ("copper", "Copper", "metal"),
        ("natural_gas", "Natural Gas", "energy"),
    ]
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for commodity_id, display_name, ctype in ninjas_commodities:
                try:
                    response = await client.get(
                        f"https://api.api-ninjas.com/v1/commodityprice",
                        params={"name": commodity_id},
                        headers={"X-Api-Key": API_NINJAS_KEY}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        commodity_data["prices"].append({
                            "name": data.get("name", display_name),
                            "symbol": commodity_id[:3].upper(),
                            "price": data.get("price"),
                            "unit": data.get("unit", ""),
                            "change_24h": data.get("change_24h_percent", 0),
                            "type": ctype,
                            "high_52w": data.get("high_52w"),
                            "low_52w": data.get("low_52w"),
                        })
                except Exception:
                    pass
    except Exception:
        pass
    
    # Add CPO (Indonesian commodity) - static for now
    commodity_data["prices"].append({
        "name": "CPO (Palm Oil)",
        "symbol": "CPO",
        "price": 3950,
        "unit": "per ton",
        "change_24h": 0.7,
        "type": "agricultural",
        "exchange": "ICDX"
    })
    
    # Add WTI Oil from Finnhub if available
    if FINNHUB_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                oil_resp = await client.get(
                    "https://finnhub.io/api/v1/quote",
                    params={"symbol": "CL=F", "token": FINNHUB_KEY}
                )
                if oil_resp.status_code == 200:
                    oil_data = oil_resp.json()
                    current = oil_data.get('c', 78.5)
                    prev = oil_data.get('pc', 78)
                    change_pct = ((current - prev) / prev * 100) if prev else 0
                    commodity_data["prices"].append({
                        "name": "Crude Oil (WTI)",
                        "symbol": "CL",
                        "price": current,
                        "unit": "per barrel",
                        "change_24h": round(change_pct, 2),
                        "type": "energy",
                        "exchange": "NYMEX"
                    })
        except Exception:
            pass
    
    # Fallback WTI if Finnhub fails
    if not any(p.get('symbol') == 'CL' for p in commodity_data["prices"]):
        commodity_data["prices"].append({
            "name": "Crude Oil (WTI)",
            "symbol": "CL",
            "price": 78.50,
            "unit": "per barrel",
            "change_24h": 0.5,
            "type": "energy"
        })
    
    market_cache.commodities = commodity_data
    market_cache.commodities_last = datetime.utcnow()
    return commodity_data


# ============ STOCKS (Finnhub) ============
@router.get("/stocks/idx")
async def get_idx_stocks():
    """Get Indonesian stock market data from Finnhub."""
    if not FINNHUB_KEY:
        return {
            "updated": datetime.utcnow().isoformat(),
            "source": "Mock Data",
            "index": {"name": "IHSG", "value": 7250.50, "change": 0.81},
            "stocks": []
        }
    
    try:
        idx_data = {
            "updated": datetime.utcnow().isoformat(),
            "source": "Finnhub",
            "index": {},
            "stocks": []
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Get IHSG via Finnhub world indices
            ihsg_resp = await client.get(
                "https://finnhub.io/api/v1/quote",
                params={"symbol": "^JKSE", "token": FINNHUB_KEY}
            )
            
            if ihsg_resp.status_code == 200:
                ihsg = ihsg_resp.json()
                current = ihsg.get('c', 7250)
                prev = ihsg.get('pc', 7200)
                change_pct = ((current - prev) / prev * 100) if prev else 0
                idx_data["index"] = {
                    "name": "IHSG",
                    "value": current,
                    "change": round(change_pct, 2),
                    "prev_close": prev
                }
            
            # Major Indonesian stocks
            idx_symbols = ["BBCA.JK", "BBRI.JK", "TLKM.JK", "ASII.JK"]
            for symbol in idx_symbols:
                try:
                    resp = await client.get(
                        "https://finnhub.io/api/v1/quote",
                        params={"symbol": symbol, "token": FINNHUB_KEY}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        current = data.get('c', 0)
                        prev = data.get('pc', 0)
                        change_pct = ((current - prev) / prev * 100) if prev else 0
                        idx_data["stocks"].append({
                            "symbol": symbol.replace(".JK", ""),
                            "price": current,
                            "change": round(change_pct, 2),
                            "prev_close": prev
                        })
                except Exception:
                    pass
                    
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
        stocks = await get_idx_stocks()
        
        # Get forex from Frankfurter
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                forex_resp = await client.get(
                    "https://api.frankfurter.app/latest",
                    params={"from": "USD"}
                )
                forex = forex_resp.json().get("rates", {}) if forex_resp.status_code == 200 else {}
        except:
            forex = {"EUR": 0.92, "GBP": 0.79, "JPY": 149.5}
        
        return {
            "updated": datetime.utcnow().isoformat(),
            "forex": {"source": "Frankfurter", "base": "USD", "rates": forex},
            "crypto": crypto,
            "commodities": commodities,
            "stocks": stocks
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
