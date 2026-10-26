"""
Analytics Service - Financial metrics calculation with Decimal precision.
Calculates Net Worth, Cash Flow, Financial Health Score, and Budget Analysis.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple
from datetime import date, datetime, timedelta
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.models.account import Account
from app.models.transaction import Transaction
from app.services.metrics import total_balance
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.debt import Debt


@dataclass
class NetWorthResult:
    """Net worth calculation result."""
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal
    asset_breakdown: Dict[str, Decimal]
    liability_breakdown: Dict[str, Decimal]


@dataclass
class CashFlowResult:
    """Monthly cash flow result."""
    month: date
    income: Decimal
    expense: Decimal
    net_flow: Decimal
    savings_rate: Decimal
    category_breakdown: Dict[str, Decimal]


@dataclass
class BudgetAnalysisResult:
    """Budget utilization analysis."""
    budget_id: int
    name: str
    limit: Decimal
    spent: Decimal
    remaining: Decimal
    utilization_pct: Decimal
    status: str  # "safe", "warning", "exceeded"


class AnalyticsService:
    """
    Financial analytics engine with precise Decimal calculations.
    All monetary values use Decimal type for accuracy.
    """
    
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
    
    async def calculate_net_worth(self) -> NetWorthResult:
        """
        Calculate net worth = Total Assets - Total Liabilities.
        Uses Decimal for precision (no floating point errors).
        """
        # Get all active accounts
        accounts = self.db.query(Account).filter(
            Account.user_id == self.user_id,
            Account.is_active == True
        ).all()
        
        # Get all active debts
        debts = self.db.query(Debt).filter(
            Debt.user_id == self.user_id,
            Debt.is_active == True
        ).all()
        
        # Calculate assets by type
        assets = Decimal("0")
        asset_breakdown = {}
        
        # The accounts do not all hold the same currency, so the
        # balances are converted before they are added.
        converted = await total_balance(self.db, self.user_id)
        target = converted["currency"]
        for account in accounts:
            amount, currency = float(account.balance or "0"), (
                (account.currency or "IDR").upper()
            )
            if currency != target:
                from app.services.currency import converter
                rate = await converter.rate(currency, target)
                if rate is None:
                    # No rate: leave it out rather than mix it in.
                    continue
                amount = amount * rate
            balance = Decimal(str(amount))
            assets += balance
            
            acc_type = account.account_type or "Lainnya"
            asset_breakdown[acc_type] = asset_breakdown.get(acc_type, Decimal("0")) + balance
        
        # Calculate liabilities
        liabilities = Decimal("0")
        liability_breakdown = {}
        
        for debt in debts:
            balance = Decimal(str(debt.current_balance or "0"))
            liabilities += balance
            
            debt_type = debt.debt_type or "Lainnya"
            liability_breakdown[debt_type] = liability_breakdown.get(debt_type, Decimal("0")) + balance
        
        # Net worth
        net_worth = assets - liabilities
        
        return NetWorthResult(
            total_assets=assets.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            total_liabilities=liabilities.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            net_worth=net_worth.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            asset_breakdown={k: v.quantize(Decimal("0.01")) for k, v in asset_breakdown.items()},
            liability_breakdown={k: v.quantize(Decimal("0.01")) for k, v in liability_breakdown.items()}
        )
    
    def calculate_monthly_cash_flow(
        self,
        target_date: Optional[date] = None,
        months: int = 6
    ) -> List[CashFlowResult]:
        """
        Calculate monthly cash flow for the last N months.
        Returns income, expense, net flow, and savings rate.
        """
        if target_date is None:
            target_date = date.today()
        
        results = []
        
        for i in range(months):
            # Calculate month range
            month_date = target_date.replace(day=1) - timedelta(days=30 * i)
            if month_date.month == 2:
                # Handle February
                next_month = month_date.replace(day=28)
            else:
                next_month = month_date.replace(day=30) if month_date.month in [4, 6, 9, 11] else month_date.replace(day=31)
            
            # Query transactions for this month
            txs = self.db.query(Transaction).filter(
                Transaction.user_id == self.user_id,
                Transaction.date >= month_date,
                Transaction.date <= next_month
            ).all()
            
            # Calculate totals using Decimal
            income = Decimal("0")
            expense = Decimal("0")
            category_breakdown = {}
            
            for tx in txs:
                amount = Decimal(str(tx.amount or "0"))
                
                if tx.type == "income":
                    income += abs(amount)
                else:
                    expense += abs(amount)
                    
                    # Category breakdown (expenses only)
                    cat_name = tx.category.name if tx.category else "Lainnya"
                    category_breakdown[cat_name] = category_breakdown.get(cat_name, Decimal("0")) + abs(amount)
            
            # Calculate metrics
            net_flow = income - expense
            savings_rate = (net_flow / income * 100) if income > 0 else Decimal("0")
            
            results.append(CashFlowResult(
                month=month_date,
                income=income.quantize(Decimal("0.01")),
                expense=expense.quantize(Decimal("0.01")),
                net_flow=net_flow.quantize(Decimal("0.01")),
                savings_rate=savings_rate.quantize(Decimal("0.1")),
                category_breakdown={k: v.quantize(Decimal("0.01")) for k, v in category_breakdown.items()}
            ))
        
        return results
    
    async def get_current_month_summary(self) -> Dict:
        """
        Get current month financial summary.
        Used for dashboard overview cards.
        """
        today = date.today()
        start_of_month = today.replace(day=1)
        
        # Get transactions
        txs = self.db.query(Transaction).filter(
            Transaction.user_id == self.user_id,
            Transaction.date >= start_of_month
        ).all()
        
        income = Decimal("0")
        expense = Decimal("0")
        
        for tx in txs:
            amount = Decimal(str(tx.amount or "0"))
            if tx.type == "income":
                income += abs(amount)
            else:
                expense += abs(amount)
        
        net_savings = income - expense
        
        # Get account balances
        accounts = self.db.query(Account).filter(
            Account.user_id == self.user_id,
            Account.is_active == True
        ).all()
        # The accounts do not all hold the same currency, so the
        # balance is converted before it is reported. A raw sum would
        # be a number in no currency at all.
        balance = await total_balance(self.db, self.user_id)
        total_balance = Decimal(str(balance["total"]))
        
        # Get debt
        debts = self.db.query(Debt).filter(
            Debt.user_id == self.user_id,
            Debt.is_active == True
        ).all()
        total_debt = sum(Decimal(str(d.current_balance or "0")) for d in debts)
        
        return {
            "period": start_of_month.strftime("%B %Y"),
            "total_balance": float(total_balance),
            "total_income": float(income),
            "total_expense": float(expense),
            "net_savings": float(net_savings),
            "savings_rate": float((net_savings / income * 100) if income > 0 else 0),
            "total_debt": float(total_debt),
            "account_count": len(accounts),
            "transaction_count": len(txs)
        }
    
    def analyze_budgets(self) -> List[BudgetAnalysisResult]:
        """
        Analyze budget utilization for current month.
        Calculates spent amount from transactions.
        """
        today = date.today()
        start_of_month = today.replace(day=1)
        
        budgets = self.db.query(Budget).filter(
            Budget.user_id == self.user_id,
            Budget.is_active == True
        ).all()
        
        results = []
        
        for budget in budgets:
            # Get transactions for this budget's category
            limit = Decimal(str(budget.amount or "0"))
            
            if budget.category_id:
                spent = self.db.query(
                    func.sum(func.abs(Transaction.amount))
                ).filter(
                    Transaction.user_id == self.user_id,
                    Transaction.category_id == budget.category_id,
                    Transaction.type == "expense",
                    Transaction.date >= start_of_month
                ).scalar() or Decimal("0")
            else:
                # All expenses
                spent = self.db.query(
                    func.sum(func.abs(Transaction.amount))
                ).filter(
                    Transaction.user_id == self.user_id,
                    Transaction.type == "expense",
                    Transaction.date >= start_of_month
                ).scalar() or Decimal("0")
            
            remaining = limit - spent
            utilization = (spent / limit * 100) if limit > 0 else Decimal("0")
            
            # Determine status
            if utilization >= 100:
                status = "exceeded"
            elif utilization >= 80:
                status = "warning"
            else:
                status = "safe"
            
            results.append(BudgetAnalysisResult(
                budget_id=budget.id,
                name=budget.name,
                limit=limit.quantize(Decimal("0.01")),
                spent=Decimal(str(spent)).quantize(Decimal("0.01")),
                remaining=remaining.quantize(Decimal("0.01")),
                utilization_pct=utilization.quantize(Decimal("0.1")),
                status=status
            ))
        
        return results
    
    def get_spending_trends(self, months: int = 6) -> Dict:
        """
        Analyze spending trends over N months.
        Identifies categories with increasing/decreasing patterns.
        """
        cash_flows = self.calculate_monthly_cash_flow(months=months)
        
        # Aggregate by category
        category_trends = {}
        
        for cf in cash_flows:
            for cat, amount in cf.category_breakdown.items():
                if cat not in category_trends:
                    category_trends[cat] = []
                category_trends[cat].append(float(amount))
        
        # Calculate trend direction
        trends = []
        for cat, amounts in category_trends.items():
            if len(amounts) >= 2:
                # Simple trend: compare first half vs second half
                mid = len(amounts) // 2
                first_half = sum(amounts[:mid]) / mid if mid > 0 else 0
                second_half = sum(amounts[mid:]) / (len(amounts) - mid) if mid < len(amounts) else 0
                
                if second_half > first_half * 1.1:
                    direction = "increasing"
                elif second_half < first_half * 0.9:
                    direction = "decreasing"
                else:
                    direction = "stable"
                
                trends.append({
                    "category": cat,
                    "current": amounts[0],
                    "average": sum(amounts) / len(amounts),
                    "trend": direction,
                    "change_pct": ((amounts[0] - amounts[-1]) / amounts[-1] * 100) if amounts[-1] > 0 else 0
                })
        
        # Sort by current amount
        trends.sort(key=lambda x: x["current"], reverse=True)
        
        return {"trends": trends[:10]}
    
    async def calculate_financial_health_score(self) -> Dict:
        """
        Calculate comprehensive financial health score (0-100).
        Based on 5 key metrics.
        """
        # Get data
        net_worth = await self.calculate_net_worth()
        summary = await self.get_current_month_summary()
        
        income = Decimal(str(summary["total_income"]))
        expense = Decimal(str(summary["total_expense"]))
        balance = Decimal(str(summary["total_balance"]))
        debt = Decimal(str(summary["total_debt"]))
        
        # Score components
        scores = {}
        
        # 1. Savings Rate (25 points)
        # Ideal: >20% savings rate
        savings_rate = ((income - expense) / income * 100) if income > 0 else 0
        if savings_rate >= 20:
            scores["savings_rate"] = 25
        elif savings_rate >= 10:
            scores["savings_rate"] = 15
        elif savings_rate >= 0:
            scores["savings_rate"] = 5
        else:
            scores["savings_rate"] = 0
        
        # 2. Emergency Fund (25 points)
        # Ideal: 6 months expenses
        monthly_expense = expense
        emergency_target = monthly_expense * 6
        if balance >= emergency_target:
            scores["emergency_fund"] = 25
        elif balance >= monthly_expense * 3:
            scores["emergency_fund"] = 15
        elif balance >= monthly_expense:
            scores["emergency_fund"] = 10
        else:
            scores["emergency_fund"] = 0
        
        # 3. Debt-to-Income Ratio (20 points)
        # Ideal: <36% DTI
        monthly_debt_payment = debt / 12  # Assume equal monthly payments
        dti = (monthly_debt_payment / income * 100) if income > 0 else 0
        
        if dti <= 20:
            scores["debt_ratio"] = 20
        elif dti <= 36:
            scores["debt_ratio"] = 15
        elif dti <= 50:
            scores["debt_ratio"] = 5
        else:
            scores["debt_ratio"] = 0
        
        # 4. Net Worth Growth (15 points)
        if net_worth.net_worth > 0:
            scores["net_worth"] = 15
        elif net_worth.net_worth == 0:
            scores["net_worth"] = 5
        else:
            scores["net_worth"] = 0
        
        # 5. Budget Discipline (15 points)
        budget_analysis = self.analyze_budgets()
        if budget_analysis:
            exceeded_count = sum(1 for b in budget_analysis if b.status == "exceeded")
            exceeded_ratio = exceeded_count / len(budget_analysis)
            
            if exceeded_ratio == 0:
                scores["budget_discipline"] = 15
            elif exceeded_ratio <= 0.25:
                scores["budget_discipline"] = 10
            elif exceeded_ratio <= 0.5:
                scores["budget_discipline"] = 5
            else:
                scores["budget_discipline"] = 0
        else:
            scores["budget_discipline"] = 7  # No budgets = neutral
        
        # Total score
        total_score = sum(scores.values())
        
        # Grade
        if total_score >= 90:
            grade = "A"
            message = "Kesehatan finansial excellent!"
        elif total_score >= 75:
            grade = "B"
            message = "Kesehatan finansial baik"
        elif total_score >= 60:
            grade = "C"
            message = "Kesehatan finansial cukup"
        elif total_score >= 40:
            grade = "D"
            message = "Kesehatan finansial perlu perbaikan"
        else:
            grade = "E"
            message = "Perlu perhatian segera"
        
        return {
            "score": total_score,
            "max_score": 100,
            "grade": grade,
            "message": message,
            "components": {
                "savings_rate": {"score": scores["savings_rate"], "max": 25, "value": float(savings_rate)},
                "emergency_fund": {"score": scores["emergency_fund"], "max": 25, "value": float(balance)},
                "debt_ratio": {"score": scores["debt_ratio"], "max": 20, "value": float(dti)},
                "net_worth": {"score": scores["net_worth"], "max": 15, "value": float(net_worth.net_worth)},
                "budget_discipline": {"score": scores["budget_discipline"], "max": 15}
            }
        }


def get_analytics_service(db: Session, user_id: int) -> AnalyticsService:
    """Factory function for AnalyticsService."""
    return AnalyticsService(db, user_id)
