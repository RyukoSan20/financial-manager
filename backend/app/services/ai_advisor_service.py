"""AI Financial Advisor Service using Google Gemini API.

Free tier: 15 requests/minute, 1500 requests/day (gemini-1.5-flash)
No credit card required.
"""

import os
import json
import random
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime, date, timedelta
from dataclasses import dataclass, asdict
from sqlalchemy.orm import Session

# Gemini API Configuration - Multiple API Keys for higher limits
GEMINI_API_KEYS = [
    os.getenv("GEMINI_API_KEY_1", ""),
    os.getenv("GEMINI_API_KEY_2", ""),
    os.getenv("GEMINI_API_KEY_3", ""),
]
# Filter out empty keys
GEMINI_API_KEYS = [k for k in GEMINI_API_KEYS if k]

# Model configuration
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# Free tier limits
MAX_TOKENS = 8192
TEMPERATURE = 0.7

# Finance-related keywords for validation
FINANCE_KEYWORDS = [
    "uang", "keuangan", "tabungan", "pengeluaran", "pemasukan", "income", "expense",
    "budget", "anggaran", "hutang", "utang", "pinjaman", "kredit", "debt",
    "investasi", "reksadana", "saham", "deposito", "investment",
    "menabung", "menyimpan", "tabungan", "saving",
    "belanja", "beli", "belanja", "shopping", "spending",
    "gaji", "salary", "penghasilan", "pendapatan", "revenue",
    "transaksi", "transaction", "pembayaran", "payment",
    "card", "kartu", "kredit", "debit",
    "emoney", "e-money", "dana", "gopay", "ovo", "shopeepay",
    "crypto", "bitcoin", "ethereum", "token",
    "asuransi", "insurance", "bpjs", "pensiun",
    "pajak", "tax", "ppn", "perpajakan",
    "dana darurat", "emergency fund", "darurat",
    "financial", "finance", "finansial", "keuangan",
    "bank", "banking", "bank transfer", "transfer",
    "goals", "tujuan", "target", "milestone",
    "balance", "saldo", "rekening", "account",
    "interest", "bunga", "dividen", "return",
    "cash", "tunai", "cashflow", "arus kas",
    "net worth", "kekayaan", "asset", "liabilitas",
]

# Default questions for users
DEFAULT_QUESTIONS = [
    "Berapa total saldo saya saat ini?",
    "Bagaimana saya bisa menabung lebih banyak bulan ini?",
    "Apa saja pengeluaran terbesar saya bulan ini?",
    "Berapa tingkat tabungan saya sekarang?",
    "Bagaimana tips mengelola keuangan pribadi?",
    "Apakah saya sudah di jalur untuk mencapai tujuan finansial saya?",
    "Bagaimana cara menurunkan pengeluaran saya?",
    "Berapa banyak yang harus saya tabung untuk dana darurat?",
    "Apa saja kategori pengeluaran saya yang terbesar?",
    "Bagaimana cara membuat anggaran bulanan yang efektif?",
]

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
    user_name: str = ""
    currency: str = "IDR"


@dataclass
class AIAdvice:
    """AI-generated financial advice."""
    title: str
    category: str  # "savings", "spending", "investment", "debt", "goals"
    priority: str  # "high", "medium", "low"
    insight: str
    action_items: List[str]
    potential_impact: str


def is_finance_related(question: str) -> bool:
    """Check if question is related to personal finance."""
    question_lower = question.lower()
    for keyword in FINANCE_KEYWORDS:
        if keyword.lower() in question_lower:
            return True
    return False


def get_random_api_key() -> Optional[str]:
    """Get random API key for load balancing."""
    if GEMINI_API_KEYS:
        return random.choice(GEMINI_API_KEYS)
    return None


class AIFinancialAdvisor:
    """AI-powered financial advisor using Gemini."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.session = requests.Session() if not api_key else None
    
    def _call_gemini(self, prompt: str) -> Optional[str]:
        """Make API call to Gemini with random key selection."""
        api_key = self.api_key or get_random_api_key()
        if not api_key:
            return None
        
        try:
            url = f"{GEMINI_API_URL}?key={api_key}"
            
            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "temperature": TEMPERATURE,
                    "maxOutputTokens": MAX_TOKENS,
                }
            }
            
            response = requests.post(
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
        user_info = f"Nama pengguna: {summary.user_name}" if summary.user_name else "Pengguna baru"
        
        return f"""Kamu adalah konselor keuangan profesional yang spesialisasi dalam keuangan pribadi untuk pengguna Indonesia.

{user_info}

SITUASI KEUANGAN SAAT INI:
- Total Saldo: Rp {summary.total_balance:,.0f}
- Pendapatan Bulanan: Rp {summary.monthly_income:,.0f}
- Pengeluaran Bulanan: Rp {summary.monthly_expense:,.0f}
- Tingkat Tabungan: {summary.savings_rate:.1f}%
- Total Utang: Rp {summary.total_debt:,.0f}
- Tujuan Aktif: {summary.active_goals}

KATEGORI PENGELUARAN TERBESAR:
{chr(10).join([f"- {cat['category']}: Rp {cat['total']:,.0f}" for cat in summary.top_categories[:5]])}

PROGRES TUJUAN:
{chr(10).join([f"- {g['name']}: {g['progress']:.0f}% selesai (Rp {g['saved']:,.0f} dari Rp {g['target']:,.0f})" for g in summary.goal_progress[:3]])}

TRANSAKSI TERAKHIR:
{chr(10).join([f"- {t['date']}: {t['description']} - Rp {abs(t['amount']):,.0f} ({t['type']})" for t in summary.recent_transactions[:5]])}

Instruksi Penting:
1. Jawab SELALU dalam Bahasa Indonesia
2. Fokus hanya pada topik keuangan pribadi
3. Berikan jawaban yang spesifik dan actionable
4. Gunakan angka konkret dari data di atas
5. Jika pertanyaan di luar topik keuangan, jawab dengan sopan bahwa kamu hanya bisa membantu topik keuangan

Format jawaban JSON:
{{
  "response": "Jawaban lengkap dalam Bahasa Indonesia...",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "is_finance_related": true
}}
"""

    def chat(self, message: str, summary: FinancialSummary) -> Dict[str, Any]:
        """Chat with AI about finances."""
        # Check if message is finance related
        if not is_finance_related(message):
            return {
                "response": f"Maaf, saya adalah asisten keuangan pribadi yang hanya bisa membantu pertanyaan seputar keuangan. Topik seperti '{message[:50]}...' tidak dalam keahlian saya.\n\nSaya bisa membantu pertanyaan tentang:\n- 💰 Saldo dan keuangan Anda\n- 📊 Pengeluaran dan pemasukan\n- 🎯 Tujuan finansial\n- 💳 Utang dan kredit\n- 📈 Investasi dan tabungan\n- 📋 Anggaran bulanan\n\nSilakan ajukan pertanyaan tentang keuangan Anda!",
                "suggestions": DEFAULT_QUESTIONS[:3],
                "is_finance_related": False
            }
        
        # Build context with user data
        context = self.build_context(summary)
        
        prompt = f"""{context}

PERTANYAAN PENGGUNA:
{message}

Jawab pertanyaan di atas berdasarkan data keuangan pengguna. Berikan jawaban yang spesifik, actionable, dan dalam Bahasa Indonesia. Jika pertanyaan memerlukan data yang tidak ada, sampaikan dengan sopan dan tawarkan bantuan lain.
"""
        
        response = self._call_gemini(prompt)
        
        if response:
            try:
                import re
                json_match = re.search(r'\{[\s\S]*\}', response)
                if json_match:
                    data = json.loads(json_match.group())
                    return {
                        "response": data.get("response", response[:500]),
                        "suggestions": data.get("suggestions", DEFAULT_QUESTIONS[:3]),
                        "is_finance_related": True
                    }
            except (json.JSONDecodeError, KeyError) as e:
                print(f"Failed to parse Gemini response: {e}")
        
        # Fallback response
        return self._get_fallback_chat(message, summary)

    def _get_fallback_chat(self, message: str, summary: FinancialSummary) -> Dict[str, Any]:
        """Fallback chat when API is unavailable."""
        message_lower = message.lower()
        
        # Simple keyword-based responses
        if any(k in message_lower for k in ["saldo", "balance", "berapa"]):
            response = f"Total saldo Anda saat ini adalah **Rp {summary.total_balance:,.0f}**. Saldo ini berasal dari {len(summary.recent_transactions)} transaksi terakhir."
        elif any(k in message_lower for k in ["tabung", "saving", "menabung"]):
            response = f"Tingkat tabungan Anda saat ini {summary.savings_rate:.1f}%. "
            if summary.savings_rate < 20:
                response += "Idealnya, tingkat tabungan minimal 20% dari pendapatan. Tips menabung: 1) Otomatiskan transfer ke rekening tabungan, 2) Pakai metode 50/30/20, 3) Catat setiap pengeluaran."
            else:
                response += "Luar biasa! Anda sudah di jalur yang tepat. Pertahankan kebiasaan ini!"
        elif any(k in message_lower for k in ["pengeluaran", "expense", "belanja", "spending"]):
            response = f"Pengeluaran bulanan Anda Rp {summary.monthly_expense:,.0f}. "
            if summary.top_categories:
                top = summary.top_categories[0]
                response += f"Kategori terbesar adalah **{top['category']}** sebesar Rp {top['total']:,.0f}."
        elif any(k in message_lower for k in ["utang", "hutang", "debt", "kredit"]):
            response = f"Total utang Anda Rp {summary.total_debt:,.0f}. "
            if summary.total_debt > 0:
                response += "Tips melunasi utang: 1) Fokus bayar utang dengan bunga tertinggi dulu (metode avalanche), 2) Jangan menambah utang baru, 3) Alokasikan minimal 20% pendapatan untuk bayar utang."
            else:
                response += "Luar biasa! Anda tidak memiliki utang. Alokasikan dana ini untuk investasi!"
        elif any(k in message_lower for k in ["tujuan", "goals", "target", "milestone"]):
            response = f"Anda memiliki {summary.active_goals} tujuan finansial aktif. "
            if summary.goal_progress:
                for g in summary.goal_progress[:2]:
                    response += f"\n• {g['name']}: {g['progress']:.0f}% selesai"
        elif any(k in message_lower for k in ["tips", "advice", "saran", "cara"]):
            response = """Berikut tips keuangan penting:

1. **Dana Darurat**: Sisihkan 3-6 bulan pengeluaran sebagai dana darurat
2. **Asuransi**: Pastikan ada perlindungan kesehatan dan jiwa
3. **Investasi**: Mulai investasi sejak dini dengan instrumen sesuai profil risiko
4. **Anggaran**: Buat anggaran bulanan dan patuhi
5. **Hutang**: Hindari hutang konsumtif, lunasi kartu kredit penuh setiap bulan"""
        else:
            response = f"Terima kasih atas pertanyaan Anda. Saat ini Anda memiliki:\n\n• Saldo: Rp {summary.total_balance:,.0f}\n• Pendapatan: Rp {summary.monthly_income:,.0f}\n• Pengeluaran: Rp {summary.monthly_expense:,.0f}\n• Tabungan: {summary.savings_rate:.1f}%\n\nSilakan tanyakan lebih spesifik tentang keuangan Anda!"
        
        return {
            "response": response,
            "suggestions": DEFAULT_QUESTIONS[:3],
            "is_finance_related": True
        }

    def get_advice(self, summary: FinancialSummary) -> List[AIAdvice]:
        """Get personalized financial advice."""
        if not (self.api_key or GEMINI_API_KEYS):
            return self._get_fallback_advice(summary)
        
        context = self.build_context(summary)
        response = self._call_gemini(context)
        
        if response:
            try:
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
        if not (self.api_key or GEMINI_API_KEYS):
            return self._analyze_pattern_fallback(transactions)
        
        prompt = f"""Analisis transaksi ini dan identifikasi pola:
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
    
    # Get user info
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    user_name = user.username or user.full_name or user.email.split('@')[0] if user else "User"
    
    # Get accounts balance
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    total_balance = sum(float(a.balance or 0) for a in accounts)
    
    # Get monthly transactions
    monthly = db.query(
        Transaction.type,
        func.sum(func.abs(Transaction.amount)).label("total")
    ).filter(
        Transaction.user_id == user_id,
        Transaction.date >= first_of_month,
        Transaction.date <= today,
        Transaction.type.in_(["income", "expense"])
    ).group_by(Transaction.type).all()
    
    monthly_income = 0
    monthly_expense = 0
    for t in monthly:
        if t.type == "income":
            monthly_income = float(t.total or 0)
        elif t.type == "expense":
            monthly_expense = float(t.total or 0)
    
    savings_rate = ((monthly_income - monthly_expense) / monthly_income * 100) if monthly_income > 0 else 0
    
    # Get total debt
    debts = db.query(func.sum(Debt.current_balance)).filter(Debt.user_id == user_id).scalar()
    total_debt = float(debts or 0)
    
    # Get goals
    goals = db.query(Goal).filter(Goal.user_id == user_id, Goal.is_active == True).all()
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
            "category": c[0] if c[0] else "Other",
            "total": float(c[1]),
            "percentage": float(c[1]) / monthly_expense * 100 if monthly_expense > 0 else 0
        }
        for c in categories
    ]
    
    # Get recent transactions
    recent = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.is_deleted == False
    ).order_by(Transaction.date.desc()).limit(5).all()
    
    recent_transactions = [
        {
            "date": t.date.isoformat() if t.date else "",
            "description": t.description or "",
            "amount": float(t.amount or 0),
            "type": t.type or "expense",
            "category": str(t.category) if t.category else "Other"
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
        recent_transactions=recent_transactions,
        user_name=user_name,
        currency="IDR"
    )
