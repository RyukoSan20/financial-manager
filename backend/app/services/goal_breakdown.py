"""
Turning a broad wish into a list of costs.

"Target ke Jepang 4 juta" says almost nothing about what the money is
for. Is the four million for the flight, or for the flight plus four
years of living there? A goal that only carries a number gives the
user nothing to look at and nothing to act on.

So before a goal is saved, the model is asked to break it down into
the parts that actually cost money: the flight, the stay, the food, the
visa, the insurance. The result is a set of lines, each with a name, a
category and a number, and the sum of those numbers is what the goal
saves for.

The model is optional. When the provider is slow, rate limited or
unavailable, the caller still gets a goal - just one without a
breakdown. A goal that is missing detail is better than no goal.

What the model is NOT allowed to do is invent a merchant or a shop.
That rule matters for receipts and it matters just as much here: a
breakdown that names a specific airline is a claim the user did not
make. The generic templates below are the fallback when the model is
unavailable, and they are deliberately generic for the same reason.
"""

import json
import logging
import re
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from app.services.number_parsing import parse_number

logger = logging.getLogger(__name__)


# How long a goal breakdown is worth asking for.
_BREAKDOWN_PROMPT = """You break a savings goal into the costs that make it up.

The user says: "{message}"
The target amount is: Rp{target:,.0f}
The target date is: {target_date} ({days_left} days from now)

List the things the money has to cover. For a trip, that is the
transport, the place to stay, the food, the documents, the insurance.
For a house, that is the down payment, the tax, the notary, the
repair. Choose what fits the goal, do not use this list blindly.

Rules:
- The amounts must add up to exactly Rp{target:,.0f}. Work the
  numbers out so they do.
- Give each line a name in Indonesian, a category, and an amount.
- "category" is one of: transport, accommodation, food, documents,
  insurance, shopping, health, education, housing, other.
- A line that is not a cost (savings, buffer, unexpected) gets
  category "other".
- Do not name a specific airline, hotel or shop. Use a general name
  like "Tiket pesawat", "Penginapan", "Makan dan jajan".
- Reply with JSON only, no prose.

The JSON shape:
{{"lines": [{{"name": "...", "category": "...", "amount": 1234567, "note": "..."}}]}}
"""


# Generic cost templates, used when the model is unavailable. Each one
# is a share of the target. They are deliberately not about any
# particular merchant.
_GENERIC_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "travel": [
        {"name": "Tiket pesawat", "category": "transport", "share": 0.45,
         "note": "Perkiraan harga tiketBolak-balik, adjust sesuai tanggal"},
        {"name": "Penginapan", "category": "accommodation", "share": 0.25,
         "note": "Perkiraan penginapan, adjust dengan durasi rencana"},
        {"name": "Makan dan jajan", "category": "food", "share": 0.15,
         "note": "Perkiraan makan harian selama rencana"},
        {"name": "Dokumen perjalanan", "category": "documents", "share": 0.08,
         "note": "Visa, paspor, dan biaya administrasi"},
        {"name": "Asuransi perjalanan", "category": "insurance", "share": 0.07,
         "note": "Asuransi perjalanan, bisa dilewati kalau tidak perlu"},
    ],
    "purchase": [
        {"name": "Uang muka", "category": "housing", "share": 0.60,
         "note": "Perkiraan uang muka"},
        {"name": "Pajak dan biaya administrasi", "category": "documents", "share": 0.15,
         "note": "Pajak, PPAT, dan biaya notaris"},
        {"name": "Perbaikan dan furnish", "category": "housing", "share": 0.15,
         "note": "Perbaikan ringan dan furnish"},
        {"name": "Dana tak terduga", "category": "other", "share": 0.10,
         "note": "Cadangan untuk hal yang tidak terduga"},
    ],
    "generic": [
        {"name": "Kebutuhan utama", "category": "other", "share": 0.70,
         "note": "Komponen terbesar dari target ini"},
        {"name": "Kebutuhan pendukung", "category": "other", "share": 0.20,
         "note": "Biaya tambahan"},
        {"name": "Dana tak terduga", "category": "other", "share": 0.10,
         "note": "Cadangan 10% untuk hal yang tidak terduga"},
    ],
}

# Words that say the goal is about a journey.
_TRAVEL_WORDS = (
    "jepang", "japan", "tokyo", "osaka", "kyoto", "bali", "thailand",
    "singapura", "singapore", "korea", "seoul", "cina", "china",
    "turis", "travel", "trip", "liburan", "vacation", "keberangkatan",
    "liburan", "jalan-jalan", "umroh", "haji",
)

# Words that say the goal is about buying something.
_PURCHASE_WORDS = (
    "rumah", "house", "mobil", "car", "motor", "k-motor", "laptop",
    "hp", "handphone", "sepeda", "mebel", "furnitur", "properti",
)


def _template_for(text: str) -> str:
    """Pick a generic template for a goal description."""
    lowered = (text or "").lower()
    if any(word in lowered for word in _TRAVEL_WORDS):
        return "travel"
    if any(word in lowered for word in _PURCHASE_WORDS):
        return "purchase"
    return "generic"


def _clean_amount(value: Any) -> Optional[float]:
    """Read a number out of whatever the model returned."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = str(value).strip()
        # Strip the currency and the thousands separators.
        text = re.sub(r"[^\d,.\-]", "", text)
        if not text:
            return None
        number = parse_number(text)
        if number is None:
            return None
    return number if number > 0 else None


def _normalise_categories(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Clean up each line the model produced."""
    allowed = {
        "transport", "accommodation", "food", "documents", "insurance",
        "shopping", "health", "education", "housing", "other",
    }
    cleaned: List[Dict[str, Any]] = []
    for line in lines or []:
        if not isinstance(line, dict):
            continue
        name = str(line.get("name", "")).strip()
        if not name:
            continue
        amount = _clean_amount(line.get("amount"))
        if amount is None:
            continue
        category = str(line.get("category", "other")).strip().lower()
        if category not in allowed:
            category = "other"
        cleaned.append(
            {
                "name": name[:255],
                "category": category,
                "amount": round(amount, 2),
                "note": str(line.get("note", "")).strip()[:500] or None,
            }
        )
    return cleaned


def _scale_to_target(
    lines: List[Dict[str, Any]],
    target: float,
) -> List[Dict[str, Any]]:
    """
    Make the lines add up to the target.

    The model is asked to do the arithmetic, but a model that got it
    slightly wrong should not leave the user with a breakdown that does
    not match the goal. The largest line absorbs the difference, because
    that is the line most likely to be a rounded estimate anyway.
    """
    if not lines:
        return []

    total = sum(line["amount"] for line in lines)
    if total <= 0:
        return []

    if abs(total - target) < 1:
        return lines

    scale = target / total
    scaled = []
    for line in lines:
        scaled.append(
            {
                **line,
                "amount": round(line["amount"] * scale, 2),
            }
        )

    # Rounding leaves a small gap. Put it on the largest line.
    drift = round(target - sum(line["amount"] for line in scaled), 2)
    if abs(drift) >= 1:
        largest = max(scaled, key=lambda line: line["amount"])
        largest["amount"] = round(largest["amount"] + drift, 2)

    return scaled


def _extract_json(raw: str) -> Optional[Any]:
    """Pull the JSON out of a model answer."""
    if not raw:
        return None
    text = raw.strip()
    # The model sometimes wraps the JSON in a code fence.
    fence = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        pass
    # Otherwise look for the first {...} in the text.
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except (ValueError, TypeError):
        return None


def _generic_breakdown(message: str, target: float) -> List[Dict[str, Any]]:
    """Build a breakdown without asking the model."""
    template = _GENERIC_TEMPLATES[_template_for(message)]
    lines = []
    for entry in template:
        amount = round(target * entry["share"], 2)
        if amount < 1:
            continue
        lines.append(
            {
                "name": entry["name"],
                "category": entry["category"],
                "amount": amount,
                "note": entry.get("note"),
            }
        )
    return _scale_to_target(lines, target)


def expand_goal(
    message: str,
    target_amount: float,
    target_date: Optional[date] = None,
    use_model: bool = True,
    timeout: int = 30,
) -> Dict[str, Any]:
    """
    Work out what a goal is made of.

    Returns a dict with the lines, where they came from, and whether
    the model was consulted. The caller decides whether to save them.
    """
    target = float(target_amount or 0)
    if target <= 0:
        return {"lines": [], "source": "none", "used_model": False}

    days_left = 365
    if target_date:
        days_left = max(0, (target_date - date.today()).days)

    lines: List[Dict[str, Any]] = []
    used_model = False

    if use_model:
        try:
            from app.services.gemini_vision import call_gemini_text

            raw = call_gemini_text(
                _BREAKDOWN_PROMPT.format(
                    message=message or "",
                    target=target,
                    target_date=target_date.isoformat() if target_date else "tidak ditentukan",
                    days_left=days_left,
                ),
                timeout=timeout,
                temperature=0.2,
                max_output_tokens=1200,
                json_response=True,
            )
        except Exception as exc:  # noqa: BLE001 - the model is optional
            logger.warning("Goal breakdown model unavailable: %s", exc)
            raw = None

        if raw:
            payload = _extract_json(raw)
            if isinstance(payload, dict):
                lines = _normalise_categories(payload.get("lines") or [])
            elif isinstance(payload, list):
                lines = _normalise_categories(payload)
            if lines:
                used_model = True

    if not lines:
        lines = _generic_breakdown(message, target)
        return {
            "lines": lines,
            "source": "template",
            "used_model": False,
            "target_date": target_date.isoformat() if target_date else None,
        }

    lines = _scale_to_target(lines, target)
    return {
        "lines": lines,
        "source": "llm",
        "used_model": True,
        "target_date": target_date.isoformat() if target_date else None,
    }
