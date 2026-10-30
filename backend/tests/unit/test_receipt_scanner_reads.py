"""
The scanner has to read the receipts people actually photograph.

Three things were wrong, and each of them has its own test here.

1. The optical reader was run in ONE mode. A receipt that is small,
   blurry, handwritten or laid out in a single column is read as
   nothing at all in that mode, and as a full receipt in another.
   The reader now tries several modes and keeps the best one.

2. The multi-variant machinery existed but was never used, because
   every variant was handed to an engine that is not installed, and
   the fallback read the ORIGINAL image only.

3. The numbers were read as a sum of the item lines instead of from
   the printed TOTAL, and a line that says how many items there were
   was read as the amount.

The images are generated here, not taken from a person's receipts, so
the repository stays free of anybody's paperwork. A test that needs
Tesseract is skipped when Tesseract is not installed.
"""

import io
import os
import shutil
import subprocess
import sys

import pytest

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ),
)


def _tesseract_available() -> bool:
    if shutil.which("tesseract") is None:
        return False
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:  # noqa: BLE001 - any failure means "not usable"
        return False


requires_tesseract = pytest.mark.skipif(
    not _tesseract_available(),
    reason="Tesseract is not installed",
)


def _font(size: int = 22):
    """A real font, so the generated image is really readable."""
    from PIL import ImageFont

    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:  # noqa: BLE001
                continue
    return ImageFont.load_default()


def _render(lines, size=(900, 700), font_size=24, noise=False):
    """Draw the lines on a white sheet and return the PNG bytes."""
    from PIL import Image, ImageDraw

    image = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(image)
    font = _font(font_size)
    y = 30
    for line in lines:
        draw.text((40, y), line, fill="black", font=font)
        y += font_size + 14
    if noise:
        # A little speckle, so the sheet is not perfectly clean.
        import random

        random.seed(7)
        pixels = image.load()
        for _ in range(3000):
            x = random.randrange(size[0])
            yy = random.randrange(size[1])
            pixels[x, yy] = (random.randrange(120, 220),) * 3
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


# ---------------------------------------------------------------------------
# 1. The reader must try more than one mode
# ---------------------------------------------------------------------------


@requires_tesseract
def test_a_small_receipt_is_read_in_some_mode():
    """
    A receipt printed small, the way a thermal printer prints it, was
    read as NOTHING before. Some mode has to get the text out of it.
    """
    from app.services.ocr_service import _extract_with_multivariant_ocr

    png = _render(
        [
            "TOKO SENJA",
            "Beras 2 70.000 140.000",
            "Gula 1 17.000 17.000",
            "TOTAL 157.000",
        ],
        size=(520, 220),
        font_size=15,
    )

    lines, confidence, diagnostics = _extract_with_multivariant_ocr(png)

    assert lines, "the reader returned nothing at all for a readable receipt"
    joined = " ".join(lines).upper()
    assert "TOTAL" in joined, f"the total line was not read: {lines}"


@requires_tesseract
def test_the_reader_reports_which_mode_won():
    """The diagnostics have to say which reading won, or nobody can debug it."""
    from app.services.ocr_service import _extract_with_multivariant_ocr

    png = _render(["TOKO SENJA", "TOTAL 157.000"])

    _lines, _confidence, diagnostics = _extract_with_multivariant_ocr(png)

    assert diagnostics.get("best_variant"), "the winning reading was not reported"
    assert diagnostics.get("variants_tried"), "no reading was reported at all"


@requires_tesseract
def test_the_preprocessed_variants_are_actually_read():
    """
    The multi-variant machinery was never used: every variant was handed
    to an engine that is not installed, and only the original image was
    read. So the diagnostics must now list more than the original.
    """
    from app.services.ocr_service import _extract_with_multivariant_ocr

    png = _render(["TOKO SENJA", "TOTAL 157.000"])

    _lines, _confidence, diagnostics = _extract_with_multivariant_ocr(png)

    tried = [v.get("name") for v in (diagnostics.get("variants_tried") or [])]
    assert len(tried) > 1, f"only one reading was tried: {tried}"


# ---------------------------------------------------------------------------
# 2. The total comes from the printed TOTAL
# ---------------------------------------------------------------------------


def test_the_total_comes_from_the_printed_total_not_from_the_items():
    """
    A receipt that prints "15 ITEMS TOA, : 503.510" has the real total
    on that line. Summing the item lines gave a number 500 times too big.
    """
    from app.services.parser_engine_v31 import parse_receipt_text_v31

    lines = [
        "GREENFIELDS 1 46.990 46.990",
        "CIMORY STRAWBERY 750 1 26.800 26.800",
        "UBI MA MOZZARELLA 1 17.000 17.000",
        "HPM FACIAL TISSUE TR 1 8.560 8.560",
        "15 ITEMS TOA, : 503.510",
    ]

    result = parse_receipt_text_v31(lines)

    assert result["amount"] == 503510, (
        f"the total was {result['amount']}, the receipt prints 503.510"
    )


def test_a_count_of_items_is_not_the_amount():
    """"Total QTY : 3" says how many items there are, not what they cost."""
    from app.services.parser_engine_v31 import parse_receipt_text_v31

    lines = [
        "PESANAN",
        "Struk Pesanan",
        "1. Jus Apel",
        "1 kg X 8,000 8,000",
        "2. Jus Mangga",
        "2 kg X 7,000 14,000",
        "Total QTY : 3",
        "Sub Total 22,000",
        "Total 26,620",
        "Bayar 30,000",
        "Kembali 3,300",
    ]

    result = parse_receipt_text_v31(lines)

    assert result["amount"] == 26620, (
        f"the total was {result['amount']}, the receipt prints 26.620"
    )


def test_a_date_is_not_the_amount():
    """
    "Bar Tisch 7/01" is a table number and a date, not a price. The
    receipt prints "Total: CHF 54,50" further down.
    """
    from app.services.parser_engine_v31 import parse_receipt_text_v31

    lines = [
        "Berghotel",
        "Grosse Scheidegg",
        "3818 Grindelwald",
        "Rech.Nr. 4572 30.07. 2007/13:29:17",
        "Bar Tisch 7/01",
        "2 Latte Macchiato 4.50 CHF 9.00",
        "Total: CHF 54,50",
        "Incl. 7.64% MwSt 54.50 CHF: 3.85",
    ]

    result = parse_receipt_text_v31(lines)

    # The receipt prints 54.50 francs, and every receipt this parser
    # reads is in the major unit - a receipt that prints "Rp
    # 200.000,00" is two hundred thousand rupiah, not two hundred
    # thousand sen. So the total is 54.50, and not 7.01 and not the
    # table number.
    #
    # The parser gives an amount in whole rupiah, so the fifty cents
    # are rounded away. What matters here is that the total is the
    # fifty-four and a half, and not the table number and not the
    # tax rate.
    assert result["amount"] == 54, (
        f"the total was {result['amount']}, the receipt prints 54,50"
    )


def test_the_line_that_says_how_many_items_there_are_is_not_read_as_a_price():
    """The count line must not be mistaken for a priced item either."""
    from app.services.parser_engine_v31 import parse_single_line_item

    assert parse_single_line_item("Total QTY : 3") is None
    assert parse_single_line_item("Jumlah Kuantitas: 8") is None
    assert parse_single_line_item("15 ITEMS TOA, : 503.510") is None


# ---------------------------------------------------------------------------
# 3. The item numbers: the quantity is not the price
# ---------------------------------------------------------------------------


def test_the_quantity_is_not_mistaken_for_the_price():
    """
    "CIMORY MIX BERRY 225 1 8500 8,500" is one item at 8.500, bought
    once. The parser read the quantity as the price.
    """
    from app.services.parser_engine_v31 import parse_single_line_item

    item = parse_single_line_item("CIMORY MIX BERRY 225 1 8500 8, 500")

    assert item is not None
    assert item["total_price"] == 8500, f"the line total was {item['total_price']}"
    assert item["price_per_unit"] == 8500, f"the unit price was {item['price_per_unit']}"
    assert item["quantity"] == 1, f"the quantity was {item['quantity']}"
    assert "CIMORY" in item["name"], f"the name was {item['name']!r}"


def test_four_at_four_thousand_five_hundred_is_four_items():
    """The quantity, the unit price and the line total are three numbers."""
    from app.services.parser_engine_v31 import parse_single_line_item

    item = parse_single_line_item("S/ROTI KRIM KEJU 72G 4 4500 18,000")

    assert item is not None
    assert item["quantity"] == 4, f"the quantity was {item['quantity']}"
    assert item["price_per_unit"] == 4500, f"the unit price was {item['price_per_unit']}"
    assert item["total_price"] == 18000, f"the line total was {item['total_price']}"


def test_a_weight_and_a_unit_price_and_a_line_total_are_three_numbers():
    """The wholesale receipt prints "4.000 Kg X 12.500 Rp. 50.000.000"."""
    from app.services.parser_engine_v31 import parse_single_line_item

    item = parse_single_line_item("Beras 4.000 Kg X 12.500 Rp. 50.000.000")

    assert item is not None
    assert item["total_price"] == 50000000, (
        f"the line total was {item['total_price']}, the receipt prints 50.000.000"
    )


def test_a_price_written_with_dots_is_one_number():
    """The wholesale receipt writes 50.000.000, which is fifty million."""
    from app.services.parser_engine_v31 import parse_number_indonesia

    assert parse_number_indonesia("50.000.000") == 50000000
    assert parse_number_indonesia("50.000") == 50000
    assert parse_number_indonesia("1.234.567") == 1234567


# ---------------------------------------------------------------------------
# 4. The reader must not read a photograph of a screen as a receipt
# ---------------------------------------------------------------------------


def test_a_photograph_of_the_app_is_not_a_receipt():
    """
    A screenshot of the scanner's own screen is not a receipt. It must
    not turn into a transaction.
    """
    from app.services.parser_engine_v31 import parse_receipt_text_v31

    lines = [
        "Chrome File Edit View History Bookmarks Profiles Tab Window Help",
        "financial-manager-inky.vercel.app/transactions",
        "FinManager",
        "Dashboard",
        "Transactions",
        "Accounts",
        "Budgets",
        "Recurring",
        "Goals",
        "Debts",
        "Calculators",
        "Analytics",
        "Al Advisor",
        "Settings",
    ]

    result = parse_receipt_text_v31(lines)

    assert result["amount"] == 0, (
        f"a screenshot of the app was read as a transaction of {result['amount']}"
    )
