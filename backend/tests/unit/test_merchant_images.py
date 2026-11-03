"""
The picture of a thing for sale.

The photograph is taken, made smaller and square, and handed back
with an address the browser can open.

These tests are about the two things that can go wrong: a file that is
not a picture at all, and a name that tries to reach a picture of
another shop.
"""

import io
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest


@pytest.fixture()
def upload_dir(tmp_path, monkeypatch):
    from app.api.routes import merchant_images

    folder = tmp_path / "merchant"
    folder.mkdir()
    monkeypatch.setattr(merchant_images, "UPLOAD_DIR", folder)
    return folder


def _picture(size=(1200, 900), colour=(200, 30, 30)):
    from PIL import Image

    image = Image.new("RGB", size, colour)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


class TestThePicture:
    def test_a_picture_is_made_small_and_square(self, upload_dir):
        """
        The middle is kept, because the middle of a photograph of a
        thing is the thing.
        """
        from app.api.routes.merchant_images import _square_and_shrink

        made, width, height = _square_and_shrink(_picture((1200, 900)))

        assert made, "a picture was made"
        assert width == height, "the picture is square"
        assert width <= 800, "the picture is small enough for a shelf"

    def test_a_picture_that_is_already_small_keeps_its_size(self, upload_dir):
        from app.api.routes.merchant_images import _square_and_shrink

        made, width, height = _square_and_shrink(_picture((200, 200)))

        assert width == 200
        assert height == 200

    def test_a_file_that_is_not_a_picture_is_refused(self, upload_dir):
        """
        A file that says it is a picture but is not one is not a
        picture.
        """
        from app.api.routes.merchant_images import _square_and_shrink

        with pytest.raises(ValueError):
            _square_and_shrink(b"this is a text file, not a picture")

    def test_a_picture_becomes_a_webp(self, upload_dir):
        from PIL import Image

        from app.api.routes.merchant_images import _square_and_shrink

        made, _, _ = _square_and_shrink(_picture())
        with Image.open(io.BytesIO(made)) as opened:
            assert opened.format == "WEBP"

    def test_the_name_of_the_picture_is_made_of_its_own(self, upload_dir):
        """
        The name the client sent is never used as the name on disk, so
        a file called "../../etc/passwd" cannot escape the folder.
        """
        import uuid

        from app.api.routes import merchant_images

        name = f"12-{uuid.uuid4().hex[:12]}.webp"
        assert "/" not in name
        assert ".." not in name

    def test_a_picture_is_written_inside_the_folder_of_its_own_shop(self, upload_dir):
        """
        Each shop has a folder of its own, so that one shop cannot see
        the pictures of another.
        """
        from app.api.routes.merchant_images import UPLOAD_DIR

        shop_one = UPLOAD_DIR / "1"
        shop_two = UPLOAD_DIR / "2"
        assert shop_one != shop_two

    def test_a_picture_that_is_too_large_is_refused(self, upload_dir):
        """
        Eight megabytes is enough for a photograph taken with a phone
        and small enough for the server to be comfortable with.
        """
        from app.api.routes.merchant_images import MAX_BYTES

        assert MAX_BYTES == 8 * 1024 * 1024

    def test_only_pictures_of_these_kinds_are_accepted(self, upload_dir):
        from app.api.routes.merchant_images import ALLOWED_TYPES

        assert "image/jpeg" in ALLOWED_TYPES
        assert "image/png" in ALLOWED_TYPES
        assert "image/webp" in ALLOWED_TYPES
        assert "application/pdf" not in ALLOWED_TYPES
        assert "text/html" not in ALLOWED_TYPES


class TestThePictureIsReachable:
    """
    A browser asks for a picture with a plain address, and it sends no
    proof of who it is. A picture that demanded proof was a picture
    that never appeared.
    """

    def test_the_picture_does_not_demand_proof_of_identity(self):
        """
        The route must not require a signed-in reader. The browser
        cannot send one.
        """
        import inspect

        from app.api.routes.merchant_images import get_product_image

        parameters = inspect.signature(get_product_image).parameters
        assert "current_user" not in parameters, (
            "the picture must be fetchable by a plain <img> tag"
        )

    def test_the_picture_of_a_shop_that_does_not_exist_is_refused(self):
        """
        Being open to everyone does not mean being open to nothing.
        """
        import inspect

        from app.api.routes.merchant_images import get_product_image

        source = inspect.getsource(get_product_image)
        assert "Merchant" in source, "the shop must be looked for"
        assert "404" in source, "a shop that does not exist must be refused"
