"""Calculation request/response schemas."""

from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional
from datetime import date


class CalculationInput(BaseModel):
    """Base calculation input with common fields."""
    currency: str = "IDR"


# === Balance & Cash Flow ===

class BalanceInput(CalculationInput):
    total_income: Decimal
    total_expense: Decimal


class CashFlowInput(CalculationInput):
    total_income: Decimal
    total_expense: Decimal


# === Savings ===

class SavingRateInput(CalculationInput):
    total_income: Decimal
    total_expense: Decimal


class EmergencyFundInput(CalculationInput):
    monthly_expense: Decimal
    months_coverage: int = 6


# === Budget ===

class BudgetUtilizationInput(CalculationInput):
    budget_amount: Decimal
    actual_expense: Decimal


class RemainingBudgetInput(CalculationInput):
    budget_amount: Decimal
    actual_expense: Decimal


class ProratedBudgetInput(CalculationInput):
    budget_amount: Decimal
    days_in_period: int
    days_elapsed: int


# === Spending Analysis ===

class AverageDailySpendingInput(CalculationInput):
    total_expense: Decimal
    days_elapsed: int


class ProjectedSpendingInput(CalculationInput):
    average_daily_spending: Decimal
    days_in_period: int = 30


class SafeDailyLimitInput(CalculationInput):
    remaining_budget: Decimal
    days_remaining: int


class ExpenseRatioInput(CalculationInput):
    expense: Decimal
    income: Decimal


# === Growth ===

class GrowthRateInput(CalculationInput):
    previous_value: Decimal
    current_value: Decimal


# === Debt ===

class DebtToIncomeInput(CalculationInput):
    total_debt: Decimal
    monthly_income: Decimal


class DebtPaymentRatioInput(CalculationInput):
    debt_payment: Decimal
    monthly_income: Decimal


# === Net Worth ===

class NetWorthInput(CalculationInput):
    assets: list[dict]  # [{"name": str, "value": Decimal}]
    liabilities: list[dict]  # [{"name": str, "value": Decimal}]


# === Interest ===

class SimpleInterestInput(CalculationInput):
    principal: Decimal
    rate: Decimal  # as decimal, e.g., 0.05 for 5%
    time: Decimal  # in years


class CompoundInterestInput(CalculationInput):
    principal: Decimal
    rate: Decimal  # as decimal, e.g., 0.05 for 5%
    time: Decimal  # in years
    compounding_frequency: int = 12  # monthly


# === Loan ===

class LoanAmortizationInput(CalculationInput):
    principal: Decimal
    annual_rate: Decimal  # as decimal
    term_months: int


class LoanPaymentInput(CalculationInput):
    monthly_payment: Decimal
    principal: Decimal
    annual_rate: Decimal


# === Time Value ===

class FutureValueInput(CalculationInput):
    present_value: Decimal
    rate: Decimal
    periods: int


class PresentValueInput(CalculationInput):
    future_value: Decimal
    rate: Decimal
    periods: int


class InflationAdjustedInput(CalculationInput):
    future_value: Decimal
    inflation_rate: Decimal  # as decimal
    years: int


# === Financial Calculators ===

class DiscountInput(CalculationInput):
    original_price: Decimal
    discount_percent: Decimal


class TaxInput(CalculationInput):
    amount: Decimal
    tax_percent: Decimal


class TipInput(CalculationInput):
    bill_amount: Decimal
    tip_percent: Decimal


class SplitBillInput(CalculationInput):
    total_amount: Decimal
    number_of_people: int


class PercentageChangeInput(CalculationInput):
    old_value: Decimal
    new_value: Decimal


class SavingsGoalInput(CalculationInput):
    target_amount: Decimal
    monthly_savings: Decimal
    annual_rate: Decimal = Decimal("0")


class SavingsTimeInput(CalculationInput):
    current_amount: Decimal
    target_amount: Decimal
    monthly_savings: Decimal
    annual_rate: Decimal = Decimal("0")


class IncomeConversionInput(CalculationInput):
    amount: Decimal
    from_period: str  # annual, monthly, weekly, daily
    to_period: str


class AffordabilityInput(CalculationInput):
    monthly_income: Decimal
    monthly_expense: Decimal
    item_monthly_payment: Decimal


class BudgetFromIncomeInput(CalculationInput):
    monthly_income: Decimal
    savings_rate_target: Decimal = Decimal("0.2")  # 20%
