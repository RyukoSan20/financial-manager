"""
Router papan belanja.
Path:
  GET   /api/kanban/board
  PATCH /api/kanban/items/{id}/stage
  POST  /api/kanban/items/{id}/purchase
  GET   /api/kanban/report
"""
from contextlib import contextmanager
from datetime import date as Date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.kanban_board import (
    BoardItem, BoardOut, PurchaseIn, PurchaseOut, ReportOut, StageMoveIn,
)
from app.services import shopping_pipeline as svc

router = APIRouter(prefix="", tags=["kanban-board"])


@contextmanager
def _http_errors():
    try:
        yield
    except svc.PipelineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/board", response_model=BoardOut)
def get_board(
    month: Optional[str] = Query(None, regex=r"^\d{4}-(0[1-9]|1[0-2])$"),
    category_id: Optional[int] = Query(None, ge=1),
    min_price: Optional[int] = Query(None, ge=0),
    max_price: Optional[int] = Query(None, ge=0),
    q: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    with _http_errors():
        columns = svc.build_board(
            db, user.id, month=month, category_id=category_id,
            min_price=min_price, max_price=max_price, q=q,
        )
        return BoardOut(columns=columns)


@router.patch("/items/{item_id}/stage", response_model=BoardItem)
def move_item(item_id: int, body: StageMoveIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    with _http_errors():
        return svc.move_item(db, user.id, item_id, body)


@router.post("/items/{item_id}/purchase", response_model=PurchaseOut)
def purchase_item(item_id: int, body: PurchaseIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    with _http_errors():
        item, tx_id, already = svc.purchase_item(db, user.id, item_id, body)
        return PurchaseOut(item=item, transaction_id=tx_id, already_purchased=already)


@router.get("/report", response_model=ReportOut)
def expense_report(
    start: Date = Query(...), end: Date = Query(...),
    db: Session = Depends(get_db), user=Depends(get_current_user),
):
    with _http_errors():
        return svc.expense_report(db, user.id, start, end)
