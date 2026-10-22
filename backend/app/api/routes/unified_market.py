"""
Unified Market API - Real-time multi-asset market data.

Data sources (all verified reachable from the production VPS):
  - TradingView scanner API  -> global indices, IDX stocks, US stocks,
                                 forex pairs, crypto, commodities
  - CoinGecko               -> crypto (fallback / enrichment)
  - Frankfurter             -> forex rates (fallback)
  - API-Ninjas              -> commodities (fallback)

Yahoo Finance is NOT used: it returns HTTP 429 for datacenter IPs, which
silently degraded the whole Market page into static fallback numbers.

The response shape matches what frontend/src/pages/MarketPage.jsx expects:
  {
    updated, source,
    indices:      [ {symbol, name, region, price, change, change_percent,
                      open, high, low, volume} ],
    idx_stocks:   { total, quotes: [...] },
    us_stocks:    { total, quotes: [...] },
    crypto:       { total, quotes: [...] },
    forex:        { total, quotes: [...] },
    commodities:  { total, quotes: [...] }
  }
"""

from fastapi import APIRouter
from typing import Optional, List, Dict, Any
import httpx
import asyncio
import os
from datetime import datetime, timezone

router = APIRouter(tags=["market"])

TV_SCANNER_URL = "https://scanner.tradingview.com/global/scan"
TV_COLUMNS = [
    "name", "close", "change", "change_abs", "open", "high", "low",
    "volume", "currency", "description",
]
TV_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

API_NINJAS_KEY = os.getenv("API_NINJAS_KEY", "v8IqqlPhChYtBosWQNRD6CNAdmulvLC7zpdJYZH1")


# --- Symbol universe -------------------------------------------------------

GLOBAL_INDICES = [
    ("SP:SPX", "S&P 500", "US"),
    ("NASDAQ:NDX", "NASDAQ", "US"),
    ("DJ:DJI", "DOW JONES", "US"),
    ("IDX:COMPOSITE", "IHSG", "ID"),
    ("TVC:NI225", "NIKKEI 225", "JP"),
    ("TVC:HSI", "HANG SENG", "HK"),
    ("FTSE:UKX", "FTSE 100", "UK"),
    # ASX 200 is not published on the ASX exchange feed; OANDA publishes the
    # same "Australia 200" cash index and it carries full OHLC data.
    ("OANDA:AU200AUD", "ASX 200", "AU"),
]

IDX_STOCKS = [
    ("BBCA", "IDX:BBCA", "Bank Central Asia", "Banking"),
    ("BBRI", "IDX:BBRI", "Bank Rakyat Indonesia", "Banking"),
    ("BMRI", "IDX:BMRI", "Bank Mandiri", "Banking"),
    ("BBNI", "IDX:BBNI", "Bank Negara Indonesia", "Banking"),
    ("BTPN", "IDX:BTPN", "Bank BTPN", "Banking"),
    ("UNVR", "IDX:UNVR", "Unilever Indonesia", "Consumer"),
    ("INDF", "IDX:INDF", "Indofood Sukses", "Consumer"),
    ("ICBP", "IDX:ICBP", "Indofood CBP", "Consumer"),
    ("KLBF", "IDX:KLBF", "Kalbe Farma", "Healthcare"),
    ("HMSP", "IDX:HMSP", "H.M. Sampoerna", "Consumer"),
    ("GGRM", "IDX:GGRM", "Gudang Garam", "Consumer"),
    ("PTBA", "IDX:PTBA", "Bukit Asam", "Mining"),
    ("ADRO", "IDX:ADRO", "Alamtri Resources", "Mining"),
    ("ITMG", "IDX:ITMG", "Indo Tambangraya", "Mining"),
    ("ANTM", "IDX:ANTM", "Aneka Tambang", "Mining"),
    ("MDKA", "IDX:MDKA", "Merdeka Copper", "Mining"),
    ("BSDE", "IDX:BSDE", "Bumi Serpong Damai", "Property"),
    ("PWON", "IDX:PWON", "Pakuwon Jati", "Property"),
    ("SMRA", "IDX:SMRA", "Summarecon Agung", "Property"),
    ("TLKM", "IDX:TLKM", "Telkom Indonesia", "Telecom"),
    ("EXCL", "IDX:EXCL", "XL Axiata", "Telecom"),
    ("ASII", "IDX:ASII", "Astra International", "Automotive"),
    ("SMGR", "IDX:SMGR", "Semen Indonesia", "Cement"),
    ("INTP", "IDX:INTP", "Indocement Tunggal", "Cement"),
    ("CPIN", "IDX:CPIN", "Charoen Pokphand", "Agri"),
    ("GOTO", "IDX:GOTO", "GoTo Gojek Tokopedia", "Technology"),
    ("BUKA", "IDX:BUKA", "Bukalapak", "Technology"),
]

US_STOCKS = [
    ("AAPL", "NASDAQ:AAPL", "Apple Inc.", "Technology"),
    ("MSFT", "NASDAQ:MSFT", "Microsoft Corp.", "Technology"),
    ("GOOGL", "NASDAQ:GOOGL", "Alphabet Inc.", "Technology"),
    ("AMZN", "NASDAQ:AMZN", "Amazon.com Inc.", "Consumer"),
    ("TSLA", "NASDAQ:TSLA", "Tesla Inc.", "Automotive"),
    ("NVDA", "NASDAQ:NVDA", "NVIDIA Corp.", "Technology"),
    ("META", "NASDAQ:META", "Meta Platforms", "Technology"),
    ("NFLX", "NASDAQ:NFLX", "Netflix Inc.", "Entertainment"),
    ("JPM", "NYSE:JPM", "JPMorgan Chase", "Banking"),
    ("V", "NYSE:V", "Visa Inc.", "Finance"),
    ("JNJ", "NYSE:JNJ", "Johnson & Johnson", "Healthcare"),
]

FOREX_PAIRS = [
    ("USD/IDR", "FX_IDC:USDIDR"),
    ("EUR/USD", "FX_IDC:EURUSD"),
    ("GBP/USD", "FX_IDC:GBPUSD"),
    ("USD/JPY", "FX_IDC:USDJPY"),
    ("AUD/USD", "FX_IDC:AUDUSD"),
    ("USD/CAD", "FX_IDC:USDCAD"),
    ("USD/CHF", "FX_IDC:USDCHF"),
]

CRYPTO_PAIRS = [
    ("BTC", "BINANCE:BTCUSDT"),
    ("ETH", "BINANCE:ETHUSDT"),
    ("BNB", "BINANCE:BNBUSDT"),
    ("XRP", "BINANCE:XRPUSDT"),
    ("SOL", "BINANCE:SOLUSDT"),
    ("ADA", "BINANCE:ADAUSDT"),
    ("DOGE", "BINANCE:DOGEUSDT"),
    ("DOT", "BINANCE:DOTUSDT"),
    ("AVAX", "BINANCE:AVAXUSDT"),
    ("LINK", "BINANCE:LINKUSDT"),
]

COMMODITIES = [
    ("GOLD", "TVC:GOLD", "Gold (XAU/USD)", "oz"),
    ("SILVER", "TVC:SILVER", "Silver (XAG/USD)", "oz"),
    ("CRUDE OIL", "TVC:USOIL", "Crude Oil (WTI)", "bbl"),
    ("BRENT OIL", "TVC:UKOIL", "Brent Crude", "bbl"),
    ("NATURAL GAS", "TVC:NATURALGAS", "Natural Gas", "MMBtu"),
    ("COPPER", "COMEX:HG1!", "Copper", "lb"),
]

# TradingView symbol -> display metadata, resolved after a scan.
TV_META = {}
for _sym, _name, _region in GLOBAL_INDICES:
    TV_META[_sym] = {"name": _name, "region": _region, "kind": "index"}
for _sym, _tv, _name, _sector in IDX_STOCKS:
    TV_META[_tv] = {"name": _name, "sector": _sector, "kind": "idx", "symbol": _sym,
                    "market": "IDX", "currency": "IDR"}
for _sym, _tv, _name, _sector in US_STOCKS:
    TV_META[_tv] = {"name": _name, "sector": _sector, "kind": "us", "symbol": _sym,
                    "market": "US", "currency": "USD"}
for _label, _tv in FOREX_PAIRS:
    TV_META[_tv] = {"kind": "forex", "pair": _label}
for _sym, _tv in CRYPTO_PAIRS:
    TV_META[_tv] = {"kind": "crypto", "symbol": _sym, "currency": "USD"}
for _sym, _tv, _name, _unit in COMMODITIES:
    TV_META[_tv] = {"kind": "commodity", "symbol": _sym, "name": _name, "unit": _unit,
                    "currency": "USD"}


# --- Helpers ----------------------------------------------------------------

def _f(value, default=0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


async def fetch_tv_scan(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
    """Fetch quotes for a list of TradingView tickers.

    Returns a mapping of ticker -> normalized quote dict.
    """
    if not tickers:
        return {}

    payload = {
        "symbols": {"tickers": tickers, "query": {"types": []}},
        "columns": TV_COLUMNS,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0, headers=TV_HEADERS) as client:
            resp = await client.post(TV_SCANNER_URL, json=payload)
            if resp.status_code != 200:
                print(f"[market] TradingView scanner HTTP {resp.status_code}")
                return {}
            data = resp.json()
    except Exception as exc:  # noqa: BLE001 - network failure must not 500 the page
        print(f"[market] TradingView scanner error: {exc}")
        return {}

    out: Dict[str, Dict[str, Any]] = {}
    for row in data.get("data", []) or []:
        ticker = row.get("s")
        values = row.get("d") or []
        if not ticker or len(values) < 8:
            continue

        close = _f(values[1])
        change_pct = _f(values[2])
        change_abs = _f(values[3])
        out[ticker] = {
            "close": close,
            "change": change_abs,
            "change_percent": change_pct,
            "open": _f(values[4], close),
            "high": _f(values[5], close),
            "low": _f(values[6], close),
            "volume": int(_f(values[7])),
            "currency": values[8] if len(values) > 8 else None,
            "description": values[9] if len(values) > 9 else None,
        }
    return out


async def fetch_coingecko() -> List[Dict[str, Any]]:
    """CoinGecko fallback for crypto (used when TradingView has no quote)."""
    ids = "bitcoin,ethereum,binancecoin,ripple,solana,cardano,dogecoin,polkadot,avalanche-2,chainlink"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": ids,
                    "vs_currencies": "usd",
                    "include_24hr_change": "true",
                },
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
    except Exception as exc:  # noqa: BLE001
        print(f"[market] CoinGecko error: {exc}")
        return []

    symbol_map = {
        "bitcoin": "BTC", "ethereum": "ETH", "binancecoin": "BNB",
        "ripple": "XRP", "solana": "SOL", "cardano": "ADA",
        "dogecoin": "DOGE", "polkadot": "DOT",
        "avalanche-2": "AVAX", "chainlink": "LINK",
    }
    out = []
    for coin_id, values in data.items():
        symbol = symbol_map.get(coin_id, coin_id.upper())
        out.append({
            "symbol": symbol,
            "price": _f(values.get("usd")),
            "change_percent": _f(values.get("usd_24h_change")),
            "currency": "USD",
        })
    return out


async def fetch_frankfurter() -> Dict[str, float]:
    """Frankfurter fallback for forex rates."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.frankfurter.app/latest", params={"from": "USD"}
            )
            if resp.status_code != 200:
                return {}
            return resp.json().get("rates", {}) or {}
    except Exception as exc:  # noqa: BLE001
        print(f"[market] Frankfurter error: {exc}")
        return {}


async def fetch_ninjas_commodities() -> Dict[str, Dict[str, Any]]:
    """API-Ninjas fallback for commodities."""
    names = ["Gold", "Silver", "Crude Oil", "Natural Gas", "Copper"]
    out: Dict[str, Dict[str, Any]] = {}
    try:
        async with httpx.AsyncClient(
            timeout=12.0, headers={"X-Api-Key": API_NINJAS_KEY}
        ) as client:
            for name in names:
                try:
                    resp = await client.get(
                        "https://api.api-ninjas.com/v1/commodityprice",
                        params={"name": name},
                    )
                    if resp.status_code == 200:
                        out[name.upper()] = resp.json()
                except Exception:  # noqa: BLE001
                    continue
    except Exception as exc:  # noqa: BLE001
        print(f"[market] API-Ninjas error: {exc}")
    return out


# --- Core fetch -------------------------------------------------------------

async def _collect() -> Dict[str, Any]:
    """Fetch every asset class and return the normalized payload."""
    all_tickers = (
        [t for t, _, _ in GLOBAL_INDICES]
        + [tv for _, tv, _, _ in IDX_STOCKS]
        + [tv for _, tv, _, _ in US_STOCKS]
        + [tv for _, tv in FOREX_PAIRS]
        + [tv for _, tv in CRYPTO_PAIRS]
        + [tv for _, tv, _, _ in COMMODITIES]
    )

    quotes = await fetch_tv_scan(all_tickers)

    results: Dict[str, Any] = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "source": "TradingView (Real-Time)",
        "indices": [],
        "idx_stocks": {"total": 0, "quotes": []},
        "us_stocks": {"total": 0, "quotes": []},
        "crypto": {"total": 0, "quotes": []},
        "forex": {"total": 0, "quotes": []},
        "commodities": {"total": 0, "quotes": []},
    }

    # --- Global indices ---
    for ticker, name, region in GLOBAL_INDICES:
        q = quotes.get(ticker)
        if not q or q["close"] <= 0:
            continue
        results["indices"].append({
            "symbol": ticker.split(":")[1],
            "name": name,
            "region": region,
            "price": q["close"],
            "change": q["change"],
            "change_percent": q["change_percent"],
            "open": q["open"],
            "high": q["high"],
            "low": q["low"],
            "volume": q["volume"],
        })

    # --- IDX stocks ---
    for symbol, ticker, name, sector in IDX_STOCKS:
        q = quotes.get(ticker)
        if not q or q["close"] <= 0:
            continue
        results["idx_stocks"]["quotes"].append({
            "symbol": symbol,
            "name": name,
            "sector": sector,
            "market": "IDX",
            "currency": "IDR",
            "price": q["close"],
            "change": q["change"],
            "change_percent": q["change_percent"],
            "open": q["open"],
            "high": q["high"],
            "low": q["low"],
            "volume": q["volume"],
        })
    results["idx_stocks"]["total"] = len(results["idx_stocks"]["quotes"])

    # --- US stocks ---
    for symbol, ticker, name, sector in US_STOCKS:
        q = quotes.get(ticker)
        if not q or q["close"] <= 0:
            continue
        results["us_stocks"]["quotes"].append({
            "symbol": symbol,
            "name": name,
            "sector": sector,
            "market": "US",
            "currency": "USD",
            "price": q["close"],
            "change": q["change"],
            "change_percent": q["change_percent"],
            "open": q["open"],
            "high": q["high"],
            "low": q["low"],
            "volume": q["volume"],
        })
    results["us_stocks"]["total"] = len(results["us_stocks"]["quotes"])

    # --- Forex ---
    for label, ticker in FOREX_PAIRS:
        q = quotes.get(ticker)
        if not q or q["close"] <= 0:
            continue
        results["forex"]["quotes"].append({
            "pair": label,
            "symbol": ticker.split(":")[1],
            "price": q["close"],
            "change": q["change"],
            "change_percent": q["change_percent"],
            "open": q["open"],
            "high": q["high"],
            "low": q["low"],
            "currency": q.get("currency") or "USD",
        })
    results["forex"]["total"] = len(results["forex"]["quotes"])

    # --- Crypto ---
    for symbol, ticker in CRYPTO_PAIRS:
        q = quotes.get(ticker)
        if not q or q["close"] <= 0:
            continue
        results["crypto"]["quotes"].append({
            "symbol": symbol,
            "pair": ticker.split(":")[1],
            "currency": "USD",
            "price": q["close"],
            "change": q["change"],
            "change_percent": q["change_percent"],
            "change_24h": q["change"],
            "change_percent_24h": q["change_percent"],
            "open": q["open"],
            "high": q["high"],
            "low": q["low"],
            "volume_24h": q["volume"],
        })

    # Crypto fallback via CoinGecko for anything TradingView missed
    if len(results["crypto"]["quotes"]) < len(CRYPTO_PAIRS):
        known = {c["symbol"] for c in results["crypto"]["quotes"]}
        for coin in await fetch_coingecko():
            if coin["symbol"] in known or coin["price"] <= 0:
                continue
            results["crypto"]["quotes"].append({
                "symbol": coin["symbol"],
                "pair": f"{coin['symbol']}USDT",
                "currency": "USD",
                "price": coin["price"],
                "change": 0,
                "change_percent": coin["change_percent"],
                "change_24h": 0,
                "change_percent_24h": coin["change_percent"],
                "open": coin["price"],
                "high": coin["price"],
                "low": coin["price"],
                "volume_24h": 0,
            })
    results["crypto"]["total"] = len(results["crypto"]["quotes"])

    # --- Commodities ---
    ninjas_map = {
        "GOLD": "GOLD", "SILVER": "SILVER", "CRUDE OIL": "CRUDE OIL",
        "NATURAL GAS": "NATURAL GAS", "COPPER": "COPPER",
    }
    ninjas_data: Dict[str, Dict[str, Any]] = {}
    for symbol, ticker, name, unit in COMMODITIES:
        q = quotes.get(ticker)
        if q and q["close"] > 0:
            results["commodities"]["quotes"].append({
                "symbol": symbol,
                "name": name,
                "unit": unit,
                "currency": "USD",
                "price": q["close"],
                "change": q["change"],
                "change_percent": q["change_percent"],
                "open": q["open"],
                "high": q["high"],
                "low": q["low"],
            })

    if len(results["commodities"]["quotes"]) < len(COMMODITIES):
        ninjas_data = await fetch_ninjas_commodities()
        known = {c["symbol"] for c in results["commodities"]["quotes"]}
        for symbol, ticker, name, unit in COMMODITIES:
            if symbol in known:
                continue
            n = ninjas_data.get(ninjas_map.get(symbol, ""), {})
            if not n:
                continue
            results["commodities"]["quotes"].append({
                "symbol": symbol,
                "name": name,
                "unit": unit,
                "currency": n.get("currency_unit", "USD"),
                "price": _f(n.get("price")),
                "change": _f(n.get("change_24h")),
                "change_percent": _f(n.get("change_24h_percent")),
                "open": _f(n.get("open")),
                "high": _f(n.get("high")),
                "low": _f(n.get("low")),
            })
    results["commodities"]["total"] = len(results["commodities"]["quotes"])

    return results


# --- Endpoints --------------------------------------------------------------

@router.get("/summary")
async def get_market_summary():
    """Comprehensive real-time market summary for every asset class."""
    try:
        results = await _collect()
    except Exception as exc:  # noqa: BLE001
        print(f"[market] summary failed: {exc}")
        return {
            "updated": datetime.now(timezone.utc).isoformat(),
            "source": "Unavailable",
            "error": str(exc),
            "indices": [],
            "idx_stocks": {"total": 0, "quotes": []},
            "us_stocks": {"total": 0, "quotes": []},
            "crypto": {"total": 0, "quotes": []},
            "forex": {"total": 0, "quotes": []},
            "commodities": {"total": 0, "quotes": []},
        }

    # Signal to the frontend when data is thin so it can show a warning.
    if not results["indices"] and not results["idx_stocks"]["quotes"]:
        results["source"] = "TradingView (no data)"
    return results


@router.get("/indices")
async def get_indices():
    results = await _collect()
    return {"updated": results["updated"], "indices": results["indices"]}


@router.get("/idx/stocks")
async def get_idx_stocks():
    results = await _collect()
    return {"updated": results["updated"], **results["idx_stocks"]}


@router.get("/us/stocks")
async def get_us_stocks():
    results = await _collect()
    return {"updated": results["updated"], **results["us_stocks"]}


@router.get("/crypto")
async def get_crypto():
    results = await _collect()
    return {"updated": results["updated"], **results["crypto"]}


@router.get("/forex")
async def get_forex():
    results = await _collect()
    if not results["forex"]["quotes"]:
        rates = await fetch_frankfurter()
        for pair, rate in rates.items():
            results["forex"]["quotes"].append({
                "pair": f"USD/{pair}",
                "symbol": f"USD{pair}",
                "price": _f(rate),
                "change": 0,
                "change_percent": 0,
                "open": _f(rate),
                "high": _f(rate),
                "low": _f(rate),
                "currency": "IDR" if pair == "IDR" else "USD",
            })
        results["forex"]["total"] = len(results["forex"]["quotes"])
    return {"updated": results["updated"], **results["forex"]}


@router.get("/commodities")
async def get_commodities():
    results = await _collect()
    return {"updated": results["updated"], **results["commodities"]}


@router.get("/stock/{symbol}")
async def get_stock_detail(symbol: str):
    """Live detail for a single symbol (IDX or US)."""
    symbol = symbol.upper()
    ticker = None
    meta = None
    for s, tv, name, sector in IDX_STOCKS:
        if s == symbol:
            ticker, meta = tv, {"name": name, "sector": sector, "market": "IDX",
                                "currency": "IDR"}
            break
    if ticker is None:
        for s, tv, name, sector in US_STOCKS:
            if s == symbol:
                ticker, meta = tv, {"name": name, "sector": sector, "market": "US",
                                    "currency": "USD"}
                break
    if ticker is None:
        return {"symbol": symbol, "error": "Symbol not tracked"}

    quotes = await fetch_tv_scan([ticker])
    q = quotes.get(ticker)
    if not q:
        return {"symbol": symbol, "error": "No live quote available", **meta}
    return {"symbol": symbol, **meta, **q}
