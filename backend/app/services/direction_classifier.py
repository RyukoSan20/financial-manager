"""
Working out whether a transaction is money coming in or money going out.

This is the one question every capture path has to answer: the quick
entry box, the voice parser, the receipt scanner, the SMS reader and the
AI agent. Before this module each of them had its own keyword list, and
the lists disagreed, so the same phrase could be recorded as an expense in
one place and as income in another.

The approach here has three layers, and they are consulted in that order:

1. What the user has already taught us. Every time a transaction the
   user created is stored, the wording of the description and the name of
   the merchant are remembered together with the direction the money went.
   A phrase that has been seen before is answered from that memory. This
   layer is the strongest one, because it is the only one that comes from
   the user's own data rather than from a guess.

2. Scoring the wording. Indonesian banking and shopping language has a
   small number of words that reliably point one way or the other, and
   some that point the other way depending on what surrounds them. The
   score is a sum of weighted signals rather than a first match, so a
   phrase that carries both signals is decided by how strongly each one
   is expressed. "gaji" is a very strong income signal; "dibayar" is a
   weak one on its own, because it is used for both directions.

3. Asking the model. When the first two layers cannot separate the
   cases, Gemini is asked to read the phrase. The model is treated as
   strictly optional: if the provider is slow, rate limited or absent,
   the answer falls back to the score with a lower confidence.

The module deliberately does not return a bare string. It returns the
direction, how sure it is, which signal decided it, and a short reason
that can be shown to the user, so a wrong call can be understood rather
than just corrected silently.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# The three directions a transaction can go.
INCOME = "income"
EXPENSE = "expense"
TRANSFER = "transfer"

# How sure the answer is. The bands let a caller decide whether to
# auto-apply the answer or to ask the user.
HIGH = "high"
MEDIUM = "medium"
LOW = "low"

_CONFIDENCE_HIGH = 0.80
_CONFIDENCE_MEDIUM = 0.55


# ---------------------------------------------------------------------------
# The word lists
# ---------------------------------------------------------------------------

# Strong income signals. These point one way and are rarely used for the
# other. "gaji" is a salary. "masuk" is money arriving.
_STRONG_INCOME = {
    "gaji": 3.0,
    "salary": 3.0,
    "gaji bulanan": 3.0,
    "payroll": 3.0,
    "bonus": 2.5,
    "thr": 2.5,
    "komisi": 2.0,
    "commission": 2.0,
    "dividen": 2.5,
    "dividend": 2.5,
    "bunga": 1.8,
    "interest": 1.5,
    "profit": 2.0,
    "laba": 2.0,
    "profit sharing": 2.5,
    "bagi hasil": 2.0,
    "bagi": 1.0,
    "pencairan": 1.5,
    "pencairan dana": 2.0,
    "refund": 2.0,
    "cashback": 1.8,
    "reimburse": 2.0,
    "reimbursement": 2.0,
    "income": 3.0,
    "pemasukan": 2.5,
    "pendapatan": 2.5,
    "penghasilan": 2.5,
    "revenue": 2.0,
    "uang masuk": 3.0,
    "terima gaji": 3.0,
    "terima bonus": 3.0,
    "jual": 1.2,
    "menjual": 1.5,
    "sold": 1.5,
    "profit": 2.0,
    "settlement": 1.5,
    "pembayaran masuk": 2.5,
    "dibayarkan ke saya": 3.0,
    "dibayar ke saya": 3.0,
    "diterima oleh saya": 3.0,
    "masuk ke rekening saya": 3.0,
}

# Weak income signals. These only count when nothing points the other way.
_WEAK_INCOME = {
    "terima": 1.0,
    "masuk": 1.2,
    "dapat": 0.8,
    "penerimaan": 1.5,
    "received": 1.2,
    "credit": 1.0,
    "incoming": 1.2,
    "deposit": 1.2,
    "top up saldo": 0.5,
    "tambah saldo": 1.0,
    "topup masuk": 1.0,
}

# Strong expense signals.
_STRONG_EXPENSE = {
    "beli": 2.5,
    "membeli": 2.5,
    "purchase": 2.0,
    "buy": 2.0,
    "bayar": 2.0,
    "membayar": 2.0,
    "dibayar": 1.8,
    "bayar bill": 2.5,
    "bayar tagihan": 2.5,
    "bayar)i": 1.0,
    "tagihan": 2.0,
    "iuran": 1.8,
    "sewa": 2.2,
    "kontrakan": 2.2,
    "spp": 2.0,
    "zakat": 2.2,
    "infak": 2.0,
    "donasi": 2.0,
    "sedekah": 1.8,
    "bayar kos": 2.5,
    "bayarafi": 1.0,
    "biaya": 1.8,
    "harga": 1.5,
    "ongkos": 1.8,
    "ongkir": 1.8,
    "parkir": 1.8,
    "tol": 1.8,
    "bensin": 2.0,
    "bahan bakar": 2.0,
    "pulsa": 2.0,
    "token": 1.8,
    "listrik": 2.0,
    "pln": 1.8,
    "wifi": 1.8,
    "internet": 1.8,
    "kategori": 0.0,
    "top up": 1.2,
    "topup": 1.2,
    "isi saldo": 1.2,
    "kirim": 1.2,
    "isi pulsa": 1.8,
    "kirim uang": 1.8,
    "withdraw": 1.8,
    "tarik tunai": 2.0,
    "tarik": 1.5,
    "tunai": 0.8,
    "cash out": 1.8,
    "bayar": 2.0,
    "expense": 2.0,
    "pengeluaran": 2.5,
    "keluar": 1.5,
    "kurang": 0.8,
}

# Weak expense signals.
_WEAK_EXPENSE = {
    "transaksi": 0.6,
    "debit": 1.0,
    "paid": 1.0,
    "spend": 1.2,
    "spending": 1.2,
    "bayar": 1.2,
    "biaya": 1.0,
    "order": 0.6,
    "belanja": 1.5,
    "makan": 0.8,
    "minum": 0.6,
    "kopi": 0.8,
    "gojek": 0.8,
    "grab": 0.8,
    "shopee": 0.8,
    "tokopedia": 0.8,
    "lazada": 0.8,
    "bukalapak": 0.8,
}

# Transfer signals. A transfer is not an expense: the money leaves one
# pocket and arrives in another, and counting it twice would make the
# totals wrong.
_TRANSFER_CUES = {
    "transfer": 2.0,
    "tf": 1.5,
    "mutasi": 1.0,
    "pindah": 1.5,
    "pindahkan": 1.5,
    "ke": 0.0,
    "kirim": 1.5,
    "kirim ke": 2.0,
    "transfer ke": 2.5,
    "transfer dari": 1.5,
    "top up": 1.2,
    "topup": 1.2,
}

# Words that must never be read as a merchant name.
_MERCHANT_STOPWORDS = {
    "untuk", "di", "ke", "dari", "dengan", "pada", "rupiah", "rp", "saya",
    "aku", "ingin", "mau", "harus", "tolong", "bisa", "sudah", "hari",
    "ini", "kemarin", "note", "catatan", "expense", "income",
    "pengeluaran", "pemasukan", "biaya", "harga", "dan", "atau", "yg",
    "tambah", "tambahkan", "catat", "catatkan", "buat", "bikin",
    "kategori", "tanggal", "makan", "makan siang", "makan malam",
    "siang", "malam", "sarapan", "sore", "pagi", "lunch", "dinner",
    "breakfast", "saya terima", "terima kasih",
}

# The words that carry the strongest weight are matched as whole words.
# A short word inside another word is not a signal, so "bayar" must not
# match "membayar互联网上" and "top" must not match "topeka".
_WORD_BOUNDARY = re.compile(r"[a-z0-9]+")


# Phrases that name the destination, and what that destination means.
# "dibayarkan ke saya" is money arriving. "dibayarkan ke bca" is money
# leaving for an account. The phrase on its own is not enough; it is
# the destination that decides.
_DESTINATION_RULES = [
    # (phrase, direction, weight)
    ("dibayarkan ke saya", INCOME, 3.0),
    ("dibayar ke saya", INCOME, 3.0),
    ("diterima oleh saya", INCOME, 3.0),
    ("masuk ke rekening saya", INCOME, 3.0),
    ("dibayarkan ke", TRANSFER, 1.5),
    ("dibayar ke", TRANSFER, 1.2),
]



def _normalise(text: str) -> str:
    """Lowercase and collapse the punctuation that carries no meaning."""
    if not text:
        return ""
    lowered = text.lower().strip()
    # Keep the letters and digits, turn everything else into a space.
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def _tokens(text: str) -> List[str]:
    return _WORD_BOUNDARY.findall(_normalise(text))


def normalise_for_learning(text: str) -> str:
    """
    The form a phrase is filed under in the learning notes.

    The same normalisation the classifier uses when it compares two
    phrases, so a note can be looked up by an exact match.
    """
    return _normalise(text)[:255]


def _ngrams(tokens: List[str], size: int) -> List[str]:
    if len(tokens) < size:
        return []
    return [" ".join(tokens[i:i + size]) for i in range(len(tokens) - size + 1)]


# ---------------------------------------------------------------------------
# The result
# ---------------------------------------------------------------------------


@dataclass
class DirectionResult:
    """
    What the classifier decided, and why.

    `direction` is one of income, expense or transfer. `confidence` runs
    from 0 to 1. `source` says which layer decided it, and `reasons`
    lists the signals that were found, so the answer can be shown to the
    user instead of appearing from nowhere.
    """

    direction: str = EXPENSE
    confidence: float = 0.0
    band: str = LOW
    source: str = "default"
    reasons: List[str] = field(default_factory=list)
    scores: Dict[str, float] = field(default_factory=dict)

    @property
    def is_income(self) -> bool:
        return self.direction == INCOME

    @property
    def is_expense(self) -> bool:
        return self.direction == EXPENSE

    @property
    def is_transfer(self) -> bool:
        return self.direction == TRANSFER

    def to_dict(self) -> Dict[str, Any]:
        return {
            "direction": self.direction,
            "confidence": round(self.confidence, 3),
            "band": self.band,
            "source": self.source,
            "reasons": self.reasons,
            "scores": {k: round(v, 3) for k, v in self.scores.items()},
        }


# ---------------------------------------------------------------------------
# Layer 1: what the user has already taught us
# ---------------------------------------------------------------------------


class DirectionMemory:
    """
    The user's own history, used to answer a repeat question.

    Each remembered entry is a wording, and the direction it was given.
    Entries the user confirmed are weighted higher than entries that were
    merely inferred, and a wording seen many times is weighted higher
    than one seen once.
    """

    def __init__(self, db: Optional[Session], user_id: Optional[int]):
        self.db = db
        self.user_id = user_id

    def _rows(self) -> List[Tuple[str, str, int]]:
        """
        The wordings the user has already used, with their direction.

        The transaction table holds the description the user typed. The
        merchant name is the other half of the clue, because the same
        shop can appear in either field.
        """
        if self.db is None or self.user_id is None:
            return []

        from app.models.transaction import Transaction

        try:
            rows = (
                self.db.query(
                    Transaction.description,
                    Transaction.type,
                    func.count(Transaction.id),
                )
                .filter(
                    Transaction.user_id == self.user_id,
                    Transaction.is_deleted.is_(False),
                )
                .group_by(Transaction.description, Transaction.type)
                .all()
            )
        except Exception as exc:  # pragma: no cover - database problems
            logger.warning("Could not read the transaction history: %s", exc)
            return []

        return [(r[0] or "", r[1] or "", r[2] or 1) for r in rows]

    def _notes(self) -> List[Tuple[str, str, int]]:
        """
        The corrections the user made before saving a transaction.

        These carry more weight than the saved transactions, because the
        user said so out loud.
        """
        if self.db is None or self.user_id is None:
            return []

        try:
            from app.models.learning_note import LearningNote

            rows = (
                self.db.query(LearningNote.token, LearningNote.payload, LearningNote.times)
                .filter(
                    LearningNote.user_id == self.user_id,
                    LearningNote.kind == "direction",
                )
                .all()
            )
        except Exception as exc:  # pragma: no cover - database problems
            logger.warning("Could not read the learning notes: %s", exc)
            return []

        import json

        out = []
        for token, payload, times in rows:
            try:
                parsed = json.loads(payload) if payload else {}
            except (ValueError, TypeError):
                parsed = {}
            direction = parsed.get("direction")
            if direction:
                out.append((token, direction, times or 1))
        return out

    def lookup(self, text: str, merchant: Optional[str] = None) -> Optional[DirectionResult]:
        """
        Find a wording in the history that matches what we were given.

        A correction the user made is the strongest signal there is.
        A saved transaction with the same wording is next. A match on
        the merchant name is next. A match on a phrase inside the
        description is the weakest, because a shared word is only a
        hint.
        """
        # The corrections the user made.
        needle_normalised = _normalise(text)
        for token, direction, times in self._notes():
            if not token:
                continue
            if token == needle_normalised:
                confidence = min(0.97, 0.94 + 0.01 * (times - 1))
                return DirectionResult(
                    direction=direction,
                    confidence=confidence,
                    band=_band_for(confidence),
                    source="correction",
                    reasons=["koreksi yang pernah kamu buat"],
                )
            if len(token) >= 6 and token in needle_normalised:
                confidence = 0.82
                return DirectionResult(
                    direction=direction,
                    confidence=confidence,
                    band=_band_for(confidence),
                    source="correction",
                    reasons=["koreksi yang pernah kamu buat"],
                )
            # The note may carry more than the phrase does, because the
            # note was written from the quick entry box and the phrase
            # comes from somewhere that left the amount out.
            if len(needle_normalised) >= 6 and needle_normalised in token:
                confidence = 0.80
                return DirectionResult(
                    direction=direction,
                    confidence=confidence,
                    band=_band_for(confidence),
                    source="correction",
                    reasons=["koreksi yang pernah kamu buat"],
                )

        rows = self._rows()
        if not rows:
            return None

        needle = _normalise(text)
        needle_tokens = set(_tokens(text))
        merchant_normalised = _normalise(merchant or "")

        best: Optional[Tuple[float, str, str]] = None  # score, direction, reason

        for description, tx_type, count in rows:
            direction = _direction_from_type(tx_type)
            if direction is None:
                continue

            described = _normalise(description)
            if not described:
                continue

            weight = min(2.5, 1.0 + 0.25 * (count - 1))

            if described and described == needle:
                score = 0.92 * weight
                if score > (best[0] if best else 0):
                    best = (score, direction, f"seperti transaksi sebelumnya: {description}")
                continue

            if merchant_normalised and described == merchant_normalised:
                score = 0.80 * weight
                if score > (best[0] if best else 0):
                    best = (score, direction, f"merchant yang sama sebelumnya: {description}")
                continue

            # A phrase of the wording appears inside what we were given.
            if len(described) >= 4 and described in needle:
                score = 0.70 * weight
                if score > (best[0] if best else 0):
                    best = (score, direction, f"mengulang keterangan sebelumnya: {description}")
                continue

            # The description is inside what we were given.
            if len(needle) >= 4 and needle in described:
                score = 0.66 * weight
                if score > (best[0] if best else 0):
                    best = (score, direction, f"mirip transaksi sebelumnya: {description}")
                continue

            # A meaningful word in common. "gaji" and "kopi" are enough
            # on their own; "di" and "ke" are not.
            described_tokens = set(_tokens(description))
            shared = (described_tokens & needle_tokens) - _MERCHANT_STOPWORDS
            if shared and len(shared) >= 1:
                longest = max(shared, key=len)
                if len(longest) >= 4:
                    score = 0.45 * weight
                    if score > (best[0] if best else 0):
                        best = (score, direction, f"kata yang sama: {longest}")

        if best is None:
            return None

        score, direction, reason = best
        score = min(score, 0.97)
        return DirectionResult(
            direction=direction,
            confidence=score,
            band=_band_for(score),
            source="history",
            reasons=[reason],
            scores={direction: score},
        )


def _direction_from_type(tx_type: str) -> Optional[str]:
    """Map the stored transaction type onto a direction."""
    if not tx_type:
        return None
    lowered = tx_type.lower()
    if lowered == INCOME:
        return INCOME
    if lowered == EXPENSE:
        return EXPENSE
    if lowered in ("transfer", "transfer_in", "transfer_out"):
        return TRANSFER
    return None


# ---------------------------------------------------------------------------
# Layer 2: scoring the wording
# ---------------------------------------------------------------------------


def _score_text(text: str) -> DirectionResult:
    """
    Weigh the wording and decide.

    The strong lists are counted at full weight and the weak ones at
    half, so a phrase carrying one strong expense signal and one weak
    income signal lands on the side of the strong one. When the two
    sides are within reach of each other the result is marked low
    confidence, which is the signal to ask the model or the user.
    """
    normalised = _normalise(text)
    if not normalised:
        return DirectionResult(
            direction=EXPENSE, confidence=0.0, band=LOW, source="default",
            reasons=["tidak ada teks untuk dinilai"],
        )

    tokens = _tokens(normalised)
    token_set = set(tokens)
    grams = set(_ngrams(tokens, 2)) | set(_ngrams(tokens, 3))

    income_score = 0.0
    expense_score = 0.0
    transfer_score = 0.0
    reasons: List[str] = []

    def apply(table: Dict[str, float], factor: float, target: str, found: List[str]) -> float:
        total = 0.0
        for word, weight in table.items():
            if " " in word:
                if word in grams:
                    total += weight * factor
                    found.append(word)
            elif word in token_set:
                total += weight * factor
                found.append(word)
        return total

    income_hits: List[str] = []
    expense_hits: List[str] = []
    transfer_hits: List[str] = []

    # A phrase that carries several words is stronger than one word.
    # So "gaji" counts as one strong signal, and "gaji bulanan" counts as
    # one strong signal plus the extra weight of being a phrase.
    income_score = apply(_STRONG_INCOME, 1.0, INCOME, income_hits)
    income_score += apply(_WEAK_INCOME, 0.5, INCOME, income_hits)

    expense_score = apply(_STRONG_EXPENSE, 1.0, EXPENSE, expense_hits)
    expense_score += apply(_WEAK_EXPENSE, 0.5, EXPENSE, expense_hits)

    transfer_score = apply(_TRANSFER_CUES, 1.0, TRANSFER, transfer_hits)

    # The destination rules settle the phrases where the wording alone
    # is ambiguous. The most specific rule that matches wins, so
    # "dibayarkan ke saya" is not overruled by the general
    # "dibayarkan ke".
    for phrase, direction, weight in _DESTINATION_RULES:
        if phrase not in grams and phrase not in normalised:
            continue
        if direction == INCOME:
            income_score += weight
            income_hits.append(phrase)
        elif direction == TRANSFER:
            transfer_score += weight
            transfer_hits.append(phrase)
        else:
            expense_score += weight
            expense_hits.append(phrase)

    if income_hits:
        reasons.append("kata pemasukan: " + ", ".join(sorted(set(income_hits))[:4]))
    if expense_hits:
        reasons.append("kata pengeluaran: " + ", ".join(sorted(set(expense_hits))[:4]))
    if transfer_hits:
        reasons.append("kata transfer: " + ", ".join(sorted(set(transfer_hits))[:4]))

    scores = {INCOME: income_score, EXPENSE: expense_score, TRANSFER: transfer_score}

    # A transfer cue only wins when nothing else is in play. "transfer
    # ke" is a transfer, but "transfer masuk dari gopay" is an income.
    if transfer_score > 0 and income_score <= 0.5 and expense_score <= 0.5:
        confidence = min(0.9, 0.5 + transfer_score * 0.2)
        return DirectionResult(
            direction=TRANSFER,
            confidence=confidence,
            band=_band_for(confidence),
            source="wording",
            reasons=reasons,
            scores=scores,
        )

    total = income_score + expense_score
    if total <= 0:
        return DirectionResult(
            direction=EXPENSE, confidence=0.0, band=LOW, source="default",
            reasons=["tidak ada kata penanda"], scores=scores,
        )

    if income_score == expense_score:
        # Nothing separates the two sides.
        return DirectionResult(
            direction=EXPENSE,
            confidence=0.30,
            band=LOW,
            source="ambiguous",
            reasons=reasons + ["tidak ada pembeda arah"],
            scores=scores,
        )

    direction = INCOME if income_score > expense_score else EXPENSE
    winner = max(income_score, expense_score)
    loser = min(income_score, expense_score)

    # The margin matters more than the total. A single strong signal
    # against nothing is a clear answer. Two opposing signals of equal
    # strength is not.
    margin = (winner - loser) / winner
    magnitude = min(1.0, winner / 3.0)
    confidence = 0.45 + 0.35 * margin + 0.15 * magnitude
    confidence = min(confidence, 0.95)

    return DirectionResult(
        direction=direction,
        confidence=confidence,
        band=_band_for(confidence),
        source="wording",
        reasons=reasons,
        scores=scores,
    )


def _band_for(confidence: float) -> str:
    if confidence >= _CONFIDENCE_HIGH:
        return HIGH
    if confidence >= _CONFIDENCE_MEDIUM:
        return MEDIUM
    return LOW


# ---------------------------------------------------------------------------
# Layer 3: asking the model
# ---------------------------------------------------------------------------

_MODEL_PROMPT = """Classify the direction of an Indonesian personal finance transaction.

- "income" means money arrives: salary, bonus, refund, cashback, dividend, selling something, a payment received.
- "expense" means money leaves: buying, paying a bill, food, transport, fees, donations, a payment made.
- "transfer" means money moves between the person's own accounts.

Text:
{text}

Reply with one JSON object and nothing else:
{{"direction": "income|expense|transfer", "confidence": 0.0-1.0, "reason": "short reason in Indonesian"}}
"""


def _extract_json(raw: str) -> Optional[Dict[str, Any]]:
    """
    Pull the JSON object out of whatever the model answered.

    The model usually answers with the object on its own, but it also
    wraps it in a code fence or in a sentence like "here is the JSON
    requested". Rather than lose the answer in those cases, the first
    balanced object in the text is taken.
    """
    import json

    text = (raw or "").strip()
    if not text:
        return None

    # The plain case.
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except (ValueError, TypeError):
        pass

    # A code fence around the object.
    if "```" in text:
        import re as _re

        for block in _re.findall(r"```(?:[a-zA-Z]+)?\n?(.*?)```", text, _re.S):
            try:
                parsed = json.loads(block.strip())
                if isinstance(parsed, dict):
                    return parsed
            except (ValueError, TypeError):
                continue

    # The first balanced object anywhere in the text.
    start = text.find("{")
    while start != -1:
        depth = 0
        in_string = False
        escaped = False
        for index in range(start, len(text)):
            char = text[index]
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
                continue
            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start:index + 1]
                    try:
                        parsed = json.loads(candidate)
                        if isinstance(parsed, dict):
                            return parsed
                    except (ValueError, TypeError):
                        break
        start = text.find("{", start + 1)

    return None


# The provider is rate limited fairly often on the free tier, and every
# call that fails is a wait the user sits through. Two things keep that
# from being felt: a short cache of the answers that did come, and a
# breaker that stops calling for a while after a failure.
_MODEL_CACHE: Dict[str, DirectionResult] = {}
_MODEL_CACHE_MAX = 200

# The breaker opens for this many seconds after a failure. It is short
# enough that a provider that recovers is used again quickly, and long
# enough that a burst of traffic does not hammer it.
_BREAKER_SECONDS = 60.0
_breaker_open_until = 0.0


def _model_is_available() -> bool:
    """Whether the provider is worth calling right now."""
    global _breaker_open_until
    return time.monotonic() >= _breaker_open_until


def _open_breaker() -> None:
    global _breaker_open_until
    _breaker_open_until = time.monotonic() + _BREAKER_SECONDS


def _ask_model(text: str) -> Optional[DirectionResult]:
    """
    Ask Gemini to classify the text.

    The model is optional. When the provider is unavailable, slow or
    rate limited, this returns None and the caller falls back to the
    wording score. Nothing in the app waits on it: the answer is either
    here within a couple of seconds or it is not used at all.
    """
    cache_key = _normalise(text)
    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    if not _model_is_available():
        return None

    try:
        from app.services.gemini_vision import call_gemini_text
    except Exception as exc:  # pragma: no cover - import problems
        logger.warning("Could not load the Gemini client: %s", exc)
        return None

    try:
        raw = call_gemini_text(
            _MODEL_PROMPT.format(text=text),
            timeout=12,
            temperature=0.0,
            max_output_tokens=256,
            json_response=True,
        )
    except Exception as exc:  # pragma: no cover - provider problems
        logger.warning("The model could not be reached: %s", exc)
        _open_breaker()
        return None

    if not raw:
        _open_breaker()
        return None

    payload = _extract_json(raw)
    if payload is None:
        logger.info("The model answer held no JSON: %s", raw[:200])
        return None

    if not isinstance(payload, dict):
        return None

    direction = str(payload.get("direction", "")).lower().strip()
    if direction not in (INCOME, EXPENSE, TRANSFER):
        return None

    try:
        confidence = float(payload.get("confidence", 0.7))
    except (TypeError, ValueError):
        confidence = 0.7
    confidence = max(0.0, min(1.0, confidence))

    reason = str(payload.get("reason", "")).strip()
    result = DirectionResult(
        direction=direction,
        confidence=confidence,
        band=_band_for(confidence),
        source="model",
        reasons=[reason] if reason else ["jawaban dari model"],
    )

    # Keep the answer, so the same phrase is not sent to the provider
    # twice.
    if len(_MODEL_CACHE) >= _MODEL_CACHE_MAX:
        _MODEL_CACHE.clear()
    _MODEL_CACHE[cache_key] = result
    return result


# ---------------------------------------------------------------------------
# The public entry point
# ---------------------------------------------------------------------------


def classify_direction(
    text: str,
    db: Optional[Session] = None,
    user_id: Optional[int] = None,
    merchant: Optional[str] = None,
    allow_model: bool = True,
) -> DirectionResult:
    """
    Work out whether a transaction is income or expense.

    The layers are consulted in order of how much they can be trusted.
    What the user has taught us comes first, because it is their own
    data. The wording score comes next. The model is asked only when
    the first two layers left the answer open, and only when the caller
    allows it.
    """
    combined = " ".join(part for part in (text, merchant) if part)

    # 1. The user's own history.
    memory = DirectionMemory(db, user_id)
    remembered = memory.lookup(text, merchant)
    if remembered is not None and remembered.band in (HIGH, MEDIUM):
        return remembered

    # 2. The wording.
    scored = _score_text(combined)
    if scored.band == HIGH:
        return scored

    # 3. The model, for the cases the wording could not separate.
    if allow_model and scored.band == LOW:
        answered = _ask_model(combined)
        if answered is not None:
            return answered

    return scored


def classify_type(
    text: str,
    db: Optional[Session] = None,
    user_id: Optional[int] = None,
    merchant: Optional[str] = None,
    allow_model: bool = True,
) -> str:
    """
    The direction as a plain string, for the callers that just need it.
    """
    return classify_direction(
        text, db=db, user_id=user_id, merchant=merchant, allow_model=allow_model
    ).direction


def learn_direction(
    db: Session,
    user_id: int,
    text: str,
    direction: str,
    merchant: Optional[str] = None,
) -> None:
    """
    Remember a confirmed direction, so the same wording is answered the
    same way next time.

    The history is read straight from the transaction table, so there is
    nothing to write here: the transaction itself is the memory. This
    function exists so that a caller can add a note about a wording that
    has no transaction yet, which is what happens when a user corrects
    a classification before saving.
    """
    # Kept for symmetry with the reader above. The transaction table is
    # the store of record, so there is nothing to write.
    return None
