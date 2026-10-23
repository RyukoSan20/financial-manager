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

# The units of time, in the words people actually write them in.
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
    r"\b(?:untuk|dalam|selama|periode|jangka\s+waktu|untuk\s+periode)\s+"
    r"\d+\s*(?:" + _DURATION_UNITS + r")\b",
    re.IGNORECASE,
)

# The number of months a duration covers.
#
# The months per unit, keyed by the unit. The keys are the units as
# they are written, lowercased.
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


def has_duration(text: str) -> bool:
    """Is there a stretch of time in this text?"""
    return bool(DURATION_RE.search(text or ""))


def duration_months(text: str) -> Optional[float]:
    """
    How many months the longest duration in this text covers.

    "2 tahun" gives 24. "6 bulan" gives 6. "2 thn" gives 24 as well.
    A text with no duration gives None.
    """
    best: Optional[float] = None

    for match in DURATION_RE.finditer(text or ""):
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

    # A duration with a word in front of it is removed whole, so the
    # word does not end up dangling in the description.
    stripped = DURATION_WITH_CONTEXT_RE.sub(" ", text)
    return DURATION_RE.sub(" ", stripped)
