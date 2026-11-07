"""
Looking for a product, and being honest about where the answer came from.

A reader types "Asus ROG Pro" and expects a grid of things they can look
at: a picture, a shop, a price, a rating. There are two ways this
application can answer that, and they are not the same kind of answer.

**The provider.** When a search provider key is in the environment
(`SERPAPI_KEY`), the answer is fetched from outside and the prices are
the ones the shops are asking for at that moment. The results carry
`source: "provider"`.

**The reader's own catalogue.** When there is no key - which is the
ordinary case, because this application does not ask anybody to pay for
a search API - the answer is built from what this reader already
knows: the products they have bought (`UserProduct`), the shared
catalogue (`ProductCatalog`), the shops they spend money at
(`MerchantCatalog`), and the built-in catalogue of common products.
The prices are the reader's own reference prices, learned from their
receipts. The results carry `source: "local_catalog"`.

That second answer is **not** a live price. A reader who sees
"Rp2.450.000" here is seeing what they paid last time, not what the
shop is charging today. So the answer says so, in three places:

- the top level `source` field;
- the `price_basis` field on each result, which says where the number
  came from (`user_catalog`, `catalog_typical`, `catalog_median`,
  `catalog_default`);
- the `is_live_price` field on each result, which is false for
  everything the catalogue produced.

Nothing here claims to have scraped a shop it did not scrape. If the
provider is configured but the call fails, the answer is the
catalogue's, with the same flag, rather than a made-up price.

Pictures are drawn rather than downloaded. The local answer gives each
result a small SVG card, drawn from the product's own name, so the
grid has something real in it without the application fetching
anything from a shop it has no account with.

The results are kept for five minutes in a small dictionary in this
process. It is not a shared cache: two workers each keep their own,
and that is fine, because the thing being cached is cheap to make.

Nothing here writes to the database.
"""

from __future__ import annotations

import hashlib
import os
import re
import statistics
import time
import urllib.parse
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

# The shops the reader can be sent to. The names are the ones the
# interface already uses elsewhere, so a card says the same thing the
# search page says.
MARKETPLACES: Tuple[Dict[str, str], ...] = (
    {
        "id": "Shopee",
        "search_url": "https://shopee.co.id/search?keyword={query}",
        "color": "#EE4D2D",
    },
    {
        "id": "Tokopedia",
        "search_url": "https://www.tokopedia.com/search?st=product&q={query}",
        "color": "#42A341",
    },
    {
        "id": "Lazada",
        "search_url": "https://www.lazada.co.id/catalog/?q={query}",
        "color": "#0F1472",
    },
    {
        "id": "Blibli",
        "search_url": "https://www.blibli.com/search/{query}",
        "color": "#E4002B",
    },
)

# How long an answer is kept. Five minutes is long enough that a
# reader flipping between two pages does not pay twice, and short
# enough that the catalogue underneath is not stale for long.
CACHE_TTL_SECONDS = 300

# The answer when there is nothing in the catalogue to go on. It is a
# round number and it is honest about being a placeholder: the
# `price_basis` of such a result is `catalog_default`, which says
# there was no reference price at all.
DEFAULT_REFERENCE_PRICE_IDR = 100000

# The name of the environment variable that turns the provider on.
PROVIDER_KEY_ENV = "SERPAPI_KEY"

# The provider's endpoint. It is written down here rather than being
# read from the environment, because there is only one of it.
PROVIDER_URL = "https://serpapi.com/search.json"

# The answers that are being kept.
_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}


# ---------------------------------------------------------------------------
# The cache
# ---------------------------------------------------------------------------


def _cache_key(query: str, limit: int, user_id: Optional[int]) -> str:
    """What an answer is filed under."""
    raw = f"{query.strip().lower()}|{limit}|{user_id}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def clear_cache() -> None:
    """Throw the kept answers away."""
    _cache.clear()


def _from_cache(key: str) -> Optional[Dict[str, Any]]:
    """The kept answer, if it is still fresh."""
    entry = _cache.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if expires_at <= time.monotonic():
        _cache.pop(key, None)
        return None
    return value


def _to_cache(key: str, value: Dict[str, Any]) -> None:
    """Keep an answer for a while."""
    _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, value)


# ---------------------------------------------------------------------------
# The text
# ---------------------------------------------------------------------------

_WORD = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> List[str]:
    """The words of a piece of text, in lower case."""
    return _WORD.findall((text or "").lower())


def _normalise(query: str) -> str:
    """A query, trimmed and squashed."""
    return " ".join((query or "").split())


def _title_of(text: str) -> str:
    """A name, with the first letter of every word capitalised."""
    words = (text or "").split()
    return " ".join(word[:1].upper() + word[1:] for word in words)


# ---------------------------------------------------------------------------
# The money
# ---------------------------------------------------------------------------


def _to_number(value: Any) -> Optional[float]:
    """A number of money, from whatever it was written as."""
    if value is None:
        return None
    if isinstance(value, (int, float, Decimal)):
        try:
            return float(value)
        except (TypeError, ValueError, InvalidOperation):
            return None
    text = str(value).strip()
    if not text:
        return None
    # "Rp1.234.567", "1.234.567", "Rp 1.234.567,00"
    cleaned = re.sub(r"[^\d.,]", "", text)
    if not cleaned:
        return None
    if "," in cleaned and "." in cleaned:
        # The one with the right-most separator is the decimal one.
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    else:
        if "," in cleaned:
            cleaned = cleaned.replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _rounded_idr(value: float) -> int:
    """A price, in rupiah, rounded to a whole one."""
    return int(round(value))


def _discount_badge(price: Optional[float], original: Optional[float]) -> Optional[str]:
    """How much is off, as a badge, when there is an original price."""
    if not price or not original or original <= price:
        return None
    percent = int(round((original - price) / original * 100))
    if percent <= 0:
        return None
    return f"-{percent}%"


# ---------------------------------------------------------------------------
# The picture
# ---------------------------------------------------------------------------

_PICTURE_COLOURS = (
    "#0f172a",
    "#1e3a5f",
    "#0f766e",
    "#7c2d12",
    "#4c1d95",
    "#134e4a",
    "#831843",
    "#1e40af",
)


def _picture(title: str, colour: str) -> str:
    """
    A small card for the product, drawn from its own name.

    It is an SVG, so it is sharp on any screen, and it is a data
    address, so the grid has something to show without the
    application asking a shop for a picture it may not be given.
    """
    letters = "".join(part[0] for part in _tokens(title)[:2]).upper() or "?"
    safe_title = (
        (title or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" '
        'width="240" height="240" role="img" aria-label="{label}">'
        '<rect width="240" height="240" rx="20" fill="{colour}"/>'
        '<text x="120" y="128" text-anchor="middle" font-family="system-ui, '
        'sans-serif" font-size="76" font-weight="700" fill="#f8fafc">'
        "{letters}</text>"
        '<text x="120" y="172" text-anchor="middle" font-family="system-ui, '
        'sans-serif" font-size="16" fill="#cbd5e1">{safe}</text>'
        "</svg>"
    ).format(
        label=safe_title[:60],
        colour=colour,
        letters=letters,
        safe=safe_title[:28],
    )
    encoded = urllib.parse.quote(svg, safe="")
    return f"data:image/svg+xml;charset=utf-8,{encoded}"


def _colour_for(seed: str) -> str:
    """The colour of the card for this product."""
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return _PICTURE_COLOURS[digest[0] % len(_PICTURE_COLOURS)]


# ---------------------------------------------------------------------------
# The provider
# ---------------------------------------------------------------------------


def provider_key() -> str:
    """The provider key, if the server has one."""
    return (os.getenv(PROVIDER_KEY_ENV) or "").strip()


def _merchant_from_link(link: str) -> Optional[str]:
    """The shop a link points at, when it is one of ours."""
    lowered = (link or "").lower()
    for market in MARKETPLACES:
        name = market["id"].lower()
        if name in lowered:
            return market["id"]
    if "shopee" in lowered:
        return "Shopee"
    if "tokopedia" in lowered:
        return "Tokopedia"
    if "lazada" in lowered:
        return "Lazada"
    if "blibli" in lowered:
        return "Blibli"
    return None


async def _provider_results(query: str, limit: int) -> Optional[List[Dict[str, Any]]]:
    """
    The answer from outside, if the server is allowed to ask.

    Returns nothing when there is no key, and nothing when the call
    fails. The caller then uses the reader's own catalogue, which is
    an honest answer, rather than a made-up one.
    """
    key = provider_key()
    if not key:
        return None

    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": key,
        "gl": "id",
        "hl": "id",
        "num": str(max(1, min(limit, 40))),
    }
    url = f"{PROVIDER_URL}?{urllib.parse.urlencode(params)}"

    try:
        import httpx

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json()
    except Exception:  # noqa: BLE001 - the provider is a convenience
        return None

    raw = payload.get("shopping_results")
    if not isinstance(raw, list):
        return None

    results: List[Dict[str, Any]] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or "").strip()
        if not title:
            continue
        link = str(entry.get("link") or "").strip()
        price = _to_number(entry.get("price"))
        original = _to_number(entry.get("original_price"))
        if not price:
            continue

        source = str(entry.get("source") or "").strip()
        merchant = _merchant_from_link(link) or source or "Shopee"

        results.append(
            {
                "title": title,
                "image_url": str(entry.get("thumbnail") or "").strip(),
                "price_idr": _rounded_idr(price),
                "original_price": _rounded_idr(original) if original else None,
                "discount_badge": _discount_badge(price, original),
                "merchant_source": merchant,
                "store_name": source or merchant,
                "rating": _to_number(entry.get("rating")),
                "description_snippet": str(entry.get("description") or "").strip(),
                "product_url": link,
                "source": "provider",
                "is_live_price": True,
                "price_basis": "provider",
            }
        )
        if len(results) >= limit:
            break

    return results or None


# ---------------------------------------------------------------------------
# The reader's own catalogue
# ---------------------------------------------------------------------------


def _built_in_catalogue() -> List[Dict[str, Any]]:
    """The catalogue of common products that ships with the application."""
    try:
        from app.services.catalog_service import MASTER_CATALOG
    except Exception:  # noqa: BLE001 - the catalogue is a convenience
        return []

    entries = []
    for row in MASTER_CATALOG:
        name = str(row.get("canonical_name") or "").strip()
        if not name:
            continue
        entries.append(
            {
                "title": name,
                "category": row.get("category") or "",
                "price": None,
                "basis": "catalog_default",
                "store": None,
                "owner": "built_in",
            }
        )
    return entries


def _database_catalogue(user_id: Optional[int]) -> List[Dict[str, Any]]:
    """
    What this reader's own database knows.

    Every part of this is optional. A reader whose database has not
    been migrated yet, or whose product table is empty, still gets an
    answer: the parts that are missing are simply skipped.
    """
    entries: List[Dict[str, Any]] = []

    try:
        from app.core.database import SessionLocal
    except Exception:  # noqa: BLE001
        return entries

    session = None
    try:
        session = SessionLocal()

        try:
            from app.models.receipt import ProductCatalog

            rows = session.query(ProductCatalog).limit(300).all()
            for row in rows:
                name = str(row.canonical_name or "").strip()
                if not name:
                    continue
                entries.append(
                    {
                        "title": name,
                        "category": row.category or "",
                        "price": _to_number(row.typical_price),
                        "basis": "catalog_typical",
                        "store": None,
                        "owner": "catalog",
                    }
                )
        except Exception:  # noqa: BLE001
            pass

        if user_id is not None:
            try:
                from app.models.merchant_catalog import UserProduct

                rows = (
                    session.query(UserProduct)
                    .filter(UserProduct.user_id == user_id)
                    .limit(300)
                    .all()
                )
                for row in rows:
                    name = str(row.canonical_name or row.name or "").strip()
                    if not name:
                        continue
                    store = None
                    try:
                        if row.merchant is not None:
                            store = str(row.merchant.name or "").strip() or None
                    except Exception:  # noqa: BLE001
                        store = None
                    entries.append(
                        {
                            "title": name,
                            "category": row.category or "",
                            "price": _to_number(row.typical_price),
                            "basis": "user_catalog",
                            "store": store,
                            "owner": "user",
                        }
                    )
            except Exception:  # noqa: BLE001
                pass
    except Exception:  # noqa: BLE001
        entries = []
    finally:
        if session is not None:
            try:
                session.close()
            except Exception:  # noqa: BLE001
                pass

    return entries


def _score(entry: Dict[str, Any], query_tokens: List[str]) -> int:
    """
    How well an entry answers the query.

    The count of the query's words that appear in the product's name,
    with a bonus when the whole phrase is there.
    """
    title_tokens = set(_tokens(entry.get("title", "")))
    if not title_tokens:
        return 0

    score = sum(1 for token in query_tokens if token in title_tokens)
    phrase = " ".join(query_tokens)
    if phrase and phrase in entry.get("title", "").lower():
        score += 3
    return score


def _median_price(entries: List[Dict[str, Any]]) -> Optional[float]:
    """The middle of the prices the catalogue knows."""
    prices = [
        entry["price"]
        for entry in entries
        if entry.get("price") and entry["price"] > 0
    ]
    if not prices:
        return None
    return statistics.median(prices)


def _market_for(seed: str) -> Dict[str, str]:
    """The shop a product is shown at, chosen by the product's name."""
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return MARKETPLACES[digest[0] % len(MARKETPLACES)]


def _search_url(market: Dict[str, str], query: str) -> str:
    """The shop's own search page for this query."""
    return market["search_url"].format(query=urllib.parse.quote(query))


def _local_result(
    title: str,
    price: float,
    basis: str,
    market: Dict[str, str],
    store: Optional[str],
    query: str,
    category: str = "",
    description: str = "",
) -> Dict[str, Any]:
    """One card of the grid, built from the reader's own catalogue."""
    price_idr = _rounded_idr(max(price, 1))
    colour = _colour_for(f"{title}|{market['id']}")
    merchant = market["id"]
    store_name = store or merchant

    # The description of a product, if there is one.
    #
    # When there is no description, there is nothing here. The card
    # says where the price came from in words of the reader's own
    # language, and that sentence is written by the client from the
    # basis below. The server used to write the sentence itself, in
    # English, which put English on an Indonesian page.
    snippet = description

    return {
        "title": title,
        "image_url": _picture(title, colour),
        "price_idr": price_idr,
        "original_price": None,
        "discount_badge": None,
        "merchant_source": merchant,
        "store_name": store_name,
        "rating": None,
        "description_snippet": snippet,
        "product_url": _search_url(market, query),
        "source": "local_catalog",
        "is_live_price": False,
        "price_basis": basis,
    }


def _local_results(
    query: str, user_id: Optional[int], limit: int
) -> List[Dict[str, Any]]:
    """
    The answer, built from what the reader already knows.

    The order is: the products whose names answer the query, then the
    query itself at each shop. The second part is what makes the grid
    useful for a product the reader has never bought: it shows the
    name they asked for, at the shops they would look at, with the
    reader's own reference price where there is one.
    """
    entries = _database_catalogue(user_id) + _built_in_catalogue()
    query_tokens = _tokens(query)

    scored = []
    for entry in entries:
        score = _score(entry, query_tokens)
        if score > 0:
            scored.append((score, entry))
    scored.sort(key=lambda pair: (-pair[0], pair[1]["title"]))

    median = _median_price(entries)
    fallback_price = median if median else float(DEFAULT_REFERENCE_PRICE_IDR)

    results: List[Dict[str, Any]] = []
    seen_titles = set()

    for _score_value, entry in scored:
        if len(results) >= limit:
            break
        title = entry["title"]
        if title in seen_titles:
            continue
        seen_titles.add(title)
        price = entry.get("price") or fallback_price
        basis = entry.get("basis") or "catalog_default"
        if not entry.get("price"):
            basis = "catalog_median" if median else "catalog_default"
        market = _market_for(title)
        results.append(
            _local_result(
                title=title,
                price=price,
                basis=basis,
                market=market,
                store=entry.get("store"),
                query=query,
                category=entry.get("category", ""),
            )
        )

    # Nothing in the reader's own catalogue answers the query.
    #
    # The old answer was the query itself at each shop, priced at the
    # median of every price in the catalogue. The catalogue is mostly
    # food and household goods, so that median is about four thousand
    # rupiah, and a search for a laptop came back priced at four
    # thousand rupiah. It was a false price, shown as confidently as
    # a real one, and it filled one card of a wide grid.
    #
    # So the answer is now the things that would actually be sold for
    # this query, at prices worked out from the kind of thing it is.
    # Those prices are estimates and the cards say so.
    # The band of prices the reader's own catalogue knows about. When
    # the catalogue has prices, they are the best answer there is to
    # what this kind of thing costs.
    catalogue_band = None
    if median:
        catalogue_band = (
            max(1, int(median * 0.4)),
            int(median * 2.5),
        )

    if not results:
        return _market_results(query, limit, catalogue_band)

    # The reader's catalogue answered.
    #
    # The grid is not topped up with guesses. A reader who searched
    # for noodles and got eight cards of noodles, priced from the
    # kind of thing rather than from the market, would be shown prices
    # a thousand times too high. A short grid of real things is
    # better than a full grid of invented ones.
    #
    # But when the catalogue answered with only one or two things, and
    # the query is plainly about something else, the market answers
    # instead. A laptop searched among a catalogue of instant noodles
    # deserves a laptop.
    if len(results) < 3 and _query_is_about_something_else(query, entries):
        return _market_results(query, limit, catalogue_band)

    return results[:limit]


def _query_is_about_something_else(
    query: str, entries: List[Dict[str, Any]]
) -> bool:
    """
    Whether the things the catalogue answered with are the wrong kind
    of thing.

    The catalogue holds food and household goods. A search for a
    laptop matches nothing, and a search for noodles matches a packet
    of noodles. The test is whether the words of the query are in the
    names of the things that matched: if they are, the catalogue
    answered the question that was asked.
    """
    query_tokens = set(_tokens(query))
    if not query_tokens:
        return False

    matched = []
    for entry in entries:
        if _score(entry, list(query_tokens)) > 0:
            matched.append(entry)
    if not matched:
        return True

    # Every word of the query should be in the name of something that
    # matched. "Indomie Goreng" matches "Indomie Goreng", so both
    # words are there.
    for token in query_tokens:
        if not any(token in _tokens(entry.get("title", "")) for entry in matched):
            return True
    return False


def _market_results(
    query: str,
    limit: int,
    catalogue_band: Optional[Tuple[int, int]] = None,
) -> List[Dict[str, Any]]:
    """
    The things that would be sold, for a search the reader's own
    catalogue cannot answer.

    The prices here are worked out from the kind of thing that was
    asked for. They are estimates, and the answer says so; they are
    never presented as the price a shop is asking.

    The band is the reader's own, when their catalogue knows about
    this kind of thing. A reader who searches for noodles should be
    shown noodles at the price noodles cost, and their own receipts
    are the best answer there is to what that is.
    """
    from app.services.shopping_market_catalogue import build_market_results

    markets = [
        {"id": m["id"], "search_url": m["search_url"], "color": m["color"]}
        for m in MARKETPLACES
    ]
    return build_market_results(
        query, markets, limit=limit, catalogue_band=catalogue_band
    )


# ---------------------------------------------------------------------------
# The search
# ---------------------------------------------------------------------------


async def search_products(
    query: str,
    user_id: Optional[int] = None,
    limit: int = 24,
) -> Dict[str, Any]:
    """
    Look for a product.

    The answer is a dictionary with the query, the results, how many
    there are, and where they came from. The `source` is either
    `"provider"` (the answer was fetched from outside and the prices
    are live) or `"local_catalog"` (the answer was built from the
    reader's own catalogue and the prices are their own reference
    prices).

    An empty query is refused: there is nothing to look for.
    """
    cleaned = _normalise(query)
    if not cleaned:
        raise ValueError("the query is empty")

    limit = max(1, min(int(limit or 24), 60))

    key = _cache_key(cleaned, limit, user_id)
    cached = _from_cache(key)
    if cached is not None:
        return cached

    results = await _provider_results(cleaned, limit)
    source = "provider"
    if not results:
        results = _local_results(cleaned, user_id, limit)
        source = "local_catalog"

    answer = {
        "query": cleaned,
        "results": results,
        "count": len(results),
        "source": source,
        "searched_at": datetime.utcnow().isoformat(),
        # Which kind of answer this is, as a code. The sentence that
        # tells the reader is written by the client, in their own
        # language.
        "price_source": source,
    }

    _to_cache(key, answer)
    return answer
