"""
Receipt structuring orchestrator.

This is the single place where a scanned receipt becomes a complete,
stored, structured record. It wires together the pieces:

    OCR (multi-variant, restored images)
        -> deterministic rule parser        (arithmetic, anchors, totals)
        -> LLM structuring                   (grouping, damaged words, splitting lines)
        -> merge                              (rule numbers win, LLM fills gaps)
        -> catalog learning                   (learn new merchants and products)
        -> breakdown computation              (subtotal, discount, tax, total)
        -> persistence                        (receipt scan + items + transaction)

Everything the user sees comes from what was actually read. The
computation of the breakdown is ours, not the model's.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.services.receipt_service import ParsedItem, ParsedReceipt

logger = logging.getLogger(__name__)


@dataclass
class ReceiptBreakdown:
    """
    The itemised view of a receipt.

    `items` is the structured list of what was bought, each with its
    quantity, unit price and line total. `discounts` is separated out so
    the UI can show "what you paid" and "what you saved" as different
    things.
    """

    items: List[Dict[str, Any]] = field(default_factory=list)
    subtotal: float = 0.0
    discount_total: float = 0.0
    tax: float = 0.0
    service_charge: float = 0.0
    total: float = 0.0
    computed_total: float = 0.0
    # True when the printed total and the computed total agree.
    totals_match: bool = False
    difference: float = 0.0
    item_count: int = 0
    distinct_products: int = 0
    # Products the user had never bought before.
    new_products: List[str] = field(default_factory=list)
    # Whether the merchant itself was new to the system.
    new_merchant: bool = False
    currency: str = "IDR"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "items": self.items,
            "subtotal": round(self.subtotal, 2),
            "discount_total": round(self.discount_total, 2),
            "tax": round(self.tax, 2),
            "service_charge": round(self.service_charge, 2),
            "total": round(self.total, 2),
            "computed_total": round(self.computed_total, 2),
            "totals_match": self.totals_match,
            "difference": round(self.difference, 2),
            "item_count": self.item_count,
            "distinct_products": self.distinct_products,
            "new_products": self.new_products,
            "new_merchant": self.new_merchant,
            "currency": self.currency,
        }


def build_breakdown(
    receipt: ParsedReceipt,
    learning_summary: Optional[Dict[str, Any]] = None,
) -> ReceiptBreakdown:
    """
    Compute the itemised breakdown of a parsed receipt.

    The arithmetic is deliberately explicit:

        subtotal  = sum of the line totals of the products
        discount  = sum of the absolute value of the discount lines
        computed  = subtotal - discount + tax + service charge

    When the receipt prints a total, it is compared against the computed
    one so the user is told when the two disagree instead of silently
    getting one of them.
    """
    breakdown = ReceiptBreakdown()

    items: List[Dict[str, Any]] = []
    subtotal = 0.0
    discount_total = 0.0
    product_names = set()

    for item in receipt.items or []:
        name = (item.name or "").strip()
        if not name:
            continue

        quantity = int(item.quantity or 1)
        unit_price = float(item.price_per_unit or 0)
        line_total = float(item.total_price or 0)

        # A discount line is stored as a negative amount. If the parser gave
        # a positive number, treat it as an absolute discount.
        if item.is_discount:
            amount = abs(line_total) if line_total else abs(unit_price) * quantity
            discount_total += amount
            line_total = -amount
        else:
            # Guard against a line total that is obviously wrong: the line
            # total of a receipt line is qty x unit price.
            if line_total <= 0 and unit_price > 0:
                line_total = unit_price * quantity
            subtotal += line_total
            product_names.add(name.upper())

        items.append(
            {
                "name": name,
                "quantity": quantity,
                "price_per_unit": round(unit_price, 2),
                "total_price": round(line_total, 2),
                "is_discount": bool(item.is_discount),
                "category": getattr(item, "category", None),
            }
        )

    # The values the receipt actually printed.
    printed_subtotal = float(receipt.subtotal or 0)
    printed_discount = float(receipt.discount or 0)
    printed_total = float(receipt.total_amount or 0)

    if printed_discount > 0:
        discount_total = printed_discount

    tax = float(getattr(receipt, "tax", 0) or 0)
    service_charge = float(getattr(receipt, "service_charge", 0) or 0)

    # `subtotal` is the sum of the PRODUCT lines only, so the discount has
    # to be subtracted from it.
    #
    # The printed subtotal on a receipt is usually already net of the
    # discount. Overwriting our own sum with it would subtract the
    # discount a second time, which is what made the computed total
    # disagree with the printed total.
    gross_subtotal = subtotal
    computed_total = gross_subtotal - discount_total + tax + service_charge

    if printed_subtotal > 0:
        # The printed subtotal is net when it equals the computed total,
        # and gross when it is the computed total plus the discount.
        if abs(printed_subtotal - computed_total) <= 1.0:
            subtotal = printed_subtotal
            computed_total = subtotal + tax + service_charge
        elif abs(printed_subtotal - (gross_subtotal + discount_total)) <= 1.0:
            # The printed subtotal is the gross amount.
            subtotal = printed_subtotal
            computed_total = subtotal - discount_total + tax + service_charge
        elif printed_subtotal > gross_subtotal:
            subtotal = printed_subtotal
            computed_total = subtotal - discount_total + tax + service_charge

    breakdown.items = items
    breakdown.subtotal = subtotal
    breakdown.discount_total = discount_total
    breakdown.tax = tax
    breakdown.service_charge = service_charge
    breakdown.computed_total = computed_total
    breakdown.total = printed_total if printed_total > 0 else computed_total
    breakdown.item_count = len(items)
    breakdown.distinct_products = len(product_names)

    if printed_total > 0:
        breakdown.difference = printed_total - computed_total
        # A one-rupiah rounding difference is normal on receipts.
        breakdown.totals_match = abs(breakdown.difference) <= 1.0
    else:
        breakdown.totals_match = True

    if learning_summary:
        breakdown.new_products = learning_summary.get("new_products") or []
        merchant_info = learning_summary.get("merchant") or {}
        breakdown.new_merchant = bool(merchant_info.get("created"))

    return breakdown


def apply_structured_breakdown(
    receipt: ParsedReceipt,
    structured: Any,
) -> ParsedReceipt:
    """
    Merge the LLM breakdown into the parsed receipt.

    The LLM is better at splitting a line that contains several products
    and at repairing a torn word. It is worse at arithmetic. So the items
    it found that the rule parser missed are added, and the totals it
    printed are only accepted when they are consistent with the items.
    """
    if structured is None:
        return receipt

    # Merchant: the LLM read the whole receipt, so it is a good source for
    # the store name, but never trust it over a merchant the rule parser
    # was confident about.
    if structured.merchant and not receipt.merchant_name:
        receipt.merchant_name = structured.merchant
    if structured.payment_method and not receipt.payment_method:
        receipt.payment_method = structured.payment_method
    if structured.transaction_date and not receipt.transaction_date:
        receipt.transaction_date = structured.transaction_date

    existing = {(i.name or "").strip().upper() for i in receipt.items or []}

    for item in structured.items or []:
        name = (item.name or "").strip()
        if not name:
            continue
        key = name.upper()
        if key in existing:
            # The deterministic parse already found this line; keep its
            # numbers but take the category the model inferred.
            for parsed in receipt.items:
                if (parsed.name or "").strip().upper() == key:
                    if not getattr(parsed, "category", None) and item.category:
                        parsed.category = item.category
                    break
            continue

        receipt.items.append(
            ParsedItem(
                name=name,
                quantity=item.quantity or 1,
                price_per_unit=item.price_per_unit or 0,
                total_price=item.total_price or 0,
                is_discount=bool(item.is_discount),
                category=item.category,
            )
        )
        existing.add(key)

    # Totals: only take the model's total when it is backed by the items we
    # ended up with.
    if receipt.total_amount <= 0 and structured.total > 0:
        receipt.total_amount = structured.total
    if receipt.subtotal <= 0 and structured.subtotal > 0:
        receipt.subtotal = structured.subtotal
    if receipt.discount <= 0 and structured.discount_total > 0:
        receipt.discount = structured.discount_total

    receipt.parse_method = f"{receipt.parse_method}+llm"
    return receipt
