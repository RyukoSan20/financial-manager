"""
The optical reader has to read a receipt in more than one way.

A receipt is not always a clean, straight, well-lit sheet of paper. It
is a thermal print that has curled, a phone photo taken at an angle in
a dim shop, a screenshot, a picture of a picture.

The reader was running in ONE mode - the one that looks for the
layout of a page. On a receipt that is one tight column of text with
no whitespace to speak of, that mode finds nothing at all. The same
picture, read in a mode that expects a single block of text, gives
the whole receipt.

So the reader tries several modes now and keeps the one that
recovered the most text.

The pictures here are drawn here, not photographs of anybody's
receipts, so the repository stays free of anybody's paperwork. The
shapes - a narrow thermal roll, a curled and tilted photo, a clean
sheet - are the shapes, and no shop is named.
"""

import io
import os
import shutil
import sys

import pytest

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ),
)


def _pytesseract_available() -> bool:
    if shutil.which("tesseract") is None:
        return False
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:  # noqa: BLE001 - any failure means "not usable"
        return False


requires_tesseract = pytest.mark.skipif(
    not _pytesseract_available(),
    reason="Tesseract is not installed",
)


def _font(size: int = 26):
    from PIL import ImageFont

    for path in (
        "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/Library/Fonts/Arial.ttf",
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def _thermal_roll(lines, width: int = 420):
    """A narrow roll of thermal paper, the way a till prints it."""
    from PIL import Image, ImageDraw

    font = _font()
    line_height = 40
    height = 40 + line_height * len(lines)
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    y = 20
    for line in lines:
        draw.text((16, y), line, fill="black", font=font)
        y += line_height

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _curled_photo(png_bytes, tilt: float = 6.0, blur: bool = True):
    """A picture of a receipt: tilted, and a little soft."""
    from PIL import Image, ImageFilter

    image = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    image = image.rotate(tilt, expand=True, fillcolor="white")
    if blur:
        image = image.filter(ImageFilter.GaussianBlur(radius=0.7))

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=80)
    return buffer.getvalue()


def _read(image_bytes):
    """Run the reader the way the scanner does."""
    from app.services.ocr_service import OCRService

    result = OCRService().process_image(image_bytes)
    return list(result.raw_lines or [])


# ---------------------------------------------------------------------------
# The reader has to read a receipt at all
# ---------------------------------------------------------------------------


@requires_tesseract
def test_a_narrow_thermal_roll_is_read():
    image = _thermal_roll([
        "TOKO SERBADA",
        "BERAS 5 KG  55000",
        "MINYAK 1 L  16000",
        "TOTAL  71000",
    ])
    lines = _read(image)
    joined = " ".join(lines).upper()

    assert lines, "the reader found nothing at all in a clear receipt"
    assert "TOTAL" in joined, f"the total line was not read: {joined!r}"
    assert "71" in joined, f"the amount was not read: {joined!r}"


@requires_tesseract
def test_a_photo_of_a_receipt_is_read():
    """The picture is tilted and soft, the way a phone photo is."""
    image = _curled_photo(_thermal_roll([
        "TOKO SERBADA",
        "BERAS 5 KG  55000",
        "TOTAL  55000",
    ]))
    lines = _read(image)
    joined = " ".join(lines).upper()

    assert lines, "the reader found nothing at all in a photo of a receipt"
    assert "TOTAL" in joined, f"the total line was not read: {joined!r}"


@requires_tesseract
def test_a_photo_of_a_receipt_keeps_the_amount():
    image = _curled_photo(_thermal_roll([
        "TOKO SERBADA",
        "MINYAK 1 L  16000",
        "TOTAL  16000",
    ]))
    lines = _read(image)
    joined = " ".join(lines).upper()

    assert "16" in joined, f"the amount was not read: {joined!r}"


# ---------------------------------------------------------------------------
# The formats a phone hands over
# ---------------------------------------------------------------------------


@requires_tesseract
@pytest.mark.parametrize(
    "fmt,mode",
    [
        ("PNG", "RGB"),
        ("JPEG", "RGB"),
    ],
)
def test_a_receipt_is_read_in_more_than_one_format(fmt, mode):
    """A phone hands over a PNG sometimes and a JPEG other times, and
    sometimes a picture with no colour channels at all."""
    from PIL import Image

    source = _thermal_roll([
        "TOKO SERBADA",
        "TOTAL  42000",
    ])
    image = Image.open(io.BytesIO(source))
    if mode != image.mode:
        image = image.convert(mode)

    buffer = io.BytesIO()
    image.save(buffer, format=fmt)

    lines = _read(buffer.getvalue())
    joined = " ".join(lines).upper()

    assert lines, f"nothing was read from a {fmt}"
    assert "TOTAL" in joined, f"the total line was not read from a {fmt}: {joined!r}"


@requires_tesseract
def test_a_receipt_is_read_when_it_has_no_colour():
    """A picture saved as greyscale still has to be read."""
    from PIL import Image

    source = _thermal_roll([
        "TOKO SERBADA",
        "TOTAL  42000",
    ])
    image = Image.open(io.BytesIO(source)).convert("L")

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    lines = _read(buffer.getvalue())
    joined = " ".join(lines).upper()

    assert lines, "nothing was read from a greyscale picture"
    assert "TOTAL" in joined, f"the total line was not read: {joined!r}"


@requires_tesseract
def test_a_receipt_is_read_when_it_has_an_alpha_channel():
    """A picture with transparency is a picture a phone sends."""
    from PIL import Image

    source = _thermal_roll([
        "TOKO SERBADA",
        "TOTAL  42000",
    ])
    image = Image.open(io.BytesIO(source)).convert("RGBA")

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    lines = _read(buffer.getvalue())
    joined = " ".join(lines).upper()

    assert lines, "nothing was read from a picture with transparency"
    assert "TOTAL" in joined, f"the total line was not read: {joined!r}"
