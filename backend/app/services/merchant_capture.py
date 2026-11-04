"""
Reading a product out of a photograph.

The flow the shop owner wants is on paper:

    the camera  ->  the picture  ->  the reading  ->  the catalogue

The camera part is the phone, and the phone already hands over a
picture. So the piece that was missing is the middle: something that
looks at a picture of a thing on a shelf and says what the thing is,
what it costs, and what kind of thing it is.

This is a different job from reading a receipt. A receipt is a list of
lines with numbers on them, and the hard part is knowing which number
is the total. A photograph of a product is one thing with a label on
it, and the hard part is knowing which of the numbers on the label is
the price, because a shelf label carries the price, the size, the
barcode, the old price and the discount, and only one of them is what
the customer pays.

So the two are kept apart. The receipt reader is not reused here,
because a receipt reader that is handed a photograph will confidently
report the barcode number as the total.

Two rules hold throughout:

- Nothing is written by this module. It reads a picture and hands back
  a draft. The shop owner looks at the draft, corrects what is wrong,
  and presses the button that saves it. A shop owner's catalogue is
  their own bookkeeping, and a reading that guesses is worse than no
  reading at all.

- When the model is not available, this returns None rather than
  something invented. The caller then says so plainly, rather than
  offering a product with a made-up price.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# The model that reads the picture. It comes from the environment for
# the same reason the receipt reader's model does: a name written into
# the code stops working when the name is retired, and the failure
# looks like the feature being broken rather than the model moving.
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{MODEL}:generateContent"
)

# The prompt.
#
# The instruction is specific about what a shelf label is, because the
# model reads the label as a receipt otherwise and reports the barcode
# as the price. It is also specific about the picture being a product
# and not a receipt, because a receipt is a list and a product is one
# thing.
PRODUCT_PROMPT = """You are looking at a photograph of ONE product, taken for a shop catalogue.

This is NOT a receipt. A receipt is a list of several lines with a total.
This is a single product: a packet, a bottle, a box, a tin, a bar of soap, a
bag of rice.

Look at the product and the label on it, and work out:

{
  "name": "the product's name as the shop would call it, in the language on the label",
  "brand": "the brand, or null if there is none",
  "price": the price the customer pays, as a number, or null if no price is visible,
  "currency": "IDR" unless the label clearly says another currency,
  "category": "one of: groceries, beverages, snacks, household, personal_care, frozen, bakery, produce, other",
  "unit": "the unit the price is for: pcs, kg, liter, box, or renceng",
  "size": "the size on the label, for example 250g, 1L, 12s, or null",
  "sku": "the barcode digits if you can read them, otherwise null"
}

Rules:
- The price is the price the customer pays NOW. A shelf label often shows
  an old price struck through next to a new one. If there is a strike-through
  price and a separate current price, the current price is the one to report.
- If the label shows "Rp 25.000" then the price is 25000.
- If the label shows a number of items, like "12" in a pack, that is the size
  or the unit, not the price.
- If you cannot read a price, say null. Do not guess a price. A wrong price
  is worse than no price, because the shop will sell at it.
- Return ONLY valid JSON, no markdown and no explanation.
"""


@dataclass
class CapturedProduct:
    """
    What was read out of the picture.

    This is a draft. It is what the model believed, and the shop owner
    is expected to look at it before it is saved.
    """

    name: str
    price: Optional[float] = None
    currency: str = "IDR"
    brand: Optional[str] = None
    category: str = "other"
    unit: str = "pcs"
    size: Optional[str] = None
    sku: Optional[str] = None
    # How sure the reader is, from 0 to 1. The shop owner sees this and
    # knows how much to trust the rest of it.
    confidence: float = 0.0
    # The picture it was read from, so that the draft can be shown next
    # to the picture the owner took.
    image_bytes: Optional[bytes] = field(default=None, repr=False)
    # What the reader could not work out, in words the owner can act on.
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """The draft, as the API answers it."""
        return {
            "name": self.name,
            "price": self.price,
            "currency": self.currency,
            "brand": self.brand,
            "category": self.category,
            "unit": self.unit,
            "size": self.size,
            "sku": self.sku,
            "confidence": self.confidence,
            "warnings": list(self.warnings),
        }


def _api_key() -> str:
    """The key, if there is one."""
    return os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")


def _mime_of(image_bytes: bytes) -> str:
    """
    What kind of picture this is.

    The model is told the type, so a photograph that is really a PNG is
    not described to the model as a photograph.
    """
    if image_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    # The picture was not recognised, so it is described as a
    # photograph, which is what it almost always is.
    return "image/jpeg"


def _parse_price(value: Any) -> Optional[float]:
    """
    A price, whatever form it was written in.

    A label writes its price in several ways: "Rp 25.000", "25000",
    "Rp 25.000,00", "25.000,-" and "25 000" all mean the same thing.
    The separators are the hard part: in Indonesia the dot is the
    thousands separator and the comma is the decimal, which is the
    opposite of what the model often returns.

    So the number is cleaned the Indonesian way: the dots go, the
    comma becomes the decimal point, and whatever is left is a number.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if not text:
        return None

    # The words that are not part of the number.
    text = re.sub(r"(?i)\b(rp|idr|rp\.)\b", "", text)
    text = text.replace(" ", "").replace("\u00a0", "")

    # A price with a trailing "-", which is how Indonesian prices are
    # written when the fraction is zero: "25.000,-".
    text = re.sub(r",-$", "", text)

    # The dot is the thousands separator here. It goes.
    text = text.replace(".", "")

    # The comma is the decimal point. It stays, and becomes a dot.
    if "," in text:
        text = text.replace(",", ".")

    # Anything that is still not a number is not a price.
    text = re.sub(r"[^0-9.\-]", "", text)
    if not text or text in ("-", "."):
        return None

    try:
        number = float(text)
    except ValueError:
        return None

    if number < 0:
        return None
    return number


def _clean_name(value: Any) -> str:
    """The name, tidied."""
    if not value:
        return ""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:255]


def _clean_sku(value: Any) -> Optional[str]:
    """
    The barcode, if there is one.

    Only the digits are kept. A barcode that came back with a label
    attached to it ("EAN: 8991234567890") is still a barcode, and the
    label is what a scanner would not say.
    """
    if not value:
        return None
    digits = re.sub(r"\D", "", str(value))
    if len(digits) < 6:
        return None
    return digits[:64]


def _confidence(value: Any) -> float:
    """
    How sure the reader is.

    The model is asked for a number between 0 and 1, but it sometimes
    answers with a percentage or with nothing at all, and the shop
    owner has to be able to trust this figure, so it is clamped.
    """
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.5
    if number > 1:
        # It was a percentage. A number that small - 5 on a scale of
        # five - is not a percentage of anything; it is a rating, and
        # a rating of five out of five is the whole of the certainty
        # there is. So only a number big enough to be a percentage is
        # treated as one.
        if number >= 10:
            number = number / 100.0
        else:
            number = number / 5.0
    return max(0.0, min(1.0, number))


def _as_dict(raw: str) -> Optional[Dict[str, Any]]:
    """The model's answer, if it is an object."""
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # The model sometimes answers with the object wrapped in a
        # sentence. The first brace to the last one is the object.
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    if not isinstance(data, dict):
        return None
    return data


def capture_product(image_bytes: bytes, timeout: int = 60) -> Optional[CapturedProduct]:
    """
    Read a product out of a picture.

    Returns the draft, or None when the picture could not be read.

    None is an honest answer here. The alternative - a product with a
    price of zero, or a price somebody made up - would end up in the
    shop's catalogue and be sold at.
    """
    if not image_bytes:
        return None

    key = _api_key()
    if not key:
        logger.info("No key for the reading service; the capture is unavailable")
        return None

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": PRODUCT_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": _mime_of(image_bytes),
                            "data": base64.b64encode(image_bytes).decode("utf-8"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
        },
    }

    try:
        request = urllib.request.Request(
            f"{API_URL}?key={key}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))

        candidates = body.get("candidates") or []
        if not candidates:
            logger.warning("The reading service returned no candidates")
            return None
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(part.get("text", "") for part in parts).strip()
        if not text:
            return None

    except Exception as exc:  # noqa: BLE001 - the reading is optional
        logger.warning("The reading of the product failed: %s", exc)
        return None

    data = _as_dict(text)
    if not data:
        logger.warning("The reading service did not answer with an object")
        return None

    name = _clean_name(data.get("name"))
    if not name:
        # Without a name there is no product. The model said it could
        # not tell what it was looking at.
        logger.info("The reading service found no product in the picture")
        return None

    price = _parse_price(data.get("price"))
    warnings: List[str] = []
    if price is None:
        warnings.append(
            "No price could be read from the picture. Enter the price before saving."
        )
    elif price <= 0:
        warnings.append("The price that was read is zero. Check it before saving.")
        price = None

    category = _clean_name(data.get("category")).lower().replace(" ", "_")
    known = {
        "groceries",
        "beverages",
        "snacks",
        "household",
        "personal_care",
        "frozen",
        "bakery",
        "produce",
        "other",
    }
    if category not in known:
        category = "other"

    unit = _clean_name(data.get("unit")).lower()
    if unit not in {"pcs", "kg", "liter", "box", "renceng"}:
        unit = "pcs"

    return CapturedProduct(
        name=name,
        price=price,
        currency=_clean_name(data.get("currency")).upper() or "IDR",
        brand=_clean_name(data.get("brand")) or None,
        category=category,
        unit=unit,
        size=_clean_name(data.get("size")) or None,
        sku=_clean_sku(data.get("sku")),
        confidence=_confidence(data.get("confidence")),
        image_bytes=image_bytes,
        warnings=warnings,
    )
