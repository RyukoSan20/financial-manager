"""
Reading a product out of a photograph.

The tests are about the parts that would otherwise be wrong quietly:

- A shelf label writes its price in several ways, and only one of the
  numbers on it is what the customer pays. The price is read the
  Indonesian way, because in Indonesia the dot is the thousands
  separator and the comma is the decimal - which is the opposite of
  what the model usually returns.

- A reading that cannot be made is reported as no reading. It is not
  turned into a product with a price of zero, because that price would
  be sold at.

- Nothing is written by the reader. It hands back a draft, and the
  route that saves the product is a different one that the shop owner
  presses.
"""

import json
from unittest.mock import patch

import pytest

from app.services import merchant_capture as mc


def _jpeg_bytes() -> bytes:
    """A file that starts like a JPEG."""
    return b"\xff\xd8\xff\xe0" + b"0" * 64


class TestPriceReading:
    """The number on the label."""

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("Rp 25.000", 25000.0),
            ("25000", 25000.0),
            ("Rp 25.000,00", 25000.0),
            ("25.000,-", 25000.0),
            ("25 000", 25000.0),
            ("Rp1.500.000", 1500000.0),
            ("12.500", 12500.0),
            (25000, 25000.0),
            (25000.5, 25000.5),
        ],
    )
    def test_the_price_is_read_the_indonesian_way(self, raw, expected):
        assert mc._parse_price(raw) == expected

    @pytest.mark.parametrize(
        "raw",
        [None, "", "   ", "gratis", "Rp", "-", ".", "Rp,-"],
    )
    def test_a_price_that_is_not_a_price_is_not_a_price(self, raw):
        assert mc._parse_price(raw) is None

    def test_a_negative_price_is_refused(self):
        assert mc._parse_price("-5000") is None


class TestTidying:
    """The rest of the answer."""

    def test_a_name_with_spaces_in_it_is_tidied(self):
        assert mc._clean_name("  Indomie   Goreng  ") == "Indomie Goreng"

    def test_a_name_that_is_not_there_is_empty(self):
        assert mc._clean_name(None) == ""

    def test_a_barcode_is_kept_as_its_digits(self):
        assert mc._clean_sku("EAN: 8991234567890") == "8991234567890"

    def test_a_barcode_that_is_too_short_is_not_a_barcode(self):
        assert mc._clean_sku("123") is None

    def test_a_confidence_that_is_a_percentage_becomes_a_fraction(self):
        assert mc._confidence(85) == pytest.approx(0.85)

    def test_a_confidence_that_is_nonsense_is_half(self):
        assert mc._confidence("good") == 0.5

    def test_a_confidence_is_never_outside_the_range(self):
        assert mc._confidence(5) == 1.0
        assert mc._confidence(-3) == 0.0


class TestThePicture:
    """What kind of picture it is."""

    def test_a_png_is_told_from_a_jpeg(self):
        assert mc._mime_of(b"\x89PNG\r\n\x1a\n" + b"0" * 10) == "image/png"
        assert mc._mime_of(b"\xff\xd8\xff" + b"0" * 10) == "image/jpeg"

    def test_a_picture_that_is_not_recognised_is_called_a_photograph(self):
        assert mc._mime_of(b"not a picture") == "image/jpeg"


class TestTheReading:
    """The whole thing, with the model answering."""

    def _answer(self, payload: str):
        """The model, answering with this."""
        body = {
            "candidates": [
                {"content": {"parts": [{"text": payload}]}}
            ]
        }
        return patch.object(mc.urllib.request, "urlopen", _fake_urlopen(body))

    def test_a_product_is_read_out_of_the_picture(self):
        answer = json.dumps(
            {
                "name": "Indomie Goreng",
                "price": "Rp 3.500",
                "currency": "IDR",
                "category": "groceries",
                "unit": "pcs",
                "size": "85g",
                "sku": "8991234567890",
                "confidence": 0.9,
            }
        )
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with self._answer(answer):
                product = mc.capture_product(_jpeg_bytes())

        assert product is not None
        assert product.name == "Indomie Goreng"
        assert product.price == 3500.0
        assert product.category == "groceries"
        assert product.unit == "pcs"
        assert product.size == "85g"
        assert product.sku == "8991234567890"
        assert product.confidence == pytest.approx(0.9)

    def test_a_product_with_no_price_says_so(self):
        answer = json.dumps({"name": "Sabun Mandiri", "price": None})
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with self._answer(answer):
                product = mc.capture_product(_jpeg_bytes())

        assert product is not None
        assert product.price is None
        assert any("price" in w.lower() for w in product.warnings)

    def test_a_picture_with_nothing_in_it_is_not_a_product(self):
        answer = json.dumps({"name": "", "price": "10000"})
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with self._answer(answer):
                assert mc.capture_product(_jpeg_bytes()) is None

    def test_a_category_that_is_not_known_becomes_other(self):
        answer = json.dumps({"name": "Barang", "price": "1000", "category": "spaceship"})
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with self._answer(answer):
                product = mc.capture_product(_jpeg_bytes())
        assert product.category == "other"

    def test_a_unit_that_is_not_known_becomes_pcs(self):
        answer = json.dumps({"name": "Barang", "price": "1000", "unit": "banana"})
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with self._answer(answer):
                product = mc.capture_product(_jpeg_bytes())
        assert product.unit == "pcs"

    def test_an_answer_wrapped_in_a_sentence_is_still_read(self):
        answer = 'Here is the product: {"name": "Teh Botol", "price": "5000"}'
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with self._answer(answer):
                product = mc.capture_product(_jpeg_bytes())
        assert product is not None
        assert product.name == "Teh Botol"

    def test_no_key_means_no_reading_rather_than_an_invented_one(self):
        with patch("app.services.merchant_capture._api_key", return_value=""):
            assert mc.capture_product(_jpeg_bytes()) is None

    def test_an_empty_picture_is_not_read(self):
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            assert mc.capture_product(b"") is None

    def test_a_model_that_fails_gives_no_reading(self):
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with patch.object(
                mc.urllib.request, "urlopen", side_effect=RuntimeError("no")
            ):
                assert mc.capture_product(_jpeg_bytes()) is None

    def test_the_draft_does_not_carry_the_picture_into_the_answer(self):
        answer = json.dumps({"name": "Kopi", "price": "15000"})
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with self._answer(answer):
                product = mc.capture_product(_jpeg_bytes())
        assert "image_bytes" not in product.to_dict()
        assert product.to_dict()["name"] == "Kopi"


class _FakeResponse:
    def __init__(self, body):
        self._body = json.dumps(body).encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _fake_urlopen(body):
    """A stand-in for the call to the model."""
    def opener(request, timeout=None):
        return _FakeResponse(body)

    return opener
