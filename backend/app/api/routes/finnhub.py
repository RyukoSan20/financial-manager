"""
Finnhub API integration for real-time stock market data.
Provides stock quotes, company profiles, and WebSocket streaming.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
import httpx
from datetime import datetime
import os
import json
import asyncio

router = APIRouter()

# Finnhub API Configuration
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
FINNHUB_BASE_URL = "https://finnhub.io/api/v1"

# Cache for stock data
class StockCache:
    def __init__(self):
        self.quotes: Dict = {}
        self.profiles: Dict = {}
        self.last_update: Optional[datetime] = None
        self.cache_duration_seconds = 60  # 1 minute cache
    
    def is_valid(self, key: str) -> bool:
        if key not in self.quotes:
            return False
        entry = self.quotes[key]
        if not entry:
            return False
        age = (datetime.utcnow() - entry.get('timestamp', datetime.min)).total_seconds()
        return age < self.cache_duration_seconds

stock_cache = StockCache()


class StockQuote(BaseModel):
    symbol: str
    current_price: float
    change: float
    percent_change: float
    high: float
    low: float
    open: float
    prev_close: float
    timestamp: int


class CompanyProfile(BaseModel):
    symbol: str
    name: str
    country: str
    currency: str
    exchange: str
    ipo: str
    market_cap: float
    shares_outstanding: float
    industry: str
    logo: str
    finnhub_industry: str


class CandleData(BaseModel):
    symbol: str
    timestamps: List[int]
    opens: List[float]
    highs: List[float]
    lows: List[float]
    closes: List[float]
    volumes: List[int]
    status: str


# === STOCK QUOTE ===
@router.get("/quote/{symbol}")
async def get_stock_quote(symbol: str):
    """Get real-time quote for a stock symbol."""
    if not FINNHUB_API_KEY:
        raise HTTPException(status_code=503, detail="Finnhub API key not configured")
    
    symbol = symbol.upper().strip()
    
    # Check cache first
    if stock_cache.is_valid(symbol):
        return stock_cache.quotes[symbol]
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{FINNHUB_BASE_URL}/quote",
                params={
                    "symbol": symbol,
                    "token": FINNHUB_API_KEY
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Finnhub returns 0 for all values if symbol not found
                if data.get('c') == 0 and data.get('d') == 0:
                    raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
                
                quote = {
                    "symbol": symbol,
                    "current_price": data.get('c', 0),
                    "change": data.get('d', 0),
                    "percent_change": data.get('dp', 0),
                    "high": data.get('h', 0),
                    "low": data.get('l', 0),
                    "open": data.get('o', 0),
                    "prev_close": data.get('pc', 0),
                    "timestamp": data.get('t', 0),
                    "updated": datetime.utcnow().isoformat()
                }
                
                stock_cache.quotes[symbol] = quote
                return quote
            else:
                raise HTTPException(status_code=response.status_code, detail="Finnhub API error")
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch quote: {str(e)}")


# === COMPANY PROFILE ===
@router.get("/profile/{symbol}")
async def get_company_profile(symbol: str):
    """Get company profile and fundamental data."""
    if not FINNHUB_API_KEY:
        raise HTTPException(status_code=503, detail="Finnhub API key not configured")
    
    symbol = symbol.upper().strip()
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{FINNHUB_BASE_URL}/stock/profile2",
                params={
                    "symbol": symbol,
                    "token": FINNHUB_API_KEY
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not data.get('name'):
                    raise HTTPException(status_code=404, detail=f"Company {symbol} not found")
                
                return {
                    "symbol": symbol,
                    "name": data.get('name', ''),
                    "ticker": data.get('ticker', symbol),
                    "country": data.get('country', ''),
                    "currency": data.get('currency', 'USD'),
                    "exchange": data.get('exchange', ''),
                    "ipo": data.get('ipo', ''),
                    "market_cap": data.get('marketCapitalization', 0) * 1_000_000,
                    "shares_outstanding": data.get('shareOutstanding', 0) * 1_000_000,
                    "industry": data.get('finnhubIndustry', ''),
                    "logo": data.get('logo', ''),
                    "weburl": data.get('weburl', ''),
                    "updated": datetime.utcnow().isoformat()
                }
            else:
                raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")


# === CANDLE / HISTORICAL DATA ===
@router.get("/candles/{symbol}")
async def get_candles(
    symbol: str,
    resolution: str = "D",  # D=daily, W=weekly, M=monthly, 1/5/15/30/60=minutes
    from_ts: Optional[int] = None,
    to_ts: Optional[int] = None
):
    """Get historical candle data for a symbol."""
    if not FINNHUB_API_KEY:
        raise HTTPException(status_code=503, detail="Finnhub API key not configured")
    
    symbol = symbol.upper().strip()
    
    # Default: last 30 days
    if not from_ts:
        from_ts = int((datetime.utcnow().timestamp()) - 30 * 24 * 60 * 60)
    if not to_ts:
        to_ts = int(datetime.utcnow().timestamp())
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{FINNHUB_BASE_URL}/stock/candle",
                params={
                    "symbol": symbol,
                    "resolution": resolution,
                    "from": from_ts,
                    "to": to_ts,
                    "token": FINNHUB_API_KEY
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('s') == 'no_data':
                    return {
                        "symbol": symbol,
                        "timestamps": [],
                        "opens": [],
                        "highs": [],
                        "lows": [],
                        "closes": [],
                        "volumes": [],
                        "status": "no_data"
                    }
                
                return {
                    "symbol": symbol,
                    "resolution": resolution,
                    "timestamps": data.get('t', []),
                    "opens": data.get('o', []),
                    "highs": data.get('h', []),
                    "lows": data.get('l', []),
                    "closes": data.get('c', []),
                    "volumes": data.get('v', []),
                    "status": data.get('s', 'ok'),
                    "updated": datetime.utcnow().isoformat()
                }
            else:
                raise HTTPException(status_code=response.status_code, detail="Finnhub API error")
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch candles: {str(e)}")


# === STOCK SEARCH ===
@router.get("/search")
async def search_stocks(q: str):
    """Search for stock symbols by company name or ticker."""
    if not FINNHUB_API_KEY:
        raise HTTPException(status_code=503, detail="Finnhub API key not configured")
    
    if len(q) < 1:
        raise HTTPException(status_code=400, detail="Query too short")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{FINNHUB_BASE_URL}/search",
                params={
                    "q": q,
                    "token": FINNHUB_API_KEY
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('result', [])
                
                return {
                    "query": q,
                    "count": len(results),
                    "results": [
                        {
                            "symbol": r.get('symbol', ''),
                            "description": r.get('description', ''),
                            "type": r.get('type', ''),
                            "exchange": r.get('exchange', '')
                        }
                        for r in results[:20]  # Limit to 20 results
                    ],
                    "updated": datetime.utcnow().isoformat()
                }
            else:
                raise HTTPException(status_code=response.status_code, detail="Finnhub API error")
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search: {str(e)}")


# === MULTIPLE QUOTES ===
@router.post("/quotes")
async def get_multiple_quotes(symbols: List[str]):
    """Get quotes for multiple symbols at once."""
    if not FINNHUB_API_KEY:
        raise HTTPException(status_code=503, detail="Finnhub API key not configured")
    
    results = []
    for symbol in symbols[:10]:  # Max 10 symbols
        try:
            quote = await get_stock_quote(symbol)
            results.append(quote)
        except HTTPException:
            results.append({"symbol": symbol.upper(), "error": "Not found"})
    
    return {"quotes": results, "updated": datetime.utcnow().isoformat()}


# === POPULAR STOCKS (US & IDX) ===
@router.get("/popular")
async def get_popular_stocks():
    """Get quotes for popular/featured stocks."""
    # Major US stocks
    us_stocks = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA", "JPM", "V", "JNJ"]
    
    # Indonesian stocks (IDX)
    idx_stocks = ["BBCA.JK", "BBRI.JK", "TLKM.JK", "ASII.JK", "BMRI.JK", "UNVR.JK", "GOTO.JK", "BBNI.JK"]
    
    all_symbols = us_stocks + idx_stocks
    results = []
    
    for symbol in all_symbols:
        try:
            quote = await get_stock_quote(symbol)
            results.append(quote)
        except HTTPException:
            pass
    
    return {
        "stocks": results,
        "us_count": len([r for r in results if r.get('symbol', '') in us_stocks]),
        "idx_count": len([r for r in results if '.JK' in r.get('symbol', '')]),
        "updated": datetime.utcnow().isoformat()
    }


# === FINANCIAL NEWS ===
@router.get("/news")
async def get_financial_news(category: str = "general", min_id: int = 0):
    """Get latest financial news."""
    if not FINNHUB_API_KEY:
        raise HTTPException(status_code=503, detail="Finnhub API key not configured")
    
    valid_categories = ["general", "forex", "crypto", "merger"]
    if category not in valid_categories:
        category = "general"
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{FINNHUB_BASE_URL}/news",
                params={
                    "category": category.upper(),
                    "token": FINNHUB_API_KEY
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Filter by min_id if provided
                if min_id > 0:
                    data = [n for n in data if n.get('id', 0) > min_id]
                
                return {
                    "category": category,
                    "count": len(data),
                    "articles": [
                        {
                            "id": a.get('id'),
                            "category": a.get('category', ''),
                            "headline": a.get('headline', ''),
                            "summary": a.get('summary', ''),
                            "source": a.get('source', ''),
                            "url": a.get('url', ''),
                            "image": a.get('image', ''),
                            "datetime": a.get('datetime', 0)
                        }
                        for a in data[:20]  # Limit to 20 articles
                    ],
                    "updated": datetime.utcnow().isoformat()
                }
            else:
                raise HTTPException(status_code=response.status_code, detail="Finnhub API error")
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch news: {str(e)}")


# === WEBHOOK HANDLER ===
# Finnhub can send webhook events to your server

@router.post("/webhook")
async def finnhub_webhook(request: dict):
    """
    Handle incoming Finnhub webhook events.
    Configure webhook URL in Finnhub dashboard: https://your-domain.com/api/market/finnhub/webhook
    """
    event_type = request.get('type', 'unknown')
    data = request.get('data', {})
    
    print(f"[FINNHUB WEBHOOK] Event: {event_type}")
    print(f"[FINNHUB WEBHOOK] Data: {json.dumps(data, indent=2)}")
    
    # Process webhook events here
    # Common event types:
    # - "subscribe" - New subscription
    # - "unsubscribe" - Unsubscription
    # - "trade" - Trade notification (if using trade webhooks)
    
    if event_type == 'trade':
        # Process trade notification
        symbol = data.get('s', '')  # symbol
        price = data.get('p', 0)    # last price
        volume = data.get('v', 0)   # volume
        timestamp = data.get('t', 0)  # timestamp
        
        # Here you could:
        # - Update your database
        # - Send notifications
        # - Trigger alerts
        print(f"[TRADE] {symbol}: ${price} x {volume}")
    
    return {"status": "received", "event": event_type}


# === MARKET STATUS ===
@router.get("/market-status")
async def get_market_status():
    """Get current market status for major exchanges."""
    now = datetime.utcnow()
    
    # Simple market hours check (UTC)
    # US NYSE/NASDAQ: 14:30 - 21:00 UTC (9:30 AM - 4:00 PM EST)
    # Indonesia IDX: 02:00 - 08:00 UTC (9:00 AM - 3:30 PM WIB)
    
    us_hour = now.hour
    us_minute = now.minute
    us_time = us_hour * 60 + us_minute
    
    # US market hours (14:30 - 21:00 UTC)
    us_open = 14 * 60 + 30  # 14:30
    us_close = 21 * 60       # 21:00
    
    # Indonesia market hours (02:00 - 08:00 UTC)
    id_open = 2 * 60   # 02:00
    id_close = 8 * 60  # 08:00
    
    # Check if weekend
    is_weekend = now.weekday() >= 5
    
    return {
        "timestamp": now.isoformat(),
        "is_weekend": is_weekend,
        "exchanges": {
            "US": {
                "name": "NYSE / NASDAQ",
                "status": "open" if (us_open <= us_time < us_close and not is_weekend) else "closed",
                "open_time": "14:30 UTC",
                "close_time": "21:00 UTC",
                "timezone": "America/New_York"
            },
            "ID": {
                "name": "Indonesia Stock Exchange (IDX)",
                "status": "open" if (id_open <= us_time < id_close and not is_weekend) else "closed",
                "open_time": "02:00 UTC / 09:00 WIB",
                "close_time": "08:00 UTC / 15:30 WIB",
                "timezone": "Asia/Jakarta"
            }
        }
    }
