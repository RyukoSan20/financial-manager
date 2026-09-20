"""Financial Calculators API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal

from app.services.calculation_service import calculation_service

router = APIRouter()


# === Request Models ===

class DiscountRequest(BaseModel):
    original_price: Decimal
    discount_percent: Decimal


class TaxRequest(BaseModel):
    amount: Decimal
    tax_percent: Decimal


class TipRequest(BaseModel):
    bill_amount: Decimal
    tip_percent: Decimal


class SplitBillRequest(BaseModel):
    total_amount: Decimal
    number_of_people: int


class PercentageChangeRequest(BaseModel):
    old_value: Decimal
    new_value: Decimal


class LoanRequest(BaseModel):
    principal: Decimal
    annual_rate: Decimal  # as decimal, e.g., 0.10 for 10%
    term_months: int


class CompoundInterestRequest(BaseModel):
    principal: Decimal
    annual_rate: Decimal
    time_years: Decimal
    compounding_frequency: int = 12


class SavingsGoalRequest(BaseModel):
    target_amount: Decimal
    current_amount: Decimal = Decimal("0")
    monthly_savings: Decimal
    annual_rate: Decimal = Decimal("0")


class IncomeConversionRequest(BaseModel):
    amount: Decimal
    from_period: str  # annual, monthly, weekly, daily
    to_period: str


class AffordabilityRequest(BaseModel):
    monthly_income: Decimal
    monthly_expense: Decimal
    item_monthly_payment: Decimal


class BudgetAllocationRequest(BaseModel):
    monthly_income: Decimal
    savings_rate_target: Decimal = Decimal("0.2")


class FutureValueRequest(BaseModel):
    present_value: Decimal
    rate: Decimal
    periods: int


class PresentValueRequest(BaseModel):
    future_value: Decimal
    rate: Decimal
    periods: int


class InflationRequest(BaseModel):
    future_value: Decimal
    inflation_rate: Decimal
    years: int


# === Calculator Endpoints ===

@router.post("/discount")
def calculate_discount(req: DiscountRequest):
    """Calculate price after discount."""
    result = calculation_service.calc_discount(req.original_price, req.discount_percent)
    discount_amount = req.original_price - result.value
    return {
        "original_price": req.original_price,
        "discount_percent": req.discount_percent,
        "discount_amount": discount_amount,
        "final_price": result.value,
        "formula": result.formula,
        "example": result.example
    }


@router.post("/tax")
def calculate_tax(req: TaxRequest):
    """Calculate tax amount."""
    result = calculation_service.calc_tax(req.amount, req.tax_percent)
    total = req.amount + result.value
    return {
        "pre_tax_amount": req.amount,
        "tax_percent": req.tax_percent,
        "tax_amount": result.value,
        "total_with_tax": total,
        "formula": result.formula
    }


@router.post("/tip")
def calculate_tip(req: TipRequest):
    """Calculate tip amount."""
    result = calculation_service.calc_tip(req.bill_amount, req.tip_percent)
    total = req.bill_amount + result.value
    per_person = calculation_service.calc_split_bill(total, 2)
    
    return {
        "bill_amount": req.bill_amount,
        "tip_percent": req.tip_percent,
        "tip_amount": result.value,
        "total": total,
        "formula": result.formula
    }


@router.post("/split-bill")
def split_bill(req: SplitBillRequest):
    """Split bill among people."""
    result = calculation_service.calc_split_bill(req.total_amount, req.number_of_people)
    
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {
        "total_amount": req.total_amount,
        "number_of_people": req.number_of_people,
        "amount_per_person": result.value,
        "formula": result.formula
    }


@router.post("/percentage-change")
def calculate_percentage_change(req: PercentageChangeRequest):
    """Calculate percentage change."""
    result = calculation_service.calc_percentage_change(req.old_value, req.new_value)
    
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {
        "old_value": req.old_value,
        "new_value": req.new_value,
        "change_percent": result.value,
        "change_absolute": req.new_value - req.old_value,
        "formula": result.formula
    }


@router.post("/loan-payment")
def calculate_loan_payment(req: LoanRequest):
    """Calculate monthly loan payment."""
    result = calculation_service.get_loan_payment(
        req.principal, req.annual_rate, req.term_months
    )
    
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.error)
    
    # Generate amortization schedule
    schedule = calculation_service.get_amortization_schedule(
        req.principal, req.annual_rate, req.term_months
    )
    
    total_interest = sum(s.interest for s in schedule)
    total_payment = sum(s.payment for s in schedule)
    
    return {
        "principal": req.principal,
        "annual_rate": req.annual_rate,
        "term_months": req.term_months,
        "monthly_payment": result.value,
        "total_interest": total_interest,
        "total_payment": total_payment,
        "formula": result.formula
    }


@router.post("/compound-interest")
def calculate_compound_interest(req: CompoundInterestRequest):
    """Calculate compound interest."""
    result = calculation_service.get_compound_interest(
        req.principal, req.annual_rate, req.time_years, req.compounding_frequency
    )
    
    total = req.principal + result.value
    
    return {
        "principal": req.principal,
        "annual_rate": req.annual_rate,
        "time_years": req.time_years,
        "compounding_frequency": req.compounding_frequency,
        "interest_earned": result.value,
        "total_value": total,
        "formula": result.formula
    }


@router.post("/savings-time")
def calculate_savings_time(req: SavingsGoalRequest):
    """Calculate time to reach savings goal."""
    result = calculation_service.calc_savings_time(
        req.current_amount,
        req.target_amount,
        req.monthly_savings,
        req.annual_rate
    )
    
    return {
        "target_amount": req.target_amount,
        "current_amount": req.current_amount,
        "monthly_savings": req.monthly_savings,
        "annual_rate": req.annual_rate,
        "months_to_goal": result.value,
        "formula": result.formula
    }


@router.post("/income-conversion")
def convert_income(req: IncomeConversionRequest):
    """Convert income between periods."""
    result = calculation_service.calc_income_conversion(
        req.amount, req.from_period, req.to_period
    )
    
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.error)
    
    return {
        "original_amount": req.amount,
        "from_period": req.from_period,
        "to_period": req.to_period,
        "converted_amount": result.value,
        "formula": result.formula
    }


@router.post("/affordability")
def check_affordability(req: AffordabilityRequest):
    """Check if item is affordable."""
    result = calculation_service.calc_affordability(
        req.monthly_income,
        req.monthly_expense,
        req.item_monthly_payment
    )
    
    return result


@router.post("/budget-allocation")
def get_budget_allocation(req: BudgetAllocationRequest):
    """Get recommended budget allocation based on income."""
    result = calculation_service.calc_budget_from_income(
        req.monthly_income, req.savings_rate_target
    )
    
    return {
        **result,
        "recommendation": "50/30/20 rule: 50% needs, 30% wants, 20% savings"
    }


@router.post("/future-value")
def calculate_future_value(req: FutureValueRequest):
    """Calculate future value."""
    result = calculation_service.get_future_value(
        req.present_value, req.rate, req.periods
    )
    
    return {
        "present_value": req.present_value,
        "rate": req.rate,
        "periods": req.periods,
        "future_value": result.value,
        "formula": result.formula
    }


@router.post("/present-value")
def calculate_present_value(req: PresentValueRequest):
    """Calculate present value."""
    result = calculation_service.get_present_value(
        req.future_value, req.rate, req.periods
    )
    
    return {
        "future_value": req.future_value,
        "rate": req.rate,
        "periods": req.periods,
        "present_value": result.value,
        "formula": result.formula
    }


@router.post("/inflation-adjusted")
def calculate_inflation_adjusted(req: InflationRequest):
    """Calculate inflation-adjusted value."""
    result = calculation_service.get_inflation_adjusted_value(
        req.future_value, req.inflation_rate, req.years
    )
    
    purchasing_power_loss = req.future_value - result.value
    
    return {
        "nominal_future_value": req.future_value,
        "inflation_rate": req.inflation_rate,
        "years": req.years,
        "real_value_today": result.value,
        "purchasing_power_lost": purchasing_power_loss,
        "formula": result.formula
    }


@router.get("/formulas")
def list_formulas():
    """List all available calculation formulas."""
    return {
        "formulas": [
            {
                "name": "Discount Price",
                "endpoint": "/api/calculators/discount",
                "formula": "final = original - (original × discount/100)"
            },
            {
                "name": "Tax Calculation",
                "endpoint": "/api/calculators/tax",
                "formula": "tax = amount × (tax_percent/100)"
            },
            {
                "name": "Tip Calculation",
                "endpoint": "/api/calculators/tip",
                "formula": "tip = bill × (tip_percent/100)"
            },
            {
                "name": "Split Bill",
                "endpoint": "/api/calculators/split-bill",
                "formula": "per_person = total / number_of_people"
            },
            {
                "name": "Loan Payment",
                "endpoint": "/api/calculators/loan-payment",
                "formula": "payment = P × [r(1+r)^n] / [(1+r)^n - 1]"
            },
            {
                "name": "Compound Interest",
                "endpoint": "/api/calculators/compound-interest",
                "formula": "A = P(1 + r/n)^(nt)"
            },
            {
                "name": "Future Value",
                "endpoint": "/api/calculators/future-value",
                "formula": "FV = PV × (1 + rate)^periods"
            },
            {
                "name": "Present Value",
                "endpoint": "/api/calculators/present-value",
                "formula": "PV = FV / (1 + rate)^periods"
            },
        ]
    }
