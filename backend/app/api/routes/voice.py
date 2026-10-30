"""
Voice-to-Transaction API.

Turns a spoken phrase ("beli kopi dua puluh lima ribu") into a structured
transaction the app can save directly.

Design notes:
- The browser does the speech recognition (Web Speech API) and sends plain
  text. The backend never touches audio.
- Number words are parsed with a token walker so that "dua puluh lima ribu"
  resolves to 25000 and "lima ratus ribu" to 500000.
- Merchant extraction works on the text with the amount span removed, so
  amount words never leak into the merchant name.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal, InvalidOperation
import re
import logging

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Voice"])


# ---------------------------------------------------------------------------
# Number vocabulary
# ---------------------------------------------------------------------------

BASE_WORDS = {
    "nol": 0, "zero": 0,
    "satu": 1, "one": 1,
    "dua": 2, "two": 2,
    "tiga": 3, "three": 3,
    "empat": 4, "four": 4,
    "lima": 5, "five": 5,
    "enam": 6, "six": 6,
    "tujuh": 7, "seven": 7,
    "delapan": 8, "eight": 8,
    "sembilan": 9, "nine": 9,
}

TEEN_WORDS = {
    "sepuluh": 10, "ten": 10,
    "sebelas": 11, "eleven": 11,
    "duabelas": 12, "twelve": 12,
    "tiga belas": 13, "thirteen": 13,
    "empat belas": 14, "fourteen": 14,
    "lima belas": 15, "fifteen": 15,
    "sepuluh belas": 16, "sixteen": 16,
    "tujuh belas": 17, "seventeen": 17,
    "delapan belas": 18, "eighteen": 18,
    "sembilan belas": 19, "nineteen": 19,
}

TENS_WORDS = {
    "dua puluh": 20, "twenty": 20,
    "tiga puluh": 30, "thirty": 30,
    "empat puluh": 40, "forty": 40,
    "lima puluh": 50, "fifty": 50,
    "enam puluh": 60, "sixty": 60,
    "tujuh puluh": 70, "seventy": 70,
    "delapan puluh": 80, "eighty": 80,
    "sembilan puluh": 90, "ninety": 90,
}

# "puluh" and "ratus" are multipliers applied to the group built so far.
GROUP_MULTIPLIERS = {
    "puluh": 10, "hundred": 100,
    "ratus": 100,
    "seratus": 100, "seribu": 1000,
}

SCALE_WORDS = {
    "ribu": 1_000, "rb": 1_000, "thousand": 1_000,
    "juta": 1_000_000, "jt": 1_000_000, "million": 1_000_000,
    "miliar": 1_000_000_000, "milyar": 1_000_000_000, "billion": 1_000_000_000,
}

ALL_NUMBER_WORDS = (
    set(BASE_WORDS) | set(TEEN_WORDS) | set(TENS_WORDS)
    | set(GROUP_MULTIPLIERS) | set(SCALE_WORDS)
)

# Income vs expense cues.
INCOME_CUES = {
    "terima", "masuk", "gaji", "salary", "income", "dapat", "bonus",
    "refund", "reimburse", "dibayar", "profit", "dividen", "pencairan",
}
EXPENSE_CUES = {
    "beli", "bayar", "belanja", "keluar", "spend", "buy", "paid", "purchase",
    "transaksi", "topup", "top", "isi", "transfer", "debit",
}

# Multi-word cues that must be recognised before their single-word parts.
EXPENSE_PHRASES = ["top up", "topup", "isi saldo", "transfer ke", "beli"]

# Words that are never part of a merchant name.
MERCHANT_STOPWORDS = {
    "untuk", "di", "ke", "dari", "dengan", "pada", "rupiah", "rp",
    "saya", "aku", "ingin", "mau", "harus", "tolong", "bisa", "sudah",
    "hari", "ini", "kemarin", "kategori", "tanggal", "note", "catatan",
    "makan", "makan siang", "makan malam", "siang", "malam", "sarapan",
    "sore", "pagi", "makan siang", "lunch", "dinner", "breakfast",
    "expense", "income", "pengeluaran", "pemasukan", "biaya", "harga",
}

CATEGORY_HINTS = {
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
    "bakso": "Makanan & Minuman",
    "nasi": "Makanan & Minuman",
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
    "grab": "Transportasi",
    "gojek": "Transportasi",
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
    "hiburan": "Hiburan", "nonton": "Hiburan", "bioskop": "Hiburan",
    "salon": "Kecantikan", "grooming": "Kecantikan",
}

# Tokenizer: a word or a number, with its position in the source string.
TOKEN_RE = re.compile(r"[a-z]+|\d[\d.,]*")


def _parse_numeric_token(token: str) -> Optional[Decimal]:
    """Parse a numeric token using Indonesian/English separator conventions.

    "15.500" -> 15500 (dot is a thousands separator)
    "1,5"    -> 1.5   (comma is a decimal separator)
    """
    token = token.strip()
    if not token:
        return None

    def _convert(raw: str) -> Optional[Decimal]:
        raw = raw.strip()
        if not raw:
            return None
        if "." in raw and "," in raw:
            # The right-most separator is the decimal one.
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

    return _convert(token)


def _tokens(text: str):
    """Yield (token, start, end) for every word/number in the text."""
    for m in TOKEN_RE.finditer(text.lower()):
        yield m.group(0), m.start(), m.end()


def _parse_number_from_tokens(tokens, index):
    """Parse a number phrase starting at tokens[index].

    Returns (value, next_index). Handles combinations such as:
    "dua puluh lima", "lima ratus", "25", "1,5", "dua puluh lima ribu".
    """
    value = Decimal(0)
    got = False
    i = index

    while i < len(tokens):
        token = tokens[i][0]

        # Multi-word tens ("dua puluh") and teens ("tiga belas")
        two = f"{token} {tokens[i + 1][0]}" if i + 1 < len(tokens) else ""
        if two in TENS_WORDS:
            value += TENS_WORDS[two]
            got = True
            i += 2
            continue
        if two in TEEN_WORDS:
            value += TEEN_WORDS[two]
            got = True
            i += 2
            continue

        if token in BASE_WORDS:
            value += BASE_WORDS[token]
            got = True
            i += 1
            continue

        if token in TEEN_WORDS:
            value += TEEN_WORDS[token]
            got = True
            i += 1
            continue

        # Single-word tens: "fifty", "twenty", "thirty", ...
        if token in TENS_WORDS:
            value += TENS_WORDS[token]
            got = True
            i += 1
            continue

        if token in GROUP_MULTIPLIERS:
            multiplier = GROUP_MULTIPLIERS[token]
            base = value if value else Decimal(1)
            value = base * multiplier
            got = True
            i += 1
            continue
        if token in SCALE_WORDS:
            if not got:
                break
            value = value * SCALE_WORDS[token]
            i += 1
            # A scale word may be followed by a smaller group:
            # "tiga puluh lima ribu dua ratus" = 35_000 + 200.
            # Keep walking so the remainder is added, but remember the scale
            # so a following group is not multiplied again.
            if i < len(tokens):
                tail, next_i = _parse_number_from_tokens(tokens, i)
                if tail is not None and 0 < tail < SCALE_WORDS[token]:
                    value += tail
                    i = next_i
            break

        if token[0].isdigit():
            num = _parse_numeric_token(token)
            if num is None:
                break
            value += num
            got = True
            i += 1
            continue

        break

    return (value if got else None), i


def find_amount(text: str):
    """Find the first amount in the text.

    Returns (Decimal|None, (start, end)|None). The span is used to remove the
    amount from the text before the merchant name is extracted.
    """
    text = text.lower()
    tokens = list(_tokens(text))

    for idx in range(len(tokens)):
        value, next_idx = _parse_number_from_tokens(tokens, idx)
        if value is None:
            continue
        if value <= 0:
            continue

        start = tokens[idx][1]
        end = tokens[next_idx - 1][2]

        # Reject a bare number that is part of a larger token run that starts
        # with a word (e.g. the "25000" in "kopi 25000" is fine, but a stray
        # digit inside a name should not win).
        return value, (start, end)

    return None, None


def extract_amount(text: str) -> Optional[Decimal]:
    """Extract the transaction amount from a spoken phrase."""
    value, _ = find_amount(text)
    return value


def extract_merchant(text: str, amount_span=None) -> Optional[str]:
    """Extract a merchant name from a spoken phrase.

    The amount span is removed first so amount words never leak into the
    name. A location cue ("di warungs") wins over the leading words.
    """
    if amount_span:
        start, end = amount_span
        residual = text.lower()[:start] + " " + text.lower()[end:]
    else:
        residual = text.lower()

    residual = re.sub(r"[^a-z\s]", " ", residual)
    words = [w for w in residual.split() if w]

    # Collapse multi-word cues so "top up" is not mistaken for a merchant.
    collapsed = []
    i = 0
    while i < len(words):
        two = f"{words[i]} {words[i + 1]}" if i + 1 < len(words) else ""
        if two in EXPENSE_PHRASES:
            collapsed.append(two.replace(" ", ""))
            i += 2
            continue
        collapsed.append(words[i])
        i += 1
    words = collapsed

    # A preposition introduces the merchant: "di warungs", "ke alfamart".
    merchant_words = []
    for i, word in enumerate(words):
        if word in ("di", "ke", "dari") and i + 1 < len(words):
            merchant_words = words[i + 1:i + 4]
            break

    if not merchant_words:
        merchant_words = words[:3]

    cleaned = []
    for word in merchant_words:
        if word in MERCHANT_STOPWORDS:
            continue
        if word in EXPENSE_CUES or word in INCOME_CUES:
            continue
        if word in SCALE_WORDS or word in GROUP_MULTIPLIERS:
            continue
        if word in ALL_NUMBER_WORDS:
            continue
        if word in {"bersama", "teman", "keluarga"}:
            break
        cleaned.append(word)

    if not cleaned:
        return None

    # A merchant name is rarely more than four words.
    name = " ".join(cleaned[:4]).strip()
    if len(name) < 2:
        return None
    return name.title()


def detect_transaction_type(text: str, db=None, user_id=None) -> str:
    """
    Detect whether the phrase describes income or expense.

    This used to be a pair of keyword lists of its own, which meant the
    voice parser could disagree with the quick entry box about the same
    sentence. It now asks the shared classifier, so every capture path
    gives the same answer.
    """
    from app.services.direction_classifier import classify_direction

    result = classify_direction(text, db=db, user_id=user_id)
    if result.direction == "transfer":
        # A transfer is recorded as money leaving the account it was
        # made from. The transaction table has no separate direction
        # for it.
        return "expense"
    return result.direction


def suggest_category(text: str, merchant: Optional[str] = None) -> Optional[str]:
    """Suggest a category from keyword cues in the phrase."""
    haystack = text.lower()
    if merchant:
        haystack += " " + merchant.lower()
    best, best_len = None, 0
    for keyword, category in CATEGORY_HINTS.items():
        if keyword in haystack and len(keyword) > best_len:
            best, best_len = category, len(keyword)
    return best


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

class VoiceParseRequest(BaseModel):
    # Either name is accepted: the browser recognises speech as a
    # "transcript", while the rest of the app calls it "text". Making both
    # optional means the caller never has to rename it first.
    text: Optional[str] = Field(default=None, max_length=1000)
    transcript: Optional[str] = Field(default=None, max_length=1000)
    account_id: Optional[int] = None
    # The browser may send the recognition as a list of chunks. They are
    # cleaned and joined server-side, which removes the duplicates that
    # straddle two chunks.
    segments: Optional[List[str]] = None


class VoiceParseResponse(BaseModel):
    amount: Optional[float] = None
    transaction_type: str = "expense"
    merchant_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    confidence_score: float = 0.0
    raw_text: str
    # The cleaned text. This is what the parser actually read, so the UI
    # can show the user exactly what was understood.
    cleaned_text: Optional[str] = None
    missing_fields: List[str] = []


@router.post("/parse", response_model=VoiceParseResponse)
def parse_voice_text(
    request: VoiceParseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parse a spoken phrase into a structured transaction."""
    from app.services.voice_cleanup import clean_transcript, clean_transcript_segments

    raw = (request.text or request.transcript or "").strip()
    if not raw:
        raise HTTPException(
            status_code=422,
            detail="Isi 'text' atau 'transcript' dengan kalimat yang diucapkan.",
        )

    # Clean the transcript before parsing. The speech engine commonly
    # repeats a word and mangles a brand name; both would otherwise turn
    # into a wrong amount or a wrong merchant.
    if request.segments:
        cleaned = clean_transcript_segments(request.segments)
    else:
        cleaned = clean_transcript(raw)
    # The parser has to read the CLEANED text. Without this the cleanup
    # ran but its result was thrown away, so "duapuluh" still failed to
    # parse and "dua puluh dua puluh" still counted as 40.000.
    raw = cleaned or raw

    if not raw:
        raise HTTPException(status_code=400, detail="Teks kosong")

    amount, span = find_amount(raw)
    merchant = extract_merchant(raw, span)
    tx_type = detect_transaction_type(
        raw, db=db, user_id=current_user.id if current_user else None
    )
    category = suggest_category(raw, merchant)

    # Confidence reflects how much of the transaction we actually resolved.
    confidence = 0.0
    if amount is not None and amount > 0:
        confidence += 0.6
    if merchant:
        confidence += 0.25
    if category:
        confidence += 0.15
    confidence = round(min(confidence, 1.0), 2)

    missing = []
    if amount is None or amount <= 0:
        missing.append("amount")
    if not merchant:
        missing.append("merchant_name")

    logger.info(
        f"Voice parse: amount={amount} merchant={merchant!r} type={tx_type} conf={confidence} "
        f"raw={request.text!r} cleaned={raw!r}"
    )

    return VoiceParseResponse(
        amount=float(amount) if amount is not None else None,
        transaction_type=tx_type,
        merchant_name=merchant,
        description=raw[:200],
        category=category,
        confidence_score=confidence,
        raw_text=request.text,
        cleaned_text=cleaned,
        missing_fields=missing,
    )


@router.get("/examples")
def voice_examples():
    """Example phrases the UI can show the user."""
    return {
        "examples": [
            "beli kopi dua puluh lima ribu",
            "makan siang dua puluh ribu di warungs",
            "bayar bensin lima puluh ribu",
            "gaji dua juta",
            "beli buku tiga puluh lima ribu dua ratus",
            "top up lima puluh ribu",
            "beli makan 15.500",
            "terima bonus lima ratus ribu",
        ]
    }
