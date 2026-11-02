"""
The product search, tested.

The search has two answers. When a provider key is set, the answer
comes from outside and the prices are the ones the shop is asking for.
When there is no key, the answer comes from the reader's own
catalogue, and the prices are the reader's own reference prices.

The second case is the one that matters here. A reader without a
provider key should still get a grid of products they can look at,
rather than three links and a shrug. But the prices in that grid are
not the prices in the shop, and the answer has to say so: the
`source` field says where the answer came from, and the fallback
never pretends to have scraped anything.

What is checked here:

- a query gives a non-empty list of results;
- every result has the fields the grid needs;
- every price is a positive number;
- with no provider key, the answer says it came from the local
  catalogue;
- the same query inside the time to live gives back the same answer,
  and the work is not done twice.
"""

import asyncio
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import shopping_search_service as service  # noqa: E402

REQUIRED_FIELDS = (
    "title",
    "image_url",
    "price_idr",
    "original_price",
    "discount_badge",
    "merchant_source",
    "store_name",
    "rating",
    "description_snippet",
    "product_url",
    "source",
)


@pytest.fixture(autouse=True)
def _no_provider_key(monkeypatch):
    """
    No provider key for any of these tests.

    The key is read from the environment every time a search is made,
    so it is taken away here rather than mocked, and the tests that
    want a provider put it back themselves.
    """
    monkeypatch.delenv("SERPAPI_KEY", raising=False)
    service.clear_cache()


def _search(query, **kwargs):
    return asyncio.run(service.search_products(query, **kwargs))


def test_a_query_gives_a_non_empty_list():
    """The grid is not empty."""
    answer = _search("Asus ROG Pro")
    assert answer["results"], "the search gave nothing back"
    assert answer["count"] == len(answer["results"])


def test_the_answer_says_what_the_query_was():
    """The answer carries the query back."""
    answer = _search("Asus ROG Pro")
    assert answer["query"] == "Asus ROG Pro"


def test_every_result_has_the_fields_the_grid_needs():
    """Each result is complete."""
    answer = _search("Asus ROG Pro")
    for result in answer["results"]:
        for field in REQUIRED_FIELDS:
            assert field in result, f"{field} is missing from a result"
        assert result["title"], "a result has no title"
        assert result["image_url"], "a result has no picture"
        assert result["merchant_source"], "a result has no shop"
        assert result["product_url"], "a result has no link"


def test_every_price_is_a_positive_number():
    """A price of zero, or of nothing at all, is not a price."""
    answer = _search("Asus ROG Pro")
    for result in answer["results"]:
        assert isinstance(result["price_idr"], (int, float))
        assert result["price_idr"] > 0
        assert result["original_price"] is None or result["original_price"] > 0


def test_the_local_catalogue_is_used_when_there_is_no_provider_key():
    """
    With no key, the answer says where it came from.

    This is the honesty check. A price that is the reader's own
    reference price must not be presented as the price in the shop.
    """
    answer = _search("Asus ROG Pro")
    assert answer["source"] == "local_catalog"
    for result in answer["results"]:
        assert result["source"] == "local_catalog"


def test_the_cache_gives_the_same_answer_for_the_same_query():
    """The second search is the first search, and no work is done again."""
    first = _search("Asus ROG Pro")
    second = _search("Asus ROG Pro")
    assert second == first
    assert second is first, "the cached answer was copied instead of kept"


def test_a_different_query_is_not_the_cached_answer():
    """The cache is keyed by the query."""
    first = _search("Asus ROG Pro")
    second = _search("Kopi Kapal Api")
    assert first is not second


def test_the_cache_expires():
    """An answer that has been in the cache too long is made again."""
    service.clear_cache()
    service.CACHE_TTL_SECONDS = 0
    try:
        first = _search("Asus ROG Pro")
        second = _search("Asus ROG Pro")
        assert first is not second
    finally:
        service.CACHE_TTL_SECONDS = 300


def test_an_empty_query_is_refused():
    """There is nothing to look for."""
    with pytest.raises(ValueError):
        _search("   ")


def test_the_limit_is_obeyed():
    """The grid is not bigger than it was asked to be."""
    answer = _search("Asus ROG Pro", limit=3)
    assert len(answer["results"]) <= 3
