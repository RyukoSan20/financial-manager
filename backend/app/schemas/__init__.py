"""Pydantic schemas for API validation."""

from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.schemas.transaction import (
    TransactionCreate, TransactionUpdate, TransactionResponse,
    TransactionWithDetails, TransactionFilter
)
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse
from app.schemas.transfer import TransferCreate, TransferUpdate, TransferResponse, TransferWithTransactions
from app.schemas.recurring import (
    RecurringRuleCreate, RecurringRuleUpdate, RecurringRuleResponse, RecurringRuleWithStats
)
from app.schemas.goal import (
    GoalCreate, GoalUpdate, GoalResponse, GoalWithProgress,
    GoalContributionCreate, GoalContributionResponse
)
from app.schemas.debt import (
    DebtCreate, DebtUpdate, DebtResponse, DebtWithProgress,
    DebtPaymentCreate, DebtPaymentResponse, DebtAmortizationEntry, DebtAmortizationSchedule
)
from app.schemas.dashboard import DashboardResponse
from app.schemas.calculation import *

__all__ = [
    # Account
    "AccountCreate", "AccountUpdate", "AccountResponse",
    # Category
    "CategoryCreate", "CategoryUpdate", "CategoryResponse",
    # Transaction
    "TransactionCreate", "TransactionUpdate", "TransactionResponse",
    "TransactionWithDetails", "TransactionFilter",
    # Budget
    "BudgetCreate", "BudgetUpdate", "BudgetResponse",
    # Transfer
    "TransferCreate", "TransferUpdate", "TransferResponse", "TransferWithTransactions",
    # Recurring
    "RecurringRuleCreate", "RecurringRuleUpdate", "RecurringRuleResponse", "RecurringRuleWithStats",
    # Goal
    "GoalCreate", "GoalUpdate", "GoalResponse", "GoalWithProgress",
    "GoalContributionCreate", "GoalContributionResponse",
    # Debt
    "DebtCreate", "DebtUpdate", "DebtResponse", "DebtWithProgress",
    "DebtPaymentCreate", "DebtPaymentResponse",
    "DebtAmortizationEntry", "DebtAmortizationSchedule",
    # Dashboard
    "DashboardResponse",
]
