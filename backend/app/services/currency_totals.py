"""
Adding up money that is not all in the same currency.

An account holds the currency it was opened in. A reader with a bank
account in rupiah and a deposit in yen has two numbers that cannot be
added together. This module works out the total in one currency, using
a live rate, and says how it broke down.

The rule everywhere in the application is the same: a figure is either
fully converted or it is left out and listed separately. A total that
mixes converted and unconverted money is worse than no total at all,
because the reader cannot tell which part of it is real.
"""

from typing import Dict, Iterable, List, Optional, Tuple

from app.services.currency import BASE, converter


class CurrencyTotal:
    """
    A total, in one currency, and where it came from.

    `total` is the sum in `currency`. `by_currency` holds the sum of
    each original currency, in that currency, so the reader can see
    what made up the total. `unconverted` holds the records that could
    not be converted, with the reason, so nothing is lost silently.
    """

    def __init__(
        self,
        total: float,
        currency: str,
        by_currency: Dict[str, float],
        unconverted: List[dict],
        converted_count: int,
        total_count: int,
    ):
        self.total = total
        self.currency = currency
        self.by_currency = by_currency
        self.unconverted = unconverted
        self.converted_count = converted_count
        self.total_count = total_count

    @property
    def is_complete(self) -> bool:
        """True when every record was converted."""
        return not self.unconverted

    def as_dict(self) -> dict:
        return {
            "total": round(self.total, 2),
            "currency": self.currency,
            "by_currency": {k: round(v, 2) for k, v in self.by_currency.items()},
            "unconverted": self.unconverted,
            "converted_count": self.converted_count,
            "total_count": self.total_count,
            "is_complete": self.is_complete,
        }


async def total_in_currency(
    amounts: Iterable[Tuple[float, str]],
    target: str = "IDR",
) -> CurrencyTotal:
    """
    Add up amounts that are each in their own currency.

    `amounts` is a sequence of (amount, currency) pairs. The result is
    the sum in `target`.

    A currency with no rate is left out of the total and listed under
    `unconverted`. The total therefore never mixes money that was
    converted with money that was not.
    """
    target = (target or "IDR").upper()
    items = list(amounts)

    # The table reads "units of X for one unit of the base", and the
    # base is IDR. So one unit of a currency is worth 1 / rate rupiah,
    # and the rate from the base to the target turns a rupiah figure
    # into a figure in the target currency.
    rates = await converter.get_rates(BASE)
    to_target = await converter.rate(BASE, target)

    total = 0.0
    by_currency: Dict[str, float] = {}
    unconverted: List[dict] = []
    converted_count = 0

    for amount, currency in items:
        code = (currency or BASE).upper()
        value = float(amount or 0)
        by_currency[code] = round(by_currency.get(code, 0.0) + value, 2)

        if code == target:
            total += value
            converted_count += 1
            continue

        if to_target is None:
            unconverted.append({
                "currency": code,
                "amount": value,
                "reason": "rate_unavailable",
            })
            continue

        # The rate of this currency against the base is what the
        # balance is worth in the base currency.
        rate = rates.rates.get(code)
        if rate is None or rate == 0:
            unconverted.append({
                "currency": code,
                "amount": value,
                "reason": "rate_unavailable",
            })
            continue

        in_base = value / rate
        total += in_base * to_target
        converted_count += 1

    return CurrencyTotal(
        total=total,
        currency=target,
        by_currency=by_currency,
        unconverted=unconverted,
        converted_count=converted_count,
        total_count=len(items),
    )
