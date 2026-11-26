"""
Reading a receipt when nothing else can.

The receipt reader has three readers: the vision model, the local OCR
engine, and this one. This one never fails, needs no key, no model and
no network, and works on the plain text of a receipt.

It is the last one standing when the others are not there - a reader
without a key for the vision model, a deployment where the model is
slow, a photograph too blurred for the OCR engine. In those cases the
reader still gets a complete, editable result instead of an error
screen and a lost purchase.

What it finds:

  - the shop, from the first line that looks like a name;
  - the total, from the line that says "total";
  - the date, from the line that has one;
  - the lines, from the lines that have a name and a price on them.

What it cannot find, it leaves empty, and the reader fills it in. That
is the point: a receipt that is half-read and editable is worth a
great deal more than a receipt that failed to be read at all.
"""

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

# The words that mean "this is the total", in the order they are
# trusted. "grand total" is trusted more than "total", because a
# receipt often has a "total" before the discount as well.
TOTAL_WORDS = ("grand total", "total akhir", "total bayar", "jumlah bayar", "total")

# The words that mean "this is the price of one".
UNIT_PRICE_WORDS = ("harga satuan", "harga", "unit price", "price")

# The words that mean "this line is a discount".
DISCOUNT_WORDS = ("diskon", "discount", "hemat", "potongan", "voucher")

# The words that mean "this line is a tax".
TAX_WORDS = ("pajak", "ppn", "tax", "pb1")

# The words that mean "this line is the service charge".
FEE_WORDS = ("service charge", "biaya layanan", "biaya admin", "admin fee")

# The words that mean "this is the payment, not a line of the bill".
PAYMENT_WORDS = (
    "kembali", "change", "tunai", "cash", "debit", "kredit", "credit",
    "qris", "ovo", "gopay", "dana", "shopeepay", "bca", "bni", "mandiri",
    "transfer", "saldo", "balance", "no. card", "no card", "card no",
)

# The words that mean "this line is not the name of a shop".
NOT_A_MERCHANT = (
    "struk", "receipt", "invoice", "faktur", "nota", "bill", "kwitansi",
    "www.", "http", "download", "powered by", "terima kasih", "thank you",
)

# A rupiah amount, written the way it is written in Indonesia.
AMOUNT_RE = re.compile(
    r"(?:rp\.?\s*)?(\d[\d.,]*)\s*(k|rb|ribu|jt|juta)?(?![a-z0-9])",
    re.IGNORECASE,
)

SCALE = {"": 1, "k": 1000, "rb": 1000, "ribu": 1000, "jt": 1000000, "juta": 1000000}

# A date, in the shapes a receipt writes one.
DATE_PATTERNS = (
    re.compile(r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b"),
    re.compile(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b"),
    re.compile(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{2})\b"),
)

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "mei": 5, "jun": 6, "june": 6,
    "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "sept": 9,
    "september": 9, "oct": 10, "okt": 10, "october": 10, "nov": 11,
    "november": 11, "dec": 12, "des": 12, "december": 12,
}

MONTH_RE = re.compile(
    r"\b(\d{1,2})\s+(" + "|".join(sorted(MONTHS, key=len, reverse=True)) + r")\.?\s*(\d{2,4})?\b",
    re.IGNORECASE,
)


def parse_amount(raw: str) -> Optional[float]:
    """
    The rupiah value of a written amount.

    "15.500" is fifteen thousand five hundred, because the dot is a
    thousands separator. "8,5" is eight and a half, because the comma
    is a decimal mark.
    """
    text = str(raw or "").strip()
    if not text:
        return None

    if "." in text and "," in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "." in text:
        head, _, tail = text.rpartition(".")
        text = text.replace(".", "") if (len(tail) == 3 and head) else text
    elif "," in text:
        head, _, tail = text.rpartition(",")
        text = text.replace(",", "") if (len(tail) == 3 and head) else text.replace(",", ".")

    try:
        return float(text)
    except ValueError:
        return None


def amounts_in(line: str) -> List[Tuple[float, int, int]]:
    """
    Every amount written in a line, with where it was written.

    Returns a list of (amount, start, end). The positions matter: the
    last amount on a line is usually the total of that line, and an
    amount before it is usually the price of one.
    """
    found = []
    for match in AMOUNT_RE.finditer(line or ""):
        value = parse_amount(match.group(1))
        if value is None or value <= 0:
            continue
        scale = SCALE.get((match.group(2) or "").lower(), 1)
        found.append((value * scale, match.start(), match.end()))
    return found


def find_total(lines: List[str]) -> Tuple[float, bool]:
    """
    The total of the receipt.

    The line that says "total" is trusted. When there is more than one,
    the last one is taken: the total that is printed at the bottom is
    the one the reader paid.

    When no line says "total", the largest amount on the receipt is
    used. On a receipt, the biggest number is nearly always the total.
    """
    best = 0.0
    found = False
    for line in lines:
        lowered = line.lower()
        # "subtotal" is not the total. It is the total before the
        # discount and the tax, which is a smaller number, and reading
        # it as the total makes the receipt look more expensive than it
        # was.
        if "subtotal" in lowered or "sub total" in lowered:
            continue
        if not any(word in lowered for word in TOTAL_WORDS):
            continue
        for amount, _start, _end in amounts_in(line):
            if amount > best:
                best = amount
                found = True

    if found:
        return best, True

    # No line said "total". The biggest number on the receipt is the
    # best guess there is.
    for line in lines:
        for amount, _start, _end in amounts_in(line):
            if amount > best:
                best = amount
    return best, False


def find_merchant(lines: List[str]) -> Optional[str]:
    """
    The name of the shop.

    It is the first line that looks like a name: has letters in it, is
    not too long, and is not one of the words that are never a shop.
    """
    for line in lines[:6]:
        cleaned = line.strip(" \t*=-—–_|")
        if len(cleaned) < 3 or len(cleaned) > 60:
            continue
        lowered = cleaned.lower()
        if any(word in lowered for word in NOT_A_MERCHANT):
            continue
        # A line that is nothing but a number is not a name.
        if not re.search(r"[a-zA-Z]{2,}", cleaned):
            continue
        # A line that is mostly numbers is a price or a date.
        letters = len(re.findall(r"[a-zA-Z]", cleaned))
        if letters < 3:
            continue
        return cleaned
    return None


def find_date(lines: List[str]) -> Optional[str]:
    """
    The day the receipt was written, as "YYYY-MM-DD".
    """
    for line in lines[:10]:
        for pattern in DATE_PATTERNS:
            match = pattern.search(line)
            if not match:
                continue
            groups = match.groups()
            if len(groups[0]) == 4:
                year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
            else:
                day, month, year = int(groups[0]), int(groups[1]), int(groups[2])
                if year < 100:
                    year += 2000
            try:
                return date(year, month, day).isoformat()
            except ValueError:
                continue

        month_match = MONTH_RE.search(line)
        if month_match:
            day = int(month_match.group(1))
            month = MONTHS[month_match.group(2).lower()]
            year = month_match.group(3)
            if year:
                year = int(year)
                if year < 100:
                    year += 2000
            else:
                year = date.today().year
            try:
                return date(year, month, day).isoformat()
            except ValueError:
                continue

    return None


def find_payment_method(lines: List[str]) -> Optional[str]:
    """
    How it was paid, when the receipt says.
    """
    for line in lines:
        lowered = line.lower()
        for word in ("gopay", "ovo", "dana", "shopeepay", "linkaja", "qris",
                     "visa", "mastercard", "debit", "kredit", "credit", "tunai", "cash"):
            if word in lowered:
                return word.upper() if len(word) <= 4 else word.title()
    return None


def find_location(lines: List[str]) -> Optional[str]:
    """
    The address, when the receipt prints one.
    """
    for line in lines:
        if re.search(r"\b(jl\.?|jalan|street|addr|alamat|rt\.?\s*\d|rw\.?\s*\d|no\.?\s*\d+)\b", line, re.IGNORECASE):
            cleaned = line.strip()
            if len(cleaned) <= 120:
                return cleaned
    return None


def _clean_item_name(text: str) -> str:
    """
    The name of a line of the bill, with the noise taken off.
    """
    cleaned = text.strip(" \t*=-—–_|")
    # Drop a trailing quantity marker: "Kopi Susu 2 x"
    cleaned = re.sub(r"\s+\d+\s*[xX]\s*$", "", cleaned)
    # Drop a leading quantity: "2 x Kopi Susu"
    cleaned = re.sub(r"^\d+\s*[xX]\s*", "", cleaned)
    return cleaned.strip(" .-–—")


def parse_line_items(lines: List[str]) -> List[Dict[str, Any]]:
    """
    The lines of the bill.

    A line of the bill has a name and one or two amounts: the price of
    one and the total of the line. A line that only has one amount is
    a line of one thing, so the amount is both the price and the total.
    """
    items: List[Dict[str, Any]] = []

    for line in lines:
        cleaned = line.strip()
        if not cleaned:
            continue

        lowered = cleaned.lower()
        if any(word in lowered for word in DISCOUNT_WORDS):
            continue
        if any(word in lowered for word in TAX_WORDS):
            continue
        if any(word in lowered for word in FEE_WORDS):
            continue
        if any(word in lowered for word in PAYMENT_WORDS):
            continue
        if any(word in lowered for word in TOTAL_WORDS):
            continue
        if any(word in lowered for word in NOT_A_MERCHANT):
            continue
        # An address is not a line of the bill. It has a number in it
        # - a street number - and a reader would end up buying "Jl.
        # Kemayoran No" for twelve thousand rupiah.
        if re.search(r"\b(jl\.?|jalan|street|alamat|addr)\b", lowered):
            continue
        # A line that is only a number is a date, a time or a code.
        if not re.search(r"[a-zA-Z]{3,}", cleaned):
            continue

        found = amounts_in(cleaned)
        if not found:
            continue

        # The last amount is the total of the line. The one before it,
        # when there is one, is the price of one.
        total = found[-1][0]
        unit_price = total
        quantity = 1.0

        if len(found) >= 2:
            unit_price = found[-2][0]
            if unit_price > 0:
                quantity = round(total / unit_price, 2)
            else:
                unit_price = total

        # The name is what is left of the line before the first amount.
        name_end = found[0][1]
        name = _clean_item_name(cleaned[:name_end])

        if not name or len(name) < 2:
            continue
        if not re.search(r"[a-zA-Z]{2,}", name):
            continue

        # A count that was written on the line wins over the one that
        # was worked out from the division.
        count_match = re.search(r"(\d+)\s*[xX]\b", cleaned[:name_end])
        if count_match:
            quantity = float(count_match.group(1))

        items.append(
            {
                "name": name,
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": total,
                "price_per_unit": unit_price,
                "total": total,
                "category": None,
                "is_discount": False,
            }
        )

    return items


def read_receipt_text(text: str) -> Dict[str, Any]:
    """
    Read a receipt out of its plain text.

    This is the reading that always works. It needs nothing but the
    text of the receipt, and it answers with the shop, the day, the
    total, the way it was paid, the place, and the lines of the bill.
    """
    raw = text or ""
    lines = [line.strip() for line in raw.splitlines()]
    lines = [line for line in lines if line]

    total, total_is_stated = find_total(lines)
    merchant = find_merchant(lines)
    items = parse_line_items(lines)

    # When the lines do not add up to the total, the total is still
    # what the receipt says: the reader paid that. The lines are shown
    # as they were read, and the reader can correct them.
    lines_total = round(sum(item["total_price"] for item in items), 2)

    return {
        "merchant_name": merchant,
        "date": find_date(lines),
        "total_amount": total,
        "total_is_stated": total_is_stated,
        "items": items,
        "items_total": lines_total,
        "payment_method": find_payment_method(lines),
        "location": find_location(lines),
        "raw_text": raw[:5000],
        "raw_lines": lines[:200],
        "parse_method": "structured_fallback",
        # The fallback is honest about how sure it is. It found the
        # total by reading it, so it is sure about that; it guessed at
        # the shop and the lines.
        "confidence": 0.55 if (merchant and total) else 0.35,
    }


def ensure_receipt_shape(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    A receipt, in the shape the interface expects.

    Whatever produced the reading - the vision model, the local OCR
    engine, or the fallback - the answer comes back in the same shape,
    with every field present and every line of the bill in the same
    form. A missing field is filled in with nothing rather than being
    left out, so the screen never has to check whether a key is there.
    """
    result = dict(data or {})
    items = []

    for raw in result.get("items") or []:
        if not isinstance(raw, dict):
            continue
        name = raw.get("name") or raw.get("raw_name") or ""
        if not str(name).strip():
            continue
        quantity = raw.get("quantity")
        try:
            quantity = float(quantity) if quantity is not None else 1.0
        except (TypeError, ValueError):
            quantity = 1.0
        if quantity <= 0:
            quantity = 1.0

        unit_price = (
            raw.get("unit_price")
            if raw.get("unit_price") is not None
            else raw.get("price_per_unit")
        )
        total = raw.get("total_price")
        if total is None:
            total = raw.get("total")
        if total is None:
            total = raw.get("amount")

        try:
            unit_price = float(unit_price) if unit_price is not None else 0.0
        except (TypeError, ValueError):
            unit_price = 0.0
        try:
            total = float(total) if total is not None else 0.0
        except (TypeError, ValueError):
            total = 0.0

        if not total and unit_price:
            total = unit_price * quantity

        items.append(
            {
                "name": str(name).strip(),
                "quantity": quantity,
                "unit_price": unit_price,
                "price_per_unit": unit_price,
                "total_price": total,
                "total": total,
                "category": raw.get("category"),
                "is_discount": bool(raw.get("is_discount", False)),
            }
        )

    amount = result.get("total_amount")
    if amount in (None, ""):
        amount = result.get("amount")
    try:
        amount = float(amount) if amount not in (None, "") else 0.0
    except (TypeError, ValueError):
        amount = 0.0

    if not amount:
        amount = round(sum(item["total_price"] for item in items), 2)

    return {
        "merchant_name": result.get("merchant_name") or None,
        "date": result.get("date") or result.get("transaction_date") or None,
        "total_amount": amount,
        "amount": str(int(amount)) if amount else "0",
        "items": items,
        "payment_method": result.get("payment_method") or None,
        "location": result.get("location") or result.get("merchant_address") or None,
        "raw_text": result.get("raw_text") or "",
        "raw_lines": result.get("raw_lines") or [],
        "parse_method": result.get("parse_method") or "unknown",
        "confidence": float(result.get("confidence") or 0.5),
        "category_hint": result.get("category_hint") or "shopping",
    }


__all__ = [
    "read_receipt_text",
    "ensure_receipt_shape",
    "parse_amount",
    "find_total",
    "find_merchant",
    "find_date",
    "parse_line_items",
]
