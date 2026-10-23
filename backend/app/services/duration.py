"""
How long a stretch of time is.

A duration is a count of time, not a sum of money. "buatkan budgeting
untuk 2 tahun ke depan" was answered with a transaction of 2, because
the number in the duration was read as a figure.

Both the intent classifier and the amount extractor have to agree on
what a duration looks like. If they disagree, one of them reads the
number as money. So the definition lives here and both use it.
"""

import re
from typing import Optional

# ---------------------------------------------------------------------------
# The units of time
# ---------------------------------------------------------------------------

# The units in the words people actually write them in.
#
# The short forms are here because they are common in chat: "2 thn",
# "3 bln", "1 th", "6 hr". The long forms cover "tahunan", "bulanan"
# and the English words.
_DURATION_UNITS = (
    r"tahun|tahunan|thn|th|yr|year|years|"
    r"bulan|bulanan|bln|month|months|"
    r"minggu|mingguan|mgg|week|weeks|"
    r"hari|harian|hr|day|days|"
    r"kuartal|quarter|qtr"
)

# A number followed by a unit of time.
DURATION_RE = re.compile(
    r"\d+\s*(?:" + _DURATION_UNITS + r")\b",
    re.IGNORECASE,
)

# The same, with a word in front of it. "untuk 2 tahun" is a duration
# as well, and the word in front is what tells the reader it is one.
DURATION_WITH_CONTEXT_RE = re.compile(
    r"\b(?:untuk|dalam|selama|periode|jangka\s+waktu|sepanjang|"
    r"selama\s+periode|untuk\s+periode|rentang|jangka)\s+"
    r"\d+\s*(?:" + _DURATION_UNITS + r")\b",
    re.IGNORECASE,
)

# The number of months a duration covers.
_MONTHS_PER_UNIT = {
    "tahun": 12, "tahunan": 12, "thn": 12, "th": 12, "yr": 12,
    "year": 12, "years": 12,
    "kuartal": 3, "quarter": 3, "qtr": 3,
    "bulan": 1, "bulanan": 1, "bln": 1,
    "month": 1, "months": 1,
    "minggu": 0.25, "mingguan": 0.25, "mgg": 0.25,
    "week": 0.25, "weeks": 0.25,
    "hari": 1 / 30, "harian": 1 / 30, "hr": 1 / 30,
    "day": 1 / 30, "days": 1 / 30,
}


# ---------------------------------------------------------------------------
# Numbers written in words
# ---------------------------------------------------------------------------

# The words for a small count. Only these are needed: a duration is
# never more than a few dozen of anything.
_WORDS = {
    "satu": 1, "dua": 2, "tiga": 3, "empat": 4,
    "lima": 5, "enam": 6, "tujuh": 7, "delapan": 8, "sembilan": 9,
    "sepuluh": 10, "sebelas": 11, "duabelas": 12, "dua belas": 12,
}

# The tens, and how they combine with the ones. Both the joined and
# the spaced spelling are listed, because speech recognition returns
# either one.
_TENS = {
    "sepuluh": 10,
    "duapuluh": 20, "dua puluh": 20,
    "tigapuluh": 30, "tiga puluh": 30,
    "empatpuluh": 40, "empat puluh": 40,
    "limapuluh": 50, "lima puluh": 50,
    "enampuluh": 60, "enam puluh": 60,
    "tujuhpuluh": 70, "tujuh puluh": 70,
    "delapanpuluh": 80, "delapan puluh": 80,
    "sembilanpuluh": 90, "sembilan puluh": 90,
}

# Every word the converter knows.
_WORD_KEYS = set(_WORDS) | set(_TENS)


def _word_number(text: str) -> Optional[float]:
    """
    The value of a number written in words.

    Only the counts a duration needs: one to ninety-nine. "dua puluh
    empat tahun" is twenty-four years, and it must not be read as a
    figure.
    """
    if not text:
        return None

    words = text.lower().replace("-", " ").split()
    if not words:
        return None

    # The joined form, so "duapuluh" and "dua puluh" both work.
    joined = "".join(words)

    if joined in _TENS:
        return float(_TENS[joined])

    # A ones word in front of a tens word: "dua puluh empat".
    if len(words) >= 2:
        tens = _TENS.get("".join(words[:2]))
        if tens is not None:
            ones = _WORDS.get(words[2]) if len(words) > 2 else 0
            return float(tens + (ones or 0))

    if len(words) == 1:
        return _WORDS.get(words[0])

    return None


# A number written in words, standing directly in front of a unit of
# time.
#
# The number can be several words long: "dua puluh empat bulan" is
# twenty-four months, not four. The pattern therefore takes up to
# three number words in a row.
_WORD_BEFORE_UNIT_RE = re.compile(
    r"\b((?:" + "|".join(sorted(_WORD_KEYS, key=len, reverse=True)) + r")"
    r"(?:\s+(?:" + "|".join(sorted(_WORD_KEYS, key=len, reverse=True)) + r")){0,2})"
    r"\b(?=\s+(?:" + _DURATION_UNITS + r")\b)",
    re.IGNORECASE,
)


def _digitise(text: str) -> str:
    """
    Write the number words in the text as digits.

    "sepanjang dua tahun" becomes "sepanjang 2 tahun", so the duration
    is found by the same rule as "sepanjang 2 tahun". Only a number
    that stands directly in front of a unit of time is changed, so
    "dua tahun" becomes a duration while "dua buku" is left alone.
    """
    if not text:
        return text or ""

    def replace(match: "re.Match") -> str:
        value = _word_number(match.group(1))
        return str(int(value)) if value is not None else match.group(0)

    return _WORD_BEFORE_UNIT_RE.sub(replace, text)


# ---------------------------------------------------------------------------
# Reading a duration
# ---------------------------------------------------------------------------

def has_duration(text: str) -> bool:
    """Is there a stretch of time in this text?"""
    return bool(DURATION_RE.search(_digitise(text or "")))


def duration_months(text: str) -> Optional[float]:
    """
    How many months the longest duration in this text covers.

    "2 tahun" gives 24. "6 bulan" gives 6. "2 thn" and "dua tahun"
    give 24 as well. A text with no duration gives None.
    """
    best: Optional[float] = None

    for match in DURATION_RE.finditer(_digitise(text or "")):
        raw = match.group(0)
        parts = re.match(r"(\d+)\s*(\w+)", raw)
        if not parts:
            continue
        try:
            count = float(parts.group(1))
        except ValueError:
            continue
        unit = parts.group(2).lower()
        months = _MONTHS_PER_UNIT.get(unit)
        if months is None:
            continue
        total = count * months
        if best is None or total > best:
            best = total

    return best


def strip_durations(text: str) -> str:
    """
    Remove every duration from the text.

    This is what keeps a duration out of a figure: the amount extractor
    removes the durations first, so the number left in the text is a
    figure and not a count of time.
    """
    if not text:
        return text or ""

    # The durations that are written in words are turned into digits
    # first, so they are removed the same way as the ones that were
    # typed as digits.
    digitised = _digitise(text)

    # A duration with a word in front of it is removed whole, so the
    # word does not end up dangling in the description.
    stripped = DURATION_WITH_CONTEXT_RE.sub(" ", digitised)
    return DURATION_RE.sub(" ", stripped)
