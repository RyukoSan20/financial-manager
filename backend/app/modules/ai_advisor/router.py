"""
AI Advisor Router - Streaming chat endpoint and insights.
Provides conversational AI financial advisor with function calling.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, AsyncGenerator
from datetime import datetime
import json
import asyncio

from app.core.security import get_current_user
from app.core.audit_logger import log_action, AuditAction
from app.services.metrics import total_balance
from app.modules.ai_advisor.context_engine.pii_scrubber import pii_scrubber
from app.modules.ai_advisor.llm_orchestrator.client import get_ai_client, FunctionRegistry

router = APIRouter(prefix="/api/ai", tags=["AI Advisor"])


# ============ REQUEST/RESPONSE SCHEMAS ============

class ChatMessage(BaseModel):
    """Single chat message."""
    role: str = Field(..., description="User or assistant")
    content: str
    timestamp: Optional[datetime] = None


class ChatRequest(BaseModel):
    """Chat request body."""
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
    """Single chat response."""
    text: str
    sources: Optional[List[dict]] = None
    suggestions: Optional[List[str]] = None


# ============ SYSTEM PROMPTS ============

SYSTEM_PROMPT = """Anda adalah FinAdvisor - asisten keuangan pribadi AI yang membantu pengguna Indonesia mengelola keuangan mereka dengan bijak.

Konteks Anda:
- Mata uang: Rupiah Indonesia (IDR)
- Bahasa: Bahasa Indonesia (dapat merespons dalam Bahasa Inggris jika diperlukan)
- Region: Indonesia dengan konteks UMK/UMR lokal

Kemampuan Anda:
1. Menganalisis pola pengeluaran
2. Memberikan saran budget (metode 50/30/20 atau kustom)
3. Menghitung progres tujuan keuangan
4. Mengevaluasi kesehatan finansial (skor 1-100)
5. Memberikan saran investasi sesuai profil risiko

Selalu berikan saran yang:
- Praktis dan dapat langsung diterapkan
- Disesuaikan dengan kondisi keuangan pengguna
- Disertai angka konkret (jika data tersedia)
- Berbahasa Indonesia yang mudah dipahami

PENTING: Jangan pernah membagikan nomor rekening, NIK, atau data PII lainnya dalam respons Anda.
"""


# ============ CHAT ENDPOINTS ============

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user = Depends(get_current_user)
):
    """
    Non-streaming chat endpoint.
    Send a message and receive an AI response.
    """
    user_id = current_user.id if hasattr(current_user, "id") else current_user.get("id")
    
    # Log AI query
    log_action(
        AuditAction.AI_QUERY,
        user_id=user_id,
        metadata={"message_length": len(request.message)}
    )
    
    # Scrub PII from user message
    clean_message = pii_scrubber.scrub(request.message)
    
    # Get AI client
    ai_client = get_ai_client()
    
    # Get function registry for this user
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        function_registry = FunctionRegistry(db=db, user_id=user_id)
        
        # Build context from user data
        context = await _build_user_context(db, user_id)
        
        # Combine system prompt with user context
        full_prompt = f"""
Konteks Keuangan Pengguna:
{context}

Pertanyaan pengguna: {clean_message}

Harap berikan saran yang spesifik berdasarkan data di atas.
"""
        
        # Generate response with function calling
        response = await ai_client.generate(
            prompt=full_prompt,
            system_prompt=SYSTEM_PROMPT,
            functions=function_registry.get_declarations(),
            temperature=0.7
        )
        
        return ChatResponse(
            text=response.text,
            suggestions=_generate_suggestions(response.text)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user = Depends(get_current_user)
):
    """
    Streaming chat endpoint using Server-Sent Events (SSE).
    Returns AI response as a stream for real-time display.
    """
    user_id = current_user.id if hasattr(current_user, "id") else current_user.get("id")
    
    # Log AI query
    log_action(
        AuditAction.AI_QUERY,
        user_id=user_id,
        metadata={"message_length": len(request.message), "streaming": True}
    )
    
    # Scrub PII
    clean_message = pii_scrubber.scrub(request.message)
    
    return StreamingResponse(
        _stream_chat_response(clean_message, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


async def _stream_chat_response(message: str, user_id: int) -> AsyncGenerator[str, None]:
    """Generate streaming response."""
    from app.core.database import SessionLocal
    
    ai_client = get_ai_client()
    db = SessionLocal()
    
    try:
        function_registry = FunctionRegistry(db=db, user_id=user_id)
        context = await _build_user_context(db, user_id)
        
        full_prompt = f"""
Konteks Keuangan Pengguna:
{context}

Pertanyaan pengguna: {message}
"""
        
        # Stream response
        full_response = ""
        async for chunk in ai_client.generate_stream(
            prompt=full_prompt,
            system_prompt=SYSTEM_PROMPT,
            functions=function_registry.get_declarations()
        ):
            full_response += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        
        # Send completion
        yield f"data: {json.dumps({'done': True, 'full_text': full_response})}\n\n"
        
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    finally:
        db.close()


async def _build_user_context(db, user_id: int) -> str:
    """Build financial context for AI prompt."""
    from datetime import date
    from app.models.account import Account
    from app.models.transaction import Transaction
    from app.models.budget import Budget
    from app.models.goal import Goal
    from app.models.debt import Debt
    from sqlalchemy import func
    
    today = date.today()
    start_of_month = today.replace(day=1)
    
    # Get accounts
    accounts = db.query(Account).filter(
        Account.user_id == user_id,
        Account.is_active == True
    ).all()
    
    balance = await total_balance(db, user_id)
    account_total = balance["total"]
    
    # Get monthly income/expense
    monthly_income = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id,
        Transaction.type == "income",
        Transaction.date >= start_of_month
    ).scalar() or 0
    
    monthly_expense = db.query(
        func.sum(func.abs(Transaction.amount))
    ).filter(
        Transaction.user_id == user_id,
        Transaction.type == "expense",
        Transaction.date >= start_of_month
    ).scalar() or 0
    
    # Get budgets
    budgets = db.query(Budget).filter(
        Budget.user_id == user_id,
        Budget.is_active == True
    ).all()
    
    # Get goals
    goals = db.query(Goal).filter(
        Goal.user_id == user_id,
        Goal.is_active == True
    ).all()
    
    # Get debts
    debts = db.query(Debt).filter(
        Debt.user_id == user_id,
        Debt.is_active == True
    ).all()
    total_debt = sum(float(d.current_balance or 0) for d in debts)
    
    # Build context string
    context = f"""
📊 RINGKASAN KEUANGAN BULAN INI:
- Total Saldo: Rp {account_total:,.0f}
- Pemasukan: Rp {float(monthly_income):,.0f}
- Pengeluaran: Rp {float(monthly_expense):,.0f}
- Tabungan: Rp {float(monthly_income) - float(monthly_expense):,.0f}

📈 AKUN ({len(accounts)}):
{chr(10).join(f"- {a.name}: Rp {float(a.balance or 0):,.0f}" for a in accounts[:5])}

📋 BUDGET AKTIF ({len(budgets)}):
{chr(10).join(f"- {b.name}: Rp {float(b.amount or 0):,.0f}" for b in budgets[:3])}

🎯 TUJUAN ({len(goals)}):
{chr(10).join(f"- {g.name}: {float(g.current_amount or 0)/float(g.target_amount or 1)*100:.0f}% (Rp {float(g.current_amount or 0):,.0f} / Rp {float(g.target_amount or 0):,.0f})" for g in goals[:3])}

💳 TOTAL UTANG: Rp {total_debt:,.0f} ({len(debts)} items)
"""
    
    return context


def _generate_suggestions(text: str) -> List[str]:
    """Generate follow-up suggestions based on response."""
    suggestions = []
    
    text_lower = text.lower()
    
    if "pengeluaran" in text_lower or "expense" in text_lower:
        suggestions.append("Bagaimana cara mengurangi pengeluaran?")
    
    if "tabungan" in text_lower or "savings" in text_lower:
        suggestions.append("Berapa target tabungan ideal per bulan?")
    
    if "invest" in text_lower:
        suggestions.append("Rekomendasi investasi untuk pemula")
    
    if "utang" in text_lower or "debt" in text_lower:
        suggestions.append("Cara melunasi utang dengan cepat")
    
    if not suggestions:
        suggestions = [
            "Berikan tips menghemat",
            "Cek kesehatan finansial saya",
            "Rekomendasi budget bulan ini"
        ]
    
    return suggestions[:3]


# ============ INSIGHTS ENDPOINTS ============

@router.get("/insights")
async def get_ai_insights(
    current_user = Depends(get_current_user)
):
    """
    Get AI-generated insights about user's finances.
    """
    user_id = current_user.id if hasattr(current_user, "id") else current_user.get("id")
    
    from app.core.database import SessionLocal
    from app.modules.ai_advisor.engines.spending_analyzer import analyze_spending
    from app.models.transaction import Transaction
    
    db = SessionLocal()
    try:
        # Get recent transactions for analysis
        transactions = db.query(Transaction).filter(
            Transaction.user_id == user_id
        ).order_by(Transaction.date.desc()).limit(100).all()
        
        if not transactions:
            return {"insights": [], "message": "Belum ada data transaksi untuk dianalisis"}
        
        tx_data = [
            {
                "date": t.date.isoformat(),
                "amount": float(t.amount),
                "type": t.type,
                "category": t.category.name if t.category else "Lainnya",
                "description": t.description or ""
            }
            for t in transactions
        ]
        
        pattern, anomalies = analyze_spending(tx_data)
        
        insights = []
        
        # Add anomaly-based insights
        for anomaly in anomalies[:3]:
            insights.append({
                "type": anomaly.anomaly_type,
                "severity": anomaly.severity,
                "title": f"Deteksi: {anomaly.anomaly_type}",
                "description": anomaly.description,
                "suggestion": anomaly.suggestion
            })
        
        # Add pattern-based insights
        if pattern.top_categories:
            top_cat = pattern.top_categories[0]
            insights.append({
                "type": "pattern",
                "severity": "info",
                "title": f"Pengeluaran Tertinggi",
                "description": f"Kategori {top_cat[0]} menyumbang Rp {float(top_cat[1]):,.0f}",
                "suggestion": "Pertimbangkan untuk mengalokasikan ulang budget untuk kategori ini."
            })
        
        return {"insights": insights}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.get("/health-score")
async def get_financial_health_score(
    current_user = Depends(get_current_user)
):
    """
    Calculate financial health score (0-100).
    Based on savings rate, debt ratio, emergency fund, and budget adherence.
    """
    user_id = current_user.id if hasattr(current_user, "id") else current_user.get("id")
    
    from app.core.database import SessionLocal
    from app.models.account import Account
    from app.models.transaction import Transaction
    from app.models.debt import Debt
    from sqlalchemy import func
    from datetime import date
    
    db = SessionLocal()
    try:
        today = date.today()
        start_of_month = today.replace(day=1)
        
        # Get balances
        accounts = db.query(Account).filter(
            Account.user_id == user_id,
            Account.is_active == True
        ).all()
        balance = await total_balance(db, user_id)
        account_total = balance["total"]
        
        # Get monthly income/expense
        income = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.type == "income",
            Transaction.date >= start_of_month
        ).scalar() or 0
        
        expense = db.query(func.sum(func.abs(Transaction.amount))).filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= start_of_month
        ).scalar() or 0
        
        # Get debt
        debts = db.query(Debt).filter(
            Debt.user_id == user_id,
            Debt.is_active == True
        ).all()
        total_debt = sum(float(d.current_balance or 0) for d in debts)
        
        # Calculate score components
        # 1. Savings Rate (40% weight)
        savings_rate = ((float(income) - float(expense)) / float(income) * 100) if income > 0 else 0
        savings_score = min(40, savings_rate)  # Max 40 points
        
        # 2. Emergency Fund (30% weight) - 6 months expenses
        monthly_expense = float(expense)
        emergency_target = monthly_expense * 6
        emergency_ratio = min(1.0, account_total / emergency_target) if emergency_target > 0 else 0
        emergency_score = emergency_ratio * 30  # Max 30 points
        
        # 3. Debt Ratio (20% weight) - debt should be < 30% of assets
        debt_ratio = total_debt / (account_total + total_debt) if (account_total + total_debt) > 0 else 0
        debt_score = max(0, 20 - (debt_ratio * 20))  # Max 20 points
        
        # 4. Budget Utilization (10% weight)
        # Assuming average budget usage is good
        budget_score = 10  # Default to full score
        
        total_score = int(savings_score + emergency_score + debt_score + budget_score)
        
        # Determine grade
        if total_score >= 90:
            grade = "A"
            message = "Kesehatan finansial sangat baik! Pertahankan."
        elif total_score >= 75:
            grade = "B"
            message = "Kesehatan finansial baik. Terus tingkatkan."
        elif total_score >= 60:
            grade = "C"
            message = "Kesehatan finansial cukup. Perlu perhatian lebih."
        elif total_score >= 40:
            grade = "D"
            message = "Kesehatan finansial perlu perbaikan."
        else:
            grade = "E"
            message = "Kondisi finansial需要 perhatian segera."
        
        return {
            "score": total_score,
            "grade": grade,
            "message": message,
            "breakdown": {
                "savings_rate": {
                    "score": round(savings_score, 1),
                    "max": 40,
                    "value": round(savings_rate, 1)
                },
                "emergency_fund": {
                    "score": round(emergency_score, 1),
                    "max": 30,
                    "value": round(emergency_ratio * 100, 1)
                },
                "debt_ratio": {
                    "score": round(debt_score, 1),
                    "max": 20,
                    "value": round(debt_ratio * 100, 1)
                },
                "budget_utilization": {
                    "score": budget_score,
                    "max": 10
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
