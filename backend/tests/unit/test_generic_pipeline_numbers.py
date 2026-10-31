"""
The pipeline that the server actually runs.

There are two parsers in this application. `parser_engine_v31` is one
of them, and the other is `GenericPipeline`, which is the one the
receipt endpoint on the server calls. A receipt that reads correctly in
one of them and not in the other is a receipt that half the time does
not read at all, depending on which door it comes through.

So the same rules are pinned here, on the pipeline the server uses.

1. A quantity and a price are two numbers. "1 184.003" is a count of
   one and a sum of 184.003, and joining them gave 1.184.003 - six
   times the price.

2. A product's code is not a price. A supermarket prints the code
   before the name, and it is a long run of digits.

3. A count of items is not the total. "ITEMS: 8 212,733" holds both,
   and the money is the sum.

The images are not used here. These tests are about the numbers.
"""

import os
import sys

import pytest

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ),
)

from app.services.generic_pipeline import CurrencyNormalizer  # noqa: E402


def test_a_quantity_and_a_price_are_not_joined():
    """"1 184.003" is a count of one and a sum of 184.003."""
    normalized = CurrencyNormalizer.normalize_line("ab total; 1 184.003")

    amounts = CurrencyNormalizer.extract_amounts(normalized)

    assert 184003 in amounts, (
        f"the price was lost: {normalized!r} -> {amounts}"
    )
    assert 1184003 not in amounts, (
        f"the count and the price were joined: {normalized!r} -> {amounts}"
    )


def test_a_count_of_items_and_a_sum_are_not_joined():
    """"ITEMS: 8 212,733" is a count of eight and a sum of 212.733."""
    normalized = CurrencyNormalizer.normalize_line("ITEMS: 8 212,733")

    amounts = CurrencyNormalizer.extract_amounts(normalized)

    assert 212733 in amounts, (
        f"the sum was lost: {normalized!r} -> {amounts}"
    )
    assert 8212733 not in amounts, (
        f"the count and the sum were joined: {normalized!r} -> {amounts}"
    )


def test_a_thousands_group_is_still_read_as_one_number():
    """"1.234.567" is one million, and it must not become three."""
    normalized = CurrencyNormalizer.normalize_line("Total 1.234.567")

    amounts = CurrencyNormalizer.extract_amounts(normalized)

    assert amounts == [1234567]


def test_a_price_with_a_decimal_is_read_as_itself():
    """"54,50" is fifty-four and a half."""
    normalized = CurrencyNormalizer.normalize_line("Total: CHF 54,50")

    amounts = CurrencyNormalizer.extract_amounts(normalized)

    assert 54.5 in amounts or 5450 in amounts, (
        f"the decimal was read wrongly: {normalized!r} -> {amounts}"
    )


def test_a_product_code_is_not_read_as_the_price():
    """
    A supermarket prints the code before the name. The code is eight
    digits long and it is not money.
    """
    normalized = CurrencyNormalizer.normalize_line("35597816 TSSUNFLOKEFBTL 103,390")

    amounts = CurrencyNormalizer.extract_amounts(normalized)

    assert 103390 in amounts, (
        f"the price was lost: {normalized!r} -> {amounts}"
    )


# ---------------------------------------------------------------------------
# The base64 route
# ---------------------------------------------------------------------------


def test_the_base64_route_answers():
    """
    The route that takes a picture as base64 answers.

    It called a function that was never imported, so every request to
    it failed with a 500. A reader who sent their receipt that way
    was told the server had a problem, with no picture read at all.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.routes import parser as parser_route
    from app.core.security import get_current_user

    class _TheReader:
        id = 1
        email = "reader@example.test"
        is_active = True

    app = FastAPI()
    app.include_router(parser_route.router, prefix="/api/parser")
    app.dependency_overrides[get_current_user] = lambda: _TheReader()

    client = TestClient(app)
    response = client.post(
        "/api/parser/parse-receipt-base64",
        json={"ocr_text": "TOKO SENJA\nTOTAL 42.000"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "success"


# ---------------------------------------------------------------------------
# The cloud reader must not erase what was already read
# ---------------------------------------------------------------------------


def test_a_cloud_answer_with_nothing_in_it_does_not_erase_the_receipt(monkeypatch):
    """
    The receipt is read on the server, and it comes out right: the shop
    is Alfamart and the sum is 38.000.

    Then the cloud reader is asked as well, and it answers with
    nothing - no shop, no sum, no lines. It answers "success" even so.

    The answer that was already read was thrown away and the empty one
    was used instead, so the reader was told the receipt was worth
    nothing. A cloud answer that holds nothing must not replace an
    answer that holds everything.
    """
    import asyncio

    from app.services import gemini_vision
    from app.services.generic_pipeline import GenericPipeline

    lines = [
        "Alfamart",
        "Alfanart Jogja",
        "Cimory 2.000",
        "1x2.000",
        "Total Rp38.000",
    ]

    def _an_answer_with_nothing_in_it(image_bytes, api_key):
        return {"merchant": {}, "items": [], "total_amount": 0}

    monkeypatch.setattr(
        gemini_vision, "extract_receipt_with_gemini", _an_answer_with_nothing_in_it
    )
    monkeypatch.setenv("GEMINI_API_KEY", "a-key-for-the-test")

    result = asyncio.run(GenericPipeline().parse({"ocr_lines": lines}, b"not-empty"))

    assert result.total_amount == 38000, (
        f"the sum that was read was thrown away: {result.total_amount}"
    )
    assert result.merchant_name, "the shop that was read was thrown away"
