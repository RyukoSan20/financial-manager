"""
A search for something the reader does not keep must not lie about
what it costs.

Searching for "Asus Rog" used to come back with one card priced
Rp 4.500. That was the median price of the *entire* catalogue, which
is mostly food and household goods. A gaming laptop priced at four
thousand rupiah is not a small mistake; it is a false price, and it
was shown with the same confidence as a real one.

So:

- a price from the reader's own catalogue is only shown when the item
  genuinely answers the query;
- when nothing in the catalogue answers the query, the answer is a
  grid of the things that would be sold, at prices that suit the kind
  of thing, and the answer says those prices are estimates;
- the same query always gives the same prices.
"""

import asyncio
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import shopping_search_service as service  # noqa: E402


@pytest.fixture(autouse=True)
def _no_provider_key(monkeypatch):
    monkeypatch.delenv("SERPAPI_KEY", raising=False)
    service.clear_cache()


def _search(query, **kwargs):
    return asyncio.run(service.search_products(query, **kwargs))


def test_a_laptop_is_not_priced_at_four_thousand_rupiah():
    """The whole point. A laptop does not cost what a noodle packet costs."""
    answer = _search("Asus Rog")
    for result in answer["results"]:
        assert result["price_idr"] > 1_000_000, (
            f"{result['title']!r} was priced at Rp {result['price_idr']:,}, "
            "which is not the price of a laptop"
        )


def test_the_search_gives_a_grid_of_things_not_one_card():
    """One card in a wide row leaves most of the page empty."""
    answer = _search("Asus Rog")
    assert len(answer["results"]) >= 6, (
        f"the search gave {len(answer['results'])} cards; the grid wants at least six"
    )


def test_the_cards_are_from_several_shops():
    """The grid is a grid of shops, not one shop six times."""
    answer = _search("Asus Rog")
    shops = {result["merchant_source"] for result in answer["results"]}
    assert len(shops) >= 3, f"the cards came from only {shops}"


def test_the_price_says_it_is_an_estimate():
    """A price that was worked out must not be passed off as a shop price."""
    answer = _search("Asus Rog")
    for result in answer["results"]:
        assert result["price_basis"] == "market_estimate", (
            f"{result['title']!r} does not say its price is an estimate"
        )
        assert result["is_live_price"] is False


def test_the_same_query_always_gives_the_same_prices():
    """The reader must not see a different price each time they type."""
    service.clear_cache()
    first = _search("Asus Rog")
    second = _search("Asus Rog")
    assert [r["price_idr"] for r in first["results"]] == [
        r["price_idr"] for r in second["results"]
    ]


def test_a_known_product_keeps_its_real_price():
    """A known product has a real price, and it is kept."""
    answer = _search("ROG Strix Scar 17")
    prices = [r["price_idr"] for r in answer["results"]]
    assert prices, "the search gave nothing"
    assert min(prices) > 20_000_000, (
        f"a ROG Strix Scar 17 was priced at {min(prices):,}"
    )


def test_a_food_query_still_answers_from_the_reader_own_catalogue():
    """
    The reader's own catalogue still answers, for the things it knows.

    Nothing here changes the honest case: a price the reader learned
    from their own receipts is a reference price, and it says so.
    """
    answer = _search("Indomie Goreng")
    assert answer["source"] == "local_catalog"
    for result in answer["results"]:
        assert result["price_basis"] in (
            "catalog_typical",
            "catalog_median",
            "catalog_default",
            "user_catalog",
            "market_estimate",
        )


def test_a_packet_of_noodles_is_not_priced_like_a_laptop():
    """The band is chosen by the kind of thing, not by one generic range."""
    answer = _search("Indomie Goreng")
    for result in answer["results"]:
        assert result["price_idr"] < 500_000, (
            f"{result['title']!r} was priced at Rp {result['price_idr']:,}, "
            "which is not the price of a packet of noodles"
        )


def test_every_card_still_has_the_fields_the_grid_needs():
    """The card is drawn from these fields; a missing one is a hole."""
    answer = _search("Asus Rog")
    for result in answer["results"]:
        for field in (
            "title",
            "image_url",
            "price_idr",
            "merchant_source",
            "store_name",
            "description_snippet",
            "product_url",
            "rating",
        ):
            assert field in result, f"{field} is missing from a result"
        assert result["title"]
        assert result["merchant_source"]
        assert result["product_url"]
        assert result["price_idr"] > 0

def test_a_query_the_catalogue_cannot_answer_ignores_the_catalogue_prices():
    """
    The catalogue is a shelf of instant noodles. When a reader asks
    for a laptop, the price of the noodles has nothing to say about
    the price of the laptop, and using it as the band made a laptop
    come back priced like a snack.
    """
    from app.services.shopping_search_service import _local_results

    from app.services.shopping_search_service import _market_results

    # The band the reader's own catalogue would have supplied: the
    # middle price of a shelf of instant noodles.
    catalogue_band = (max(1, int(3500 * 0.4)), int(3500 * 2.5))

    # The band that says what a laptop goes for.
    from app.services.shopping_market_catalogue import _band_for

    low, high = _band_for("hp pavilion")
    assert low >= 6_000_000, "the laptop band is too low: %s" % low

    # The search must not use the noodle band for a laptop.
    results = _market_results("hp pavilion", 24, catalogue_band=None)
    assert results, "the search answered with nothing"
    for item in results:
        assert item["price_idr"] >= 6_000_000, (
            "a laptop was priced at %s, which is the price of the "
            "reader's noodles" % item["price_idr"]
        )


def test_a_kettle_is_not_a_two_thousand_rupiah_thing():
    """A kettle bought by name goes for what a kettle goes for."""
    from app.services.shopping_market_catalogue import _band_for

    low, high = _band_for("kettle")
    assert low >= 30_000, "the band for a kettle is too low: %s" % low
    assert high >= 300_000, "the band for a kettle is too low: %s" % high
