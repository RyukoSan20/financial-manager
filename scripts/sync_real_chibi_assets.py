#!/usr/bin/env python3
"""
Copy the real Koban & Co. artwork into the application.

THE ASSETS ARE THE POINT.

The six characters were drawn as high-resolution chibi illustrations -
a sticker of one pose for each, and a sheet of four poses for each.
They are the artwork the shop is made of. Drawing a substitute for
them - a procedural pixel body, a blocky SVG - throws away the thing
that makes the shop look like the shop, so this script does not draw
anything at all. It moves the real pictures into place and cuts the
pieces the application needs out of them.

WHAT IT PRODUCES.

    frontend/public/koban-assets/
      chara/<id>.png        the sticker, outer white made transparent
      chara/<id>@2x.png     the same, for the retina screens
      face/<id>.png        a 1:1 head portrait
      motion/<id>.png      the four-pose sheet, cut into four frames
      motion/<id>_<pose>.png   one frame of that sheet
      places/<room>.jpg    the room photographs

THE WHITE FLOOD.

The character stickers sit on solid white with a white die-cut border
around the figure. The outer white has to go, or the character shows
as a white rectangle. The border has to stay, or the character loses
the sticker edge that makes it read as a sticker.

So the fill starts at the edge of the picture and only takes the
white it can reach. The border is an island of white that the fill
never reaches, because the figure's own outline is in the way. That
is the whole trick, and it is why the threshold matters: at 242 the
white inside the figure - the shine on an eye, the page of a book -
is also taken, and at 254 only the pure white goes. 240 keeps the
warm off-white of the paper and gives up the ground.

Run with:
    python3 scripts/sync_real_chibi_assets.py
"""

import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "mini-games" / "Koban & Co. General Goods" / "asset"
OUT = ROOT / "frontend" / "public" / "koban-assets"

CHARACTERS = ["koneko", "minori", "kaneru", "kogane", "mone", "zenimaru"]

# The poses in the motion sheet, in reading order: the sheet is a
# 2x2 grid, so the top-left is pose one.
POSES = ["happy", "walking", "sweating", "thinking"]

# The rooms.
PLACES = ["atelier", "workshop"]

# The white threshold. Below this the warm paper is left alone.
WHITE_THRESHOLD = 240

# What a browser actually needs. The sources are 1792x2400; shipped at
# that size every page would pull ~4 MB per companion. A companion is
# never drawn taller than ~360 CSS px, so 2x of that is plenty.
STICKER_WIDTH = 600        # chara/<id>.png and chara/<id>.webp
POSE_HEIGHT = 480          # motion/<id>_<pose>.webp
FACE_SIZE = 256            # face/<id>.png and face/<id>.webp


def fit_width(img, width):
    if img.width <= width:
        return img
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def fit_height(img, height):
    if img.height <= height:
        return img
    return img.resize((round(img.width * height / img.height), height), Image.LANCZOS)


def save_pair(img, png_path, webp=True, png=True):
    png_path.parent.mkdir(parents=True, exist_ok=True)
    if png:
        img.save(png_path, "PNG", optimize=True)
    if webp:
        img.save(png_path.with_suffix(".webp"), "WEBP", quality=86, method=6)


def strip_outer_white(src: Path, dst: Path, threshold: int = WHITE_THRESHOLD) -> None:
    """Make the outer white ground transparent, and keep the border.

    A flood fill from the edge of the picture. Only the white the
    fill can reach becomes transparent, so the die-cut border - an
    island of white inside the figure's own outline - survives.
    """
    img = Image.open(src).convert("RGBA")
    width, height = img.size
    pixels = img.load()

    visited = bytearray(width * height)
    queue = deque()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    transparent = []
    while queue:
        x, y = queue.popleft()
        if x < 0 or x >= width or y < 0 or y >= height:
            continue
        index = y * width + x
        if visited[index]:
            continue
        visited[index] = 1
        r, g, b, _ = pixels[x, y]
        if r >= threshold and g >= threshold and b >= threshold:
            transparent.append((x, y))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and not visited[ny * width + nx]:
                    queue.append((nx, ny))

    for x, y in transparent:
        pixels[x, y] = (255, 255, 255, 0)

    img = fit_width(img, STICKER_WIDTH)
    save_pair(img, dst)


def crop_face(src: Path, dst: Path, size: int = FACE_SIZE) -> None:
    """Cut a 1:1 head portrait out of the character sticker.

    The head is in the top part of the picture. The crop is taken from
    the transparent sticker, so the ground is gone, and it is squared
    up on the head's own centre so a character in a wide hat is not
    cropped to one side.
    """
    img = Image.open(src).convert("RGBA")
    width, height = img.size

    # The head is the top 48% of a chibi sticker.
    head_bottom = int(height * 0.48)
    head = img.crop((0, 0, width, head_bottom))

    alpha = head.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        left, right = bbox[0], bbox[2]
        centre = (left + right) / 2
        # The square is as wide as the head is tall, but at least as
        # wide as the head itself, so the ears and the hat are in.
        side = max(head_bottom, right - left)
        box_left = int(max(0, min(width - side, centre - side / 2)))
        crop = head.crop((box_left, 0, box_left + side, head_bottom))
    else:
        crop = head

    w, h = crop.size
    side = min(w, h)
    crop = crop.crop(((w - side) // 2, 0, (w - side) // 2 + side, side))

    canvas = Image.new("RGBA", (side, side), (255, 255, 255, 255))
    canvas.alpha_composite(crop, ((side - crop.width) // 2, 0))
    canvas = canvas.resize((size, size), Image.LANCZOS)

    save_pair(canvas, dst)


def split_motion(src: Path, dst_dir: Path, char_id: str) -> dict:
    """Cut the four-pose sheet into four separate pictures.

    The sheet is a 2x2 grid on white. Each pose is cut out, the white
    around it is taken away, and each one is saved on its own so the
    application can switch expression by changing the source.
    """
    img = Image.open(src).convert("RGB")
    width, height = img.size
    half_w, half_h = width // 2, height // 2

    dst_dir.mkdir(parents=True, exist_ok=True)

    poses = {}
    for index, pose in enumerate(POSES):
        col, row = index % 2, index // 2
        cell = img.crop((col * half_w, row * half_h, (col + 1) * half_w, (row + 1) * half_h))

        # The ground of one cell is white, so it can be made
        # transparent on its own.
        cell = cell.convert("RGBA")
        pixels = cell.load()
        cw, ch = cell.size
        visited = bytearray(cw * ch)
        queue = deque()
        for x in range(cw):
            queue.append((x, 0))
            queue.append((x, ch - 1))
        for y in range(ch):
            queue.append((0, y))
            queue.append((cw - 1, y))
        while queue:
            x, y = queue.popleft()
            if x < 0 or x >= cw or y < 0 or y >= ch:
                continue
            idx = y * cw + x
            if visited[idx]:
                continue
            visited[idx] = 1
            r, g, b, _ = pixels[x, y]
            if r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD:
                pixels[x, y] = (255, 255, 255, 0)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < cw and 0 <= ny < ch and not visited[ny * cw + nx]:
                        queue.append((nx, ny))

        # Trim the empty margin, so the picture is the figure and not
        # the space around it.
        bbox = cell.getchannel("A").getbbox()
        if bbox:
            cell = cell.crop(bbox)

        cell = fit_height(cell, POSE_HEIGHT)
        path = dst_dir / f"{char_id}_{pose}.webp"
        cell.save(path, "WEBP", quality=86, method=6)
        poses[pose] = path.name

    # The whole sheet, on white, as the document it is.
    dst_dir.mkdir(parents=True, exist_ok=True)
    sheet = fit_width(Image.open(src).convert("RGB"), 1024)
    sheet.save(dst_dir / f"{char_id}_sheet.jpg", "JPEG", quality=88, optimize=True, progressive=True)

    return poses


def copy_place(src: Path, dst: Path, width: int = 1600) -> None:
    """A room photograph, scaled down to something a browser likes."""
    img = Image.open(src).convert("RGB")
    if img.width > width:
        height = int(img.height * width / img.width)
        img = img.resize((width, height), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "JPEG", quality=86, optimize=True, progressive=True)


def main() -> int:
    if not SOURCE.is_dir():
        print(f"source assets not found: {SOURCE}")
        return 1

    # Poses used to be written as PNG; they are WebP now.
    for stale in (OUT / "motion").glob("*_*.png"):
        stale.unlink()

    report = {"chara": [], "face": [], "motion": [], "places": []}

    for cid in CHARACTERS:
        src = SOURCE / "chara" / f"{cid}.jpeg"
        if not src.is_file():
            print(f"  MISSING {src}")
            continue
        dst = OUT / "chara" / f"{cid}.png"
        strip_outer_white(src, dst)
        report["chara"].append(dst.name)

        face_dst = OUT / "face" / f"{cid}.png"
        crop_face(dst, face_dst)  # from the shipped sticker (600 px is plenty for 256)
        report["face"].append(face_dst.name)

    for cid in CHARACTERS:
        src = SOURCE / "motion" / f"{cid}.jpeg"
        if not src.is_file():
            print(f"  MISSING {src}")
            continue
        poses = split_motion(src, OUT / "motion", cid)
        report["motion"].append({cid: poses})

    for place in PLACES:
        src = SOURCE / "places" / f"{place}.jpeg"
        if not src.is_file():
            print(f"  MISSING {src}")
            continue
        dst = OUT / "places" / f"{place}.jpg"
        copy_place(src, dst)
        report["places"].append(dst.name)

    print(json.dumps(report, indent=1))
    print("\nsynced the real artwork")
    return 0


if __name__ == "__main__":
    sys.exit(main())
