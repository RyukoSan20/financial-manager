"""
Make the receipt reading never fail silently.

The receipt scanner had three readers: the local OCR engine, the vision
model, and the browser's own OCR. When all three failed - a blurred
photograph, a reader without a key for the vision model, a deployment
where the model is unreachable - the screen said "the scan failed" and
the purchase was lost.

This module is the last reader. It works on the plain text of a
receipt, needs no key and no model, and always answers with something
the reader can correct.

The shape of the answer is always the same, whatever produced it:
the shop, the day, the total, the lines of the bill, the way it was
paid, and the place. Every field is present. A field that could not
be found is empty rather than missing, because a screen that has to
check whether a key is there is a screen that will eventually show
nothing at all.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def structured_fallback(
    raw_text: Optional[str] = None,
    lines: Optional[List[str]] = None,
    partial: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    The reading, from whatever text there is.

    The partial reading - what the other readers managed - is folded in
    first, and this reading fills in the gaps. A reader that got the
    shop but not the lines keeps the shop.
    """
    from app.services.receipt_fallback import ensure_receipt_shape, read_receipt_text

    text = raw_text or ""
    if not text and lines:
        text = "\n".join(lines)

    try:
        reading = read_receipt_text(text)
    except Exception as exc:  # noqa: BLE001 - the fallback must not fail
        logger.warning("The structured receipt fallback failed: %s", exc)
        reading = {
            "merchant_name": None,
            "date": None,
            "total_amount": 0.0,
            "items": [],
            "payment_method": None,
            "location": None,
            "raw_text": text[:5000],
            "raw_lines": list(lines or []),
            "parse_method": "structured_fallback",
            "confidence": 0.2,
        }

    # The partial reading wins where it has something. It came from a
    # reader that could see the receipt.
    if partial:
        for key in ("merchant_name", "date", "payment_method", "location"):
            if partial.get(key):
                reading[key] = partial[key]
        if partial.get("total_amount"):
            try:
                if float(partial["total_amount"]) > 0:
                    reading["total_amount"] = float(partial["total_amount"])
            except (TypeError, ValueError):
                pass
        if partial.get("items"):
            reading["items"] = partial["items"]
        if partial.get("raw_text") and not reading.get("raw_text"):
            reading["raw_text"] = partial["raw_text"]

    shaped = ensure_receipt_shape(reading)
    shaped["fallback_used"] = True
    return shaped


def merge_receipt_readings(
    primary: Optional[Dict[str, Any]],
    raw_text: Optional[str] = None,
    lines: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    The best reading that can be made.

    The primary reading - the vision model, or the local engine - is
    used when it has a merchant and a total. When it does not, the
    fallback reads the text and fills in what is missing.

    The result always has every field, so the screen never has to
    check whether a key is there.
    """
    from app.services.receipt_fallback import ensure_receipt_shape

    if not primary:
        return structured_fallback(raw_text=raw_text, lines=lines)

    shaped = ensure_receipt_shape(primary)

    has_merchant = bool(shaped.get("merchant_name"))
    has_total = float(shaped.get("total_amount") or 0) > 0
    has_items = bool(shaped.get("items"))

    if has_merchant and has_total and has_items:
        shaped["fallback_used"] = False
        return shaped

    # Something is missing. The fallback reads the text and fills in
    # the gaps, but the reading that has something is not thrown away.
    fallback = structured_fallback(raw_text=raw_text, lines=lines, partial=shaped)
    fallback["fallback_used"] = True
    return fallback


__all__ = ["structured_fallback", "merge_receipt_readings"]
