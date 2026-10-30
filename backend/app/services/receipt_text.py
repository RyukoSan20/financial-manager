"""
Reading the text on a paper receipt.

A receipt that came out of a thermal printer is not a receipt that
came out of a computer. The printer lays the characters out in a fixed
width grid, so the number 33.900 is printed with the dot in one cell
and the rest of the digits spread across the next few:

    33 900
    35 200

That is one number written as two, and a reader who does not know
about the grid reads "33" and "900" as two separate amounts. The
amount on the receipt is then wrong, and the reader does not know it.

So the text is put back together before anything looks at it. The
space that the printer put in the middle of a number is removed, and
the comma that stands in for a thousands separator is handled the same
way.

The rules here are about the printing, not about any particular shop.
A shop name is never worked out here.
"""

import re
from typing import Any, List

# A number whose parts are separated by a space, and optionally by a
# comma or a dot as well: "33 900", "33, 900", "33. 900", "1 234 567".
#
# The first group is one to three digits, which is how a thousands
# group starts. The second is exactly three digits, which is how a
# thousands group ends. Both have to be there, and they have to be
# adjacent, so "12 34" is left alone: that is two numbers, not one.
# A thousands group is exactly three digits. "33 900" is one number
# and "4 4500" is two: the second group is four digits long, so it is
# a number of its own and not the rest of a thousands group.
#
# Reading "4 4500" as one number gave the item a price of 4.450
# instead of a quantity of 4 and a price of 4.500, and the reader was
# told the wrong amount.
_SPACED_NUMBER = re.compile(r'(\d{1,3})[.,]?\s+(\d{3}(?:\s+\d{3})*)(?!\d)')

# A number with the printer's grid still in it: "33 900 00". The same
# shape as above, but the group after the first may repeat.
_SPACED_NUMBER_REPEATED = re.compile(r'(\d{1,3})\s+((?:\d{3}\s+)*\d{3})(?!\d)')


def normalize_spaced_amounts(text: str) -> str:
    """
    Put the numbers of a printed receipt back together.

    "33, 900" becomes "33.900" and "35 200" becomes "35.200". The
    thousands separator is a dot, because that is what the rest of the
    application reads, and a dot in a number of more than three digits
    is never a decimal point in Indonesian money.

    A number that is not a thousands group is left alone. "12 34" stays
    "12 34", because it is two numbers and not one.
    """
    if not text:
        return ""

    def _join(match: "re.Match") -> str:
        first = match.group(1)
        rest = match.group(2)
        # The rest may itself be several groups, each separated by a
        # space: "1 234 567".
        groups = rest.split()
        return ".".join([first] + groups)

    # The repeated form first, so "1 234 567" is handled as one number
    # and not as "1 234" followed by " 567".
    text = _SPACED_NUMBER_REPEATED.sub(_join, text)
    # Then the form with a comma or a dot before the space.
    text = _SPACED_NUMBER.sub(_join, text)
    return text


def normalize_printed_amounts(text: str) -> str:
    """
    The whole job: the numbers of a printed receipt, put back together.

    This is the function the parsers call. It is kept separate from
    the one above so that the rules can be read on their own.
    """
    return normalize_spaced_amounts(text)


def split_receipt_lines(raw: Any) -> List[str]:
    """
    The lines of a receipt, from whatever the caller had.

    A receipt arrives as one block of text, or as a list of lines, or
    as the output of the optical reader, which is a list of lines with
    a confidence number on each. All three become the same thing: a
    list of lines with the numbers in each one put back together.
    """
    if not raw:
        return []

    lines: List[str] = []
    if isinstance(raw, str):
        candidates = raw.split("\n")
    elif isinstance(raw, (list, tuple)):
        candidates = list(raw)
    else:
        return []

    for candidate in candidates:
        if candidate is None:
            continue
        if isinstance(candidate, dict):
            # The optical reader gives {"text": ..., "confidence": ...}.
            candidate = candidate.get("text") or candidate.get("raw_text") or ""
        text = str(candidate).strip()
        if not text:
            continue
        lines.append(normalize_printed_amounts(text))

    return lines
