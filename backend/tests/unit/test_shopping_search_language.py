"""
The sentence under the price is written in the reader's language.

A card in the catalogue says where its price came from. When the price
came from the reader's own catalogue, it is a reference price they
learned from their own receipts, and the card has to say that. But
the sentence must be in the language the reader is reading in.

The server used to write the sentence itself, in English, and put it
in the same field as the description of a real product. That put
English on an Indonesian page, and it also meant the description of a
product the reader had actually bought was replaced by a note about
where the price came from.

So the server sends a code - the basis of the price - and the client
writes the sentence. The code is `price_basis`, and it was already
being sent; only the sentence was wrong.
"""

import pytest

from app.services.shopping_search_service import _local_result


def _card(**kwargs):
    """One card of the grid, built from the reader's own catalogue."""
    market = {
        "id": "tokopedia",
        "name": "Tokopedia",
        "search_url": "https://tokopedia.com/search?query={query}",
    }
    defaults = {
        "title": "Indomie Goreng",
        "price": 4500,
        "basis": "catalog_median",
        "market": market,
        "store": None,
        "query": "indomie",
        "category": "Makanan & Minuman",
        "description": "",
    }
    defaults.update(kwargs)
    return _local_result(**defaults)


def test_a_card_without_a_description_carries_no_sentence():
    """The card must not be given a sentence in place of a description."""
    card = _card()

    # Nothing in English, and nothing that reads like a note about
    # where the price came from.
    assert "your own catalogue" not in (card["description_snippet"] or "")
    assert "live shop price" not in (card["description_snippet"] or "")


def test_a_card_says_where_its_price_came_from():
    """The machine-readable basis travels with the card."""
    card = _card()

    assert card["price_basis"] == "catalog_median"
    assert card["source"] == "local_catalog"
    # And it is honest about not being a live price.
    assert card["is_live_price"] is False


def test_a_real_description_is_kept():
    """The description of a product the reader bought is not replaced."""
    card = _card(description="Mi instan goreng, isi 85 gram")

    assert card["description_snippet"] == "Mi instan goreng, isi 85 gram"


def test_the_note_at_the_top_of_the_page_is_not_written_by_the_server():
    """The note is written by the client, in the reader's language."""
    from app.services.shopping_search_service import search_products  # noqa: F401

    # The server sends the code of the source, not a sentence about it.
    import inspect

    import app.services.shopping_search_service as service

    source = inspect.getsource(service.search_products)
    assert "Live shop prices." not in source
    assert "not live shop prices" not in source


@pytest.mark.asyncio
async def test_the_answer_carries_the_source_as_a_code():
    """The answer says which kind of answer it is, in a code."""
    from app.services.shopping_search_service import search_products

    answer = await search_products("indomie", user_id=None, limit=5)

    assert answer["source"] in ("provider", "local_catalog")
    # No sentence in English on the way out.
    assert "Live shop prices" not in (answer.get("note") or "")
