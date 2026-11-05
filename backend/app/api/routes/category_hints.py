"""Category Hints API - User learning endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json

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




def _words_from(body_value, query_value):
    """
    Read the words the caller sent, from the body or from the query.

    The page sends a body. The endpoint used to read the query string,
    so both are read and the body wins when both are there.
    """
    if body_value not in (None, "", [], {}):
        return body_value
    return query_value


def _find_hint(db, user_id, token):
    """
    The hint for a word, if there is one.

    The lookup is on the word alone, not on the word and the category.
    The table holds one row for a word - a reader cannot have two
    categories for the same word, and the unique index on
    ``(user_id, token)`` says so. Looking for a row that includes the
    category finds nothing when the word is already known under
    another category, and the insert that follows collides with that
    index.
    """
    from app.models.category_hint import CategoryHint

    return (
        db.query(CategoryHint)
        .filter(
            CategoryHint.user_id == user_id,
            CategoryHint.token == token,
        )
        .first()
    )


def _remember(db, user_id, token, category_id, hits_add):
    """
    Remember that a word belongs to a category.

    A word that is taught again is moved rather than duplicated: the
    new category is the one the reader just used, and the old one
    goes. A word taught under the category it already has simply
    counts once more.
    """
    from app.models.category_hint import CategoryHint

    existing = _find_hint(db, user_id, token)

    if existing is None:
        db.add(
            CategoryHint(
                user_id=user_id,
                token=token,
                category_id=category_id,
                hits=hits_add,
            )
        )
        # The row is written now, so that the next question about the
        # same word in the same request finds it. Without this a batch
        # that says the same word twice adds it twice, and the second
        # one collides with the unique index.
        db.flush()
        return

    if existing.category_id == category_id:
        existing.hits += hits_add
    else:
        # The reader has used this word under a different category.
        # The old association is replaced, not kept beside the new one.
        existing.category_id = category_id
        existing.hits = hits_add
    existing.last_used = datetime.utcnow()


def _correct(db, user_id, token, correct_category_id, wrong_category_id):
    """
    Record that a word was taught the wrong category.

    A correction is worth more than an ordinary sighting, so the word
    gains two hits under the right category. If the word was known
    under the wrong category, that sighting is taken back.
    """
    from app.models.category_hint import CategoryHint

    existing = _find_hint(db, user_id, token)

    if existing is None:
        db.add(
            CategoryHint(
                user_id=user_id,
                token=token,
                category_id=correct_category_id,
                hits=2,
            )
        )
        db.flush()
        return

    if wrong_category_id and existing.category_id == wrong_category_id:
        # The word was known under the wrong category, and that
        # sighting is the one being corrected.
        existing.hits = max(0, existing.hits - 1)

    existing.category_id = correct_category_id
    existing.hits += 2
    existing.last_used = datetime.utcnow()


async def _read_body(request: Request) -> dict:
    """The body as a dictionary, or an empty one when there is none."""
    try:
        raw = await request.body()
    except Exception:  # noqa: BLE001 - a body that cannot be read is no body
        return {}
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:  # noqa: BLE001 - a body that is not JSON is no body
        return {}
    return parsed if isinstance(parsed, dict) else {}

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



def build_recent_combos(db, user_id: int, limit: int = 4) -> List[Dict[str, Any]]:
    """
    The reader's own history, as chips they can press.

    A chip is one thing that was bought, with the price that was paid
    for it. It used to be one word out of a description, which meant
    one transaction could put three chips on the screen, all of them
    saying the same thing, and none of them saying what was bought.

    A chip now carries the description itself, and the same thing
    bought twice is one chip with a count of two.

    The price that is remembered is the price that was paid last. A
    thing that costs more now than it did before is remembered at the
    new price, because that is the price the reader will pay next
    time.
    """
    from datetime import datetime

    from app.models.transaction import Transaction

    recent_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(200)
        .all()
    )

    combos: Dict[str, Dict[str, Any]] = {}
    for tx in recent_txs:
        description = (tx.description or "").strip()
        if not description:
            continue
        amount = float(tx.amount or 0)
        key = f"{description.lower()}_{tx.category_id}"
        if key not in combos:
            combos[key] = {
                "token": description,
                "description": description,
                "category_id": tx.category_id,
                "account_id": tx.account_id,
                "amount": amount,
                "count": 0,
                "last_seen": tx.date,
            }
        combos[key]["count"] += 1
        # The list is newest first, so the first time a thing is seen
        # is the most recent time it was bought. Its price is the one
        # to remember.
        if tx.date and (
            combos[key].get("last_seen") is None
            or tx.date >= combos[key]["last_seen"]
        ):
            combos[key]["amount"] = amount
            combos[key]["last_seen"] = tx.date

    ordered = sorted(
        combos.values(),
        key=lambda c: (-c["count"], c.get("last_seen") or datetime.min),
        reverse=False,
    )
    # The ones that were bought most often come first. Among those,
    # the most recent comes first.
    ordered.sort(key=lambda c: c["count"], reverse=True)

    result = []
    for combo in ordered:
        combo.pop("last_seen", None)
        result.append(combo)
        if len(result) >= limit:
            break
    return result


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
        
        # The chips of recent things. One transaction is one chip,
        # carrying the thing that was bought and the price paid.
        recent_combos = build_recent_combos(db, current_user.id)
        
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
    request: Request,
    token: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    hits_add: int = Query(1),
    current_user: User = Depends(get_current_user)
):
    """Record a token-category hit.

    The body is what the page sends. The words are also accepted from
    the query string, because the endpoint used to read them from
    there and a client that still does that must keep working.
    """
    body = await _read_body(request)
    token = _words_from(
        body.get("token"), token)
    category_id = _words_from(
        body.get("category_id"), category_id
    )
    hits_add = _words_from(
        body.get("hits_add"), hits_add
    )
    if not token or category_id is None:
        raise HTTPException(
            status_code=422,
            detail="token and category_id are required",
        )
    db = SessionLocal()
    try:
        _remember(db, current_user.id, token, category_id, hits_add)
        db.commit()
        return {"status": "recorded", "token": token, "category_id": category_id}

    finally:
        db.close()


@router.post("/record-batch")
async def record_batch(
    request: Request,
    tokens: Optional[List[str]] = Query(None),
    category_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Record multiple tokens at once.

    The body is what the page sends. The words are also accepted from
    the query string, because the endpoint used to read them from
    there and a client that still does that must keep working.
    """
    body = await _read_body(request)
    tokens = _words_from(
        body.get("tokens"), tokens)
    category_id = _words_from(
        body.get("category_id"), category_id
    )
    if not tokens or category_id is None:
        raise HTTPException(
            status_code=422,
            detail="tokens and category_id are required",
        )
    db = SessionLocal()
    try:
        for token in tokens:
            _remember(db, current_user.id, token, category_id, 1)
        db.commit()
        return {"status": "recorded", "count": len(tokens)}

    finally:
        db.close()


@router.post("/correct")
async def record_correction(
    request: Request,
    token: Optional[str] = Query(None),
    correct_category_id: Optional[int] = Query(None),
    wrong_category_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Record user correction (more valuable).

    The body is what the page sends. The words are also accepted from
    the query string, because the endpoint used to read them from
    there and a client that still does that must keep working.
    """
    body = await _read_body(request)
    token = _words_from(
        body.get("token"), token)
    correct_category_id = _words_from(
        body.get("correct_category_id"),
        correct_category_id,
    )
    wrong_category_id = _words_from(
        body.get("wrong_category_id"),
        wrong_category_id,
    )
    if not token or correct_category_id is None:
        raise HTTPException(
            status_code=422,
            detail="token and correct_category_id are required",
        )
    db = SessionLocal()
    try:
        _correct(
            db,
            current_user.id,
            token,
            correct_category_id,
            wrong_category_id,
        )
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
