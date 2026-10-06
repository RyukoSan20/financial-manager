"""
Exchange Rate API routes.
Uses Frankfurter API (free, no API key required).
Rates are cached for 1 hour to avoid rate limits.
Includes fallback rates for currencies not supported by Frankfurter (IDR, VND, etc.)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
import httpx
from datetime import datetime, timedelta
import asyncio

router = APIRouter()

# Fallback rates for currencies not in Frankfurter (approximate)
FALLBACK_RATES_FROM_USD = {
    "IDR": 15600.0,  # 1 USD = 15600 IDR
    "VND": 24500.0,  # Frankfurter has this but include for completeness
    "KRW": 1320.0,   # Frankfurter has this
    "PHP": 56.5,     # Frankfurter has this
    "THB": 35.2,     # Frankfurter has this
}

# Cache for exchange rates
class RateCache:
    def __init__(self):
        self.rates: Dict = {}
        self.last_update: Optional[datetime] = None
        self.base_currency: str = "USD"
        self.cache_duration = timedelta(hours=1)
    
    async def fetch_rates(self, base: str = "USD") -> Dict:
        """Fetch latest exchange rates from Frankfurter API."""
        now = datetime.utcnow()
        
        # Return cached if still valid
        if (self.last_update and 
            now - self.last_update < self.cache_duration and 
            self.base_currency == base and 
            self.rates):
            return self.rates
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"https://api.frankfurter.app/latest",
                    params={"from": base}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.rates = data.get("rates", {})
                    self.rates[base] = 1.0  # Base currency = 1
                    self.last_update = now
                    self.base_currency = base
                    return self.rates
                else:
                    # Return fallback rates if API fails
                    return self._get_fallback_rates(base)
                    
        except Exception as e:
            print(f"Exchange rate fetch error: {e}")
            return self._get_fallback_rates(base)
    
    def _get_fallback_rates(self, base: str) -> Dict:
        """Fallback rates (approximate) if API is unavailable."""
        # Approximate rates as of late 2024
        fallback = {
            "EUR": 0.92, "GBP": 0.79, "JPY": 149.5, "AUD": 1.53,
            "CAD": 1.36, "CHF": 0.88, "CNY": 7.24, "INR": 83.1,
            "MYR": 4.72, "SGD": 1.34, "THB": 35.2, "KRW": 1320,
            "PHP": 56.5, "VND": 24500, "HKD": 7.82,
        }
        
        if base == "USD":
            return fallback
        elif base == "EUR":
            return {k: v / 0.92 for k, v in fallback.items()}
        elif base == "IDR":
            return {k: v * 15600 for k, v in fallback.items()}
        else:
            return fallback

# Singleton cache instance
rate_cache = RateCache()


class ConvertRequest(BaseModel):
    amount: float
    from_currency: str
    to_currency: str


class RateResponse(BaseModel):
    base: str
    date: str
    rates: Dict[str, float]


@router.get("/rates", response_model=RateResponse)
async def get_exchange_rates(base: str = "USD"):
    """Get latest exchange rates with base currency."""
    # Validate base currency
    valid_currencies = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", 
                       "CNY", "INR", "MYR", "SGD", "THB", "KRW", "PHP", 
                       "VND", "HKD", "IDR", "NZD", "SEK", "NOK", "DKK",
                       "MXN", "BRL", "ZAR", "RUB", "TRY", "PLN", "CZK"]
    
    base_upper = base.upper()
    if base_upper not in valid_currencies:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid base currency. Supported: {', '.join(valid_currencies[:10])}..."
        )
    
    rates = await rate_cache.fetch_rates(base_upper)
    
    # Add IDR if not in response (calculate from USD)
    if "IDR" not in rates and base_upper != "IDR":
        if "USD" in rates:
            idr_rate = rates.get("USD", 1) * 15600  # Approximate IDR rate
            rates["IDR"] = idr_rate
    
    return RateResponse(
        base=base_upper,
        date=datetime.utcnow().strftime("%Y-%m-%d"),
        rates=rates
    )


@router.post("/convert")
async def convert_currency(request: ConvertRequest):
    """Convert amount from one currency to another."""
    from_upper = request.from_currency.upper()
    to_upper = request.to_currency.upper()
    
    # Same currency
    if from_upper == to_upper:
        return {
            "from": from_upper,
            "to": to_upper,
            "amount": request.amount,
            "result": request.amount,
            "rate": 1.0
        }
    
    # Get rates with USD as base (most reliable)
    rates_usd = await rate_cache.fetch_rates("USD")
    
    # Build complete rates with fallback for unsupported currencies
    complete_rates = {**rates_usd}
    for currency, usd_rate in FALLBACK_RATES_FROM_USD.items():
        if currency not in complete_rates:
            complete_rates[currency] = usd_rate
    
    # Calculate conversion using USD as intermediate
    # amount in from_currency -> USD -> to_currency
    
    # Get from_currency rate (how many USD for 1 from_currency)
    from_rate = complete_rates.get(from_upper, 1.0)
    
    # Get to_currency rate (how many USD for 1 to_currency)
    to_rate = complete_rates.get(to_upper, 1.0)
    
    if from_rate == 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot convert from {from_upper}. Rate unavailable."
        )
    
    # Conversion: amount / from_rate * to_rate
    # Example: IDR 1,000,000 -> USD: 1,000,000 / 15600 * 1 = ~$64.10
    rate = to_rate / from_rate
    result = request.amount * rate
    
    return {
        "from": from_upper,
        "to": to_upper,
        "amount": request.amount,
        "result": round(result, 4),
        "rate": round(rate, 8),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/symbols")
async def get_currency_symbols():
    """Get currency symbols for display."""
    return {
        "symbols": {
            "USD": {"symbol": "$", "name": "US Dollar", "flag": "🇺🇸"},
            "EUR": {"symbol": "€", "name": "Euro", "flag": "🇪🇺"},
            "GBP": {"symbol": "£", "name": "British Pound", "flag": "🇬🇧"},
            "JPY": {"symbol": "¥", "name": "Japanese Yen", "flag": "🇯🇵"},
            "IDR": {"symbol": "Rp", "name": "Indonesian Rupiah", "flag": "🇮🇩"},
            "AUD": {"symbol": "A$", "name": "Australian Dollar", "flag": "🇦🇺"},
            "CAD": {"symbol": "C$", "name": "Canadian Dollar", "flag": "🇨🇦"},
            "CHF": {"symbol": "Fr", "name": "Swiss Franc", "flag": "🇨🇭"},
            "CNY": {"symbol": "¥", "name": "Chinese Yuan", "flag": "🇨🇳"},
            "INR": {"symbol": "₹", "name": "Indian Rupee", "flag": "🇮🇳"},
            "MYR": {"symbol": "RM", "name": "Malaysian Ringgit", "flag": "🇲🇾"},
            "SGD": {"symbol": "S$", "name": "Singapore Dollar", "flag": "🇸🇬"},
            "THB": {"symbol": "฿", "name": "Thai Baht", "flag": "🇹🇭"},
            "KRW": {"symbol": "₩", "name": "Korean Won", "flag": "🇰🇷"},
            "PHP": {"symbol": "₱", "name": "Philippine Peso", "flag": "🇵🇭"},
            "VND": {"symbol": "₫", "name": "Vietnamese Dong", "flag": "🇻🇳"},
            "HKD": {"symbol": "HK$", "name": "Hong Kong Dollar", "flag": "🇭🇰"},
        }
    }
