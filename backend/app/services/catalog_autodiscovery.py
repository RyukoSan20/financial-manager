"""
Learning the shops and the words from the receipts themselves.

The parser used to know a list of shop names. It was a list that
could not grow: a receipt from a shop nobody had thought of came back
with the shop written as "Unknown Merchant", and the reader had to fix
it by hand every single time.

So the shop is worked out from the receipt, and then it is written
down. The next receipt from the same shop is recognised, and the
category the reader accepted last time is offered again.

Nothing here is a list of shop names. The words that are looked for
are the words that are on every receipt: the words that say the
transaction was paid, the words that say the receipt is finished, and
the words that mark a line as a total. A shop's own name is never in
this file, because a shop's name is exactly the thing that is not
known yet.

What is written down:

- the shop, in the catalogue the reader already has, so the next
  receipt is recognised;
- the words that mean something at that shop, in the hints table, so
  the category is offered again.

The words that are looked for:

- "pembayaran berhasil", "transaksi berhasil", "struk pembayaran",
  "terima kasih" and their kin. These are the words a machine
  prints at the end of a receipt. They are never the name of a shop.
- the words that mark a line as a total: "total", "tunai", "bayar",
  "kembali", and their kin.

The name of a shop is taken from the top of the receipt, from the line
after those, and from the line that says who was paid. It is never
taken from a line that says the payment went through.
"""

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

# The words a machine prints at the end of a receipt. A shop's name is
# never one of these.
STATUS_PHRASES = (
    "pembayaran berhasil",
    "transaksi berhasil",
    "struk pembayaran",
    "struk",
    "terima kasih",
    "terima kasih banyak",
    "thank you",
    "berhasil",
    "sukses",
    "settled",
    "approved",
    "debit",
    "kredit",
    "pembayaran",
    "bukti pembayaran",
    "e-receipt",
    "resep",
    "struk elektronik",
)

# The words that mark a line as a total, rather than as an item.
TOTAL_PHRASES = (
    "total",
    "total bayar",
    "total belanja",
    "tunai",
    "cash",
    "bayar",
    "kembali",
    "k.change",
    "change",
    "subtotal",
    "harga jual",
    "total disc",
    "total item",
    "jumlah item",
    "ppn",
    "pajak",
    "tax",
    "diskon",
    "discount",
    "voucher",
    "tunai diterima",
    "cashier",
    "kasir",
    "no. struk",
    "no struk",
    "no. trx",
    "struk no",
    "bayar Tunai",
)

# The words that say who was paid. The shop is after one of these.
PAID_TO_LABELS = (
    "dibayarkan ke",
    "dibayar ke",
    "bayar ke",
    "penerima",
    "merchant",
    "toko",
    "nama toko",
    "sold by",
    "paid to",
)

# The words that mark the name of a company, when a receipt has one.
COMPANY_PREFIXES = ("pt ", "cv ", "ud ", "tbk ", "co ", "corp ")

# A line that is too short to be a name, or that is only a number.
_MIN_NAME_LENGTH = 3


def _normalize(text: str) -> str:
    """Lower case, with the spacing and the punctuation evened out."""
    if not text:
        return ""
    text = str(text).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def is_status_phrase(text: str) -> bool:
    """
    Is this line one of the words a machine prints, and not a shop?

    "TERIMA KASIH" and "PEMBAYARAN BERHASIL" are on every receipt in
    the country. If one of them is read as the shop, the reader gets a
    transaction called "Terima Kasih", which is not useful and is not
    true.
    """
    if not text:
        return False
    normalized = _normalize(text)
    if not normalized:
        return False
    for phrase in STATUS_PHRASES:
        if normalized == _normalize(phrase):
            return True
        # The phrase is the whole line, or the line says it and then
        # says something else: "TERIMA KASIH - INDOMARET".
        if normalized.startswith(_normalize(phrase) + " "):
            return True
    return False


def is_total_phrase(text: str) -> bool:
    """Is this line the total rather than an item?"""
    if not text:
        return False
    normalized = _normalize(text)
    for phrase in TOTAL_PHRASES:
        if normalized == _normalize(phrase):
            return True
        if normalized.startswith(_normalize(phrase) + " "):
            return True
        # "TOTAL BELANJA 33.900" and "TOTAL: 33.900" and "33.900 TOTAL"
        if normalized.endswith(" " + _normalize(phrase)):
            return True
    return False


def is_company_name(text: str) -> bool:
    """Does this line start with the words a company is written with?"""
    if not text:
        return False
    normalized = _normalize(text)
    return any(normalized.startswith(prefix) for prefix in COMPANY_PREFIXES)


def clean_company_name(text: str) -> str:
    """
    The name of the company, without the words that are not part of it.

    "PT XING FOOD" keeps its "PT", because that is how the company is
    written and how the reader would recognise it. What is taken off
    is the branch, the address and the numbers.
    """
    if not text:
        return ""
    name = str(text).strip()

    # Take off the address, which often comes after a dash.
    name = re.split(r"\s+[-–—]\s+", name)[0].strip()

    # Take off a trailing amount.
    name = re.sub(r"\s+(rp\.?\s*)?[\d.,]+\s*$", "", name).strip()

    # Take off a telephone number.
    #
    # "TLOGOMAS 44 MALANG 08113336422" is the name of the shop and
    # the number beside it, not a name that happens to end in digits.
    name = re.sub(r"\s*0\d{2,}[\s\-]?\d{3,}[\s\-]?\d{3,}\s*$", "", name).strip()

    return name


@dataclass
class MerchantCandidate:
    """
    A shop that the receipt mentions, and what it might be.

    `confidence` says how sure we are. `source` says where the name
    came from, which is useful when the reader wants to know why the
    name is what it is.
    """

    name: str
    confidence: float = 0.0
    source: str = "unknown"
    merchant_type: Optional[str] = None
    tokens: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "confidence": self.confidence,
            "source": self.source,
            "merchant_type": self.merchant_type,
            "tokens": list(self.tokens),
        }


# The words that say what kind of shop this is. These are types, not
# names, so they are safe to hold: "minimarket" says what kind of
# shop, not which one.
TYPE_WORDS = {
    "minimarket": "minimarket",
    "supermarket": "supermarket",
    "hypermarket": "supermarket",
    "indomaret": "minimarket",
    "alfamart": "minimarket",
    "apotek": "apotek",
    "pharmacy": "apotek",
    "klinik": "klinik",
    "rumah sakit": "klinik",
    "hospital": "klinik",
    "warung": "warung",
    "resto": "restoran",
    "restaurant": "restoran",
    "cafe": "kafe",
    "kafe": "kafe",
    "bakso": "restoran",
    "bengkel": "bengkel",
    "car wash": "bengkel",
    "salon": "salon",
    "laundry": "laundry",
    "service": "layanan",
    "atk": "perlengkapan",
    "sembako": "sembako",
}


def guess_merchant_type(text: str) -> Optional[str]:
    """What kind of shop this is, from the words on the receipt."""
    if not text:
        return None
    normalized = _normalize(text)
    for word, kind in TYPE_WORDS.items():
        if word in normalized:
            return kind
    return None


def merchant_tokens(name: str) -> List[str]:
    """
    The words of a shop name that are worth remembering.

    "PT XING FOOD" gives "pt", "xing", "food". The words that say what
    kind of thing it is are the useful ones, so they are kept, and the
    rest is kept too: the point is to recognise the same shop next
    time, and a name is recognised by all of its words.
    """
    if not name:
        return []
    tokens = _normalize(name).split()
    # A word of one letter carries no meaning, and neither does a
    # number.
    return [t for t in tokens if len(t) > 1 and not t.isdigit()]


def _is_scrap_of_noise(line: str) -> bool:
    """
    True when the line is a scrap of the camera's noise rather than a
    name.

    A receipt that opens with "| wy" or "KI (c) 7) ha" was filmed with
    a camera that made a mess of the top of the sign. Those lines are
    not a shop, and the shop is printed further down.
    """
    stripped = line.strip()
    if len(stripped) < 5:
        return True

    # How many of the characters are letters? A name is mostly letters.
    letters = sum(1 for c in stripped if c.isalpha())
    if letters < 3:
        return True

    # A line that is mostly punctuation and numbers is noise.
    if letters < len(stripped) * 0.5:
        return True

    return False


def _looks_like_a_name(line: str) -> bool:
    """
    True when the line is written like a name.

    A shop writes its name in capitals at the first letter of each
    word: "Alfanart Jogja", "PT ALBANY CORONA LESTARI", "BEEPOS".
    A sentence of ordinary words does not: "Beranya yua harga pas"
    is something the receipt says, not the name of the shop.
    """
    words = [
        w for w in re.split(r"\s+", line.strip())
        if w and any(c.isalpha() for c in w)
    ]
    if not words:
        return False

    capitalised = 0
    for word in words:
        letters = [c for c in word if c.isalpha()]
        if not letters:
            continue
        if letters[0].isupper():
            capitalised += 1

    # Every word begins with a capital, or at least most of them.
    return capitalised >= len(words) - 1


def _header_line_confidence(line: str, index: int) -> float:
    """
    How sure we are that this line names the shop.

    The top of the receipt is worth more than the bottom, but a line
    that is a scrap of noise is worth very little however high up the
    receipt it is.

    A line written like a name is worth much more than a line of
    ordinary words. The camera turned "Alfamart" into "Attamart" and
    the line below it said "Beranya yua harga pas", which is ordinary
    words and not a shop.
    """
    if _is_scrap_of_noise(line):
        return 0.05

    position = max(0.15, 0.4 - index * 0.05)
    if _looks_like_a_name(line):
        return round(position + 0.45, 4)
    return round(position + 0.05, 4)


def find_merchant_candidates(
    lines: Sequence[str],
    max_candidates: int = 5,
) -> List[MerchantCandidate]:
    """
    The shops this receipt mentions, most likely first.

    The receipt is read from the top, because a shop prints its name
    at the top. The lines that are the end of the receipt, the status
    words and the totals, are not shops and are never offered.
    """
    candidates: List[MerchantCandidate] = []
    seen = set()

    for index, raw in enumerate(lines):
        line = str(raw or "").strip()
        if not line:
            continue
        if len(line) < _MIN_NAME_LENGTH:
            continue
        if is_status_phrase(line):
            continue
        if is_total_phrase(line):
            continue

        # A line that is only a number is an amount, not a name.
        if re.fullmatch(r"[\d.,\s]+", line):
            continue

        # Where the shop is, not what it is called.
        if _is_a_street_address(line):
            continue

        # The name after "dibayarkan ke" is the most certain of all.
        paid_to = _after_paid_to_label(line)
        if paid_to:
            name = clean_company_name(paid_to)
            if name and _normalised_key(name) not in seen:
                seen.add(_normalised_key(name))
                candidates.append(
                    MerchantCandidate(
                        name=name,
                        confidence=0.9,
                        source="paid_to",
                        merchant_type=guess_merchant_type(name),
                        tokens=merchant_tokens(name),
                    )
                )
            continue

        # A line that names a company is a company.
        if is_company_name(line):
            name = clean_company_name(line)
            if name and _normalised_key(name) not in seen:
                seen.add(_normalised_key(name))
                # The further down the receipt, the less certain. The
                # name of a shop is at the top.
                confidence = max(0.4, 0.85 - index * 0.05)
                candidates.append(
                    MerchantCandidate(
                        name=name,
                        confidence=confidence,
                        source="company_line",
                        merchant_type=guess_merchant_type(line),
                        tokens=merchant_tokens(name),
                    )
                )
            continue

        # Any other line near the top that has words in it is a
        # candidate, with a low confidence.
        if index <= 6 and len(line) <= 60:
            key = _normalised_key(line)
            if key and key not in seen:
                seen.add(key)
                # The camera often leaves a mark of punctuation at the
                # end of a name. It is not part of the name.
                tidy = line.strip(" \t.,;:!?*\"'|\u201d\u2019-_")
                # The telephone number is printed beside the name; it
                # is not part of the name.
                tidy = re.sub(
                    r"\s*0\d{2,}[\s\-]?\d{3,}[\s\-]?\d{3,}\s*$", "", tidy
                ).strip()
                if not tidy:
                    continue
                candidates.append(
                    MerchantCandidate(
                        name=tidy,
                        confidence=_header_line_confidence(line, index),
                        source="header_line",
                        merchant_type=guess_merchant_type(line),
                        tokens=merchant_tokens(tidy),
                    )
                )

    candidates.sort(key=lambda c: c.confidence, reverse=True)
    return candidates[:max_candidates]


# The words a street address begins with.
_STREET_WORDS = ("JL", "JLN", "JALAN", "JALAN RAYA", "RAYA", "ALAMAT", "LOKASI")


def _is_a_street_address(line: str) -> bool:
    """
    True when the line is a street address rather than a name.

    "JLN RAYA TLOGOMAS NO. 44 RT. 001 RW. 004" is where the shop is,
    not what it is called. The address is often the longer line, and
    often in capitals, so it has to be recognised on its own words.
    """
    words = re.findall(r"[A-Za-z]+", line)
    if not words:
        return False
    first = words[0].upper()
    if first in _STREET_WORDS:
        return True
    # "RT. 001 RW. 004" on its own is an address part.
    if first in ("RT", "RW", "NO", "KAMPUNG", "KEL", "KEC"):
        return True
    return False


def _normalised_key(name: str) -> str:
    return _normalize(name)


def _after_paid_to_label(line: str) -> Optional[str]:
    """The name after a label that says who was paid."""
    for label in PAID_TO_LABELS:
        match = re.search(
            re.escape(label) + r"\s*[:\-]?\s*(.+)$", line, re.IGNORECASE
        )
        if match:
            value = match.group(1).strip()
            if value:
                return value
    return None


def best_merchant(lines: Sequence[str]) -> Optional[MerchantCandidate]:
    """
    The one shop this receipt is from.

    The shop with the most confidence wins. When there is none at all,
    the caller is told so, rather than being given a name that was
    made up.
    """
    candidates = find_merchant_candidates(lines)
    if not candidates:
        return None
    return candidates[0]


def category_hint_tokens(
    merchant: Optional[MerchantCandidate],
    items: Sequence[Dict[str, Any]],
) -> List[str]:
    """
    The words worth remembering from this receipt.

    The words of the shop, and the names of the things bought there.
    Those are the words that say what the category should be next time.
    """
    tokens: List[str] = []

    if merchant:
        tokens.extend(merchant.tokens)

    for item in items or []:
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        # The words of a product name, without the numbers and the
        # codes, which are different on every receipt.
        for word in _normalize(name).split():
            if len(word) > 2 and not word.isdigit():
                tokens.append(word)

    # The same word twice is one piece of information.
    unique: List[str] = []
    for token in tokens:
        if token not in unique:
            unique.append(token)
    return unique
