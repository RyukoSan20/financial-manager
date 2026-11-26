#!/usr/bin/env python3
"""
Cut the real Koban & Co. artwork into the pieces the game engine uses.

Nothing here is drawn. Every output is a crop of the artists' own
high-resolution pictures in
``mini-games/Koban & Co. General Goods/asset/``.

WHAT IT WRITES (under frontend/public/koban-assets/)

    face/<id>.png|.webp         256x256 portrait, Lanczos, from chara/<id>.jpeg
                                (x 15%..85%, y 5%..55% of the source)
    rig/<id>/head_base.webp     the head band of the sticker
    rig/<id>/torso_base.webp    the torso band
    rig/<id>/limb_left_leg.webp the lower band, left half
    rig/<id>/limb_right_leg.webp
    rig/<id>/pose_happy.webp    400x400, one quadrant of motion/<id>.jpeg
    rig/<id>/pose_walk.webp
    rig/<id>/pose_sweat.webp
    rig/<id>/pose_think.webp
    rig/<id>/rig.json           where each band sits, and its pivot
    places/facility_<name>.webp one quadrant of workshop.jpeg, whole

AN HONEST NOTE ABOUT THE RIG.

The character art is ONE flat painting per character. There is no
separately painted arm behind the sleeve or leg behind the skirt, so a
true cut-out skeleton cannot be made from it. What is made instead is
a paper puppet: three overlapping horizontal bands of the same
painting (head, torso, legs), each with a soft edge where it meets the
next. At rest the bands line up exactly and the figure is the
original painting. Hinged a few degrees at the neck and the hip, the
overlap hides the seam. That is the limit of what one painting allows,
and the component keeps its rotations inside that limit.

Run with:
    backend/venv/bin/python scripts/build_unity_koban_assets.py
"""

import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "mini-games" / "Koban & Co. General Goods" / "asset"
OUT = ROOT / "frontend" / "public" / "koban-assets"

CHARACTERS = ["koneko", "minori", "kaneru", "kogane", "mone", "zenimaru"]

# The motion sheet is a 2x2 grid, read left to right, top to bottom.
POSES = ["happy", "walk", "sweat", "think"]

# workshop.jpeg is a 2x2 sheet of the four facility rooms.
FACILITIES = ["restaurant", "blacksmith", "seamstress", "wizardry"]

WHITE = 240
WORK_WIDTH = 900      # the sticker is worked on at this width
POSE_SIZE = 400
FACE_SIZE = 256

# Where the bands are cut, as fractions of the figure's own bounding
# box. A chibi is about half head. The bands overlap by OVERLAP so a
# hinge of a few degrees never opens a gap.
BANDS = {"head": (0.0, 0.56), "torso": (0.46, 0.84), "legs": (0.74, 1.0)}
FEATHER = 0.05

# Per-character adjustments, where the default cut would go through a
# face or a hat brim.
BAND_OVERRIDES = {
    "mone": {"head": (0.0, 0.58), "torso": (0.48, 0.84)},
}


def flood_white_to_alpha(img: Image.Image, threshold: int = WHITE) -> Image.Image:
    """Outer white -> transparent. White the fill cannot reach (the
    die-cut border, an eye highlight) is left alone."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, _ = px[x, y]
        if r >= threshold and g >= threshold and b >= threshold:
            px[x, y] = (255, 255, 255, 0)
            if x + 1 < w and not seen[i + 1]: q.append((x + 1, y))
            if x > 0 and not seen[i - 1]: q.append((x - 1, y))
            if y + 1 < h and not seen[i + w]: q.append((x, y + 1))
            if y > 0 and not seen[i - w]: q.append((x, y - 1))
    return img


def fit_width(img, width):
    if img.width <= width:
        return img
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def feather_band(band: Image.Image, top: bool, bottom: bool, px: int) -> Image.Image:
    """Fade the alpha at a cut edge, so the seam is soft."""
    if px <= 0:
        return band
    w, h = band.size
    mask = Image.new("L", (w, h), 255)
    draw = ImageDraw.Draw(mask)
    for i in range(px):
        level = round(255 * (i + 1) / px)
        if top:
            draw.line([(0, i), (w, i)], fill=level)
        if bottom:
            draw.line([(0, h - 1 - i), (w, h - 1 - i)], fill=level)
    band.putalpha(ImageChops.multiply(band.getchannel("A"), mask))
    return band


def save_webp(img, path, quality=88):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6)


def build_face(cid: str) -> None:
    src = Image.open(SOURCE / "chara" / f"{cid}.jpeg").convert("RGB")
    w, h = src.size
    box = (round(w * 0.15), round(h * 0.05), round(w * 0.85), round(h * 0.55))
    crop = src.crop(box)
    # The box is 0.70w by 0.50h; on a 1792x2400 source that is
    # 1254x1200, close to square. Centre-crop the long side so the
    # portrait is not stretched.
    cw, ch = crop.size
    side = min(cw, ch)
    crop = crop.crop(((cw - side) // 2, (ch - side) // 2, (cw - side) // 2 + side, (ch - side) // 2 + side))
    face = crop.resize((FACE_SIZE, FACE_SIZE), Image.LANCZOS)
    (OUT / "face").mkdir(parents=True, exist_ok=True)
    face.save(OUT / "face" / f"{cid}.png", "PNG", optimize=True)
    save_webp(face, OUT / "face" / f"{cid}.webp", 90)
    face.save(OUT / "face" / f"{cid}.jpg", "JPEG", quality=90, optimize=True)


def build_rig(cid: str) -> dict:
    src = fit_width(Image.open(SOURCE / "chara" / f"{cid}.jpeg").convert("RGB"), WORK_WIDTH)
    sticker = flood_white_to_alpha(src)
    bbox = sticker.getchannel("A").getbbox()
    figure = sticker.crop(bbox)
    fw, fh = figure.size
    bands = {**BANDS, **BAND_OVERRIDES.get(cid, {})}
    feather = round(fh * FEATHER)
    rig_dir = OUT / "rig" / cid

    meta = {"id": cid, "width": fw, "height": fh, "layers": {}}

    def cut(name, y0, y1, x0=0.0, x1=1.0, top=False, bottom=False, pivot=(0.5, 0.5)):
        box = (round(fw * x0), round(fh * y0), round(fw * x1), round(fh * y1))
        band = figure.crop(box).copy()
        band = feather_band(band, top, bottom, feather)
        save_webp(band, rig_dir / f"{name}.webp")
        meta["layers"][name] = {
            "x": round(x0 * 100, 2), "y": round(y0 * 100, 2),
            "w": round((x1 - x0) * 100, 2), "h": round((y1 - y0) * 100, 2),
            "pivot": [round(pivot[0] * 100, 1), round(pivot[1] * 100, 1)],
        }

    h0, h1 = bands["head"]
    t0, t1 = bands["torso"]
    l0, l1 = bands["legs"]
    cut("head_base", h0, h1, bottom=True, pivot=(0.5, 0.9))
    cut("torso_base", t0, t1, top=True, bottom=True, pivot=(0.5, 0.85))
    cut("limb_left_leg", l0, l1, 0.0, 0.52, top=True, pivot=(0.5, 0.12))
    cut("limb_right_leg", l0, l1, 0.48, 1.0, top=True, pivot=(0.5, 0.12))

    # The whole figure too, for the places that want it unhinged.
    save_webp(figure, rig_dir / "figure.webp")

    # The four poses.
    sheet = Image.open(SOURCE / "motion" / f"{cid}.jpeg").convert("RGB")
    sw, sh = sheet.size
    for i, pose in enumerate(POSES):
        col, row = i % 2, i // 2
        cell = sheet.crop((col * sw // 2, row * sh // 2, (col + 1) * sw // 2, (row + 1) * sh // 2))
        cell = fit_width(cell, 640)
        cell = flood_white_to_alpha(cell)
        bb = cell.getchannel("A").getbbox()
        if bb:
            cell = cell.crop(bb)
        # Centre on a square canvas with headroom, so no pose is ever
        # cropped at the top of its frame.
        scale = min((POSE_SIZE - 24) / cell.width, (POSE_SIZE - 24) / cell.height)
        cell = cell.resize((max(1, round(cell.width * scale)), max(1, round(cell.height * scale))), Image.LANCZOS)
        canvas = Image.new("RGBA", (POSE_SIZE, POSE_SIZE), (255, 255, 255, 0))
        canvas.alpha_composite(cell, ((POSE_SIZE - cell.width) // 2, POSE_SIZE - cell.height - 8))
        save_webp(canvas, rig_dir / f"pose_{pose}.webp")

    (rig_dir / "rig.json").write_text(json.dumps(meta, indent=1) + "\n")
    return meta


def build_facilities() -> list:  # not called: places/ are moodboards, the rooms are tilemaps
    src = Image.open(SOURCE / "places" / "workshop.jpeg").convert("RGB")
    w, h = src.size
    out = []
    for i, name in enumerate(FACILITIES):
        col, row = i % 2, i // 2
        cell = src.crop((col * w // 2, row * h // 2, (col + 1) * w // 2, (row + 1) * h // 2))
        cell = fit_width(cell, 900)
        # Each room is a die-cut diorama on white: the white goes, the
        # sticker border stays, and the frame is trimmed to the room
        # with a margin, so nothing is ever cut at an edge.
        cell = flood_white_to_alpha(cell)
        bb = cell.getchannel("A").getbbox()
        if bb:
            pad = 10
            cell = cell.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(cell.width, bb[2] + pad), min(cell.height, bb[3] + pad)))
        save_webp(cell, OUT / "places" / f"facility_{name}.webp", 88)
        cell.save(OUT / "places" / f"facility_{name}.png", "PNG", optimize=True)
        out.append(f"facility_{name}")
    return out


def main() -> int:
    if not SOURCE.is_dir():
        print(f"source assets not found: {SOURCE}")
        return 1
    rigs = {}
    for cid in CHARACTERS:
        build_face(cid)
        rigs[cid] = build_rig(cid)
        print(f"  {cid}: face + rig ({rigs[cid]['width']}x{rigs[cid]['height']})")

    # One module the components import, so the layer geometry is not
    # fetched at run time.
    data_dir = ROOT / "frontend" / "src" / "features" / "koban-shop" / "data"
    (data_dir / "rigs.js").write_text(
        "// Generated by scripts/build_unity_koban_assets.py. Do not edit.\n"
        "export default " + json.dumps(rigs, indent=1) + ";\n"
    )
    print("built the unity koban assets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
