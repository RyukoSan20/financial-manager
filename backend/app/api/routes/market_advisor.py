"""
The AI Market Co-Pilot, over the API.

Two endpoints:

    POST /api/market-advisor/ask      a question, and the answer
    GET  /api/market-advisor/context  what the server currently has

The answer carries where it came from, so the frontend can tell the
reader whether the words were read out of the market data or written
by a language model.

The service is called through the module, not through a name copied
out of it, so that a test can put a set of quotes in place of the
live market and see what the answer says about them.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator
from typing import List, Optional

from app.services import market_ai_agent_service

router = APIRouter(tags=["market-advisor"])


class AdvisorRequest(BaseModel):
    """A question, and optionally the symbols it is about."""

    question: str = Field(..., min_length=1, max_length=500)
    symbols: Optional[List[str]] = None
    language: str = "id"

    @validator("question")
    def _question_is_not_blank(cls, value: str) -> str:
        """A blank question is a bad request, not an empty answer."""
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("The question cannot be empty.")
        return cleaned

    @validator("language")
    def _language_is_known(cls, value: str) -> str:
        cleaned = (value or "id").strip().lower()
        return cleaned if cleaned in ("id", "en", "ja") else "id"


class ChartPoint(BaseModel):
    """One number the frontend can draw."""

    symbol: str
    name: str = ""
    value: float
    change: Optional[float] = None
    currency: Optional[str] = None
    kind: Optional[str] = None


class KeyPoint(BaseModel):
    """One line of the answer, named by a key so it can be translated."""

    key: str
    values: dict = Field(default_factory=dict)


class AdvisorResponse(BaseModel):
    """The answer to a question."""

    answer: str
    answer_key: str = ""
    answer_values: dict = Field(default_factory=dict)
    key_points: List[KeyPoint] = Field(default_factory=list)
    chart_points: List[ChartPoint] = Field(default_factory=list)
    source: str = market_ai_agent_service.SOURCE_MARKET_DATA


@router.post("/ask", response_model=AdvisorResponse)
async def ask_advisor(request: AdvisorRequest):
    """
    Answer a question about the market.

    The answer never carries a price the server did not read from a
    quote. When there is no data for the question, the answer says so.
    """
    try:
        result = await market_ai_agent_service.ask_market_advisor(
            question=request.question,
            symbols=request.symbols,
            language=request.language,
        )
    except Exception as exc:  # noqa: BLE001 - the page must not break
        raise HTTPException(status_code=500, detail=str(exc))

    source = result.get("source", market_ai_agent_service.SOURCE_MARKET_DATA)
    if source not in market_ai_agent_service.ALLOWED_SOURCES:
        source = market_ai_agent_service.SOURCE_MARKET_DATA

    return {
        "answer": result.get("answer", ""),
        "answer_key": result.get("answer_key", ""),
        "answer_values": result.get("answer_values") or {},
        "key_points": result.get("key_points") or [],
        "chart_points": result.get("chart_points") or [],
        "source": source,
    }


@router.get("/context")
async def advisor_context():
    """What the server currently has, so the page can offer questions."""
    try:
        payload = await market_ai_agent_service.get_snapshot()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc))
    return market_ai_agent_service.build_context(payload)
