"""
The recent transactions a reader can pull into a shared bill.

A shared bill usually starts from a receipt that was scanned. But
sometimes the receipt is already in the reader's own records - they
paid for it last week with their card, and the receipt was scanned
into their transactions - and they would rather not type it out a
second time.

This service finds those transactions and turns them into the lines of
a receipt that a bill can be made of.

Two rules govern what comes back:

    - only the reader's own transactions are ever looked at;
    - only the transactions that have an itemised receipt are worth
      importing, because a bill needs lines and a transaction without
      a receipt has only one line - the transaction itself.

The tax and the discount of the receipt come with it, because a bill
that has the lines but not the tax would not add up to what was
paid.
"""

from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.receipt import ReceiptItem, ReceiptScan
from app.models.transaction import Transaction


def _money(value: Any) -> float:
    """A number of money, as a plain number."""
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _receipt_of(db: Session, transaction: Transaction) -> Optional[ReceiptScan]:
    """The receipt of a transaction, when it has one."""
    if not transaction.receipt_scan_id:
        return None
    return (
        db.query(ReceiptScan)
        .options(joinedload(ReceiptScan.items))
        .filter(ReceiptScan.id == transaction.receipt_scan_id)
        .first()
    )


def _lines_of(receipt: ReceiptScan) -> List[Dict[str, Any]]:
    """
    The lines of a receipt, in the shape a bill is made of.

    A discount line on the receipt is kept as a line of its own, with
    the kind `discount`, because the reader can see on the paper that
    there was a discount and the bill has to show it too.
    """
    lines: List[Dict[str, Any]] = []
    for item in receipt.items or []:
        lines.append(
            {
                "name": item.raw_name or item.canonical_name or "Item",
                "quantity": float(item.quantity or 1),
                "unit_price": _money(item.price_per_unit),
                "total_price": _money(item.total_price),
                "kind": "discount" if item.is_discount else "item",
                "category": item.category or None,
            }
        )
    return lines


def importable_transactions(
    db: Session,
    user_id: int,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    The reader's recent transactions that can be pulled into a bill.

    Only the ones that came from a receipt are returned, because a
    bill is made of lines and a transaction without a receipt has only
    one line: the transaction itself.
    """
    count = max(1, min(int(limit or 20), 50))

    transactions = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.is_deleted.isnot(True),
            Transaction.receipt_scan_id.isnot(None),
        )
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(count)
        .all()
    )

    out: List[Dict[str, Any]] = []
    for transaction in transactions:
        receipt = _receipt_of(db, transaction)
        if receipt is None:
            continue

        lines = _lines_of(receipt)
        if not lines:
            continue

        out.append(
            {
                "transaction_id": transaction.id,
                "receipt_scan_id": receipt.id,
                "merchant_name": transaction.merchant_name or receipt.merchant_name,
                "description": transaction.description,
                "date": transaction.date.isoformat() if transaction.date else None,
                "amount": _money(transaction.amount),
                "subtotal": _money(receipt.subtotal),
                "discount_total": _money(receipt.discount_total),
                "tax_total": _money(receipt.tax_total),
                "total_amount": _money(receipt.total_amount),
                "items": lines,
            }
        )

    return out


def to_bill_payload(
    entry: Dict[str, Any],
    tax: Optional[Any] = None,
    discount: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    An importable transaction, as the payload of a new bill.

    The tax and the discount of the receipt come along, so that the
    bill adds up to what was paid. When the reader has changed them,
    the changed ones are used instead.
    """
    lines = list(entry.get("items") or [])

    subtotal = sum(
        _money(line.get("total_price"))
        for line in lines
        if line.get("kind") != "discount"
    )

    bill_tax = entry.get("tax_total") if tax is None else tax
    bill_discount = entry.get("discount_total") if discount is None else discount

    service = 0.0

    grand = subtotal + _money(bill_tax) + service - _money(bill_discount)

    return {
        "name": entry.get("merchant_name") or entry.get("description"),
        "merchant_name": entry.get("merchant_name"),
        "receipt_scan_id": entry.get("receipt_scan_id"),
        "receipt_date": entry.get("date"),
        "items": [
            {
                "name": line.get("name") or "Item",
                "quantity": str(line.get("quantity") or 1),
                "unit_price": str(line.get("unit_price") or 0),
                "total_price": str(line.get("total_price") or 0),
                "kind": line.get("kind") or "item",
                "category": line.get("category"),
            }
            for line in lines
        ],
        "subtotal": str(round(subtotal, 2)),
        "tax": str(round(_money(bill_tax), 2)),
        "service_charge": str(round(service, 2)),
        "discount": str(round(_money(bill_discount), 2)),
        "grand_total": str(round(grand, 2)),
    }
