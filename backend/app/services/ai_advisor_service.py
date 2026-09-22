"""AI Financial Advisor Service using Google Gemini API.

Free tier: 15 requests/minute, 1500 requests/day (gemini-1.5-flash)
No credit card required.
"""

import os
import json
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime, date, timedelta
from dataclasses import dataclass
from sqlalchemy.orm import Session

# Gemini API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

# Free tier limits
MAX_TOKENS = 8192
TEMPERATURE = 0.7


@dataclass
class FinancialSummary:
    """User's financial summary for AI context."""
    total_balance: float
    monthly_income: float
    monthly_expense: float
    savings_rate: float
    total_debt: float
    active_goals: int
    goal_progress: List[Dict[str, Any]]
    top_categories: List[Dict[str, Any]]
    recent_transactions: List[Dict[str, Any]]


@dataclass
class AIAdvice:
    """AI-generated financial advice."""
    title: str
    category: str  # "savings", "spending", "investment", "debt", "goals"
    priority: str  # "high", "medium", "low"
    insight: str
    action_items: List[str]
    potential_impact: str


class AIFinancialAdvisor:
    """AI-powered financial advisor using Gemini."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or GEMINI_API_KEY
        self.session = requests.Session()
    
    def _call_gemini(self, prompt: str) -> Optional[str]:
        """Make API call to Gemini."""
        if not self.api_key:
            return None
        
        try:
            url = f"{GEMINI_API_URL}?key={self.api_key}"
            
            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "temperature": TEMPERATURE,
                    "maxOutputTokens": MAX_TOKENS,
                }
            }
            
            response = self.session.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            else:
                print(f"Gemini API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"Gemini API exception: {e}")
            return None
    
    def build_context(self, summary: FinancialSummary) -> str:
        """Build context prompt from financial summary."""
        return f"""You are a knowledgeable financial advisor specializing in personal finance for Indonesian users.

CURRENT FINANCIAL SITUATION:
- Total Balance: Rp {summary.total_balance:,.0f}
- Monthly Income: Rp {summary.monthly_income:,.0f}
- Monthly Expense: Rp {summary.monthly_expense:,.0f}
- Savings Rate: {summary.savings_rate:.1f}%
- Total Debt: Rp {summary.total_debt:,.0f}
- Active Goals: {summary.active_goals}

TOP SPENDING CATEGORIES:
{chr(10).join([f"- {cat['category']}: Rp {cat['total']:,.0f}" for cat in summary.top_categories[:5]])}

GOALS PROGRESS:
{chr(10).join([f"- {g['name']}: {g['progress']:.0f}% complete (Rp {g['saved']:,.0f} of Rp {g['target']:,.0f})" for g in summary.goal_progress[:3]])}

RECENT TRANSACTIONS:
{chr(10).join([f"- {t['date']}: {t['description']} - Rp {abs(t['amount']):,.0f} ({t['type']})" for t in summary.recent_transactions[:5]])}

Provide advice in Indonesian language. Format your response as JSON with this structure:
{{
  "advice": [
    {{
      "title": "Brief advice title",
      "category": "savings|spending|investment|debt|goals",
      "priority": "high|medium|low",
      "insight": "2-3 sentence explanation",
      "action_items": ["action 1", "action 2", "action 3"],
      "potential_impact": "1 sentence on impact"
    }}
  ]
}}

Provide exactly 3-4 advice items. Focus on actionable, specific recommendations.
"""
    
    def get_advice(self, summary: FinancialSummary) -> List[AIAdvice]:
        """Get personalized financial advice."""
        if not self.api_key:
            return self._get_fallback_advice(summary)
        
        context = self.build_context(summary)
        response = self._call_gemini(context)
        
        if response:
            try:
                # Try to parse JSON from response
                import re
                json_match = re.search(r'\{[\s\S]*"advice"[\s\S]*\}|\[[\s\S]*\]', response)
                if json_match:
                    data = json.loads(json_match.group())
                    return [
                        AIAdvice(
                            title=a["title"],
                            category=a["category"],
                            priority=a["priority"],
                            insight=a["insight"],
                            action_items=a["action_items"],
                            potential_impact=a.get("potential_impact", "")
                        )
                        for a in data.get("advice", [])
                    ]
            except (json.JSONDecodeError, KeyError) as e:
                print(f"Failed to parse Gemini response: {e}")
        
        return self._get_fallback_advice(summary)
    
    def _get_fallback_advice(self, summary: FinancialSummary) -> List[AIAdvice]:
        """Fallback advice when API is unavailable."""
        advice = []
        
        # Savings rate advice
        if summary.savings_rate < 20:
            advice.append(AIAdvice(
                title="Tingkatkan Tabungan",
                category="savings",
                priority="high",
                insight=f"Tingkat tabungan Anda {summary.savings_rate:.1f}% masih di bawah target ideal 20%. Hal ini bisa危及紧急基金的建立.",
                action_items=[
                    "Buat anggaran 50/30/20 (kebutuhan/keinginan/tabungan)",
                    "Otomatisasi transfer ke tabungan saat gajian",
                    "Cari pengeluaran yang bisa dikurangi"
                ],
                potential_impact="Meningkatkan dana darurat dan persiapan masa depan"
            ))
        
        # Debt advice
        if summary.total_debt > 0:
            advice.append(AIAdvice(
                title="Kelola Utang",
                category="debt",
                priority="high",
                insight=f"Anda memiliki utang Rp {summary.total_debt:,.0f}. Prioritaskan pembayaran utang dengan bunga tinggi.",
                action_items=[
                    "Fokus bayar utang dengan bunga tertinggi dulu",
                    "Gunakan metode 'snowball' atau 'avalanche'",
                    "Hindari menambah utang baru"
                ],
                potential_impact="Mengurangi beban bunga dan memperbaiki rasio utang"
            ))
        
        # Goals advice
        if summary.active_goals > 0:
            advice.append(AIAdvice(
                title="Percepat Pencapaian Tujuan",
                category="goals",
                priority="medium",
                insight=f"Anda punya {summary.active_goals} tujuan finansial aktif. Konsistensi adalah kunci keberhasilan.",
                action_items=[
                    "Pastikan kontribusi rutin ke setiap tujuan",
                    "Investasikan di instrumen yang sesuai jangka waktu",
                    "Review progress bulanan"
                ],
                potential_impact="Mempercepat pencapaian tujuan finansial"
            ))
        
        # Spending advice
        if summary.top_categories:
            top_cat = summary.top_categories[0]
            advice.append(AIAdvice(
                title=f"Kurangi Pengeluaran {top_cat['category']}",
                category="spending",
                priority="medium",
                insight=f"Kategori {top_cat['category']} menyerap {top_cat.get('percentage', 0):.0f}% dari pengeluaran Anda.",
                action_items=[
                    "Identifikasi pola pengeluaran tidak perlu",
                    "Buat batas bulanan untuk kategori ini",
                    "Cari alternatif yang lebih hemat"
                ],
                potential_impact=f"Menghemat Rp {top_cat['total'] * 0.1:,.0f}/bulan jika dikurangi 10%"
            ))
        
        return advice
    
    def analyze_spending_pattern(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Analyze spending patterns using AI."""
        if not self.api_key:
            return self._analyze_pattern_fallback(transactions)
        
        prompt = f"""Analyze these transactions and identify patterns:
{json.dumps(transactions[:50], indent=2)}

Return JSON:
{{
  "patterns": [
    {{
      "name": "pattern name",
      "description": "description",
      "frequency": "daily|weekly|monthly",
      "estimated_monthly_cost": number
    }}
  ],
  "anomalies": ["unusual transaction 1", "..."],
  "recommendations": ["recommendation 1", "..."]
}}
"""
        
        response = self._call_gemini(prompt)
        if response:
            try:
                import re
                json_match = re.search(r'\{[\s\S]*\}', response)
                if json_match:
                    return json.loads(json_match.group())
            except:
                pass
        
        return self._analyze_pattern_fallback(transactions)
    
    def _analyze_pattern_fallback(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Fallback pattern analysis."""
        from collections import defaultdict
        
        category_totals = defaultdict(float)
        daily_totals = defaultdict(float)
        
        for t in transactions:
            if t.get("type") == "expense":
                cat = t.get("category", "Other")
                amount = abs(float(t.get("amount", 0)))
                category_totals[cat] += amount
                
                try:
                    day = datetime.strptime(t.get("date", ""), "%Y-%m-%d").strftime("%A")
                    daily_totals[day] += amount
                except:
                    pass
        
        return {
            "patterns": [
                {
                    "name": f"Top Spending: {max(category_totals, key=category_totals.get)}",
                    "description": f"Highest spending category at Rp {max(category_totals.values()):,.0f}/month",
                    "frequency": "monthly",
                    "estimated_monthly_cost": max(category_totals.values()) if category_totals else 0
                }
            ],
            "anomalies": [],
            "recommendations": [
                "Review spending in top categories weekly",
                "Set up alerts for unusual transactions",
                "Consider automating savings"
            ]
        }


# Global instance
ai_advisor = AIFinancialAdvisor()


def get_financial_summary(
    db: Session,
    user_id: int
) -> FinancialSummary:
    """Get financial summary for a user."""
    from app.models.account import Account
    from app.models.transaction import Transaction
    from app.models.goal import Goal
    from app.models.debt import Debt
    from app.core.database import engine
    from sqlalchemy import func, extract
    
    today = date.today()
    first_of_month = today.replace(day=1)
    
    # Get accounts balance
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    total_balance = sum(a.balance or 0 for a in accounts)
    
    # Get monthly transactions
    monthly = db.query(
        Transaction.type,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == user_id,
        Transaction.date >= first_of_month,
        Transaction.date <= today
    ).group_by(Transaction.type).all()
    
    monthly_income = sum(t.total for t in monthly if t.type == "income")
    monthly_expense = sum(abs(t.total) for t in monthly if t.type == "expense")
    
    savings_rate = ((monthly_income - monthly_expense) / monthly_income * 100) if monthly_income > 0 else 0
    
    # Get total debt
    debts = db.query(func.sum(Debt.current_balance)).filter(Debt.user_id == user_id).scalar()
    total_debt = debts or 0
    
    # Get goals
    goals = db.query(Goal).filter(Goal.user_id == user_id, Goal.status == "active").all()
    goal_progress = [
        {
            "name": g.name,
            "target": float(g.target_amount or 0),
            "saved": float(g.current_amount or 0),
            "progress": float(g.current_amount or 0) / float(g.target_amount or 1) * 100 if g.target_amount else 0
        }
        for g in goals
    ]
    
    # Get top categories
    categories = db.query(
        Transaction.category,
        func.sum(func.abs(Transaction.amount)).label("total")
    ).filter(
        Transaction.user_id == user_id,
        Transaction.type == "expense",
        Transaction.date >= first_of_month
    ).group_by(Transaction.category).order_by(func.sum(func.abs(Transaction.amount)).desc()).limit(5).all()
    
    top_categories = [
        {
            "category": c.category or "Other",
            "total": float(c.total),
            "percentage": float(c.total) / monthly_expense * 100 if monthly_expense > 0 else 0
        }
        for c in categories
    ]
    
    # Get recent transactions
    recent = db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).order_by(Transaction.date.desc()).limit(5).all()
    
    recent_transactions = [
        {
            "date": t.date.isoformat() if t.date else "",
            "description": t.description or "",
            "amount": float(t.amount or 0),
            "type": t.type or "expense",
            "category": t.category or "Other"
        }
        for t in recent
    ]
    
    return FinancialSummary(
        total_balance=total_balance,
        monthly_income=monthly_income,
        monthly_expense=monthly_expense,
        savings_rate=savings_rate,
        total_debt=total_debt,
        active_goals=len(goals),
        goal_progress=goal_progress,
        top_categories=top_categories,
        recent_transactions=recent_transactions
    )
