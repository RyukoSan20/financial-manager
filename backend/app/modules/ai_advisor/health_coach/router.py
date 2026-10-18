"""
Health Coach Router - API endpoints for AI Financial Health Coach.
"""
from fastapi import APIRouter, Depends
from typing import Optional

from app.core.security import get_current_user
from app.core.database import SessionLocal
from app.modules.ai_advisor.health_coach.financial_ratios import calculate_financial_health
from app.modules.ai_advisor.health_coach.audit_generator import generate_proactive_audit, AuditGenerator

router = APIRouter(prefix="/api/health-coach", tags=["AI Health Coach"])


@router.get("/score")
async def get_health_score(
    current_user = Depends(get_current_user)
):
    """Get financial health score and ratios."""
    user_id = current_user.id if hasattr(current_user, 'id') else None
    
    db = SessionLocal()
    try:
        # Get user financial data
        from app.models.account import Account
        from app.models.transaction import Transaction
        from app.models.debt import Debt
        from sqlalchemy import func
        from datetime import date
        
        today = date.today()
        start_month = today.replace(day=1)
        
        # Calculate monthly income/expense
        income = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.type == "income",
            Transaction.date >= start_month
        ).scalar() or 0
        
        expense = db.query(func.sum(func.abs(Transaction.amount))).filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= start_month
        ).scalar() or 0
        
        # Get total cash
        total_cash = db.query(func.sum(Account.balance)).filter(
            Account.user_id == user_id,
            Account.is_active == True
        ).scalar() or 0
        
        # Get total debt
        total_debt = db.query(func.sum(Debt.current_balance)).filter(
            Debt.user_id == user_id,
            Debt.is_active == True
        ).scalar() or 0
        
        # Calculate health
        health = calculate_financial_health(
            monthly_income=float(income),
            monthly_expense=float(expense),
            total_cash=float(total_cash),
            total_debt=float(total_debt)
        )
        
        return {
            "score": health.overall_score,
            "grade": "A" if health.overall_score >= 90 else "B" if health.overall_score >= 80 else "C" if health.overall_score >= 70 else "D" if health.overall_score >= 50 else "E",
            "liquidity_ratio": {
                "value": health.liquidity_ratio.value,
                "status": health.liquidity_ratio.status,
                "description": health.liquidity_ratio.description
            },
            "savings_ratio": {
                "value": health.savings_ratio.value,
                "status": health.savings_ratio.status,
                "description": health.savings_ratio.description
            },
            "dsr_ratio": {
                "value": health.dsr_ratio.value,
                "status": health.dsr_ratio.status,
                "description": health.dsr_ratio.description
            },
            "emergency_fund_months": {
                "value": health.emergency_fund_months.value,
                "status": health.emergency_fund_months.status,
                "description": health.emergency_fund_months.description
            },
            "summary": {
                "monthly_income": health.monthly_income,
                "monthly_expense": health.monthly_expense,
                "monthly_savings": health.monthly_savings,
                "total_cash": health.total_cash,
                "total_debt": health.total_debt
            }
        }
    finally:
        db.close()


@router.get("/audit")
async def get_health_audit(
    current_user = Depends(get_current_user)
):
    """Get comprehensive financial health audit report."""
    user_id = current_user.id if hasattr(current_user, 'id') else None
    
    db = SessionLocal()
    try:
        from app.models.account import Account
        from app.models.transaction import Transaction
        from app.models.debt import Debt
        from sqlalchemy import func
        from datetime import date
        
        today = date.today()
        start_month = today.replace(day=1)
        
        income = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.type == "income",
            Transaction.date >= start_month
        ).scalar() or 0
        
        expense = db.query(func.sum(func.abs(Transaction.amount))).filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= start_month
        ).scalar() or 0
        
        total_cash = db.query(func.sum(Account.balance)).filter(
            Account.user_id == user_id,
            Account.is_active == True
        ).scalar() or 0
        
        total_debt = db.query(func.sum(Debt.current_balance)).filter(
            Debt.user_id == user_id,
            Debt.is_active == True
        ).scalar() or 0
        
        # Generate audit
        generator = AuditGenerator()
        report = generator.generate_audit(
            user_data={"user_id": user_id},
            financial_data={
                "monthly_income": float(income),
                "monthly_expense": float(expense),
                "total_cash": float(total_cash),
                "total_debt": float(total_debt)
            }
        )
        
        # Generate narrative
        narrative = generator.generate_narrative(report)
        
        return {
            "report": {
                "id": report.report_id,
                "score": report.overall_score,
                "status": report.overall_status,
                "score_change": report.score_change,
                "period": report.period
            },
            "findings": [
                {
                    "severity": f.severity,
                    "category": f.category,
                    "title": f.title,
                    "description": f.description,
                    "suggestion": f.suggestion
                }
                for f in report.findings
            ],
            "highlights": report.positive_highlights,
            "recommendations": report.immediate_actions,
            "narrative": narrative
        }
    finally:
        db.close()


@router.get("/recommendations")
async def get_recommendations(
    current_user = Depends(get_current_user)
):
    """Get actionable financial recommendations."""
    user_id = current_user.id if hasattr(current_user, 'id') else None
    
    # Get audit report
    audit = await get_health_audit(current_user)
    
    return {
        "immediate": audit.get("recommendations", []),
        "monthly_plan": audit.get("monthly_plan", {}),
        "actionable_cards": [
            {
                "type": "budget_adjust",
                "title": "Sesuaikan Budget",
                "description": "Atur ulang alokasi budget bulanan berdasarkan saran AI",
                "action": "/budgets"
            },
            {
                "type": "savings_plan",
                "title": "Buat Tabungan Baru",
                "description": "Tambahkan tabungan untuk dana darurat atau tujuan lainnya",
                "action": "/goals"
            },
            {
                "type": "debt_strategy",
                "title": "Strategi Pelunasan",
                "description": "Lihat strategi pelunasan utang optimal",
                "action": "/debts"
            }
        ]
    }
