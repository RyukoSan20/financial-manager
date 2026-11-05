"""
The itemised receipt of a transaction, and the editing of it.

A receipt is a list of lines, and each line has a price and a
category of its own. The reader who buys AYAM PANGGANG and NASI and a
RED VELVET LATTE on one piece of paper usually wants the food to go to
food and the latte to go to drinks, and a receipt that cannot say that
is a receipt that puts everything in one bucket.

The money on the receipt has three parts:

    subtotal - discount + tax = net

The discount and the tax are written on the receipt as one number
each, and the reader can change both of them here. The parts are
shared over the lines in proportion to what each line is worth, so
that the lines always add up to the whole.

The routes live in their own file, apart from the transaction routes,
because they are a thing of their own: the transaction is the record,
and this is the receipt that was read from the paper.
"""

import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.category import Category
from app.models.receipt import ReceiptItem, ReceiptScan
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.base import EmptyStringAsNone
from app.services.receipt_itemizer_service import (
    allocate_totals,
    categorize_items,
    compute_net_total,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class ReceiptLine(EmptyStringAsNone):
    """One line of the receipt, as the reader sends it."""

    id: Optional[int] = None
    name: str = Field(default="", max_length=255)
    quantity: float = 1
    unit_price: float = 0
    # The category of this line. Either the id of one of the reader's
    # categories or the name of one. The name is what the database
    # keeps, so the two are both accepted here.
    category_id: Optional[int] = None
    category: Optional[str] = Field(None, max_length=100)
    is_discount: bool = False


class ReceiptUpdate(EmptyStringAsNone):
    """The whole breakdown, as the reader sends it."""

    items: List[ReceiptLine] = Field(default_factory=list)
    discount_total: float = 0
    tax_total: float = 0


def _receipt_for(db: Session, transaction_id: int, user_id: int) -> ReceiptScan:
    """
    The receipt of a transaction, when the reader is allowed to see it.
    """
    transaction = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id)
        .first()
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if transaction.user_id != user_id:
        raise HTTPException(status_code=403, detail="Akses ditolak")

    if not transaction.receipt_scan_id:
        raise HTTPException(
            status_code=404,
            detail="Transaksi ini tidak punya rincian struk",
        )

    receipt = (
        db.query(ReceiptScan)
        .filter(ReceiptScan.id == transaction.receipt_scan_id)
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Struk tidak ditemukan")

    return receipt


def _receipt_for_writing(db: Session, transaction_id: int, user_id: int) -> ReceiptScan:
    """
    The receipt of a transaction, made if it is not there yet.

    A transaction the reader typed by hand has no receipt behind it,
    and a receipt the reader typed by hand has no scan behind it
    either. When the reader writes the lines of a transaction, the
    receipt that holds them is made there and then.
    """
    transaction = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id)
        .first()
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if transaction.user_id != user_id:
        raise HTTPException(status_code=403, detail="Akses ditolak")

    receipt = None
    if transaction.receipt_scan_id:
        receipt = (
            db.query(ReceiptScan)
            .filter(ReceiptScan.id == transaction.receipt_scan_id)
            .first()
        )

    if receipt is None:
        receipt = ReceiptScan(
            user_id=user_id,
            transaction_id=transaction.id,
            merchant_name=transaction.merchant_name,
            total_amount=transaction.amount,
        )
        db.add(receipt)
        db.flush()
        transaction.receipt_scan_id = receipt.id
        db.flush()

    return receipt


def _reader_categories(db: Session, user_id: int) -> List[Category]:
    """The categories the reader may choose from."""
    return (
        db.query(Category)
        .filter(
            Category.is_active == True,
            (Category.user_id == user_id) | (Category.user_id == None),
        )
        .all()
    )


def _category_id_for(categories: List[Category], name: Optional[str]) -> Optional[int]:
    """
    The id of the category with that name, in any of the three
    languages.
    """
    if not name:
        return None
    wanted = name.strip().lower()
    if not wanted:
        return None
    for category in categories:
        for key in ("name", "name_en", "name_ja"):
            value = getattr(category, key, None)
            if value and value.strip().lower() == wanted:
                return category.id
    return None


def _category_id_of(categories: List[Category], value: Optional[Any]) -> Optional[int]:
    """The id of the category, whether the reader gave an id or a name."""
    if value is None:
        return None
    if isinstance(value, int):
        for category in categories:
            if category.id == value:
                return value
        return None
    return _category_id_for(categories, str(value))


def _line_payload(
    item: ReceiptItem,
    categories: List[Category],
    discount_share: Optional[Decimal] = None,
    tax_share: Optional[Decimal] = None,
) -> Dict[str, Any]:
    """One line of the receipt, as it is sent to the reader."""
    unit_price = float(item.price_per_unit or 0)
    total_price = float(item.total_price or 0)

    payload: Dict[str, Any] = {
        "id": item.id,
        "name": item.raw_name or item.canonical_name or "",
        "quantity": item.quantity if item.quantity is not None else 1,
        "unit_price": unit_price,
        "total_price": total_price,
        "is_discount": bool(item.is_discount),
        "category": item.category or None,
        "category_id": _category_id_for(categories, item.category),
        "match_confidence": float(item.match_confidence) if item.match_confidence else None,
    }

    if discount_share is not None:
        payload["allocated_discount"] = float(discount_share)
    if tax_share is not None:
        payload["allocated_tax"] = float(tax_share)

    return payload


def _receipt_payload(
    db: Session,
    receipt: ReceiptScan,
    categories: List[Category],
) -> Dict[str, Any]:
    """The whole receipt: the lines, and the three numbers."""
    items = list(receipt.items or [])

    discount = receipt.discount_total or 0
    tax = receipt.tax_total or 0
    subtotal = receipt.subtotal
    if subtotal is None:
        subtotal = sum(
            (float(item.total_price or 0) for item in items if not item.is_discount),
            0.0,
        )

    allocated = allocate_totals(items, subtotal, discount, tax)

    lines = []
    for index, item in enumerate(items):
        share = allocated[index] if index < len(allocated) else {}
        lines.append(
            _line_payload(
                item,
                categories,
                share.get("allocated_discount"),
                share.get("allocated_tax"),
            )
        )

    net = compute_net_total(items, discount, tax, subtotal=subtotal)

    return {
        "transaction_id": receipt.transaction_id,
        "receipt_scan_id": receipt.id,
        "merchant_name": receipt.merchant_name,
        "subtotal": float(subtotal),
        "discount_total": float(discount),
        "tax_total": float(tax),
        "total_amount": float(receipt.total_amount or 0),
        "net_total": float(net),
        "items": lines,
    }


class PriceMemoryEntry(BaseModel):
    """
    One thing the reader has paid for before.

    The name is what the reader types, the unit price is what they
    paid for one of it, and the count is how many times they have
    bought it.
    """

    name: str
    unit_price: float
    quantity: float = 1
    category: Optional[str] = None
    times_bought: int = 1


@router.get("/price-memory", response_model=list[PriceMemoryEntry])
def get_price_memory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The prices the reader has paid before.

    The reader types "Indomie" into the item table and the price comes
    back, because they paid it last time. The lines of the receipts
    they have saved are the better source for this, because the price
    of the Indomie is written on the line and not on the total of the
    shop.

    Only the reader's own prices are returned. Another reader's Indomie
    is not this reader's Indomie.
    """
    user_id = current_user.id

    # The lines of the receipts.
    lines = (
        db.query(ReceiptItem, ReceiptScan)
        .join(ReceiptScan, ReceiptItem.receipt_scan_id == ReceiptScan.id)
        .filter(ReceiptScan.user_id == user_id)
        .all()
    )

    memory: dict[str, dict] = {}

    def remember(name, unit_price, quantity, category):
        clean = str(name or "").strip()
        if not clean:
            return
        try:
            price = float(unit_price)
        except (TypeError, ValueError):
            return
        if price <= 0:
            return
        key = clean.lower()
        known = memory.get(key)
        if known is None:
            memory[key] = {
                "name": clean,
                "unit_price": price,
                "quantity": float(quantity or 1),
                "category": category,
                "times_bought": 1,
            }
        else:
            known["times_bought"] += 1
            known["unit_price"] = price
            if known.get("category") is None and category is not None:
                known["category"] = category

    # The transactions come first, so that the lines can correct them.
    #
    # A receipt of Rp 12.000 with an Indomie of Rp 3.500 in it has a
    # transaction of Rp 12.000 and a line of Rp 3.500. The price of the
    # Indomie is the line. If the total of the shop were to overwrite
    # it, the reader would be told that the Indomie cost twelve
    # thousand, and the memory would teach them the wrong price for
    # every Indomie they buy from then on.
    transactions = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.is_deleted.is_(False),
        )
        .order_by(Transaction.date.desc())
        .limit(200)
        .all()
    )
    for tx in transactions:
        remember(
            tx.description or tx.merchant_name,
            tx.amount,
            1,
            None,
        )

    # The lines of the receipts, which know the price of one thing.
    for item, _scan in lines:
        name = item.canonical_name or item.raw_name
        remember(
            name,
            item.price_per_unit,
            item.quantity,
            item.category,
        )

    # The most bought first, so the suggestion the reader sees first is
    # the one they are most likely to want.
    entries = sorted(
        memory.values(),
        key=lambda entry: (-entry["times_bought"], entry["name"].lower()),
    )
    return entries


@router.get("/{transaction_id}")
def read_receipt_items(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    The itemised receipt of a transaction.

    The lines with the category of each of them, and the subtotal, the
    discount, the tax and the net.
    """
    receipt = _receipt_for(db, transaction_id, current_user.id)
    categories = _reader_categories(db, current_user.id)
    return _receipt_payload(db, receipt, categories)


@router.put("/{transaction_id}")
def write_receipt_items(
    transaction_id: int,
    payload: ReceiptUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save the itemised receipt of a transaction.

    The lines that are there are changed in place: the name, the count,
    the price of one, the price of the whole and the category. A line
    the reader added is made, and a line they took away is taken away.

    The three numbers on the receipt are set from what was sent: the
    subtotal is the sum of the lines, the discount and the tax are what
    the reader wrote, and the total is the subtotal less the discount
    plus the tax.
    """
    receipt = _receipt_for_writing(db, transaction_id, current_user.id)
    categories = _reader_categories(db, current_user.id)

    existing = {item.id: item for item in (receipt.items or [])}
    kept = set()

    subtotal = 0.0
    for line in payload.items:
        name = (line.name or "").strip()

        quantity = line.quantity if line.quantity is not None else 1
        if quantity < 0:
            quantity = 0
        unit_price = line.unit_price if line.unit_price is not None else 0
        if unit_price < 0:
            unit_price = 0
        total_price = round(quantity * unit_price, 2)

        category_id = _category_id_of(categories, line.category_id)
        if category_id is None:
            category_id = _category_id_of(categories, line.category)
        category_name = None
        if category_id is not None:
            for category in categories:
                if category.id == category_id:
                    category_name = category.name
                    break

        item = existing.get(line.id) if line.id is not None else None
        if item is None:
            item = ReceiptItem(
                receipt_scan_id=receipt.id,
                line_number=len(kept) + 1,
            )
            db.add(item)
        else:
            kept.add(item.id)

        item.raw_name = name or item.raw_name
        item.canonical_name = item.canonical_name or name
        item.quantity = int(quantity)
        item.price_per_unit = Decimal(str(unit_price))
        item.total_price = Decimal(str(total_price))
        item.category = category_name
        if category_name:
            item.match_confidence = Decimal("1.0000")

        if not line.is_discount:
            subtotal += total_price

    # The lines the reader took away are taken away.
    for item_id, item in existing.items():
        if item_id not in kept:
            db.delete(item)

    discount = round(payload.discount_total or 0, 2)
    tax = round(payload.tax_total or 0, 2)

    receipt.subtotal = Decimal(str(round(subtotal, 2)))
    receipt.discount_total = Decimal(str(discount))
    receipt.tax_total = Decimal(str(tax))
    receipt.total_amount = Decimal(str(round(subtotal - discount + tax, 2)))

    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.error("Could not save the itemised receipt: %s", exc)
        raise HTTPException(status_code=400, detail=f"Rincian struk tidak valid: {exc}")

    db.refresh(receipt)
    return _receipt_payload(db, receipt, categories)


@router.post("/{transaction_id}/categorize")
def categorize_receipt_items(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Say what each line of the receipt probably is.

    The catalog is asked about the name of every line, and the answer
    is the category of the line. A line the catalog recognises nothing
    is left without a category: a wrong category is worse than none.

    Nothing is written. The reader looks at what was found, changes
    what they want, and saves it.
    """
    receipt = _receipt_for(db, transaction_id, current_user.id)
    categories = _reader_categories(db, current_user.id)

    items = list(receipt.items or [])
    found = categorize_items(
        [
            {
                "id": item.id,
                "name": item.raw_name or item.canonical_name or "",
            }
            for item in items
        ],
        categories,
    )

    lines = []
    for entry in found:
        category = entry.get("category")
        lines.append(
            {
                "id": entry.get("id"),
                "name": entry.get("name"),
                "category": getattr(category, "name", None),
                "category_id": getattr(category, "id", None),
                "confidence": entry.get("confidence", 0),
            }
        )

    return {
        "transaction_id": transaction_id,
        "items": lines,
    }
