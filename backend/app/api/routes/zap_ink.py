"""
Zap.ink API integration for Indonesian stock market data (IDX/BEI)
Provides real-time quotes, historical candles, broker summary, and stock details.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
from datetime import datetime, date, timedelta
import os

router = APIRouter(prefix="/zap", tags=["zap-ink"])

# Zap.ink API Configuration
ZAPI_KEY = os.getenv("ZAPI_API_KEY", "zpi_gku9tahezxicx4mn3lu8hfhvm8")
ZAPI_BASE_URL = "https://api.zapi.ink/v1"

# IDX Stock Codes (Top Indonesian Stocks)
IDX_STOCKS = {
    # Banking
    "BBCA": {"name": "Bank Central Asia", "stockId": 10020, "sector": "Banking"},
    "BBRI": {"name": "Bank Rakyat Indonesia", "stockId": 10041, "sector": "Banking"},
    "BMRI": {"name": "Bank Mandiri", "stockId": 10033, "sector": "Banking"},
    "BBNI": {"name": "Bank Negara Indonesia", "stockId": 10009, "sector": "Banking"},
    "BTPN": {"name": "BTPN", "stockId": 10042, "sector": "Banking"},
    "BDMN": {"name": "Bank Danamon", "stockId": 10007, "sector": "Banking"},
    
    # Consumer
    "UNVR": {"name": "Unilever Indonesia", "stockId": 10031, "sector": "Consumer"},
    "ICBP": {"name": "Indofood CBP", "stockId": 10127, "sector": "Consumer"},
    "KLBF": {"name": "Kalbe Farma", "stockId": 10016, "sector": "Healthcare"},
    
    # Mining
    "PTBA": {"name": "Bukit Asam", "stockId": 10036, "sector": "Mining"},
    "ADRO": {"name": "Adaro Energy", "stockId": 10001, "sector": "Mining"},
    "ITMG": {"name": "Indo Tambangraya", "stockId": 10056, "sector": "Mining"},
    
    # Property
    "BSDE": {"name": "Bumi Serpong Damai", "stockId": 10044, "sector": "Property"},
    "PWON": {"name": "Pakuwon Jati", "stockId": 10035, "sector": "Property"},
    
    # Telco
    "TLKM": {"name": "Telekomunikasi Indonesia", "stockId": 10029, "sector": "Telecom"},
    "EXCL": {"name": "XL Axiata", "stockId": 10052, "sector": "Telecom"},
    
    # Automotive
    "ASII": {"name": "Astra International", "stockId": 10005, "sector": "Automotive"},
    
    # Cement
    "SMGR": {"name": "Semen Indonesia", "stockId": 10027, "sector": "Cement"},
    "INTP": {"name": "Indocement Tunggal", "stockId": 10013, "sector": "Cement"},
}


class StockQuote(BaseModel):
    code: str
    name: str
    price: float
    change: float
    change_percent: float
    open: float
    high: float
    low: float
    close: float
    volume: int
    value: float
    sector: str
    updated: str


class CandleData(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: int


# ============ STOCK LIST ============
@router.get("/stocks")
async def get_idx_stocks():
    """Get list of Indonesian stocks with basic info."""
    return {
        "stocks": [
            {
                "code": code,
                "name": info["name"],
                "stockId": info["stockId"],
                "sector": info["sector"]
            }
            for code, info in IDX_STOCKS.items()
        ],
        "total": len(IDX_STOCKS)
    }


# ============ STOCK SUMMARY (Real-time Quote) ============
@router.get("/summary/{code}")
async def get_stock_summary(code: str):
    """Get real-time stock summary from IDX."""
    code = code.upper()
    
    if code not in IDX_STOCKS:
        raise HTTPException(status_code=404, detail=f"Stock {code} not found")
    
    stock_info = IDX_STOCKS[code]
    
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            # Get stock summary from IDX dataset
            resp = await client.get(
                f"{ZAPI_BASE_URL}/finance:idx:stock-summary",
                params={
                    "code": code,
                    "start": 0,
                    "length": 1
                },
                headers={"x-api-key": ZAPI_KEY}
            )
            
            if resp.status_code == 200:
                data = resp.json()
                records = data.get('data', {}).get('data', [])
                
                if records:
                    record = records[0]
                    prev_close = record.get('Previous', 0)
                    close = record.get('Close', 0)
                    change = close - prev_close
                    change_pct = (change / prev_close * 100) if prev_close else 0
                    
                    return {
                        "code": code,
                        "name": stock_info["name"],
                        "stockId": stock_info["stockId"],
                        "sector": stock_info["sector"],
                        "price": close,
                        "previous_close": prev_close,
                        "open": record.get('OpenPrice', 0),
                        "high": record.get('High', 0),
                        "low": record.get('Low', 0),
                        "close": close,
                        "change": change,
                        "change_percent": change_pct,
                        "volume": record.get('Volume', 0),
                        "value": record.get('Value', 0),
                        "offer": record.get('Offer', 0),
                        "bid": record.get('Bid', 0),
                        "foreign_buy": record.get('ForeignBuy', 0),
                        "foreign_sell": record.get('ForeignSell', 0),
                        "date": record.get('Date', ''),
                        "source": "IDX via Zap.ink"
                    }
    except Exception as e:
        pass
    
    # Fallback with error indication
    return {
        "code": code,
        "name": stock_info["name"],
        "stockId": stock_info["stockId"],
        "sector": stock_info["sector"],
        "price": 0,
        "error": "Unable to fetch data",
        "source": "Fallback"
    }


# ============ ALL STOCKS QUOTES ============
@router.get("/quotes")
async def get_all_quotes():
    """Get quotes for all major Indonesian stocks."""
    quotes = []
    errors = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for code, info in IDX_STOCKS.items():
            try:
                resp = await client.get(
                    f"{ZAPI_BASE_URL}/finance:idx:stock-summary",
                    params={"code": code, "start": 0, "length": 1},
                    headers={"x-api-key": ZAPI_KEY}
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    records = data.get('data', {}).get('data', [])
                    
                    if records:
                        record = records[0]
                        prev_close = record.get('Previous', 0)
                        close = record.get('Close', 0)
                        change = close - prev_close
                        change_pct = (change / prev_close * 100) if prev_close else 0
                        
                        quotes.append(StockQuote(
                            code=code,
                            name=info["name"],
                            price=close,
                            change=change,
                            change_percent=change_pct,
                            open=record.get('OpenPrice', 0),
                            high=record.get('High', 0),
                            low=record.get('Low', 0),
                            close=close,
                            volume=record.get('Volume', 0),
                            value=record.get('Value', 0),
                            sector=info["sector"],
                            updated=record.get('Date', datetime.now().isoformat())
                        ))
            except Exception as e:
                errors.append({"code": code, "error": str(e)})
    
    return {
        "quotes": quotes,
        "total": len(quotes),
        "errors": errors if errors else None
    }


# ============ BROKER SUMMARY ============
@router.get("/broker-summary/{code}")
async def get_broker_summary(code: str, days: int = 5):
    """Get broker accumulation/summary for a stock."""
    code = code.upper()
    
    if code not in IDX_STOCKS:
        raise HTTPException(status_code=404, detail=f"Stock {code} not found")
    
    stock_info = IDX_STOCKS[code]
    end_date = date.today().strftime("%Y-%m-%d")
    start_date = (date.today() - timedelta(days=days)).strftime("%Y-%m-%d")
    
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{ZAPI_BASE_URL}/finance:pluang/broker-summary",
                params={
                    "code": code,
                    "stockId": stock_info["stockId"],
                    "startDate": start_date,
                    "endDate": end_date,
                    "net": "true"
                },
                headers={"x-api-key": ZAPI_KEY}
            )
            
            if resp.status_code == 200:
                data = resp.json()
                return data
    except Exception as e:
        return {"error": str(e), "stockId": stock_info["stockId"]}
    
    return {"error": "Unable to fetch broker data", "stockId": stock_info["stockId"]}


# ============ HISTORICAL CANDLES ============
@router.get("/candles/{code}")
async def get_candles(
    code: str, 
    interval: str = "1D",  # 1D, 1W, 1M
    range_: str = "3mo"     # 1mo, 3mo, 6mo, 1y, 5y
):
    """Get historical candle data for a stock using Yahoo Finance."""
    code = code.upper()
    if code not in IDX_STOCKS:
        raise HTTPException(status_code=404, detail=f"Stock {code} not found")
    
    # Yahoo Finance symbol for IDX stocks
    yahoo_symbol = f"{code}.JK"
    
    # Map interval
    interval_map = {
        "1D": ("1h", "5d"),
        "1W": ("1d", "1mo"),
        "1M": ("1d", "3mo"),
    }
    
    yahoo_interval, yahoo_range = interval_map.get(interval, ("1d", "3mo"))
    
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}",
                params={
                    "interval": yahoo_interval,
                    "range": yahoo_range,
                    "events": "history"
                },
                headers={"User-Agent": "Mozilla/5.0"}
            )
            
            if resp.status_code == 200:
                data = resp.json()
                result = data.get('chart', {}).get('result', [{}])[0]
                
                timestamps = result.get('timestamp', [])
                quote = result.get('indicators', {}).get('quote', [{}])[0]
                
                candles = []
                for i, ts in enumerate(timestamps):
                    candles.append({
                        "time": ts,
                        "open": quote.get('open', [0])[i] if i < len(quote.get('open', [0])) else 0,
                        "high": quote.get('high', [0])[i] if i < len(quote.get('high', [0])) else 0,
                        "low": quote.get('low', [0])[i] if i < len(quote.get('low', [0])) else 0,
                        "close": quote.get('close', [0])[i] if i < len(quote.get('close', [0])) else 0,
                        "volume": quote.get('volume', [0])[i] if i < len(quote.get('volume', [0])) else 0,
                    })
                
                return {
                    "code": code,
                    "symbol": yahoo_symbol,
                    "interval": interval,
                    "candles": candles,
                    "total": len(candles)
                }
    except Exception as e:
        return {"error": str(e), "code": code}
    
    return {"error": "Unable to fetch candles", "code": code}


# ============ TECHNICAL INDICATORS ============
@router.get("/indicators/{code}")
async def get_indicators(code: str, period: int = 14):
    """Calculate technical indicators (SMA, EMA, RSI) for a stock."""
    code = code.upper()
    if code not in IDX_STOCKS:
        raise HTTPException(status_code=404, detail=f"Stock {code} not found")
    
    # Get candles first
    candles_data = await get_candles(code, "1D", "3mo")
    
    if "error" in candles_data or not candles_data.get("candles"):
        return {"error": "Unable to calculate indicators", "code": code}
    
    candles = candles_data["candles"]
    closes = [c["close"] for c in candles if c["close"] > 0]
    
    if len(closes) < period:
        return {"error": "Insufficient data", "code": code}
    
    # Calculate SMA
    def sma(data, period):
        result = []
        for i in range(len(data)):
            if i < period - 1:
                result.append(None)
            else:
                result.append(sum(data[i-period+1:i+1]) / period)
        return result
    
    # Calculate EMA
    def ema(data, period):
        result = []
        multiplier = 2 / (period + 1)
        for i in range(len(data)):
            if i == 0:
                result.append(data[0])
            elif i < period - 1:
                result.append(None)
            else:
                if result[i-1] is None:
                    result.append(sum(data[:period]) / period)
                else:
                    result.append((data[i] - result[i-1]) * multiplier + result[i-1])
        return result
    
    # Calculate RSI
    def rsi(data, period):
        result = []
        gains = []
        losses = []
        
        for i in range(len(data)):
            if i == 0:
                gains.append(0)
                losses.append(0)
                result.append(None)
            else:
                change = data[i] - data[i-1]
                gains.append(max(change, 0))
                losses.append(max(-change, 0))
                
                if i < period:
                    result.append(None)
                else:
                    avg_gain = sum(gains[i-period+1:i+1]) / period
                    avg_loss = sum(losses[i-period+1:i+1]) / period
                    
                    if avg_loss == 0:
                        result.append(100)
                    else:
                        rs = avg_gain / avg_loss
                        result.append(100 - (100 / (1 + rs)))
        
        return result
    
    sma20 = sma(closes, 20)
    sma50 = sma(closes, 50)
    sma200 = sma(closes, 200) if len(closes) >= 200 else [None] * len(closes)
    ema20 = ema(closes, 20)
    rsi14 = rsi(closes, period)
    
    # Combine with candles
    indicators = []
    for i, candle in enumerate(candles):
        indicators.append({
            "time": candle["time"],
            "close": candle["close"],
            "sma20": sma20[i] if i < len(sma20) else None,
            "sma50": sma50[i] if i < len(sma50) else None,
            "sma200": sma200[i] if i < len(sma200) else None,
            "ema20": ema20[i] if i < len(ema20) else None,
            "rsi14": rsi14[i] if i < len(rsi14) else None,
        })
    
    return {
        "code": code,
        "period": period,
        "indicators": indicators,
        "latest": {
            "sma20": sma20[-1] if sma20[-1] else 0,
            "sma50": sma50[-1] if sma50[-1] else 0,
            "sma200": sma200[-1] if sma200[-1] else 0,
            "ema20": ema20[-1] if ema20[-1] else 0,
            "rsi14": rsi14[-1] if rsi14[-1] else 0,
        }
    }


# ============ COMPREHENSIVE STOCK DATA ============
@router.get("/stock/{code}")
async def get_stock_full(code: str):
    """Get comprehensive stock data including quote, candles, and indicators."""
    code = code.upper()
    
    if code not in IDX_STOCKS:
        raise HTTPException(status_code=404, detail=f"Stock {code} not found")
    
    stock_info = IDX_STOCKS[code]
    
    # Parallel fetch
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get quote
        quote_resp = await client.get(
            f"{ZAPI_BASE_URL}/finance:idx:stock-summary",
            params={"code": code, "start": 0, "length": 1},
            headers={"x-api-key": ZAPI_KEY}
        )
        
        # Get candles from Yahoo Finance
        yahoo_symbol = f"{code}.JK"
        candle_resp = await client.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}",
            params={"interval": "1d", "range": "3mo", "events": "history"},
            headers={"User-Agent": "Mozilla/5.0"}
        )
        
        # Get broker summary
        end_date = date.today().strftime("%Y-%m-%d")
        start_date = (date.today() - timedelta(days=5)).strftime("%Y-%m-%d")
        broker_resp = await client.get(
            f"{ZAPI_BASE_URL}/finance:pluang/broker-summary",
            params={
                "code": code,
                "stockId": stock_info["stockId"],
                "startDate": start_date,
                "endDate": end_date,
                "net": "true"
            },
            headers={"x-api-key": ZAPI_KEY}
        )
        
        result = {
            "code": code,
            "name": stock_info["name"],
            "stockId": stock_info["stockId"],
            "sector": stock_info["sector"],
            "quote": None,
            "candles": [],
            "broker": None,
            "indicators": None,
        }
        
        # Parse quote
        if quote_resp.status_code == 200:
            data = quote_resp.json()
            records = data.get('data', {}).get('data', [])
            if records:
                record = records[0]
                prev = record.get('Previous', 0)
                close = record.get('Close', 0)
                result["quote"] = {
                    "price": close,
                    "previous_close": prev,
                    "open": record.get('OpenPrice', 0),
                    "high": record.get('High', 0),
                    "low": record.get('Low', 0),
                    "change": close - prev,
                    "change_percent": ((close - prev) / prev * 100) if prev else 0,
                    "volume": record.get('Volume', 0),
                    "value": record.get('Value', 0),
                    "bid": record.get('Bid', 0),
                    "offer": record.get('Offer', 0),
                    "foreign_buy": record.get('ForeignBuy', 0),
                    "foreign_sell": record.get('ForeignSell', 0),
                }
        
        # Parse candles
        if candle_resp.status_code == 200:
            data = candle_resp.json()
            result_data = data.get('chart', {}).get('result', [{}])[0]
            timestamps = result_data.get('timestamp', [])
            quote = result_data.get('indicators', {}).get('quote', [{}])[0]
            
            candles = []
            for i, ts in enumerate(timestamps):
                candles.append({
                    "time": ts,
                    "open": quote.get('open', [0])[i] if i < len(quote.get('open', [0])) else 0,
                    "high": quote.get('high', [0])[i] if i < len(quote.get('high', [0])) else 0,
                    "low": quote.get('low', [0])[i] if i < len(quote.get('low', [0])) else 0,
                    "close": quote.get('close', [0])[i] if i < len(quote.get('close', [0])) else 0,
                    "volume": quote.get('volume', [0])[i] if i < len(quote.get('volume', [0])) else 0,
                })
            result["candles"] = candles
        
        # Parse broker
        if broker_resp.status_code == 200:
            result["broker"] = broker_resp.json()
        
        return result
