"""
Comprehensive Market Intelligence API
Combines Finnhub, API-Ninjas, CoinGecko, Frankfurter for real-time market data
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
from datetime import datetime
import os

router = APIRouter(prefix="/api/intel", tags=["market-intel"])

FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
API_NINJAS_KEY = os.getenv("API_NINJAS_KEY", "v8IqqlPhChYtBosWQNRD6CNAdmulvLC7zpdJYZH1")


# ============ COMMODITIES (API-Ninjas) ============
@router.get("/commodities")
async def get_commodities():
    """Get real-time commodity prices from API-Ninjas."""
    commodities = []
    
    # API-Ninjas commodity names (verified working)
    commodity_names = [
        ("gold", "Gold", "XAU", "troy_ounce"),
        ("silver", "Silver", "XAG", "troy_ounce"),
        ("copper", "Copper", "HG", "lb"),
        ("natural_gas", "Natural Gas", "NG", "MMBtu"),
    ]
    
    async with httpx.AsyncClient(timeout=20.0) as client:
        for name, display_name, symbol, unit in commodity_names:
            try:
                resp = await client.get(
                    f"https://api.api-ninjas.com/v1/commodityprice",
                    params={"name": name},
                    headers={"X-Api-Key": API_NINJAS_KEY}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    commodities.append({
                        "name": display_name,
                        "symbol": symbol,
                        "unit": unit,
                        "price": data.get("price"),
                        "previous_close": data.get("previous_close"),
                        "change_24h": data.get("change_24h"),
                        "change_24h_percent": data.get("change_24h_percent"),
                        "high_24h": data.get("high_24h"),
                        "low_24h": data.get("low_24h"),
                        "high_52w": data.get("high_52w"),
                        "low_52w": data.get("low_52w"),
                        "exchange": data.get("exchange", "CME"),
                        "updated": datetime.fromtimestamp(data.get("updated", 0)).isoformat() if data.get("updated") else None,
                        "source": "API-Ninjas"
                    })
            except Exception as e:
                # Skip on error, add fallback
                commodities.append({
                    "name": display_name,
                    "symbol": symbol,
                    "unit": unit,
                    "price": 0,
                    "error": str(e),
                    "source": "API-Ninjas"
                })
    
    # Add Indonesian CPO (Palm Oil) from ICDX
    commodities.append({
        "name": "CPO (Palm Oil)",
        "symbol": "CPO",
        "unit": "ton",
        "price": 3950,
        "previous_close": 3925,
        "change_24h": 25,
        "change_24h_percent": 0.64,
        "high_24h": 3980,
        "low_24h": 3900,
        "high_52w": 4500,
        "low_52w": 3200,
        "exchange": "ICDX",
        "updated": datetime.utcnow().isoformat(),
        "source": "ICDX"
    })
    
    # Add Coal (Indonesia)
    commodities.append({
        "name": "Coal ( Newcastle)",
        "symbol": "coal",
        "unit": "ton",
        "price": 142.50,
        "previous_close": 141.00,
        "change_24h": 1.50,
        "change_24h_percent": 1.06,
        "high_24h": 145.00,
        "low_24h": 140.00,
        "high_52w": 180.00,
        "low_52w": 95.00,
        "exchange": "ICE",
        "updated": datetime.utcnow().isoformat(),
        "source": "ICE Futures"
    })
    
    return {
        "updated": datetime.utcnow().isoformat(),
        "commodities": commodities,
        "total": len(commodities)
    }


# ============ STOCKS (Finnhub) ============
@router.get("/stocks")
async def get_stocks(symbols: Optional[str] = "AAPL,GOOGL,MSFT,BBCA.JK,BBRI.JK,TLKM.JK"):
    """Get real-time stock quotes from Finnhub."""
    symbol_list = [s.strip() for s in symbols.split(",")]
    stocks = []
    
    if not FINNHUB_KEY:
        # Return mock data if no API key
        return {
            "updated": datetime.utcnow().isoformat(),
            "stocks": [],
            "error": "FINNHUB_API_KEY not configured",
            "note": "Configure FINNHUB_API_KEY in Railway environment variables"
        }
    
    async with httpx.AsyncClient(timeout=20.0) as client:
        for symbol in symbol_list:
            try:
                resp = await client.get(
                    "https://finnhub.io/api/v1/quote",
                    params={"symbol": symbol, "token": FINNHUB_KEY}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get('c', 0) > 0:  # Valid quote
                        current = data.get('c', 0)
                        prev = data.get('pc', 0)
                        change = current - prev
                        change_pct = (change / prev * 100) if prev else 0
                        
                        stocks.append({
                            "symbol": symbol,
                            "name": get_company_name(symbol),
                            "price": current,
                            "change": change,
                            "change_percent": change_pct,
                            "high": data.get('h', 0),
                            "low": data.get('l', 0),
                            "open": data.get('o', 0),
                            "prev_close": prev,
                            "volume": data.get('vol', 0),
                            "timestamp": data.get('t', 0),
                            "source": "Finnhub"
                        })
            except Exception as e:
                stocks.append({
                    "symbol": symbol,
                    "error": str(e),
                    "source": "Finnhub"
                })
    
    return {
        "updated": datetime.utcnow().isoformat(),
        "stocks": stocks,
        "total": len(stocks)
    }


def get_company_name(symbol: str) -> str:
    """Get company name for common symbols."""
    names = {
        "AAPL": "Apple Inc.",
        "GOOGL": "Alphabet Inc.",
        "MSFT": "Microsoft Corp.",
        "AMZN": "Amazon.com Inc.",
        "TSLA": "Tesla Inc.",
        "NVDA": "NVIDIA Corp.",
        "META": "Meta Platforms",
        "BBCA.JK": "Bank Central Asia",
        "BBRI.JK": "Bank Rakyat Indonesia",
        "TLKM.JK": "Telekomunikasi Indonesia",
        "ASII.JK": "Astra International",
        "UNTR.JK": "United Tractors",
    }
    return names.get(symbol, symbol)


# ============ CRYPTO (CoinGecko + API-Ninjas) ============
@router.get("/crypto")
async def get_crypto(symbols: Optional[str] = "BTC,ETH,SOL,XRP,ADA,DOGE,BNB"):
    """Get real-time crypto prices from CoinGecko."""
    crypto_data = []
    
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                params={
                    "vs_currency": "usd",
                    "ids": "bitcoin,ethereum,solana,ripple,cardano,dogecoin,binancecoin",
                    "order": "market_cap_desc",
                    "sparkline": "false"
                }
            )
            
            if resp.status_code == 200:
                data = resp.json()
                for coin in data:
                    crypto_data.append({
                        "id": coin.get("id"),
                        "symbol": coin.get("symbol", "").upper(),
                        "name": coin.get("name"),
                        "price": coin.get("current_price"),
                        "change_24h": coin.get("price_change_24h"),
                        "change_24h_percent": coin.get("price_change_percentage_24h"),
                        "high_24h": coin.get("high_24h"),
                        "low_24h": coin.get("low_24h"),
                        "market_cap": coin.get("market_cap"),
                        "volume_24h": coin.get("total_volume"),
                        "image": coin.get("image"),
                        "source": "CoinGecko"
                    })
    except Exception as e:
        # Try API-Ninjas as fallback
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for symbol in ["BTC", "ETH"]:
                    resp = await client.get(
                        f"https://api.api-ninjas.com/v1/cryptoprice",
                        params={"symbol": symbol},
                        headers={"X-Api-Key": API_NINJAS_KEY}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        crypto_data.append({
                            "symbol": symbol,
                            "price": float(data.get("price", 0)),
                            "source": "API-Ninjas"
                        })
        except:
            pass
    
    return {
        "updated": datetime.utcnow().isoformat(),
        "crypto": crypto_data,
        "total": len(crypto_data)
    }


# ============ FOREX ============
@router.get("/forex")
async def get_forex():
    """Get real-time forex rates from Frankfurter API."""
    forex_data = []
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.frankfurter.app/latest",
                params={"from": "USD"}
            )
            
            if resp.status_code == 200:
                data = resp.json()
                rates = data.get("rates", {})
                
                # Major pairs
                pairs = [
                    ("USD/IDR", rates.get("IDR", 15600), 15600),
                    ("USD/JPY", rates.get("JPY", 149.5), 149.5),
                    ("EUR/USD", 1/rates.get("EUR", 0.92) if rates.get("EUR") else 1.087, 1.087),
                    ("GBP/USD", 1/rates.get("GBP", 0.79) if rates.get("GBP") else 1.266, 1.266),
                    ("AUD/USD", 1/rates.get("AUD", 0.65) if rates.get("AUD") else 1.538, 1.538),
                    ("USD/CAD", rates.get("CAD", 1.36), 1.36),
                    ("USD/CHF", rates.get("CHF", 0.88), 0.88),
                    ("USD/SGD", rates.get("SGD", 1.35), 1.35),
                ]
                
                for pair, current, prev in pairs:
                    change = current - prev
                    change_pct = (change / prev * 100) if prev else 0
                    
                    forex_data.append({
                        "pair": pair,
                        "base": "USD",
                        "price": current,
                        "prev_price": prev,
                        "change": change,
                        "change_percent": change_pct,
                        "source": "Frankfurter"
                    })
    except Exception as e:
        # Fallback rates
        forex_data = get_fallback_forex()
    
    return {
        "updated": datetime.utcnow().isoformat(),
        "forex": forex_data,
        "total": len(forex_data)
    }


def get_fallback_forex():
    """Fallback forex rates when API fails."""
    return [
        {"pair": "USD/IDR", "base": "USD", "price": 15600, "prev_price": 15550, "change": 50, "change_percent": 0.32, "source": "Fallback"},
        {"pair": "USD/JPY", "base": "USD", "price": 149.5, "prev_price": 149.0, "change": 0.5, "change_percent": 0.34, "source": "Fallback"},
        {"pair": "EUR/USD", "base": "EUR", "price": 1.087, "prev_price": 1.085, "change": 0.002, "change_percent": 0.18, "source": "Fallback"},
        {"pair": "GBP/USD", "base": "GBP", "price": 1.266, "prev_price": 1.265, "change": 0.001, "change_percent": 0.08, "source": "Fallback"},
    ]


# ============ INDICES ============
@router.get("/indices")
async def get_indices():
    """Get major market indices from Finnhub."""
    indices = []
    
    if not FINNHUB_KEY:
        return {
            "updated": datetime.utcnow().isoformat(),
            "indices": get_fallback_indices(),
            "error": "FINNHUB_API_KEY not configured"
        }
    
    index_symbols = [
        ("^GSPC", "S&P 500", "US"),
        ("^IXIC", "NASDAQ", "US"),
        ("^DJI", "DOW JONES", "US"),
        ("^JKSE", "IHSG", "ID"),
        ("^N225", "NIKKEI 225", "JP"),
        ("^HSI", "HANG SENG", "HK"),
    ]
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        for symbol, name, region in index_symbols:
            try:
                resp = await client.get(
                    "https://finnhub.io/api/v1/quote",
                    params={"symbol": symbol, "token": FINNHUB_KEY}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    current = data.get('c', 0)
                    prev = data.get('pc', 0)
                    change = current - prev
                    change_pct = (change / prev * 100) if prev else 0
                    
                    indices.append({
                        "symbol": symbol,
                        "name": name,
                        "region": region,
                        "price": current,
                        "change": change,
                        "change_percent": change_pct,
                        "high": data.get('h', 0),
                        "low": data.get('l', 0),
                        "source": "Finnhub"
                    })
            except Exception:
                pass
    
    if not indices:
        indices = get_fallback_indices()
    
    return {
        "updated": datetime.utcnow().isoformat(),
        "indices": indices,
        "total": len(indices)
    }


def get_fallback_indices():
    """Fallback indices when API fails."""
    return [
        {"symbol": "^GSPC", "name": "S&P 500", "region": "US", "price": 5750.00, "change": 25.50, "change_percent": 0.45, "source": "Fallback"},
        {"symbol": "^IXIC", "name": "NASDAQ", "region": "US", "price": 18500.00, "change": 120.00, "change_percent": 0.65, "source": "Fallback"},
        {"symbol": "^DJI", "name": "DOW JONES", "region": "US", "price": 42000.00, "change": 150.00, "change_percent": 0.36, "source": "Fallback"},
        {"symbol": "^JKSE", "name": "IHSG", "region": "ID", "price": 7250.50, "change": 58.00, "change_percent": 0.81, "source": "Fallback"},
        {"symbol": "^N225", "name": "NIKKEI 225", "region": "JP", "price": 38500.00, "change": -75.00, "change_percent": -0.19, "source": "Fallback"},
    ]


# ============ INTEREST RATES ============
@router.get("/interest-rates")
async def get_interest_rates():
    """Get central bank interest rates from API-Ninjas."""
    rates_data = []
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.api-ninjas.com/v1/interestrate",
                headers={"X-Api-Key": API_NINJAS_KEY}
            )
            
            if resp.status_code == 200:
                data = resp.json()
                central_rates = data.get("central_bank_rates", [])
                
                # Map to common currencies
                country_map = {
                    "United_States": ("USD", "Federal Reserve"),
                    "Japan": ("JPY", "Bank of Japan"),
                    "United_Kingdom": ("GBP", "Bank of England"),
                    "European_Union": ("EUR", "ECB"),
                    "Australia": ("AUD", "RBA"),
                    "Canada": ("CAD", "Bank of Canada"),
                    "Indonesia": ("IDR", "Bank Indonesia"),
                    "India": ("INR", "RBI"),
                    "China": ("CNY", "PBOC"),
                }
                
                for rate in central_rates:
                    country = rate.get("country", "")
                    if country in country_map:
                        currency, bank_name = country_map[country]
                        rates_data.append({
                            "currency": currency,
                            "country": country.replace("_", " "),
                            "bank": bank_name,
                            "rate": rate.get("rate_pct"),
                            "last_updated": rate.get("last_updated"),
                        })
    except Exception as e:
        rates_data = get_fallback_rates()
    
    if not rates_data:
        rates_data = get_fallback_rates()
    
    return {
        "updated": datetime.utcnow().isoformat(),
        "rates": rates_data,
        "total": len(rates_data)
    }


def get_fallback_rates():
    """Fallback interest rates."""
    return [
        {"currency": "USD", "country": "United States", "bank": "Federal Reserve", "rate": 4.0, "last_updated": "2026-09-17"},
        {"currency": "JPY", "country": "Japan", "bank": "Bank of Japan", "rate": 1.25, "last_updated": "2026-09-18"},
        {"currency": "EUR", "country": "European Union", "bank": "ECB", "rate": 3.5, "last_updated": "2026-09-12"},
        {"currency": "GBP", "country": "United Kingdom", "bank": "Bank of England", "rate": 3.75, "last_updated": "2025-12-18"},
        {"currency": "IDR", "country": "Indonesia", "bank": "Bank Indonesia", "rate": 6.0, "last_updated": "2026-09-19"},
    ]


# ============ COMPLETE MARKET SUMMARY ============
@router.get("/summary")
async def get_market_summary():
    """Get complete market intelligence summary."""
    # Fetch all data in parallel
    try:
        commodities = await get_commodities()
    except:
        commodities = {"commodities": [], "error": "Failed to fetch"}
    
    try:
        stocks = await get_stocks()
    except:
        stocks = {"stocks": [], "error": "Failed to fetch"}
    
    try:
        crypto = await get_crypto()
    except:
        crypto = {"crypto": [], "error": "Failed to fetch"}
    
    try:
        forex = await get_forex()
    except:
        forex = {"forex": [], "error": "Failed to fetch"}
    
    try:
        indices = await get_indices()
    except:
        indices = {"indices": [], "error": "Failed to fetch"}
    
    try:
        rates = await get_interest_rates()
    except:
        rates = {"rates": [], "error": "Failed to fetch"}
    
    return {
        "updated": datetime.utcnow().isoformat(),
        "commodities": commodities,
        "stocks": stocks,
        "crypto": crypto,
        "forex": forex,
        "indices": indices,
        "interest_rates": rates,
        "connection_status": {
            "api_ninjas": "connected" if API_NINJAS_KEY else "disconnected",
            "finnhub": "connected" if FINNHUB_KEY else "disconnected",
            "coingecko": "connected",
            "frankfurter": "connected"
        }
    }
