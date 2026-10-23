"""
LLM-assisted receipt structuring.

This module is the "AI half" of the hybrid approach. It takes the raw OCR
lines of a receipt and asks a language model to produce a *structured
breakdown*:

    store_info: merchant, address, date, time, receipt number
    items:     name, quantity, unit price, line total, is_discount
    financials: subtotal, discount total, tax, grand total

The important properties:

* **The model never invents the numbers.** The prompt forbids it from
  computing or altering any amount, and every amount the model returns is
  validated against the amounts that were actually present in the OCR
  text. A number that does not appear in the source is dropped. This
  keeps the result trustworthy - the arithmetic stays ours, the model only
  does the grouping and the reading of damaged words.
* **Graceful degradation.** If the model is unreachable or returns
  something unusable, the caller falls back to the deterministic parser.
  The scan never fails because an LLM is down.
* **Context aware.** The model sees the whole receipt at once, so it can
  repair a torn word using the lines around it - the thing a per-line
  regex parser fundamentally cannot do.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


STRUCTURING_PROMPT = """Kamu adalah sistem parser struk belanja yang sangat akurat.

Tugasmu: Membaca teks mentah hasil OCR dari struk belanja dan mengubahnya
menjadi JSON terstruktur.

ATURAN KETAT:
1. JANGAN pernah menghitung, menjumlahkan, atau mengubah angka apapun.
   Ambil setiap angka apa adanya dari teks. Sistem kami yang menghitung.
2. Setiap angka yang kamu keluarkan HARUS muncul persis di teks OCR.
3. Jangan mengarang nama barang. Jika teks rusak, tulis apa yang terbaca
   dan tambahkan field "uncertain": true.
4. Bedakan dengan jelas antara produk dan diskon. Baris diskon (DISC, DISKON,
   VOUCHER, POTONGAN, HARGA KEMAHALAN) memiliki is_discount = true dan
   total_price-nya negatif.
5. Jika satu baris berisi beberapa produk (dipisahkan koma atau titik),
   pecah menjadi beberapa item terpisah.
6._quantity_ boleh lebih dari 1. _price_per_unit_ adalah harga untuk SATU
   unit, _total_price_ adalah qty x harga satuan.
7. Tanggal dalam format YYYY-MM-DD. Waktu dalam format HH:MM.
8. Jangan mengarang merchant. Jika tidak yakin, merchant = "" (kosong).

Format output JSON persis seperti ini:
{
  "store_info": {
    "merchant": "",
    "address": "",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "receipt_number": "",
    "payment_method": ""
  },
  "items": [
    {
      "name": "",
      "quantity": 1,
      "price_per_unit": 0,
      "total_price": 0,
      "is_discount": false,
      "category": "",
      "uncertain": false
    }
  ],
  "financials": {
    "subtotal": 0,
    "discount_total": 0,
    "tax": 0,
    "total": 0
  }
}

Teks OCR:
---
{ocr_text}
---

Jawab HANYA dengan JSON, tanpa penjelasan.
"""


@dataclass
class StructuredItem:
    name: str
    quantity: int = 1
    price_per_unit: float = 0.0
    total_price: float = 0.0
    is_discount: bool = False
    category: Optional[str] = None
    uncertain: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "quantity": self.quantity,
            "price_per_unit": self.price_per_unit,
            "total_price": self.total_price,
            "is_discount": self.is_discount,
            "category": self.category,
            "uncertain": self.uncertain,
        }


@dataclass
class StructuredReceipt:
    merchant: Optional[str] = None
    address: Optional[str] = None
    transaction_date: Optional[str] = None
    transaction_time: Optional[str] = None
    receipt_number: Optional[str] = None
    payment_method: Optional[str] = None
    items: List[StructuredItem] = field(default_factory=list)
    subtotal: float = 0.0
    discount_total: float = 0.0
    tax: float = 0.0
    total: float = 0.0
    source: str = "llm"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "store_info": {
                "merchant": self.merchant,
                "address": self.address,
                "date": self.transaction_date,
                "time": self.transaction_time,
                "receipt_number": self.receipt_number,
                "payment_method": self.payment_method,
            },
            "items": [i.to_dict() for i in self.items],
            "financials": {
                "subtotal": self.subtotal,
                "discount_total": self.discount_total,
                "tax": self.tax,
                "total": self.total,
            },
            "source": self.source,
        }


# ---------------------------------------------------------------------------
# Validation: the model may only report numbers that exist in the source
# ---------------------------------------------------------------------------

NUMBER_RE = re.compile(r"\d[\d.,]*")


def _extract_source_amounts(ocr_text: str) -> List[float]:
    """
    All monetary-looking values that appear in the OCR text.

    Used to reject any number the model produced that is not in the
    source. This is what keeps the LLM from "helpfully" computing a total.
    """
    amounts: List[float] = []
    for match in NUMBER_RE.finditer(ocr_text or ""):
        raw = match.group(0)
        cleaned = raw.replace(".", "").replace(",", ".")
        try:
            value = float(cleaned)
        except ValueError:
            continue
        if value > 0:
            amounts.append(value)
    return amounts


def _amount_appears(value: float, source_amounts: List[float], tolerance: float = 0.51) -> bool:
    """
    True when `value` corresponds to a number present in the source.

    The tolerance absorbs the usual OCR formatting differences
    ("33.900" vs "33900") without letting a genuinely different number
    through.
    """
    if value == 0:
        return True
    for candidate in source_amounts:
        if abs(candidate - value) <= tolerance:
            return True
        # "33.900" in the text is 33900 in the receipt; the OCR may also
        # have split it as "33.900" == 33.900. Accept both readings.
        if candidate >= 1000 and abs(candidate / 1000 - value) <= tolerance:
            return True
    return False


def _coerce_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return 0.0
    text = re.sub(r"[^\d.,-]", "", text)
    if not text:
        return 0.0
    # Indonesian format: 33.900 means thirty three thousand nine hundred.
    if "," in text and "." in text:
        text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        return float(text)
    except ValueError:
        return 0.0


def _coerce_int(value: Any, default: int = 1) -> int:
    if value is None:
        return default
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def parse_structured_response(
    payload: Any,
    ocr_text: str,
) -> Optional[StructuredReceipt]:
    """
    Turn the model's JSON into a StructuredReceipt, or None if it is not
    usable.

    Every number is checked against the source text. Numbers that do not
    appear are dropped rather than trusted.
    """
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (ValueError, TypeError):
            # The model sometimes wraps the JSON in a code fence.
            cleaned = re.sub(r"^```(?:json)?|```$", "", payload.strip(), flags=re.M)
            try:
                payload = json.loads(cleaned)
            except (ValueError, TypeError):
                return None

    if not isinstance(payload, dict):
        return None

    source_amounts = _extract_source_amounts(ocr_text)
    store = payload.get("store_info") or {}
    financials = payload.get("financials") or {}
    raw_items = payload.get("items") or []

    receipt = StructuredReceipt()
    receipt.merchant = (store.get("merchant") or "").strip() or None
    receipt.address = (store.get("address") or "").strip() or None
    receipt.transaction_date = (store.get("date") or "").strip() or None
    receipt.transaction_time = (store.get("time") or "").strip() or None
    receipt.receipt_number = (store.get("receipt_number") or "").strip() or None
    receipt.payment_method = (store.get("payment_method") or "").strip() or None

    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        name = (raw.get("name") or "").strip()
        if not name:
            continue

        quantity = _coerce_int(raw.get("quantity"), 1)
        unit_price = _coerce_float(raw.get("price_per_unit"))
        total_price = _coerce_float(raw.get("total_price"))
        is_discount = bool(raw.get("is_discount"))

        # Reject numbers that are not in the source.
        if not _amount_appears(unit_price, source_amounts):
            unit_price = 0.0
        if not _amount_appears(total_price, source_amounts):
            total_price = 0.0

        # If the model gave a unit price and a quantity but no line total,
        # the line total is ours to derive - the model was told not to
        # compute, but a missing field is not a number we have to trust.
        if total_price == 0.0 and unit_price > 0:
            total_price = unit_price * quantity

        receipt.items.append(
            StructuredItem(
                name=name,
                quantity=quantity,
                price_per_unit=unit_price,
                total_price=total_price,
                is_discount=is_discount,
                category=(raw.get("category") or "").strip() or None,
                uncertain=bool(raw.get("uncertain")),
            )
        )

    receipt.subtotal = _coerce_float(financials.get("subtotal"))
    receipt.discount_total = _coerce_float(financials.get("discount_total"))
    receipt.tax = _coerce_float(financials.get("tax"))
    receipt.total = _coerce_float(financials.get("total"))

    for attr in ("subtotal", "discount_total", "tax", "total"):
        value = getattr(receipt, attr)
        if not _amount_appears(value, source_amounts):
            setattr(receipt, attr, 0.0)

    # No usable items means the model did not really read the receipt.
    if not receipt.items:
        return None

    return receipt


def structure_with_llm(
    ocr_lines: List[str],
    ocr_text: Optional[str] = None,
    timeout: int = 45,
) -> Optional[StructuredReceipt]:
    """
    Ask the LLM to structure the receipt.

    Returns None when the model is unavailable or its answer is not
    usable, in which case the caller keeps the deterministic result.
    """
    text = ocr_text or "\n".join(ocr_lines or [])

    try:
        from app.services.gemini_vision import call_gemini_text

        raw = call_gemini_text(
            STRUCTURING_PROMPT.replace("{ocr_text}", text),
            timeout=timeout,
        )
    except Exception as exc:  # noqa: BLE001 - the LLM is strictly optional
        logger.warning(f"LLM structuring unavailable: {exc}")
        return None

    if not raw:
        return None

    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        payload = raw

    structured = parse_structured_response(payload, text)
    if structured:
        logger.info(
            f"LLM produced {len(structured.items)} items, "
            f"total={structured.total}, source={structured.source}"
        )
    return structured


def merge_with_rule_result(
    structured: StructuredReceipt,
    rule_items: List[Any],
) -> StructuredReceipt:
    """
    Merge the LLM breakdown with the deterministic parse.

    The LLM is better at reading damaged text and splitting a line that
    contains several products. The rule parser is better at arithmetic and
    at catching a price the model misread.

    Where both found the same line, the rule parser's numbers win - they
    come from a deterministic source. The LLM contributes items the rule
    parser missed entirely.
    """
    if not rule_items:
        return structured

    existing = {i.name.strip().upper() for i in structured.items}
    for rule_item in rule_items:
        name = (getattr(rule_item, "name", "") or "").strip()
        if not name:
            continue
        key = name.upper()
        if key in existing:
            # Prefer the deterministic numbers.
            for item in structured.items:
                if item.name.strip().upper() == key:
                    if getattr(rule_item, "quantity", 0):
                        item.quantity = rule_item.quantity
                    if getattr(rule_item, "price_per_unit", 0):
                        item.price_per_unit = rule_item.price_per_unit
                    if getattr(rule_item, "total_price", 0):
                        item.total_price = rule_item.total_price
                    item.is_discount = bool(getattr(rule_item, "is_discount", False))
                    break
            continue
        structured.items.append(
            StructuredItem(
                name=name,
                quantity=getattr(rule_item, "quantity", 1) or 1,
                price_per_unit=getattr(rule_item, "price_per_unit", 0) or 0,
                total_price=getattr(rule_item, "total_price", 0) or 0,
                is_discount=bool(getattr(rule_item, "is_discount", False)),
            )
        )
        existing.add(key)

    return structured
