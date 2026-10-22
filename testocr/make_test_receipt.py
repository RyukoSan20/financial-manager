"""Generate a synthetic Indonesian minimarket receipt image for pipeline testing.

The sample PNGs in testocr/ are UI screenshots, not receipt photos, so they
cannot exercise the OCR -> parse -> validate path. This renders a realistic
Indomaret-style receipt so the full backend pipeline can be verified.
"""
from PIL import Image, ImageDraw, ImageFont
import os

RECEIPT_LINES = [
    ("INDOMARET", 26),
    ("JL. JATINANGOR NO.14", 16),
    ("TANGERANG SELATAN", 16),
    ("", 16),
    ("14/09/2016-06:46  23", 16),
    ("--------------------------------", 16),
    ("S/ROTI KRIM KEJU 72G", 16),
    ("           4  4500   18,000", 16),
    ("CIMORY MIX BERRY 225ML", 16),
    ("           1  8500    8,500", 16),
    ("CAFELA EXPRESO", 16),
    ("           1  3500    3,500", 16),
    ("FF LOW FAT VANILA", 16),
    ("           1  5200    5,200", 16),
    ("PLASTIK SDG", 16),
    ("           1     1        1", 16),
    ("--------------------------------", 16),
    ("DISKON : (1)", 16),
    ("DISKON FRISIAN FLAG : (1, 300)", 16),
    ("--------------------------------", 16),
    ("TOTAL             33,900", 18),
    ("TUNAI             50,000", 16),
    ("KEMBALI           16,100", 16),
    ("", 16),
    ("TERIMA KASIH", 16),
]


def _font(size, bold=False):
    for path in (
        "/System/Library/Fonts/Supplemental/Courier New Bold.ttf" if bold
        else "/System/Library/Fonts/Supplemental/Courier New.ttf",
        "/System/Library/Fonts/Menlo.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def build(path):
    width = 420
    margin = 18
    line_gap = 6

    fonts = [_font(16), _font(18), _font(26, bold=True)]
    heights = []
    for text, size in RECEIPT_LINES:
        idx = 1 if size == 18 else (2 if size == 26 else 0)
        heights.append((fonts[idx].getbbox("Ag")[3] - fonts[idx].getbbox("Ag")[1]) + line_gap)

    height = sum(heights) + margin * 2
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    y = margin
    for (text, size), h in zip(RECEIPT_LINES, heights):
        if text:
            idx = 1 if size == 18 else (2 if size == 26 else 0)
            draw.text((margin, y), text, fill="black", font=fonts[idx])
        y += h

    # Slight rotation + paper texture so the OCR path is exercised realistically
    img = img.rotate(-0.6, expand=True, fillcolor=(245, 245, 240))
    img.save(path, "PNG")
    return path


if __name__ == "__main__":
    out = "/tmp/indomaret_receipt.png"
    build(out)
    print("wrote", out, os.path.getsize(out), "bytes")
