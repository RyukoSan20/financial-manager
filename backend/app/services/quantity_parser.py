"""
How many, and at what price each.

The reader who buys two packets of Indomie at three thousand five
hundred each should not have to work the total out in their head, and
should not have to write the total and lose the count.

This is the server's reading of that sentence, and it is the same
reading the browser's quick entry box does, so the two never disagree
about what the reader said.

The shapes that are understood:

    2 indomie 3500            the count before the thing
    indomie 2x 3500           the count after the thing, with an x
    ayam 4 @ 35rb             the count with an at sign
    indomie 2 bungkus harga satuan 3500

What is NOT multiplied:

    kopi 45rb                 one thing is not a multiplication
    kopi 2 orang 50k          fifty thousand is the whole, not each
    2026 indomie 3500         a year is not a count of packets

A sentence is only multiplied when there is both a count and a price,
and when the words make it plain that the price is the price of one.
Otherwise the sentence is left exactly as it was, because a wrong total
is worse than no total.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Optional, Tuple


# The words that say the price is the price of one.
UNIT_PRICE_WORDS = (
    "harga satuan",
    "harga satuannya",
    "harga per",
    "per pcs",
    "per buah",
    "satuan",
    "unit price",
)

# The words that say the price belongs to everybody together.
WHOLE_PRICE_WORDS = (
    "orang",
    "masing",
    "per orang",
    "total",
    "semua",
    "sebesar",
)

# The count, in words.
COUNT_WORDS = {
    "satu": 1, "one": 1,
    "dua": 2, "two": 2,
    "tiga": 3, "three": 3,
    "empat": 4, "four": 4,
    "lima": 5, "five": 5,
    "enam": 6, "six": 6,
    "tujuh": 7, "seven": 7,
    "delapan": 8, "eight": 8,
    "sembilan": 9, "nine": 9,
    "sepuluh": 10, "ten": 10,
    "selusin": 12, "dozen": 12,
}

MAX_QUANTITY = 1000
MAX_TOTAL = Decimal("1000000000")


@dataclass(frozen=True)
class QuantityReading:
    """
    What the sentence said: how many, at what price of each, and what
    that comes to.
    """

    quantity: int
    unit_price: int
    total: int
    description: str


def _to_number(raw: str) -> Optional[Decimal]:
    """
    A number the way the reader writes it.

    "15.500" is fifteen thousand five hundred, because the dot is a
    thousands separator. "1,5" is one and a half, because the comma is
    a decimal mark.
    """
    raw = raw.strip()
    if not raw:
        return None

    if "." in raw and "," in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "." in raw:
        head, _, tail = raw.rpartition(".")
        raw = raw.replace(".", "") if (len(tail) == 3 and head) else raw
    elif "," in raw:
        head, _, tail = raw.rpartition(",")
        raw = raw.replace(",", "") if (len(tail) == 3 and head) else raw.replace(",", ".")

    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError):
        return None


def _find_amount(text: str) -> Optional[Tuple[Decimal, Tuple[int, int]]]:
    """
    The first money in the sentence, and where it sits.
    """
    # A number with an Indonesian short suffix: 45rb, 1,5jt, 25.000.
    #
    # Every number in the sentence is looked at, and the first one that
    # is money is taken. The count at the front of "2 indomie 3500" is
    # not money, so the walk carries on to the price.
    pattern = re.compile(
        r"(\d+(?:[.,]\d+)*)\s*(rb|ribu|jt|juta|rban|k)?(?!\w)",
        re.IGNORECASE,
    )
    for match in pattern.finditer(text):
        value = _to_number(match.group(1))
        if value is None:
            continue
        suffix = (match.group(2) or "").lower()
        if suffix:
            value = value * {
                "k": 1000, "rb": 1000, "ribu": 1000,
                "jt": 1000000, "juta": 1000000, "rban": 100000,
            }[suffix]
        elif value < 1000:
            # A small bare number is not money.
            continue
        if value > 0:
            return value, (match.start(), match.end())

    return None


def _find_count(text: str) -> Optional[Tuple[int, Tuple[int, int]]]:
    """
    The count of things, and where it sits.
    """
    match = re.search(r"\b(\d{1,4})\b", text)
    if match:
        value = int(match.group(1))
        # A four digit number is a year, not a count of packets.
        if 0 < value <= MAX_QUANTITY and len(match.group(1)) < 4:
            return value, (match.start(), match.end())

    for word, value in COUNT_WORDS.items():
        found = re.search(rf"\b{word}\b", text.lower())
        if found:
            return value, (found.start(), found.end())

    return None


def _find_count_after_x(text: str) -> Optional[Tuple[int, Tuple[int, int]]]:
    """
    The count written after the thing, with an x: "indomie 2x 3500".
    """
    match = re.search(r"(\d{1,4})\s*[x×]\s*(?=\d)", text.lower())
    if not match:
        return None
    value = int(match.group(1))
    if value <= 0 or value > MAX_QUANTITY:
        return None
    return value, (match.start(), match.start() + len(match.group(1)))


def _describe(text: str, count_span, price_span) -> str:
    """
    What is left of the sentence once the count and the price are taken
    out of it.
    """
    spans = sorted([count_span, price_span])
    out = ""
    cursor = 0
    for start, end in spans:
        out += text[cursor:start]
        cursor = end
    out += text[cursor:]

    out = re.sub(r"\b[x×]\b", "", out)
    out = out.replace("@", "")
    out = re.sub(
        r"\b(harga\s+satuan|harga\s+satuannya|harga\s+per|per\s+pcs|per\s+buah|satuan|unit\s+price)\b",
        "",
        out,
        flags=re.IGNORECASE,
    )
    out = re.sub(r"[,\s]+$", "", out)
    out = re.sub(r"^\s*[,\s]+", "", out)
    return re.sub(r"\s{2,}", " ", out).strip()


def parse_quantity(text: str) -> Optional[QuantityReading]:
    """
    Read the count and the price of one out of the sentence.

    Returns nothing when the sentence does not plainly say the price is
    the price of one.
    """
    if not text:
        return None

    source = str(text)
    lower = source.lower()

    # A year is not a count of packets.
    if re.search(r"\b(19|20)\d{2}\b", source):
        return None

    # When the price is plainly the price of everybody together, it is
    # not the price of one, and nothing is multiplied.
    if any(word in lower for word in WHOLE_PRICE_WORDS):
        return None

    price = _find_amount(source)
    if not price:
        return None
    price_value, price_span = price

    after_x = _find_count_after_x(source)
    count = after_x or _find_count(source)
    if not count:
        return None
    count_value, count_span = count

    if count_span == price_span:
        return None

    # A price written before the count is the price of the whole thing:
    # "3500 indomie 2" is three thousand five hundred for two.
    if not after_x and price_span[0] < count_span[0]:
        return None

    between = source[
        min(count_span[1], price_span[0]) : max(count_span[0], price_span[1])
    ]
    says_unit_price = (
        any(word in lower for word in UNIT_PRICE_WORDS)
        or after_x is not None
        or re.fullmatch(r"\s*@\s*", between) is not None
        or price_span[0] > count_span[0]
    )
    if not says_unit_price:
        return None

    total = Decimal(count_value) * price_value
    if total <= 0 or total > MAX_TOTAL:
        return None

    return QuantityReading(
        quantity=count_value,
        unit_price=int(price_value),
        total=int(total),
        description=_describe(source, count_span, price_span),
    )


__all__ = ["QuantityReading", "parse_quantity"]
