"""AI Financial Advisor API routes."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import json
import asyncio
import re
import logging
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user_optional, get_current_user
from app.models.user import User
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.category import Category
from app.services.ai_advisor_service import (
    ai_advisor,
    get_financial_summary,
    AIAdvice
)

logger = logging.getLogger(__name__)

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
    
    # The messages that came before, so the answer can refer to them.
    history = [
        h for h in (message.get("history") or [])
        if isinstance(h, dict) and h.get("content")
    ][-8:]
    
    # Use the new chat method with full context
    result = ai_advisor.chat(user_message, summary, history=history)
    
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


# === AI Action Execution ===

class ExecuteRequest(BaseModel):
    message: str
    # The messages that came before, so the answer can refer to them.
    history: List[dict] = []

class ActionResult(BaseModel):
    success: bool
    action: str
    data: Optional[dict] = None
    message: str


# === AI Agent ===

class AgentRequest(BaseModel):
    message: str
    # When true the plan is only built, not executed. The client uses this
    # to show the user what will happen before anything is written.
    plan_only: bool = False
    # The messages that came before, used as context for the reply.
    history: List[dict] = []


class AgentResponse(BaseModel):
    success: bool
    intent: str
    confidence: float
    reply: str
    plan: Optional[dict] = None
    actions: List[dict] = []
    needs_confirmation: bool = False
    data: Optional[dict] = None
    message: str = ""


def _agent_reply(plan, executed: bool) -> str:
    """Turn the outcome of the plan into a sentence for the user."""
    if not executed:
        descriptions = ", ".join(a.description for a in plan.actions if a.description)
        return (
            f"Baik, saya bisa melakukan ini: {descriptions}. "
            "Konfirmasi ya untuk saya jalankan."
        )

    done = [a for a in plan.actions if a.success]
    failed = [a for a in plan.actions if not a.success]

    if done:
        if len(done) > 1:
            # Several requests in one message: list what was done, so
            # the user can see each one was handled.
            reply = "\n".join(
                f"{i}. {a.description}" for i, a in enumerate(done, 1)
                if a.description
            )
        else:
            reply = " ".join(a.description for a in done if a.description)
    else:
        reply = ""

    # A plan carries a lot of detail. The description is the short
    # version, so the breakdown is appended here.
    for action in done:
        result = action.result or {}
        if action.kind != "build_plan" or not isinstance(result, dict):
            continue

        note = result.get("note")
        if note:
            reply = (reply + " " if reply else "") + note

        budgets = result.get("budgets") or []
        goals = result.get("goals") or []
        if budgets:
            lines = [
                f"  - {b['name']}: Rp{float(b['amount']):,.0f}"
                for b in budgets
            ]
            # The figures are monthly, but the period they cover is not
            # always a month. A two year plan says so.
            months = result.get("months")
            period = result.get("period")
            if period == "yearly" or (months or 0) >= 12:
                months_total = months or 12
                years, leftover = divmod(months_total, 12)
                if leftover:
                    span = f"{years} tahun {leftover} bulan"
                else:
                    span = f"{years} tahun" if years != 1 else "1 tahun"
                heading = f"Anggaran per bulan, periode {span}:"
            else:
                heading = "Anggaran bulanan:"
            reply += "\n\n" + heading + "\n" + "\n".join(lines)
        if goals:
            lines = [
                f"  - {g['name']}: Rp{float(g['amount']):,.0f} "
                f"target {g.get('target_date', '')}"
                for g in goals
            ]
            reply += "\n\nTarget:\n" + "\n".join(lines)

    if failed:
        reason = failed[0].error or "tidak diketahui"
        reply = (reply + " " if reply else "") + f"Ada bagian yang gagal: {reason}."

    if not reply:
        reply = "Selesai."

    return reply.strip()


@router.post("/agent", response_model=AgentResponse)
def ai_agent(
    request: AgentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    The financial agent.

    Unlike the old `/execute` endpoint, this one understands the *intent*
    of the message before acting. "tambah 15000 kopi" adds a transaction,
    "bagi saldo 50% belanja 30% tabungan" creates budgets, and "berapa
    budget saya" only reports information - it never changes anything.
    """
    message = (request.message or "").strip()
    if not message:
        return AgentResponse(
            success=False,
            intent="unknown",
            confidence=0.0,
            reply="Pesan kosong. Apa yang ingin Anda lakukan?",
            message="Pesan kosong",
        )

    from app.services.ai_agent_executor import build_plan, execute_plan

    # The messages that came before, so the answer can refer to them.
    history = [
        h for h in (request.history or [])
        if isinstance(h, dict) and h.get("content")
    ][-8:]

    plan = build_plan(db, current_user.id, message)

    # A message can hold several requests. When every one of them is a
    # read, they all run and the answers are joined. There is nothing
    # to confirm, because nothing changes.
    if plan.is_multi and plan.actions and all(
        a.kind.startswith("query_") for a in plan.actions
    ):
        from app.services.ai_agent_executor import AgentExecutor, execute_plan

        plan = execute_plan(db, current_user.id, plan, message, history)
        try:
            db.commit()
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            logger.warning(f"Agent read commit failed: {exc}")

        parts = [
            a.description for a in plan.actions
            if a.description and a.success
        ]
        reply = "\n\n".join(parts) if parts else "Tidak ada data."

        return AgentResponse(
            success=True,
            intent=plan.intent,
            confidence=plan.confidence,
            reply=reply,
            plan=plan.to_dict(),
            actions=[a.to_dict() for a in plan.actions],
            needs_confirmation=False,
            data=[a.result for a in plan.actions if a.result],
            message=reply,
        )

    # A query only reads. It must never look like a pending write, and its
    # result has to be the answer the user sees - not a "konfirmasi ya"
    # prompt for something that changes nothing.
    if plan.intent in ("query", "query_advice") and plan.actions:
        from app.services.ai_agent_executor import AgentExecutor, execute_plan

        plan = execute_plan(db, current_user.id, plan, message, history)
        try:
            db.commit()
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            logger.warning(f"Agent read commit failed: {exc}")

        reply = plan.actions[0].description if plan.actions else "Tidak ada data."
        return AgentResponse(
            success=True,
            intent=plan.intent,
            confidence=plan.confidence,
            reply=reply,
            plan=plan.to_dict(),
            actions=[a.to_dict() for a in plan.actions],
            needs_confirmation=False,
            data=(plan.actions[0].result if plan.actions else None),
            message=reply,
        )

    # Nothing to do: fall back to the advisor for an informative answer.
    if not plan.actions:
        from app.services.ai_advisor_service import (
            ai_advisor,
            get_financial_summary,
        )

        try:
            summary = get_financial_summary(db, current_user.id)
            chat_result = ai_advisor.chat(message, summary, history=history)
            reply = chat_result.get("response") or ""
            if not reply:
                raise RuntimeError("advisor returned an empty reply")
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Advisor fallback failed: {exc}")
            reply = (
                "Saya belum yakin maksud Anda. Coba jelaskan seperti: "
                "'tambah 15000 kopi', 'set budget makan 500000 per bulan', "
                "atau 'bagi saldo 50% belanja 30% tabungan'."
            )
        return AgentResponse(
            success=True,
            intent=plan.intent,
            confidence=plan.confidence,
            reply=reply,
            plan=plan.to_dict(),
            message=reply,
        )

    if request.plan_only:
        plan.needs_confirmation = True
        reply = _agent_reply(plan, executed=False)
        return AgentResponse(
            success=True,
            intent=plan.intent,
            confidence=plan.confidence,
            reply=reply,
            plan=plan.to_dict(),
            actions=[a.to_dict() for a in plan.actions],
            needs_confirmation=True,
            message=reply,
        )

    plan = execute_plan(db, current_user.id, plan, message, history)
    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.exception("Agent commit failed")
        return AgentResponse(
            success=False,
            intent=plan.intent,
            confidence=plan.confidence,
            reply=f"Perubahan tidak bisa disimpan: {exc}",
            plan=plan.to_dict(),
            message=str(exc),
        )

    reply = _agent_reply(plan, executed=True)
    first = plan.actions[0] if plan.actions else None
    return AgentResponse(
        success=bool(first and first.success),
        intent=plan.intent,
        confidence=plan.confidence,
        reply=reply,
        plan=plan.to_dict(),
        actions=[a.to_dict() for a in plan.actions],
        data=first.result if first else None,
        message=reply,
    )


@router.post("/execute", response_model=ActionResult)
def execute_ai_action(
    request: ExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kept for backwards compatibility.

    The real agent lives at `/ai-advisor/agent`. This endpoint now simply
    forwards to it, so old clients get the better behaviour.
    """
    from app.services.ai_agent_executor import build_plan, execute_plan

    message = (request.message or "").strip()
    history = [
        h for h in (request.history or [])
        if isinstance(h, dict) and h.get("content")
    ][-8:]
    plan = build_plan(db, current_user.id, message)

    if not plan.actions:
        return ActionResult(
            success=False,
            action="none",
            data={"intent": plan.intent, "confidence": plan.confidence},
            message=(
                "Tidak dapat mengenali aksi. Contoh: 'tambah 15000 kopi', "
                "'set budget makan 500000 per bulan', "
                "'bagi saldo 50% belanja 30% tabungan'."
            ),
        )

    plan = execute_plan(db, current_user.id, plan, message, history)
    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return ActionResult(
            success=False,
            action=plan.actions[0].kind,
            message=f"Gagal menyimpan: {exc}",
        )

    action = plan.actions[0]
    return ActionResult(
        success=action.success,
        action=action.kind,
        data=action.result,
        message=action.description or (action.error or "Selesai"),
    )
