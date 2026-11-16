#!/usr/bin/env python3
"""
Draw the pixel-art sprite sheets for the six companions of Koban & Co.

WHY THIS IS CODE AND NOT A PICTURE.

The six characters were drawn as smooth chibi illustrations. A game
wants sprite sheets: the same character in a walk cycle, breathing, and
with their hands in the air. That means either an image model or a
painter's hand - and the first is not available here, and the second
does not reproduce.

So the sprites are drawn from numbers, the same way the rest of this
project's artwork is (see scripts/generate_assets.py). Each character
keeps the colours and the silhouette of their design - Koneko's cat
hood and bell, Kogane's long gold hair and pocket watch, Mone's straw
hat and twin braids, Zenimaru's brown hair and indigo cap, Minori's
mauve braid and flower clip, Kaneru's indigo robe and abacus pouch.
What changes between frames is the pose, and the pose is a function
of the frame number.

THE SHEET.

    4 rows x 3 columns, on pure white.

    row 1  idle        3 frames, a gentle breathing bounce
    row 2  walk        4 frames, a side-view cycle of small steps
    row 3  celebrate   3 frames, hands up, eyes sparkling
    row 4  work        2 frames, arms to the counter

The walk row is a side view and the rest are front views, so the walk
frames are drawn as a narrower profile rather than the front pose
squashed sideways - a squashed front view reads as a glitch, not a
step.

HOW IT IS DRAWN.

Everything is drawn on a 24x32 logical grid and then doubled with
nearest-neighbour, so one logical pixel is a 2x2 block of real
pixels. That is what makes it read as pixel art instead of a small
smooth drawing: the steps are visible.

After the character is drawn, one pass goes round the outside and
paints a dark warm brown outline wherever a filled pixel touches an
empty one. Doing it as a pass rather than by hand means every
character gets the same weight of outline everywhere, and no shape can
merge into its neighbour.

OUTLINES.

Dark warm brown, never black. A black outline on a warm pastel
palette reads as a sticker cut out with scissors; a brown one reads
as a drawing.

Run with:
    python3 scripts/generate_koban_sprites.py            # write
    python3 scripts/generate_koban_sprites.py --check    # check
"""

import argparse
import hashlib
import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "frontend" / "public" / "koban-assets" / "sprites"

# The logical grid. Everything is drawn here and doubled afterwards.
LOG_W, LOG_H = 24, 32
SCALE = 2

FRAME_W, FRAME_H = LOG_W * SCALE, LOG_H * SCALE
COLS, ROWS = 3, 4
SHEET_W, SHEET_H = FRAME_W * COLS, FRAME_H * ROWS

ROW_IDLE, ROW_WALK, ROW_CELEBRATE, ROW_WORK = 0, 1, 2, 3
ROW_NAMES = {ROW_IDLE: "idle", ROW_WALK: "walk", ROW_CELEBRATE: "celebrate", ROW_WORK: "work"}
ROW_FRAMES = {ROW_IDLE: 3, ROW_WALK: 4, ROW_CELEBRATE: 3, ROW_WORK: 2}

# The outline colour, and the paper the sheet sits on.
OUTLINE = "#4A2A22"
PAPER = "#FFFFFF"


# ---------------------------------------------------------------------------
# The palettes
# ---------------------------------------------------------------------------

# Every palette carries the same keys, so the renderer never has to
# know which character it is drawing. The values come from the
# character illustrations.
#
#   hair       hair base, hair shadow, hair light
#   eye        iris top, iris bottom, shine
#   skin       skin, skin shadow, blush
#   cloth      the main garment, its shadow, its trim
#   cloth2     the second garment colour, for the parts that overlap
#   accent     the one loud colour: Koneko's bell, Kogane's watch
#   prop       the thing they hold, and its shine
#
PALETTES = {
    "koneko": {
        # Peach hair, a cream cat hood, a peach dress, a red collar and
        # a gold bell. Green eyes.
        "hair": ("#F2A87C", "#CE7A52", "#FFE0C4"),
        "eye": ("#3E9E52", "#F2C544", "#FFFFFF"),
        "skin": ("#FFE0CC", "#E8B294", "#F2867C"),
        "cloth": ("#FFF3DC", "#E0BE9C", "#F6A78C"),
        "cloth2": ("#F8C8AE", "#D99A80", "#B87058"),
        "accent": ("#E24B3C", "#A82C22"),
        "prop": ("#F7C93F", "#FFF0B8"),
        "hood": "#FFF8EC",
        "hood_inner": "#F2A7A7",
        "hair_style": "short",
    },
    "minori": {
        # Mauve hair, a cream knit sweater, a lavender dress, a gold
        # flower clip, a basket of stars. Violet eyes.
        "hair": ("#9B6A86", "#6E4460", "#D3A0B8"),
        "eye": ("#7E5CBA", "#D9C2F2", "#FFFFFF"),
        "skin": ("#FFE3D2", "#EBB99E", "#EE8C86"),
        "cloth": ("#FFF7EC", "#DCC7BA", "#D8B8C8"),
        "cloth2": ("#B89AD8", "#8E6CB0", "#654A88"),
        "accent": ("#F0C64A", "#B98C1E"),
        "prop": ("#E0A857", "#FFE9B8"),
        "hood": None,
        "hood_inner": None,
        "hair_style": "wavy",
    },
    "kaneru": {
        # Brown hair under an indigo cap, a blue-lavender robe, a
        # cream apron, an abacus pouch. Amber eyes.
        "hair": ("#7A4A2E", "#4C2C1C", "#A87050"),
        "eye": ("#C06A22", "#F5C24A", "#FFFFFF"),
        "skin": ("#FFE3D0", "#E8B49A", "#EA8880"),
        "cloth": ("#7C8AD0", "#455298", "#C3CBEE"),
        "cloth2": ("#FFF2DC", "#D6BE9C", "#A88E70"),
        "accent": ("#E8B23E", "#A87514"),
        "prop": ("#E8C05A", "#FFF3C4"),
        "hood": None,
        "hood_inner": None,
        "hair_style": "short",
    },
    "kogane": {
        # Long gold hair, an ivory and gold dress, a gold pocket watch,
        # burgundy bows. Amber-gold eyes.
        "hair": ("#F0C878", "#C08E38", "#FFECC4"),
        "eye": ("#A96A20", "#F7D063", "#FFFFFF"),
        "skin": ("#FFE6D6", "#EDBCA2", "#EE8E88"),
        "cloth": ("#FFF6E4", "#D6BC90", "#B88A46"),
        "cloth2": ("#F5E3C0", "#C09E68", "#986C32"),
        "accent": ("#8E3140", "#5E1A24"),
        "prop": ("#F2C74E", "#FFF6CC"),
        "hood": None,
        "hood_inner": None,
        "hair_style": "long",
    },
    "mone": {
        # Rosy hair in twin braids, a straw hat, a cream top, a sky
        # blue skirt, a potion bottle. Amber eyes.
        "hair": ("#E88E8E", "#B25A60", "#F7BEBE"),
        "eye": ("#A96A20", "#F5C24A", "#FFFFFF"),
        "skin": ("#FFE6D6", "#EDBCA2", "#EE8E88"),
        "cloth": ("#FFF4E0", "#DCC3A6", "#D6B99C"),
        "cloth2": ("#8FC4E8", "#528FC0", "#EAF4FA"),
        "accent": ("#6E8FD6", "#48609C"),
        "prop": ("#C8E8D8", "#FFF8E0"),
        "hood": "#F5E4B4",
        "hood_inner": "#CFAE74",
        "hair_style": "braids",
    },
    "zenimaru": {
        # Light brown hair with two tufts, a cream cardigan, a sage
        # ribbon, a charcoal skirt, a book and a tuning fork. Green
        # eyes.
        "hair": ("#A8896A", "#705038", "#D8BE9C"),
        "eye": ("#2A7042", "#8FD8A8", "#FFFFFF"),
        "skin": ("#FFE4D2", "#EDB99E", "#EE8E88"),
        "cloth": ("#F6E6CE", "#CFB794", "#9E8A68"),
        "cloth2": ("#4A5058", "#2E333A", "#6E767E"),
        "accent": ("#7EA86A", "#4F7340"),
        "prop": ("#C8A05A", "#F5E0AE"),
        "hair_style": "wavy",
        "hood": None,
        "hood_inner": None,
    },
}


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------


def shade(colour, amount):
    """Darken (amount < 0) or lighten (amount > 0) a hex colour."""
    r = int(colour[1:3], 16)
    g = int(colour[3:5], 16)
    b = int(colour[5:7], 16)
    if amount >= 0:
        r += (255 - r) * amount
        g += (255 - g) * amount
        b += (255 - b) * amount
    else:
        r *= 1 + amount
        g *= 1 + amount
        b *= 1 + amount
    return f"#{int(r):02X}{int(g):02X}{int(b):02X}"


class Pen:
    """A tiny logical pixel canvas. Nothing anti-aliased, nothing smooth."""

    def __init__(self, width=LOG_W, height=LOG_H):
        self.w = width
        self.h = height
        self.img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def px(self, x, y, colour):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.d.point((int(x), int(y)), colour)

    def rect(self, x0, y0, x1, y1, colour):
        """A filled rectangle, inclusive of both corners.

        The corners are sorted, so a rectangle can be given in either
        direction without the caller having to think about it.
        """
        x0, x1 = sorted((x0, x1))
        y0, y1 = sorted((y0, y1))
        self.d.rectangle([x0, y0, x1, y1], fill=colour)

    def ellipse(self, cx, cy, rx, ry, colour):
        self.d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=colour)

    def poly(self, points, colour):
        self.d.polygon(points, fill=colour)

    def line(self, x0, y0, x1, y1, colour):
        self.d.line([x0, y0, x1, y1], fill=colour)

    def outline(self, colour=OUTLINE):
        """Paint a one logical pixel outline around everything drawn."""
        src = self.img
        w, h = src.size
        src_px = src.load()
        out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        out_px = out.load()
        r = int(colour[1:3], 16)
        g = int(colour[3:5], 16)
        b = int(colour[5:7], 16)

        for y in range(h):
            for x in range(w):
                if src_px[x, y][3] > 0:
                    out_px[x, y] = src_px[x, y]

        for y in range(h):
            for x in range(w):
                if src_px[x, y][3] > 0:
                    continue
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and src_px[nx, ny][3] > 0:
                        out_px[x, y] = (r, g, b, 255)
                        break
        self.img = out
        self.d = ImageDraw.Draw(out)

    def scaled(self):
        """The logical grid doubled, nearest-neighbour."""
        return self.img.resize((self.w * SCALE, self.h * SCALE), Image.NEAREST)


# ---------------------------------------------------------------------------
# The body
# ---------------------------------------------------------------------------
#
# The body is drawn from the back forward: the hair mass behind the
# shoulders, then the legs, the torso, the arms, then the head, the
# face, and the hair over the face. That order is what makes the
# overlaps right - long hair falls behind the body and in front of the
# shoulders, and the fringe falls over the forehead.
#
# The proportions are the same in every pose: the head is 12 of the 30
# rows, which is about 40 percent, which is what chibi means.

HEAD_CX = 12
HEAD_CY = 8
HEAD_RX = 6
HEAD_RY = 6

SHOULDER_Y = 15
HIP_Y = 23
FOOT_Y = 29


def draw_hair_back(pen, pal, bob):
    """The hair behind the body.

    The shape is a per-character thing, not just a colour: a long fall
    down the back, twin braids, a short crop. Two characters with the
    same hair colour still have to be told apart by their outline.
    """
    hair, hair_shade, _ = pal["hair"]
    style = pal.get("hair_style", "long")

    # The mass around the head, for everyone.
    pen.ellipse(HEAD_CX, HEAD_CY, HEAD_RX + 1, HEAD_RY + 1, hair)

    if style == "long":
        # A long fall down the back, past the hips.
        for side in (-1, 1):
            x0 = HEAD_CX + side * 7
            pen.rect(min(x0, x0 + side * 2), HEAD_CY + 2, max(x0, x0 + side * 2), HEAD_CY + 14, hair)
            pen.px(x0, HEAD_CY + 10, hair_shade)
    elif style == "braids":
        # Two braids, chunky and segmented.
        for side in (-1, 1):
            x0 = HEAD_CX + side * 8
            for seg in range(5):
                y = HEAD_CY + 4 + seg * 3
                pen.ellipse(x0, y, 2, 2, hair)
                pen.px(x0, y + 1, hair_shade)
    elif style == "short":
        # A short crop with a flick at the jaw.
        for side in (-1, 1):
            x0 = HEAD_CX + side * 6
            pen.rect(min(x0, x0 + side * 2), HEAD_CY - 2, max(x0, x0 + side * 2), HEAD_CY + 5, hair)
    elif style == "wavy":
        # Wavy side locks that flare out.
        for side in (-1, 1):
            x0 = HEAD_CX + side * 7
            pen.rect(min(x0, x0 + side * 2), HEAD_CY + 2, max(x0, x0 + side * 2), HEAD_CY + 7, hair)
            pen.ellipse(x0 + side * 2, HEAD_CY + 9, 2, 2, hair)
            pen.px(x0, HEAD_CY + 9, hair_shade)
    elif style == "swept":
        # Swept up and to one side.
        pen.rect(HEAD_CX - 8, HEAD_CY - 2, HEAD_CX - 5, HEAD_CY + 4, hair)
        pen.ellipse(HEAD_CX - 8, HEAD_CY + 5, 2, 2, hair)


def draw_legs(pen, pal, bob, front_leg=0, back_leg=0):
    """Two legs. The offsets move them forward and back for the walk."""
    skin, _, _ = pal["skin"]
    _, _, trim = pal["cloth"]
    for side, off in ((-1, back_leg), (1, front_leg)):
        x = HEAD_CX + side * 3
        pen.rect(x - 1, HIP_Y, x + 1, FOOT_Y - 2 + off, skin)
        pen.rect(x - 2, FOOT_Y - 2 + off, x + 2, FOOT_Y + off, OUTLINE)
        pen.px(x, FOOT_Y - 1 + off, shade(trim, 0.15))


def draw_torso(pen, pal, bob, lean=0):
    """The chest and the skirt."""
    cloth, cloth_shadow, trim = pal["cloth"]
    cloth2, cloth2_shadow, cloth2_trim = pal["cloth2"]

    # The torso.
    pen.rect(HEAD_CX - 5 + lean, SHOULDER_Y, HEAD_CX + 5 + lean, HIP_Y, cloth)
    pen.rect(HEAD_CX + 2 + lean, SHOULDER_Y, HEAD_CX + 5 + lean, HIP_Y, cloth_shadow)

    # The garment over it, flaring out.
    pen.rect(HEAD_CX - 7 + lean, HIP_Y - 4, HEAD_CX + 7 + lean, HIP_Y + 2, cloth2)
    pen.rect(HEAD_CX + 4 + lean, HIP_Y - 4, HEAD_CX + 7 + lean, HIP_Y + 2, cloth2_shadow)
    pen.rect(HEAD_CX - 7 + lean, HIP_Y + 1, HEAD_CX + 7 + lean, HIP_Y + 2, cloth2_trim)


def draw_arms(pen, pal, bob, pose, lean=0):
    """The arms. The pose decides where they go."""
    cloth, cloth_shadow, _ = pal["cloth"]
    skin, _, _ = pal["skin"]

    def arm(x, y0, y1, hand_y=None, hand_x=None):
        pen.rect(x - 1, y0, x + 1, y1, cloth)
        pen.px(x, y1 + 1, cloth_shadow)
        hx = x if hand_x is None else hand_x
        hy = y1 + 2 if hand_y is None else hand_y
        pen.ellipse(hx, hy, 1, 1, skin)

    if pose == "down":
        for side in (-1, 1):
            arm(HEAD_CX + side * 7 + lean, SHOULDER_Y + 1, SHOULDER_Y + 7)
    elif pose == "up":
        # Raised over the head, the hands open.
        for side in (-1, 1):
            arm(HEAD_CX + side * 8 + lean, HEAD_CY - 2, SHOULDER_Y + 1)
    elif pose == "work":
        # Both hands forward onto the counter.
        for side in (-1, 1):
            arm(HEAD_CX + side * 6 + lean, SHOULDER_Y + 3, SHOULDER_Y + 5, SHOULDER_Y + 5, HEAD_CX + side * 5)
    elif pose == "swing":
        pass  # the walk frames draw their own arms


def draw_head(pen, pal, bob, expr="smile", sparkle=False, side=False):
    """The head: skin, the face, the fringe."""
    skin, skin_shadow, blush = pal["skin"]
    hair, hair_shade, hair_light = pal["hair"]

    cy = HEAD_CY + bob

    if side:
        # A profile: narrower, and the face points right.
        pen.ellipse(HEAD_CX, cy, 5, HEAD_RY, skin)
        pen.rect(HEAD_CX - 4, cy + 3, HEAD_CX + 5, cy + 5, skin)
    else:
        pen.ellipse(HEAD_CX, cy, HEAD_RX, HEAD_RY, skin)
        pen.ellipse(HEAD_CX, cy + 4, 5, 4, skin)

    # The fringe, over the top of the face. It must not reach the eyes.
    pen.rect(HEAD_CX - 6, cy - 6, HEAD_CX + 6, cy - 4, hair)
    pen.rect(HEAD_CX - 6, cy - 4, HEAD_CX - 4, cy - 2, hair)
    pen.rect(HEAD_CX + 4, cy - 4, HEAD_CX + 6, cy - 2, hair)
    # A light band across the crown.
    pen.rect(HEAD_CX - 3, cy - 6, HEAD_CX + 2, cy - 6, hair_light)
    # Shadow under the fringe.
    pen.rect(HEAD_CX - 5, cy - 3, HEAD_CX + 5, cy - 3, shade(skin, -0.12))

    # The eyes.
    eye_y = cy + 1
    if side:
        _one_eye(pen, pal, HEAD_CX + 2, eye_y, sparkle)
    else:
        _eyes(pen, pal, eye_y, sparkle)

    # The cheeks, the nose, the mouth.
    if not side:
        pen.px(HEAD_CX - 4, cy + 3, blush)
        pen.px(HEAD_CX + 4, cy + 3, blush)
    pen.px(HEAD_CX + (1 if side else 0), cy + 3, shade(skin, -0.35))
    _mouth(pen, pal, HEAD_CX + (1 if side else 0), cy + 4, expr)


def _eyes(pen, pal, cy, sparkle):
    iris_top, iris_bottom, shine = pal["eye"]
    for sx in (HEAD_CX - 3, HEAD_CX + 3):
        # The white of the eye.
        pen.ellipse(sx, cy, 2, 2, "#FFFFFF")
        # The iris.
        pen.ellipse(sx, cy, 1, 2, iris_top)
        pen.px(sx, cy + 1, iris_bottom)
        # The lash line on top.
        pen.rect(sx - 2, cy - 2, sx + 2, cy - 2, OUTLINE)
        # The shine.
        pen.px(sx - 1, cy - 1, shine)
        if sparkle:
            pen.px(sx, cy + 1, shine)
            pen.px(sx - 1, cy, shine)
            pen.px(sx + 1, cy, shine)


def _one_eye(pen, pal, cx, cy, sparkle):
    iris_top, iris_bottom, shine = pal["eye"]
    pen.ellipse(cx, cy, 2, 2, "#FFFFFF")
    pen.ellipse(cx, cy, 1, 2, iris_top)
    pen.px(cx, cy + 1, iris_bottom)
    pen.rect(cx - 2, cy - 2, cx + 2, cy - 2, OUTLINE)
    pen.px(cx + 1, cy - 1, shine)
    if sparkle:
        pen.px(cx, cy + 1, shine)


def _mouth(pen, pal, cx, cy, expr):
    if expr == "smile":
        pen.rect(cx - 1, cy, cx + 1, cy, OUTLINE)
        pen.px(cx - 2, cy - 1, OUTLINE)
        pen.px(cx + 2, cy - 1, OUTLINE)
    elif expr == "open":
        pen.ellipse(cx, cy, 1, 1, OUTLINE)
    elif expr == "flat":
        pen.rect(cx - 1, cy, cx + 1, cy, OUTLINE)


def draw_signature(pen, pal, bob, kind):
    """The one accessory that says who this is. It never covers the face."""
    hair, hair_shade, hair_light = pal["hair"]
    accent, accent_dark = pal["accent"]
    cy = HEAD_CY + bob

    if kind == "cat_hood":
        # Koneko: a cream hood framing the face, pink ears on top, and
        # a red collar with a gold bell.
        hood = pal["hood"]
        inner = pal["hood_inner"]
        # The hood is a frame: the crown and the two sides.
        pen.rect(HEAD_CX - 7, cy - 7, HEAD_CX + 7, cy - 5, hood)
        pen.rect(HEAD_CX - 7, cy - 7, HEAD_CX - 5, cy - 1, hood)
        pen.rect(HEAD_CX + 5, cy - 7, HEAD_CX + 7, cy - 1, hood)
        # The ears.
        pen.poly([(HEAD_CX - 7, cy - 6), (HEAD_CX - 4, cy - 10), (HEAD_CX - 1, cy - 6)], hood)
        pen.poly([(HEAD_CX + 7, cy - 6), (HEAD_CX + 4, cy - 10), (HEAD_CX + 1, cy - 6)], hood)
        pen.poly([(HEAD_CX - 5, cy - 7), (HEAD_CX - 4, cy - 9), (HEAD_CX - 3, cy - 7)], inner)
        pen.poly([(HEAD_CX + 5, cy - 7), (HEAD_CX + 4, cy - 9), (HEAD_CX + 3, cy - 7)], inner)
        # The collar and the bell, below the chin.
        pen.rect(HEAD_CX - 4, cy + 6, HEAD_CX + 4, cy + 7, accent)
        pen.ellipse(HEAD_CX, cy + 8, 1, 1, "#F7C93F")
        pen.px(HEAD_CX, cy + 8, "#FFF0B8")
    elif kind == "flower":
        # Minori: the gold flower in her hair.
        pen.ellipse(HEAD_CX + 5, cy - 4, 1, 1, accent)
        pen.px(HEAD_CX + 4, cy - 5, accent)
        pen.px(HEAD_CX + 6, cy - 5, accent)
        pen.px(HEAD_CX + 5, cy - 3, accent)
        pen.px(HEAD_CX + 5, cy - 4, shade(accent, 0.4))
    elif kind == "cap":
        # Kaneru: an indigo beret and a tie hanging off it.
        cloth2, cloth2_shadow, _ = pal["cloth2"]
        pen.ellipse(HEAD_CX, cy - 6, 7, 3, cloth2)
        pen.rect(HEAD_CX - 7, cy - 6, HEAD_CX + 7, cy - 6, cloth2)
        pen.rect(HEAD_CX - 7, cy - 5, HEAD_CX - 3, cy - 5, cloth2_shadow)
        pen.rect(HEAD_CX + 5, cy - 5, HEAD_CX + 8, cy - 1, cloth2_shadow)
    elif kind == "bow":
        # Kogane: burgundy bows at the sides of the hair.
        pen.poly([(HEAD_CX - 7, cy), (HEAD_CX - 10, cy - 2), (HEAD_CX - 10, cy + 2)], accent)
        pen.poly([(HEAD_CX + 7, cy), (HEAD_CX + 10, cy - 2), (HEAD_CX + 10, cy + 2)], accent)
        pen.px(HEAD_CX - 7, cy, accent_dark)
        pen.px(HEAD_CX + 7, cy, accent_dark)
    elif kind == "hat":
        # Mone: a wide straw hat with a blue band.
        hat, hat_shade = pal["hood"], pal["hood_inner"]
        pen.ellipse(HEAD_CX, cy - 5, 10, 2, hat)
        pen.rect(HEAD_CX - 10, cy - 5, HEAD_CX + 10, cy - 5, hat)
        pen.ellipse(HEAD_CX, cy - 7, 6, 3, hat)
        pen.rect(HEAD_CX - 6, cy - 4, HEAD_CX + 6, cy - 4, accent)
        pen.px(HEAD_CX - 3, cy - 9, "#FFFFFF")
    elif kind == "tufts":
        # Zenimaru: two little tufts on the crown.
        pen.rect(HEAD_CX - 3, cy - 9, HEAD_CX - 2, cy - 6, hair)
        pen.rect(HEAD_CX + 2, cy - 10, HEAD_CX + 3, cy - 6, hair)


def draw_prop(pen, pal, bob, kind):
    """The thing they hold. This is what identifies them at a glance."""
    accent, accent_dark = pal["accent"]
    prop, prop_shine = pal["prop"]

    if kind == "bell":
        pen.ellipse(HEAD_CX, HIP_Y - 6, 2, 2, "#F7C93F")
        pen.px(HEAD_CX, HIP_Y - 6, accent_dark)
    elif kind == "basket":
        pen.rect(HEAD_CX - 4, HIP_Y - 8, HEAD_CX + 4, HIP_Y - 4, prop)
        pen.rect(HEAD_CX - 4, HIP_Y - 8, HEAD_CX + 4, HIP_Y - 7, shade(prop, -0.25))
        pen.px(HEAD_CX, HIP_Y - 9, accent)
        pen.px(HEAD_CX - 1, HIP_Y - 9, prop_shine)
    elif kind == "watch":
        pen.ellipse(HEAD_CX, HIP_Y - 7, 2, 2, prop)
        pen.ellipse(HEAD_CX, HIP_Y - 7, 1, 1, "#FFFDF0")
    elif kind == "abacus":
        pen.rect(HEAD_CX - 4, HIP_Y - 9, HEAD_CX + 4, HIP_Y - 5, accent)
        pen.rect(HEAD_CX - 3, HIP_Y - 8, HEAD_CX + 3, HIP_Y - 8, OUTLINE)
        pen.px(HEAD_CX - 2, HIP_Y - 8, prop)
        pen.px(HEAD_CX + 1, HIP_Y - 8, prop)
    elif kind == "bottle":
        pen.rect(HEAD_CX - 2, HIP_Y - 9, HEAD_CX + 2, HIP_Y - 5, prop)
        pen.rect(HEAD_CX - 1, HIP_Y - 11, HEAD_CX + 1, HIP_Y - 9, shade(prop, -0.2))
        pen.px(HEAD_CX, HIP_Y - 7, "#F2A7C4")
        pen.px(HEAD_CX + 1, HIP_Y - 6, "#F7D774")
    elif kind == "fork":
        pen.rect(HEAD_CX - 1, HIP_Y - 12, HEAD_CX + 1, HIP_Y - 7, accent)
        pen.rect(HEAD_CX - 2, HIP_Y - 12, HEAD_CX - 1, HIP_Y - 10, accent)
        pen.rect(HEAD_CX + 1, HIP_Y - 12, HEAD_CX + 2, HIP_Y - 10, accent)
    elif kind == "book":
        pen.rect(HEAD_CX - 4, HIP_Y - 9, HEAD_CX + 4, HIP_Y - 5, prop)
        pen.rect(HEAD_CX - 4, HIP_Y - 9, HEAD_CX + 4, HIP_Y - 8, shade(prop, -0.3))
        pen.rect(HEAD_CX, HIP_Y - 9, HEAD_CX, HIP_Y - 5, shade(prop, -0.3))


# The signature accessory and the held prop for each character.
SIGNATURES = {
    "koneko": ("cat_hood", "bell"),
    "minori": ("flower", "basket"),
    "kaneru": ("cap", "abacus"),
    "kogane": ("bow", "watch"),
    "mone": ("hat", "bottle"),
    "zenimaru": ("tufts", "fork"),
}


# ---------------------------------------------------------------------------
# The poses
# ---------------------------------------------------------------------------


def frame_idle(char, index):
    """Three frames of a breathing bounce. The body rises a pixel and
    the arms sway with it."""
    pal = PALETTES[char]
    sig, prop_kind = SIGNATURES[char]
    bob = [0, -1, 0][index]

    pen = Pen()
    draw_hair_back(pen, pal, bob)
    draw_legs(pen, pal, bob)
    draw_torso(pen, pal, bob)
    draw_arms(pen, pal, bob, "down")
    draw_head(pen, pal, bob, expr="smile")
    draw_signature(pen, pal, bob, sig)
    draw_prop(pen, pal, bob, prop_kind)
    pen.outline()
    return pen


def frame_walk(char, index):
    """Four frames of a side-view step. The legs alternate, the arms
    swing the other way, the body bobs."""
    pal = PALETTES[char]
    sig, prop_kind = SIGNATURES[char]
    hair, hair_shade, _ = pal["hair"]
    skin, skin_shadow, blush = pal["skin"]
    cloth, cloth_shadow, _ = pal["cloth"]

    swing = [2, 0, -2, 0][index]
    bob = [0, -1, 0, -1][index]

    pen = Pen()

    # The legs, one forward and one back.
    draw_legs(pen, pal, bob, front_leg=swing, back_leg=-swing)

    # The torso, leaning forward.
    lean = 1 if swing > 0 else 0
    draw_torso(pen, pal, bob, lean=lean)

    # The arms, swinging opposite the legs.
    for side, off in ((-1, -swing), (1, swing)):
        x = HEAD_CX + side * 6 + lean
        pen.rect(x - 1, SHOULDER_Y + 1, x + 1, SHOULDER_Y + 6 + off, cloth)
        pen.px(x, SHOULDER_Y + 7 + off, cloth_shadow)
        pen.ellipse(x, SHOULDER_Y + 7 + off, 1, 1, skin)

    # The head in profile, with the hair swept back.
    cy = HEAD_CY + bob
    pen.ellipse(HEAD_CX, cy, 5, HEAD_RY, skin)
    pen.rect(HEAD_CX - 4, cy + 3, HEAD_CX + 5, cy + 5, skin)
    # The hair, swept back off the face.
    pen.ellipse(HEAD_CX - 1, cy, 6, HEAD_RY + 1, hair)
    pen.rect(HEAD_CX - 7, cy - 3, HEAD_CX - 4, cy + 8, hair)
    pen.px(HEAD_CX - 6, cy + 6, hair_shade)
    # The eye, in profile.
    _one_eye(pen, pal, HEAD_CX + 2, cy + 1, False)
    pen.px(HEAD_CX + 3, cy + 3, shade(skin, -0.35))
    pen.px(HEAD_CX + 4, cy + 2, blush)
    _mouth(pen, pal, HEAD_CX + 2, cy + 4, "smile")

    draw_signature(pen, pal, bob, sig)
    draw_prop(pen, pal, bob, prop_kind)
    pen.outline()
    return pen


def frame_celebrate(char, index):
    """Three frames of a welcome. The hands go up, the eyes sparkle, and
    the body rises a little more each frame."""
    pal = PALETTES[char]
    sig, _ = SIGNATURES[char]
    bob = [0, -2, -3][index]

    pen = Pen()
    draw_hair_back(pen, pal, bob)
    draw_legs(pen, pal, bob)
    draw_torso(pen, pal, bob)
    draw_arms(pen, pal, bob, "up")
    draw_head(pen, pal, bob, expr="open", sparkle=True)
    draw_signature(pen, pal, bob, sig)

    pen.outline()
    # The sparkles go on AFTER the outline, so they float above the
    # sprite instead of punching holes in its edge. They are placed
    # where they cannot land on the face: the face occupies x 6..18 and
    # y 2..14.
    _sparkles(pen, pal, bob, index)
    return pen


def draw_counter(pen, pal, dropped=0):
    """The counter they work on. It gives the work pose something to
    be a pose against."""
    _, _, trim = pal["cloth"]
    wood = shade(trim, -0.1)
    y = FOOT_Y - 3
    pen.rect(HEAD_CX - 9, y, HEAD_CX + 9, y + 2, wood)
    pen.rect(HEAD_CX - 9, y, HEAD_CX + 9, y, shade(wood, 0.25))


def _sparkles(pen, pal, bob, index):
    """The celebration glints. Drawn last, so the outline stays whole."""
    _, prop_shine = pal["prop"]
    sparkles = [(2, 9), (21, 6), (1, 19), (22, 17), (4, 3), (19, 11), (3, 25), (20, 24)]
    for i, (sx, sy) in enumerate(sparkles):
        if (i + index) % 2 == 0:
            pen.px(sx, sy + bob, "#FFFFFF")
            pen.px(sx - 1, sy + bob, prop_shine)
            pen.px(sx + 1, sy + bob, prop_shine)
            pen.px(sx, sy - 1 + bob, prop_shine)
            pen.px(sx, sy + 1 + bob, prop_shine)


def frame_work(char, index):
    """Two frames of working.

    The first frame reaches; the second frame strikes. Without a
    counter and a moving tool this reads as a second idle, which is
    exactly what it looked like before.
    """
    pal = PALETTES[char]
    sig, prop_kind = SIGNATURES[char]
    bob = [0, -1][index]
    skin, _, _ = pal["skin"]
    accent, accent_dark = pal["accent"]

    pen = Pen()
    draw_hair_back(pen, pal, bob)
    draw_legs(pen, pal, bob)
    draw_torso(pen, pal, bob)
    draw_arms(pen, pal, bob, "work")
    draw_head(pen, pal, bob, expr="flat")
    draw_signature(pen, pal, bob, sig)
    draw_prop(pen, pal, bob, prop_kind)

    # The counter, and the tool in the working hand.
    draw_counter(pen, pal)

    # The tool moves between the two frames: up, then down onto the
    # counter. That is the beat.
    if index == 0:
        # Raised, ready to strike.
        pen.rect(HEAD_CX + 4, HIP_Y - 3, HEAD_CX + 5, HIP_Y - 9, accent)
        pen.rect(HEAD_CX + 4, HIP_Y - 10, HEAD_CX + 7, HIP_Y - 9, accent)
        pen.ellipse(HEAD_CX + 6, HIP_Y - 11, 1, 1, accent)
    else:
        # Down, in contact with the counter.
        pen.rect(HEAD_CX + 4, HIP_Y - 1, HEAD_CX + 5, HIP_Y - 7, accent)
        pen.rect(HEAD_CX + 4, HIP_Y - 8, HEAD_CX + 7, HIP_Y - 7, accent)
        # The impact.
        pen.px(HEAD_CX + 8, HIP_Y - 6, "#FFFFFF")
        pen.px(HEAD_CX + 9, HIP_Y - 5, accent_dark)
        pen.px(HEAD_CX + 8, HIP_Y - 4, "#FFFFFF")

    pen.outline()
    return pen


FRAME_BUILDERS = {
    ROW_IDLE: frame_idle,
    ROW_WALK: frame_walk,
    ROW_CELEBRATE: frame_celebrate,
    ROW_WORK: frame_work,
}


# ---------------------------------------------------------------------------
# The sheet
# ---------------------------------------------------------------------------


def _cell(pen, paper=False):
    """One frame.

    The sheet on disk is on white, because a sheet is a document that
    someone opens in an image viewer. The strips the game plays are
    laid over a photograph of the shop, so they are transparent - a
    white cell would show as a white rectangle over the room.
    """
    fill = (255, 255, 255, 255) if paper else (0, 0, 0, 0)
    cell = Image.new("RGBA", (FRAME_W, FRAME_H), fill)
    cell.alpha_composite(pen.scaled())
    return cell


def build_sheet(char):
    """The 4x3 sheet for one character, on pure white."""
    sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (255, 255, 255, 255))
    for row, builder in FRAME_BUILDERS.items():
        for col in range(ROW_FRAMES[row]):
            sheet.alpha_composite(_cell(builder(char, col), paper=True), (col * FRAME_W, row * FRAME_H))
    return sheet


def build_strip(char, row):
    """One animation on its own, for the parts of the app that animate
    a single loop. Transparent, so it can lie over the room."""
    builder = FRAME_BUILDERS[row]
    strip = Image.new("RGBA", (FRAME_W * ROW_FRAMES[row], FRAME_H), (0, 0, 0, 0))
    for col in range(ROW_FRAMES[row]):
        strip.alpha_composite(_cell(builder(char, col)), (col * FRAME_W, 0))
    return strip


def build_portrait(char):
    """A 1:1 crop of the head, for the circle in the skill dock.

    The head sits in the top half of the frame and is about 12 logical
    pixels across, so the crop is 12x12 logical pixels scaled up. The
    bottom is pulled up so the face fills the circle rather than
    floating in it.
    """
    frame = frame_idle(char, 0).scaled()
    # 12 logical pixels = 24 real ones, doubled again for a crisp
    # circle at 48px.
    top = 0
    left = (LOG_W * SCALE - HEAD_RX * 2 * SCALE) // 2
    side = HEAD_RX * 2 * SCALE
    crop = frame.crop((left, top, left + side, top + side))
    return crop.resize((side * 2, side * 2), Image.NEAREST)


def outputs_for(char):
    """Every file one character owns, and how it is built."""
    out = {OUT_DIR / f"{char}.png": lambda: build_sheet(char)}
    for row, name in ROW_NAMES.items():
        out[OUT_DIR / f"{char}_{name}.png"] = (lambda r=row: build_strip(char, r))
    out[OUT_DIR / f"{char}_portrait.png"] = (lambda: build_portrait(char))
    return out


def render_all():
    """Build every file and return them as {path: bytes}."""
    files = {}
    for char in PALETTES:
        for path, builder in outputs_for(char).items():
            buf = io.BytesIO()
            builder().save(buf, format="PNG", optimize=True)
            files[path] = buf.getvalue()
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="check that the files in the repository are the ones this would write",
    )
    args = parser.parse_args()

    files = render_all()

    failures = 0
    for path in sorted(files):
        data = files[path]
        rel = path.relative_to(ROOT)
        if args.check:
            if not path.exists():
                print(f"  MISSING  {rel}")
                failures += 1
                continue
            if path.read_bytes() != data:
                print(f"  STALE    {rel}")
                failures += 1
            else:
                digest = hashlib.sha256(data).hexdigest()[:12]
                print(f"  OK       {rel} ({len(data) // 1024}KB, {digest})")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            digest = hashlib.sha256(data).hexdigest()[:12]
            print(f"  wrote    {rel} ({len(data) // 1024}KB, {digest})")

    if args.check:
        if failures:
            print(f"\n{len(failures)} file(s) differ from what the generator would write.")
            print("Run: python3 scripts/generate_koban_sprites.py")
            return 1
        print(f"\nAll {len(files)} sprite files are up to date.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
