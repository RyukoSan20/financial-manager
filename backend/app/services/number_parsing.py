"""
Reading a number that a person wrote.

Indonesian money is written in more than one way. "15.000", "15,000",
"4,000,000", "4.000.000", "15rb", "1.5jt" all mean what they look like,
and the model that reads them has to know which is which. The trap is
that a dot is both a thousands separator and a decimal point, and the
answer depends on how many of them there are.

"4.000.000" is four million. "4.5" is four and a half. "15.000" is
fifteen thousand, because nobody prices milk at fifteen and a half
thousand rupiah.

So: more than one separator means every separator is a thousands
separator. One separator with exactly three digits after it is also a
thousands separator. One separator with one or two digits after it is a
decimal point.
"""

import re
from typing import Optional

_NUMBER_RE = re.compile(r"\d[\d.,]*")


def parse_number(raw: str) -> Optional[float]:
    """
    Read a number the way a person writes money.

    Returns None when the text is not a number at all.
    """
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None

    # A leading minus is a sign, not a separator.
    sign = -1 if text.startswith("-") else 1
    text = text.lstrip("-+")

    # Keep only the digits and the separators.
    text = re.sub(r"[^\d.,]", "", text)
    if not text or not any(ch.isdigit() for ch in text):
        return None

    dots = text.count(".")
    commas = text.count(",")

    if dots and commas:
        # The rightmost separator is the decimal one.
        if text.rfind(".") > text.rfind(","):
            # "1,234.56" - dots are the decimals, commas the separators.
            text = text.replace(",", "")
        else:
            # "1.234,56" - commas are the decimals, dots the separators.
            text = text.replace(".", "").replace(",", ".")
    elif dots:
        if dots > 1:
            # "4.000.000" - every dot is a thousands separator.
            text = text.replace(".", "")
        else:
            head, _, tail = text.partition(".")
            if len(tail) == 3 and len(head) <= 3 and head:
                # "15.000" - a thousands separator.
                text = text.replace(".", "")
            # Otherwise "4.5" stays a decimal.
    elif commas:
        if commas > 1:
            # "4,000,000" - every comma is a thousands separator.
            text = text.replace(",", "")
        else:
            head, _, tail = text.partition(",")
            if len(tail) == 3 and len(head) <= 3 and head:
                # "15,000" - a thousands separator.
                text = text.replace(",", "")
            # Otherwise "4,5" stays a decimal.

    try:
        return sign * float(text)
    except ValueError:
        return None


def find_first_number(text: str) -> Optional[float]:
    """The first number in a string, read the way a person writes money."""
    if not text:
        return None
    match = _NUMBER_RE.search(text)
    if not match:
        return None
    return parse_number(match.group(0))


def strip_separators(text: str) -> str:
    """
    Turn a written number into plain digits.

    "Rp4,000,000" becomes "4000000". Used where the number has to be
    handed to something that expects plain digits.
    """
    if not text:
        return ""
    digits = re.sub(r"[^\d]", "", str(text))
    return digits
