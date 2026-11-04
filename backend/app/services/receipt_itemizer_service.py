"""
The itemised receipt, and the arithmetic that goes with it.

A receipt is more than one number. It is a list of lines, each with a
price, and the reader often wants to say what each line really was: the
AYAM PANGGANG and the NASI are food, and the RED VELVET LATTE is a
drink, even though they arrived on the same piece of paper. So the
lines of a receipt have to be able to carry a category of their own.

The money on a receipt has three parts and they do not add up on their
own:

    subtotal - discount + tax = net

The discount and the tax are written on the receipt as one number each,
but they belong to the lines underneath them. This service shares them
out over the lines in proportion to what each line is worth, using the
largest-remainder method, so that the parts add up to exactly the
whole. No rupiah is lost and no rupiah is invented.

Rounding is done in cents, and the leftover cents are handed to the
lines with the biggest fraction left over. That is what makes the sum
of the parts exactly the sum that was split.
"""

import logging
from decimal import Decimal, ROUND_DOWN
from typing import Any, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)

# The category the catalog falls back to when it recognises nothing.
# It is not a category, it is the absence of one, so a line that lands
# there is left without a category rather than given a wrong one.
NO_CATEGORY_NAMES = {"lain-lain", "other", "lain lain", "other (expense)"}

# The smallest amount that is still a cent.
CENT = Decimal("0.01")


def _to_decimal(value: Any) -> Decimal:
    """
    Read a number as money.

    Anything that is not a number is read as zero, so a line with a
    missing price does not stop the whole receipt from being worked
    out.
    """
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001 - any rubbish is worth zero
        return Decimal("0")


def _money(value: Decimal) -> Decimal:
    """Round to the nearest cent, without going below zero for a negative."""
    return value.quantize(CENT)


def _item_name(item: Any) -> str:
    """The name of a line, whichever key it is written under."""
    if isinstance(item, dict):
        for key in ("name", "raw_name", "canonical_name"):
            value = item.get(key)
            if value:
                return str(value)
        return ""
    for key in ("raw_name", "canonical_name", "name"):
        value = getattr(item, key, None)
        if value:
            return str(value)
    return ""


def _item_total(item: Any) -> Decimal:
    """
    What a line is worth.

    The total that was read from the receipt is used when it is there,
    and the count times the price of one is used when it is not.
    """
    if isinstance(item, dict):
        total = item.get("total_price")
        if total is None:
            total = item.get("total")
        quantity = item.get("quantity")
        unit = item.get("price_per_unit")
        if unit is None:
            unit = item.get("unit_price")
    else:
        total = getattr(item, "total_price", None)
        quantity = getattr(item, "quantity", None)
        unit = getattr(item, "price_per_unit", None)

    if total is not None and _to_decimal(total) != 0:
        return _to_decimal(total)

    count = _to_decimal(quantity if quantity is not None else 1)
    price = _to_decimal(unit)
    return _money(count * price)


def _category_names(category: Any) -> List[str]:
    """Every spelling of a category, in the three languages."""
    if category is None:
        return []
    if isinstance(category, str):
        return [category]
    names = []
    for key in ("name", "name_en", "name_ja"):
        value = (
            category.get(key)
            if isinstance(category, dict)
            else getattr(category, key, None)
        )
        if value:
            names.append(str(value))
    return names


def _find_category(catalog_category: str, categories: Iterable[Any]) -> Optional[Any]:
    """
    Find the reader's own category that the catalog category means.

    The catalog speaks in its own names, and the reader has their own
    categories. The two are put together by name, in any of the three
    languages the application is used in. When there is no such
    category the reader has not got one, and nothing is guessed.
    """
    if not catalog_category:
        return None

    wanted = {catalog_category.strip().lower()}
    for candidate in categories:
        for name in _category_names(candidate):
            if name.strip().lower() in wanted:
                return candidate
    return None


def categorize_items(
    items: List[Dict[str, Any]],
    categories: Optional[List[Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Give each line of a receipt a category, where one can be found.

    The catalog matcher is asked about the name of the line. When it
    recognises the line, and the reader has a category that means the
    same thing, the line is given that category and the confidence of
    the match.

    When the matcher recognises nothing, the line is left without a
    category. A wrong category is worse than no category: it sends the
    money into a place it does not belong, and the reader has to find
    it and move it back.

    The lines are not changed. A copy of each line is returned with the
    category on it, so the caller can decide what to do with it.
    """
    categories = list(categories or [])
    matcher = _matcher()

    result: List[Dict[str, Any]] = []
    for item in items or []:
        line: Dict[str, Any] = (
            dict(item) if isinstance(item, dict) else {"name": _item_name(item)}
        )
        name = _item_name(item)

        category = None
        confidence = 0.0

        if matcher is not None and name:
            try:
                match = matcher.match(name)
            except Exception as exc:  # noqa: BLE001 - a matcher must not break the page
                logger.warning("The catalog could not be asked about %r: %s", name, exc)
                match = {}

            catalog_category = (match or {}).get("category") or ""
            if catalog_category.strip().lower() not in NO_CATEGORY_NAMES:
                found = _find_category(catalog_category, categories)
                if found is not None:
                    category = found
                    confidence = float((match or {}).get("confidence") or 0)

        line["category"] = category
        line["confidence"] = confidence
        result.append(line)

    return result


def _matcher():
    """The catalog matcher, if it can be loaded at all."""
    try:
        from app.services.catalog_service import catalog_matcher

        return catalog_matcher
    except Exception as exc:  # noqa: BLE001 - the matcher is optional
        logger.warning("The catalog matcher is not available: %s", exc)
        return None


def _weights(items: List[Any]) -> List[int]:
    """
    How much each line is worth, as whole cents.

    The weight of a line is its share of the subtotal. When every line
    is worth nothing the lines are weighted equally, so a receipt of
    lines with no prices still has a discount shared fairly rather
    than all of it landing on the first line.
    """
    totals = [_to_decimal(_item_total(item)) for item in items]
    positive = [t for t in totals if t > 0]

    if not positive:
        if not items:
            return []
        return [1] * len(items)

    cents = [int((t * 100).to_integral_value(rounding=ROUND_DOWN)) for t in totals]
    if sum(cents) <= 0:
        return [1] * len(items)
    return cents


def _allocate(total: Decimal, weights: List[int]) -> List[Decimal]:
    """
    Share one amount over the lines in proportion to their weights.

    The largest-remainder method: every line gets the whole part of its
    share, and the cents that are left over are handed to the lines
    with the biggest fraction left over. So the parts add up to exactly
    the amount that was shared, and not one cent of it is lost or
    made up.
    """
    if not weights:
        return []

    target = int((_money(total) * 100).to_integral_value(rounding=ROUND_DOWN))
    weight_sum = sum(weights)

    if weight_sum <= 0:
        weights = [1] * len(weights)
        weight_sum = len(weights)

    shares: List[int] = []
    remainders: List[int] = []
    for weight in weights:
        exact = target * weight
        whole = exact // weight_sum
        shares.append(whole)
        remainders.append(exact - whole * weight_sum)

    leftover = target - sum(shares)

    # The lines with the biggest fraction left over get the leftover
    # cents, one each, and the first line wins a tie.
    order = sorted(
        range(len(weights)),
        key=lambda index: (-remainders[index], index),
    )
    for step in range(leftover):
        shares[order[step % len(order)]] += 1

    return [_money(Decimal(cents) / Decimal(100)) for cents in shares]


def allocate_totals(
    items: List[Any],
    subtotal: Any = None,
    discount_total: Any = None,
    tax_total: Any = None,
) -> List[Dict[str, Any]]:
    """
    Give every line of a receipt its share of the discount and the tax.

    The discount and the tax are shared out over the lines in
    proportion to what each line is worth. Each line is returned with
    the share that was worked out for it.

    The subtotal is only used when the lines do not add up to one, and
    then it is used as the weight of the lines, so that a receipt whose
    lines were read badly is still shared fairly.
    """
    items = list(items or [])
    discount = _to_decimal(discount_total)
    tax = _to_decimal(tax_total)

    weights = _weights(items)

    # When the lines do not make up the subtotal, the subtotal is the
    # better weight: it is the number the receipt itself carries.
    if subtotal is not None:
        subtotal_decimal = _to_decimal(subtotal)
        line_sum = sum(_to_decimal(_item_total(item)) for item in items)
        if subtotal_decimal > 0 and line_sum <= 0:
            weights = [1] * len(items)

    discount_shares = _allocate(discount, weights)
    tax_shares = _allocate(tax, weights)

    result: List[Dict[str, Any]] = []
    for index, item in enumerate(items):
        line: Dict[str, Any] = (
            dict(item) if isinstance(item, dict) else {"name": _item_name(item)}
        )
        discount_share = discount_shares[index] if index < len(discount_shares) else Decimal("0")
        tax_share = tax_shares[index] if index < len(tax_shares) else Decimal("0")

        line["allocated_discount"] = discount_share
        line["allocated_tax"] = tax_share
        line["net_total"] = _money(
            _to_decimal(_item_total(item)) - discount_share + tax_share
        )
        result.append(line)

    return result


def compute_net_total(
    items: List[Any],
    discount_total: Any = None,
    tax_total: Any = None,
    subtotal: Any = None,
) -> Decimal:
    """
    What the customer actually paid.

    The subtotal, less the discount, plus the tax. When the subtotal is
    not given it is worked out from the lines.
    """
    discount = _to_decimal(discount_total)
    tax = _to_decimal(tax_total)

    if subtotal is None:
        subtotal_value = sum(
            (_to_decimal(_item_total(item)) for item in (items or [])), Decimal("0")
        )
    else:
        subtotal_value = _to_decimal(subtotal)

    return _money(subtotal_value - discount + tax)
