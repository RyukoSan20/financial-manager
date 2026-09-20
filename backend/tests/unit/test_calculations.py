"""Unit tests for ALL financial calculation formulas."""

import pytest
from decimal import Decimal
from datetime import date, timedelta


# Import all functions by exec
exec(open('/Users/rafi/financial-manager/backend/app/services/calculation/formulas.py').read())


class TestGoalCalculations:
    """Tests for goal-related calculations."""
    
    def test_goal_progress_normal(self):
        result = calculate_goal_progress(Decimal("7000000"), Decimal("15000000"))
        assert result.value == Decimal("46.67")
        assert result.valid is True
    
    def test_goal_progress_completed(self):
        result = calculate_goal_progress(Decimal("15000000"), Decimal("15000000"))
        assert result.value == Decimal("100")
    
    def test_goal_progress_exceeded(self):
        result = calculate_goal_progress(Decimal("20000000"), Decimal("15000000"))
        assert result.value == Decimal("133.33")
    
    def test_goal_progress_zero_target(self):
        result = calculate_goal_progress(Decimal("1000"), Decimal("0"))
        assert result.valid is False
    
    def test_goal_remaining(self):
        result = calculate_goal_remaining(Decimal("15000000"), Decimal("7000000"))
        assert result.value == Decimal("8000000")
    
    def test_goal_remaining_already_reached(self):
        result = calculate_goal_remaining(Decimal("15000000"), Decimal("20000000"))
        assert result.value == Decimal("0")
    
    def test_required_saving_normal(self):
        result = calculate_required_saving_for_goal(
            Decimal("15000000"), Decimal("7000000"), 180
        )
        assert result["required_monthly"] == Decimal("1333333")
        assert result["required_weekly"] == Decimal("311111")
        assert result["required_daily"] == Decimal("44444")
        assert result["status"] == "active"
    
    def test_required_saving_goal_reached(self):
        result = calculate_required_saving_for_goal(
            Decimal("15000000"), Decimal("15000000"), 180
        )
        assert result["status"] == "goal_reached"
        assert result["remaining"] == Decimal("0")
    
    def test_goal_on_track(self):
        target = date.today() + timedelta(days=180)
        result = calculate_goal_on_track(
            Decimal("7000000"), Decimal("15000000"), target
        )
        assert result["status"] in ["on_track", "behind_track", "completed"]
        assert "money_progress_percent" in result
        assert "time_progress_percent" in result


class TestDebtCalculations:
    """Tests for debt-related calculations."""
    
    def test_debt_progress(self):
        result = calculate_debt_progress(Decimal("100000000"), Decimal("65000000"))
        assert result.value == Decimal("35.00")
    
    def test_debt_progress_zero(self):
        result = calculate_debt_progress(Decimal("100000000"), Decimal("100000000"))
        assert result.value == Decimal("0")
    
    def test_debt_progress_paid_off(self):
        result = calculate_debt_progress(Decimal("100000000"), Decimal("0"))
        assert result.value == Decimal("100.00")
    
    def test_total_debt_summary(self):
        debts = [
            {"name": "Loan 1", "balance": "50000000", "monthly_payment": "2500000", "remaining_months": 24, "interest_rate": "0.10"},
            {"name": "Loan 2", "balance": "20000000", "monthly_payment": "1000000", "remaining_months": 24, "interest_rate": "0.15"},
        ]
        result = calculate_total_debt_summary(debts)
        assert result["total_debt_count"] == 2
        assert result["total_outstanding_balance"] == Decimal("70000000")
        assert result["total_monthly_payment"] == Decimal("3500000")


class TestCashFlow:
    """Tests for cash flow calculations (transfer-aware)."""
    
    def test_cash_flow_excludes_transfers(self):
        result = calculate_cash_flow_correct(
            Decimal("15000000"),  # Income
            Decimal("8000000"),   # Expense
            Decimal("2000000"),   # Transfer out
            Decimal("2000000"),   # Transfer in
        )
        # Transfer should NOT affect net cash flow
        assert result["net_cash_flow"] == Decimal("7000000")
        assert result["total_income"] == Decimal("15000000")
        assert result["total_expense"] == Decimal("8000000")
        assert result["transfer_net"] == Decimal("0")
    
    def test_cash_flow_unbalanced_transfers(self):
        """Transfers should still net to zero."""
        result = calculate_cash_flow_correct(
            Decimal("10000000"),
            Decimal("5000000"),
            Decimal("1000000"),
            Decimal("1000000"),
        )
        assert result["transfer_net"] == Decimal("0")


class TestNetWorth:
    """Tests for net worth calculations."""
    
    def test_net_worth_positive(self):
        accounts = [
            {"account_type": "cash", "balance": "5000000"},
            {"account_type": "bank", "balance": "50000000"},
            {"account_type": "investment", "balance": "20000000"},
        ]
        debts = [{"balance": "15000000"}]
        result = calculate_net_worth_from_accounts(accounts, debts)
        # 5M + 50M + 20M - 15M = 60M
        assert result.value == Decimal("60000000")
    
    def test_net_worth_negative(self):
        accounts = [
            {"account_type": "cash", "balance": "1000000"},
        ]
        debts = [{"balance": "5000000"}]
        result = calculate_net_worth_from_accounts(accounts, debts)
        assert result.value == Decimal("-4000000")
    
    def test_net_worth_no_debts(self):
        accounts = [
            {"account_type": "bank", "balance": "25000000"},
        ]
        result = calculate_net_worth_from_accounts(accounts, None)
        assert result.value == Decimal("25000000")


class TestSpendingVelocity:
    """Tests for spending velocity calculations."""
    
    def test_velocity_normal(self):
        result = calculate_spending_velocity(
            Decimal("1500000"), 15, 30
        )
        assert result["daily_velocity"] == Decimal("100000")
        assert result["projected_total"] == Decimal("3000000")
    
    def test_velocity_zero_days(self):
        result = calculate_spending_velocity(Decimal("1000000"), 0, 30)
        assert result["daily_velocity"] == Decimal("0")


# Re-export existing tests for backward compatibility
class TestBalance:
    """Tests for balance calculations."""
    
    def test_balance_positive(self):
        result = calculate_balance(Decimal("10000000"), Decimal("7000000"))
        assert result.value == Decimal("3000000")
        assert result.valid is True
    
    def test_balance_negative(self):
        result = calculate_balance(Decimal("5000000"), Decimal("8000000"))
        assert result.value == Decimal("-3000000")
    
    def test_balance_zero(self):
        result = calculate_balance(Decimal("5000000"), Decimal("5000000"))
        assert result.value == Decimal("0")
    
    def test_balance_invalid_income(self):
        result = calculate_balance(Decimal("-1000"), Decimal("500"))
        assert result.valid is False


class TestSavingRate:
    """Tests for saving rate calculations."""
    
    def test_saving_rate_normal(self):
        result = calculate_saving_rate(Decimal("10000000"), Decimal("7500000"))
        assert result.value == Decimal("0.25")
    
    def test_saving_rate_zero_income(self):
        result = calculate_saving_rate(Decimal("0"), Decimal("1000"))
        assert result.valid is False
    
    def test_saving_rate_dissaving(self):
        result = calculate_saving_rate(Decimal("5000000"), Decimal("7000000"))
        assert result.value < Decimal("0")


class TestBudget:
    """Tests for budget calculations."""
    
    def test_budget_utilization_normal(self):
        result = calculate_budget_utilization(Decimal("2000000"), Decimal("1500000"))
        assert result.value == Decimal("75.00")
    
    def test_budget_utilization_zero_budget(self):
        result = calculate_budget_utilization(Decimal("0"), Decimal("1000"))
        assert result.valid is False
    
    def test_budget_utilization_under_budget(self):
        result = calculate_budget_utilization(Decimal("2000000"), Decimal("500000"))
        assert result.value == Decimal("25.00")
    
    def test_remaining_budget(self):
        result = calculate_remaining_budget(Decimal("2000000"), Decimal("1500000"))
        assert result.value == Decimal("500000")
    
    def test_remaining_budget_negative(self):
        result = calculate_remaining_budget(Decimal("1000000"), Decimal("1500000"))
        assert result.value == Decimal("-500000")
    
    def test_prorated_budget_half_month(self):
        result = calculate_prorated_budget(Decimal("3000000"), 30, 15)
        assert result.value == Decimal("1500000")
    
    def test_prorated_budget_zero_days(self):
        result = calculate_prorated_budget(Decimal("3000000"), 0, 15)
        assert result.valid is False
    
    def test_safe_daily_spending(self):
        result = calculate_safe_daily_spending(Decimal("500000"), 10)
        assert result.value == Decimal("50000")
    
    def test_safe_daily_spending_over_budget(self):
        result = calculate_safe_daily_spending(Decimal("-50000"), 10)
        assert result.value == Decimal("0")
        assert result.error is not None


class TestSpendingAnalysis:
    """Tests for spending analysis calculations."""
    
    def test_average_daily_spending(self):
        result = calculate_average_daily_spending(Decimal("1500000"), 15)
        assert result.value == Decimal("100000")
    
    def test_average_daily_spending_zero_days(self):
        result = calculate_average_daily_spending(Decimal("1500000"), 0)
        assert result.valid is False
    
    def test_projected_monthly_spending(self):
        result = calculate_projected_monthly_spending(Decimal("100000"), 30)
        assert result.value == Decimal("3000000")
    
    def test_expense_ratio(self):
        result = calculate_expense_ratio(Decimal("7500000"), Decimal("10000000"))
        assert result.value == Decimal("75.00")
    
    def test_expense_ratio_zero_income(self):
        result = calculate_expense_ratio(Decimal("1000"), Decimal("0"))
        assert result.valid is False


class TestInterest:
    """Tests for interest calculations."""
    
    def test_simple_interest(self):
        result = calculate_simple_interest(Decimal("10000000"), Decimal("0.05"), Decimal("2"))
        assert result.value == Decimal("1000000")
    
    def test_compound_interest(self):
        result = calculate_compound_interest(
            Decimal("10000000"), 
            Decimal("0.05"), 
            Decimal("2"), 
            12
        )
        assert result.value > Decimal("1000000")
        assert result.value < Decimal("1100000")


class TestLoan:
    """Tests for loan calculations."""
    
    def test_loan_payment(self):
        result = calculate_loan_payment(Decimal("100000000"), Decimal("0.10"), 60)
        assert result.value > Decimal("2000000")
        assert result.value < Decimal("2200000")
    
    def test_loan_payment_no_interest(self):
        result = calculate_loan_payment(Decimal("12000000"), Decimal("0"), 12)
        assert result.value == Decimal("1000000")
    
    def test_amortization_schedule(self):
        schedule = generate_amortization_schedule(Decimal("12000000"), Decimal("0.10"), 12)
        assert len(schedule) == 12
        assert schedule[0].payment > schedule[0].interest
        assert schedule[-1].balance == Decimal("0")


class TestCalculators:
    """Tests for financial calculators."""
    
    def test_discount_price(self):
        result = calculate_discount_price(Decimal("1000000"), Decimal("20"))
        assert result.value == Decimal("800000")
    
    def test_tax(self):
        result = calculate_tax(Decimal("1000000"), Decimal("11"))
        assert result.value == Decimal("110000")
    
    def test_tip(self):
        result = calculate_tip(Decimal("500000"), Decimal("15"))
        assert result.value == Decimal("75000")
    
    def test_split_bill(self):
        result = calculate_split_bill(Decimal("600000"), 4)
        assert result.value == Decimal("150000")
    
    def test_split_bill_invalid(self):
        result = calculate_split_bill(Decimal("600000"), 0)
        assert result.valid is False
    
    def test_percentage_change(self):
        result = calculate_percentage_change(Decimal("100000"), Decimal("125000"))
        assert result.value == Decimal("25.00")
    
    def test_income_conversion_monthly_to_annual(self):
        result = calculate_income_conversion(Decimal("10000000"), "monthly", "annual")
        assert result.value == Decimal("120000000")
    
    def test_budget_from_income(self):
        result = calculate_budget_from_income(Decimal("10000000"))
        assert result["savings"] == Decimal("2000000")
        assert result["needs"] + result["wants"] + result["savings"] == Decimal("10000000")
    
    def test_affordability_affordable(self):
        result = calculate_affordability(
            Decimal("10000000"), 
            Decimal("5000000"), 
            Decimal("1000000")
        )
        assert result["status"] == "affordable"
    
    def test_affordability_not_affordable(self):
        result = calculate_affordability(
            Decimal("10000000"), 
            Decimal("5000000"), 
            Decimal("3000000")
        )
        assert result["status"] == "not_affordable"
