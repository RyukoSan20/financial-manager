"""
Currency rates for the display layer.

The stored amounts never change. These routes give the browser the
rates it needs to show a number in the currency the reader picked, and
they say plainly how fresh the rate is and where it came from, so the
interface can be honest about it.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, List, Optional

from app.services.currency import SUPPORTED, converter

router = APIRouter()


class ConvertRequest(BaseModel):
    amount: float
    from_currency: str
    to_currency: str


class RateEntry(BaseModel):
    currency: str
    name: str
    symbol: str
    decimals: int
    rate: float
    # How much of this currency one unit of the base is worth.
    per_base: float


class RatesResponse(BaseModel):
    base: str
    rates: Dict[str, float]
    as_of: Optional[str]
    source: str
    supported: List[dict]


@router.get("/rates", response_model=RatesResponse)
async def get_rates(base: str = Query("IDR", description="The currency the rates are measured against")):
    """The live rates, the currencies on offer, and where they came from."""
    base_upper = base.upper()
    if base_upper not in SUPPORTED:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported base currency: {base_upper}",
        )

    table = await converter.get_rates(base_upper)

    supported = []
    for code, meta in SUPPORTED.items():
        rate = table.rates.get(code)
        if rate is None:
            # The currency is on offer but the live feed has no figure
            # for it, so it is left out of the rate list rather than
            # shown with a made up number.
            continue
        supported.append(
            {
                "currency": code,
                "name": meta["name"],
                "symbol": meta["symbol"],
                "decimals": meta["decimals"],
                "rate": rate,
                "per_base": 1.0 / rate if rate else 0.0,
            }
        )

    return RatesResponse(
        base=base_upper,
        rates=table.rates,
        as_of=table.as_of,
        source=table.source,
        supported=supported,
    )


@router.post("/convert")
async def convert_currency(request: ConvertRequest):
    """Convert one amount between two currencies."""
    src = request.from_currency.upper()
    dst = request.to_currency.upper()

    for code in (src, dst):
        if code not in SUPPORTED:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported currency: {code}",
            )

    return await converter.convert(request.amount, src, dst)


@router.get("/currencies")
async def list_currencies():
    """The currencies on offer, without the rates."""
    return {
        "currencies": [
            {"code": code, "name": meta["name"], "symbol": meta["symbol"], "decimals": meta["decimals"]}
            for code, meta in SUPPORTED.items()
        ]
    }
