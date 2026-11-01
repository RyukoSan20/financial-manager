"""
Reading a transfer receipt, on the server.

The person who paid sends a picture of the transfer receipt. The
person who was paid looks at it. The work of looking at it - reading
the number off the picture and comparing it with what was owed - is
done here rather than in the browser, because the browser cannot be
trusted with the answer, and because the same reading has to happen
the same way for everybody.

Three things are true of this:

- the amount on the proof is read, and compared with what was owed;
- a reading that does not match is NOT accepted. It is reported as a
  reading that does not match, and the person decides;
- the text of the proof is data. It comes from a stranger's phone
  screen, and it is treated as data, never as instructions.

The last point is the one that is easy to get wrong. Nothing here
looks at what the text says and acts on it. The only thing that
happens to the text is that numbers are taken out of it, and the
numbers are compared with a number that came from somewhere else
entirely: the amount that was owed. A proof that says "this covers
the whole bill" does not make it cover the whole bill.

Money is compared to the last rupiah. Nobody is charged a cent for
a rounding.
"""

import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, Optional

# The words a bank writes above the amount.
#
# The order matters only in that the more specific words come first,
# so that a line that says "total transfer" is not read as a line
# that merely mentions "transfer".
AMOUNT_WORDS = (
    "total transfer",
    "transfer amount",
    "jumlah transfer",
    "nominal transfer",
    "nominal",
    "jumlah",
    "amount",
    "total",
)

# The currency marks that are sometimes written before the number.
CURRENCY_MARKS = ("rp", "idr", "rp.", "idr.")

# The reasons a reading can have.
EXACT = "exact"
DIFFERENT = "different"
UNREADABLE = "unreadable"
NO_EXPECTED_AMOUNT = "no_expected_amount"


@dataclass
class ProofReading:
    """
    What the picture says.

    This is a plain thing with plain values, so that it can be
    written down next to the payment and looked at again later. It
    is not a live object with a database connection in it.
    """

    amount: Optional[float] = None
    confidence: str = "none"
    method: str = "none"
    reason: str = UNREADABLE

    # What was owed, when there was something to compare with. It
    # comes from the bill and not from the proof, so a proof cannot
    # change it.
    expected: Optional[float] = None

    @property
    def matches(self) -> bool:
        """
        Does the proof say what it should?

        Only a reading that was compared with an amount can match.
        A reading on its own, with nothing to compare it with, does
        not match anything.
        """
        return self.reason == EXACT

    def as_dict(self) -> Dict[str, Any]:
        return {
            "amount": self.amount,
            "confidence": self.confidence,
            "method": self.method,
            "reason": self.reason,
            "expected": self.expected,
        }


def _parse_number(raw: str) -> Optional[float]:
    """
    A number written the way a bank writes it.

    Indonesian banks write "150.000,50". Some write "150,000.50".
    Both are read here, and the one that is decided by which
    separator comes last.

    A number with a minus sign in front of it is not an amount that
    was paid, so it is refused rather than read as a positive one.
    """
    if not raw:
        return None

    text = str(raw).strip()
    if not text:
        return None

    # A minus sign means money went the other way. There is no
    # payment of a negative amount.
    if text.startswith("-") or text.startswith("("):
        return None

    # Keep only the digits and the separators.
    text = re.sub(r"[^\d.,]", "", text)
    if not text:
        return None

    last_comma = text.rfind(",")
    last_dot = text.rfind(".")

    def tail(separator: int) -> int:
        if separator < 0:
            return 0
        return len(text) - separator - 1

    if last_comma > last_dot:
        # Indonesian: the dot is the thousands mark and the comma is
        # the decimal mark.
        cleaned = (
            text.replace(".", "").replace(",", "")
            if tail(last_comma) == 3
            else text.replace(".", "").replace(",", ".")
        )
    elif last_dot > last_comma:
        # English: the comma is the thousands mark and the dot is the
        # decimal mark.
        #
        # When three digits follow the dot, the dot is the thousands
        # mark and the whole thing is a whole number. "150.000" is a
        # hundred and fifty thousand, not a hundred and fifty.
        cleaned = (
            text.replace(",", "").replace(".", "")
            if tail(last_dot) == 3
            else text.replace(",", "")
        )
    else:
        cleaned = text.replace(",", "").replace(".", "")

    try:
        value = float(cleaned)
    except ValueError:
        return None

    if value < 0:
        return None
    return value


def _numbers_on(line: str):
    """
    The numbers on a line, with the currency mark taken off.
    """
    # A number with a currency mark in front of it, or a number on
    # its own. The mark is not part of the number.
    pattern = r"(?:rp\.?|idr\.?\s*)?[\d][\d.,]*"
    for raw in re.findall(pattern, line, flags=re.IGNORECASE):
        cleaned = re.sub(r"(?i)^(rp\.?|idr\.?)\s*", "", raw).strip()
        if not cleaned:
            continue
        value = _parse_number(cleaned)
        if value is not None:
            yield value


def _is_amount_line(line: str) -> bool:
    lowered = line.lower()
    return any(word in lowered for word in AMOUNT_WORDS)


def read_proof_text(text: str) -> ProofReading:
    """
    Read the amount off the text of a transfer receipt.

    Two ways of finding it, in the order they are trusted:

    - a line that says what the number is ("Nominal", "Total
      Transfer"). This is a high confidence reading.
    - the biggest number on the page. This is a low confidence one,
      because the biggest number on a bank screen is sometimes the
      balance and not the amount.

    The reader is told which of the two it was, so that a low
    confidence reading is never mistaken for a sure one.
    """
    if not text:
        return ProofReading(amount=None, confidence="none", method="none")

    lines = [line.strip() for line in str(text).splitlines()]
    lines = [line for line in lines if line]

    # 1. A line that says what the number is.
    for line in lines:
        if not _is_amount_line(line):
            continue
        values = list(_numbers_on(line))
        if not values:
            continue
        # The last number on the line is the amount. The ones before
        # it are usually the account number and the reference.
        for value in reversed(values):
            if value > 0:
                return ProofReading(
                    amount=value,
                    confidence="high",
                    method="labelled",
                )

    # 2. The biggest number on the page.
    biggest = None
    for line in lines:
        for value in _numbers_on(line):
            if value > 0 and (biggest is None or value > biggest):
                biggest = value
    if biggest is not None:
        return ProofReading(
            amount=biggest,
            confidence="low",
            method="largest",
        )

    return ProofReading(amount=None, confidence="none", method="none")


def verify_proof(text: str, expected: Optional[Decimal]) -> ProofReading:
    """
    Read the proof and say whether it says what it should.

    `expected` is what was owed. It comes from the bill, and not
    from the proof, so a proof cannot change what was owed.

    A reading that matches is accepted. A reading that does not match
    is reported as one that does not match, and the person decides.
    Nothing is confirmed on the strength of a reading here.
    """
    reading = read_proof_text(text)

    if expected is None:
        reading.reason = NO_EXPECTED_AMOUNT
        return reading

    if reading.amount is None:
        reading.reason = UNREADABLE
        return reading

    # Money is compared to the last rupiah. A proof that is short by
    # one rupiah is short by one rupiah.
    wanted = Decimal(str(expected)).quantize(Decimal("0.01"))
    found = Decimal(str(reading.amount)).quantize(Decimal("0.01"))

    if wanted == found:
        reading.reason = EXACT
    else:
        reading.reason = DIFFERENT

    # The amount that was expected is kept on the reading, so that
    # whoever looks at it later can see both numbers and not only
    # the one that was read.
    reading.expected = float(wanted)
    return reading
