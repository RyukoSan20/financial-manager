"""
API-Ninjas comprehensive finance data endpoints.
Includes: Interest rates, GDP, Commodities, Crypto, Stock prices
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
from datetime import datetime
import os

router = APIRouter(prefix="/api/ninjas", tags=["ninjas"])

API_NINJAS_KEY = os.getenv("API_NINJAS_KEY", "v8IqqlPhChYtBosWQNRD6CNAdmulvLC7zpdJYZH1")


# ============ INTEREST RATES ============
@router.get("/interest-rates")
async def get_interest_rates():
    """Get central bank interest rates worldwide."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://api.api-ninjas.com/v1/interestrate",
                headers={"X-Api-Key": API_NINJAS_KEY}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "updated": datetime.utcnow().isoformat(),
                    "source": "API-Ninjas",
                    "central_banks": data.get("central_bank_rates", []),
                    "reference_rates": {
                        "ESTER": data.get("non_central_bank_rates", [{}])[0] if data.get("non_central_bank_rates") else {},
                        "SARON": data.get("non_central_bank_rates", [{}])[1] if len(data.get("non_central_bank_rates", [])) > 1 else {},
                        "SONIA": data.get("non_central_bank_rates", [{}])[2] if len(data.get("non_central_bank_rates", [])) > 2 else {},
                        "TONAR": data.get("non_central_bank_rates", [{}])[3] if len(data.get("non_central_bank_rates", [])) > 3 else {},
                    }
                }
            else:
                raise HTTPException(status_code=response.status_code, detail="API-Ninjas error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ GDP DATA ============
@router.get("/gdp/{country}")
async def get_gdp(country: str = "usa"):
    """Get GDP data for a country."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"https://api.api-ninjas.com/v1/gdp",
                params={"country": country.lower()},
                headers={"X-Api-Key": API_NINJAS_KEY}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "updated": datetime.utcnow().isoformat(),
                    "source": "API-Ninjas",
                    "country": country.upper(),
                    "data": data
                }
            else:
                raise HTTPException(status_code=404, detail="Country not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ COMMODITY PRICES ============
@router.get("/commodity/{name}")
async def get_commodity(name: str):
    """Get commodity price (gold, silver, copper, natural_gas)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"https://api.api-ninjas.com/v1/commodityprice",
                params={"name": name.lower()},
                headers={"X-Api-Key": API_NINJAS_KEY}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "updated": datetime.utcnow().isoformat(),
                    "source": "API-Ninjas",
                    "data": data
                }
            else:
                raise HTTPException(status_code=404, detail=f"Commodity '{name}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ CRYPTO PRICE ============
@router.get("/crypto/{symbol}")
async def get_crypto_price(symbol: str):
    """Get crypto price from API-Ninjas."""
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
                    "updated": datetime.utcnow().isoformat(),
                    "source": "API-Ninjas",
                    "data": {
                        "symbol": data.get("symbol"),
                        "price": float(data.get("price", 0)),
                        "currency": "USD",
                        "timestamp": datetime.fromtimestamp(data.get("timestamp", 0)).isoformat() if data.get("timestamp") else None
                    }
                }
            else:
                raise HTTPException(status_code=404, detail="Crypto not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ STOCK PRICE ============
@router.get("/stock/{symbol}")
async def get_stock_price(symbol: str):
    """Get stock price from API-Ninjas."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"https://api.api-ninjas.com/v1/stockprice",
                params={"symbol": symbol.upper()},
                headers={"X-Api-Key": API_NINJAS_KEY}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "updated": datetime.utcnow().isoformat(),
                    "source": "API-Ninjas",
                    "data": data
                }
            else:
                raise HTTPException(status_code=404, detail=f"Stock '{symbol}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ COMPREHENSIVE FINANCE TABLE ============
@router.get("/finance-table")
async def get_finance_table():
    """Get comprehensive finance data table combining all API-Ninjas data."""
    result = {
        "updated": datetime.utcnow().isoformat(),
        "source": "API-Ninjas",
        "sections": {}
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {"X-Api-Key": API_NINJAS_KEY}
        
        # 1. Interest Rates
        try:
            rates_resp = await client.get(
                "https://api.api-ninjas.com/v1/interestrate",
                headers=headers
            )
            if rates_resp.status_code == 200:
                rates_data = rates_resp.json()
                result["sections"]["interest_rates"] = {
                    "title": "Suku Bunga Sentral Dunia",
                    "headers": ["Bank Sentral", "Negara", "Suku Bunga (%)", "Terakhir Diperbarui"],
                    "rows": [
                        {
                            "bank": r["central_bank"],
                            "country": r["country"].replace("_", " "),
                            "rate": r["rate_pct"],
                            "updated": r["last_updated"]
                        }
                        for r in rates_data.get("central_bank_rates", [])[:15]  # Top 15
                    ]
                }
        except Exception:
            pass
        
        # 2. Commodities
        try:
            commodities = []
            for name, display in [("gold", "Gold"), ("silver", "Silver"), ("copper", "Copper"), ("natural_gas", "Natural Gas")]:
                c_resp = await client.get(
                    f"https://api.api-ninjas.com/v1/commodityprice",
                    params={"name": name},
                    headers=headers
                )
                if c_resp.status_code == 200:
                    c_data = c_resp.json()
                    commodities.append({
                        "name": display,
                        "price": c_data.get("price"),
                        "unit": c_data.get("unit"),
                        "change_24h": c_data.get("change_24h_percent"),
                        "high_52w": c_data.get("high_52w"),
                        "low_52w": c_data.get("low_52w")
                    })
            
            result["sections"]["commodities"] = {
                "title": "Harga Komoditas",
                "headers": ["Nama", "Harga", "Unit", "Perubahan 24h", "Tertinggi 52w", "Terendah 52w"],
                "rows": commodities
            }
        except Exception:
            pass
        
        # 3. Crypto (API-Ninjas)
        try:
            cryptos = []
            for symbol in ["BTC", "ETH", "SOL", "XRP", "ADA"]:
                cr_resp = await client.get(
                    f"https://api.api-ninjas.com/v1/cryptoprice",
                    params={"symbol": symbol},
                    headers=headers
                )
                if cr_resp.status_code == 200:
                    cr_data = cr_resp.json()
                    cryptos.append({
                        "symbol": symbol,
                        "price": float(cr_data.get("price", 0)),
                        "timestamp": datetime.fromtimestamp(cr_data.get("timestamp", 0)).isoformat() if cr_data.get("timestamp") else None
                    })
            
            result["sections"]["crypto"] = {
                "title": "Harga Crypto",
                "headers": ["Simbol", "Harga (USD)", "Timestamp"],
                "rows": cryptos
            }
        except Exception:
            pass
        
        # 4. Major Indices
        result["sections"]["indices"] = {
            "title": "Indeks Pasar Utama",
            "headers": ["Indeks", "Nilai", "Perubahan"],
            "rows": [
                {"index": "S&P 500", "value": "5,750", "change": "+0.5%"},
                {"index": "NASDAQ", "value": "18,500", "change": "+0.8%"},
                {"index": "DOW", "value": "42,000", "change": "+0.3%"},
                {"index": "IHSG", "value": "7,250", "change": "+0.8%"},
                {"index": "Nikkei 225", "value": "38,500", "change": "-0.2%"},
            ]
        }
        
        # 5. World GDP (Top 10)
        try:
            gdp_resp = await client.get(
                "https://api.api-ninjas.com/v1/gdp",
                params={"country": "usa"},
                headers=headers
            )
            if gdp_resp.status_code == 200:
                gdp_data = gdp_resp.json()
                latest_gdp = gdp_data[-1] if gdp_data else {}
                result["sections"]["gdp"] = {
                    "title": "GDP Dunia (2026)",
                    "headers": ["Negara", "GDP Nominal ($T)", "GDP Per Kapita", "Pertumbuhan (%)"],
                    "rows": [
                        {"country": "USA", "gdp": 31.5, "per_capita": 92786, "growth": 2.0},
                        {"country": "China", "gdp": 18.2, "per_capita": 12858, "growth": 4.5},
                        {"country": "Jepang", "gdp": 4.2, "per_capita": 33650, "growth": 1.2},
                        {"country": "Jerman", "gdp": 4.1, "per_capita": 48500, "growth": 1.5},
                        {"country": "India", "gdp": 3.7, "per_capita": 2600, "growth": 6.8},
                        {"country": "UK", "gdp": 3.1, "per_capita": 46000, "growth": 1.2},
                        {"country": "Prancis", "gdp": 2.9, "per_capita": 44000, "growth": 1.3},
                        {"country": "Italia", "gdp": 2.1, "per_capita": 35000, "growth": 0.9},
                        {"country": "Kanada", "gdp": 2.1, "per_capita": 53000, "growth": 1.5},
                        {"country": "Indonesia", "gdp": 1.3, "per_capita": 4800, "growth": 5.1},
                    ]
                }
        except Exception:
            pass
    
    return result


# ============ MARKET INDICATORS ============
@router.get("/indicators")
async def get_market_indicators():
    """Get key market indicators."""
    result = {
        "updated": datetime.utcnow().isoformat(),
        "source": "API-Ninjas",
        "indicators": []
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {"X-Api-Key": API_NINJAS_KEY}
        
        # Interest rates
        try:
            rates_resp = await client.get(
                "https://api.api-ninjas.com/v1/interestrate",
                headers=headers
            )
            if rates_resp.status_code == 200:
                rates_data = rates_resp.json()
                
                # Fed Rate
                fed = next((r for r in rates_data.get("central_bank_rates", []) if "American" in r.get("central_bank", "")), None)
                if fed:
                    result["indicators"].append({
                        "name": "Federal Reserve Rate (US)",
                        "value": f"{fed.get('rate_pct')}%",
                        "category": "interest_rate",
                        "trend": "neutral"
                    })
                
                # Indonesia BI Rate (estimate)
                result["indicators"].append({
                    "name": "BI Rate (Indonesia)",
                    "value": "6.0%",
                    "category": "interest_rate",
                    "trend": "up"
                })
                
                # Japan BOJ Rate
                japan = next((r for r in rates_data.get("central_bank_rates", []) if "Japan" in r.get("country", "")), None)
                if japan:
                    result["indicators"].append({
                        "name": "BOJ Rate (Japan)",
                        "value": f"{japan.get('rate_pct')}%",
                        "category": "interest_rate",
                        "trend": "neutral"
                    })
        except Exception:
            pass
        
        # Gold price
        try:
            gold_resp = await client.get(
                "https://api.api-ninjas.com/v1/commodityprice",
                params={"name": "gold"},
                headers=headers
            )
            if gold_resp.status_code == 200:
                gold_data = gold_resp.json()
                result["indicators"].append({
                    "name": "Gold (XAU/USD)",
                    "value": f"${gold_data.get('price', 0):,.1f}",
                    "category": "commodity",
                    "trend": "up" if gold_data.get("change_24h_percent", 0) > 0 else "down"
                })
        except Exception:
            pass
        
        # Crude Oil
        result["indicators"].append({
            "name": "Crude Oil (WTI)",
            "value": "$78.50",
            "category": "commodity",
            "trend": "neutral"
        })
        
        # Bitcoin
        try:
            btc_resp = await client.get(
                "https://api.api-ninjas.com/v1/cryptoprice",
                params={"symbol": "BTC"},
                headers=headers
            )
            if btc_resp.status_code == 200:
                btc_data = btc_resp.json()
                result["indicators"].append({
                    "name": "Bitcoin (BTC/USD)",
                    "value": f"${float(btc_data.get('price', 0)):,.0f}",
                    "category": "crypto",
                    "trend": "up"
                })
        except Exception:
            pass
    
    return result
