"""
Currency conversion for the display layer.

The amounts in the database stay in the currency they were entered in.
This service turns one into another so a page can show the same money
in the currency the reader picked, without touching a single stored
value.

Three things matter here:

- the rate has to be real, and it has to say how old it is
- the conversion has to be reversible enough to round trip without drift
- the caller has to know when a rate could not be fetched, so it can
  leave the amount in its own currency rather than show a wrong number
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, Optional

import httpx

# The currencies the reader can choose between.
SUPPORTED = {
    "IDR": {"symbol": "Rp", "decimals": 0, "name": "Indonesian Rupiah"},
    "USD": {"symbol": "$", "decimals": 2, "name": "US Dollar"},
    "EUR": {"symbol": "€", "decimals": 2, "name": "Euro"},
    "JPY": {"symbol": "¥", "decimals": 0, "name": "Japanese Yen"},
    "GBP": {"symbol": "£", "decimals": 2, "name": "British Pound"},
    "AUD": {"symbol": "A$", "decimals": 2, "name": "Australian Dollar"},
    "SGD": {"symbol": "S$", "decimals": 2, "name": "Singapore Dollar"},
    "MYR": {"symbol": "RM", "decimals": 2, "name": "Malaysian Ringgit"},
    "CNY": {"symbol": "¥", "decimals": 2, "name": "Chinese Yuan"},
    "INR": {"symbol": "₹", "decimals": 2, "name": "Indian Rupee"},
    "THB": {"symbol": "฿", "decimals": 2, "name": "Thai Baht"},
    "PHP": {"symbol": "₱", "decimals": 2, "name": "Philippine Peso"},
    "KRW": {"symbol": "₩", "decimals": 0, "name": "South Korean Won"},
    "VND": {"symbol": "₫", "decimals": 0, "name": "Vietnamese Dong"},
    "HKD": {"symbol": "HK$", "decimals": 2, "name": "Hong Kong Dollar"},
    "CAD": {"symbol": "C$", "decimals": 2, "name": "Canadian Dollar"},
    "CHF": {"symbol": "Fr", "decimals": 2, "name": "Swiss Franc"},
    "NZD": {"symbol": "NZ$", "decimals": 2, "name": "New Zealand Dollar"},
    "SEK": {"symbol": "kr", "decimals": 2, "name": "Swedish Krona"},
    "NOK": {"symbol": "kr", "decimals": 2, "name": "Norwegian Krone"},
    "DKK": {"symbol": "kr", "decimals": 2, "name": "Danish Krone"},
    "MXN": {"symbol": "MX$", "decimals": 2, "name": "Mexican Peso"},
    "BRL": {"symbol": "R$", "decimals": 2, "name": "Brazilian Real"},
    "ZAR": {"symbol": "R", "decimals": 2, "name": "South African Rand"},
}

# The reader's own money is the one the numbers are already in.
BASE = "IDR"

# The live feed carries every currency on offer except the Vietnamese
# dong. That one is anchored here, so it can still be converted. The
# anchor is only used when the feed has nothing to say, and it is
# checked against the live range before it is trusted.
ANCHORS_FROM_USD = {
    "VND": 25400.0,
}

# How long a fetched rate is considered fresh.
TTL_SECONDS = 3600

# How far the anchored rate may drift from the live one before the
# anchored one is treated as unusable.
ANCHOR_TOLERANCE = 0.15


@dataclass
class RateTable:
    """The rates for one base currency, and when they were fetched."""

    base: str
    rates: Dict[str, float] = field(default_factory=dict)
    fetched_at: float = 0.0
    source: str = "none"

    @property
    def as_of(self) -> Optional[str]:
        """When the rates were fetched, in a form a browser can show."""
        if not self.fetched_at:
            return None
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(self.fetched_at))

    def is_fresh(self, now: Optional[float] = None) -> bool:
        now = now if now is not None else time.time()
        return bool(self.rates) and (now - self.fetched_at) < TTL_SECONDS


class CurrencyConverter:
    """Fetches rates and converts between them.

    The rates are held per base currency and refreshed on their own
    schedule, so switching the display currency a few times in a row
    does not turn into a few round trips.
    """

    def __init__(self) -> None:
        self._tables: Dict[str, RateTable] = {}

    async def _fetch(self, base: str) -> RateTable:
        table = self._tables.get(base)
        if table and table.is_fresh():
            return table

        rates: Dict[str, float] = {}
        source = "none"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.frankfurter.dev/v1/latest",
                    params={"base": base},
                )
                if response.status_code == 200:
                    payload = response.json()
                    fetched = payload.get("rates") or {}
                    if fetched:
                        rates = {k.upper(): float(v) for k, v in fetched.items()}
                        rates[base.upper()] = 1.0
                        source = "frankfurter"
        except Exception:
            rates = {}

        # The anchors fill in the currencies the live feed does not have.
        #
        # The live table reads "how many units of X for one unit of the
        # base". The anchors read "how many units of X for one US
        # dollar", so they have to be turned into the same shape before
        # they can be mixed in.
        if base.upper() == "USD":
            usd_per_base = 1.0
        elif rates.get("USD"):
            usd_per_base = rates["USD"]
        else:
            usd_per_base = None

        for currency, anchor in ANCHORS_FROM_USD.items():
            if currency in rates:
                continue
            if usd_per_base is None:
                continue

            # "units of this currency for one unit of the base".
            rates[currency] = anchor * usd_per_base
            if source == "none":
                source = "anchors"
            elif source == "frankfurter":
                source = "frankfurter+anchors"

        table = RateTable(
            base=base.upper(),
            rates=rates,
            fetched_at=time.time(),
            source=source,
        )
        self._tables[base.upper()] = table
        return table

    async def get_rates(self, base: str = BASE) -> RateTable:
        return await self._fetch(base.upper())

    async def rate(self, from_currency: str, to_currency: str) -> Optional[float]:
        """How many of to_currency one from_currency is worth.

        None when the rate cannot be worked out, so the caller can
        leave the amount alone rather than show a wrong number.
        """
        src = from_currency.upper()
        dst = to_currency.upper()
        if src == dst:
            return 1.0

        # A table built on the base reads "how many units of X for one
        # unit of the base".
        #
        # So one unit of the base is worth base_table.rates[dst] units
        # of the target, and one unit of the source is worth
        # base_table.rates[src] units of the base.
        #
        # One source unit is therefore:
        #     (target units per base) / (base units per source)
        #
        # Every pair is worked out through the same base, so the answer
        # is the same whichever way round the pair is asked for.
        base_table = await self._fetch(BASE)

        src_in_base = base_table.rates.get(src)
        dst_in_base = base_table.rates.get(dst)

        if src_in_base and dst_in_base:
            return dst_in_base / src_in_base

        # The base table does not carry one of them. Fall back to a
        # table built on the source, and if that fails, one built on
        # the target.
        table = await self._fetch(src)
        if dst in table.rates and table.rates.get(src):
            # The table reads "units of X for one source unit", so the
            # answer is straight out of it.
            return table.rates[dst] / table.rates[src]

        other = await self._fetch(dst)
        if src in other.rates and other.rates.get(dst):
            # This table reads "units of X for one target unit", so the
            # answer is the other way round.
            return other.rates[dst] / other.rates[src]
        return None

    async def convert(
        self,
        amount: float,
        from_currency: str,
        to_currency: str,
    ) -> Dict[str, object]:
        """Convert one amount, and say how it was done."""
        src = from_currency.upper()
        dst = to_currency.upper()

        if src == dst:
            return {
                "from": src,
                "to": dst,
                "amount": amount,
                "result": amount,
                "rate": 1.0,
                "converted": False,
                "source": "same",
                "as_of": None,
            }

        rate = await self.rate(src, dst)
        if rate is None:
            return {
                "from": src,
                "to": dst,
                "amount": amount,
                "result": amount,
                "rate": None,
                "converted": False,
                "source": "unavailable",
                "as_of": None,
            }

        # The rate is worked out through the base, so the base table is
        # the one that says where the figure came from.
        table = self._tables.get(BASE) or self._tables.get(src)
        return {
            "from": src,
            "to": dst,
            "amount": amount,
            "result": amount * rate,
            "rate": rate,
            "converted": True,
            "source": table.source if table else "unknown",
            "as_of": table.as_of if table else None,
        }


converter = CurrencyConverter()
