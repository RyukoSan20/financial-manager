"""
Comprehensive Real-Time Market Data API
Combines Yahoo Finance, CoinGecko, Open Exchange Rates for live market data
Updates every request - NO CACHE for real-time accuracy
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
from datetime import datetime
import asyncio

router = APIRouter(prefix="/realtime", tags=["realtime-market"])

# Extended stock list - Top Indonesian & Global stocks
STOCKS = {
    # Indonesian Stocks (IDX) - Yahoo Finance .JK suffix
    "BBCA": {"name": "Bank Central Asia", "yahoo": "BBCA.JK", "sector": "Banking", "market": "IDX"},
    "BBRI": {"name": "Bank Rakyat Indonesia", "yahoo": "BBRI.JK", "sector": "Banking", "market": "IDX"},
    "BMRI": {"name": "Bank Mandiri", "yahoo": "BMRI.JK", "sector": "Banking", "market": "IDX"},
    "BBNI": {"name": "Bank Negara Indonesia", "yahoo": "BBNI.JK", "sector": "Banking", "market": "IDX"},
    "BTPN": {"name": "BTPN", "yahoo": "BTPN.JK", "sector": "Banking", "market": "IDX"},
    "BDMN": {"name": "Bank Danamon", "yahoo": "BDMN.JK", "sector": "Banking", "market": "IDX"},
    "NISP": {"name": "Bank OCBC NISP", "yahoo": "NISP.JK", "sector": "Banking", "market": "IDX"},
    "BRIS": {"name": "Bank BRIsyariah", "yahoo": "BRIS.JK", "sector": "Banking", "market": "IDX"},
    
    # Consumer & Retail
    "UNVR": {"name": "Unilever Indonesia", "yahoo": "UNVR.JK", "sector": "Consumer", "market": "IDX"},
    "ICBP": {"name": "Indofood CBP", "yahoo": "ICBP.JK", "sector": "Consumer", "market": "IDX"},
    "INDF": {"name": "Indofood Sukses", "yahoo": "INDF.JK", "sector": "Consumer", "market": "IDX"},
    "KLBF": {"name": "Kalbe Farma", "yahoo": "KLBF.JK", "sector": "Healthcare", "market": "IDX"},
    "HMSP": {"name": "H.M. Sampoerna", "yahoo": "HMSP.JK", "sector": "Consumer", "market": "IDX"},
    "GGRM": {"name": "Gudang Garam", "yahoo": "GGRM.JK", "sector": "Consumer", "market": "IDX"},
    
    # Mining & Resources
    "PTBA": {"name": "Bukit Asam", "yahoo": "PTBA.JK", "sector": "Mining", "market": "IDX"},
    "ADRO": {"name": "Adaro Energy", "yahoo": "ADRO.JK", "sector": "Mining", "market": "IDX"},
    "ITMG": {"name": "Indo Tambangraya", "yahoo": "ITMG.JK", "sector": "Mining", "market": "IDX"},
    "ANTM": {"name": "Aneka Tambang", "yahoo": "ANTM.JK", "sector": "Mining", "market": "IDX"},
    "MDKA": {"name": "Merdeka Copper", "yahoo": "MDKA.JK", "sector": "Mining", "market": "IDX"},
    
    # Property & Real Estate
    "BSDE": {"name": "Bumi Serpong Damai", "yahoo": "BSDE.JK", "sector": "Property", "market": "IDX"},
    "PWON": {"name": "Pakuwon Jati", "yahoo": "PWON.JK", "sector": "Property", "market": "IDX"},
    "SMRA": {"name": "Summarecon Agung", "yahoo": "SMRA.JK", "sector": "Property", "market": "IDX"},
    "CTRA": {"name": "Ciputra Residence", "yahoo": "CTRA.JK", "sector": "Property", "market": "IDX"},
    
    # Telecommunications
    "TLKM": {"name": "Telekomunikasi Indonesia", "yahoo": "TLKM.JK", "sector": "Telecom", "market": "IDX"},
    "EXCL": {"name": "XL Axiata", "yahoo": "EXCL.JK", "sector": "Telecom", "market": "IDX"},
    "FREN": {"name": "Smartfren", "yahoo": "FREN.JK", "sector": "Telecom", "market": "IDX"},
    
    # Automotive
    "ASII": {"name": "Astra International", "yahoo": "ASII.JK", "sector": "Automotive", "market": "IDX"},
    "DMAS": {"name": " Selamat Sempurna", "yahoo": "DMAS.JK", "sector": "Automotive", "market": "IDX"},
    
    # Cement & Construction
    "SMGR": {"name": "Semen Indonesia", "yahoo": "SMGR.JK", "sector": "Cement", "market": "IDX"},
    "INTP": {"name": "Indocement Tunggal", "yahoo": "INTP.JK", "sector": "Cement", "market": "IDX"},
    "WSKT": {"name": "Waskita Karya", "yahoo": "WSKT.JK", "sector": "Construction", "market": "IDX"},
    "PTPP": {"name": "PP (Permana) Pratama", "yahoo": "PTPP.JK", "sector": "Construction", "market": "IDX"},
    
    # Poultry & Agriculture
    "CPIN": {"name": "Charoen Pokphand", "yahoo": "CPIN.JK", "sector": "Agri", "market": "IDX"},
    "JPRT": {"name": "Japfa Comfeed", "yahoo": "JPRT.JK", "sector": "Agri", "market": "IDX"},
    
    # Technology & Digital
    "GOTO": {"name": "GoTo Gojek Tokopedia", "yahoo": "GOTO.JK", "sector": "Technology", "market": "IDX"},
    "BUKA": {"name": "Bukalapak", "yahoo": "BUKA.JK", "sector": "Technology", "market": "IDX"},
}

# US Stocks
US_STOCKS = {
    "AAPL": {"name": "Apple Inc.", "sector": "Technology", "market": "US"},
    "MSFT": {"name": "Microsoft Corp.", "sector": "Technology", "market": "US"},
    "GOOGL": {"name": "Alphabet Inc.", "sector": "Technology", "market": "US"},
    "AMZN": {"name": "Amazon.com Inc.", "sector": "Consumer", "market": "US"},
    "TSLA": {"name": "Tesla Inc.", "sector": "Automotive", "market": "US"},
    "NVDA": {"name": "NVIDIA Corp.", "sector": "Technology", "market": "US"},
    "META": {"name": "Meta Platforms", "sector": "Technology", "market": "US"},
    "JPM": {"name": "JPMorgan Chase", "sector": "Banking", "market": "US"},
    "V": {"name": "Visa Inc.", "sector": "Finance", "market": "US"},
    "JNJ": {"name": "Johnson & Johnson", "sector": "Healthcare", "market": "US"},
}

# Crypto pairs
CRYPTO_PAIRS = {
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "BNB": "BNB-USD",
    "XRP": "XRP-USD",
    "SOL": "SOL-USD",
    "ADA": "ADA-USD",
    "DOGE": "DOGE-USD",
    "DOT": "DOT-USD",
    "AVAX": "AVAX-USD",
    "LINK": "LINK-USD",
}

# Forex pairs
FOREX_PAIRS = {
    "USD/IDR": "USDIDR=X",
    "USD/JPY": "USDJPY=X",
    "EUR/USD": "EURUSD=X",
    "GBP/USD": "GBPUSD=X",
    "AUD/USD": "AUDUSD=X",
    "USD/CAD": "USDCAD=X",
    "USD/CHF": "USDCHF=X",
    "EUR/IDR": "EURIDR=X",
    "SGD/IDR": "SGDIDR=X",
    "MYR/IDR": "MYRIDR=X",
}


class StockQuote(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    open: float
    high: float
    low: float
    close: float
    volume: int
    market_cap: Optional[float] = None
    sector: str
    market: str
    timestamp: str
    source: str


# ============ REALTIME IDX STOCKS ============
@router.get("/idx/quotes")
async def get_idx_quotes():
    """Get real-time quotes for ALL Indonesian stocks from Yahoo Finance."""
    results = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Fetch all IDX stocks in parallel batches
        stock_items = list(STOCKS.items())
        
        for symbol, info in stock_items:
            try:
                yahoo_symbol = info["yahoo"]
                resp = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}",
                    params={"interval": "1d", "range": "2d"},
                    headers={"User-Agent": "Mozilla/5.0"}
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    result = data.get('chart', {}).get('result', [{}])[0]
                    meta = result.get('meta', {})
                    
                    current_price = meta.get('regularMarketPrice', 0) or 0
                    prev_close = meta.get('previousClose', meta.get('chartPreviousClose', 0)) or 0
                    market_price = meta.get('regularMarketDayHigh', 0) or 0
                    
                    # Get today's OHLCV
                    quote = result.get('indicators', {}).get('quote', [{}])[0]
                    timestamps = result.get('timestamp', [])
                    
                    if timestamps:
                        idx = -1  # Latest candle
                        open_price = quote.get('open', [0])[idx] if idx < len(quote.get('open', [])) else current_price
                        high_price = quote.get('high', [0])[idx] if idx < len(quote.get('high', [])) else current_price
                        low_price = quote.get('low', [0])[idx] if idx < len(quote.get('low', [])) else current_price
                        vol = quote.get('volume', [0])[idx] if idx < len(quote.get('volume', [])) else 0
                        
                        if open_price is None: open_price = current_price
                        if high_price is None: high_price = current_price
                        if low_price is None: low_price = current_price
                        if vol is None: vol = 0
                    else:
                        open_price = high_price = low_price = current_price
                        vol = 0
                    
                    change = current_price - prev_close if current_price and prev_close else 0
                    change_pct = (change / prev_close * 100) if prev_close else 0
                    
                    if current_price > 0:
                        results.append({
                            "symbol": symbol,
                            "name": info["name"],
                            "price": float(current_price),
                            "change": float(change),
                            "change_percent": float(change_pct),
                            "open": float(open_price),
                            "high": float(high_price),
                            "low": float(low_price),
                            "close": float(current_price),
                            "volume": int(vol) if vol else 0,
                            "sector": info["sector"],
                            "market": info["market"],
                            "currency": "IDR",
                            "timestamp": datetime.now().isoformat(),
                            "source": "Yahoo Finance"
                        })
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")
    
    # Sort by market cap proxy (volume * price)
    results.sort(key=lambda x: -(x.get('volume', 0) * x.get('price', 0)))
    
    return {
        "quotes": results,
        "total": len(results),
        "updated": datetime.now().isoformat(),
        "source": "Yahoo Finance (Real-Time)"
    }


# ============ REALTIME US STOCKS ============
@router.get("/us/quotes")
async def get_us_quotes():
    """Get real-time quotes for US stocks from Yahoo Finance."""
    results = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for symbol, info in US_STOCKS.items():
            try:
                resp = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                    params={"interval": "1d", "range": "2d"},
                    headers={"User-Agent": "Mozilla/5.0"}
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    result = data.get('chart', {}).get('result', [{}])[0]
                    meta = result.get('meta', {})
                    
                    current_price = meta.get('regularMarketPrice', 0) or 0
                    prev_close = meta.get('previousClose', 0) or 0
                    quote = result.get('indicators', {}).get('quote', [{}])[0]
                    timestamps = result.get('timestamp', [])
                    
                    if timestamps:
                        idx = -1
                        open_price = quote.get('open', [0])[idx] if idx < len(quote.get('open', [])) else current_price
                        high_price = quote.get('high', [0])[idx] if idx < len(quote.get('high', [])) else current_price
                        low_price = quote.get('low', [0])[idx] if idx < len(quote.get('low', [])) else current_price
                        vol = quote.get('volume', [0])[idx] if idx < len(quote.get('volume', [])) else 0
                    else:
                        open_price = high_price = low_price = current_price
                        vol = 0
                    
                    change = current_price - prev_close if current_price and prev_close else 0
                    change_pct = (change / prev_close * 100) if prev_close else 0
                    
                    if current_price > 0:
                        results.append({
                            "symbol": symbol,
                            "name": info["name"],
                            "price": float(current_price),
                            "change": float(change),
                            "change_percent": float(change_pct),
                            "open": float(open_price) if open_price else 0,
                            "high": float(high_price) if high_price else 0,
                            "low": float(low_price) if low_price else 0,
                            "close": float(current_price),
                            "volume": int(vol) if vol else 0,
                            "sector": info["sector"],
                            "market": info["market"],
                            "currency": "USD",
                            "timestamp": datetime.now().isoformat(),
                            "source": "Yahoo Finance"
                        })
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")
    
    return {
        "quotes": results,
        "total": len(results),
        "updated": datetime.now().isoformat(),
        "source": "Yahoo Finance (Real-Time)"
    }


# ============ REALTIME CRYPTO ============
@router.get("/crypto/quotes")
async def get_crypto_quotes():
    """Get real-time crypto prices from Yahoo Finance."""
    results = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for symbol, yahoo_pair in CRYPTO_PAIRS.items():
            try:
                resp = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_pair}",
                    params={"interval": "1h", "range": "1d"},
                    headers={"User-Agent": "Mozilla/5.0"}
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    result = data.get('chart', {}).get('result', [{}])[0]
                    meta = result.get('meta', {})
                    
                    current_price = meta.get('regularMarketPrice', 0) or 0
                    prev_close = meta.get('chartPreviousClose', 0) or 0
                    vol = meta.get('regularMarketVolume', 0) or 0
                    
                    change = current_price - prev_close if current_price and prev_close else 0
                    change_pct = (change / prev_close * 100) if prev_close else 0
                    
                    if current_price > 0:
                        results.append({
                            "symbol": symbol,
                            "pair": yahoo_pair,
                            "price": float(current_price),
                            "change_24h": float(change),
                            "change_percent_24h": float(change_pct),
                            "volume_24h": int(vol),
                            "high_24h": float(meta.get('regularMarketDayHigh', 0) or 0),
                            "low_24h": float(meta.get('regularMarketDayLow', 0) or 0),
                            "currency": "USD",
                            "timestamp": datetime.now().isoformat(),
                            "source": "Yahoo Finance"
                        })
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")
    
    return {
        "quotes": results,
        "total": len(results),
        "updated": datetime.now().isoformat(),
        "source": "Yahoo Finance (Real-Time)"
    }


# ============ REALTIME FOREX ============
@router.get("/forex/quotes")
async def get_forex_quotes():
    """Get real-time forex rates from Yahoo Finance."""
    results = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for pair, yahoo_pair in FOREX_PAIRS.items():
            try:
                resp = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_pair}",
                    params={"interval": "1h", "range": "1d"},
                    headers={"User-Agent": "Mozilla/5.0"}
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    result = data.get('chart', {}).get('result', [{}])[0]
                    meta = result.get('meta', {})
                    
                    current_price = meta.get('regularMarketPrice', 0) or 0
                    prev_close = meta.get('chartPreviousClose', 0) or 0
                    
                    change = current_price - prev_close if current_price and prev_close else 0
                    change_pct = (change / prev_close * 100) if prev_close else 0
                    
                    if current_price > 0:
                        results.append({
                            "pair": pair,
                            "symbol": yahoo_pair,
                            "price": float(current_price),
                            "prev_close": float(prev_close),
                            "change": float(change),
                            "change_percent": float(change_pct),
                            "timestamp": datetime.now().isoformat(),
                            "source": "Yahoo Finance"
                        })
            except Exception as e:
                print(f"Error fetching {pair}: {e}")
    
    return {
        "quotes": results,
        "total": len(results),
        "updated": datetime.now().isoformat(),
        "source": "Yahoo Finance (Real-Time)"
    }


# ============ SINGLE STOCK DETAIL ============
@router.get("/stock/{symbol}")
async def get_stock_detail(symbol: str):
    """Get detailed real-time data for a single stock."""
    symbol = symbol.upper()
    
    # Check IDX
    if symbol in STOCKS:
        info = STOCKS[symbol]
        yahoo_symbol = info["yahoo"]
    elif symbol in US_STOCKS:
        info = US_STOCKS[symbol]
        yahoo_symbol = symbol
    else:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    
    async with httpx.AsyncClient(timeout=20.0) as client:
        # Get current quote
        resp = await client.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}",
            params={"interval": "1d", "range": "3mo"},
            headers={"User-Agent": "Mozilla/5.0"}
        )
        
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch data")
        
        data = resp.json()
        result = data.get('chart', {}).get('result', [{}])[0]
        meta = result.get('meta', {})
        
        current_price = meta.get('regularMarketPrice', 0) or 0
        prev_close = meta.get('previousClose', meta.get('chartPreviousClose', 0)) or 0
        
        # Get candles for chart
        quote = result.get('indicators', {}).get('quote', [{}])[0]
        timestamps = result.get('timestamp', [])
        
        candles = []
        for i, ts in enumerate(timestamps):
            candles.append({
                "time": ts,
                "open": quote.get('open', [0])[i] if i < len(quote.get('open', [])) else 0,
                "high": quote.get('high', [0])[i] if i < len(quote.get('high', [])) else 0,
                "low": quote.get('low', [0])[i] if i < len(quote.get('low', [])) else 0,
                "close": quote.get('close', [0])[i] if i < len(quote.get('close', [])) else 0,
                "volume": quote.get('volume', [0])[i] if i < len(quote.get('volume', [])) else 0,
            })
        
        change = current_price - prev_close if current_price and prev_close else 0
        change_pct = (change / prev_close * 100) if prev_close else 0
        
        return {
            "symbol": symbol,
            "name": info["name"],
            "price": float(current_price),
            "change": float(change),
            "change_percent": float(change_pct),
            "open": float(meta.get('regularMarketOpen', 0) or 0),
            "high": float(meta.get('regularMarketDayHigh', 0) or 0),
            "low": float(meta.get('regularMarketDayLow', 0) or 0),
            "prev_close": float(prev_close),
            "volume": int(meta.get('regularMarketVolume', 0) or 0),
            "market_cap": float(meta.get('marketCap', 0) or 0),
            "52w_high": float(meta.get('fiftyTwoWeekHigh', 0) or 0),
            "52w_low": float(meta.get('fiftyTwoWeekLow', 0) or 0),
            "sector": info["sector"],
            "market": info["market"],
            "currency": meta.get('currency', 'USD'),
            "candles": candles[-90:],  # Last 90 days
            "updated": datetime.now().isoformat(),
            "source": "Yahoo Finance (Real-Time)"
        }


# ============ COMPREHENSIVE SUMMARY ============
@router.get("/summary")
async def get_market_summary():
    """Get comprehensive market summary - all data sources."""
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Fetch all in parallel
        idx_task = get_idx_quotes()
        us_task = get_us_quotes()
        crypto_task = get_crypto_quotes()
        forex_task = get_forex_quotes()
        
        # Create tasks
        idx_results, us_results, crypto_results, forex_results = await asyncio.gather(
            idx_task, us_task, crypto_task, forex_task,
            return_exceptions=True
        )
        
        return {
            "updated": datetime.now().isoformat(),
            "idx_stocks": idx_results if isinstance(idx_results, dict) else {"quotes": [], "error": str(idx_results)},
            "us_stocks": us_results if isinstance(us_results, dict) else {"quotes": [], "error": str(us_results)},
            "crypto": crypto_results if isinstance(crypto_results, dict) else {"quotes": [], "error": str(crypto_results)},
            "forex": forex_results if isinstance(forex_results, dict) else {"quotes": [], "error": str(forex_results)},
            "source": "Yahoo Finance (Real-Time)"
        }
