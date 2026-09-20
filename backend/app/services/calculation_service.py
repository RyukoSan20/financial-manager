"""Calculation service wrapping all formulas."""

from decimal import Decimal
from datetime import date
from typing import Optional
from app.services.calculation.formulas import (
    CalculationResult, AmortizationResult,
    calculate_balance,
    calculate_net_cash_flow,
    calculate_saving_rate,
    calculate_emergency_fund_target,
    calculate_budget_utilization,
    calculate_remaining_budget,
    calculate_prorated_budget,
    calculate_safe_daily_spending,
    calculate_average_daily_spending,
    calculate_projected_monthly_spending,
    calculate_expense_ratio,
    calculate_growth_rate,
    calculate_debt_to_income_ratio,
    calculate_debt_payment_ratio,
    calculate_net_worth,
    calculate_simple_interest,
    calculate_compound_interest,
    calculate_loan_payment,
    generate_amortization_schedule,
    calculate_future_value,
    calculate_present_value,
    calculate_inflation_adjusted_value,
    calculate_discount_price,
    calculate_tax,
    calculate_tip,
    calculate_split_bill,
    calculate_percentage_change,
    calculate_savings_time,
    calculate_income_conversion,
    calculate_budget_from_income,
    calculate_affordability,
)


class CalculationService:
    """
    Service layer for all financial calculations.
    
    This service wraps the calculation formulas and provides
    a consistent interface for the API and other services.
    """
    
    # === Balance & Cash Flow ===
    
    def get_balance(self, total_income: Decimal, total_expense: Decimal) -> CalculationResult:
        return calculate_balance(total_income, total_expense)
    
    def get_net_cash_flow(self, total_income: Decimal, total_expense: Decimal) -> CalculationResult:
        return calculate_net_cash_flow(total_income, total_expense)
    
    # === Savings ===
    
    def get_saving_rate(self, total_income: Decimal, total_expense: Decimal) -> CalculationResult:
        return calculate_saving_rate(total_income, total_expense)
    
    def get_emergency_fund_target(
        self, 
        monthly_expense: Decimal, 
        months_coverage: int = 6
    ) -> CalculationResult:
        return calculate_emergency_fund_target(monthly_expense, months_coverage)
    
    # === Budget ===
    
    def get_budget_utilization(
        self, 
        budget_amount: Decimal, 
        actual_expense: Decimal
    ) -> CalculationResult:
        return calculate_budget_utilization(budget_amount, actual_expense)
    
    def get_remaining_budget(
        self, 
        budget_amount: Decimal, 
        actual_expense: Decimal
    ) -> CalculationResult:
        return calculate_remaining_budget(budget_amount, actual_expense)
    
    def get_prorated_budget(
        self, 
        budget_amount: Decimal, 
        days_in_period: int, 
        days_elapsed: int
    ) -> CalculationResult:
        return calculate_prorated_budget(budget_amount, days_in_period, days_elapsed)
    
    def get_safe_daily_limit(
        self, 
        remaining_budget: Decimal, 
        days_remaining: int
    ) -> CalculationResult:
        return calculate_safe_daily_spending(remaining_budget, days_remaining)
    
    # === Spending Analysis ===
    
    def get_average_daily_spending(
        self, 
        total_expense: Decimal, 
        days_elapsed: int
    ) -> CalculationResult:
        return calculate_average_daily_spending(total_expense, days_elapsed)
    
    def get_projected_monthly_spending(
        self, 
        average_daily_spending: Decimal,
        days_in_month: int = 30
    ) -> CalculationResult:
        return calculate_projected_monthly_spending(average_daily_spending, days_in_month)
    
    def get_expense_ratio(self, expense: Decimal, income: Decimal) -> CalculationResult:
        return calculate_expense_ratio(expense, income)
    
    # === Growth ===
    
    def get_income_growth(
        self, 
        previous_income: Decimal, 
        current_income: Decimal
    ) -> CalculationResult:
        return calculate_growth_rate(previous_income, current_income)
    
    def get_expense_growth(
        self, 
        previous_expense: Decimal, 
        current_expense: Decimal
    ) -> CalculationResult:
        return calculate_growth_rate(previous_expense, current_expense)
    
    # === Debt ===
    
    def get_debt_to_income_ratio(
        self, 
        total_debt: Decimal, 
        monthly_income: Decimal
    ) -> CalculationResult:
        return calculate_debt_to_income_ratio(total_debt, monthly_income)
    
    def get_debt_payment_ratio(
        self, 
        debt_payment: Decimal, 
        monthly_income: Decimal
    ) -> CalculationResult:
        return calculate_debt_payment_ratio(debt_payment, monthly_income)
    
    # === Net Worth ===
    
    def get_net_worth(
        self, 
        assets: list[dict], 
        liabilities: list[dict]
    ) -> CalculationResult:
        return calculate_net_worth(assets, liabilities)
    
    # === Interest ===
    
    def get_simple_interest(
        self, 
        principal: Decimal, 
        rate: Decimal, 
        time: Decimal
    ) -> CalculationResult:
        return calculate_simple_interest(principal, rate, time)
    
    def get_compound_interest(
        self, 
        principal: Decimal, 
        rate: Decimal, 
        time: Decimal,
        compounding_frequency: int = 12
    ) -> CalculationResult:
        return calculate_compound_interest(principal, rate, time, compounding_frequency)
    
    # === Loan ===
    
    def get_loan_payment(
        self, 
        principal: Decimal, 
        annual_rate: Decimal, 
        term_months: int
    ) -> CalculationResult:
        return calculate_loan_payment(principal, annual_rate, term_months)
    
    def get_amortization_schedule(
        self, 
        principal: Decimal, 
        annual_rate: Decimal, 
        term_months: int
    ) -> list[AmortizationResult]:
        return generate_amortization_schedule(principal, annual_rate, term_months)
    
    # === Time Value ===
    
    def get_future_value(
        self, 
        present_value: Decimal, 
        rate: Decimal, 
        periods: int
    ) -> CalculationResult:
        return calculate_future_value(present_value, rate, periods)
    
    def get_present_value(
        self, 
        future_value: Decimal, 
        rate: Decimal, 
        periods: int
    ) -> CalculationResult:
        return calculate_present_value(future_value, rate, periods)
    
    def get_inflation_adjusted_value(
        self, 
        future_value: Decimal, 
        inflation_rate: Decimal, 
        years: int
    ) -> CalculationResult:
        return calculate_inflation_adjusted_value(future_value, inflation_rate, years)
    
    # === Financial Calculators ===
    
    def calc_discount(self, original_price: Decimal, discount_percent: Decimal) -> CalculationResult:
        return calculate_discount_price(original_price, discount_percent)
    
    def calc_tax(self, amount: Decimal, tax_percent: Decimal) -> CalculationResult:
        return calculate_tax(amount, tax_percent)
    
    def calc_tip(self, bill_amount: Decimal, tip_percent: Decimal) -> CalculationResult:
        return calculate_tip(bill_amount, tip_percent)
    
    def calc_split_bill(self, total_amount: Decimal, number_of_people: int) -> CalculationResult:
        return calculate_split_bill(total_amount, number_of_people)
    
    def calc_percentage_change(self, old_value: Decimal, new_value: Decimal) -> CalculationResult:
        return calculate_percentage_change(old_value, new_value)
    
    def calc_savings_time(
        self, 
        current_amount: Decimal, 
        target_amount: Decimal, 
        monthly_savings: Decimal,
        annual_rate: Decimal = Decimal("0")
    ) -> CalculationResult:
        return calculate_savings_time(current_amount, target_amount, monthly_savings, annual_rate)
    
    def calc_income_conversion(
        self, 
        amount: Decimal, 
        from_period: str, 
        to_period: str
    ) -> CalculationResult:
        return calculate_income_conversion(amount, from_period, to_period)
    
    def calc_budget_from_income(
        self, 
        monthly_income: Decimal, 
        savings_rate_target: Decimal = Decimal("0.2")
    ) -> dict:
        return calculate_budget_from_income(monthly_income, savings_rate_target)
    
    def calc_affordability(
        self, 
        monthly_income: Decimal, 
        monthly_expense: Decimal, 
        item_monthly_payment: Decimal
    ) -> dict:
        return calculate_affordability(monthly_income, monthly_expense, item_monthly_payment)
    
    # === Dashboard Aggregates ===
    
    def get_dashboard_metrics(
        self,
        total_balance: Decimal,
        total_income: Decimal,
        total_expense: Decimal,
        total_budget: Decimal,
        total_spent: Decimal,
        days_elapsed: int,
        days_in_period: int = 30
    ) -> dict:
        """Calculate all dashboard metrics at once."""
        
        # Core metrics
        net_cash_flow = self.get_net_cash_flow(total_income, total_expense)
        saving_rate = self.get_saving_rate(total_income, total_expense)
        remaining_budget = self.get_remaining_budget(total_budget, total_spent)
        budget_utilization = self.get_budget_utilization(total_budget, total_spent)
        
        # Daily metrics
        avg_daily = self.get_average_daily_spending(total_spent, days_elapsed)
        projected = self.get_projected_monthly_spending(avg_daily.value, days_in_period)
        safe_limit = self.get_safe_daily_limit(remaining_budget.value, days_in_period - days_elapsed)
        
        # Financial health
        expense_ratio = self.get_expense_ratio(total_expense, total_income)
        
        # Determine status
        if expense_ratio.value < Decimal("70"):
            status = "healthy"
        elif expense_ratio.value < Decimal("90"):
            status = "warning"
        else:
            status = "danger"
        
        return {
            "total_balance": total_balance,
            "total_income": total_income,
            "total_expense": total_expense,
            "net_cash_flow": net_cash_flow.value,
            "saving_rate": saving_rate.value,
            "saving_rate_percent": float(saving_rate.value * 100),
            "total_budget": total_budget,
            "total_spent": total_spent,
            "remaining_budget": remaining_budget.value,
            "budget_utilization": budget_utilization.value,
            "average_daily_spending": avg_daily.value,
            "projected_monthly_spending": projected.value,
            "safe_daily_limit": safe_limit.value,
            "days_elapsed": days_elapsed,
            "days_remaining": days_in_period - days_elapsed,
            "expense_ratio": expense_ratio.value,
            "financial_status": status,
        }


# Singleton instance
calculation_service = CalculationService()
