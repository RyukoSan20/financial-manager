"""
One product, one line.

A receipt shows the same purchase more than once. The OCR reads
"KOPI JAGO VANILA 2 X" on the line that carries the price, and
"KOPI Jago vanila" on the line that carries the name. They are the same
two coffees at fifteen thousand each, and a reader who sees both lines
thinks they were charged twice.

The two names are not the same string, so a comparison of the strings
does not find them. What is the same is the *product*: the letters,
with the quantity that the receipt wrote next to them taken away.

So the name is normalised before anything is compared:

  "Kopi Jago vanila 2 x"  ->  "KOPI JAGO VANILA"
  "Kopi Jago vanila x2"   ->  "KOPI JAGO VANILA"
  "KOPI JAGO VANILA 2 PCS"->  "KOPI JAGO VANILA"
  "Kopi  Jago,  vanila"   ->  "KOPI JAGO VANILA"

The quantity is not thrown away. It is read out of the name and put
back into the quantity of the line, because "2 X" is the receipt saying
there are two of them and that belongs in the quantity, not in the
name.

This module is used in three places:

  - the service that reads a receipt, when it keeps one row per product
  - the service that folds the model's reading into the local reading
  - the scan worker, when it puts the lines of a receipt together
"""

import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

# The words a receipt uses for "how many of these".
_COUNT_WORDS = {
    "pcs": 1, "pc": 1, "biji": 1, "bh": 1, "fruit": 1, "item": 1,
    "items": 1, "pack": 1, "pck": 1, "box": 1, "btg": 1, "satuan": 1,
    "x": 1, "times": 1, "bill": 1,
}

# The words that are not a number but sit where a number would be.
_NOISE_WORDS = {
    "diskon", "discount", "hemat", "potongan", "voucher", "promo",
    "subtotal", "total", "tunai", "cash", "kartu", "card", "debit",
    "kredit", "credit", "change", "kembali", "bayar", "payment",
}

# The number of one, written in the ways a receipt writes it.
_ONE_WORDS = {"satu", "one", "1", "a", "an"}


def _strip_count_words(text: str) -> str:
    """
    Take the counting words out of a name.

    "2 PCS", "2 BUAH", "1 Biji" all say how many there are, not what
    the product is called.
    """
    for word in _COUNT_WORDS:
        text = re.sub(rf"\b{word}\b\.?", " ", text, flags=re.IGNORECASE)
    for word in _NOISE_WORDS:
        text = re.sub(rf"\b{word}\b\.?", " ", text, flags=re.IGNORECASE)
    return text


def _read_leading_count(text: str) -> Tuple[Optional[float], str]:
    """
    Read a quantity that was written before the name.

    "2x kopi", "3 x kopi", "2XKOPI" - the number comes first here.
    """
    match = re.match(r"^\s*(\d+(?:[.,]\d+)?)\s*([xX])\s*(.*)$", text)
    if not match:
        return None, text

    number = float(match.group(1).replace(",", "."))
    rest = match.group(3).strip()
    # "2x" is one thing, not two. "2x" alone means two of it.
    if number.is_integer():
        number = int(number)
    return number, rest


def _read_trailing_count(text: str) -> Tuple[Optional[float], str]:
    """
    Read a quantity that was written after the name.

    "Kopi 2 x", "Kopi 2x", "Kopi 2", "Kopi 2 pcs".
    """
    # The count is at the end: a number, then optionally an "x" and
    # optionally a word that says "pieces".
    #
    # "2 x", "2x" and "2" all say how many. "x2" says it too, but the
    # "x" comes first there, so it has its own reading.
    match = re.search(
        r"\s+(\d+(?:[.,]\d+)?)\s*(?:[xX]\b|\bpcs\b\.?|\bbiji\b\.?|\bbh\b\.?)?\s*$",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        # "2 BUAH" - the number comes first and the counting word comes
        # after it.
        match = re.search(
            r"\s+(\d+(?:[.,]\d+)?)\s*\b(?:pcs|pc|biji|bh|buah|fruit|item|items|pack|pck|box|btg|satuan)\b\.?\s*$",
            text,
            flags=re.IGNORECASE,
        )
    if not match:
        match = re.search(
            r"\s+[xX]\s*(\d+(?:[.,]\d+)?)\s*$",
            text,
            flags=re.IGNORECASE,
        )
        if not match:
            return None, text
        number = float(match.group(1).replace(",", "."))
        if number.is_integer():
            number = int(number)
        rest = text[: match.start()].rstrip(" .,;:-")
        return number, rest

    number = float(match.group(1).replace(",", "."))
    if number.is_integer():
        number = int(number)

    rest = text[: match.start()].rstrip(" .,;:-")

    # A number that is part of the product name is left alone. "Coca
    # Cola 400ml" is a product, not two of something.
    if re.match(r"^\d+(?:\.\d+)?\s*(ml|l|kg|gr|g|mg)$", rest, flags=re.IGNORECASE):
        return None, text

    return number, rest


def split_count_from_name(name: str) -> Tuple[str, Optional[float]]:
    """
    Take the name and the quantity apart.

    The name is what the product is called, and the quantity is how
    many of them the receipt is talking about. The two are written
    together on a receipt, so they have to be told apart before
    anything can be compared.
    """
    if not name:
        return "", None

    text = str(name).strip()

    # A number written as a word at the front: "dua kopi".
    text = re.sub(r"^\s*(satu|dua|three|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\b\s*",
                  " ", text, flags=re.IGNORECASE)

    count: Optional[float] = None

    leading, text = _read_leading_count(text)
    if leading is not None:
        count = leading

    trailing, text = _read_trailing_count(text)
    if trailing is not None and count is None:
        count = trailing
    elif trailing is not None and count is not None:
        # Both ends had a number. The one at the front wins, because
        # "2x kopi 2" is two coffees, and the trailing 2 is the price
        # column that was swept into the name.
        count = leading

    text = _strip_count_words(text)

    # A leading "x" that was left over: "x2 kopi".
    match = re.match(r"^\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*(.*)$", text)
    if match:
        number = float(match.group(1).replace(",", "."))
        count = int(number) if number.is_integer() else number
        text = match.group(2)

    # The name itself, with the punctuation and the spacing put right.
    cleaned = re.sub(r"[^A-Za-z0-9]+", " ", text).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)

    return cleaned, count


def normalize_item_name(name: str) -> str:
    """
    The key two lines are compared by.

    Two lines are the same product when their names are the same once
    the quantity that was written next to them is taken away.
    """
    cleaned, _ = split_count_from_name(name)
    return cleaned.upper()


def _as_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _line_total(line: Dict[str, Any]) -> float:
    """
    What the line costs in total.

    A line can say its total, or say the price of one and how many
    there are. The second is worked out, because a receipt that says
    "2 x 15000" means thirty thousand.
    """
    total = _as_float(line.get("total_price") or line.get("subtotal") or line.get("total"))
    if total:
        return total

    unit = _as_float(line.get("price_per_unit") or line.get("unit_price"))
    quantity = _as_float(line.get("quantity")) or 1.0
    return unit * quantity


def reconcile_line_items(
    lines: Iterable[Dict[str, Any]],
    total_amount: Optional[float] = None,
    tolerance: float = 1.0,
) -> List[Dict[str, Any]]:
    """
    One row per product.

    The lines are read one after another. A line whose product has
    already been seen is folded into the row that is already there:
    the quantities add up, and the price that was really written on the
    receipt wins over one that was worked out.

    When the lines already add up to the total of the receipt, nothing
    is added to them. That matters because the reading of the receipt
    and the breakdown of the receipt are two readings of the same
    receipt, and putting one on top of the other gives every purchase
    twice.
    """
    kept: List[Dict[str, Any]] = []
    index: Dict[str, Dict[str, Any]] = {}

    for raw_line in lines or []:
        if not isinstance(raw_line, dict):
            continue

        line = dict(raw_line)
        name = line.get("name") or line.get("raw_name") or ""
        key = normalize_item_name(name)

        if not key:
            # A line with no name cannot be told apart from anything.
            # It is kept as it is, because throwing it away loses a
            # purchase; but it never merges with another line.
            kept.append(line)
            continue

        count_from_name, _ = split_count_from_name(name)
        quantity = _as_float(line.get("quantity")) or 0.0
        if not quantity and count_from_name:
            quantity = float(count_from_name)

        existing = index.get(key)
        if existing is None:
            if not quantity:
                quantity = 1.0
            line["quantity"] = quantity
            # The name that is kept is the plain one: the quantity is
            # not part of what the product is called.
            line["name"] = count_from_name or name
            kept.append(line)
            index[key] = line
            continue

        # The same product, seen twice. Fold the second into the
        # first rather than making a second row.
        existing_quantity = _as_float(existing.get("quantity")) or 1.0
        if existing.get("is_discount") or line.get("is_discount"):
            # A discount is its own line. It keeps its own row.
            kept.append(line)
            index[f"{key}#discount{len(kept)}"] = line
            continue

        # The quantity of the receipt is the truth. Two readings of
        # "2 x kopi" both say two, so the larger of the two is used
        # rather than their sum, which would say four.
        merged_quantity = max(existing_quantity, quantity or 1.0)
        existing["quantity"] = merged_quantity

        # The price that was really on the receipt wins.
        existing_unit = _as_float(existing.get("price_per_unit") or existing.get("unit_price"))
        line_unit = _as_float(line.get("price_per_unit") or line.get("unit_price"))
        if line_unit and (not existing_unit or existing.get("unit_price") is None):
            existing["price_per_unit"] = line_unit
            existing["unit_price"] = line_unit
        elif existing_unit:
            existing["price_per_unit"] = existing_unit
            existing["unit_price"] = existing_unit

        existing_total = _line_total(existing)
        line_total = _line_total(line)
        if line_total and (not existing_total or existing.get("total_price") in (None, 0)):
            existing["total_price"] = line_total
            existing["subtotal"] = line_total
        else:
            existing["total_price"] = existing_total
            existing["subtotal"] = existing_total

        # Anything the second reading knew and the first did not.
        for field in ("category", "variant", "variant_or_note", "notes"):
            if not existing.get(field) and line.get(field):
                existing[field] = line[field]

    if total_amount:
        expected = float(total_amount)
        sum_of_lines = sum(_line_total(line) for line in kept)
        # The lines of the receipt add up to the receipt. Nothing else
        # is added to them.
        if abs(sum_of_lines - expected) > tolerance:
            # The lines do not add up to the total. The total is the
            # truth, so a line that is missing is worked out from what
            # is left over. This happens when the receipt has a tax
            # line that was read as a product.
            remainder = expected - sum_of_lines
            if remainder > 0 and len(kept) == 1:
                only = kept[0]
                only["total_price"] = _line_total(only) + remainder
                only["subtotal"] = only["total_price"]

    return kept


def items_add_up(
    lines: Iterable[Dict[str, Any]],
    total_amount: Optional[float],
    tolerance: float = 1.0,
) -> bool:
    """
    Whether the lines of a receipt are the whole receipt.

    When they are, another reading of the same receipt has nothing to
    add, and adding it anyway is how a purchase ends up on the screen
    twice.
    """
    if not total_amount:
        return False
    kept = list(lines or [])
    if not kept:
        return False
    sum_of_lines = sum(_line_total(line) for line in kept)
    return abs(sum_of_lines - float(total_amount)) <= tolerance


__all__ = [
    "split_count_from_name",
    "normalize_item_name",
    "reconcile_line_items",
    "items_add_up",
]
