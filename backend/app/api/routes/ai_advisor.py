"""AI Financial Advisor API routes."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import json
import asyncio

from app.core.database import get_db
from app.core.security import get_current_user_optional, get_current_user
from app.models.user import User
from app.services.ai_advisor_service import (
    ai_advisor,
    get_financial_summary,
    AIAdvice
)

router = APIRouter(tags=["AI Advisor"])


# === Pydantic Models ===

class ActionItem(BaseModel):
    action: str

class AdviceResponse(BaseModel):
    title: str
    category: str
    priority: str
    insight: str
    action_items: List[str]
    potential_impact: str

class FinancialSummaryResponse(BaseModel):
    total_balance: float
    monthly_income: float
    monthly_expense: float
    savings_rate: float
    total_debt: float
    active_goals: int
    top_categories: List[dict]
    goal_progress: List[dict]
    recent_transactions: List[dict]

class PatternAnalysis(BaseModel):
    patterns: List[dict]
    anomalies: List[str]
    recommendations: List[str]


# === API Endpoints ===

@router.get("/advice", response_model=List[AdviceResponse])
def get_ai_advice(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get personalized AI financial advice.
    
    Uses Gemini API if GEMINI_API_KEY is set, otherwise returns rule-based fallback.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get financial summary
    summary = get_financial_summary(db, current_user.id)
    
    # Get AI advice
    advice_list = ai_advisor.get_advice(summary)
    
    return [
        AdviceResponse(
            title=a.title,
            category=str(a.category) if a.category else "Other",
            priority=a.priority,
            insight=a.insight,
            action_items=a.action_items,
            potential_impact=a.potential_impact
        )
        for a in advice_list
    ]


@router.get("/summary", response_model=FinancialSummaryResponse)
def get_financial_summary_api(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current financial summary for AI context.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    summary = get_financial_summary(db, current_user.id)
    
    return FinancialSummaryResponse(
        total_balance=summary.total_balance,
        monthly_income=summary.monthly_income,
        monthly_expense=summary.monthly_expense,
        savings_rate=summary.savings_rate,
        total_debt=summary.total_debt,
        active_goals=summary.active_goals,
        top_categories=summary.top_categories,
        goal_progress=summary.goal_progress,
        recent_transactions=summary.recent_transactions
    )


@router.post("/analyze-patterns", response_model=PatternAnalysis)
def analyze_spending_patterns(
    transactions: List[dict],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze spending patterns using AI.
    
    Accepts array of transactions and returns pattern analysis.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if len(transactions) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 transactions")
    
    analysis = ai_advisor.analyze_spending_pattern(transactions)
    
    return PatternAnalysis(
        patterns=analysis.get("patterns", []),
        anomalies=analysis.get("anomalies", []),
        recommendations=analysis.get("recommendations", [])
    )


@router.post("/chat")
def chat_with_advisor(
    message: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Chat with AI financial advisor.
    
    Accepts: { "message": "user question" }
    Returns: { "response": "ai response" }
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_message = message.get("message", "")
    
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    if len(user_message) > 500:
        raise HTTPException(status_code=400, detail="Message too long (max 500 chars)")
    
    # Get financial context
    summary = get_financial_summary(db, current_user.id)
    
    # Use the new chat method with full context
    result = ai_advisor.chat(user_message, summary)
    
    return result


@router.post("/chat/stream")
async def chat_stream(
    message: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stream AI chat response for real-time feel.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_message = message.get("message", "")
    
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    if len(user_message) > 500:
        raise HTTPException(status_code=400, detail="Message too long (max 500 chars)")
    
    # Get financial context
    summary = get_financial_summary(db, current_user.id)
    topic = message.get("topic", "free")
    
    # Build user context for AI
    user_context = f"""DATA KEUANGAN PENGGUNA:
- Saldo: Rp {summary.get('total_balance', 0):,.0f}
- Total Pendapatan: Rp {summary.get('total_income', 0):,.0f}
- Total Pengeluaran: Rp {summary.get('total_expense', 0):,.0f}
- Tabungan: {summary.get('savings_rate', 0):.1f}%
- Jumlah Tujuan Aktif: {summary.get('active_goals', 0)}
- Total Utang: Rp {summary.get('total_debt', 0):,.0f}
"""
    
    # Topic-aware system prompts
    topic_prompts = {
        "news": "Anda adalah konsultan berita keuangan yang memberikan informasi terkini tentang ekonomi dan finansial. FOKUS pada berita dan tren terbaru, bukan ringkasan data user. Selalu jawab dalam Bahasa Indonesia yang engaging.",
        "future": "Anda adalah perencana keuangan jangka panjang. Bantu user dengan proyeksi dan perencanaan masa depan mereka. Selalu jawab dalam Bahasa Indonesia.",
        "balance": "Anda adalah konsultan life-finance. Bantu menyeimbangkan keuangan dengan usia, karier, dan gaya hidup. Selalu jawab dalam Bahasa Indonesia.",
        "debt": "Anda adalah spesialis manajemen utang. Berikan strategi pembayaran utang yang optimal. Selalu jawab dalam Bahasa Indonesia.",
        "invest": "Anda adalah penasihat investasi. Berikan rekomendasi diversifikasi portofolio. Selalu jawab dalam Bahasa Indonesia.",
        "budget": "Anda adalah ahli budgeting. Rekomendasikan teknik budgeting terbaik. Selalu jawab dalam Bahasa Indonesia.",
        "emergency": "Anda adalah konsultan proteksi finansial. Selalu jawab dalam Bahasa Indonesia.",
        "free": "Anda adalah asisten keuangan personal yang helpful dan friendly. Selalu jawab dalam Bahasa Indonesia."
    }
    system_prompt = topic_prompts.get(topic, topic_prompts["free"])
    
    # Inject topic into context
    topic_intros = {
        "news": "📰 TOPIK: BERITA FINANSIAL\nBerikan berita dan tren ekonomi terkini yang relevan untuk keuangan personal di Indonesia. ",
        "future": "🎯 TOPIK: PROYEKSI MASA DEPAN\nBantu perencanaan keuangan jangka panjang dan tujuan-tujuan besar. ",
        "balance": "⚖️ TOPIK: LIFE-FINANCE BALANCE\nAnalisis keseimbangan antara usia, karier, dan gaya hidup. ",
        "debt": "💳 TOPIK: STRATEGI UTANG\nBerikan strategi optimal untuk mengelola dan melunasi utang. ",
        "invest": "📈 TOPIK: STRATEGI INVESTASI\nRekomendasikan diversifikasi portofolio investasi. ",
        "budget": "📊 TOPIK: TEKNIK BUDGETING\nRekomendasikan dan bantu implementasi sistem budgeting. ",
        "emergency": "🛡️ TOPIK: DANA DARURAT & ASURANSI\nBantu perhitungan proteksi finansial. ",
        "free": ""
    }
    topic_intro = topic_intros.get(topic, "")
    
    async def generate():
        # Send typing indicator
        yield f"data: {json.dumps({'type': 'start', 'message': 'Mengetik...'})}\n\n"
        await asyncio.sleep(0.5)
        
        # Get full response
        enhanced_context = f"{topic_intro}{user_context}"
        result = ai_advisor.chat(user_message, summary, system_prompt)
        response_text = result.get("response", "")
        
        # Stream word by word for real-time feel
        words = response_text.split(" ")
        for i, word in enumerate(words):
            chunk = " ".join(words[:i+1])
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            await asyncio.sleep(0.05)  # 50ms delay between words
        
        # Send complete
        yield f"data: {json.dumps({'type': 'done', 'content': response_text})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/tips")
def get_financial_tips(
    category: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get general financial tips.
    
    Categories: savings, spending, investment, debt, goals, emergency
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    tips = {
        "savings": [
            "Tabung minimal 20% dari penghasilan setiap bulan",
            "Otomatiskan tabungan agar tidak tergoda membelanjakannya",
            "Pisahkan rekening untuk kebutuhan, keinginan, dan tabungan",
            "Mulai emergency fund sebelum investasi",
            "Review pengeluaran bulanan untuk temukan cel penghematan"
        ],
        "spending": [
            "Buat anggaran bulanan dan patuhi batasnya",
            "Gunakan metode 50/30/20: 50% kebutuhan, 30% keinginan, 20% tabungan",
            "Hindari belanja impulsif dengan aturan 24 jam tunggu",
            "Masak di rumah lebih sering untuk hemat pengeluaran",
            "Gunakan aplikasi pembanding harga sebelum membeli"
        ],
        "investment": [
            "Diversifikasi portfolio: saham, obligasi, reksa dana",
            "Investasi jangka panjang untuk hasil optimal",
            "Jangan investasikan uang yang butuh untuk kebutuhan pokok",
            "Pertimbangkan reksa dana untuk pemula",
            "Revisi portfolio annually atau saat situasi berubah"
        ],
        "debt": [
            "Prioritaskan bayar utang dengan bunga tertinggi",
            "Janganambah utang baru saat sedang melunasi utang",
            "Metode avalanche: fokus utang bunga tertinggi",
            "Metode snowball: fokus utang saldo terkecil",
            "Negosiasi bunga dengan bank jika memungkinkan"
        ],
        "goals": [
            "Tentukan tujuan yang spesifik dan terukur",
            "Hitung kebutuhan monthly untuk capai tujuan",
            "Pilih instrumen investasi sesuai jangka waktu",
            "Review progress quarterly",
            "Jangan tariktabungan untuk tujuan sebelum expiry"
        ],
        "emergency": [
            "Siapkan dana darurat 3-6 bulan pengeluaran",
            "Simpan di rekening terpisah yang mudah diakses",
            "Hanya gunakan untuk kondisi darurat nyata",
            "Isi ulang segera setelah digunakan",
            "Pertimbangkan asuransi untuk proteksi tambahan"
        ]
    }
    
    if category and category in tips:
        return {"category": category, "tips": tips[category]}
    
    return {"tips": tips, "categories": list(tips.keys())}
