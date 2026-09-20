"""
Financial Calculation Formulas

Each function has:
- Name
- Input
- Output
- Formula (mathematical)
- Example calculation
- Unit
- Edge cases handled

All monetary values use Decimal for precision.
All rates/percentages are expressed as decimals (0.05 = 5%).
"""

from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from datetime import date
from typing import Optional
from dataclasses import dataclass


# === Constants ===
DAYS_IN_MONTH = Decimal("30")
DAYS_IN_YEAR = Decimal("365")
WEEKS_IN_YEAR = Decimal("52")
MONTHS_IN_YEAR = Decimal("12")


# === Dataclasses for structured results ===

@dataclass
class CalculationResult:
    """Standard calculation result."""
    value: Decimal
    unit: str
    formula: str
    example: str
    valid: bool = True
    error: Optional[str] = None


@dataclass
class AmortizationResult:
    """Loan amortization schedule entry."""
    month: int
    payment: Decimal
    principal: Decimal
    interest: Decimal
    balance: Decimal


# === Helper Functions ===

def _round(value, decimals: int = 2) -> Decimal:
    """Round to specified decimal places. Accepts int, float, or Decimal."""
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    quantize_str = Decimal("0." + "0" * decimals)
    return value.quantize(quantize_str, rounding=ROUND_HALF_UP)


def _safe_divide(numerator: Decimal, denominator: Decimal, default: Decimal = Decimal("0")) -> Decimal:
    """Safe division that handles zero denominator."""
    if denominator == 0:
        return default
    return numerator / denominator


def _validate_positive(*values: Decimal) -> Optional[str]:
    """Validate that all values are non-negative."""
    for v in values:
        if v < 0:
            return "Value cannot be negative"
    return None


def _validate_positive_non_zero(*values: Decimal) -> Optional[str]:
    """Validate that all values are positive."""
    for v in values:
        if v <= 0:
            return "Value must be positive"
    return None


# =============================================================================
# BALANCE & CASH FLOW
# =============================================================================

def calculate_balance(total_income: Decimal, total_expense: Decimal) -> CalculationResult:
    """
    Calculate net balance from income and expenses.
    
    INPUT:
        - total_income: Total income (Decimal)
        - total_expense: Total expenses (Decimal)
    
    OUTPUT: Net balance (Decimal)
    
    FORMULA:
        balance = total_income - total_expense
    
    EXAMPLE:
        balance = 10,000,000 - 7,500,000 = 2,500,000
    
    UNIT: Currency units (e.g., IDR)
    """
    error = _validate_positive_non_zero(total_income)
    if error:
        return CalculationResult(Decimal("0"), "IDR", "", "", valid=False, error=str(error))
    
    balance = total_income - total_expense
    return CalculationResult(
        value=_round(balance),
        unit="IDR",
        formula="balance = total_income - total_expense",
        example="2,500,000 = 10,000,000 - 7,500,000"
    )


def calculate_net_cash_flow(total_income: Decimal, total_expense: Decimal) -> CalculationResult:
    """
    Calculate net cash flow (same as balance).
    
    INPUT:
        - total_income: Total income (Decimal)
        - total_expense: Total expenses (Decimal)
    
    OUTPUT: Net cash flow (Decimal)
    
    FORMULA:
        net_cash_flow = total_income - total_expense
    
    EXAMPLE:
        net_cash_flow = 15,000,000 - 12,000,000 = 3,000,000
    
    UNIT: Currency units per period
    """
    balance = calculate_balance(total_income, total_expense)
    return CalculationResult(
        value=balance.value,
        unit="IDR/period",
        formula="net_cash_flow = total_income - total_expense",
        example="3,000,000 = 15,000,000 - 12,000,000"
    )


# =============================================================================
# SAVINGS
# =============================================================================

def calculate_saving_rate(total_income: Decimal, total_expense: Decimal) -> CalculationResult:
    """
    Calculate saving rate as percentage of income saved.
    
    INPUT:
        - total_income: Total income (Decimal)
        - total_expense: Total expenses (Decimal)
    
    OUTPUT: Saving rate (Decimal percentage, e.g., 0.25 = 25%)
    
    FORMULA:
        saving_rate = (total_income - total_expense) / total_income
    
    EXAMPLE:
        saving_rate = (10,000,000 - 7,500,000) / 10,000,000 = 0.25 = 25%
    
    UNIT: Decimal (multiply by 100 for percentage)
    
    EDGE CASES:
        - total_income = 0: Returns 0 (cannot calculate)
        - total_expense > total_income: Returns negative (dissaving)
    """
    if total_income <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="percentage",
            formula="saving_rate = (total_income - total_expense) / total_income",
            example="0 when total_income = 0",
            valid=False,
            error="Cannot calculate saving rate with zero or negative income"
        )
    
    saving_rate = (total_income - total_expense) / total_income
    return CalculationResult(
        value=_round(saving_rate, 4),
        unit="percentage (decimal)",
        formula="saving_rate = (total_income - total_expense) / total_income",
        example="0.25 = (10,000,000 - 7,500,000) / 10,000,000"
    )


def calculate_emergency_fund_target(monthly_expense: Decimal, months_coverage: int = 6) -> CalculationResult:
    """
    Calculate recommended emergency fund based on monthly expenses.
    
    INPUT:
        - monthly_expense: Average monthly expenses (Decimal)
        - months_coverage: Number of months of coverage (int, default 6)
    
    OUTPUT: Target emergency fund amount (Decimal)
    
    FORMULA:
        target = monthly_expense × months_coverage
    
    EXAMPLE:
        target = 5,000,000 × 6 = 30,000,000
    
    UNIT: Currency units
    
    EDGE CASES:
        - monthly_expense = 0: Returns 0
        - months_coverage <= 0: Uses default of 6
    """
    if monthly_expense <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR",
            formula="target = monthly_expense × months_coverage",
            example="0 when monthly_expense = 0"
        )
    
    if months_coverage <= 0:
        months_coverage = 6
    
    target = monthly_expense * Decimal(months_coverage)
    return CalculationResult(
        value=_round(target),
        unit="IDR",
        formula=f"target = monthly_expense × {months_coverage}",
        example=f"{_round(target):,} = {_round(monthly_expense):,} × {months_coverage}"
    )


# =============================================================================
# BUDGET
# =============================================================================

def calculate_budget_utilization(budget_amount: Decimal, actual_expense: Decimal) -> CalculationResult:
    """
    Calculate percentage of budget used.
    
    INPUT:
        - budget_amount: Total budgeted amount (Decimal)
        - actual_expense: Amount actually spent (Decimal)
    
    OUTPUT: Budget utilization (Decimal percentage)
    
    FORMULA:
        utilization = (actual_expense / budget_amount) × 100
    
    EXAMPLE:
        utilization = (1,500,000 / 2,000,000) × 100 = 75%
    
    UNIT: Percentage (0-100+)
    
    EDGE CASES:
        - budget_amount = 0: Returns 0 (cannot divide by zero)
    """
    if budget_amount <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="percentage",
            formula="utilization = (actual_expense / budget_amount) × 100",
            example="0 when budget = 0",
            valid=False,
            error="Budget amount must be positive"
        )
    
    utilization = (actual_expense / budget_amount) * Decimal("100")
    return CalculationResult(
        value=_round(utilization, 2),
        unit="percentage",
        formula="utilization = (actual_expense / budget_amount) × 100",
        example=f"{_round(utilization, 2)}% = ({_round(actual_expense):,} / {_round(budget_amount):,}) × 100"
    )


def calculate_remaining_budget(budget_amount: Decimal, actual_expense: Decimal) -> CalculationResult:
    """
    Calculate remaining budget after expenses.
    
    INPUT:
        - budget_amount: Total budgeted amount (Decimal)
        - actual_expense: Amount actually spent (Decimal)
    
    OUTPUT: Remaining budget (Decimal)
    
    FORMULA:
        remaining = budget_amount - actual_expense
    
    EXAMPLE:
        remaining = 2,000,000 - 1,500,000 = 500,000
    
    UNIT: Currency units
    """
    remaining = budget_amount - actual_expense
    return CalculationResult(
        value=_round(remaining),
        unit="IDR",
        formula="remaining = budget_amount - actual_expense",
        example=f"{_round(remaining):,} = {_round(budget_amount):,} - {_round(actual_expense):,}"
    )


def calculate_prorated_budget(budget_amount: Decimal, days_in_period: int, days_elapsed: int) -> CalculationResult:
    """
    Calculate prorated budget based on days elapsed.
    
    INPUT:
        - budget_amount: Full period budget (Decimal)
        - days_in_period: Total days in budget period (int)
        - days_elapsed: Days elapsed since period start (int)
    
    OUTPUT: Prorated budget amount (Decimal)
    
    FORMULA:
        prorated = budget_amount × (days_elapsed / days_in_period)
    
    EXAMPLE:
        prorated = 3,000,000 × (15 / 30) = 1,500,000 (half month)
    
    UNIT: Currency units
    
    EDGE CASES:
        - days_in_period = 0: Returns 0
        - days_elapsed > days_in_period: Returns full budget (over time)
    """
    if days_in_period <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR",
            formula="prorated = budget × (days_elapsed / days_in_period)",
            example="0 when days_in_period = 0",
            valid=False,
            error="Days in period must be positive"
        )
    
    if days_elapsed > days_in_period:
        days_elapsed = days_in_period
    
    prorated = budget_amount * Decimal(days_elapsed) / Decimal(days_in_period)
    return CalculationResult(
        value=_round(prorated),
        unit="IDR",
        formula=f"prorated = {budget_amount} × ({days_elapsed} / {days_in_period})",
        example=f"{_round(prorated):,} = {_round(budget_amount):,} × ({days_elapsed} / {days_in_period})"
    )


def calculate_safe_daily_spending(remaining_budget: Decimal, days_remaining: int) -> CalculationResult:
    """
    Calculate safe daily spending limit to stay within budget.
    
    INPUT:
        - remaining_budget: Budget remaining (Decimal)
        - days_remaining: Days left in period (int)
    
    OUTPUT: Safe daily spending limit (Decimal)
    
    FORMULA:
        safe_daily = remaining_budget / days_remaining
    
    EXAMPLE:
        safe_daily = 500,000 / 15 = 33,333
    
    UNIT: Currency units per day
    
    EDGE CASES:
        - days_remaining = 0: Returns remaining_budget (last day)
        - remaining_budget < 0: Returns 0 (already over budget)
    """
    if remaining_budget < 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR/day",
            formula="safe_daily = remaining / days_remaining",
            example="0 when over budget",
            error="Already over budget"
        )
    
    if days_remaining <= 0:
        return CalculationResult(
            value=remaining_budget,
            unit="IDR/day",
            formula="safe_daily = remaining / days_remaining",
            example=f"{remaining_budget} (final day)"
        )
    
    safe_daily = remaining_budget / Decimal(days_remaining)
    return CalculationResult(
        value=_round(safe_daily),
        unit="IDR/day",
        formula=f"safe_daily = {_round(remaining_budget):,} / {days_remaining}",
        example=f"{_round(safe_daily):,} = {_round(remaining_budget):,} / {days_remaining}"
    )


# =============================================================================
# SPENDING ANALYSIS
# =============================================================================

def calculate_average_daily_spending(total_expense: Decimal, days_elapsed: int) -> CalculationResult:
    """
    Calculate average daily spending rate.
    
    INPUT:
        - total_expense: Total expenses in period (Decimal)
        - days_elapsed: Days elapsed in period (int)
    
    OUTPUT: Average daily spending (Decimal)
    
    FORMULA:
        avg_daily = total_expense / days_elapsed
    
    EXAMPLE:
        avg_daily = 1,500,000 / 15 = 100,000
    
    UNIT: Currency units per day
    
    EDGE CASES:
        - days_elapsed = 0: Returns 0
    """
    if days_elapsed <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR/day",
            formula="avg_daily = total_expense / days_elapsed",
            example="0 when days_elapsed = 0",
            valid=False,
            error="Days elapsed must be positive"
        )
    
    avg_daily = total_expense / Decimal(days_elapsed)
    return CalculationResult(
        value=_round(avg_daily),
        unit="IDR/day",
        formula=f"avg_daily = {_round(total_expense):,} / {days_elapsed}",
        example=f"{_round(avg_daily):,} = {_round(total_expense):,} / {days_elapsed}"
    )


def calculate_projected_monthly_spending(average_daily_spending: Decimal, days_in_month: int = 30) -> CalculationResult:
    """
    Project monthly spending based on daily average.
    
    INPUT:
        - average_daily_spending: Average daily spending (Decimal)
        - days_in_month: Days in month (int, default 30)
    
    OUTPUT: Projected monthly spending (Decimal)
    
    FORMULA:
        projected = avg_daily × days_in_month
    
    EXAMPLE:
        projected = 100,000 × 30 = 3,000,000
    
    UNIT: Currency units per month
    """
    projected = average_daily_spending * Decimal(days_in_month)
    return CalculationResult(
        value=_round(projected),
        unit="IDR/month",
        formula=f"projected = {_round(average_daily_spending):,} × {days_in_month}",
        example=f"{_round(projected):,} = {_round(average_daily_spending):,} × {days_in_month}"
    )


def calculate_expense_ratio(expense: Decimal, income: Decimal) -> CalculationResult:
    """
    Calculate expense ratio as percentage of income.
    
    INPUT:
        - expense: Total expenses (Decimal)
        - income: Total income (Decimal)
    
    OUTPUT: Expense ratio (Decimal)
    
    FORMULA:
        ratio = (expense / income) × 100
    
    EXAMPLE:
        ratio = (7,500,000 / 10,000,000) × 100 = 75%
    
    UNIT: Percentage (0-100)
    
    EDGE CASES:
        - income = 0: Returns 0
    """
    if income <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="percentage",
            formula="ratio = (expense / income) × 100",
            example="0 when income = 0",
            valid=False,
            error="Income must be positive"
        )
    
    ratio = (expense / income) * Decimal("100")
    return CalculationResult(
        value=_round(ratio, 2),
        unit="percentage",
        formula=f"ratio = ({_round(expense):,} / {_round(income):,}) × 100",
        example=f"{_round(ratio, 2)}% = ({_round(expense):,} / {_round(income):,}) × 100"
    )


# =============================================================================
# GROWTH
# =============================================================================

def calculate_growth_rate(previous_value: Decimal, current_value: Decimal) -> CalculationResult:
    """
    Calculate growth rate between two periods.
    
    INPUT:
        - previous_value: Value in previous period (Decimal)
        - current_value: Value in current period (Decimal)
    
    OUTPUT: Growth rate (Decimal percentage)
    
    FORMULA:
        growth = ((current - previous) / previous) × 100
    
    EXAMPLE:
        growth = ((12,000,000 - 10,000,000) / 10,000,000) × 100 = 20%
    
    UNIT: Percentage
    
    EDGE CASES:
        - previous_value = 0: Cannot calculate (division by zero)
        - Negative growth: Returns negative value
    """
    if previous_value <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="percentage",
            formula="growth = ((current - previous) / previous) × 100",
            example="0 when previous = 0",
            valid=False,
            error="Previous value must be positive"
        )
    
    growth = ((current_value - previous_value) / previous_value) * Decimal("100")
    return CalculationResult(
        value=_round(growth, 2),
        unit="percentage",
        formula=f"growth = (({_round(current_value):,} - {_round(previous_value):,}) / {_round(previous_value):,}) × 100",
        example=f"{_round(growth, 2)}% = (({_round(current_value):,} - {_round(previous_value):,}) / {_round(previous_value):,}) × 100"
    )


# =============================================================================
# DEBT
# =============================================================================

def calculate_debt_to_income_ratio(total_debt: Decimal, monthly_income: Decimal) -> CalculationResult:
    """
    Calculate debt-to-income ratio.
    
    INPUT:
        - total_debt: Total outstanding debt (Decimal)
        - monthly_income: Monthly income (Decimal)
    
    OUTPUT: DTI ratio (Decimal)
    
    FORMULA:
        dti = (total_debt / monthly_income) × 100
    
    EXAMPLE:
        dti = (50,000,000 / 10,000,000) × 100 = 500%
        (Ideally should be < 36%)
    
    UNIT: Percentage
    
    INTERPRETATION:
        - < 36%: Healthy
        - 36-50%: Moderate risk
        - > 50%: High risk
    """
    if monthly_income <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="percentage",
            formula="dti = (total_debt / monthly_income) × 100",
            example="0 when income = 0",
            valid=False,
            error="Monthly income must be positive"
        )
    
    dti = (total_debt / monthly_income) * Decimal("100")
    return CalculationResult(
        value=_round(dti, 2),
        unit="percentage",
        formula=f"dti = ({_round(total_debt):,} / {_round(monthly_income):,}) × 100",
        example=f"{_round(dti, 2)}% = ({_round(total_debt):,} / {_round(monthly_income):,}) × 100"
    )


def calculate_debt_payment_ratio(debt_payment: Decimal, monthly_income: Decimal) -> CalculationResult:
    """
    Calculate monthly debt payment as percentage of income.
    
    INPUT:
        - debt_payment: Monthly debt payment amount (Decimal)
        - monthly_income: Monthly income (Decimal)
    
    OUTPUT: Debt payment ratio (Decimal)
    
    FORMULA:
        ratio = (debt_payment / monthly_income) × 100
    
    EXAMPLE:
        ratio = (3,000,000 / 10,000,000) × 100 = 30%
        (Ideally should be < 36%)
    
    UNIT: Percentage
    """
    if monthly_income <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="percentage",
            formula="ratio = (debt_payment / monthly_income) × 100",
            example="0 when income = 0",
            valid=False,
            error="Monthly income must be positive"
        )
    
    ratio = (debt_payment / monthly_income) * Decimal("100")
    return CalculationResult(
        value=_round(ratio, 2),
        unit="percentage",
        formula=f"ratio = ({_round(debt_payment):,} / {_round(monthly_income):,}) × 100",
        example=f"{_round(ratio, 2)}% = ({_round(debt_payment):,} / {_round(monthly_income):,}) × 100"
    )


# =============================================================================
# NET WORTH
# =============================================================================

def calculate_net_worth(assets: list[dict], liabilities: list[dict]) -> CalculationResult:
    """
    Calculate net worth from assets and liabilities.
    
    INPUT:
        - assets: List of dicts with 'name' and 'value' keys
        - liabilities: List of dicts with 'name' and 'value' keys
    
    OUTPUT: Net worth (Decimal)
    
    FORMULA:
        net_worth = sum(assets) - sum(liabilities)
    
    EXAMPLE:
        assets = 150,000,000
        liabilities = 50,000,000
        net_worth = 150,000,000 - 50,000,000 = 100,000,000
    
    UNIT: Currency units
    """
    total_assets = sum(Decimal(str(a.get("value", 0))) for a in assets)
    total_liabilities = sum(Decimal(str(l.get("value", 0))) for l in liabilities)
    
    net_worth = total_assets - total_liabilities
    return CalculationResult(
        value=_round(net_worth),
        unit="IDR",
        formula="net_worth = sum(assets) - sum(liabilities)",
        example=f"{_round(net_worth):,} = {_round(total_assets):,} - {_round(total_liabilities):,}"
    )


# =============================================================================
# INTEREST
# =============================================================================

def calculate_simple_interest(principal: Decimal, rate: Decimal, time: Decimal) -> CalculationResult:
    """
    Calculate simple interest.
    
    INPUT:
        - principal: Initial amount (Decimal)
        - rate: Interest rate as decimal (Decimal, e.g., 0.05 for 5%)
        - time: Time period in years (Decimal)
    
    OUTPUT: Simple interest amount (Decimal)
    
    FORMULA:
        interest = principal × rate × time
    
    EXAMPLE:
        interest = 10,000,000 × 0.05 × 2 = 1,000,000
    
    UNIT: Currency units
    """
    if principal < 0 or rate < 0 or time < 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR",
            formula="interest = principal × rate × time",
            example="0 for negative inputs",
            valid=False,
            error="All inputs must be non-negative"
        )
    
    interest = principal * rate * time
    return CalculationResult(
        value=_round(interest),
        unit="IDR",
        formula=f"interest = {_round(principal):,} × {rate} × {time}",
        example=f"{_round(interest):,} = {_round(principal):,} × {rate} × {time}"
    )


def calculate_compound_interest(
    principal: Decimal,
    rate: Decimal,
    time: Decimal,
    compounding_frequency: int = 12
) -> CalculationResult:
    """
    Calculate compound interest with regular compounding.
    
    INPUT:
        - principal: Initial amount (Decimal)
        - rate: Annual interest rate as decimal (Decimal, e.g., 0.05 for 5%)
        - time: Time period in years (Decimal)
        - compounding_frequency: Compounding periods per year (int)
    
    OUTPUT: Compound interest amount (Decimal)
    
    FORMULA:
        total = principal × (1 + rate/n)^(n×time)
        interest = total - principal
    
    EXAMPLE:
        total = 10,000,000 × (1 + 0.05/12)^(12×2) = 11,050,787
        interest = 1,050,787
    
    UNIT: Currency units
    """
    if principal < 0 or rate < 0 or time < 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR",
            formula="interest = principal × ((1 + rate/n)^(n×time) - 1)",
            example="0 for negative inputs",
            valid=False,
            error="All inputs must be non-negative"
        )
    
    n = Decimal(compounding_frequency)
    total = principal * (Decimal("1") + rate / n) ** (n * time)
    interest = total - principal
    
    return CalculationResult(
        value=_round(interest),
        unit="IDR",
        formula=f"interest = principal × ((1 + {rate}/{compounding_frequency})^({compounding_frequency}×{time}) - 1)",
        example=f"{_round(interest):,} = {_round(principal):,} × ((1 + {rate}/{compounding_frequency})^({compounding_frequency}×{time}) - 1)"
    )


# =============================================================================
# LOAN / AMORTIZATION
# =============================================================================

def calculate_loan_payment(principal: Decimal, annual_rate: Decimal, term_months: int) -> CalculationResult:
    """
    Calculate monthly loan payment using amortization formula.
    
    INPUT:
        - principal: Loan amount (Decimal)
        - annual_rate: Annual interest rate as decimal (Decimal, e.g., 0.10 for 10%)
        - term_months: Loan term in months (int)
    
    OUTPUT: Monthly payment amount (Decimal)
    
    FORMULA:
        monthly_rate = annual_rate / 12
        payment = principal × [r(1+r)^n] / [(1+r)^n - 1]
        where r = monthly_rate, n = term_months
    
    EXAMPLE:
        payment = 100,000,000 × [0.008333(1.008333)^60] / [(1.008333)^60 - 1]
        payment = 2,124,700
    
    UNIT: Currency units per month
    """
    if principal <= 0 or term_months <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR/month",
            formula="payment = P × [r(1+r)^n] / [(1+r)^n - 1]",
            example="0 for invalid inputs",
            valid=False,
            error="Principal and term must be positive"
        )
    
    if annual_rate <= 0:
        # No interest loan
        payment = principal / Decimal(term_months)
        return CalculationResult(
            value=_round(payment),
            unit="IDR/month",
            formula=f"payment = {_round(principal):,} / {term_months}",
            example=f"{_round(payment):,} = {_round(principal):,} / {term_months} (no interest)"
        )
    
    monthly_rate = annual_rate / Decimal("12")
    n = Decimal(term_months)
    
    # (1 + r)^n
    compound = (Decimal("1") + monthly_rate) ** n
    
    # payment = P × [r(1+r)^n] / [(1+r)^n - 1]
    payment = principal * (monthly_rate * compound) / (compound - Decimal("1"))
    
    return CalculationResult(
        value=_round(payment),
        unit="IDR/month",
        formula=f"payment = {_round(principal):,} × [{monthly_rate}×(1+{monthly_rate})^{term_months}] / [(1+{monthly_rate})^{term_months} - 1]",
        example=f"{_round(payment):,}"
    )


def generate_amortization_schedule(
    principal: Decimal,
    annual_rate: Decimal,
    term_months: int
) -> list[AmortizationResult]:
    """
    Generate full amortization schedule for a loan.
    
    Returns list of monthly breakdowns showing payment, principal, interest, and balance.
    """
    monthly_payment = calculate_loan_payment(principal, annual_rate, term_months).value
    monthly_rate = annual_rate / Decimal("12")
    
    schedule = []
    balance = principal
    
    for month in range(1, term_months + 1):
        interest_payment = balance * monthly_rate
        principal_payment = monthly_payment - interest_payment
        balance = max(balance - principal_payment, Decimal("0"))
        
        schedule.append(AmortizationResult(
            month=month,
            payment=_round(monthly_payment),
            principal=_round(principal_payment),
            interest=_round(interest_payment),
            balance=_round(balance)
        ))
    
    return schedule


# =============================================================================
# TIME VALUE OF MONEY
# =============================================================================

def calculate_future_value(present_value: Decimal, rate: Decimal, periods: int) -> CalculationResult:
    """
    Calculate future value of a present amount.
    
    INPUT:
        - present_value: Current value (Decimal)
        - rate: Interest/growth rate as decimal (Decimal)
        - periods: Number of periods (int)
    
    OUTPUT: Future value (Decimal)
    
    FORMULA:
        FV = PV × (1 + rate)^periods
    
    EXAMPLE:
        FV = 10,000,000 × (1.05)^10 = 16,288,946
    
    UNIT: Currency units
    """
    if present_value < 0 or periods < 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR",
            formula="FV = PV × (1 + rate)^periods",
            example="0 for invalid inputs",
            valid=False,
            error="Present value and periods must be non-negative"
        )
    
    fv = present_value * (Decimal("1") + rate) ** periods
    return CalculationResult(
        value=_round(fv),
        unit="IDR",
        formula=f"FV = {_round(present_value):,} × (1 + {rate})^{periods}",
        example=f"{_round(fv):,}"
    )


def calculate_present_value(future_value: Decimal, rate: Decimal, periods: int) -> CalculationResult:
    """
    Calculate present value from a future amount.
    
    INPUT:
        - future_value: Future value (Decimal)
        - rate: Discount rate as decimal (Decimal)
        - periods: Number of periods (int)
    
    OUTPUT: Present value (Decimal)
    
    FORMULA:
        PV = FV / (1 + rate)^periods
    
    EXAMPLE:
        PV = 16,288,946 / (1.05)^10 = 10,000,000
    
    UNIT: Currency units
    """
    if future_value < 0 or periods < 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR",
            formula="PV = FV / (1 + rate)^periods",
            example="0 for invalid inputs",
            valid=False,
            error="Future value and periods must be non-negative"
        )
    
    pv = future_value / (Decimal("1") + rate) ** periods
    return CalculationResult(
        value=_round(pv),
        unit="IDR",
        formula=f"PV = {_round(future_value):,} / (1 + {rate})^{periods}",
        example=f"{_round(pv):,}"
    )


def calculate_inflation_adjusted_value(future_value: Decimal, inflation_rate: Decimal, years: int) -> CalculationResult:
    """
    Calculate inflation-adjusted (real) value.
    
    INPUT:
        - future_value: Nominal future value (Decimal)
        - inflation_rate: Annual inflation rate as decimal (Decimal)
        - years: Number of years (int)
    
    OUTPUT: Real value in today's purchasing power (Decimal)
    
    FORMULA:
        real_value = FV / (1 + inflation_rate)^years
    
    EXAMPLE:
        real_value = 15,000,000 / (1.04)^10 = 10,109,082
    
    UNIT: Currency units (real value)
    """
    if future_value < 0 or years < 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR (real)",
            formula="real_value = FV / (1 + inflation)^years",
            example="0 for invalid inputs",
            valid=False,
            error="Future value and years must be non-negative"
        )
    
    real_value = future_value / (Decimal("1") + inflation_rate) ** years
    return CalculationResult(
        value=_round(real_value),
        unit="IDR (real)",
        formula=f"real_value = {_round(future_value):,} / (1 + {inflation_rate})^{years}",
        example=f"{_round(real_value):,}"
    )


# =============================================================================
# FINANCIAL CALCULATORS
# =============================================================================

def calculate_discount_price(original_price: Decimal, discount_percent: Decimal) -> CalculationResult:
    """
    Calculate price after discount.
    
    INPUT:
        - original_price: Original price (Decimal)
        - discount_percent: Discount percentage (Decimal, e.g., 20 for 20%)
    
    OUTPUT: Discounted price (Decimal)
    
    FORMULA:
        discount_amount = original × (discount / 100)
        final_price = original - discount_amount
    
    EXAMPLE:
        discount = 1,000,000 × 0.20 = 200,000
        final = 1,000,000 - 200,000 = 800,000
    """
    if original_price < 0 or discount_percent < 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR",
            formula="final = original - (original × discount/100)",
            valid=False,
            error="Price and discount must be non-negative"
        )
    
    discount_amount = original_price * discount_percent / Decimal("100")
    final_price = original_price - discount_amount
    
    return CalculationResult(
        value=_round(final_price),
        unit="IDR",
        formula=f"final = {_round(original_price):,} - ({_round(original_price):,} × {discount_percent}/100)",
        example=f"{_round(final_price):,} = {_round(original_price):,} - {_round(discount_amount):,}"
    )


def calculate_tax(amount: Decimal, tax_percent: Decimal) -> CalculationResult:
    """
    Calculate tax amount on a purchase.
    
    INPUT:
        - amount: Pre-tax amount (Decimal)
        - tax_percent: Tax rate percentage (Decimal)
    
    OUTPUT: Tax amount (Decimal)
    
    FORMULA:
        tax = amount × (tax_percent / 100)
    
    EXAMPLE:
        tax = 1,000,000 × 0.11 = 110,000
    """
    tax = amount * tax_percent / Decimal("100")
    return CalculationResult(
        value=_round(tax),
        unit="IDR",
        formula=f"tax = {_round(amount):,} × ({tax_percent}/100)",
        example=f"{_round(tax):,} = {_round(amount):,} × {tax_percent}%"
    )


def calculate_tip(bill_amount: Decimal, tip_percent: Decimal) -> CalculationResult:
    """
    Calculate tip amount.
    
    INPUT:
        - bill_amount: Total bill (Decimal)
        - tip_percent: Tip percentage (Decimal)
    
    OUTPUT: Tip amount (Decimal)
    
    FORMULA:
        tip = bill × (tip_percent / 100)
    """
    tip = bill_amount * tip_percent / Decimal("100")
    return CalculationResult(
        value=_round(tip),
        unit="IDR",
        formula=f"tip = {_round(bill_amount):,} × ({tip_percent}/100)",
        example=f"{_round(tip):,}"
    )


def calculate_split_bill(total_amount: Decimal, number_of_people: int) -> CalculationResult:
    """
    Calculate amount per person when splitting a bill.
    
    INPUT:
        - total_amount: Total bill (Decimal)
        - number_of_people: Number of people (int)
    
    OUTPUT: Amount per person (Decimal)
    
    FORMULA:
        per_person = total / number_of_people
    """
    if number_of_people <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="IDR",
            formula="per_person = total / number_of_people",
            valid=False,
            error="Number of people must be positive"
        )
    
    per_person = total_amount / Decimal(number_of_people)
    return CalculationResult(
        value=_round(per_person),
        unit="IDR",
        formula=f"per_person = {_round(total_amount):,} / {number_of_people}",
        example=f"{_round(per_person):,}"
    )


def calculate_percentage_change(old_value: Decimal, new_value: Decimal) -> CalculationResult:
    """
    Calculate percentage change between two values.
    
    INPUT:
        - old_value: Original value (Decimal)
        - new_value: New value (Decimal)
    
    OUTPUT: Percentage change (Decimal)
    
    FORMULA:
        change = ((new - old) / old) × 100
    """
    if old_value == 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="percentage",
            formula="change = ((new - old) / old) × 100",
            valid=False,
            error="Old value cannot be zero"
        )
    
    change = ((new_value - old_value) / old_value) * Decimal("100")
    return CalculationResult(
        value=_round(change, 2),
        unit="percentage",
        formula=f"change = (({_round(new_value):,} - {_round(old_value):,}) / {_round(old_value):,}) × 100",
        example=f"{_round(change, 2)}%"
    )


def calculate_savings_time(
    current_amount: Decimal,
    target_amount: Decimal,
    monthly_savings: Decimal,
    annual_rate: Decimal = Decimal("0")
) -> CalculationResult:
    """
    Calculate months to reach savings goal.
    
    INPUT:
        - current_amount: Current savings (Decimal)
        - target_amount: Goal amount (Decimal)
        - monthly_savings: Monthly deposit (Decimal)
        - annual_rate: Annual interest rate (Decimal, default 0)
    
    OUTPUT: Months to reach goal (Decimal)
    
    FORMULA (no interest):
        months = (target - current) / monthly_savings
    
    FORMULA (with interest):
        Uses logarithmic formula for compound interest
    
    EXAMPLE:
        months = (10,000,000 - 2,000,000) / 500,000 = 16 months
    """
    if monthly_savings <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="months",
            formula="months = (target - current) / monthly_savings",
            valid=False,
            error="Monthly savings must be positive"
        )
    
    if target_amount <= current_amount:
        return CalculationResult(
            value=Decimal("0"),
            unit="months",
            formula="Goal already reached",
            example="0 months (already at goal)"
        )
    
    remaining = target_amount - current_amount
    
    if annual_rate <= 0:
        # Simple division
        months = remaining / monthly_savings
    else:
        # With compound interest
        monthly_rate = annual_rate / Decimal("12")
        # n = ln(FV/PV) / ln(1+r) but adjusted for regular deposits
        # Using approximation for simplicity
        months = Decimal("0")
        balance = current_amount
        while balance < target_amount:
            balance += monthly_savings
            balance *= (Decimal("1") + monthly_rate)
            months += Decimal("1")
            if months > Decimal("1200"):  # 100 year cap
                break
    
    return CalculationResult(
        value=_round(months, 1),
        unit="months",
        formula=f"months ≈ (target - current) / monthly_savings",
        example=f"≈ {_round(months, 1)} months"
    )


def calculate_income_conversion(amount: Decimal, from_period: str, to_period: str) -> CalculationResult:
    """
    Convert income between different time periods.
    
    INPUT:
        - amount: Income amount (Decimal)
        - from_period: Source period (annual/monthly/weekly/daily)
        - to_period: Target period (annual/monthly/weekly/daily)
    
    OUTPUT: Converted amount (Decimal)
    
    CONVERSIONS:
        annual = monthly × 12
        annual = weekly × 52
        annual = daily × 365
        monthly = annual / 12
        monthly = weekly × 52 / 12 ≈ weekly × 4.33
        weekly = annual / 52
        weekly = monthly / 4.33
        daily = annual / 365
        daily = monthly / 30
    """
    conversions = {
        ("annual", "monthly"): Decimal("12"),
        ("annual", "weekly"): Decimal("52"),
        ("annual", "daily"): Decimal("365"),
        ("monthly", "annual"): Decimal("1") / Decimal("12"),
        ("monthly", "weekly"): Decimal("52") / Decimal("12"),
        ("monthly", "daily"): Decimal("30"),
        ("weekly", "annual"): Decimal("1") / Decimal("52"),
        ("weekly", "monthly"): Decimal("12") / Decimal("52"),
        ("weekly", "daily"): Decimal("7"),
        ("daily", "annual"): Decimal("1") / Decimal("365"),
        ("daily", "monthly"): Decimal("1") / Decimal("30"),
        ("daily", "weekly"): Decimal("1") / Decimal("7"),
    }
    
    if from_period == to_period:
        multiplier = Decimal("1")
    else:
        multiplier = conversions.get((from_period, to_period))
        if multiplier is None:
            return CalculationResult(
                value=Decimal("0"),
                unit="IDR",
                formula=f"{to_period}",
                valid=False,
                error=f"Unknown conversion: {from_period} to {to_period}"
            )
    
    converted = amount * multiplier
    return CalculationResult(
        value=_round(converted),
        unit="IDR",
        formula=f"converted = {amount} × {multiplier}",
        example=f"{_round(converted):,} per {to_period}"
    )


def calculate_budget_from_income(monthly_income: Decimal, savings_rate_target: Decimal = Decimal("0.2")) -> dict:
    """
    Calculate recommended budget allocation based on income and savings target.
    
    INPUT:
        - monthly_income: Monthly take-home income (Decimal)
        - savings_rate_target: Target savings rate (Decimal, default 0.2 = 20%)
    
    OUTPUT: Dict with budget allocations
    
    ALLOCATION (50/30/20 rule modified):
        - Needs (fixed): 50%
        - Wants (variable): 30%
        - Savings: 20%
    """
    needs_rate = Decimal("0.5")
    wants_rate = Decimal("0.3")
    savings_rate = savings_rate_target
    
    savings = monthly_income * savings_rate
    remaining = monthly_income - savings
    needs = remaining * needs_rate / (needs_rate + wants_rate)
    wants = remaining * wants_rate / (needs_rate + wants_rate)
    
    return {
        "monthly_income": _round(monthly_income),
        "needs": _round(needs),
        "wants": _round(wants),
        "savings": _round(savings),
        "needs_rate": float(needs_rate * 100),
        "wants_rate": float(wants_rate * 100),
        "savings_rate": float(savings_rate * 100),
    }


def calculate_affordability(
    monthly_income: Decimal,
    monthly_expense: Decimal,
    item_monthly_payment: Decimal
) -> dict:
    """
    Calculate if an item is affordable based on income and existing expenses.
    
    INPUT:
        - monthly_income: Monthly income (Decimal)
        - monthly_expense: Current monthly expenses (Decimal)
        - item_monthly_payment: Proposed monthly payment (Decimal)
    
    OUTPUT: Affordability assessment
    """
    available = monthly_income - monthly_expense
    remaining_after = available - item_monthly_payment
    payment_ratio = _safe_divide(item_monthly_payment, available) * Decimal("100") if available > 0 else Decimal("0")
    
    if payment_ratio > Decimal("50"):
        status = "not_affordable"
        message = "Payment exceeds 50% of available income (HIGH RISK)"
    elif payment_ratio > Decimal("30"):
        status = "caution"
        message = "Payment is 30-50% of available income (MODERATE RISK)"
    else:
        status = "affordable"
        message = "Payment is under 30% of available income (LOW RISK)"
    
    return {
        "monthly_income": _round(monthly_income),
        "current_expenses": _round(monthly_expense),
        "available_income": _round(available),
        "item_payment": _round(item_monthly_payment),
        "remaining_after": _round(remaining_after),
        "payment_ratio": _round(payment_ratio, 2),
        "status": status,
        "message": message,
    }


# =============================================================================
# FINANCIAL GOALS
# =============================================================================

def calculate_goal_progress(current_amount: Decimal, target_amount: Decimal) -> CalculationResult:
    """
    Calculate goal progress as percentage.
    
    INPUT:
        - current_amount: Amount saved so far (Decimal)
        - target_amount: Goal target amount (Decimal)
    
    OUTPUT: Progress percentage (Decimal)
    
    FORMULA:
        progress = (current / target) × 100
    
    EXAMPLE:
        progress = (7,000,000 / 15,000,000) × 100 = 46.67%
    
    UNIT: Percentage (0-100+)
    
    EDGE CASES:
        - target_amount = 0: Returns 0
        - current > target: Returns 100+ (goal exceeded)
    """
    if target_amount <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="percentage",
            formula="progress = (current / target) × 100",
            example="0 when target = 0",
            valid=False,
            error="Target amount must be positive"
        )
    
    progress = (current_amount / target_amount) * Decimal("100")
    return CalculationResult(
        value=_round(progress, 2),
        unit="percentage",
        formula=f"progress = ({_round(current_amount):,} / {_round(target_amount):,}) × 100",
        example=f"{_round(progress, 2)}% = ({_round(current_amount):,} / {_round(target_amount):,}) × 100"
    )


def calculate_goal_remaining(target_amount: Decimal, current_amount: Decimal) -> CalculationResult:
    """
    Calculate remaining amount needed for goal.
    
    INPUT:
        - target_amount: Goal target amount (Decimal)
        - current_amount: Amount saved so far (Decimal)
    
    OUTPUT: Remaining amount (Decimal)
    
    FORMULA:
        remaining = target - current
    
    EXAMPLE:
        remaining = 15,000,000 - 7,000,000 = 8,000,000
    """
    remaining = target_amount - current_amount
    if remaining < 0:
        remaining = Decimal("0")
    
    return CalculationResult(
        value=_round(remaining),
        unit="IDR",
        formula=f"remaining = {_round(target_amount):,} - {_round(current_amount):,}",
        example=f"{_round(remaining):,}"
    )


def calculate_required_saving_for_goal(
    target_amount: Decimal,
    current_amount: Decimal,
    days_remaining: int
) -> dict:
    """
    Calculate required saving rate to reach goal on time.
    
    INPUT:
        - target_amount: Goal target amount (Decimal)
        - current_amount: Amount saved so far (Decimal)
        - days_remaining: Days until target date (int)
    
    OUTPUT: Dict with daily, weekly, monthly required saving
    
    FORMULA:
        remaining = target - current
        daily = remaining / days_remaining
        weekly = daily × 7
        monthly = daily × 30
    
    EXAMPLE:
        remaining = 8,000,000
        days = 180 (6 months)
        daily = 44,444
        weekly = 311,111
        monthly = 1,333,333
    """
    remaining = target_amount - current_amount
    if remaining <= 0:
        return {
            "remaining": Decimal("0"),
            "days_remaining": days_remaining,
            "required_daily": Decimal("0"),
            "required_weekly": Decimal("0"),
            "required_monthly": Decimal("0"),
            "status": "goal_reached"
        }
    
    if days_remaining <= 0:
        return {
            "remaining": _round(remaining),
            "days_remaining": 0,
            "required_daily": Decimal("999999999"),  # Impossible
            "required_weekly": Decimal("999999999"),
            "required_monthly": Decimal("999999999"),
            "status": "overdue"
        }
    
    daily = remaining / Decimal(days_remaining)
    weekly = daily * Decimal("7")
    monthly = daily * Decimal("30")
    
    return {
        "remaining": _round(remaining),
        "days_remaining": days_remaining,
        "required_daily": _round(daily),
        "required_weekly": _round(weekly),
        "required_monthly": _round(monthly),
        "status": "active"
    }


def calculate_goal_on_track(
    current_amount: Decimal,
    target_amount: Decimal,
    target_date: date,
    current_date: date = None
) -> dict:
    """
    Determine if goal is on track based on time progress vs money progress.
    
    INPUT:
        - current_amount: Amount saved so far (Decimal)
        - target_amount: Goal target amount (Decimal)
        - target_date: Goal target date
        - current_date: Current date (default: today)
    
    OUTPUT: Dict with on-track assessment
    
    FORMULA:
        time_progress = days_elapsed / total_days × 100
        money_progress = current / target × 100
        on_track = money_progress >= time_progress
    
    EXAMPLE:
        Goal: 15M in 6 months
        After 3 months: saved 6M
        Time progress: 50%
        Money progress: 40%
        Status: BEHIND (40% < 50%)
    """
    if current_date is None:
        from datetime import date as date_class
        current_date = date_class.today()
    
    total_days = (target_date - current_date.replace(day=1)).days + 30  # Approximate
    if hasattr(current_date, 'year'):
        # Calculate from start of goal period (assume 6 months back for demo)
        from datetime import timedelta
        period_start = current_date - timedelta(days=180)
        total_days = (target_date - period_start).days
        days_elapsed = (current_date - period_start).days
    else:
        days_elapsed = 0
    
    # Calculate progress percentages
    money_progress = _safe_divide(current_amount, target_amount) * Decimal("100")
    time_progress = Decimal("0")
    
    if total_days > 0:
        time_progress = Decimal(days_elapsed) / Decimal(total_days) * Decimal("100")
    
    # Determine status
    if money_progress >= Decimal("100"):
        status = "completed"
        on_track = True
    elif money_progress >= time_progress * Decimal("0.9"):  # Within 10%
        status = "on_track"
        on_track = True
    elif money_progress >= time_progress * Decimal("0.7"):  # Within 30%
        status = "slightly_behind"
        on_track = False
    elif target_date < current_date:
        status = "overdue"
        on_track = False
    else:
        status = "behind_track"
        on_track = False
    
    return {
        "current_amount": _round(current_amount),
        "target_amount": _round(target_amount),
        "money_progress_percent": _round(money_progress, 2),
        "time_progress_percent": _round(time_progress, 2),
        "on_track": on_track,
        "status": status,
        "message": f"Goal is {status.replace('_', ' ')}"
    }


# =============================================================================
# DEBT MANAGEMENT
# =============================================================================

def calculate_debt_progress(original_principal: Decimal, remaining_balance: Decimal) -> CalculationResult:
    """
    Calculate debt payoff progress.
    
    INPUT:
        - original_principal: Original loan amount (Decimal)
        - remaining_balance: Current remaining balance (Decimal)
    
    OUTPUT: Progress percentage (Decimal)
    
    FORMULA:
        progress = ((original - remaining) / original) × 100
    
    EXAMPLE:
        progress = ((100,000,000 - 65,000,000) / 100,000,000) × 100 = 35%
    """
    if original_principal <= 0:
        return CalculationResult(
            value=Decimal("0"),
            unit="percentage",
            formula="progress = ((original - remaining) / original) × 100",
            valid=False,
            error="Original principal must be positive"
        )
    
    paid = original_principal - remaining_balance
    progress = (paid / original_principal) * Decimal("100")
    
    return CalculationResult(
        value=_round(progress, 2),
        unit="percentage",
        formula=f"progress = (({_round(original_principal):,} - {_round(remaining_balance):,}) / {_round(original_principal):,}) × 100",
        example=f"{_round(progress, 2)}%"
    )


def calculate_total_debt_summary(debts: list[dict]) -> dict:
    """
    Calculate total debt summary from list of debts.
    
    INPUT:
        - debts: List of dicts with 'name', 'balance', 'monthly_payment', 'remaining_months'
    
    OUTPUT: Dict with totals
    """
    total_balance = sum(Decimal(str(d.get("balance", 0))) for d in debts)
    total_monthly = sum(Decimal(str(d.get("monthly_payment", 0))) for d in debts)
    total_remaining_months = sum(d.get("remaining_months", 0) for d in debts if d.get("remaining_months", 0) > 0)
    
    # Average interest rate (weighted by balance)
    weighted_rate = Decimal("0")
    for d in debts:
        balance = Decimal(str(d.get("balance", 0)))
        rate = Decimal(str(d.get("interest_rate", 0)))
        weighted_rate += balance * rate
    
    avg_rate = _safe_divide(weighted_rate, total_balance)
    
    return {
        "total_debt_count": len(debts),
        "total_outstanding_balance": _round(total_balance),
        "total_monthly_payment": _round(total_monthly),
        "total_remaining_months": total_remaining_months,
        "average_interest_rate": _round(avg_rate * 100, 2),
        "weighted_interest_rate": _round(avg_rate, 4),
    }


# =============================================================================
# NET WORTH FROM ACCOUNTS
# =============================================================================

def calculate_net_worth_from_accounts(accounts: list[dict], debts: list[dict] = None) -> CalculationResult:
    """
    Calculate net worth from account balances and debts.
    
    INPUT:
        - accounts: List of dicts with 'account_type', 'balance'
        - debts: Optional list of dicts with 'balance'
    
    OUTPUT: Net worth breakdown
    
    FORMULA:
        assets = sum of positive balances + investment accounts
        liabilities = sum of debts + credit card balances
        net_worth = assets - liabilities
    """
    cash = Decimal("0")
    bank = Decimal("0")
    investment = Decimal("0")
    ewallet = Decimal("0")
    other_assets = Decimal("0")
    credit_card_debt = Decimal("0")
    
    for acc in accounts:
        balance = Decimal(str(acc.get("balance", 0)))
        acc_type = acc.get("account_type", "").lower()
        
        if acc_type == "cash":
            cash += balance
        elif acc_type == "bank":
            bank += balance
        elif acc_type == "investment":
            investment += balance
        elif acc_type == "e-wallet":
            ewallet += balance
        elif acc_type == "credit_card":
            # Credit card balance is debt
            credit_card_debt += abs(balance)
        else:
            other_assets += balance
    
    total_assets = cash + bank + investment + ewallet + other_assets
    
    # Add debts
    other_debts = Decimal("0")
    if debts:
        for d in debts:
            other_debts += Decimal(str(d.get("balance", 0)))
    
    total_liabilities = credit_card_debt + other_debts
    net_worth = total_assets - total_liabilities
    
    return CalculationResult(
        value=_round(net_worth),
        unit="IDR",
        formula="net_worth = (cash + bank + investment + ewallet) - (credit_card_debt + other_debts)",
        example=f"net_worth = {_round(total_assets):,} - {_round(total_liabilities):,} = {_round(net_worth):,}",
    )


# =============================================================================
# CASH FLOW (CORRECT - EXCLUDES TRANSFERS)
# =============================================================================

def calculate_cash_flow_correct(
    total_income: Decimal,
    total_expense: Decimal,
    total_transfer_out: Decimal = Decimal("0"),
    total_transfer_in: Decimal = Decimal("0")
) -> dict:
    """
    Calculate cash flow correctly, excluding transfers.
    
    IMPORTANT: Transfers should NOT be counted as income or expense.
    They only move money between accounts.
    
    INPUT:
        - total_income: Sum of type='income' transactions
        - total_expense: Sum of type='expense' transactions
        - total_transfer_out: Sum of type='transfer_out' (for reference only)
        - total_transfer_in: Sum of type='transfer_in' (for reference only)
    
    OUTPUT: Correct cash flow metrics
    
    FORMULA:
        net_income = income - expense
        (transfers are neutral: transfer_out == transfer_in)
    """
    net_cash_flow = total_income - total_expense
    
    # Transfer totals should be equal (both sides of transfer)
    # They are shown for transparency but don't affect cash flow
    
    return {
        "total_income": _round(total_income),
        "total_expense": _round(total_expense),
        "net_cash_flow": _round(net_cash_flow),
        "transfer_out_total": _round(total_transfer_out),
        "transfer_in_total": _round(total_transfer_in),
        "transfer_net": _round(total_transfer_in - total_transfer_out),
        "formula": "net_cash_flow = total_income - total_expense (transfers excluded)"
    }


def calculate_spending_velocity(
    total_expense: Decimal,
    days_elapsed: int,
    days_in_period: int = 30
) -> dict:
    """
    Calculate spending velocity and predict end-of-period spending.
    
    INPUT:
        - total_expense: Expenses so far
        - days_elapsed: Days elapsed in period
        - days_in_period: Total days in period (default 30)
    
    OUTPUT: Velocity metrics
    """
    if days_elapsed <= 0:
        return {
            "total_expense": _round(total_expense),
            "days_elapsed": 0,
            "daily_velocity": Decimal("0"),
            "projected_total": Decimal("0"),
            "on_pace": None
        }
    
    daily_velocity = total_expense / Decimal(days_elapsed)
    projected_total = daily_velocity * Decimal(days_in_period)
    
    return {
        "total_expense": _round(total_expense),
        "days_elapsed": days_elapsed,
        "daily_velocity": _round(daily_velocity),
        "projected_total": _round(projected_total),
        "projected_vs_budget": None,  # Will be added if budget provided
        "on_pace": None  # Will be calculated if budget provided
    }
