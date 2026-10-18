"""
Financial Ratios Calculator - Deterministic financial health calculations.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import date, datetime


@dataclass
class FinancialRatio:
    """Individual financial ratio result."""
    name: str
    value: float
    ideal_min: float
    ideal_max: float
    status: str  # "excellent", "good", "warning", "danger"
    description: str


@dataclass
class FinancialHealthReport:
    """Complete financial health assessment."""
    overall_score: int  # 0-100
    overall_grade: str  # A, B, C, D, E
    liquidity_ratio: FinancialRatio
    savings_ratio: FinancialRatio
    dsr_ratio: FinancialRatio
    emergency_fund_months: FinancialRatio
    debt_to_asset_ratio: FinancialRatio
    monthly_income: float
    monthly_expense: float
    monthly_savings: float
    total_cash: float
    total_debt: float
    total_assets: float
    calculated_at: str


class FinancialRatiosCalculator:
    """
    Calculates deterministic financial ratios for health assessment.
    Uses Decimal for precision.
    """
    
    # Ideal thresholds
    IDEAL_LIQUIDITY_RATIO = 3  # 3 months minimum
    IDEAL_SAVINGS_RATIO = 0.20  # 20% minimum
    IDEAL_DSR = 0.30  # 30% maximum
    IDEAL_DEBT_TO_ASSET = 0.40  # 40% maximum
    
    def calculate(
        self,
        monthly_income: float,
        monthly_expense: float,
        total_cash: float,
        total_debt: float,
        monthly_debt_payment: float = None,
        total_assets: float = None
    ) -> FinancialHealthReport:
        """
        Calculate all financial ratios.
        
        Args:
            monthly_income: Monthly gross income
            monthly_expense: Monthly total expenses
            total_cash: Total cash and cash equivalents
            total_debt: Total outstanding debt
            monthly_debt_payment: Monthly debt payment (optional)
            total_assets: Total assets (optional, defaults to total_cash)
        """
        # Convert to Decimal for precision
        income = Decimal(str(monthly_income))
        expense = Decimal(str(monthly_expense))
        cash = Decimal(str(total_cash))
        debt = Decimal(str(total_debt))
        assets = Decimal(str(total_assets or total_cash))
        
        monthly_payment = Decimal(str(monthly_debt_payment or 0))
        
        # Calculate ratios
        savings = income - expense
        savings_ratio = float(savings / income) if income > 0 else 0
        
        # Emergency fund in months
        emergency_months = float(cash / expense) if expense > 0 else 0
        
        # Debt Service Ratio
        dsr = float(monthly_payment / income) if income > 0 else 0
        
        # Debt to Asset Ratio
        debt_to_asset = float(debt / assets) if assets > 0 else 0
        
        # Calculate individual ratios
        liquidity = self._calculate_liquidity_ratio(emergency_months)
        savings_r = self._calculate_savings_ratio(savings_ratio)
        dsr_r = self._calculate_dsr_ratio(dsr)
        emergency = self._calculate_emergency_fund(emergency_months)
        dta = self._calculate_debt_to_asset(debt_to_asset)
        
        # Overall score (weighted)
        overall_score = self._calculate_overall_score(
            liquidity, savings_r, dsr_r, emergency, dta
        )
        overall_grade = self._calculate_grade(overall_score)
        
        return FinancialHealthReport(
            overall_score=overall_score,
            overall_grade=overall_grade,
            liquidity_ratio=liquidity,
            savings_ratio=savings_r,
            dsr_ratio=dsr_r,
            emergency_fund_months=emergency,
            debt_to_asset_ratio=dta,
            monthly_income=float(income),
            monthly_expense=float(expense),
            monthly_savings=float(savings),
            total_cash=float(cash),
            total_debt=float(debt),
            total_assets=float(assets),
            calculated_at=datetime.utcnow().isoformat()
        )
    
    def _calculate_liquidity_ratio(self, months: float) -> FinancialRatio:
        """Calculate liquidity ratio (emergency fund months)."""
        if months >= 6:
            status = "excellent"
        elif months >= 3:
            status = "good"
        elif months >= 1:
            status = "warning"
        else:
            status = "danger"
        
        return FinancialRatio(
            name="Dana Darurat (Bulan)",
            value=round(months, 1),
            ideal_min=3,
            ideal_max=12,
            status=status,
            description=f"Dana darurat Anda cukup untuk {months:.1f} bulan pengeluaran"
        )
    
    def _calculate_savings_ratio(self, ratio: float) -> FinancialRatio:
        """Calculate savings ratio."""
        percentage = ratio * 100
        
        if percentage >= 30:
            status = "excellent"
        elif percentage >= 20:
            status = "good"
        elif percentage >= 10:
            status = "warning"
        else:
            status = "danger"
        
        return FinancialRatio(
            name="Rasio Tabungan",
            value=round(percentage, 1),
            ideal_min=20,
            ideal_max=100,
            status=status,
            description=f"Tabungan Anda {percentage:.1f}% dari penghasilan"
        )
    
    def _calculate_dsr_ratio(self, ratio: float) -> FinancialRatio:
        """Calculate Debt Service Ratio."""
        percentage = ratio * 100
        
        if percentage <= 15:
            status = "excellent"
        elif percentage <= 30:
            status = "good"
        elif percentage <= 45:
            status = "warning"
        else:
            status = "danger"
        
        return FinancialRatio(
            name="Debt Service Ratio (DSR)",
            value=round(percentage, 1),
            ideal_min=0,
            ideal_max=30,
            status=status,
            description=f"Cicilan utang {percentage:.1f}% dari penghasilan"
        )
    
    def _calculate_emergency_fund(self, months: float) -> FinancialRatio:
        """Calculate emergency fund status."""
        if months >= 6:
            status = "excellent"
        elif months >= 3:
            status = "good"
        elif months >= 1:
            status = "warning"
        else:
            status = "danger"
        
        return FinancialRatio(
            name="Dana Darurat",
            value=round(months, 1),
            ideal_min=3,
            ideal_max=12,
            status=status,
            description=f"{months:.1f} bulan cadangan hidup"
        )
    
    def _calculate_debt_to_asset(self, ratio: float) -> FinancialRatio:
        """Calculate debt to asset ratio."""
        percentage = ratio * 100
        
        if percentage <= 20:
            status = "excellent"
        elif percentage <= 40:
            status = "good"
        elif percentage <= 60:
            status = "warning"
        else:
            status = "danger"
        
        return FinancialRatio(
            name="Rasio Utang terhadap Aset",
            value=round(percentage, 1),
            ideal_min=0,
            ideal_max=40,
            status=status,
            description=f"Utang {percentage:.1f}% dari total aset"
        )
    
    def _calculate_overall_score(
        self,
        liquidity: FinancialRatio,
        savings: FinancialRatio,
        dsr: FinancialRatio,
        emergency: FinancialRatio,
        debt: FinancialRatio
    ) -> int:
        """Calculate weighted overall score (0-100)."""
        weights = {
            "excellent": 100,
            "good": 75,
            "warning": 50,
            "danger": 25
        }
        
        scores = [
            weights[liquidity.status],
            weights[savings.status] * 1.5,  # Savings is important
            weights[dsr.status] * 1.2,  # DSR matters for debt
            weights[emergency.status],
            weights[debt.status]
        ]
        
        total_weight = 1 + 1.5 + 1.2 + 1 + 1
        weighted_avg = sum(scores) / total_weight
        
        return min(100, max(0, int(weighted_avg)))
    
    def _calculate_grade(self, score: int) -> str:
        """Convert score to letter grade."""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 50:
            return "D"
        else:
            return "E"


# Singleton
ratios_calculator = FinancialRatiosCalculator()


def calculate_financial_health(
    monthly_income: float,
    monthly_expense: float,
    total_cash: float,
    total_debt: float,
    **kwargs
) -> FinancialHealthReport:
    """Convenience function to calculate financial health."""
    return ratios_calculator.calculate(
        monthly_income=monthly_income,
        monthly_expense=monthly_expense,
        total_cash=total_cash,
        total_debt=total_debt,
        **kwargs
    )
