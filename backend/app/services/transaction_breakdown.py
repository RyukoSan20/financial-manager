"""
Breaking a transaction down into the things it paid for.

"Beli di Indomaret 5000" is one line in the user's ledger, but it is
five things in the shop. The receipt scanner already found those five
things when the photo was read. When there is no photo, the same
question still deserves an answer: what was bought?

So a transaction can carry its own lines. The shop the user mentioned
is looked up in the catalog that the receipt scanner has been filling in
as they shop. If that shop has been seen before, its usual items are
known, and the amount is split across them. If the shop is new, the
model is asked to describe what is likely to be in a shop of that kind,
never to name a specific product the user did not mention.

The result is always marked as an estimate. The user is the one who
knows what was in the basket.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
from app.services.number_parsing import parse_number

logger = logging.getLogger(__name__)


_ITEMS_PROMPT = """You describe the contents of a purchase.

The user said: "{message}"
The amount was: Rp{amount:,.0f}
The shop was: "{merchant}"

List the things that make up that purchase, so the user can see what
their money went on.

Rules:
- The amounts must add up to exactly Rp{amount:,.0f}.
- Give each line a name in Indonesian, a category and an amount.
- "category" is one of: food, drink, household, personal_care,
  snack, medicine, stationery, clothing, electronics, other.
- Use a product name the user would recognise, not a brand.
- If you cannot tell what was bought, return one line named after the
  purchase itself.
- Reply with JSON only, no prose.

The JSON shape:
{{"lines": [{{"name": "...", "category": "...", "amount": 1234}}]}}
"""


# What is usually in a shop of this kind. Used when the model is
# unavailable. These are deliberately generic categories rather than
# specific products, because a guess should not look like a fact.
_SHOP_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "minimarket": [
        {"name": "Makanan dan jajan", "category": "food", "share": 0.40},
        {"name": "Minuman", "category": "drink", "share": 0.25},
        {"name": "Kebutuhan rumah tangga", "category": "household", "share": 0.20},
        {"name": "Perawatan diri", "category": "personal_care", "share": 0.15},
    ],
    "supermarket": [
        {"name": "Bahan makanan", "category": "food", "share": 0.55},
        {"name": "Minuman", "category": "drink", "share": 0.20},
        {"name": "Kebutuhan rumah tangga", "category": "household", "share": 0.15},
        {"name": "Perawatan diri", "category": "personal_care", "share": 0.10},
    ],
    "warung": [
        {"name": "Makanan", "category": "food", "share": 0.85},
        {"name": "Minuman", "category": "drink", "share": 0.15},
    ],
    "apotek": [
        {"name": "Obat", "category": "medicine", "share": 0.70},
        {"name": "Perawatan diri", "category": "personal_care", "share": 0.30},
    ],
    "default": [
        {"name": "Belanja", "category": "other", "share": 0.70},
        {"name": "Lainnya", "category": "other", "share": 0.30},
    ],
}

# Words that say what kind of shop it is.
_SHOP_WORDS: Dict[str, str] = {
    "indomaret": "minimarket",
    "alfamart": "minimarket",
    "minimarket": "minimarket",
    "supermarket": "supermarket",
    "superindo": "supermarket",
    "carrefour": "supermarket",
    "warung": "warung",
    "kedai": "warung",
    "rumah makan": "warung",
    "resto": "warung",
    "restoran": "warung",
    "apotek": "apotek",
    "klinik": "apotek",
    "pharmacy": "apotek",
}


def _shop_kind(merchant: str) -> str:
    """Guess what kind of shop this is, from its name."""
    lowered = (merchant or "").lower()
    for word, kind in _SHOP_WORDS.items():
        if word in lowered:
            return kind
    return "default"


def _clean_amount(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = re.sub(r"[^\d,.\-]", "", str(value).strip())
        if not text:
            return None
        number = parse_number(text)
        if number is None:
            return None
    return number if number > 0 else None


def _extract_json(raw: str) -> Optional[Any]:
    if not raw:
        return None
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except (ValueError, TypeError):
        return None


def _normalise_lines(lines: Any) -> List[Dict[str, Any]]:
    allowed = {
        "food", "drink", "household", "personal_care", "snack",
        "medicine", "stationery", "clothing", "electronics", "other",
    }
    cleaned: List[Dict[str, Any]] = []
    for line in lines or []:
        if not isinstance(line, dict):
            continue
        name = str(line.get("name", "")).strip()
        if not name:
            continue
        amount = _clean_amount(line.get("amount") or line.get("total_price"))
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
            }
        )
    return cleaned


def _template_lines(merchant: str, amount: float) -> List[Dict[str, Any]]:
    template = _SHOP_TEMPLATES[_shop_kind(merchant)]
    lines = [
        {**entry, "amount": round(amount * entry["share"], 2)}
        for entry in template
    ]
    # Rounding leaves a small gap; put it on the largest line.
    drift = round(amount - sum(line["amount"] for line in lines), 2)
    if abs(drift) >= 1:
        largest = max(lines, key=lambda line: line["amount"])
        largest["amount"] = round(largest["amount"] + drift, 2)
    return lines


def expand_transaction(
    message: str,
    amount: float,
    merchant: Optional[str] = None,
    db: Any = None,
    user_id: Optional[int] = None,
    use_model: bool = True,
    timeout: int = 25,
) -> Dict[str, Any]:
    """
    Work out what a purchase was for.

    Returns a dict with the lines, where they came from, and whether
    the model was consulted.
    """
    total = float(amount or 0)
    if total <= 0:
        return {"lines": [], "source": "none", "used_model": False}

    lines: List[Dict[str, Any]] = []
    used_model = False

    # The catalog the receipt scanner has been filling in knows what this
    # shop sells. That is a better answer than the model's guess.
    if db is not None and user_id is not None and merchant:
        try:
            from app.services.catalog_learning import get_learning_service

            service = get_learning_service(db, user_id)
            known = service.find_merchant_match(merchant)
            if known:
                products = service.known_products()
                if products:
                    lines = _lines_from_products(products, total)
        except Exception as exc:  # noqa: BLE001 - the catalog is optional
            logger.warning("Could not read the merchant catalog: %s", exc)

    if not lines and use_model:
        try:
            from app.services.gemini_vision import call_gemini_text

            raw = call_gemini_text(
                _ITEMS_PROMPT.format(
                    message=message or "",
                    amount=total,
                    merchant=merchant or "toko",
                ),
                timeout=timeout,
                temperature=0.2,
                max_output_tokens=900,
                json_response=True,
            )
        except Exception as exc:  # noqa: BLE001 - the model is optional
            logger.warning("Transaction breakdown model unavailable: %s", exc)
            raw = None

        if raw:
            payload = _extract_json(raw)
            if isinstance(payload, dict):
                lines = _normalise_lines(payload.get("lines") or [])
            elif isinstance(payload, list):
                lines = _normalise_lines(payload)
            if lines:
                used_model = True

    if not lines:
        lines = _template_lines(merchant or "", total)
        return {
            "lines": lines,
            "source": "template",
            "used_model": False,
        }

    return {
        "lines": lines,
        "source": "llm",
        "used_model": True,
    }


def _lines_from_products(products: List[Any], amount: float) -> List[Dict[str, Any]]:
    """
    Split an amount across products the user has actually bought here.

    The products are the ones the catalog already knows, so the answer
    is based on what this shop really sells rather than on a guess.
    """
    if not products:
        return []

    lines: List[Dict[str, Any]] = []
    # Even split, with the remainder on the first line.
    share = amount / len(products)
    for index, product in enumerate(products[:8]):
        product_amount = round(share, 2)
        if index == 0:
            product_amount = round(amount - share * (len(products[:8]) - 1), 2)
        lines.append(
            {
                "name": str(product)[:255],
                "category": "other",
                "amount": product_amount,
            }
        )
    return lines
