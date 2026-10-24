"""
Background scan job endpoints.

A receipt scan or a QR camera capture can take several seconds. Doing it
inside the request means the user waits on a spinner, and on a slow
mobile connection the request can time out before the scan finishes.

These endpoints let the client hand the work over and pick the result up
when it is ready:

    POST /api/scans/receipt        -> { job_id, status }
    POST /api/scans/qr             -> { job_id, status }
    GET  /api/scans/{job_id}       -> { status, progress, result }
    POST /api/scans/{job_id}/cancel -> stops a queued job

The job runs in a bounded background thread pool. The user can close the
app and come back to the result through the notification sheet.
"""

import base64
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.user import User
from app.services.scan_jobs import (
    STATUS_CANCELLED,
    STATUS_QUEUED,
    get_scan_manager,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Scans"])


class QRJobRequest(BaseModel):
    """The QR payload captured by the camera."""

    qr_data: str
    # Optional: the merchant or note the user attached to the capture.
    note: Optional[str] = None


def _run_in_own_session(
    user_id: int,
    payload: Dict[str, Any],
    learning_summary: Optional[Dict[str, Any]] = None,
) -> Optional[int]:
    """
    Persist a scan using a database session of its own.

    The background worker runs on a different thread from the request, and
    a SQLAlchemy session must not be used across threads. This opens a
    fresh session, does the catalog learning and the persistence inside it,
    and closes it again.
    """
    from app.core.database import SessionLocal

    session = SessionLocal()
    try:
        learning_summary = learning_summary or {}
        try:
            from app.services.catalog_learning import get_learning_service

            learning = get_learning_service(session, user_id)
            learned = learning.learn_from_scan(
                payload.get("merchant_name"),
                [
                    {
                        "name": item.get("name"),
                        "category": item.get("category"),
                        "price_per_unit": item.get("price_per_unit"),
                        "is_discount": item.get("is_discount"),
                    }
                    for item in (payload.get("items") or [])
                    if isinstance(item, dict)
                ],
            )
            learning_summary.update(learned)
            payload["learning"] = learning_summary
            payload["new_products"] = learned.get("new_products") or []
            payload["new_merchant"] = bool(
                (learned.get("merchant") or {}).get("created")
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Background catalog learning failed: {exc}")
            session.rollback()

        return _save_scan_to_db(session, user_id, payload)
    finally:
        session.close()


def _save_scan_to_db(
    db: Session,
    user_id: int,
    result: Dict[str, Any],
) -> Optional[int]:
    """
    Persist a finished scan.

    The scan is stored as a receipt scan plus its items, and the merchant
    and the products are learned into the catalogue so the next receipt
    from the same shop resolves to the same records.
    """
    from decimal import Decimal

    from app.models.receipt import ReceiptItem, ReceiptScan

    try:
        breakdown = result.get("breakdown") or {}
        items = breakdown.get("items") or result.get("items") or []

        merchant = result.get("merchant_name") or "Merchant"
        total = result.get("amount") or breakdown.get("total") or 0
        try:
            total_value = float(str(total).replace(".", "").replace(",", ".")) if total else 0
        except (TypeError, ValueError):
            total_value = 0

        scan = ReceiptScan(
            user_id=user_id,
            merchant_name=merchant,
            total_amount=Decimal(str(total_value)) if total_value else None,
            subtotal=Decimal(str(breakdown.get("subtotal") or 0)),
            discount_total=Decimal(str(breakdown.get("discount_total") or 0)),
            payment_method=result.get("payment_method"),
            receipt_date=result.get("date"),
            address=result.get("merchant_address"),
            ocr_confidence=Decimal(str(result.get("confidence_score") or 0)),
            detection_type="ENTERPRISE_LOCAL_OCR",
            raw_text=(result.get("raw_text") or "")[:5000] or None,
            raw_lines=result.get("raw_lines") or [],
        )
        db.add(scan)
        db.flush()

        for item in items:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("raw_name") or "Item"
            qty = int(item.get("quantity") or 1)
            price = item.get("price_per_unit") or 0
            line_total = item.get("total_price")
            if line_total in (None, 0) and price:
                line_total = qty * float(price)
            db.add(
                ReceiptItem(
                    receipt_scan_id=scan.id,
                    raw_name=name,
                    canonical_name=item.get("canonical_name"),
                    quantity=qty,
                    price_per_unit=Decimal(str(price or 0)),
                    total_price=Decimal(str(line_total or 0)),
                    is_discount=bool(item.get("is_discount")),
                    category=item.get("category"),
                    line_number=item.get("line_number"),
                )
            )

        db.commit()
        return int(scan.id)
    except Exception as exc:  # noqa: BLE001 - a failed save must not lose the scan
        logger.exception("Failed to persist background scan")
        db.rollback()
        return None


@router.post("/receipt")
async def create_receipt_scan_job(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Queue a receipt scan and return immediately.

    The client polls GET /api/scans/{job_id} for the result.
    """
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}",
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    user_id = int(current_user.id) if current_user else None
    manager = get_scan_manager()
    job = manager.create(user_id or 0, kind="receipt", payload={"content": content})

    def worker(scan_job):
        from app.api.routes.parser import _process_receipt_cpu_bound

        scan_job.payload = None  # release the image memory as soon as we start
        # The database session belongs to the request thread, so the worker
        # opens its own session for the persistence step.
        result = _process_receipt_cpu_bound(content)

        receipt = result.get("receipt")
        hybrid = result.get("receipt_result")
        breakdown = result.get("breakdown") or {}
        learning = result.get("learning") or {}

        merchant = None
        amount = 0
        items = result.get("enriched_items") or []
        transaction_date = None
        payment_method = None

        if hybrid is not None:
            merchant = hybrid.merchant_name
            amount = hybrid.total_amount
            transaction_date = hybrid.transaction_date
            payment_method = hybrid.payment_method
        if receipt is not None:
            merchant = merchant or receipt.merchant_name
            amount = amount or (receipt.amount_value or 0)
            transaction_date = transaction_date or receipt.date
            payment_method = payment_method or receipt.payment_method

        payload = {
            "merchant_name": merchant or "Merchant",
            "amount": str(int(amount)) if amount else "0",
            # The same value under the name the rest of the API uses, so
            # the client does not have to know which shape it got.
            "total_amount": float(amount or 0),
            "date": transaction_date,
            "payment_method": payment_method,
            "items": items,
            "breakdown": breakdown,
            "learning": learning,
            "new_merchant": result.get("merchant_is_new", False),
            "new_products": learning.get("new_products") or [],
            "confidence_score": 0.0,
            "raw_text": (receipt.text[:2000] if receipt and receipt.text else None),
            "raw_lines": result.get("raw_lines") or [],
            "merchant_address": result.get("merchant_address"),
            "ocr_diagnostics": result.get("ocr_diagnostics") or {},
            "parser_engine": result.get("parser_engine"),
        }

        if user_id:
            receipt_scan_id = _run_in_own_session(
                user_id, payload, learning_summary=learning
            )
            payload["receipt_scan_id"] = receipt_scan_id
            # The learning pass runs in its own session, so its summary
            # comes back here rather than through the original result.
            payload["learning"] = payload.get("learning") or learning

        return payload

    manager.submit(job, worker)

    return {
        "job_id": job.id,
        "status": job.status,
        "poll_url": f"/api/scans/{job.id}",
    }


@router.post("/qr")
def create_qr_scan_job(
    payload: QRJobRequest,
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Queue a QR payload for parsing.

    QR parsing is fast, but it goes through the same job machinery so the
    client has one code path for both the camera receipt and the camera
    QR capture, and the notification sheet works the same way for both.
    """
    user_id = int(current_user.id) if current_user else None
    manager = get_scan_manager()
    job = manager.create(user_id or 0, kind="qr", payload={"qr_data": payload.qr_data})

    def worker(scan_job):
        from app.core.database import SessionLocal
        from app.services.parser_service import parse_sms_or_qris

        # The database session belongs to the request thread, so the
        # worker opens its own. The classifier reads the user's history
        # to work out which way the money went.
        session = SessionLocal()
        try:
            # The parser returns a list: a single QR payload can contain
            # more than one transaction.
            parsed_list = (
                parse_sms_or_qris(payload.qr_data, db=session, user_id=user_id) or []
            )
        finally:
            session.close()
        parsed = parsed_list[0] if parsed_list else None
        return {
            "qr_data": payload.qr_data,
            "transactions": [
                {
                    "amount": str(p.amount) if p.amount is not None else None,
                    "transaction_type": p.transaction_type,
                    "merchant_name": p.merchant_name,
                    "description": p.description,
                    "date": p.date,
                    "confidence_score": p.confidence_score,
                    "detection_type": p.detection_type,
                    "raw_text": p.raw_text,
                }
                for p in parsed_list
            ],
            "amount": str(parsed.amount) if parsed and parsed.amount is not None else None,
            "transaction_type": parsed.transaction_type if parsed else None,
            "merchant_name": parsed.merchant_name if parsed else None,
            "description": parsed.description if parsed else None,
            "date": parsed.date if parsed else None,
            "confidence_score": parsed.confidence_score if parsed else 0.0,
            "detection_type": parsed.detection_type if parsed else "QRIS",
            "raw_text": parsed.raw_text if parsed else None,
            "note": payload.note,
        }

    manager.submit(job, worker)

    return {
        "job_id": job.id,
        "status": job.status,
        "poll_url": f"/api/scans/{job.id}",
    }


@router.get("/{job_id}")
def get_scan_job(
    job_id: str,
    current_user: User = Depends(get_current_user_optional),
):
    """
    Poll a scan job.

    A job belongs to the user who created it; another user gets a 404.
    """
    manager = get_scan_manager()
    user_id = int(current_user.id) if current_user else None
    job = manager.get(job_id, user_id=user_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return job.to_dict()


@router.get("/")
def list_scan_jobs(
    current_user: User = Depends(get_current_user_optional),
):
    """
    The jobs of the current user, newest first.

    The client uses this on mount so a scan that finished while the user
    was on another screen is not lost.
    """
    manager = get_scan_manager()
    user_id = int(current_user.id) if current_user else None
    jobs = manager.list_for_user(user_id)
    jobs.sort(key=lambda j: j["created_at"], reverse=True)
    return {"jobs": jobs[:20]}


@router.post("/{job_id}/cancel")
def cancel_scan_job(
    job_id: str,
    current_user: User = Depends(get_current_user_optional),
):
    """Cancel a job that has not started yet."""
    manager = get_scan_manager()
    user_id = int(current_user.id) if current_user else None
    job = manager.get(job_id, user_id=user_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Scan job not found")
    if job.status != STATUS_QUEUED:
        raise HTTPException(
            status_code=409,
            detail=f"Job is already {job.status} and cannot be cancelled",
        )
    manager.update(job_id, status=STATUS_CANCELLED, message="Dibatalkan")
    return job.to_dict()
