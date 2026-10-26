"""
Dashboard & Analytics Router - Financial metrics API endpoints.
Exposes /api/dashboard/* and /api/analytics/* endpoints.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal

from app.core.security import get_current_user
from app.core.database import SessionLocal
from app.modules.ledger.analytics_service import AnalyticsService

router = APIRouter(tags=["Dashboard & Analytics"])


# ============ RESPONSE SCHEMAS ============

class AccountSummary(BaseModel):
    id: int
    name: str
    type: str
    balance: float


class DashboardSummary(BaseModel):
    period: str
    total_balance: float
    total_income: float
    total_expense: float
    net_savings: float
    savings_rate: float
    total_debt: float
    account_count: int
    transaction_count: int
    accounts: List[AccountSummary]


class CashFlowItem(BaseModel):
    month: str
    income: float
    expense: float
    net_flow: float
    savings_rate: float


class NetWorthResponse(BaseModel):
    total_assets: float
    total_liabilities: float
    net_worth: float
    asset_breakdown: dict
    liability_breakdown: dict


class BudgetStatus(BaseModel):
    budget_id: int
    name: str
    limit: float
    spent: float
    remaining: float
    utilization_pct: float
    status: str


class SpendingTrend(BaseModel):
    category: str
    current: float
    average: float
    trend: str
    change_pct: float


class HealthScore(BaseModel):
    score: int
    max_score: int
    grade: str
    message: str
    components: dict


class SpendingInsight(BaseModel):
    type: str
    severity: str
    title: str
    description: str
    suggestion: str


# ============ DASHBOARD ENDPOINTS ============

def get_user_id(current_user) -> int:
    """Get user ID from current_user (handles both dict and User object)."""
    if hasattr(current_user, 'id'):
        return current_user.id
    return get_user_id(current_user) if isinstance(current_user, dict) else None


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    current_user = Depends(get_current_user)
):
    """
    Get dashboard overview with current month summary.
    Returns balance, income, expense, and savings rate.
    """
    user_id = get_user_id(current_user)
    
    db = SessionLocal()
    try:
        service = AnalyticsService(db, user_id)
        summary = await service.get_current_month_summary()
        
        # Get account details
        from app.models.account import Account
        accounts = db.query(Account).filter(
            Account.user_id == user_id,
            Account.is_active == True
        ).all()
        
        account_summaries = [
            AccountSummary(
                id=a.id,
                name=a.name,
                type=a.account_type or "Lainnya",
                balance=float(a.balance or 0)
            )
            for a in accounts
        ]
        
        return DashboardSummary(
            period=summary["period"],
            total_balance=summary["total_balance"],
            total_income=summary["total_income"],
            total_expense=summary["total_expense"],
            net_savings=summary["net_savings"],
            savings_rate=summary["savings_rate"],
            total_debt=summary["total_debt"],
            account_count=summary["account_count"],
            transaction_count=summary["transaction_count"],
            accounts=account_summaries
        )
    finally:
        db.close()


@router.get("/dashboard/cash-flow")
async def get_cash_flow(
    months: int = Query(default=6, ge=1, le=24),
    current_user = Depends(get_current_user)
):
    """
    Get monthly cash flow for the last N months.
    Returns income, expense, net flow, and savings rate per month.
    """
    user_id = get_user_id(current_user)
    
    db = SessionLocal()
    try:
        service = AnalyticsService(db, user_id)
        cash_flows = service.calculate_monthly_cash_flow(months=months)
        
        return {
            "cash_flow": [
                {
                    "month": cf.month.strftime("%Y-%m"),
                    "month_name": cf.month.strftime("%B %Y"),
                    "income": float(cf.income),
                    "expense": float(cf.expense),
                    "net_flow": float(cf.net_flow),
                    "savings_rate": float(cf.savings_rate),
                    "category_breakdown": {
                        k: float(v) for k, v in cf.category_breakdown.items()
                    }
                }
                for cf in cash_flows
            ]
        }
    finally:
        db.close()


@router.get("/dashboard/net-worth", response_model=NetWorthResponse)
async def get_net_worth(
    current_user = Depends(get_current_user)
):
    """
    Calculate net worth: Total Assets - Total Liabilities.
    Returns breakdown by account/debt type.
    """
    user_id = get_user_id(current_user)
    
    db = SessionLocal()
    try:
        service = AnalyticsService(db, user_id)
        net_worth = await service.calculate_net_worth()
        
        return NetWorthResponse(
            total_assets=float(net_worth.total_assets),
            total_liabilities=float(net_worth.total_liabilities),
            net_worth=float(net_worth.net_worth),
            asset_breakdown={k: float(v) for k, v in net_worth.asset_breakdown.items()},
            liability_breakdown={k: float(v) for k, v in net_worth.liability_breakdown.items()}
        )
    finally:
        db.close()


# ============ ANALYTICS ENDPOINTS ============

@router.get("/analytics/budgets", response_model=List[BudgetStatus])
async def get_budget_analytics(
    current_user = Depends(get_current_user)
):
    """
    Get budget utilization analysis.
    Shows spent amount, remaining, and alert status.
    """
    user_id = get_user_id(current_user)
    
    db = SessionLocal()
    try:
        service = AnalyticsService(db, user_id)
        budgets = service.analyze_budgets()
        
        return [
            BudgetStatus(
                budget_id=b.budget_id,
                name=b.name,
                limit=float(b.limit),
                spent=float(b.spent),
                remaining=float(b.remaining),
                utilization_pct=float(b.utilization_pct),
                status=b.status
            )
            for b in budgets
        ]
    finally:
        db.close()


@router.get("/analytics/trends")
async def get_spending_trends(
    months: int = Query(default=6, ge=3, le=24),
    current_user = Depends(get_current_user)
):
    """
    Get spending trends analysis.
    Shows which categories are increasing, decreasing, or stable.
    """
    user_id = get_user_id(current_user)
    
    db = SessionLocal()
    try:
        service = AnalyticsService(db, user_id)
        trends = service.get_spending_trends(months=months)
        
        return trends
    finally:
        db.close()


@router.get("/analytics/health-score", response_model=HealthScore)
async def get_health_score(
    current_user = Depends(get_current_user)
):
    """
    Get comprehensive financial health score (0-100).
    Based on savings rate, emergency fund, debt ratio, net worth, and budget discipline.
    """
    user_id = get_user_id(current_user)
    
    db = SessionLocal()
    try:
        service = AnalyticsService(db, user_id)
        health = await service.calculate_financial_health_score()
        
        return HealthScore(
            score=health["score"],
            max_score=health["max_score"],
            grade=health["grade"],
            message=health["message"],
            components=health["components"]
        )
    finally:
        db.close()


@router.get("/analytics/insights")
async def get_spending_insights(
    current_user = Depends(get_current_user)
):
    """
    Get AI-generated spending insights and anomalies.
    Detects latte factor, spending spikes, and unusual patterns.
    """
    user_id = get_user_id(current_user)
    
    db = SessionLocal()
    try:
        from app.modules.ai_advisor.engines.spending_analyzer import analyze_spending
        from app.models.transaction import Transaction
        from sqlalchemy import desc
        
        # Get recent transactions
        transactions = db.query(Transaction).filter(
            Transaction.user_id == user_id
        ).order_by(desc(Transaction.date)).limit(100).all()
        
        if not transactions:
            return {"insights": [], "message": "Belum ada data transaksi"}
        
        # Convert to format for analyzer
        tx_data = [
            {
                "date": t.date.isoformat() if hasattr(t.date, 'isoformat') else str(t.date),
                "amount": float(t.amount),
                "type": t.type,
                "category": t.category.name if t.category else "Lainnya",
                "description": t.description or ""
            }
            for t in transactions
        ]
        
        # Analyze
        pattern, anomalies = analyze_spending(tx_data)
        
        insights = []
        
        # Add anomaly insights
        for anomaly in anomalies[:5]:
            insights.append(SpendingInsight(
                type=anomaly.anomaly_type,
                severity=anomaly.severity,
                title=f"Deteksi: {anomaly.anomaly_type}",
                description=anomaly.description,
                suggestion=anomaly.suggestion
            ))
        
        # Add pattern insights
        if pattern.top_categories:
            top = pattern.top_categories[0]
            insights.append(SpendingInsight(
                type="pattern",
                severity="info",
                title="Pengeluaran Tertinggi",
                description=f"Kategori '{top[0]}' Rp {float(top[1]):,.0f}",
                suggestion="Pertimbangkan realokasi budget untuk kategori ini."
            ))
        
        return {"insights": insights}
    finally:
        db.close()


# ============ EXPORT ENDPOINTS ============

@router.get("/analytics/export/{format}")
async def export_analytics(
    format: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user = Depends(get_current_user)
):
    """
    Export analytics data in various formats.
    Supported: csv, json, xlsx
    """
    user_id = get_user_id(current_user)
    
    if format not in ["csv", "json"]:
        return {"error": "Unsupported format"}
    
    db = SessionLocal()
    try:
        service = AnalyticsService(db, user_id)
        
        # Get cash flow data
        cash_flows = service.calculate_monthly_cash_flow(months=12)
        
        if format == "json":
            import json
            data = {
                "export_date": datetime.now().isoformat(),
                "cash_flow": [
                    {
                        "month": cf.month.isoformat(),
                        "income": float(cf.income),
                        "expense": float(cf.expense),
                        "net_flow": float(cf.net_flow)
                    }
                    for cf in cash_flows
                ],
                "net_worth": {
                    "total_assets": float((await service.calculate_net_worth()).total_assets),
                    "total_liabilities": float((await service.calculate_net_worth()).total_liabilities),
                    "net_worth": float((await service.calculate_net_worth()).net_worth)
                },
                "health_score": (await service.calculate_financial_health_score())["score"]
            }
            return data
        
        elif format == "csv":
            # Generate CSV
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow(["Month", "Income", "Expense", "Net Flow", "Savings Rate %"])
            
            # Data
            for cf in cash_flows:
                writer.writerow([
                    cf.month.strftime("%Y-%m"),
                    float(cf.income),
                    float(cf.expense),
                    float(cf.net_flow),
                    float(cf.savings_rate)
                ])
            
            csv_content = output.getvalue()
            
            return StreamingResponse(
                iter([csv_content]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=finmanager-analytics.csv"}
            )
        
    finally:
        db.close()
