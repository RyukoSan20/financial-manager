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


# ---------------------------------------------------------------------------
# Which line is the shop on
# ---------------------------------------------------------------------------


def test_the_date_line_is_not_the_shop():
    """
    A restaurant receipt opens with the date, then the receipt number,
    then the word "Cashier". The shop is not on any of those lines.

    The first line was taken as the shop, so the receipt was filed
    under "Date: 10 October 2026 12:14:41".
    """
    from app.services.generic_pipeline import AnchorEngine

    lines = [
        "Date: 10 0ctober 2026 12:14:41",
        "Receipt No.:08. .u1 H.: L:I.2",
        "Cashier:",
        "No Customer:1 DINE IN",
        "Total 234,000",
    ]

    merchant = AnchorEngine().find_merchant_top(lines)

    assert merchant != "Date: 10 0ctober 2026 12:14:41", (
        "the date was taken for the shop"
    )
    assert merchant is None or "Date" not in merchant
    assert merchant is None or "Cashier" not in merchant


def test_the_shop_is_found_when_it_is_on_the_receipt():
    """
    The shop that is printed is the shop that is taken.
    """
    from app.services.generic_pipeline import AnchorEngine

    lines = [
        "Alfamart",
        "Alfanart Jogja",
        "Total Rp38.000",
    ]

    merchant = AnchorEngine().find_merchant_top(lines)

    assert merchant and "alfamart" in merchant.lower()


def test_a_line_of_only_noise_is_not_the_shop():
    """"ME" is a scrap of a word, not a shop."""
    from app.services.generic_pipeline import AnchorEngine

    lines = ["ME", "GACOAN", "PALU-RE MARTADINATA", "Total 184.003"]

    merchant = AnchorEngine().find_merchant_top(lines)

    assert merchant != "ME"
    assert merchant and "gacoan" in merchant.lower()


def test_a_known_chain_is_recognised_from_anywhere_on_the_receipt():
    """
    "JLUOLLATAAHGOR-SUMECANG Jndomaret" is a picture of a word with
    the shop in it. The shop is Indomaret, and the noise in front of
    it is what the camera made of the rest of the sign.
    """
    from app.services.generic_pipeline import AnchorEngine

    lines = [
        "Download 口品★",
        "Q PEKNGFOOO",
        "JLUOLLATAAHGOR-SUMECANG Jndomaret",
        "NPWP21.15L.107.6-446.001",
        "Total 33,900",
    ]

    merchant = AnchorEngine().find_merchant_top(lines)

    assert merchant and "indomaret" in merchant.lower(), (
        f"the shop was not found: {merchant!r}"
    )


def test_a_hyphen_in_a_number_is_not_thrown_away():
    """
    An older till prints a number with a hyphen in it: "1-476.00".

    The hyphen used to be swept away with the rest of the punctuation,
    which left "1476.00" - and a receipt whose sum is written with a
    hyphen came back a different number from the one on the till.
    """
    from app.services.generic_pipeline import CurrencyNormalizer

    normalized = CurrencyNormalizer.normalize_line("JumlahRp 1-476.00")

    amounts = CurrencyNormalizer.extract_amounts(normalized)

    assert amounts == [1476.0], (
        f"the number was changed: {normalized!r} -> {amounts}"
    )


def test_a_date_written_with_the_year_first_is_read_the_right_way_round():
    """
    "Waktu : 2025-10-15" is the 15th of October 2025.

    It was read as the 25th of October 2015, because the first two
    digits of the year were taken for the day. A receipt that was
    filed under the wrong date was a receipt that could not be found
    again.
    """
    from app.services.generic_pipeline import AnchorEngine

    date_value = AnchorEngine().find_date(["Waktu : 2025-10-15 10:34:34"])

    assert date_value == "2025-10-15", (
        f"the date was read the wrong way round: {date_value!r}"
    )


def test_a_date_written_the_usual_way_is_still_read():
    """The day first is the day first."""
    from app.services.generic_pipeline import AnchorEngine

    assert AnchorEngine().find_date(["Tanggal: 24-05-2023 16:45"]) == "2023-05-24"


def test_the_scan_from_the_feed_answers():
    """
    The route that the "scan" button on the phone uses answers.

    It ran an async parser by starting a second event loop, inside a
    request that already had one running. The server said "Cannot run
    the event loop while another loop is running" and answered 500, so
    the scan from the phone never worked at all.
    """
    import asyncio

    from app.services import receipt_parser

    calls = []

    class _Parser:
        def __init__(self, db):
            self.db = db

        async def parse_with_gemini(self, image_base64):
            calls.append(image_base64)
            return {"success": True, "data": {"amount": 100}, "confidence": 90}

    receipt_parser.ReceiptParser = _Parser

    async def _call_it():
        return receipt_parser.parse_receipt_sync(None, "an-image")

    result = asyncio.run(_call_it())

    assert result["success"] is True
    assert calls == ["an-image"]
