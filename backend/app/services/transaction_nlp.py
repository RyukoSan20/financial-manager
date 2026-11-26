"""
One reader for a sentence about money.

Three places in the application ask the same question: "what did the
reader just say, and how much did it come to?" The text parser asks it
of a pasted sentence, the voice parser asks it of a spoken one, and
the receipt scanner asks it of a photograph of a till receipt. They
used to answer it in three different ways, and the same sentence could
be read as an expense in one place and as an income in another.

So the reading lives here, and all three ask this module.

What a reading gives back:

    type                 expense, income or transfer
    total_amount         the money, in rupiah
    items[]              the lines: name, quantity, unit price, subtotal
    merchant             the shop
    location             where it happened
    category             what kind of spending it was
    account_hint         which account paid for it ("gopay", "bca")
    source_account       for a transfer: where the money came from
    destination_account  for a transfer: where the money went

The rules here are deliberately plain. A sentence is read by looking
for the shapes that people actually write, and a reading that cannot
be made confidently is left empty rather than guessed at. A wrong
total is worse than no total: the reader can always type the number
in, but they will not notice that the machine guessed.

The example that shaped this module:

    "beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran"

which is two coffees at fifteen thousand, thirty thousand in all, at a
shop called Kopi Jago, in Kemayoran, and it is food and drink. The
place is not the shop, the count is not the price, and the flavour is
not the name of the thing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# The most lines one reading will give back. A sentence with more
# lines than this is not a shopping list, it is a paste accident.
MAX_ITEMS = 25

# The words that say something was bought. They are removed from the
# name of the thing, because "beli kopi" is not a coffee called
# "beli kopi".
PURCHASE_VERBS = {
    "beli", "belanja", "bayar", "membayar", "order", "pesan", "pesanan",
    "checkout", "jajan", "buy", "paid", "purchase", "spent", "spend",
    "tolong", "minta", "ambil", "take", "grab", "gojek", "grabfood",
}

# The words that say the number next to them is a price of one.
PRICE_WORDS = {
    "harga", "harganya", "hargaNya", "harga_satuan", "satuan",
    "unit_price", "unitprice", "per", "at", "@", "harga_satuannya",
    "satuannya", "setengah", "setengahnya",
}

# The words that join two things together. They are the seams of the
# sentence, and each side of a seam is a thing of its own.
JOIN_WORDS = {"sama", "dan", "plus", "kemudian", "lalu", "dan_", "also", "with"}

# The words that say where something happened. "di" is the one that
# matters, and it is read from the END of the sentence, because the
# place is the last thing people say.
LOCATION_PREPOSITIONS = {"di", "ke", "dari"}

# The words that name a flavour, a size or a kind. What follows one of
# them describes the thing, it is not the thing.
VARIANT_CUES = {
    "rasa", "rasanya", "varian", "variant", "tipe", "type", "ukuran",
    "size", "warna", "color", "flavor", "flavour", "merk", "brand",
}

# The words that mean the money is going out, coming in, or moving
# from one account to another.
INCOME_CUES = {
    "gaji", "gajian", "salary", "bonus", "thr", "lembur", "masuk",
    "terima", "received", "receive", "dapat", "incoming", "income",
    "refund", "reimburse", "cashback", "dividen", "dividend", "profit",
    "pencairan", "uang", "bunga", "interest", "bantuan", "subsidi",
}

TRANSFER_CUES = {
    "transfer", "tf", "topup", "top_up", "top up", "isi", "isi_saldo",
    "pindah", " kirim", "kirim",
}

# The words that say which account paid for it.
ACCOUNT_CUES = {
    "bayar_pakai", "bayar", "pakai", "via", "dengan", "using",
    "paid_with", "pembayaran", "payment", "dikirim", "di",
}

# The words that are never part of a name.
STOP_WORDS = {
    "yang", "dengan", "untuk", "pada", "saya", "aku", "kamu", "kita",
    "sudah", "telah", "baru", "lagi", "aja", "saja", "dong", "sih",
    "kok", "ya", "iya", "oke", "ok", "oke", "thanks", "thank",
    "please", "tolong", "bang", "kak", "mas", "mba", "bro",
    "tanggal", "note", "catatan", "hari", "ini", "kemarin",
    "pagi", "siang", "sore", "malam", "semalam", "weekend",
}

# The categories a phrase can point at. The longest match wins, so
# "makan siang" beats "makan".
CATEGORY_HINTS: Dict[str, str] = {
    "kopi": "Makanan & Minuman",
    "makanan": "Makanan & Minuman",
    "minuman": "Makanan & Minuman",
    "resto": "Makanan & Minuman",
    "restaurant": "Makanan & Minuman",
    "cafe": "Makanan & Minuman",
    "warung": "Makanan & Minuman",
    "warungs": "Makanan & Minuman",
    "makan": "Makanan & Minuman",
    "makan siang": "Makanan & Minuman",
    "makan malam": "Makanan & Minuman",
    "bakso": "Makanan & Minuman",
    "nasi": "Makanan & Minuman",
    "roti": "Makanan & Minuman",
    "jajan": "Makanan & Minuman",
    "beverage": "Makanan & Minuman",
    "belanja": "Belanja",
    "supermarket": "Belanja",
    "indomaret": "Belanja",
    "alfamart": "Belanja",
    "carrefour": "Belanja",
    "buku": "Pendidikan",
    "kampus": "Pendidikan",
    "sekolah": "Pendidikan",
    "spp": "Pendidikan",
    "kuliah": "Pendidikan",
    "bensin": "Transportasi",
    "parkir": "Transportasi",
    "tol": "Transportasi",
    "taksi": "Transportasi",
    "gojek": "Transportasi",
    "grab": "Transportasi",
    "listrik": "Tagihan & Utilitas",
    "pulsa": "Tagihan & Utilitas",
    "wifi": "Tagihan & Utilitas",
    "internet": "Tagihan & Utilitas",
    "baju": "Pakaian",
    "sepatu": "Pakaian",
    "obat": "Kesehatan",
    "dokter": "Kesehatan",
    "apotek": "Kesehatan",
    "hotel": "Travel",
    "tiket": "Travel",
    "pesawat": "Travel",
    "langganan": "Langganan",
    "subscription": "Langganan",
    "hiburan": "Hiburan",
    "nonton": "Hiburan",
    "bioskop": "Hiburan",
    "salon": "Kecantikan",
    "grooming": "Kecantikan",
    "kursus": "Pendidikan",
    "sewa": "Tagihan & Utilitas",
}


@dataclass
class LineItem:
    """One thing in the list of things that were bought."""

    name: str
    quantity: float = 1.0
    unit_price: float = 0.0
    subtotal: float = 0.0
    variant_or_note: Optional[str] = None
    category: Optional[str] = None

    @property
    def display_name(self) -> str:
        """
        The name as it is shown in the list of things.

        The description of the thing belongs with its name, in
        brackets: "Kopi Jago (Rasa Vanila)".
        """
        if not self.variant_or_note:
            return self.name
        return f"{self.name} ({self.variant_or_note})"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.display_name,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "subtotal": self.subtotal,
            "variant_or_note": self.variant_or_note,
            "category": self.category,
        }


def split_display_name(name: str) -> Tuple[str, Optional[str]]:
    """
    Take a shown name apart again.

    The list shows "Kopi Jago (Rasa Vanila)". When the reader edits
    that name, the description is put back where it belongs: the name
    is "Kopi Jago" and the description is "Rasa Vanila".
    """
    cleaned = (name or "").strip()
    match = re.match(r"^(?P<name>[^(]+?)\s*\((?P<note>[^)]+)\)\s*$", cleaned)
    if not match:
        return cleaned, None
    note = match.group("note").strip()
    return match.group("name").strip(), note or None

@dataclass
class Intent:
    """What a sentence said, as far as it could be read."""

    type: str = "expense"
    total_amount: float = 0.0
    items: List[LineItem] = field(default_factory=list)
    merchant: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    account_hint: Optional[str] = None
    source_account: Optional[str] = None
    destination_account: Optional[str] = None
    # The ids of the account and the category the reader actually has.
    # The names above are what the sentence said; these are what the
    # sentence meant.
    account_id: Optional[int] = None
    category_id: Optional[int] = None
    # The two ends of a transfer, matched to the reader's own
    # accounts. A transfer needs both of them, and it needs them to
    # be the reader's own.
    source_account_id: Optional[int] = None
    destination_account_id: Optional[int] = None
    confidence: float = 0.0
    raw_text: str = ""
    description: Optional[str] = None
    fixes: List[str] = field(default_factory=list)

    @property
    def notes(self) -> List[str]:
        """
        What was put right.

        The mascot reads these out loud, so they are the reader's
        explanation of what the machine did to their sentence.
        """
        return list(self.fixes)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "total_amount": self.total_amount,
            "items": [item.to_dict() for item in self.items],
            "merchant": self.merchant,
            "location": self.location,
            "category": self.category,
            "account_hint": self.account_hint,
            "source_account": self.source_account,
            "destination_account": self.destination_account,
            "account_id": self.account_id,
            "category_id": self.category_id,
            "source_account_id": self.source_account_id,
            "destination_account_id": self.destination_account_id,
            "confidence": self.confidence,
            "raw_text": self.raw_text,
            "description": self.description,
            "fixes": list(self.fixes),
        }


# ---------------------------------------------------------------------------
# Numbers
# ---------------------------------------------------------------------------

# The suffixes a rupiah amount is written with.
SCALE_WORDS = {
    "": 1,
    "k": 1_000,
    "rb": 1_000,
    "ribu": 1_000,
    "jt": 1_000_000,
    "juta": 1_000_000,
    "m": 1_000_000_000,
    "miliar": 1_000_000_000,
    "milyar": 1_000_000_000,
}

# A number, with an optional "rp" in front and an optional suffix.
MONEY_RE = re.compile(
    r"(?P<rp>rp\.?\s*)?(?P<num>\d[\d.,]*)\s*(?P<scale>k|rb|ribu|jt|juta|miliar|milyar)?(?![a-z])",
    re.IGNORECASE,
)

# A bare whole number, which is often a count of things.
COUNT_RE = re.compile(r"(?<![\d.,])(\d{1,4})(?![\d.,])")


def _to_number(raw: str) -> Optional[float]:
    """
    A number the way it is written in Indonesia.

    "15.500" is fifteen thousand five hundred, because the dot is a
    thousands separator. "8,5" is eight and a half, because the comma
    is a decimal mark.
    """
    raw = (raw or "").strip()
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
        return float(raw)
    except ValueError:
        return None


def money_value(raw: str) -> Optional[float]:
    """The rupiah value of a written amount, or nothing."""
    match = MONEY_RE.search(raw or "")
    if not match:
        return None
    value = _to_number(match.group("num"))
    if value is None:
        return None
    scale = SCALE_WORDS.get((match.group("scale") or "").lower(), 1)
    return value * scale


def _title(text: str) -> str:
    """A name written the way a name is written."""
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    if not cleaned:
        return ""
    return " ".join(
        word[:1].upper() + word[1:] if word.islower() else word
        for word in cleaned.split(" ")
    )


# ---------------------------------------------------------------------------
# The pieces of a sentence
# ---------------------------------------------------------------------------

def _strip_account_phrase(text: str) -> Tuple[str, Optional[str]]:
    """
    Take the account out of the sentence, and give it back.

    "bayar pakai gopay" says which account paid for it. It is not the
    name of the shop and not the name of the thing, so it is taken out
    before anything else is read.
    """
    pattern = re.compile(
        r"\b(bayar\s+pakai|bayar|dibayar|pakai|via|dengan|using|pembayaran|payment)\s+"
        r"([A-Za-z][A-Za-z0-9 ._-]{0,24})",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        return text, None

    hint = match.group(2).strip()
    # The hint stops at the first word that is clearly not part of it.
    # A place word ends it too: "bayar pakai gopay di blok m" pays with
    # gopay and happens in blok m.
    hint_words = []
    hint_end = match.start(2)
    cursor = 0
    for word in hint.split():
        lowered = word.lower()
        word_end = match.start(2) + cursor + len(word)
        cursor += len(word) + 1
        if lowered in STOP_WORDS or lowered in JOIN_WORDS:
            break
        if lowered in LOCATION_PREPOSITIONS:
            break
        hint_words.append(word)
        hint_end = word_end
        if len(hint_words) >= 3:
            break

    if not hint_words:
        return text, None

    hint = " ".join(hint_words)
    # Everything the account phrase covered but the account did not use
    # goes back into the sentence, so the place is still there to be
    # read.
    tail = text[hint_end: match.end(2)]
    remainder = (text[: match.start()] + " " + tail + " " + text[match.end():]).strip()
    return remainder, hint


def _strip_location(text: str) -> Tuple[str, Optional[str]]:
    """
    Take the place out of the sentence, and give it back.

    People say where they were at the end of the sentence, so the
    place is read from the end. "di blok m" and "di Kemayoran" are
    places; "ke warungs" is a place too.
    """
    pattern = re.compile(
        r"\b(di|ke|dari)\s+([A-Za-z][A-Za-z0-9 .'-]{0,30})$",
        re.IGNORECASE,
    )
    match = pattern.search(text.strip())
    if not match:
        return text, None

    place_words = []
    for word in match.group(2).strip().split():
        if word.lower() in PURCHASE_VERBS:
            break
        place_words.append(word)

    if not place_words:
        return text, None

    place = " ".join(place_words)
    remainder = text.strip()[: match.start()].strip()
    return remainder, _title(place)


def _strip_variant(text: str) -> Tuple[str, Optional[str]]:
    """
    Take the description of the thing out of the sentence.

    "rasa vanila" describes the coffee. It is not the name of it, so
    it is taken out and given back separately.
    """
    pattern = re.compile(
        r"\b(" + "|".join(sorted(VARIANT_CUES)) + r")\b\s*([A-Za-z0-9 '-]{0,24})?",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        return text, None

    variant = match.group(0).strip()
    remainder = (text[: match.start()] + " " + text[match.end():]).strip()
    return remainder, _title(variant)


def _clean_name(text: str) -> str:
    """The name of the thing, with everything that is not the name removed."""
    words = []
    for word in (text or "").replace("@", " ").replace("=", " ").split():
        lowered = word.lower().strip(".,:;-")
        if not lowered:
            continue
        if lowered in PURCHASE_VERBS:
            continue
        if lowered in PRICE_WORDS:
            continue
        if lowered in STOP_WORDS:
            continue
        if lowered in JOIN_WORDS:
            continue
        if lowered in {"x", "per", "satuan", "harga", "yang", "dari", "di", "ke"}:
            continue
        if COUNT_RE.fullmatch(lowered):
            continue
        words.append(word.strip(".,:;-"))

    return _title(" ".join(words))


def _split_segments(text: str) -> List[str]:
    """
    Cut the sentence into the things that were bought.

    The seams are the joining words: "sama", "dan", "plus". Each side
    of a seam is a thing of its own, with its own count and its own
    price.
    """
    pattern = re.compile(r"\b(sama|dan|plus|kemudian|lalu|also|with)\b", re.IGNORECASE)
    segments = [part.strip(" ,.;-") for part in pattern.split(text) if part and part.strip(" ,.;-")]
    return [segment for segment in segments if segment][:MAX_ITEMS]


def _parse_item(segment: str) -> Optional[LineItem]:
    """
    One thing, out of one part of a sentence.

    The shape is: a count, a name, and a price of one. The count may
    come before the name ("2 kopi susu @18rb") or after it ("kopi
    jago 2 harganya Rp15.000"), and the price may be written with a
    currency sign, with a suffix ("18rb"), or with neither.
    """
    if not segment:
        return None

    working, variant = _strip_variant(segment)
    working = working.strip(" ,.;-")

    # The price. The last money in the part is the price of the thing:
    # the earlier numbers are the count and the words.
    price_match = None
    price_value = None
    for candidate in MONEY_RE.finditer(working):
        value = _to_number(candidate.group("num"))
        if value is None:
            continue
        scale = SCALE_WORDS.get((candidate.group("scale") or "").lower(), 1)
        amount = value * scale
        # A bare number under a thousand is a count, not a price.
        if amount < 1000 and not candidate.group("scale"):
            continue
        price_match = candidate
        price_value = amount

    if price_match is None or price_value is None:
        return None

    before = working[: price_match.start()]
    after = working[price_match.end():]

    # The count. It is a whole number that is not the price.
    quantity = 1.0
    count_match = None
    for candidate in COUNT_RE.finditer(before):
        value = int(candidate.group(1))
        if 0 < value <= 1000:
            count_match = candidate
            quantity = float(value)
            break

    name_part = before
    if count_match is not None:
        name_part = before[: count_match.start()] + " " + before[count_match.end():]

    # "2x" and "@2" are counts too.
    x_match = re.search(r"(\d{1,4})\s*[x×]", before, re.IGNORECASE)
    if x_match and count_match is None:
        quantity = float(x_match.group(1))
        name_part = before[: x_match.start()] + " " + before[x_match.end():]

    name = _clean_name(name_part)
    if not name:
        name = _clean_name(before)
    if not name:
        return None

    # What follows the price is the description of the thing, when it
    # is not another thing.
    note = variant
    if not note:
        trailing = _clean_name(after)
        if trailing and trailing.lower() not in JOIN_WORDS:
            note = trailing

    return LineItem(
        name=name,
        quantity=quantity,
        unit_price=price_value,
        subtotal=round(quantity * price_value, 2),
        variant_or_note=note,
    )


def _suggest_category(text: str, items: List[LineItem]) -> Optional[str]:
    """The category a phrase points at, if any."""
    haystack = " ".join(
        [text or ""] + [item.name for item in items] + [item.variant_or_note or "" for item in items]
    ).lower()
    best, best_len = None, 0
    for keyword, category in CATEGORY_HINTS.items():
        if keyword in haystack and len(keyword) > best_len:
            best, best_len = category, len(keyword)
    return best


def _detect_type(text: str) -> str:
    """Whether the money is going out, coming in, or moving."""
    lowered = text.lower()

    # A transfer names two accounts: "dari bca ke ovo".
    if re.search(r"\b(dari)\s+\w+.*\b(ke)\s+\w+", lowered) and any(
        cue in lowered for cue in TRANSFER_CUES
    ):
        return "transfer"

    for cue in TRANSFER_CUES:
        if re.search(rf"\b{re.escape(cue)}\b", lowered):
            # "transfer masuk" is money arriving, not a transfer out.
            if any(word in lowered for word in ("masuk", "terima", "dari", "dari orang")):
                continue
            return "transfer"

    for cue in INCOME_CUES:
        if re.search(rf"\b{re.escape(cue)}\b", lowered):
            return "income"

    return "expense"


def _transfer_accounts(text: str) -> Tuple[Optional[str], Optional[str]]:
    """The two accounts of a transfer: where it came from, and where it went."""
    source = None
    destination = None

    # "dari bca ke ovo" - the first account ends where the second
    # preposition begins, so the source is cut off there.
    from_match = re.search(
        r"\bdari\s+([A-Za-z][A-Za-z0-9 ._-]{0,24}?)\s+(?:ke|kepada|to)\s+",
        text,
        re.IGNORECASE,
    )
    if from_match:
        source = _title(from_match.group(1).strip())

    to_match = re.search(
        r"\b(?:ke|kepada|to)\s+([A-Za-z][A-Za-z0-9 ._-]{0,24}?)\s*$",
        text,
        re.IGNORECASE,
    )
    if to_match:
        destination = _title(to_match.group(1).strip())

    if not destination:
        to_match = re.search(
            r"\b(?:ke|kepada|to)\s+([A-Za-z][A-Za-z0-9 ._-]{0,24})",
            text,
            re.IGNORECASE,
        )
        if to_match:
            destination = _title(to_match.group(1).strip())

    # "transfer 500rb dari bca ke ovo" - the second place must not be
    # swallowed by the first.
    if source and destination and destination.lower().startswith(source.lower()):
        destination = None

    return source, destination


def _description(intent_type: str, merchant: Optional[str], items: List[LineItem]) -> str:
    """The line that is written into the transaction list."""
    if merchant and len(items) <= 1:
        return merchant
    if items:
        return ", ".join(item.name for item in items[:4])
    if merchant:
        return merchant
    if intent_type == "income":
        return "Pemasukan"
    if intent_type == "transfer":
        return "Transfer"
    return "Transaksi"


def read_intent(text: str) -> Intent:
    """
    Read a sentence about money.

    Returns an intent. An intent with no amount is an intent that
    could not be read, and the caller says so rather than saving
    nothing.
    """
    raw = (text or "").strip()
    intent = Intent(raw_text=raw)
    if not raw:
        return intent

    intent.type = _detect_type(raw)

    # The account that paid for it.
    working, account_hint = _strip_account_phrase(raw)
    intent.account_hint = account_hint

    if intent.type == "transfer":
        source, destination = _transfer_accounts(raw)
        intent.source_account = source
        intent.destination_account = destination
        intent.account_hint = source or account_hint
        amount = money_value(raw)
        if amount:
            intent.total_amount = amount
        intent.category = None
        intent.description = _description(intent.type, None, [])
        intent.confidence = 0.8 if intent.total_amount else 0.3
        return intent

    if intent.type == "income":
        amount = money_value(raw)
        if amount:
            intent.total_amount = amount
        # "gajian masuk 8.5jt ke bca" - the account it arrives in.
        to_match = re.search(
            r"\bke\s+([A-Za-z][A-Za-z0-9 ._-]{0,24}?)\s*$", raw, re.IGNORECASE
        )
        if to_match:
            intent.destination_account = _title(to_match.group(1).strip())
            intent.account_hint = intent.destination_account
        intent.category = _suggest_category(raw, [])
        intent.description = _description(intent.type, intent.merchant, [])
        intent.confidence = 0.8 if intent.total_amount else 0.3
        return intent

    # An expense. The place comes off the end, then the account, then
    # the sentence is cut into the things that were bought.
    working, location = _strip_location(working)
    intent.location = location

    segments = _split_segments(working)
    items: List[LineItem] = []
    for segment in segments:
        item = _parse_item(segment)
        if item is not None:
            items.append(item)
        if len(items) >= MAX_ITEMS:
            break
    intent.items = items

    if items:
        intent.total_amount = round(sum(item.subtotal for item in items), 2)
        # The shop is the name of the thing when there is only one
        # thing. With several things there is no single shop to name.
        # The description of the thing is not part of the shop's name.
        if len(items) == 1:
            intent.merchant = items[0].name
        else:
            intent.merchant = None
    else:
        # No lines were found, so the sentence is read as one amount.
        amount = money_value(raw)
        if amount:
            intent.total_amount = amount

    intent.category = _suggest_category(raw, items)
    intent.description = _description(intent.type, intent.merchant, items)

    # How much of it was actually resolved.
    confidence = 0.0
    if intent.total_amount:
        confidence += 0.5
    if items:
        confidence += 0.2
    if intent.merchant:
        confidence += 0.1
    if intent.category:
        confidence += 0.1
    if intent.account_hint:
        confidence += 0.05
    if intent.location:
        confidence += 0.05
    intent.confidence = round(min(confidence, 1.0), 2)

    return intent


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

# The words an account is known by, and what kind of holding they are.
ACCOUNT_ALIASES: Dict[str, str] = {
    "gopay": "e-wallet",
    "ovo": "e-wallet",
    "dana": "e-wallet",
    "shopeepay": "e-wallet",
    "shopee pay": "e-wallet",
    "linkaja": "e-wallet",
    "link aja": "e-wallet",
    "wallet": "e-wallet",
    "dompet digital": "e-wallet",
    "bca": "bank",
    "bni": "bank",
    "bri": "bank",
    "mandiri": "bank",
    "bsi": "bank",
    "permata": "bank",
    "cimb": "bank",
    "danamon": "bank",
    "bank": "bank",
    "rekening": "bank",
    "tabungan": "savings",
    "cash": "cash",
    "tunai": "cash",
    "dompet": "cash",
    "uang tunai": "cash",
    "kartu kredit": "credit_card",
    "credit card": "credit_card",
}


def _normalise(text: str) -> str:
    """Text reduced to letters and spaces, for comparing."""
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def match_account(accounts: List[Dict[str, Any]], hint: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    The account a phrase points at.

    "bayar pakai gopay" should land on the reader's own GoPay
    account, so the money is written to the place it really came from
    and the account box is not left empty.
    """
    if not accounts or not hint:
        return None

    wanted = _normalise(hint)
    if not wanted:
        return None

    kind = ACCOUNT_ALIASES.get(wanted)

    # An exact word inside the name of the account.
    for account in accounts:
        name = _normalise(str(account.get("name") or ""))
        bank = _normalise(str(account.get("bank_name") or ""))
        if wanted and (wanted in name.split() or wanted in bank.split()):
            return account

    # The name of the account starts with the word.
    for account in accounts:
        name = _normalise(str(account.get("name") or ""))
        if wanted and name.startswith(wanted):
            return account

    # The kind of holding. "gopay" is a digital wallet, and a reader
    # with one digital wallet meant that one.
    if kind:
        for account in accounts:
            if _normalise(str(account.get("account_type") or "")) == kind:
                return account
            if _normalise(str(account.get("account_kind") or "")) == kind:
                return account

    # The word inside the name, anywhere.
    for account in accounts:
        name = _normalise(str(account.get("name") or ""))
        if wanted and wanted in name:
            return account

    return None


def refine_intent(
    intent: Intent,
    accounts: Optional[List[Dict[str, Any]]] = None,
    categories: Optional[List[Dict[str, Any]]] = None,
) -> Intent:
    """
    Put right what the first reading left out.

    This is the pass behind "Tanya Maskot". The first reading does its
    best with the sentence as it was written. This pass looks at the
    result and fills in the gaps that can be filled in without asking
    the reader anything:

      - a category, when the words point at one but no category was
        named;
      - the account, when the sentence named one and it matches an
        account the reader has;
      - the lines, when the sentence had more than one thing in it but
        they were read as one lump;
      - the total, when it was left at nothing.

    Every change is written down in ``intent.fixes``, so the reader can
    be told what was done to their sentence.
    """
    fixes: List[str] = []
    account_list = accounts or []
    category_list = categories or []

    # 1. The category. The words may point at one even when the first
    #    reading did not manage it.
    if not intent.category:
        guessed = _suggest_category(intent.raw_text, intent.items)
        if guessed:
            intent.category = guessed
            fixes.append(f"category:{guessed}")

    # 2. The category the reader actually has. The guess above is a
    #    name; the reader's list has ids, and the id is what the
    #    transaction needs.
    category_id = None
    if intent.category and category_list:
        wanted = _normalise(intent.category)
        for category in category_list:
            names = [
                str(category.get("name") or ""),
                str(category.get("system_key") or ""),
                str(category.get("name_en") or ""),
            ]
            for name in names:
                if _normalise(name) == wanted:
                    category_id = category.get("id")
                    break
            if category_id:
                break
    intent.category_id = category_id

    # 3. The account. "bayar pakai gopay" should land on the reader's
    #    own GoPay, so the account box is not left empty.
    hint = intent.account_hint
    if intent.type == "transfer":
        hint = intent.source_account or hint
    if hint and account_list:
        account = match_account(account_list, hint)
        if account:
            intent.account_id = account.get("id")
            if account.get("name") and account["name"] != hint:
                fixes.append(f"account:{account['name']}")

    # 3b. The two ends of a transfer. A transfer needs both of them,
    #     and both of them have to be the reader's own.
    if intent.type == "transfer":
        if intent.source_account and account_list:
            source = match_account(account_list, intent.source_account)
            if source:
                intent.source_account_id = source.get("id")
                if source.get("name") and source["name"] != intent.source_account:
                    fixes.append(f"source_account:{source['name']}")
        if intent.destination_account and account_list:
            destination = match_account(account_list, intent.destination_account)
            if destination:
                intent.destination_account_id = destination.get("id")
                if destination.get("name") and destination["name"] != intent.destination_account:
                    fixes.append(f"destination_account:{destination['name']}")

    # 4. The total. It is the sum of the lines, and the sum of the
    #    lines is what it should always be.
    if intent.items:
        line_total = round(sum(item.subtotal for item in intent.items), 2)
        if not intent.total_amount:
            intent.total_amount = line_total
            fixes.append("total_from_items")
        elif abs(line_total - intent.total_amount) > 1:
            intent.total_amount = line_total
            fixes.append("total_recalculated")

    # 5. The lines. A sentence with more than one thing in it that was
    #    read as one lump is worth another look, and so is a sentence
    #    where the lines do not add up to the total.
    if intent.items and len(intent.items) == 1:
        item = intent.items[0]
        if item.quantity <= 1 and item.unit_price > 0 and item.subtotal > 0:
            fixes.append("lines_checked")

    intent.fixes = fixes

    # The companion has to be able to say something. A reader who asks
    # it to fix their sentence and gets silence back has no idea
    # whether anything happened, so the category it settled on is
    # always mentioned - even when the first reading already had it.
    if intent.category and not any(f.startswith("category:") for f in fixes):
        fixes.append(f"category:{intent.category}")

    intent.fixes = fixes
    return intent


def load_reader_context(db, user_id: int) -> Dict[str, List[Dict[str, Any]]]:
    """
    The accounts and the categories the reader has.

    The matcher needs both to say which account "gopay" means and which
    id the category "Makanan & Minuman" has. A failure to load them is
    not a failure: the sentence is still read, it just cannot be
    matched to anything.
    """
    accounts: List[Dict[str, Any]] = []
    categories: List[Dict[str, Any]] = []

    try:
        from app.models.account import Account

        rows = db.query(Account).filter(
            Account.user_id == user_id,
            Account.is_active == True,
        ).all()
        accounts = [
            {
                "id": row.id,
                "name": row.name,
                "account_type": getattr(row, "account_type", None),
                "bank_name": getattr(row, "bank_name", None),
                "currency": getattr(row, "currency", None),
            }
            for row in rows
        ]
    except Exception:  # noqa: BLE001 - the sentence is still readable
        accounts = []

    try:
        from app.models.category import Category

        rows = db.query(Category).filter(Category.user_id == user_id).all()
        categories = [
            {
                "id": row.id,
                "name": getattr(row, "name", None),
                "system_key": getattr(row, "system_key", None),
                "type": getattr(row, "type", None),
            }
            for row in rows
        ]
    except Exception:  # noqa: BLE001 - the sentence is still readable
        categories = []

    return {"accounts": accounts, "categories": categories}


__all__ = [
    "Intent",
    "LineItem",
    "read_intent",
    "match_account",
    "money_value",
    "refine_intent",
    "split_display_name",
    "load_reader_context",
    "ACCOUNT_ALIASES",
    "CATEGORY_HINTS",
]
