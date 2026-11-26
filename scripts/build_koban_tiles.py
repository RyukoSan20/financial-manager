#!/usr/bin/env python3
"""
Draw the modular tiles the Koban & Co. tilemap is built from.

The pictures in ``mini-games/.../asset/places/`` are moodboards: they
set the palette and the mood, and they are NOT put on the screen. The
rooms of the game are assembled from the tiles this script writes, one
cell at a time, by ``IsometricTilemapStage.jsx``.

A ground tile is one cell (64 px, written at 2x). A prop tile is a
piece of furniture that stands ON the grid: it is taller than a cell,
it is anchored at the middle of its base, and it is depth-sorted
against the people walking around it.

    backend/venv/bin/python scripts/build_koban_tiles.py
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "koban-assets" / "tiles"
S = 4          # drawn at 4x, written at 2x: smooth edges, no blur
INK = "#4A2E12"
SKY = "#8FD0F4"


class Canvas:
    def __init__(self, w, h, bg=None):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w * S, h * S), bg or (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def rect(self, x, y, w, h, fill, line=None, lw=1.5, rad=0):
        self.d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S], radius=rad * S, fill=fill,
                                 outline=line, width=round(lw * S) if line else 1)

    def oval(self, cx, cy, rx, ry, fill, line=None, lw=1.5):
        self.d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], fill=fill,
                       outline=line, width=round(lw * S) if line else 1)

    def poly(self, pts, fill, line=None, lw=1.5):
        p = [(x * S, y * S) for x, y in pts]
        self.d.polygon(p, fill=fill)
        if line:
            self.d.line(p + [p[0]], fill=line, width=round(lw * S), joint="curve")

    def line(self, pts, fill, lw=1.5):
        self.d.line([(x * S, y * S) for x, y in pts], fill=fill, width=round(lw * S), joint="curve")

    def pie(self, box, a0, a1, fill, line=None, lw=1.5):
        self.d.pieslice([v * S for v in box], a0, a1, fill=fill, outline=line, width=round(lw * S) if line else 1)

    def save(self, name):
        OUT.mkdir(parents=True, exist_ok=True)
        self.im.resize((self.w * 2, self.h * 2), Image.LANCZOS).save(OUT / f"{name}.png", "PNG", optimize=True)
        return name


def diamonds(c, period, size, fill, line=None, w=64, h=64, off=0):
    half = period / 2
    y = half
    while y < h:
        x = half + off
        while x < w:
            c.poly([(x, y - size), (x + size, y), (x, y + size), (x - size, y)], fill, line, 1.2)
            x += period
        y += period


# --- ground ---------------------------------------------------------------

def floor_wood():
    c = Canvas(64, 64, "#B86828")
    for x0, y0, x1, col in [(4, 8, 16, "#C97A38"), (26, 14, 44, "#C97A38"), (48, 6, 60, "#A55C20"), (6, 22, 18, "#A55C20"),
                            (8, 40, 30, "#C97A38"), (36, 46, 46, "#A55C20"), (54, 38, 62, "#C97A38"), (14, 54, 34, "#A55C20")]:
        c.line([(x0, y0), (x1, y0)], col, 1)
    c.line([(0, 31.4), (64, 31.4)], "#8F4B16", 1.6)
    c.line([(0, 63.3), (64, 63.3)], "#8F4B16", 1.6)
    c.line([(22, 0), (22, 31)], "#8F4B16", 1.3)
    c.line([(50, 32), (50, 63)], "#8F4B16", 1.3)
    return c.save("tile_floor_wood")


def wall_paper():
    c = Canvas(64, 64, "#E6B980")
    for cx in (16, 48):
        for cy in (16, 48):
            c.line([(cx, cy - 16), (cx + 16, cy), (cx, cy + 16), (cx - 16, cy), (cx, cy - 16)], "#D49B58", 1.5)
            c.oval(cx, cy, 1.6, 1.6, "#D49B58")
    for x in (0, 32, 64):
        for y in (0, 32, 64):
            c.oval(x, y, 1.6, 1.6, "#D49B58")
    return c.save("tile_wall_paper")


def wall_base():
    c = Canvas(64, 64, "#9A5A28")
    c.rect(0, 0, 64, 7, "#7A4A22")
    c.line([(0, 7.5), (64, 7.5)], "#C98A4A", 1.2)
    for x in (16, 48):
        c.line([(x, 12), (x, 52)], "#7A4A22", 1.4)
    c.rect(0, 55, 64, 9, "#5C3716")
    return c.save("tile_wall_base")


def bricks(c, x, y, w, h):
    c.rect(x, y, w, h, "#B5583A")
    row = 0
    yy = y
    while yy < y + h:
        c.line([(x, yy), (x + w, yy)], "#E2B89A", 1.1)
        xx = x + (8 if row % 2 else 0)
        while xx < x + w:
            if xx > x:
                c.line([(xx, yy), (xx, min(yy + 8, y + h))], "#E2B89A", 1.1)
            c.line([(xx + 2, yy + 2.6), (min(xx + 7, x + w - 1), yy + 2.6)], "#CC7150", 1)
            xx += 16
        yy += 8
        row += 1


def wall_brick():
    c = Canvas(64, 64)
    bricks(c, 0, 0, 64, 64)
    return c.save("tile_wall_brick")


def sky():
    return Canvas(64, 64, SKY).save("tile_sky")


def hedge():
    c = Canvas(64, 64, SKY)
    c.oval(32, 40, 52, 15, "#8CCB7A")
    c.rect(-4, 26, 72, 28, "#4F9A4A", rad=9)
    for i, x in enumerate((4, 20, 36, 52, 64)):
        c.oval(x, 27, 9, 8, "#5BB05E" if i % 2 else "#4F9A4A", "#2F6B34", 1)
    for i, (x, y) in enumerate(((10, 30), (24, 38), (38, 29), (50, 40), (60, 32))):
        c.oval(x, y, 2.6, 2.6, "#FFFFFF" if i % 2 else "#F7A9C0")
    c.rect(0, 52, 64, 12, "#9A5F28")
    c.line([(0, 52), (64, 52)], INK, 1.4)
    c.line([(0, 63.3), (64, 63.3)], INK, 1.4)
    return c.save("tile_hedge")


def door():
    c = Canvas(64, 64, SKY)
    c.oval(32, 30, 52, 12, "#8CCB7A")
    c.rect(0, 30, 64, 34, "#E6D7B4")
    for y in (41, 52):
        c.line([(0, y), (64, y)], "#C9B58E", 1.3)
    c.line([(0, 63.3), (64, 63.3)], "#8F4B16", 1.6)
    return c.save("tile_door")


def carpet():
    c = Canvas(64, 64, "#D2C23A")
    diamonds(c, 32, 13, "#DDD04E", "#BFAE2A")
    diamonds(c, 32, 5, "#C6B52E")
    return c.save("tile_carpet")


def carpet_edge():
    c = Canvas(64, 64, "#A8901C")
    diamonds(c, 16, 5, "#F6EFA6")
    return c.save("tile_carpet_edge")


def rug():
    c = Canvas(64, 64, "#B8443A")
    diamonds(c, 32, 12, "#E8B84B")
    diamonds(c, 32, 5, "#B8443A")
    c.line([(0, 2), (64, 2)], "#E8B84B", 2.4)
    c.line([(0, 62), (64, 62)], "#E8B84B", 2.4)
    return c.save("tile_rug")


# --- props ----------------------------------------------------------------

def counter_front():
    c = Canvas(64, 80)
    c.rect(0, 0, 64, 30, "#D9A05A")
    c.line([(0, 5), (64, 5)], "#EBC283", 2)
    c.rect(0, 29, 64, 51, "#A8682E")
    for x in (21, 43):
        c.line([(x, 32), (x, 72)], "#8F4B16", 1.2)
    c.rect(0, 72, 64, 8, "#8F4B16")
    for y in (0.8, 29.4, 79.2):
        c.line([(0, y), (64, y)], INK, 1.5)
    return c.save("tile_counter_front")


def shelf_wood():
    c = Canvas(128, 144)
    c.oval(64, 137, 56, 6, (44, 27, 18, 60))
    c.rect(10, 38, 108, 100, "#A8682E", INK, 1.6, 3)
    jars = ["#F0705C", "#8EC9E0", "#F4C542", "#A8E6CF", "#D8C8F0"]
    for row, y in enumerate((48, 94)):
        c.rect(18, y, 92, 36, "#7A4A22", INK, 1.2)
        for i in range(5):
            x = 23 + i * 17
            c.rect(x, y + 12, 12, 22, jars[(i + row * 2) % 5], INK, 1.1, 2)
            c.rect(x + 2, y + 8, 8, 5, "#F6E7C4", INK, 1)
    cloth = [(4, 30), (124, 30), (118, 46)] + [(118 - i * 12 - 6, 38 if i % 2 == 0 else 46) for i in range(9)] + [(10, 46)]
    c.poly(cloth, "#C8392B", INK, 1.4)
    for x in (28, 52, 76, 100):
        c.poly([(x, 33), (x + 4, 36.5), (x, 40), (x - 4, 36.5)], "#FFE9A8")
    c.poly([(54, 30), (52, 14), (76, 14), (74, 30)], "#8EC9E0", INK, 1.3)
    for i, (x, y) in enumerate(((56, 10), (64, 4), (72, 10))):
        c.oval(x, y, 6, 6, "#F7A9C0" if i == 1 else "#FFFFFF", "#D98AA0", 1)
    return c.save("tile_shelf_wood")


def umbrella_table():
    c = Canvas(128, 160)
    c.oval(64, 151, 42, 7, (44, 27, 18, 60))
    c.rect(60, 112, 8, 38, "#8A5A3C", INK, 1.3)
    c.oval(64, 150, 16, 4, "#8A5A3C", INK, 1.3)
    c.oval(64, 114, 40, 11, "#F6E7C4", INK, 1.5)
    c.oval(64, 112, 30, 7, "#FFFDF7")
    c.rect(62, 30, 4, 84, "#8A5A3C", INK, 1)
    box = (8, 10, 120, 110)
    for i in range(6):
        c.pie(box, 180 + i * 30, 210 + i * 30, "#D9462F" if i % 2 == 0 else "#FFF6E8", INK, 1.2)
    for i in range(6):
        cx = 17.3 + i * 18.7
        c.oval(cx, 60, 9.4, 5, "#D9462F" if i % 2 == 0 else "#FFF6E8", INK, 1.2)
    c.oval(64, 10, 4, 4, "#F4C542", INK, 1.2)
    return c.save("tile_umbrella_table")


def tree():
    c = Canvas(96, 144)
    c.oval(48, 136, 26, 6, (44, 27, 18, 60))
    c.rect(44, 78, 8, 34, "#7A4A22", INK, 1.2)
    for dx, y, r, col in [(-18, 70, 18, "#3F8F4A"), (18, 66, 20, "#5BB05E"), (0, 46, 24, "#4FA356"),
                          (-14, 30, 16, "#6DBB5E"), (14, 32, 17, "#3F8F4A"), (0, 76, 16, "#5BB05E")]:
        c.oval(48 + dx, y, r, r, col, "#2F6B34", 1.2)
    c.line([(36, 36), (42, 30), (48, 34)], "#BFE6A6", 1.8)
    c.line([(54, 60), (60, 55), (66, 60)], "#BFE6A6", 1.8)
    c.poly([(28, 108), (68, 108), (63, 136), (33, 136)], "#C8643A", INK, 1.5)
    c.rect(25, 103, 46, 8, "#DB7A4C", INK, 1.4, 3)
    return c.save("tile_tree")


def window():
    c = Canvas(128, 160)
    c.rect(8, 10, 112, 132, "#7A4A22", INK, 1.6, 3)
    c.rect(16, 18, 96, 116, SKY)
    c.oval(46, 44, 18, 7, "#FFFFFF")
    c.oval(60, 39, 13, 6, "#FFFFFF")
    c.poly([(16, 134), (16, 112), (40, 100), (64, 110), (90, 98), (112, 112), (112, 134)], "#8CCB7A")
    c.line([(64, 18), (64, 134)], "#7A4A22", 4)
    c.line([(16, 76), (112, 76)], "#7A4A22", 4)
    c.poly([(16, 18), (44, 18), (38, 60), (42, 96), (40, 134), (16, 134)], "#D9531E", INK, 1.3)
    c.poly([(112, 18), (84, 18), (90, 60), (86, 96), (88, 134), (112, 134)], "#D9531E", INK, 1.3)
    for x0, x1 in ((24, 22), (32, 30), (104, 106), (96, 98)):
        c.line([(x0, 22), (x1, 130)], "#B8421A", 1.4)
    c.rect(12, 86, 30, 6, "#F4C542", INK, 1.1, 3)
    c.rect(86, 86, 30, 6, "#F4C542", INK, 1.1, 3)
    val = [(4, 8), (124, 8), (124, 22)] + [(124 - i * 10 - 5, 30 if i % 2 == 0 else 22) for i in range(12)] + [(4, 22)]
    c.poly(val, "#C2451A", INK, 1.4)
    c.rect(4, 140, 120, 9, "#9A5F28", INK, 1.4, 3)
    return c.save("tile_window")


def pillar():
    c = Canvas(64, 160)
    c.oval(32, 153, 26, 5, (44, 27, 18, 60))
    bricks(c, 12, 16, 40, 132)
    c.rect(12, 16, 40, 132, None, INK, 1.5)
    c.rect(7, 8, 50, 12, "#8F4B16", INK, 1.5, 2)
    c.rect(7, 142, 50, 12, "#8F4B16", INK, 1.5, 2)
    c.poly([(18, 60), (46, 60), (42, 76), (22, 76)], "#A8682E", INK, 1.3)
    for dx, y, r, col in [(-11, 56, 8, "#4F9A4A"), (0, 50, 10, "#6DBB5E"), (11, 56, 8, "#4F9A4A"), (-4, 60, 6, "#6DBB5E"), (6, 60, 6, "#5BB05E")]:
        c.oval(32 + dx, y, r, r, col, "#2F6B34", 1)
    for dx, y in ((-8, 52), (3, 46), (11, 54), (-1, 58)):
        c.oval(32 + dx, y, 2.6, 2.6, "#FFFFFF", "#E8D9C2", 0.6)
    return c.save("tile_pillar")


def ledger_table():
    c = Canvas(176, 96)
    c.oval(88, 89, 80, 6, (44, 27, 18, 60))
    c.rect(8, 40, 160, 48, "#9A5F28", INK, 1.5, 2)
    for x in (60, 116):
        c.line([(x, 44), (x, 86)], "#7A4A22", 1.3)
    c.rect(0, 18, 176, 26, "#C98A4A", INK, 1.6, 5)
    c.line([(6, 23), (170, 23)], "#E0A867", 2)
    c.poly([(36, 12), (64, 10), (92, 12), (92, 30), (64, 28), (36, 30)], "#FFFDF7", INK, 1.3)
    c.line([(64, 10), (64, 28)], INK, 1.1)
    for y in (16, 21):
        c.line([(42, y), (58, y - 1)], "#B8821A", 1)
        c.line([(70, y - 1), (86, y)], "#B8821A", 1)
    c.oval(118, 22, 6, 5, "#3A4A7A", INK, 1.2)
    c.line([(119, 20), (134, 2)], "#FFFDF7", 3)
    return c.save("tile_ledger_table")


def cloud():
    c = Canvas(128, 48)
    for x, y, rx, ry in ((40, 28, 30, 13), (70, 20, 26, 14), (94, 30, 24, 11)):
        c.oval(x, y, rx, ry, "#FFFFFF")
    return c.save("tile_cloud")


def workbench():
    c = Canvas(128, 96)
    c.oval(64, 89, 56, 6, (44, 27, 18, 60))
    c.rect(8, 40, 112, 48, "#8A5A3C", INK, 1.5, 2)
    for x in (45, 83):
        c.line([(x, 44), (x, 86)], "#6B4226", 1.3)
    c.rect(2, 22, 124, 22, "#C98A4A", INK, 1.6, 4)
    c.line([(8, 27), (120, 27)], "#E0A867", 2)
    return c.save("tile_workbench")



def chest():
    """A merchant's strongbox, for the empty states. Smooth vector, 56x50 cells at 4x."""
    c = Canvas(56, 50)
    c.oval(28, 46, 24, 4, (0, 0, 0, 70))
    c.rect(6, 22, 44, 24, "#8B5A2B", INK, 1.6, 2)                      # body
    for x in (16, 28, 40):
        c.line([(x, 23), (x, 45)], "#6B4226", 1.2)                      # planks
    c.poly([(6, 22), (6, 14), (14, 6), (42, 6), (50, 14), (50, 22)], "#A8682E", INK, 1.6)  # lid
    c.line([(10, 14), (46, 14)], "#C98A4A", 1.4)
    for x in (6, 49):
        c.rect(x - 1.5, 6, 4, 40, "#C5A059", INK, 1.2, 1)               # gold straps
    c.rect(2, 20, 52, 4, "#C5A059", INK, 1.2, 1)
    c.rect(24, 20, 8, 11, "#F3E9D2", INK, 1.3, 2)                       # lock plate
    c.oval(28, 24.5, 1.8, 1.8, "#4A2E12")
    c.rect(27.2, 25, 1.6, 4, "#4A2E12")
    for x, y in ((9, 26), (47, 26), (9, 42), (47, 42)):
        c.oval(x, y, 1.1, 1.1, "#F3E9D2")                               # rivets
    return c.save("tile_chest")

def main():
    made = [f() for f in (floor_wood, wall_paper, wall_base, wall_brick, sky, hedge, door, carpet, carpet_edge, rug,
                          counter_front, shelf_wood, umbrella_table, tree, window, pillar, ledger_table, cloud, workbench, chest)]
    print(f"wrote {len(made)} tiles to {OUT.relative_to(ROOT)}: {', '.join(made)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
