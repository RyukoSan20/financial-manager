"""The Koban & Co. asset pipeline's outputs, checked from disk.

scripts/build_koban_assets.py needs the SVG library in ~/Downloads, which
CI does not have, so these tests read what it wrote into the repo rather
than running it.
"""

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "frontend" / "public"
DB_PATH = ROOT / "frontend" / "src" / "features" / "koban-shop" / "data" / "database.json"
CHARACTERS = ["koneko", "minori", "kaneru", "kogane", "mone", "zenimaru"]
COOLDOWNS = {"koneko": 300, "minori": 600, "kaneru": 900, "kogane": 1800, "mone": 1800, "zenimaru": 600}

pytestmark = pytest.mark.skipif(not DB_PATH.exists(), reason="frontend tree not present")


@pytest.fixture(scope="module")
def db():
    return json.loads(DB_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize("cid", CHARACTERS)
def test_sprite_is_transparent_outside_and_opaque_inside(cid):
    Image = pytest.importorskip("PIL.Image")
    im = Image.open(PUBLIC / "koban-assets" / "chara" / f"{cid}.png")
    assert im.mode == "RGBA"
    alpha = im.getchannel("A")
    w, h = im.size
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        assert alpha.getpixel(corner) == 0, f"{cid} corner {corner} not cleared"
    assert alpha.getpixel((w // 2, h // 2)) == 255, f"{cid} body was eaten"
    # The die-cut border survives: some opaque near-white pixels remain.
    rgba = im.convert("RGBA")
    white_kept = sum(
        1 for x in range(0, w, 4) for y in range(0, h, 4)
        if (p := rgba.getpixel((x, y)))[3] == 255 and min(p[:3]) >= 240
    )
    assert white_kept > 50, f"{cid} lost its white sticker border"


def test_characters_and_skills(db):
    chars = {c["id"]: c for c in db["characters"]}
    assert set(chars) == set(CHARACTERS)
    for cid, cd in COOLDOWNS.items():
        assert chars[cid]["skill"]["cooldownSec"] == cd
        assert "stageCoords" in chars[cid] and chars[cid].get("kakeiboLink")


def test_four_facilities_and_150_plus_svg_items(db):
    assert {f["id"] for f in db["facilities"]} == {"restaurant", "blacksmith", "seamstress", "wizardry"}
    items = db["items"]
    assert len(items) >= 150
    for it in items:
        icon = it.get("icon") or it.get("svg")
        assert icon and icon.endswith(".svg"), it["id"]
        assert (PUBLIC / icon.lstrip("/")).exists(), f"{it['id']} icon missing: {icon}"
        assert 1 <= it["tier"] <= 5


def test_recipes_have_clue_and_2_to_3_ingredients(db):
    assert len(db["recipes"]) >= 150
    for r in db["recipes"]:
        assert r.get("recipeClue")
        assert 2 <= len(r["ingredients"]) <= 3, r["id"]


def test_quests_and_dungeons(db):
    assert len(db["customerRequests"]) == 12
    for q in db["customerRequests"]:
        assert q["perfectMatches"] and q["acceptableTags"]
    assert len(db["dungeons"]) == 5
