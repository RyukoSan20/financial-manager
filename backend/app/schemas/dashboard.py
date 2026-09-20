"""Dashboard response schema."""

from pydantic import BaseModel
from decimal import Decimal
from typing import Optional


class DashboardResponse(BaseModel):
    # Summary metrics
    total_balance: Decimal
    total_income_month: Decimal
    total_expense_month: Decimal
    net_cash_flow: Decimal
    saving_rate: Decimal
    currency: str
    
    # Budget metrics
    total_budget: Decimal
    total_spent: Decimal
    remaining_budget: Decimal
    budget_utilization: Decimal  # percentage
    
    # Daily metrics
    average_daily_spending: Decimal
    projected_monthly_spending: Decimal
    days_elapsed: int
    days_remaining: int
    safe_daily_limit: Decimal
    
    # Category breakdown
    expense_by_category: dict[str, Decimal]
    income_by_category: dict[str, Decimal]
    
    # Budget comparison
    budget_vs_actual: list[dict]
    
    # Financial health
    expense_ratio: Decimal
    financial_status: str  # healthy, warning, danger
