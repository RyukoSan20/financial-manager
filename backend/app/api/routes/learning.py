"""
Learning API for the dynamic receipt parser.

When a user confirms or corrects a parsed item name, the term is written
into the product catalogue. Over time the recogniser learns the vocabulary
that actually appears on this user's receipts, without anyone maintaining a
dictionary by hand.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from app.core.security import get_current_user_optional
from app.models.user import User

router = APIRouter(tags=["Learning"])


class LearnRequest(BaseModel):
    terms: List[str] = Field(..., min_length=1, max_length=200)
    category: Optional[str] = None


class LearnResponse(BaseModel):
    stored: int
    terms: List[str]
    message: str


class ClassifyRequest(BaseModel):
    words: List[str] = Field(..., min_length=1, max_length=200)


class ClassifyResponse(BaseModel):
    results: List[Dict[str, Any]]
    engine: str
    llm_available: bool


@router.post("/learn", response_model=LearnResponse)
def learn_terms(
    request: LearnRequest,
    current_user: User = Depends(get_current_user_optional),
):
    """Store user-confirmed item names so future scans recognise them."""
    try:
        from app.services.dynamic_text_parser import dynamic_text_parser
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Learning engine unavailable: {e}")

    cleaned = [t.strip() for t in request.terms if t and t.strip()]
    if not cleaned:
        raise HTTPException(status_code=400, detail="Tidak ada istilah yang valid")

    stored = dynamic_text_parser.learn_terms(cleaned, request.category)
    return LearnResponse(
        stored=stored,
        terms=cleaned,
        message=f"{stored} istilah disimpan ke katalog",
    )


@router.post("/classify", response_model=ClassifyResponse)
def classify_words(
    request: ClassifyRequest,
    current_user: User = Depends(get_current_user_optional),
):
    """Classify arbitrary words into semantic buckets.

    Useful for debugging what the recogniser does with a brand it has never
    seen, and for the Profile Summary page when the user tags an unknown
    term.
    """
    try:
        from app.services.dynamic_text_parser import dynamic_text_parser
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Classifier unavailable: {e}")

    classifier = dynamic_text_parser.classifier
    results = [
        {
            "word": word,
            "classification": classifier.classify(word),
        }
        for word in request.words
        if word and word.strip()
    ]

    return ClassifyResponse(
        results=results,
        engine="statistical",
        llm_available=dynamic_text_parser.llm.available,
    )


@router.get("/status")
def learning_status(
    current_user: User = Depends(get_current_user_optional),
):
    """Report which parsing engines are active."""
    try:
        from app.services.dynamic_text_parser import dynamic_text_parser
        provider = dynamic_text_parser.llm.provider or "none"
        llm_available = dynamic_text_parser.llm.available
    except Exception:
        provider, llm_available = "none", False

    return {
        "llm_provider": provider,
        "llm_available": llm_available,
        "statistical_available": True,
        "self_learning": True,
    }
