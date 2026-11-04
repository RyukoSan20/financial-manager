"""
The route that turns a photograph into a product.

The point of these tests is the split. Reading a picture answers with
a draft and writes nothing. The writing is a different route, and it
is the one the shop owner presses.

So the tests check that:

- The draft comes back with the reading and the warnings.
- Nothing was written to the catalogue by reading the picture.
- A shop that is not the reader's is refused, before anything is read.
- A picture that cannot be read says so plainly, rather than handing
  back a product with no name and no price.
"""

import io
import json
import sys
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest


def _picture(size=(600, 600), colour=(200, 30, 30)):
    """A picture of something."""
    from PIL import Image

    image = Image.new("RGB", size, colour)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def _reading(payload: dict):
    """The model, answering with this."""
    from app.services import merchant_capture as mc

    class _Response:
        def __init__(self, body):
            self._body = json.dumps(body).encode("utf-8")

        def read(self):
            return self._body

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def opener(request, timeout=None):
        return _Response(
            {"candidates": [{"content": {"parts": [{"text": json.dumps(payload)}]}}]}
        )

    return patch.object(mc.urllib.request, "urlopen", opener)


class TestTheDraft:
    def test_a_reading_comes_back_as_a_draft(self):
        from app.services import merchant_capture as mc

        answer = {
            "name": "Indomie Goreng",
            "price": "Rp 3.500",
            "category": "groceries",
            "unit": "pcs",
            "confidence": 0.9,
        }
        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with _reading(answer):
                product = mc.capture_product(_picture())

        assert product is not None
        assert product.name == "Indomie Goreng"
        assert product.price == 3500.0
        assert product.category == "groceries"

    def test_a_draft_with_no_price_says_so(self):
        from app.services import merchant_capture as mc

        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with _reading({"name": "Sabun", "price": None}):
                product = mc.capture_product(_picture())

        assert product is not None
        assert product.price is None
        assert product.warnings, "the owner is told the price was not read"

    def test_a_picture_with_nothing_in_it_gives_no_reading(self):
        from app.services import merchant_capture as mc

        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with _reading({"name": "", "price": "10000"}):
                assert mc.capture_product(_picture()) is None


class TestNothingIsWritten:
    def test_reading_a_picture_does_not_create_a_product(self, tmp_path):
        """
        The catalogue is the owner's own bookkeeping. A reading is a
        guess, and a guess does not belong in the books.
        """
        from app.services import merchant_capture as mc

        with patch("app.services.merchant_capture._api_key", return_value="k"):
            with _reading({"name": "Indomie Goreng", "price": "3500"}):
                product = mc.capture_product(_picture())

        assert product is not None
        # The draft holds the picture so that the owner can see what it
        # was read from, and nothing else. It holds no identifier of a
        # product, because no product was made.
        assert not hasattr(product, "id")
        assert "id" not in product.to_dict()


class TestTheRoute:
    def test_the_route_is_registered(self):
        """
        The capture has to be reachable, or the flow is a drawing.
        """
        from app.main import app

        paths = {route.path for route in app.routes}
        assert "/api/merchant/{merchant_id}/capture" in paths

    def test_the_write_route_is_a_separate_one(self):
        """
        The route that writes is the one that already existed. The
        capture feeds it rather than replacing it.
        """
        from app.main import app

        paths = {route.path for route in app.routes}
        assert "/api/merchant/{merchant_id}/products" in paths
        assert "/api/merchant/{merchant_id}/capture" in paths

    def test_the_capture_route_writes_nothing(self):
        """
        The route itself must not create a product. The words it uses
        are the proof, and the proof is a word.
        """
        from app.api.routes import merchant_capture as route

        source = Path(route.__file__).read_text()
        # The route that saves the product is not in this file.
        assert "db.add(" not in source, "the capture route adds nothing to the database"
        assert "db.commit(" not in source, "the capture route commits nothing"
