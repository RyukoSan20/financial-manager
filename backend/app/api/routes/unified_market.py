"""
Unified Market API - Comprehensive Real-Time Market Data
Combines all market data sources into a single comprehensive endpoint.
Uses Yahoo Finance for real-time data (no cache, always fresh).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
from datetime import datetime
import asyncio
import os
import time

router = APIRouter(tags=["market"])

# Yahoo Finance symbols for comprehensive market data

# Indonesian Index
IHSG_SYMBOL = "^JKSE"
IHSG_NAME = "IHSG"

# Major Indonesian Stocks (IDX)
IDX_STOCKS = {
    "BBCA": {"name": "Bank Central Asia", "yahoo": "BBCA.JK", "sector": "Banking"},
    "BBRI": {"name": "Bank Rakyat Indonesia", "yahoo": "BBRI.JK", "sector": "Banking"},
    "BMRI": {"name": "Bank Mandiri", "yahoo": "BMRI.JK", "sector": "Banking"},
    "BBNI": {"name": "Bank Negara Indonesia", "yahoo": "BBNI.JK", "sector": "Banking"},
    "BTPN": {"name": "BTPN", "yahoo": "BTPN.JK", "sector": "Banking"},
    "NISP": {"name": "Bank OCBC NISP", "yahoo": "NISP.JK", "sector": "Banking"},
    "UNVR": {"name": "Unilever Indonesia", "yahoo": "UNVR.JK", "sector": "Consumer"},
    "ICBP": {"name": "Indofood CBP", "yahoo": "ICBP.JK", "sector": "Consumer"},
    "INDF": {"name": "Indofood Sukses", "yahoo": "INDF.JK", "sector": "Consumer"},
    "KLBF": {"name": "Kalbe Farma", "yahoo": "KLBF.JK", "sector": "Healthcare"},
    "HMSP": {"name": "H.M. Sampoerna", "yahoo": "HMSP.JK", "sector": "Consumer"},
    "GGRM": {"name": "Gudang Garam", "yahoo": "GGRM.JK", "sector": "Consumer"},
    "PTBA": {"name": "Bukit Asam", "yahoo": "PTBA.JK", "sector": "Mining"},
    "ADRO": {"name": "Adaro Energy", "yahoo": "ADRO.JK", "sector": "Mining"},
    "ITMG": {"name": "Indo Tambangraya", "yahoo": "ITMG.JK", "sector": "Mining"},
    "ANTM": {"name": "Aneka Tambang", "yahoo": "ANTM.JK", "sector": "Mining"},
    "MDKA": {"name": "Merdeka Copper", "yahoo": "MDKA.JK", "sector": "Mining"},
    "BSDE": {"name": "Bumi Serpong Damai", "yahoo": "BSDE.JK", "sector": "Property"},
    "PWON": {"name": "Pakuwon Jati", "yahoo": "PWON.JK", "sector": "Property"},
    "SMRA": {"name": "Summarecon Agung", "yahoo": "SMRA.JK", "sector": "Property"},
    "TLKM": {"name": "Telekomunikasi Indonesia", "yahoo": "TLKM.JK", "sector": "Telecom"},
    "EXCL": {"name": "XL Axiata", "yahoo": "EXCL.JK", "sector": "Telecom"},
    "ASII": {"name": "Astra International", "yahoo": "ASII.JK", "sector": "Automotive"},
    "SMGR": {"name": "Semen Indonesia", "yahoo": "SMGR.JK", "sector": "Cement"},
    "INTP": {"name": "Indocement Tunggal", "yahoo": "INTP.JK", "sector": "Cement"},
    "CPIN": {"name": "Charoen Pokphand", "yahoo": "CPIN.JK", "sector": "Agri"},
    "GOTO": {"name": "GoTo Gojek Tokopedia", "yahoo": "GOTO.JK", "sector": "Technology"},
    "BUKA": {"name": "Bukalapak", "yahoo": "BUKA.JK", "sector": "Technology"},
}

# US Stocks
US_STOCKS = {
    "AAPL": {"name": "Apple Inc.", "sector": "Technology"},
    "MSFT": {"name": "Microsoft Corp.", "sector": "Technology"},
    "GOOGL": {"name": "Alphabet Inc.", "sector": "Technology"},
    "AMZN": {"name": "Amazon.com Inc.", "sector": "Consumer"},
    "TSLA": {"name": "Tesla Inc.", "sector": "Automotive"},
    "NVDA": {"name": "NVIDIA Corp.", "sector": "Technology"},
    "META": {"name": "Meta Platforms", "sector": "Technology"},
    "JPM": {"name": "JPMorgan Chase", "sector": "Banking"},
    "V": {"name": "Visa Inc.", "sector": "Finance"},
    "JNJ": {"name": "Johnson & Johnson", "sector": "Healthcare"},
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

# Forex pairs (USD base)
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

# Commodities (Yahoo Finance futures)
COMMODITIES = {
    "GOLD": {"name": "Gold (XAU/USD)", "yahoo": "GC=F", "unit": "oz"},
    "SILVER": {"name": "Silver (XAG/USD)", "yahoo": "SI=F", "unit": "oz"},
    "CRUDE OIL": {"name": "Crude Oil (WTI)", "yahoo": "CL=F", "unit": "bbl"},
    "BRENT OIL": {"name": "Brent Crude", "yahoo": "BZ=F", "unit": "bbl"},
    "NATURAL GAS": {"name": "Natural Gas", "yahoo": "NG=F", "unit": "MMBtu"},
    "COPPER": {"name": "Copper", "yahoo": "HG=F", "unit": "lb"},
}

# Global Indices
GLOBAL_INDICES = {
    "^GSPC": {"name": "S&P 500", "region": "US"},
    "^IXIC": {"name": "NASDAQ", "region": "US"},
    "^DJI": {"name": "DOW JONES", "region": "US"},
    "^JKSE": {"name": "IHSG", "region": "ID"},
    "^N225": {"name": "NIKKEI 225", "region": "JP"},
    "^HSI": {"name": "HANG SENG", "region": "HK"},
    "^FTSE": {"name": "FTSE 100", "region": "UK"},
    "^AXJO": {"name": "ASX 200", "region": "AU"},
}


async def fetch_yahoo_quote(symbol: str, client: httpx.AsyncClient, retries: int = 3) -> Optional[Dict]:
    """Fetch a single quote from Yahoo Finance with retry logic."""
    for attempt in range(retries):
        try:
            resp = await client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                params={"interval": "1d", "range": "2d"},
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            )
            
            # Handle rate limiting with retry
            if resp.status_code == 429:
                if attempt < retries - 1:
                    wait_time = (attempt + 1) * 2  # Exponential backoff: 2, 4, 6 seconds
                    print(f"Rate limited for {symbol}, waiting {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    print(f"Rate limited for {symbol} after {retries} attempts")
                    return None
            
            if resp.status_code == 200:
                data = resp.json()
                result = data.get('chart', {}).get('result', [{}])[0]
                meta = result.get('meta', {})
                
                current_price = meta.get('regularMarketPrice', 0) or 0
                prev_close = meta.get('previousClose', meta.get('chartPreviousClose', 0)) or 0
                
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
                
                return {
                    "price": float(current_price),
                    "change": float(change),
                    "change_percent": float(change_pct),
                    "open": float(open_price) if open_price else 0,
                    "high": float(high_price) if high_price else 0,
                    "low": float(low_price) if low_price else 0,
                    "volume": int(vol) if vol else 0,
                    "prev_close": float(prev_close) if prev_close else 0,
                    "market_cap": float(meta.get('marketCap', 0)) or None,
                }
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
    return None


# Fallback data when Yahoo Finance is rate limited
FALLBACK_DATA = {
    "indices": [
        {"symbol": "^GSPC", "name": "S&P 500", "region": "US", "price": 5750.00, "change": 25.50, "change_percent": 0.45, "open": 5730.00, "high": 5760.00, "low": 5725.00, "volume": 2500000000},
        {"symbol": "^IXIC", "name": "NASDAQ", "region": "US", "price": 18500.00, "change": 120.00, "change_percent": 0.65, "open": 18400.00, "high": 18550.00, "low": 18380.00, "volume": 4500000000},
        {"symbol": "^DJI", "name": "DOW JONES", "region": "US", "price": 42000.00, "change": 150.00, "change_percent": 0.36, "open": 41850.00, "high": 42100.00, "low": 41800.00, "volume": 350000000},
        {"symbol": "^JKSE", "name": "IHSG", "region": "ID", "price": 7350.00, "change": 45.00, "change_percent": 0.62, "open": 7305.00, "high": 7365.00, "low": 7298.00, "volume": 850000000},
        {"symbol": "^N225", "name": "NIKKEI 225", "region": "JP", "price": 38500.00, "change": -75.00, "change_percent": -0.19, "open": 38575.00, "high": 38650.00, "low": 38400.00, "volume": 980000000},
        {"symbol": "^HSI", "name": "HANG SENG", "region": "HK", "price": 21500.00, "change": 85.00, "change_percent": 0.40, "open": 21415.00, "high": 21550.00, "low": 21380.00, "volume": 1200000000},
        {"symbol": "^FTSE", "name": "FTSE 100", "region": "UK", "price": 8200.00, "change": 35.00, "change_percent": 0.43, "open": 8165.00, "high": 8215.00, "low": 8150.00, "volume": 450000000},
        {"symbol": "^AXJO", "name": "ASX 200", "region": "AU", "price": 7800.00, "change": 20.00, "change_percent": 0.26, "open": 7780.00, "high": 7810.00, "low": 7765.00, "volume": 320000000},
    ],
    "idx_stocks": {
        "total": 8, "quotes": [
            {"symbol": "BBCA", "name": "Bank Central Asia", "sector": "Banking", "market": "IDX", "currency": "IDR", "price": 10250, "change": 125, "change_percent": 1.24, "open": 10125, "high": 10300, "low": 10100, "volume": 25000000},
            {"symbol": "BBRI", "name": "Bank Rakyat Indonesia", "sector": "Banking", "market": "IDX", "currency": "IDR", "price": 4800, "change": -35, "change_percent": -0.72, "open": 4835, "high": 4850, "low": 4785, "volume": 85000000},
            {"symbol": "BMRI", "name": "Bank Mandiri", "sector": "Banking", "market": "IDX", "currency": "IDR", "price": 6800, "change": 85, "change_percent": 1.26, "open": 6715, "high": 6825, "low": 6700, "volume": 42000000},
            {"symbol": "BBNI", "name": "Bank Negara Indonesia", "sector": "Banking", "market": "IDX", "currency": "IDR", "price": 5425, "change": 45, "change_percent": 0.84, "open": 5380, "high": 5450, "low": 5365, "volume": 28000000},
            {"symbol": "UNVR", "name": "Unilever Indonesia", "sector": "Consumer", "market": "IDX", "currency": "IDR", "price": 3650, "change": -15, "change_percent": -0.41, "open": 3665, "high": 3680, "low": 3635, "volume": 15000000},
            {"symbol": "TLKM", "name": "Telekomunikasi Indonesia", "sector": "Telecom", "market": "IDX", "currency": "IDR", "price": 2950, "change": 25, "change_percent": 0.85, "open": 2925, "high": 2965, "low": 2915, "volume": 35000000},
            {"symbol": "ASII", "name": "Astra International", "sector": "Automotive", "market": "IDX", "currency": "IDR", "price": 5675, "change": 55, "change_percent": 0.98, "open": 5620, "high": 5700, "low": 5600, "volume": 18000000},
            {"symbol": "GOTO", "name": "GoTo Gojek Tokopedia", "sector": "Technology", "market": "IDX", "currency": "IDR", "price": 68, "change": -1.5, "change_percent": -2.16, "open": 69.5, "high": 70, "low": 67, "volume": 450000000},
        ]
    },
    "us_stocks": {
        "total": 6, "quotes": [
            {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology", "market": "US", "currency": "USD", "price": 225.50, "change": 2.35, "change_percent": 1.05, "open": 223.15, "high": 226.80, "low": 222.50, "volume": 55000000},
            {"symbol": "MSFT", "name": "Microsoft Corp.", "sector": "Technology", "market": "US", "currency": "USD", "price": 425.80, "change": 5.20, "change_percent": 1.24, "open": 420.60, "high": 427.50, "low": 419.00, "volume": 22000000},
            {"symbol": "GOOGL", "name": "Alphabet Inc.", "sector": "Technology", "market": "US", "currency": "USD", "price": 175.25, "change": 1.85, "change_percent": 1.07, "open": 173.40, "high": 176.00, "low": 172.80, "volume": 28000000},
            {"symbol": "NVDA", "name": "NVIDIA Corp.", "sector": "Technology", "market": "US", "currency": "USD", "price": 135.50, "change": 4.25, "change_percent": 3.24, "open": 131.25, "high": 137.00, "low": 130.50, "volume": 450000000},
            {"symbol": "TSLA", "name": "Tesla Inc.", "sector": "Automotive", "market": "US", "currency": "USD", "price": 248.75, "change": -3.50, "change_percent": -1.39, "open": 252.25, "high": 254.00, "low": 246.50, "volume": 95000000},
            {"symbol": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer", "market": "US", "currency": "USD", "price": 185.50, "change": 2.10, "change_percent": 1.15, "open": 183.40, "high": 186.25, "low": 182.50, "volume": 42000000},
        ]
    },
    "crypto": {
        "total": 6, "quotes": [
            {"symbol": "BTC", "pair": "BTC-USD", "currency": "USD", "price": 96500.00, "change": 1250.00, "change_percent": 1.31, "volume_24h": 35000000000, "high_24h": 97500.00, "low_24h": 94800.00, "change_24h": 1250.00, "change_percent_24h": 1.31},
            {"symbol": "ETH", "pair": "ETH-USD", "currency": "USD", "price": 3450.00, "change": 85.00, "change_percent": 2.53, "volume_24h": 18000000000, "high_24h": 3480.00, "low_24h": 3350.00, "change_24h": 85.00, "change_percent_24h": 2.53},
            {"symbol": "BNB", "pair": "BNB-USD", "currency": "USD", "price": 605.00, "change": 12.50, "change_percent": 2.11, "volume_24h": 1500000000, "high_24h": 610.00, "low_24h": 590.00, "change_24h": 12.50, "change_percent_24h": 2.11},
            {"symbol": "SOL", "pair": "SOL-USD", "currency": "USD", "price": 185.00, "change": 5.50, "change_percent": 3.06, "volume_24h": 3500000000, "high_24h": 188.00, "low_24h": 178.00, "change_24h": 5.50, "change_percent_24h": 3.06},
            {"symbol": "XRP", "pair": "XRP-USD", "currency": "USD", "price": 2.35, "change": 0.08, "change_percent": 3.52, "volume_24h": 2500000000, "high_24h": 2.40, "low_24h": 2.25, "change_24h": 0.08, "change_percent_24h": 3.52},
            {"symbol": "ADA", "pair": "ADA-USD", "currency": "USD", "price": 0.85, "change": 0.025, "change_percent": 3.03, "volume_24h": 850000000, "high_24h": 0.87, "low_24h": 0.82, "change_24h": 0.025, "change_percent_24h": 3.03},
        ]
    },
    "forex": {
        "total": 6, "quotes": [
            {"pair": "USD/IDR", "symbol": "USDIDR=X", "price": 15650.00, "change": 45.00, "change_percent": 0.29, "open": 15605.00, "high": 15675.00, "low": 15590.00, "volume": 0},
            {"pair": "USD/JPY", "symbol": "USDJPY=X", "price": 149.50, "change": 0.35, "change_percent": 0.23, "open": 149.15, "high": 149.80, "low": 148.90, "volume": 0},
            {"pair": "EUR/USD", "symbol": "EURUSD=X", "price": 1.0850, "change": 0.0015, "change_percent": 0.14, "open": 1.0835, "high": 1.0865, "low": 1.0820, "volume": 0},
            {"pair": "GBP/USD", "symbol": "GBPUSD=X", "price": 1.2680, "change": 0.0020, "change_percent": 0.16, "open": 1.2660, "high": 1.2695, "low": 1.2645, "volume": 0},
            {"pair": "AUD/USD", "symbol": "AUDUSD=X", "price": 0.6520, "change": -0.0035, "change_percent": -0.53, "open": 0.6555, "high": 0.6570, "low": 0.6500, "volume": 0},
            {"pair": "USD/CHF", "symbol": "USDCHF=X", "price": 0.8850, "change": 0.0025, "change_percent": 0.28, "open": 0.8825, "high": 0.8870, "low": 0.8810, "volume": 0},
        ]
    },
    "commodities": {
        "total": 6, "quotes": [
            {"symbol": "GOLD", "name": "Gold (XAU/USD)", "unit": "oz", "price": 2685.00, "change": 15.50, "change_percent": 0.58, "open": 2669.50, "high": 2695.00, "low": 2660.00, "volume": 0},
            {"symbol": "SILVER", "name": "Silver (XAG/USD)", "unit": "oz", "price": 31.50, "change": 0.85, "change_percent": 2.77, "open": 30.65, "high": 31.80, "low": 30.20, "volume": 0},
            {"symbol": "CRUDE OIL", "name": "Crude Oil (WTI)", "unit": "bbl", "price": 72.50, "change": -0.85, "change_percent": -1.16, "open": 73.35, "high": 74.00, "low": 71.80, "volume": 0},
            {"symbol": "BRENT OIL", "name": "Brent Crude", "unit": "bbl", "price": 76.25, "change": -0.65, "change_percent": -0.85, "open": 76.90, "high": 77.50, "low": 75.50, "volume": 0},
            {"symbol": "NATURAL GAS", "name": "Natural Gas", "unit": "MMBtu", "price": 2.85, "change": -0.05, "change_percent": -1.72, "open": 2.90, "high": 2.95, "low": 2.75, "volume": 0},
            {"symbol": "COPPER", "name": "Copper", "unit": "lb", "price": 4.25, "change": 0.08, "change_percent": 1.92, "open": 4.17, "high": 4.30, "low": 4.12, "volume": 0},
        ]
    }
}


@router.get("/summary")
async def get_market_summary():
    """
    Get comprehensive real-time market summary.
    Fetches live data from Yahoo Finance - falls back to static data if rate limited.
    """
    # Track if we got real data
    got_live_data = False
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        results = {
            "updated": datetime.now().isoformat(),
            "source": "Yahoo Finance (Real-Time)",
            "indices": [],
            "idx_stocks": {"total": 0, "quotes": []},
            "us_stocks": {"total": 0, "quotes": []},
            "crypto": {"total": 0, "quotes": []},
            "forex": {"total": 0, "quotes": []},
            "commodities": {"total": 0, "quotes": []},
        }
        
        # 1. Fetch Global Indices in parallel
        indices_tasks = [
            fetch_yahoo_quote(symbol, client) for symbol in GLOBAL_INDICES.keys()
        ]
        indices_results = await asyncio.gather(*indices_tasks, return_exceptions=True)
        
        for i, (symbol, info) in enumerate(GLOBAL_INDICES.items()):
            quote = indices_results[i] if i < len(indices_results) else None
            if isinstance(quote, dict) and quote.get("price", 0) > 0:
                results["indices"].append({
                    "symbol": symbol,
                    "name": info["name"],
                    "region": info["region"],
                    **quote
                })
                got_live_data = True
        
        # 2. Fetch IDX Stocks in parallel (batches of 10)
        idx_tasks = [
            fetch_yahoo_quote(info["yahoo"], client) for info in IDX_STOCKS.values()
        ]
        idx_results = await asyncio.gather(*idx_tasks, return_exceptions=True)
        
        for i, (symbol, info) in enumerate(IDX_STOCKS.items()):
            quote = idx_results[i] if i < len(idx_results) and isinstance(idx_results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                results["idx_stocks"]["quotes"].append({
                    "symbol": symbol,
                    "name": info["name"],
                    "sector": info["sector"],
                    "market": "IDX",
                    "currency": "IDR",
                    **quote
                })
                got_live_data = True
        results["idx_stocks"]["total"] = len(results["idx_stocks"]["quotes"])
        
        # 3. Fetch US Stocks in parallel
        us_tasks = [
            fetch_yahoo_quote(symbol, client) for symbol in US_STOCKS.keys()
        ]
        us_results = await asyncio.gather(*us_tasks, return_exceptions=True)
        
        for i, (symbol, info) in enumerate(US_STOCKS.items()):
            quote = us_results[i] if i < len(us_results) and isinstance(us_results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                results["us_stocks"]["quotes"].append({
                    "symbol": symbol,
                    "name": info["name"],
                    "sector": info["sector"],
                    "market": "US",
                    "currency": "USD",
                    **quote
                })
        results["us_stocks"]["total"] = len(results["us_stocks"]["quotes"])
        
        # 4. Fetch Crypto in parallel
        crypto_tasks = [
            fetch_yahoo_quote(pair, client) for pair in CRYPTO_PAIRS.values()
        ]
        crypto_results = await asyncio.gather(*crypto_tasks, return_exceptions=True)
        
        for i, (symbol, pair) in enumerate(CRYPTO_PAIRS.items()):
            quote = crypto_results[i] if i < len(crypto_results) and isinstance(crypto_results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                results["crypto"]["quotes"].append({
                    "symbol": symbol,
                    "pair": pair,
                    "currency": "USD",
                    "volume_24h": quote.get("volume", 0),
                    "high_24h": quote.get("high", 0),
                    "low_24h": quote.get("low", 0),
                    "change_24h": quote.get("change", 0),
                    "change_percent_24h": quote.get("change_percent", 0),
                    **quote
                })
        results["crypto"]["total"] = len(results["crypto"]["quotes"])
        
        # 5. Fetch Forex in parallel
        forex_tasks = [
            fetch_yahoo_quote(pair, client) for pair in FOREX_PAIRS.values()
        ]
        forex_results = await asyncio.gather(*forex_tasks, return_exceptions=True)
        
        for i, (pair, yahoo_pair) in enumerate(FOREX_PAIRS.items()):
            quote = forex_results[i] if i < len(forex_results) and isinstance(forex_results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                results["forex"]["quotes"].append({
                    "pair": pair,
                    "symbol": yahoo_pair,
                    **quote
                })
        results["forex"]["total"] = len(results["forex"]["quotes"])
        
        # 6. Fetch Commodities in parallel
        comm_tasks = [
            fetch_yahoo_quote(info["yahoo"], client) for info in COMMODITIES.values()
        ]
        comm_results = await asyncio.gather(*comm_tasks, return_exceptions=True)
        
        for i, (symbol, info) in enumerate(COMMODITIES.items()):
            quote = comm_results[i] if i < len(comm_results) and isinstance(comm_results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                results["commodities"]["quotes"].append({
                    "symbol": symbol,
                    "name": info["name"],
                    "unit": info["unit"],
                    **quote
                })
        results["commodities"]["total"] = len(results["commodities"]["quotes"])
        
        # If no live data was fetched, use fallback
        if not results["indices"] and not results["idx_stocks"]["quotes"]:
            print("No live data fetched, using fallback data")
            results = {
                "updated": datetime.now().isoformat(),
                "source": "Fallback Data (Yahoo Finance rate limited)",
                **{k: v for k, v in FALLBACK_DATA.items()}
            }
        
        return results


@router.get("/indices")
async def get_indices():
    """Get global market indices - real-time from Yahoo Finance."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [fetch_yahoo_quote(symbol, client) for symbol in GLOBAL_INDICES.keys()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        indices = []
        for i, (symbol, info) in enumerate(GLOBAL_INDICES.items()):
            quote = results[i] if i < len(results) and isinstance(results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                indices.append({
                    "symbol": symbol,
                    "name": info["name"],
                    "region": info["region"],
                    **quote
                })
        
        return {
            "updated": datetime.now().isoformat(),
            "indices": indices,
            "source": "Yahoo Finance (Real-Time)"
        }


@router.get("/idx/stocks")
async def get_idx_stocks():
    """Get Indonesian stocks - real-time from Yahoo Finance."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        tasks = [fetch_yahoo_quote(info["yahoo"], client) for info in IDX_STOCKS.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        stocks = []
        for i, (symbol, info) in enumerate(IDX_STOCKS.items()):
            quote = results[i] if i < len(results) and isinstance(results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                stocks.append({
                    "symbol": symbol,
                    "name": info["name"],
                    "sector": info["sector"],
                    **quote
                })
        
        # Sort by volume * price (proxy for market cap)
        stocks.sort(key=lambda x: -(x.get('volume', 0) * x.get('price', 0)))
        
        return {
            "updated": datetime.now().isoformat(),
            "stocks": stocks,
            "total": len(stocks),
            "source": "Yahoo Finance (Real-Time)"
        }


@router.get("/us/stocks")
async def get_us_stocks():
    """Get US stocks - real-time from Yahoo Finance."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [fetch_yahoo_quote(symbol, client) for symbol in US_STOCKS.keys()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        stocks = []
        for i, (symbol, info) in enumerate(US_STOCKS.items()):
            quote = results[i] if i < len(results) and isinstance(results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                stocks.append({
                    "symbol": symbol,
                    "name": info["name"],
                    "sector": info["sector"],
                    **quote
                })
        
        return {
            "updated": datetime.now().isoformat(),
            "stocks": stocks,
            "total": len(stocks),
            "source": "Yahoo Finance (Real-Time)"
        }


@router.get("/crypto")
async def get_crypto():
    """Get cryptocurrency prices - real-time from Yahoo Finance."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [fetch_yahoo_quote(pair, client) for pair in CRYPTO_PAIRS.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        cryptos = []
        for i, (symbol, pair) in enumerate(CRYPTO_PAIRS.items()):
            quote = results[i] if i < len(results) and isinstance(results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                cryptos.append({
                    "symbol": symbol,
                    "pair": pair,
                    "currency": "USD",
                    "volume_24h": quote.get("volume", 0),
                    "high_24h": quote.get("high", 0),
                    "low_24h": quote.get("low", 0),
                    **quote
                })
        
        return {
            "updated": datetime.now().isoformat(),
            "crypto": cryptos,
            "total": len(cryptos),
            "source": "Yahoo Finance (Real-Time)"
        }


@router.get("/forex")
async def get_forex():
    """Get forex rates - real-time from Yahoo Finance."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [fetch_yahoo_quote(pair, client) for pair in FOREX_PAIRS.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        forex = []
        for i, (pair, yahoo_pair) in enumerate(FOREX_PAIRS.items()):
            quote = results[i] if i < len(results) and isinstance(results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                forex.append({
                    "pair": pair,
                    "symbol": yahoo_pair,
                    **quote
                })
        
        return {
            "updated": datetime.now().isoformat(),
            "forex": forex,
            "total": len(forex),
            "source": "Yahoo Finance (Real-Time)"
        }


@router.get("/commodities")
async def get_commodities():
    """Get commodity prices - real-time from Yahoo Finance."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [fetch_yahoo_quote(info["yahoo"], client) for info in COMMODITIES.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        commodities = []
        for i, (symbol, info) in enumerate(COMMODITIES.items()):
            quote = results[i] if i < len(results) and isinstance(results[i], dict) else None
            if quote and quote.get("price", 0) > 0:
                commodities.append({
                    "symbol": symbol,
                    "name": info["name"],
                    "unit": info["unit"],
                    **quote
                })
        
        return {
            "updated": datetime.now().isoformat(),
            "commodities": commodities,
            "total": len(commodities),
            "source": "Yahoo Finance (Real-Time)"
        }


@router.get("/stock/{symbol}")
async def get_stock_detail(symbol: str):
    """Get detailed real-time data for a single stock."""
    symbol = symbol.upper()
    
    # Check if it's IDX or US stock
    if symbol in IDX_STOCKS:
        info = IDX_STOCKS[symbol]
        yahoo_symbol = info["yahoo"]
    elif symbol in US_STOCKS:
        info = US_STOCKS[symbol]
        yahoo_symbol = symbol
    else:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    
    async with httpx.AsyncClient(timeout=20.0) as client:
        quote = await fetch_yahoo_quote(yahoo_symbol, client)
        
        if not quote or quote.get("price", 0) == 0:
            raise HTTPException(status_code=404, detail=f"Could not fetch data for {symbol}")
        
        return {
            "symbol": symbol,
            "name": info["name"],
            "sector": info["sector"],
            **quote,
            "updated": datetime.now().isoformat(),
            "source": "Yahoo Finance (Real-Time)"
        }
