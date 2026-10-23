"""
AI financial agent.

The difference between a chatbot and an agent is that the agent can act.
When the user says "tambah 15000 kopi", the agent adds a transaction. When
the user says "bagi saldo jadi 50% belanja, 30% tabungan, 20% darurat", the
agent creates the budgets.

This module turns a free-form message into a plan of concrete actions,
executes them, and reports back what changed. The plan is returned to the
client as well, so the UI can show the user exactly what is about to
happen - and ask for confirmation before anything is written.

The intent detection is deterministic and rule based. That is deliberate:
an action that moves money must not be decided by a model that might
hallucinate a number. The language model is used to *understand* the
wording, never to decide the amount.
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Intent vocabulary
# ---------------------------------------------------------------------------

# Each intent lists the words that signal it. The words are matched as
# whole tokens, not as substrings, so "beli" does not match "belikan".
INTENT_PATTERNS: Dict[str, Tuple[str, ...]] = {
    "add_transaction": (
        "tambah", "tambahkan", "catat", "catatkan", "masukkan", "masuk",
        "add", "record", "masuk", "buy", "beli", "bayar", "pembelian",
    ),
    "delete_transaction": (
        "hapus", "hapuskan", "delete", "remove", "batalkan", "buang",
    ),
    "set_budget": (
        "budget", "anggaran", "set budget", "atur budget", "batas",
        "limit", "batas pengeluaran", "buat budget",
    ),
    "allocate": (
        "bagi", "bagi saldo", "alokasi", "alokasikan", "pecah", "split",
        "allocate", "distribusi", "salin", "porsi", "persentase", "persen",
    ),
    "set_savings_goal": (
        "target", "tujuan", "goal", "saving goal", "tabungan",
        "k 집", "niat",
    ),
    "build_plan": (
        "plan", "rencana", "pola", "sistem", "struktur", "primer",
        "sekunder", "tersier", "kebutuhan", "prioritas", "stratifikasi",
    ),
    "set_recurring": (
        "rutin", "berulang", "recurring", "langsung", "otomatis", "setoran",
    ),
    "query": (
        "berapa", "how much", "jumlah", "total", "cek", "check", "lihat",
        "show", "tampilkan", "kapan", "kategori", " pengeluaran", "pemasukan",
    ),
    "analyze": (
        "analisis", "analyze", "kenapa", "why", "pola", "pattern", "tren",
        "trend", "evaluasi", "evaluat", "bandingkan", "compare",
    ),
    "suggest": (
        "saran", "suggest", "rekomendasi", "recommend", "ide", "kasih",
        "bantu", "help", "bantuan", "tips",
    ),
}

# Intents that write to the database.
MUTATING_INTENTS = {
    "add_transaction",
    "delete_transaction",
    "set_budget",
    "allocate",
    "set_savings_goal",
    "set_recurring",
    "build_plan",
}

# Words that mean the user is asking about budget information, not asking
# to change a budget. This is the distinction the user complained about:
# "budget" alone must show information, "set budget" must change it.
INFORMATION_ONLY_CUES = (
    "berapa", "total", "cek", "lihat", "tampilkan", "show", "jumlah",
    "sisa", "sudah", "terpakai",
)

ACTION_CUES = (
    "set", "atur", "bikin", "buat", "buatkan", "tambah", "tambahkan",
    "ubah", "ganti", "jadi", "alokasi", "bagi", "pecah", "hapus",
)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class AgentAction:
    """One concrete thing the agent wants to do."""

    kind: str
    params: Dict[str, Any] = field(default_factory=dict)
    description: str = ""
    # The user has to confirm this one before it runs.
    requires_confirmation: bool = True
    # Filled in after the action ran.
    result: Optional[Dict[str, Any]] = None
    success: bool = False
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "kind": self.kind,
            "params": self.params,
            "description": self.description,
            "requires_confirmation": self.requires_confirmation,
            "result": self.result,
            "success": self.success,
            "error": self.error,
        }


@dataclass
class AgentPlan:
    """What the agent understood and what it will do."""

    intent: str
    confidence: float = 0.0
    actions: List[AgentAction] = field(default_factory=list)
    reply: str = ""
    # Set when the agent needs the user to confirm before writing.
    needs_confirmation: bool = False
    # Set when the message held more than one request.
    is_multi: bool = False
    # The parts of the message that asked for advice rather than for an
    # action. They are answered, not carried out.
    suggestions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent": self.intent,
            "confidence": round(self.confidence, 2),
            "actions": [a.to_dict() for a in self.actions],
            "reply": self.reply,
            "needs_confirmation": self.needs_confirmation,
            "is_multi": self.is_multi,
            "suggestions": self.suggestions,
            "is_mutating": any(
                a.kind in MUTATING_INTENTS for a in self.actions
            ) or self.intent in MUTATING_INTENTS,
        }


# ---------------------------------------------------------------------------
# Intent detection
# ---------------------------------------------------------------------------

def _tokenize(message: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", (message or "").lower())


def detect_intent(message: str) -> Tuple[str, float]:
    """
    Work out what the user wants.

    The rules are ordered from the most specific to the least specific,
    because several of them share vocabulary: "bagi saldo 50% untuk
    belanja" is an allocation, not a transaction, even though it mentions
    an amount.
    """
    text = (message or "").lower().strip()
    tokens = set(_tokenize(text))

    if not tokens:
        return "unknown", 0.0

    # --- Explicit allocation -------------------------------------------
    if "bagi" in tokens or "alokasi" in tokens or "alokasikan" in tokens:
        # "bagi" with a percentage is an allocation. "bagi dua filesystem"
        # is not, but the user is not going to say that to a finance app.
        if re.search(r"\d+\s*%|\d+\s*persen|persen\s*\d+", text):
            return "allocate", 0.92
        if "saldo" in tokens or "uang" in tokens or "penghasilan" in tokens or "gaji" in tokens:
            return "allocate", 0.85

    # --- Explicit budget change ----------------------------------------
    has_budget_word = "budget" in tokens or "anggaran" in tokens
    if has_budget_word:
        wants_action = any(cue in tokens for cue in ACTION_CUES)
        wants_info = any(cue in text for cue in INFORMATION_ONLY_CUES)
        if wants_action and not (wants_info and not wants_action):
            return "set_budget", 0.88
        if wants_info:
            return "query", 0.8
        # "budget" on its own: the user is probably asking about it.
        return "query", 0.6

    # --- A whole plan --------------------------------------------------
    # "bikin plan 1 tahun gaji 6 juta, primer sekunder tersier" asks for
    # a budget plan, not for one goal. It has to be checked before the
    # goal rule, because a plan message usually names targets too.
    if any(cue in tokens for cue in PLAN_CUES) and (
        "tahun" in tokens or "bulan" in tokens or "gaji" in tokens
        or "salary" in tokens or "income" in tokens
        or "penghasilan" in tokens or "pendapatan" in tokens
    ):
        return "build_plan", 0.9

    # --- Explicit goal -------------------------------------------------
    # "target tabungan 2000000 6 bulan" has no action verb, but the word
    # "target" plus an amount is unambiguous enough.
    if ("target" in tokens or "goal" in tokens or "tujuan" in tokens) and re.search(
        r"\d", text
    ):
        return "set_savings_goal", 0.85

    # --- Delete --------------------------------------------------------
    if "hapus" in tokens or "delete" in tokens or "remove" in tokens:
        return "delete_transaction", 0.85

    # --- Recurring -----------------------------------------------------
    # This has to come BEFORE the add rule: "rutin bayar kos 1500000 tiap
    # bulan" contains "bayar" AND an amount, so the add rule would claim
    # it and record a single transaction instead of a standing rule.
    if any(w in tokens for w in ("rutin", "berulang", "recurring")) and re.search(
        r"\d", text
    ):
        return "set_recurring", 0.85

    # --- Add a transaction ---------------------------------------------
    # The signal is an amount plus a transaction verb, or an amount on its
    # own in a sentence that is clearly about a purchase.
    if any(verb in tokens for verb in ("tambah", "tambahkan", "catat", "catatkan", "add", "record")):
        return "add_transaction", 0.9
    if ("beli" in tokens or "bayar" in tokens or "buy" in tokens) and re.search(
        r"\d", text
    ):
        return "add_transaction", 0.88
    if "pembelian" in tokens and re.search(r"\d", text):
        return "add_transaction", 0.8

    # --- Analysis ------------------------------------------------------
    if any(w in tokens for w in ("analisis", "analyze", "kenapa", "why", "pola", "pattern", "tren", "trend", "evaluasi")):
        return "analyze", 0.88

    # --- Query ---------------------------------------------------------
    if any(cue in text for cue in INFORMATION_ONLY_CUES):
        return "query", 0.8

    # "transaksi terakhir", "riwayat pengeluaran" - a read about a noun,
    # with no verb and no amount. The noun is what makes it a read.
    if any(w in tokens for w in ("transaksi", "riwayat", "history")) and any(
        w in tokens for w in ("terakhir", "terbaru", "baru", "recent", "latest")
    ):
        return "query", 0.8
    if "riwayat" in tokens:
        return "query", 0.75

    # --- Suggestion ----------------------------------------------------
    if any(w in tokens for w in ("saran", "suggest", "rekomendasi", "recommend", "tips", "bantuan", "help")):
        return "suggest", 0.75

    return "unknown", 0.3


# ---------------------------------------------------------------------------
# Amount and text extraction
# ---------------------------------------------------------------------------

# The words that ask for a whole plan rather than a single goal. The
# plan builder imports this list, so it lives here and not there.
PLAN_CUES = (
    "plan", "rencana", "pola", "sistem", "struktur", "primer",
    "sekunder", "tersier", "kebutuhan", "prioritas", "stratifikasi",
)

_MONTH_NAMES = {
    "januari": 1, "january": 1,
    "februari": 2, "february": 2,
    "maret": 3, "march": 3,
    "april": 4,
    "mei": 5, "may": 5,
    "juni": 6, "june": 6,
    "juli": 7, "july": 7,
    "agustus": 8, "august": 8,
    "september": 9,
    "oktober": 10, "october": 10,
    "november": 11,
    "desember": 12, "december": 12,
}

_NUMBER_RE = re.compile(r"\d[\d.,]*")
_SCALE_RE = re.compile(r"\b(ribu|rb|juta|jt|miliar|milyar)\b", re.IGNORECASE)

_CATEGORY_WORDS = {
    "makan": "Makanan & Minuman", "makanan": "Makanan & Minuman",
    "kopi": "Makanan & Minuman", "minuman": "Makanan & Minuman",
    "warung": "Makanan & Minuman", "restoran": "Makanan & Minuman",
    "cafe": "Makanan & Minuman", "belanja": "Belanja",
    "supermarket": "Belanja", "baju": "Pakaian", "sepatu": "Pakaian",
    "bensin": "Transportasi", "parkir": "Transportasi", "tol": "Transportasi",
    "taksi": "Transportasi", "grab": "Transportasi", "gojek": "Transportasi",
    "listrik": "Tagihan & Utilitas", "pulsa": "Tagihan & Utilitas",
    "internet": "Tagihan & Utilitas", "wifi": "Tagihan & Utilitas",
    "obat": "Kesehatan", "dokter": "Kesehatan", "apotek": "Kesehatan",
    "buku": "Pendidikan", "spp": "Pendidikan", "kampus": "Pendidikan",
    "hotel": "Travel", "tiket": "Travel", "pesawat": "Travel",
    "hiburan": "Hiburan", "bioskop": "Hiburan", "salon": "Kecantikan",
}


def extract_amount(message: str) -> Tuple[Optional[float], str]:
    """
    Pull the amount out of a message.

    Returns (amount, the_span it was taken from). The span is removed
    before the description is derived, so the number never leaks into the
    merchant name.
    """
    text = message or ""

    # A date written out in words is not an amount. "target 23 Oktober
    # 2027" was read as an amount of 23, so the date is taken out first.
    working = re.sub(
        r"\b\d{1,2}\s+"
        r"(januari|februari|maret|april|mei|juni|juli|agustus|september|"
        r"oktober|november|desember|january|february|march|april|may|june|"
        r"july|august|september|october|november|december)"
        r"\s+\d{4}\b",
        " ",
        text,
        flags=re.IGNORECASE,
    )

    # A "Rp 15.000" or "15000" style number.
    for match in _NUMBER_RE.finditer(working):
        raw = match.group(0)
        cleaned = raw.replace(".", "").replace(",", ".")
        try:
            value = float(cleaned)
        except ValueError:
            continue
        if value <= 0:
            continue

        # A scale word right after the number multiplies it.
        tail = working[match.end():match.end() + 12].lower()
        scale_match = _SCALE_RE.search(tail)
        if scale_match:
            scale = scale_match.group(1).lower()
            value *= 1_000 if scale in ("ribu", "rb") else (
                1_000_000 if scale in ("juta", "jt") else 1_000_000_000
            )
            end = match.end() + scale_match.end()
        else:
            end = match.end()

        return value, working[: match.start()] + " " + working[end:]

    return None, text


def extract_percentages(message: str) -> List[Tuple[str, float]]:
    """
    Extract "50% untuk belanja" style pairs.

    Returns [(purpose, percent), ...]. The purpose is the text between the
    percentage and the next percentage.
    """
    text = (message or "").lower()
    results: List[Tuple[str, float]] = []

    pattern = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:%|persen)\s*([a-z\s]*)")
    matches = list(pattern.finditer(text))
    for index, match in enumerate(matches):
        try:
            percent = float(match.group(1).replace(",", "."))
        except ValueError:
            continue
        if percent <= 0 or percent > 100:
            continue

        # The purpose is the words between this percentage and the NEXT
        # percentage. It has to be measured against the start of the next
        # match, not its end - the end of the next match already includes
        # the next purpose, so slicing to it yields an empty string.
        if index + 1 < len(matches):
            purpose = match.group(2)[: matches[index + 1].start() - match.start()].strip()
        else:
            purpose = match.group(2).strip()
        purpose = re.sub(r"\b(untuk|buat|di|ke|dan|buatnya|allocation)\b", " ", purpose)
        purpose = re.sub(r"\s+", " ", purpose).strip(" ,-")
        if purpose:
            results.append((purpose, percent))

    return results


def extract_description(message: str, amount_span: str) -> str:
    """
    Derive a short description from the message.

    The number is removed first, and the leading verb and filler words are
    stripped, so "tambah 15000 kopi" becomes "kopi".
    """
    text = re.sub(r"\s+", " ", (amount_span or message)).strip()

    # Remove the transaction verb and the words around it.
    text = re.sub(
        r"^\s*(tambah|tambahkan|catat|c speedy|add|record|beli|bayar|"
        r"pengeluaran|pengeluaran|expense|makan|untuk)\s+",
        "",
        text,
        flags=re.IGNORECASE,
    )
    # A delete instruction carries its own verb and the word "transaksi".
    text = re.sub(
        r"^\s*(hapus|hilangkan|remove|delete)\s+",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"^\s*transaksi\s+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\btransaksi\b\s*", " ", text, flags=re.IGNORECASE)
    text = re.sub(
        r"\b(seharga|harga|sejumlah|senilai|sebesar)\b\s*", " ", text, flags=re.IGNORECASE
    )
    text = re.sub(r"\b(rp|rupiah)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s{2,}", " ", text).strip(" ,.-")

    if not text:
        return ""
    # Keep it short enough for a transaction description.
    return text[:120]


def guess_category(text: str) -> Optional[str]:
    """Map the words in the description to one of the user's categories."""
    lowered = (text or "").lower()
    for word, category in _CATEGORY_WORDS.items():
        if word in lowered:
            return category
    return None


def extract_date(message: str) -> date:
    """Work out which day the transaction belongs to."""
    text = (message or "").lower()
    today = date.today()

    if "besok" in text:
        return today + timedelta(days=1)
    if "kemarin" in text:
        return today - timedelta(days=1)
    if "lusa" in text:
        return today - timedelta(days=2)

    # An explicit date: 15/03/2026 or 2026-03-15
    match = re.search(r"\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})\b", text)
    if match:
        day, month, year = (int(g) for g in match.groups())
        if year < 100:
            year += 2000
        try:
            return date(year, month, day)
        except ValueError:
            pass

    match = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", text)
    if match:
        year, month, day = (int(g) for g in match.groups())
        try:
            return date(year, month, day)
        except ValueError:
            pass

    # A date written out in words: "23 Oktober 2027" or "23 October 2027".
    match = re.search(
        r"\b(\d{1,2})\s+"
        r"(januari|februari|maret|april|mei|juni|juli|agustus|september|"
        r"oktober|november|desember|january|february|march|april|may|june|"
        r"july|august|september|october|november|december)"
        r"\s+(\d{4})\b",
        text,
    )
    if match:
        day = int(match.group(1))
        month = _MONTH_NAMES.get(match.group(2))
        year = int(match.group(3))
        if month:
            try:
                return date(year, month, day)
            except ValueError:
                pass

    return today
