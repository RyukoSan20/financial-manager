"""Category Hints API - User learning endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import SessionLocal
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/category-hints", tags=["Category Hints"])


class CategoryHintResponse(BaseModel):
    token: str
    category_id: int
    hits: int


class BootstrapResponse(BaseModel):
    hints: Dict[str, Any]
    categories: List[Dict[str, Any]]
    recent_combos: List[Dict[str, Any]]


def extract_tokens(description: str) -> List[str]:
    """Extract meaningful tokens from description"""
    if not description:
        return []
    
    STOPWORDS = {
        'yang', 'dan', 'di', 'ke', 'dari', 'dengan', 'untuk', 'pada',
        'ini', 'itu', 'oleh', 'adalah', 'sebagai', 'tanggal', 'pukul',
        'dini', 'pagi', 'siang', 'sore', 'malam', 'tengah',
    }
    
    words = description.lower().split()
    tokens = [
        w for w in words
        if len(w) >= 2 and w not in STOPWORDS and not w.isdigit()
    ]
    return tokens


@router.get("/bootstrap", response_model=BootstrapResponse)
async def get_bootstrap(current_user: User = Depends(get_current_user)):
    """Get all data needed for smart category suggestion."""
    db = SessionLocal()
    try:
        # Get user's categories
        from app.models.category import Category
        categories = db.query(Category).filter(
            (Category.user_id == current_user.id) | (Category.user_id == None)
        ).all()
        
        # Get user's hints
        from app.models.category_hint import CategoryHint
        hints_rows = db.query(CategoryHint).filter(
            CategoryHint.user_id == current_user.id
        ).all()
        
        # Build hints dict
        hints = {}
        for h in hints_rows:
            if h.token not in hints:
                hints[h.token] = {}
            hints[h.token][str(h.category_id)] = {"hits": h.hits}
        
        # Get recent transactions
        from app.models.transaction import Transaction
        recent_txs = db.query(Transaction).filter(
            Transaction.user_id == current_user.id
        ).order_by(Transaction.date.desc()).limit(100).all()
        
        # Build recent combos
        combos = {}
        for tx in recent_txs:
            if tx.description and tx.category_id:
                tokens = extract_tokens(tx.description)
                for token in tokens:
                    key = f"{token}_{tx.category_id}"
                    if key not in combos:
                        combos[key] = {
                            "token": token,
                            "category_id": tx.category_id,
                            "amount": tx.amount,
                            "count": 0
                        }
                    combos[key]["count"] += 1
        
        recent_combos = sorted(
            combos.values(),
            key=lambda x: x["count"],
            reverse=True
        )[:20]
        
        return BootstrapResponse(
            hints=hints,
            categories=[
                {
                    "id": cat.id,
                    "name": cat.name,
                    "system_key": getattr(cat, 'system_key', None),
                    "icon": getattr(cat, 'icon', None)
                }
                for cat in categories
            ],
            recent_combos=recent_combos
        )
        
    finally:
        db.close()


@router.post("/record")
async def record_hint(
    token: str,
    category_id: int,
    hits_add: int = 1,
    current_user: User = Depends(get_current_user)
):
    """Record a token-category hit."""
    db = SessionLocal()
    try:
        from app.models.category_hint import CategoryHint
        
        existing = db.query(CategoryHint).filter(
            CategoryHint.user_id == current_user.id,
            CategoryHint.token == token,
            CategoryHint.category_id == category_id
        ).first()
        
        if existing:
            existing.hits += hits_add
            existing.last_used = datetime.utcnow()
        else:
            new_hint = CategoryHint(
                user_id=current_user.id,
                token=token,
                category_id=category_id,
                hits=hits_add
            )
            db.add(new_hint)
        
        db.commit()
        return {"status": "recorded", "token": token, "category_id": category_id}
        
    finally:
        db.close()


@router.post("/record-batch")
async def record_batch(
    tokens: List[str],
    category_id: int,
    current_user: User = Depends(get_current_user)
):
    """Record multiple tokens at once."""
    db = SessionLocal()
    try:
        from app.models.category_hint import CategoryHint
        
        for token in tokens:
            existing = db.query(CategoryHint).filter(
                CategoryHint.user_id == current_user.id,
                CategoryHint.token == token,
                CategoryHint.category_id == category_id
            ).first()
            
            if existing:
                existing.hits += 1
                existing.last_used = datetime.utcnow()
            else:
                new_hint = CategoryHint(
                    user_id=current_user.id,
                    token=token,
                    category_id=category_id,
                    hits=1
                )
                db.add(new_hint)
        
        db.commit()
        return {"status": "recorded", "count": len(tokens)}
        
    finally:
        db.close()


@router.post("/correct")
async def record_correction(
    token: str,
    correct_category_id: int,
    wrong_category_id: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    """Record user correction (more valuable)."""
    db = SessionLocal()
    try:
        from app.models.category_hint import CategoryHint
        
        # Add to correct category (+2 hits)
        existing = db.query(CategoryHint).filter(
            CategoryHint.user_id == current_user.id,
            CategoryHint.token == token,
            CategoryHint.category_id == correct_category_id
        ).first()
        
        if existing:
            existing.hits += 2
            existing.last_used = datetime.utcnow()
        else:
            new_hint = CategoryHint(
                user_id=current_user.id,
                token=token,
                category_id=correct_category_id,
                hits=2
            )
            db.add(new_hint)
        
        # Penalize wrong category if provided
        if wrong_category_id:
            wrong = db.query(CategoryHint).filter(
                CategoryHint.user_id == current_user.id,
                CategoryHint.token == token,
                CategoryHint.category_id == wrong_category_id
            ).first()
            
            if wrong:
                wrong.hits = max(0, wrong.hits - 1)
        
        db.commit()
        return {"status": "corrected"}
        
    finally:
        db.close()


@router.delete("/reset")
async def reset_hints(current_user: User = Depends(get_current_user)):
    """Reset all learning data."""
    db = SessionLocal()
    try:
        from app.models.category_hint import CategoryHint
        
        db.query(CategoryHint).filter(
            CategoryHint.user_id == current_user.id
        ).delete()
        db.commit()
        return {"status": "reset"}
        
    finally:
        db.close()
