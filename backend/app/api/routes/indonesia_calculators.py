"""
The Indonesian calculators, over the API.

These sit apart from the other calculators because they follow
Indonesian law and Indonesian institutions, and because the numbers
in them change when the rules change. The rules themselves are in
`app.services.calculation.indonesia`; this file only carries them
over the wire.

The four are:

- `POST /api/calculators/id/pph21` — the income tax an employer
  withholds.
- `POST /api/calculators/id/pph21/annual` — the tax for the whole
  year, and the tax for the last month.
- `POST /api/calculators/id/ppn` — the sales tax.
- `POST /api/calculators/id/thr` — the religious holiday allowance.
- `POST /api/calculators/id/bpjs` — the insurance contributions.

None of these need an account or touch any data. They are worked out
from what the reader types in and nothing else, so there is nothing
to read and nothing to write.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from decimal import Decimal

from app.services.calculation.indonesia import (
    CATEGORY_OF_STATUS,
    PTKP_ANNUAL,
    calculate_bpjs,
    calculate_pph21,
    calculate_pph21_annual,
    calculate_pph21_daily,
    calculate_ppn,
    calculate_thr,
)

router = APIRouter()


# === Request Models ===

class PPh21Request(BaseModel):
    monthly_gross: Decimal = Field(..., ge=0, description="Gross monthly income")
    status: str = Field("K/0", description="K/0, TK/1, K/3 and so on")
    months_withheld: int = Field(11, ge=0, le=11)


class PPh21AnnualRequest(BaseModel):
    monthly_gross: Decimal = Field(..., ge=0)
    status: str = Field("K/0")
    employee_pension: Decimal = Field(Decimal("0"), ge=0, description="Per month")
    zakat: Decimal = Field(Decimal("0"), ge=0, description="Per month")


class PPh21DailyRequest(BaseModel):
    daily_gross: Decimal = Field(..., ge=0)


class PPNRequest(BaseModel):
    price: Decimal = Field(..., ge=0, description="Selling price, tax not included")
    luxury: bool = Field(False, description="Luxury goods pay the full rate")
    rate_percent: Decimal = Field(None, description="A rate of its own, if there is one")


class THRRequest(BaseModel):
    monthly_salary: Decimal = Field(..., ge=0)
    service_months: int = Field(..., ge=0, description="Months of continuous service")
    fixed_allowance: Decimal = Field(Decimal("0"), ge=0)


class BPJSRequest(BaseModel):
    monthly_wage: Decimal = Field(..., ge=0)
    risk: str = Field("low", description="low, medium or high")
    extra_family_members: int = Field(0, ge=0, le=8)


# === Endpoints ===

@router.post("/id/pph21")
def pph21(req: PPh21Request):
    """The income tax withheld from a monthly salary."""
    try:
        return calculate_pph21(req.monthly_gross, req.status, req.months_withheld)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/id/pph21/annual")
def pph21_annual(req: PPh21AnnualRequest):
    """The tax for a whole year, and the tax for the last month."""
    try:
        return calculate_pph21_annual(
            req.monthly_gross,
            req.status,
            req.employee_pension,
            req.zakat,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/id/pph21/daily")
def pph21_daily(req: PPh21DailyRequest):
    """The tax withheld from a daily wage."""
    return calculate_pph21_daily(req.daily_gross)


@router.post("/id/ppn")
def ppn(req: PPNRequest):
    """The sales tax on a price."""
    return calculate_ppn(req.price, req.luxury, req.rate_percent)


@router.post("/id/thr")
def thr(req: THRRequest):
    """The religious holiday allowance."""
    return calculate_thr(req.monthly_salary, req.service_months, req.fixed_allowance)


@router.post("/id/bpjs")
def bpjs(req: BPJSRequest):
    """The insurance contributions on a monthly wage."""
    try:
        return calculate_bpjs(req.monthly_wage, req.risk, req.extra_family_members)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/id/rules")
def rules():
    """
    The rules themselves, so a screen can show them without being
    written out again in the frontend.
    """
    return {
        "pph21": {
            "statuses": list(PTKP_ANNUAL.keys()),
            "categories": CATEGORY_OF_STATUS,
            "ptkp_annual": {k: str(v) for k, v in PTKP_ANNUAL.items()},
            "rule": "PP 58/2023; PMK 168/2023",
        },
        "ppn": {
            "rate": "12",
            "other_base": "11/12",
            "rule": "UU 7/2021 Pasal 7; PMK 131/2024",
        },
        "thr": {
            "rule": "Permenaker 6/2016",
        },
        "bpjs": {
            "risks": ["low", "medium", "high"],
            "rule": "Perpres 64/2020; PP 46/2015; PP 45/2015",
        },
    }
