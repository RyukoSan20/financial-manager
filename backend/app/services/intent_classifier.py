"""
Classifying what the user is asking for.

The agent used to look for the first rule that matched and stop there.
That breaks in two ways:

* A message with several subjects in it - "berapa saldo saya, tambah
  50000 kopi, dan budget makan 500000 sebulan" - has three different
  requests in it. The old chain picked one and dropped the rest.
* A number was treated as a reason to act. "berapa yang perlu saya
  tambahkan?" contains a number and is a question, not an instruction.

So the work is done in three steps here:

1. The message is split into clauses. Each clause is one request.
2. Every clause is scored for the signals that mark a request as an
   instruction, a question or a suggestion.
3. The scores decide the class, and the class decides the intent.

The rules are deliberately deterministic. Money moves because of what
the user wrote, and a language model must never be the one that decides
how much money moves. The model is used afterwards to phrase the answer,
not to pick the action.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.services.duration import has_duration, strip_durations

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# The classes
# ---------------------------------------------------------------------------

INSTRUCTION = "instruction"
QUESTION = "question"
SUGGESTION = "suggestion"
STATEMENT = "statement"

CLASSES = (INSTRUCTION, QUESTION, SUGGESTION, STATEMENT)


# ---------------------------------------------------------------------------
# Signal vocabulary
# ---------------------------------------------------------------------------

# Words that mean the user wants something done. These are the verbs a
# person uses when they are giving an order, not when they are asking.
ACT_VERBS = {
    "tambah": 1.0, "tambahkan": 1.0, "catat": 1.0, "catatkan": 1.0,
    "masukkan": 1.0, "masuk": 0.6, "buatkan": 1.0, "buat": 1.0,
    "bikin": 1.0, "bikinlah": 1.0, "set": 1.0, "setel": 0.8, "atur": 1.0,
    "aturkan": 1.0, "ubah": 1.0, "ganti": 1.0, "hapus": 1.0,
    "hapuskan": 1.0, "delete": 1.0, "remove": 1.0, "bagi": 1.0,
    "alokasi": 1.0, "alokasikan": 1.0, "pecah": 1.0, "split": 1.0,
    "jadwalkan": 1.0, "add": 1.0, "record": 1.0, "create": 1.0,
    "update": 1.0, "pindahkan": 0.9, "transfer": 0.9,
    # A budget and a goal can be ordered without a verb: "budget makan
    # 500000 sebulan" means the same as "set budget makan 500000".
    "budget": 0.9, "anggaran": 0.9, "target": 0.9, "tujuan": 0.8,
    "rencana": 0.8, "plan": 0.8,
    # "budgeting" is the Indonesian word for budgeting. It names the
    # subject, so it is worth a full action verb, not a soft one.
    "budgeting": 1.0,
}

# Words that mark a question. The interrogatives are strong; the
# question words are weaker because "show me" can be an order too.
QUESTION_WORDS = {
    "berapa": 1.0, "berapakah": 1.0, "how": 0.8, "much": 0.6,
    "apakah": 0.8, "adakah": 1.0, "whether": 0.8,
    "kapan": 1.0, "when": 0.8, "kenapa": 1.0, "why": 0.8, "mengapa": 1.0,
    "bagaimana": 0.9, "siapa": 0.9, "who": 0.7,
    "dimana": 0.9, "where": 0.7, "mana": 0.7, "which": 0.7,
    "cek": 0.7, "check": 0.6, "lihat": 0.6, "show": 0.6,
    "tampilkan": 0.7, "cari": 0.7, "find": 0.6,
}

# Words that ask for advice rather than for an action.
SUGGESTION_WORDS = {
    "saran": 1.0, "suggest": 1.0, "rekomendasi": 1.0, "recommend": 1.0,
    "ide": 0.8, "tips": 0.9, "bantuan": 0.8, "help": 0.8, "bantu": 0.8,
    "sebaiknya": 1.0, "should": 0.8, "kira-kira": 0.6, "kiranya": 0.6,
    "pertimbangkan": 1.0, "consider": 0.8, "boleh": 0.6,
    "gimana": 0.7, "bagaimana": 0.5,
}

# Words that make the whole sentence a wish, not an order.
WISH_WORDS = {
    "ingin": 0.8, "inginnya": 0.8, "want": 0.6, "pengen": 0.8,
    "harus": 0.4, "perlu": 0.4, "butuh": 0.4,
}

# Words that undo an instruction. "jangan tambah 5000" is not an order
# to add anything.
NEGATION_WORDS = {
    "jangan": 1.2, "tidak": 0.6, "nggak": 0.6, "enggak": 0.6,
    "bukan": 0.5, "no": 0.5, "avoid": 0.6, "stop": 0.8,
}

# Words that mean the user is thinking out loud, not asking for anything.
HEDGE_WORDS = {
    "mungkin": 0.6, "kayaknya": 0.6, "sepertinya": 0.6, "kemungkinan": 0.6,
    "kadang": 0.4, "kadang-kadang": 0.5,
}

# Politeness that marks an order as polite rather than as a question.
POLITE_MARKERS = {
    "tolong": 0.8, "please": 0.8, "bisa": 0.3, "boleh": 0.3, "mohon": 0.8,
    "silakan": 0.7, "dong": 0.5,
}


# ---------------------------------------------------------------------------
# Splitting a message into clauses
# ---------------------------------------------------------------------------

# The verbs that start a request.
_ACTION = (
    r"(?:tambah(?:kan)?|hapus(?:kan)?|buat(?:kan)?|bikin(?:lah)?|"
    r"set(?:el)?|atur(?:kan)?|bagi|pecah|cat(?:at|atkan)|alokasi(?:kan)?|"
    r"budget|anggaran|target|tujuan|rencana|plan|saran|rekomendasi)"
)

# The words that join two requests.
_JOINER = (
    r"(?:dan|atau|tapi|namun|sedangkan|kemudian|lalu|selain\s+itu|"
    r"berikutnya|selanjutnya)"
)

# A clause ends at a sentence mark, at a comma, or at a joiner that is
# followed by a request.
#
# The split may never cut a word in half, and it may never separate a
# word from the one it belongs to. "tolong tambah 50000 kopi" is one
# clause and "jangan hapus parkirlah" is one clause, so the split only
# happens at a comma, at a sentence mark, or at an explicit joiner.
# The pattern is built without the verbose flag, because in verbose
# mode the whitespace inside the pattern is ignored and "\s+" would
# quietly turn into "s+".
_CLAUSE_SPLIT = re.compile(
    r"(?<=[.!?;])\s+"
    r"|,\s+"
    r"|\s+(?=" + _JOINER + r"\s+(?:kemudian\s+|lalu\s+)?" + _ACTION + r"\b)",
    re.IGNORECASE,
)

# A clause that holds nothing but a modifier or a filler belongs to the
# clause that follows it. "tolong" in front of "tambah 50000 kopi" is
# not a request of its own.
_MODIFIER_ONLY = re.compile(
    r"^(?:"
    # politeness and permission
    r"(?:tolong|tolong\s+dong|dong|mohon|silakan|please|bisa|boleh|"
    r"boleh\s+dong|kok|bisa\s+kah|bisa\s+ya|sudah|sudah\s+dong|"
    r"tolong\s+ya|ya|ya\s+kah)"
    # the wish
    r"|(?:saya|aku|gue|gw)\s+(?:ingin|pengen|mau|bermaksud)"
    r"|(?:ingin|pengen|mau)"
    # a negation, which belongs to the verb after it
    r"|(?:jangan|jangan\s+mau|tidak|nggak|enggak|bukan)"
    # a joiner or a filler
    r"|(?:dan|atau|tapi|namun|sedangkan|kemudian|lalu|juga|terus|ok|"
    r"oke|sip|baik|thanks|terima\s+kasih)"
    r")+[\s,.-]*$",
    re.IGNORECASE,
)


def split_clauses(message: str) -> List[str]:
    """
    Break a message into the separate requests it contains.

    The split has to be careful with numbers. "gaji 6 juta per bulan" is
    one clause, and "23 Oktober 2027" is one clause; neither may be cut
    in half. A clause that is only a modifier is attached to the clause
    after it, so "tolong tambah 50000 kopi" stays one request.
    """
    text = (message or "").strip()
    if not text:
        return []

    parts = [part.strip(" ,.;:-") for part in _CLAUSE_SPLIT.split(text)]

    # A modifier-only clause belongs to the next one.
    clauses: List[str] = []
    pending = ""
    for part in parts:
        if not part:
            continue
        if _MODIFIER_ONLY.match(part):
            pending = (pending + " " + part).strip()
            continue
        clauses.append((pending + " " + part).strip())
        pending = ""

    if pending:
        # A trailing modifier with nothing after it is its own clause.
        clauses.append(pending)

    return clauses or [text]


# ---------------------------------------------------------------------------
# Scoring one clause
# ---------------------------------------------------------------------------

@dataclass
class Clause:
    """One request, and what was read out of it."""

    text: str
    kind: str = STATEMENT
    intent: str = "unknown"
    confidence: float = 0.0
    signals: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "kind": self.kind,
            "intent": self.intent,
            "confidence": round(self.confidence, 2),
            "signals": {k: round(v, 2) for k, v in self.signals.items()},
        }


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def _score_signals(clause: str) -> Dict[str, float]:
    """
    How much evidence there is for each class.

    The score is a sum of the words that carry that meaning. A question
    mark is worth more than a single question word, because "berapa
    saldo saya?" is a question while "berapa saldo saya" can be a
    statement.
    """
    text = clause.lower()
    tokens = set(_tokenize(text))

    act = 0.0
    for word, weight in ACT_VERBS.items():
        if word in tokens:
            act += weight

    question = 0.0
    for word, weight in QUESTION_WORDS.items():
        if word in tokens:
            question += weight
    if "?" in clause:
        question += 1.2

    suggestion = 0.0
    for word, weight in SUGGESTION_WORDS.items():
        if word in tokens:
            suggestion += weight

    wish = 0.0
    for word, weight in WISH_WORDS.items():
        if word in tokens:
            wish += weight

    negation = 0.0
    for word, weight in NEGATION_WORDS.items():
        if word in tokens:
            negation += weight

    hedge = 0.0
    for word, weight in HEDGE_WORDS.items():
        if word in tokens:
            hedge += weight

    polite = 0.0
    for word, weight in POLITE_MARKERS.items():
        if word in tokens:
            polite += weight

    # A polite marker turns a plain verb into an order. "tolong tambah
    # 5000 kopi" is an instruction, not a suggestion.
    if polite and act:
        act += polite * 0.5

    return {
        "act": act,
        "question": question,
        "suggestion": suggestion,
        "wish": wish,
        "negation": negation,
        "hedge": hedge,
        "polite": polite,
    }


def _classify(clause: str, signals: Dict[str, float]) -> Tuple[str, float]:
    """
    Decide the class of a clause and how sure we are.

    The order of the checks matters. A question word beats an action
    verb, because "berapa yang perlu saya tambahkan?" contains both and
    is a question. A negation beats everything, because it undoes the
    instruction. A wish beats a bare action verb, because "saya ingin
    tambah 5000" is the user describing a wish, which the agent should
    confirm rather than carry out silently.
    """
    act = signals["act"]
    question = signals["question"]
    suggestion = signals["suggestion"]
    negation = signals["negation"]
    wish = signals["wish"]
    hedge = signals["hedge"]

    # A negated order is not an order.
    if negation >= 1.0 and act >= 1.0:
        return STATEMENT, 0.6

    total = act + question + suggestion + 1e-6

    # A question is a question even when it carries an action verb.
    if question > 0 and question >= act:
        confidence = min(0.95, 0.55 + question / (total + 1))
        return QUESTION, confidence

    # A wish that is not an order is advice-seeking.
    if wish >= 0.8 and act > 0 and wish >= act * 0.7 and suggestion < wish:
        return SUGGESTION, min(0.9, 0.5 + wish / (total + 1))

    if suggestion > 0 and suggestion >= act and act < 1.5:
        confidence = min(0.9, 0.5 + suggestion / (total + 1))
        return SUGGESTION, confidence

    if act > 0:
        confidence = min(0.95, 0.5 + act / (total + 1))
        return INSTRUCTION, confidence

    if question > 0:
        return QUESTION, min(0.85, 0.45 + question / (total + 1))

    # A hedged statement with a number in it is not an order. This is
    # the case that used to move money by accident.
    if hedge > 0:
        return STATEMENT, 0.5

    return STATEMENT, 0.3


# ---------------------------------------------------------------------------
# The intent inside an instruction
# ---------------------------------------------------------------------------

# Which subject an instruction is about. The order is the order of how
# specific the words are.
_INTENT_SUBJECTS = (
    ("allocate", ("bagi", "alokasi", "alokasikan", "pecah", "split",
                  "distribusi", "porsi", "persentase", "persen")),
    ("build_plan", ("plan", "rencana", "pola", "sistem", "struktur",
                    "primer", "sekunder", "tersier", "kebutuhan",
                    "prioritas", "stratifikasi")),
    ("set_budget", ("budget", "budgeting", "anggaran", "batas", "limit")),
    # "tabungan" alone is a goal only when nothing else in the sentence
    # says what to do. "transfer ke tabungan" is a transfer to an account
    # called tabungan, not a request to set a savings goal, so the
    # stronger cue has to win.
    ("set_savings_goal", ("target", "tujuan", "goal", "niat")),
    ("set_recurring", ("rutin", "berulang", "recurring", "setoran",
                       "otomatis", "langsung")),
    ("delete_transaction", ("hapus", "hapuskan", "delete", "remove",
                            "buang")),
    ("add_transaction", ("tambah", "tambahkan", "catat", "catatkan",
                         "masukkan", "add", "record", "beli", "bayar",
                         "purchase", "buy")),
)

# A transaction needs a subject and a value. Without both, the clause
# is not an order to record a transaction.
_AMOUNT_RE = re.compile(r"\d[\d.,]*")


def _has_amount(clause: str) -> bool:
    return bool(_AMOUNT_RE.search(clause or ""))


def _has_real_amount(clause: str) -> bool:
    """
    A figure, as opposed to a duration.

    "2 tahun" holds a number, but it is two years, not two rupiah. A
    clause that holds nothing but a duration has no figure in it.
    """
    without_duration = strip_durations(clause or "")
    return bool(_AMOUNT_RE.search(without_duration))


# A duration is a count of time, not a sum of money. "2 tahun ke
# depan" is two years, and it must never be read as two rupiah.
#
# The definition lives in app.services.duration, so the classifier and
# the amount extractor cannot disagree about what a duration is.
def _has_duration(clause: str) -> bool:
    return has_duration(clause)


def _intent_of_instruction(clause: str) -> Tuple[str, float]:
    """
    Which action an instruction asks for.

    The amount is part of the answer: "tambah kopi" with no number is
    not a transaction the agent can write, so it becomes a question
    about what to add.
    """
    text = (clause or "").lower()
    tokens = set(_tokenize(text))

    for intent, words in _INTENT_SUBJECTS:
        if not any(word in tokens for word in words):
            continue

        if intent == "set_budget":
            # "budgeting untuk 2 tahun ke depan" asks for a budget over
            # a stretch of time, not for one line item. That is a plan.
            # The duration is checked first, because the number inside
            # it is not a figure: "2 tahun" is two years, not two
            # rupiah.
            if _has_duration(clause):
                return "build_plan", 0.85

        if intent in ("add_transaction", "set_budget", "set_savings_goal"):
            if not _has_amount(clause):
                # "tambah kopi" without a number asks what to add, it
                # does not order a transaction.
                return "query", 0.5

        if intent == "allocate":
            if not (re.search(r"\d+\s*(?:%|persen)", text) or _has_amount(clause)):
                return "query", 0.5

        if intent == "set_recurring":
            if not _has_amount(clause):
                return "query", 0.5

        confidence = 0.9 if intent in ("allocate", "build_plan") else 0.85
        return intent, confidence

    # An order with no known subject but with a value is a transaction.
    if _has_amount(clause):
        return "add_transaction", 0.7

    return "unknown", 0.3


# ---------------------------------------------------------------------------
# The analysis of a whole message
# ---------------------------------------------------------------------------

@dataclass
class Analysis:
    """What the whole message asked for."""

    clauses: List[Clause] = field(default_factory=list)

    @property
    def instructions(self) -> List[Clause]:
        return [c for c in self.clauses if c.kind == INSTRUCTION]

    @property
    def questions(self) -> List[Clause]:
        return [c for c in self.clauses if c.kind == QUESTION]

    @property
    def suggestions(self) -> List[Clause]:
        return [c for c in self.clauses if c.kind == SUGGESTION]

    @property
    def is_multi_subject(self) -> bool:
        """More than one request that has to be carried out."""
        return len(self.instructions) > 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "clauses": [c.to_dict() for c in self.clauses],
            "instructions": len(self.instructions),
            "questions": len(self.questions),
            "suggestions": len(self.suggestions),
            "is_multi_subject": self.is_multi_subject,
        }


def analyze(message: str) -> Analysis:
    """
    Read a message and work out what it asks for.

    Every clause is classified on its own, so a message that mixes a
    question, an instruction and a suggestion gets all three read
    correctly instead of only the first one.
    """
    analysis = Analysis()

    for text in split_clauses(message):
        signals = _score_signals(text)
        kind, confidence = _classify(text, signals)

        clause = Clause(
            text=text,
            kind=kind,
            confidence=confidence,
            signals=signals,
        )

        if kind == INSTRUCTION:
            clause.intent, clause.confidence = _intent_of_instruction(text)
            # An instruction that turned out to have no workable subject
            # is a question after all.
            if clause.intent == "query":
                clause.kind = QUESTION
                clause.intent = _question_subject(text)
        elif kind == QUESTION:
            clause.intent = _question_subject(text)
        elif kind == SUGGESTION:
            # A request for advice is answered by the advisor, not by
            # reading a table.
            clause.intent = "query_advice"

        analysis.clauses.append(clause)

    return analysis


# Which read answers a question. The subject decides which one.
_QUERY_SUBJECTS = (
    ("query_budgets", ("budget", "anggaran", "batas", "limit")),
    ("query_balance", ("saldo", "balance", "duit", "uang", "sisa")),
    ("query_expenses", ("pengeluaran", "expense", "belanja", "biaya",
                        "habis", "boros")),
    ("query_goals", ("target", "goal", "tujuan", "cita")),
    ("query_transactions", ("transaksi", "transaction", "riwayat", "history")),
    ("query_advice", ("saran", "advice", "tips", "rekomendasi", "help",
                      "bantuan")),
)


def _question_subject(text: str) -> str:
    """
    Which read answers the question.

    "berapa saldo saya" is about the balance, not about the budgets.
    """
    lowered = (text or "").lower()
    for kind, words in _QUERY_SUBJECTS:
        if any(word in lowered for word in words):
            return kind
    return "query_budgets"
