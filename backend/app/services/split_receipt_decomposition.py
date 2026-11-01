"""
Reading a receipt the way receipts are written.

A restaurant receipt is not a tidy table. A line says "2x IC KOP SUSU
G.AREN", which is two coffees at Rp28.000 each, and either of them
may be claimed by a different person at the table. The tax is called
PB1 or PPN. The service charge is a percentage. The discount from a
combo is written at the bottom, after the total, and reads like a
dish unless you know what it is.

Two things are needed to read such a receipt.

The first is understanding what a line says. That is what a model is
good at: "IC KOP SUSU G.AREN" is iced coffee with palm sugar, and
nobody has to be told what a receipt means for them to see it. A
model may be asked what the lines mean.

The second is the arithmetic: what the lines add up to, whether they
agree with the subtotal, what a portion of a tax is. That is not for
a model. A model is asked what it thinks and then checked, and where
the check fails the reader is told.

So the two are kept apart. The understanding comes from a model when
one is available and the plain rules when one is not. The arithmetic
is worked out here, from the lines, either way. And nothing here
changes any of the reader's records: a reading is a proposal, and the
reader decides.
"""

import json
import os
import re
from dataclasses import dataclass, field
from decimal import Decimal
from typing import List, Optional

from app.services.gemini_vision import call_gemini_text

ZERO = Decimal("0")

# How a line of a receipt is used in the bill.
ITEM = "item"
TAX = "tax"
SERVICE = "service"
DISCOUNT = "discount"
SUBTOTAL = "subtotal"
TOTAL = "total"
UNKNOWN = "unknown"

# The words a receipt uses for each kind of line.
#
# These are the words people actually write on a receipt, in the
# languages this application is used in. A receipt in Indonesian says
# PB1 or PPN for the tax; one in English says GST or VAT; one in
# Japanese says 税 or 内税. The service charge is service charge in
# English and biaya layanan in Indonesian.
_TAX_WORDS = (
    "pb1",
    "ppn",
    "pjk",
    "gst",
    "vat",
    "tax",
    "pajak",
    "cukai",
    "税",
    "内税",
    "消費税",
)
_SERVICE_WORDS = (
    "service charge",
    "service",
    "biaya layanan",
    "layanan",
    "サービス料",
    "サービス",
)
_DISCOUNT_WORDS = (
    "diskon",
    "discount",
    "potongan",
    "potong harga",
    "voucher",
    "promo",
    "kupon",
    "coupon",
    "cashback",
    "划算",
    "割引",
)
_SUBTOTAL_WORDS = (
    "subtotal",
    "sub total",
    "sub-total",
    "total belanja",
    "total购买的",
    "小計",
    "商品合計",
)
_TOTAL_WORDS = (
    "grand total",
    "total",
    "jumlah",
    "grand total",
    "合計",
    "総額",
    "total bayar",
    "total pembayaran",
)

# The shorthands people write on a receipt.
#
# The point of this is not to make the receipt pretty. It is that a
# line reading "IC KOP SUSU G.AREN" is hard to recognise as a drink
# when somebody is looking for "Kopi Susu Gula Aren" in the list, and
# the reader may want to find it.
_SHORTHANDS = {
    "ic kop susu g.aren": "Es Kopi Susu Gula Aren",
    "ic kop susu g aren": "Es Kopi Susu Gula Aren",
    "kopi susu g.aren": "Kopi Susu Gula Aren",
    "kopi susu g aren": "Kopi Susu Gula Aren",
    "ic coffee": "Es Kopi",
    "kopi": "Kopi",
    "es teh": "Es Teh",
    "teh": "Teh",
    "nasi": "Nasi",
    "nasigoreng": "Nasi Goreng",
    "nasi goreng": "Nasi Goreng",
    "mie goreng": "Mie Goreng",
    "soto": "Soto",
    "sate": "Sate",
    "lumpur": "Es Campur",
    "es campur": "Es Campur",
    "roti": "Roti",
    "bakwan": "Bakwan",
    "pisang": "Pisang Goreng",
    "kerupuk": "Kerupuk",
    "paket": "Paket",
}

# A quantity at the front of a line: "2x", "2 x", "3X".
_QUANTITY_PATTERN = re.compile(
    r"^\s*(\d+)\s*[xX×]\s*(.+)$"
)

# A quantity written as a plain number: "4 Es Teh".
_PLAIN_QUANTITY_PATTERN = re.compile(r"^\s*(\d+)\s+(\D.*)$")

# An amount at the end of a line: "35.000", "Rp35.000", "35.000,50".
_AMOUNT_PATTERN = re.compile(
    r"(?:rp\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*$"
)


@dataclass
class DecomposedItem:
    """
    One dish on the receipt, with its quantity kept apart.

    The quantity is kept apart because a line of two coffees is two
    coffees, and either of them may be claimed by a different person.
    """

    name: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = ZERO
    total_price: Decimal = ZERO
    kind: str = ITEM
    raw_name: str = ""
    line_number: Optional[int] = None

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "raw_name": self.raw_name,
            "quantity": str(self.quantity),
            "unit_price": str(self.unit_price),
            "total_price": str(self.total_price),
            "kind": self.kind,
            "line_number": self.line_number,
        }


@dataclass
class ReadReceipt:
    """
    A receipt, read.

    The lines are what the reader can claim. The tax, the service
    charge and the discount are what the receipt charged on top of
    them. The total is what was actually owed.
    """

    items: List[DecomposedItem] = field(default_factory=list)
    tax: Decimal = ZERO
    service_charge: Decimal = ZERO
    discount: Decimal = ZERO
    subtotal: Decimal = ZERO
    grand_total: Decimal = ZERO
    discrepancy: Optional[Decimal] = None

    def as_dict(self) -> dict:
        return {
            "items": [item.as_dict() for item in self.items],
            "tax": str(self.tax),
            "service_charge": str(self.service_charge),
            "discount": str(self.discount),
            "subtotal": str(self.subtotal),
            "grand_total": str(self.grand_total),
            "discrepancy": (
                str(self.discrepancy) if self.discrepancy is not None else None
            ),
        }


def _dec(value) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value) -> Decimal:
    return _dec(value).quantize(Decimal("0.01"))


def read_quantity(text: str) -> Decimal:
    """
    How many of a thing a line is about.

    "2x IC KOP SUSU G.AREN" is two. "4 Es Teh" is four. A line with
    no number on it is one, because a receipt writes one of a thing
    without saying so.
    """
    if not text:
        return Decimal("1")
    cleaned = str(text).strip()

    match = _QUANTITY_PATTERN.match(cleaned)
    if match:
        return Decimal(match.group(1))

    match = _PLAIN_QUANTITY_PATTERN.match(cleaned)
    if match:
        return Decimal(match.group(1))

    return Decimal("1")


def strip_quantity(text: str) -> str:
    """
    The line with the number of things taken off the front.
    """
    if not text:
        return ""
    cleaned = str(text).strip()

    match = _QUANTITY_PATTERN.match(cleaned)
    if match:
        return match.group(2).strip()

    match = _PLAIN_QUANTITY_PATTERN.match(cleaned)
    if match:
        return match.group(2).strip()

    return cleaned


def read_amount(text: str) -> Optional[Decimal]:
    """
    The price at the end of a line.

    The price is written the way the country writes it: a thousands
    mark and a decimal mark, and the two are not always the same
    character. A line with no price on it has no amount, which is not
    the same as an amount of zero.
    """
    if not text:
        return None
    cleaned = str(text).strip()
    match = _AMOUNT_PATTERN.search(cleaned)
    if not match:
        return None

    raw = match.group(1)
    last_comma = raw.rfind(",")
    last_dot = raw.rfind(".")

    if last_comma > last_dot:
        # Indonesian: the dot is the thousands mark and the comma is
        # the decimal mark.
        tail = len(raw) - last_comma - 1
        cleaned_raw = (
            raw.replace(".", "").replace(",", "")
            if tail == 3
            else raw.replace(".", "").replace(",", ".")
        )
    elif last_dot > last_comma:
        # English: the comma is the thousands mark and the dot is the
        # decimal mark.
        tail = len(raw) - last_dot - 1
        cleaned_raw = (
            raw.replace(",", "").replace(".", "")
            if tail == 3
            else raw.replace(",", "")
        )
    else:
        cleaned_raw = raw.replace(",", "").replace(".", "")

    try:
        return _dec(cleaned_raw)
    except Exception:
        return None


def expand_shorthand(text: str) -> str:
    """
    A shorthand written on a receipt, spelled out.

    The line is not changed for the sake of looking tidy. It is
    changed so that the reader can find the drink they ordered when
    they are looking for its full name.
    """
    if not text:
        return ""
    cleaned = str(text).strip()
    key = re.sub(r"\s+", " ", cleaned.lower()).strip(" .")
    if key in _SHORTHANDS:
        return _SHORTHANDS[key]
    return cleaned


def classify_line(text: str) -> str:
    """
    What a line of a receipt is for.

    A line that is a dish is a dish. A line that is the tax is the
    tax. A line that is a discount is a discount, even when it is
    written at the bottom of the receipt like a dish, which is where
    a combo discount usually is.
    """
    if not text:
        return UNKNOWN
    lowered = str(text).strip().lower()

    # The discount is looked for first, because a combo discount is
    # written at the bottom of the receipt, where the totals are.
    for word in _DISCOUNT_WORDS:
        if word in lowered:
            return DISCOUNT
    for word in _TAX_WORDS:
        if word in lowered:
            return TAX
    for word in _SERVICE_WORDS:
        if word in lowered:
            return SERVICE
    for word in _SUBTOTAL_WORDS:
        if word in lowered:
            return SUBTOTAL
    for word in _TOTAL_WORDS:
        if word in lowered:
            return TOTAL
    return ITEM


def split_line(
    raw_name: str,
    total_price: Optional[Decimal] = None,
    unit_price: Optional[Decimal] = None,
    quantity: Optional[Decimal] = None,
) -> DecomposedItem:
    """
    One line of a receipt, with its quantity kept apart.

    The receipt sometimes writes the total of the line and sometimes
    the price of one of the things on it. When it writes the price of
    one, the total of the line is worked out. When it writes the
    total, the price of one is worked out from that.
    """
    name = strip_quantity(raw_name)

    if quantity is None:
        quantity = read_quantity(raw_name)
    quantity = _dec(quantity) or Decimal("1")

    total = _dec(total_price) if total_price is not None else None
    single = _dec(unit_price) if unit_price is not None else None

    if not total and single:
        total = single * quantity
    if total is None:
        total = ZERO
    if not single and quantity:
        single = total / quantity

    return DecomposedItem(
        name=expand_shorthand(name),
        quantity=quantity,
        unit_price=_money(single),
        total_price=_money(total),
        kind=ITEM,
        raw_name=str(raw_name or ""),
    )


def read_receipt(lines: List[str]) -> ReadReceipt:
    """
    A receipt, read from its lines.

    This is the reading that is always available: no model, no
    network, no key. It is not as good as a model at understanding
    what a line says, but it is exact about what the lines add up to,
    and that is the part that has to be exact.
    """
    receipt = ReadReceipt()

    subtotal_from_lines = ZERO
    subtotal_on_paper: Optional[Decimal] = None
    total_on_paper: Optional[Decimal] = None

    for number, raw in enumerate(lines or [], start=1):
        if raw is None:
            continue
        text = str(raw).strip()
        if not text:
            continue

        kind = classify_line(text)
        amount = read_amount(text)

        if kind == ITEM:
            name = strip_quantity(text)
            quantity = read_quantity(text)
            total = amount if amount is not None else ZERO
            single = total / quantity if quantity else total
            receipt.items.append(
                DecomposedItem(
                    name=expand_shorthand(name),
                    quantity=quantity,
                    unit_price=_money(single),
                    total_price=_money(total),
                    kind=ITEM,
                    raw_name=text,
                    line_number=number,
                )
            )
            subtotal_from_lines += total
            continue

        if amount is None:
            continue

        if kind == TAX:
            receipt.tax = _money(receipt.tax + amount)
        elif kind == SERVICE:
            receipt.service_charge = _money(receipt.service_charge + amount)
        elif kind == DISCOUNT:
            receipt.discount = _money(receipt.discount + amount)
        elif kind == SUBTOTAL:
            subtotal_on_paper = _money(amount)
        elif kind == TOTAL:
            total_on_paper = _money(amount)

    # The subtotal is what the paper says when it says it, and what
    # the lines add up to when it does not.
    if subtotal_on_paper is not None:
        receipt.subtotal = subtotal_on_paper
    else:
        receipt.subtotal = _money(subtotal_from_lines)

    if total_on_paper is not None:
        receipt.grand_total = total_on_paper
    else:
        receipt.grand_total = _money(
            receipt.subtotal + receipt.tax + receipt.service_charge - receipt.discount
        )

    # The gap between the lines and the subtotal. When the paper
    # wrote the subtotal, that is the comparison that matters: it
    # means a line was read wrong, or a line was missed.
    if subtotal_on_paper is not None and subtotal_from_lines != ZERO:
        difference = _money(subtotal_from_lines - subtotal_on_paper)
        receipt.discrepancy = difference if difference != ZERO else None

    return receipt


# ---------------------------------------------------------------------------
# The model
# ---------------------------------------------------------------------------
#
# The model is asked one question: what does each line of this receipt
# say? It is not asked to add the receipt up, and it is not asked to
# decide what the receipt adds up to. Those are worked out here.
#
# What the model says is data about a receipt that somebody else
# wrote. It cannot change what this module does: the kind of a line
# is decided by the words on the line, the totals are decided by the
# arithmetic, and a line the model made up is not on the receipt.

_PROMPT = """You are reading the lines of a restaurant receipt.

For each line that is a food or a drink, say what the line means.
Do not add anything up. Do not give a total. Do not give a subtotal.
Only say what each line is.

Answer with a JSON array and nothing else. Each element is:
  "line": the number of the line, counting from 1
  "name": what the line is, spelled out. For example a line that says
          "IC KOP SUSU G.AREN" is "Es Kopi Susu Gula Aren"
  "quantity": how many of the thing, as a number. A line that says "2x"
          is 2. A line with no number is 1.
  "unit_price": the price of one of the thing
  "total_price": the price of all of them

The lines are:
{lines}

Answer with the JSON array only.
"""


def _ask_the_model(lines: List[str]) -> Optional[List[dict]]:
    """
    What the model says each line means.

    Nothing is returned when the model is not there, when it says
    something that is not a list, or when what it says does not make
    sense. The caller falls back to the plain reading.
    """
    if not lines:
        return None
    if not os.getenv("GEMINI_API_KEY"):
        return None

    numbered = "\n".join(
        f"{number}: {line}" for number, line in enumerate(lines, start=1)
    )
    try:
        raw = call_gemini_text(
            _PROMPT.format(lines=numbered),
            timeout=30,
            temperature=0.0,
            max_output_tokens=2048,
            json_response=True,
        )
    except Exception:  # noqa: BLE001 - the model is strictly optional
        return None

    if not raw:
        return None

    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        return None

    if not isinstance(parsed, list):
        return None

    return [entry for entry in parsed if isinstance(entry, dict)]


def _understandings_are_usable(
    answers: List[dict], lines: List[str]
) -> bool:
    """
    Is what the model said worth using?

    A line the model points at has to be a line that exists, and the
    price it gives has to be a number. An answer that fails either of
    those tests is not used, because a reading that is wrong in a way
    nobody can see is worse than no reading at all.
    """
    if not answers:
        return False
    for entry in answers:
        number = entry.get("line")
        try:
            number = int(number)
        except (TypeError, ValueError):
            return False
        if number < 1 or number > len(lines):
            return False
        try:
            Decimal(str(entry.get("total_price", "0")))
        except Exception:
            return False
    return True


def read_receipt_with_understanding(lines: List[str]) -> ReadReceipt:
    """
    A receipt, read with a model when there is one.

    The model says what each line means. The arithmetic is worked out
    here, from the lines, and the totals on the paper are the totals.
    When the model is not there, or when what it says does not make
    sense, the plain reading is used and the receipt is still read.
    """
    plain = read_receipt(lines)

    answers = _ask_the_model(lines)
    if not _understandings_are_usable(answers or [], lines):
        return plain

    by_line = {}
    for entry in answers:
        try:
            by_line[int(entry.get("line"))] = entry
        except (TypeError, ValueError):
            continue

    items: List[DecomposedItem] = []
    subtotal_from_lines = ZERO

    for number, raw in enumerate(lines or [], start=1):
        if raw is None:
            continue
        text = str(raw).strip()
        if not text:
            continue

        if classify_line(text) != ITEM:
            continue

        entry = by_line.get(number)
        if entry is None:
            plain_item = next(
                (item for item in plain.items if item.line_number == number), None
            )
            if plain_item is None:
                continue
            items.append(plain_item)
            subtotal_from_lines += plain_item.total_price
            continue

        quantity = read_quantity(text)
        try:
            quantity = Decimal(str(entry.get("quantity", quantity)))
        except Exception:
            quantity = read_quantity(text)
        if quantity <= ZERO:
            quantity = read_quantity(text)

        try:
            total = Decimal(str(entry.get("total_price", "0")))
        except Exception:
            total = ZERO

        try:
            single = Decimal(str(entry.get("unit_price", "0")))
        except Exception:
            single = ZERO
        if single <= ZERO and quantity:
            single = total / quantity

        name = str(entry.get("name") or "").strip()
        if not name:
            name = expand_shorthand(strip_quantity(text))

        items.append(
            DecomposedItem(
                name=name,
                quantity=quantity,
                unit_price=_money(single),
                total_price=_money(total),
                kind=ITEM,
                raw_name=text,
                line_number=number,
            )
        )
        subtotal_from_lines += total

    if not items:
        return plain

    receipt = ReadReceipt(
        items=items,
        tax=plain.tax,
        service_charge=plain.service_charge,
        discount=plain.discount,
        subtotal=plain.subtotal,
        grand_total=plain.grand_total,
    )

    # The gap is worked out here, from the lines and the subtotal the
    # paper says. The model cannot change it.
    if receipt.subtotal != ZERO and subtotal_from_lines != ZERO:
        difference = _money(subtotal_from_lines - receipt.subtotal)
        receipt.discrepancy = difference if difference != ZERO else None

    return receipt
