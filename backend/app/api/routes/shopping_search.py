"""
Looking for a product, over the wire.

The search answers with a grid of things to look at: a picture, a
shop, a price, a rating. Where the answer came from is in the answer
itself, in the `source` field, so that the screen can be honest about
it: a price from the reader's own catalogue is not a price in the
shop, and the screen says so when that is the case.

The router is mounted at `/api/shopping-search`, which is its own
prefix. The shopping board is already mounted at `/api/shopping`, and
mounting a second router under that prefix is how a route ends up
answering twice with only the first one ever being reached.

There is no sign-in needed to look: a search asks for nothing but a
query, and it writes nothing down.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.user import User
from app.services.shopping_search_service import search_products

router = APIRouter()


class ShoppingSearchRequest(BaseModel):
    """What to look for."""

    query: str = Field(..., min_length=1, max_length=200)
    limit: int = Field(default=24, ge=1, le=60)


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, max_length=200, description="What to look for"),
    limit: int = Query(default=24, ge=1, le=60),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> Dict[str, Any]:
    """
    Look for a product.

    The answer is the query, the results, how many there are, and
    where they came from. `source` is either `provider` (fetched from
    outside, live prices) or `local_catalog` (built from the reader's
    own catalogue, the reader's own reference prices).

    A reader who is not signed in still gets an answer: the catalogue
    that is used is the shared one.
    """
    try:
        return await search_products(
            query=q,
            user_id=current_user.id if current_user is not None else None,
            limit=limit,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/search")
async def search_post(
    payload: ShoppingSearchRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> Dict[str, Any]:
    """
    Look for a product, with the query in the body.

    The same answer as the other route. A query with a question mark
    in it is awkward in a URL, and the screen sends the body.
    """
    try:
        return await search_products(
            query=payload.query,
            user_id=current_user.id if current_user is not None else None,
            limit=payload.limit,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
