"""
The picture of a thing for sale.

Two things were wrong with it, and both were found by using it:

- the picture could not be fetched by the thing that shows it. A
  browser asks for a picture with a plain address, and it sends no
  proof of who it is, so a picture that demanded proof was a picture
  that never appeared.
- the picture could not be kept. A product had no place to put it,
  so a picture that was uploaded was a picture that was thrown away.

These tests are about the picture being reachable and being kept.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api.routes.merchant import ProductCreate, ProductResponse
from app.models.merchant import MerchantProduct


class TestThePictureIsKept:
    def test_a_product_may_carry_a_picture(self):
        """
        There has to be a place to put it, or the picture that was
        uploaded goes nowhere.
        """
        assert hasattr(MerchantProduct, "image_url")
        assert MerchantProduct.__table__.c.image_url.nullable is True

    def test_a_product_that_has_no_picture_is_still_a_product(self):
        """
        Most goods have no photograph. That is not a reason for the
        product to fail.
        """
        assert MerchantProduct.__table__.c.image_url.nullable is True

    def test_the_picture_is_never_asked_for(self):
        """
        A person should never have to supply a photograph to sell
        something.
        """
        schema = ProductCreate(name="Indomie Goreng", price=3500)
        assert schema.image_url is None

    def test_a_picture_can_be_given_when_it_is_handed_over(self):
        schema = ProductCreate(
            name="Indomie Goreng",
            price=3500,
            image_url="/api/merchant/4/product-image/abc.webp",
        )
        assert schema.image_url == "/api/merchant/4/product-image/abc.webp"

    def test_the_picture_comes_back_with_the_product(self):
        """
        A picture that is not handed back is a picture the reader
        cannot see.
        """
        assert "image_url" in ProductResponse.model_fields
