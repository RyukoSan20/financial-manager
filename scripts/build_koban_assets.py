#!/usr/bin/env python3
"""
The asset pipeline for Koban & Co. General Goods.

Two jobs, both idempotent:

  1. The six character stickers arrive as .jpeg on a solid white
     ground. They are flood-filled from the outer edge so the ground
     becomes transparent while the white die-cut border around each
     figure - which is NOT connected to the outer edge - survives.
     Faces and room backdrops are copied and downscaled.

  2. The 8-bit SVG library is walked, every file copied under
     public/koban-assets/svg/, and database.json is generated from
     what is actually on disk: six characters, 150+ craftable items
     with recipes across four facilities, raw materials, five
     dungeons, twelve deduction quests, five chapters.

What the brief assumed and what the disk holds differ: there is no
Clothes content and Tools holds three sake cups. The facility map
below is built from the folders that exist, so nothing in the game
points at a file that is not there.

    python3 scripts/build_koban_assets.py
    python3 scripts/build_koban_assets.py --check   # verify only
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MINI_GAME_DIR = PROJECT_ROOT / "mini-games" / "Koban & Co. General Goods"
# The SVG library lives beside the project, not inside it. It is
# searched for in both places so the script works wherever it landed.
SVG_SOURCES = [
    MINI_GAME_DIR / "Image-8bit-Svg",
    Path.home() / "Downloads" / "Image-8bit-Svg",
]
PUBLIC_DIR = PROJECT_ROOT / "frontend" / "public" / "koban-assets"
DATA_DIR = PROJECT_ROOT / "frontend" / "src" / "features" / "koban-shop" / "data"

CHARACTER_IDS = ["koneko", "minori", "kaneru", "kogane", "mone", "zenimaru"]

# ---------------------------------------------------------------------------
# 1. The stickers
# ---------------------------------------------------------------------------

def remove_outer_white_background(src: Path, dst: Path, threshold: int = 240, max_width: int = 720) -> None:
    """
    Make the outer white ground transparent.

    The fill is seeded from many points along the edge rather than
    one corner, because a figure whose hair touches the top edge
    would split the ground into two regions. Each seed only fills
    pixels within `thresh` of pure white that are CONNECTED to it,
    so the die-cut border - an island of white around the figure -
    is never reached.
    """
    img = Image.open(src).convert("RGB")
    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, round(img.height * ratio)), Image.LANCZOS)
    rgba = img.convert("RGBA")
    width, height = rgba.size
    thresh = 255 - threshold
    seeds = []
    step = max(8, width // 24)
    for x in range(0, width, step):
        seeds += [(x, 0), (x, height - 1)]
    for y in range(0, height, step):
        seeds += [(0, y), (width - 1, y)]
    seeds += [(width - 1, height - 1)]
    px = rgba.load()
    for seed in seeds:
        r, g, b, a = px[seed]
        if a != 0 and r >= threshold and g >= threshold and b >= threshold:
            ImageDraw.floodfill(rgba, seed, (255, 255, 255, 0), thresh=thresh)
    dst.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(dst, "PNG", optimize=True)


def copy_scaled(src: Path, dst: Path, max_side: int, fmt: str) -> None:
    img = Image.open(src).convert("RGB")
    scale = min(1.0, max_side / max(img.size))
    if scale < 1.0:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "JPEG":
        img.save(dst, fmt, quality=84, optimize=True, progressive=True)
    else:
        img.save(dst, fmt, optimize=True)


def build_images() -> dict:
    report = {"chara": [], "face": [], "places": []}
    for cid in CHARACTER_IDS:
        src = MINI_GAME_DIR / "asset" / "chara" / f"{cid}.jpeg"
        dst = PUBLIC_DIR / "chara" / f"{cid}.png"
        remove_outer_white_background(src, dst)
        report["chara"].append(dst.name)
        fsrc = MINI_GAME_DIR / "asset" / "face" / f"{cid}.jpeg"
        fdst = PUBLIC_DIR / "face" / f"{cid}.jpg"
        copy_scaled(fsrc, fdst, 384, "JPEG")
        report["face"].append(fdst.name)
    for place in ["atelier", "workshop"]:
        src = MINI_GAME_DIR / "asset" / "places" / f"{place}.jpeg"
        dst = PUBLIC_DIR / "places" / f"{place}.jpg"
        copy_scaled(src, dst, 1600, "JPEG")
        report["places"].append(dst.name)
    return report


# ---------------------------------------------------------------------------
# 2. The SVG library
# ---------------------------------------------------------------------------

def find_svg_root() -> Path:
    for candidate in SVG_SOURCES:
        if candidate.is_dir():
            return candidate
    raise SystemExit("Image-8bit-Svg not found in: " + ", ".join(str(p) for p in SVG_SOURCES))


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def copy_svgs(svg_root: Path) -> dict[str, list[dict]]:
    """
    Copy the SVG library and return {folderKey: [{file, path, stem}]}.

    Every file is copied - the whole library is small (530 files, 6MB)
    and the encyclopedia wants to show a folder the game does not use
    yet. The characters, faces and rooms are what the repository
    carries; this folder is generated by the pipeline and is ignored
    by git, so a fresh clone rebuilds it with one command.
    """
    library: dict[str, list[dict]] = {}
    for src in sorted(svg_root.rglob("*.svg")):
        if src.name.startswith("."):
            continue
        rel_dir = src.parent.relative_to(svg_root)
        folder_key = slug(str(rel_dir).replace("/", " "))
        dst = PUBLIC_DIR / "svg" / folder_key / src.name
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists() or dst.stat().st_size != src.stat().st_size:
            shutil.copy2(src, dst)
        library.setdefault(folder_key, []).append({
            "file": src.name,
            "stem": src.stem,
            "path": f"/koban-assets/svg/{folder_key}/{src.name}",
        })
    return library


# ---------------------------------------------------------------------------
# 3. Naming. A file called `yakizakana_sanma_sudachi_white` has to
#    become something a player can read on a shop shelf.
# ---------------------------------------------------------------------------

WORDS = {
    # foods
    "yakizakana": "Ikan Bakar", "sanma": "Sanma", "sudachi": "Jeruk Sudachi", "oba": "Shiso",
    "sasa": "Daun Bambu", "lemon": "Lemon", "gohan": "Nasi", "kurigohan": "Nasi Kastanye",
    "kurimanju": "Manju Kastanye", "ohagi": "Ohagi", "goma": "Wijen", "kinako": "Kinako",
    "tsubuan": "Kacang Merah", "zunda": "Edamame", "sweetpotato": "Ubi Panggang",
    "murasakiimo": "Ubi Ungu", "satsumaimo": "Ubi Manis", "tsukimidango": "Dango Bulan",
    "sanpo": "Tiga Tusuk", "usu": "Lesung Mochi", "mochi": "Mochi", "yokan": "Yokan", "kuri": "Kastanye",
    "cake": "Kue", "montblanc": "Mont Blanc", "candy": "Permen", "candycane": "Tongkat",
    "peroperocandy": "Lolipop", "square": "Kotak", "cookie": "Kukis", "icebox": "Es", "ichimatsu": "Kotak-kotak",
    "uzu": "Pusaran", "cut": "Potong", "half": "Setengah", "two": "Sepasang",
    "bacon": "Bacon", "conveni": "Bekal", "friedchicken": "Ayam Goreng", "fukuro": "Bungkus",
    "onigiri": "Onigiri", "sake": "Salmon", "tunamayo": "Tuna Mayo", "ume": "Ume",
    "pan": "Roti", "currypan": "Roti Kari", "hotdog": "Hot Dog", "melonpan": "Roti Melon",
    "sandwich": "Roti Lapis", "ham": "Ham", "potatosalad": "Salad Kentang", "tamago": "Telur", "tuna": "Tuna",
    "natto": "Natto", "open": "Terbuka", "pack": "Paket", "niku": "Daging", "beef": "Sapi",
    "bara": "Perut", "hikiniku": "Cincang", "rosu": "Has", "chiken": "Ayam", "momo": "Paha",
    "mune": "Dada", "pork": "Babi", "sasami": "Fillet", "sakana": "Ikan", "shiromizakana": "Ikan Putih",
    "sashimi": "Sashimi", "binchomaguro": "Tuna Albakora", "honmaguro": "Tuna Sirip Biru",
    "katsuo": "Cakalang", "maguro": "Tuna", "magurotataki": "Tuna Tataki", "salmon": "Salmon",
    "sozai": "Lauk", "bento": "Bento", "hamburg": "Hamburg", "futa": "Tertutup", "karaage": "Karaage",
    "oroshihamburg": "Hamburg Lobak", "oroshitonkatsu": "Tonkatsu Lobak", "tonkatsu": "Tonkatsu",
    "buri": "Yellowtail", "moriawase": "Campur", "tofu": "Tahu", "kinu": "Sutra", "momen": "Katun",
    # drinks
    "drink": "", "coffeefloat": "Kopi Float", "floatglass": "Gelas Tinggi", "mint": "Mint",
    "cola": "Kola", "colafloat": "Kola Float", "cherry": "Ceri", "creamsoda": "Soda Krim",
    "icecoffee": "Kopi Es", "straw": "Sedotan", "icelemontea": "Teh Lemon Es", "icemilktea": "Teh Susu Es",
    "icetea": "Teh Es", "iceuroncha": "Teh Oolong Es", "lemonsquash": "Lemon Squash",
    "melonsoda": "Soda Melon", "orangefloat": "Jeruk Float", "orangejuice": "Jus Jeruk",
    "soda": "Soda", "sodafloat": "Soda Float", "tapioca": "Boba", "ichigomilk": "Susu Stroberi",
    "matchamilk": "Susu Matcha", "milktea": "Teh Susu", "tropicaljuice": "Jus Tropis",
    "denfare": "Anggrek", "hibiscus": "Kembang Sepatu",
    # ice cream
    "icebar": "Es Loli", "azuki": "Kacang Merah", "choco": "Cokelat", "nuts": "Kacang", "vanilla": "Vanila",
    "chocomint": "Cokelat Mint", "orange": "Jeruk", "icecream": "Es Krim", "cone": "Cone",
    "caramelribbon": "Pita Karamel", "chocochipchoco": "Cokelat Chip", "chocochipvanilla": "Vanila Chip",
    "double": "Dobel", "triple": "Tripel", "matcha": "Matcha", "mocha": "Moka", "strawberry": "Stroberi",
    "melon": "Melon", "strawberrycheesecake": "Keju Stroberi", "softcream": "Es Krim Lembut", "milk": "Susu",
    # fruits & veg
    "budo": "Anggur", "donguri": "Biji Ek", "enoki": "Jamur Enoki", "eringi": "Jamur Eringi",
    "jagaimo": "Kentang", "kabocha": "Labu", "kaki": "Kesemek", "kurumi": "Kenari", "maikate": "Jamur Maitake",
    "matsubokkuri": "Buah Pinus", "leaf": "Daun", "mushroom": "Jamur", "nashi": "Pir", "ninjin": "Wortel",
    "ringo": "Apel", "shiitake": "Jamur Shiitake", "kirekomi": "Ukir", "shimeji": "Jamur Shimeji",
    "tamanegi": "Bawang", "akatamanegi": "Bawang Merah",
    # plants
    "cosmos": "Kosmos", "higanbana": "Bunga Laba-laba", "icho": "Ginkgo", "kaede": "Maple",
    "ki": "Pohon", "koyo": "Daun Musim Gugur", "kareki": "Kering", "kikyo": "Lonceng Cina",
    "momiji": "Momiji", "susuki": "Rumput Perak", "object": "", "moon": "Bulan",
    # materials / tools
    "candle": "Lilin", "haka": "Nisan", "kanoke": "Peti", "halloween": "Halloween", "kine": "Palu Mochi",
    "sakazuki": "Cawan Sake", "dentaku": "Sempoa Mekanik", "game": "Kotak", "controller": "Kendali",
    "pc": "Mesin", "desktop": "Hitung Besar", "note": "Hitung Lipat", "sp": "Cermin Saku", "tablet": "Lempeng Rune",
    # accessories / weather
    "jewelry": "Permata", "emerald": "Zamrud", "oval": "Oval", "round": "Bulat", "boshi": "Topi",
    "amagu": "Jas Hujan", "furefurebozu": "Boneka Hujan", "kasa": "Payung", "close": "Terlipat",
    "mizutamari": "Genangan", "nagagutsu": "Sepatu Bot", "teruterubozu": "Boneka Cerah",
    "weather": "", "rain": "Hujan", "cloud": "Awan", "heavy": "Deras", "light": "Rintik",
    "umbrella": "Payung", "stop": "Reda", "thunderstorm": "Badai Petir",
    # animals / monsters
    "alpaca": "Alpaka", "araiguma": "Rakun", "azarashi": "Anjing Laut", "akachan": "Bayi",
    "gomafuazarashi": "Anjing Laut Tutul", "cat": "Kucing", "komori": "Kelelawar", "okami": "Serigala",
    "usagi": "Kelinci", "albino": "Putih", "character": "", "monster": "", "frankenstein": "Golem",
    "ghost": "Hantu", "jackolantern": "Labu Jack", "kyuketsuki": "Vampir", "majo": "Penyihir",
    "mummy": "Mumi", "okamiotoko": "Manusia Serigala", "skeleton": "Tengkorak", "zombie": "Zombi",
    "gaikotsu": "Kerangka", "yurei": "Arwah",
    # colours
    "black": "Hitam", "white": "Putih", "blue": "Biru", "red": "Merah", "green": "Hijau", "yellow": "Kuning",
    "pink": "Merah Muda", "purple": "Ungu", "brown": "Cokelat Tua", "gray": "Abu", "beige": "Krem",
    "lightblue": "Biru Muda", "lightpink": "Merah Jambu", "yellowgreen": "Hijau Kuning", "silver": "Perak",
    "lightbrown": "Cokelat Muda",
}

def humanize(stem: str) -> str:
    stem = re.sub(r"\s*\(\d+\)$", "", stem)
    parts = [p for p in stem.split("_") if p]
    out = []
    for p in parts:
        if p.isdigit():
            continue
        if p == "light" and out and out[-1] in ("Labu Jack",):
            out.append("Terang")
            continue
        out.append(WORDS.get(p, p.capitalize()))
    out = [w for w in out if w]
    return " ".join(out) or stem


# ---------------------------------------------------------------------------
# 4. The facility map, built from what exists
# ---------------------------------------------------------------------------

# folderKey -> (facility, base tags)
FACILITY_MAP = {
    "foods": ("restaurant", ["food", "sweet", "stamina"]),
    "foods_cooking": ("restaurant", ["food", "stamina", "warm"]),
    "drinks": ("restaurant", ["drink", "refresh", "stamina"]),
    "ice_cream": ("restaurant", ["food", "frost", "fire_resist", "sweet"]),
    "materials": ("blacksmith", ["tool", "metal", "durable"]),
    "tools_home_appliances": ("blacksmith", ["tool", "vessel"]),
    "electronics": ("blacksmith", ["tool", "gadget", "precision"]),
    "accessories": ("seamstress", ["accessory", "charm", "luck"]),
    "weather_rain": ("seamstress", ["armor", "travel", "water_resist"]),
    "flower_plants_tree_asset": ("wizardry", ["herb", "alchemy", "healing"]),
    "nature": ("wizardry", ["celestial", "mana", "luck"]),
    "animals": ("wizardry", ["familiar", "companion", "luck"]),
    "fruits_and_vegetables": ("raw_material", ["ingredient", "nature", "fresh"]),
    "chara_monster_set": ("monster", ["dungeon_enemy"]),
}

FACILITIES = [
    {"id": "restaurant", "name": "Restoran & Kedai", "keeper": "koneko", "icon": "🍲", "unlockChapter": 1},
    {"id": "blacksmith", "name": "Pandai Besi", "keeper": "zenimaru", "icon": "⚒️", "unlockChapter": 1},
    {"id": "seamstress", "name": "Penjahit & Perhiasan", "keeper": "kogane", "icon": "🧵", "unlockChapter": 2},
    {"id": "wizardry", "name": "Menara Sihir", "keeper": "mone", "icon": "🔮", "unlockChapter": 2},
]

# Extra semantic tags keyed on a token in the file stem.
TOKEN_TAGS = {
    "ice": ["frost", "fire_resist"], "icebar": ["frost"], "icecream": ["frost"], "softcream": ["frost"],
    "soda": ["refresh"], "coffee": ["focus", "warm"], "icecoffee": ["focus"], "tea": ["focus"],
    "yakizakana": ["warm", "stamina"], "bento": ["stamina", "travel"], "onigiri": ["travel", "stamina"],
    "sashimi": ["fresh"], "mochi": ["sweet", "luck"], "dango": ["sweet", "luck"], "tsukimidango": ["luck", "celestial"],
    "candle": ["fire", "light"], "haka": ["dark", "ward"], "kanoke": ["dark", "storage"], "kine": ["weapon", "blunt"],
    "sakazuki": ["ritual", "vessel"], "dentaku": ["precision", "ledger"], "controller": ["precision"],
    "jewelry": ["charm", "luck"], "emerald": ["mana"], "boshi": ["armor", "head"],
    "kasa": ["water_resist", "armor"], "amagu": ["armor", "water_resist", "warm"], "nagagutsu": ["armor", "travel"],
    "thunderstorm": ["lightning", "weapon"], "teruterubozu": ["luck", "ward"],
    "higanbana": ["dark", "alchemy"], "kikyo": ["healing"], "cosmos": ["healing", "charm"],
    "moon": ["celestial", "mana"], "kaede": ["fire", "warm"], "momiji": ["fire"],
    "komori": ["dark", "familiar"], "okami": ["weapon", "familiar"], "usagi": ["luck", "familiar"],
    "alpaca": ["warm", "familiar"], "azarashi": ["frost", "familiar"],
}

def tags_for(stem: str, base: list[str]) -> list[str]:
    tags = list(base)
    for token in stem.split("_"):
        for extra in TOKEN_TAGS.get(token, []):
            if extra not in tags:
                tags.append(extra)
    return tags


def tier_for(index: int, pool_size: int) -> int:
    """Spread a pool evenly across tiers 1..5."""
    return min(5, 1 + (index * 5) // max(1, pool_size))


def dedupe_colour_variants(entries: list[dict]) -> list[dict]:
    """
    Keep one of each colour family so the shelf is not forty near-
    identical jewels. The dropped variants are still copied and still
    appear in the encyclopedia as `variants`.
    """
    colours = {"black", "white", "blue", "red", "green", "yellow", "pink", "purple", "brown", "gray",
               "beige", "lightblue", "lightpink", "yellowgreen", "silver", "lightbrown", "orange"}
    seen: dict[str, dict] = {}
    for e in entries:
        stem = re.sub(r"\s*\(\d+\)$", "", e["stem"])
        key = "_".join(p for p in stem.split("_") if p not in colours and not p.isdigit())
        if key in seen:
            seen[key].setdefault("variants", []).append(e["path"])
        else:
            seen[key] = dict(e, family=key)
    return list(seen.values())


# ---------------------------------------------------------------------------
# 5. The database
# ---------------------------------------------------------------------------

CHARACTERS = [
    {
        "id": "koneko", "name": "Koneko (貯猫)", "role": "Front Storekeeper & Kasir",
        "kakeiboLink": "daily_income",
        "stageCoords": {"scene": "atelier", "xPercent": 48, "yPercent": 58},
        "skill": {"id": "lucky_koban_bell", "name": "Lucky Koban Bell",
                  "description": "Kecepatan kedatangan pelanggan +200% selama 30 detik.",
                  "durationSec": 30, "cooldownSec": 300, "effectType": "CUSTOMER_SPEED_MULTIPLIER", "value": 3.0},
    },
    {
        "id": "minori", "name": "Minori (実り)", "role": "Master Crafter & Peracik",
        "kakeiboLink": "needs_allocation",
        "stageCoords": {"scene": "workshop", "xPercent": 52, "yPercent": 60},
        "skill": {"id": "bountiful_harvest", "name": "Bountiful Harvest",
                  "description": "Peluang 25% menghasilkan 2 item sekaligus saat crafting (aktif 5 menit).",
                  "durationSec": 300, "cooldownSec": 600, "effectType": "DOUBLE_CRAFT_CHANCE", "value": 0.25},
    },
    {
        "id": "kaneru", "name": "Kaneru (奏る)", "role": "Royal Ledger & Akuntan",
        "kakeiboLink": "budget_audit",
        "stageCoords": {"scene": "atelier", "xPercent": 66, "yPercent": 52},
        "skill": {"id": "abacus_audit", "name": "Abacus Audit",
                  "description": "Memotong biaya kontrak mercenary ekspedisi berikutnya sebesar 30%.",
                  "durationSec": 0, "cooldownSec": 900, "effectType": "NEXT_EXPEDITION_DISCOUNT", "value": 0.30},
    },
    {
        "id": "kogane", "name": "Kogane (黄金)", "role": "VIP Appraiser & Broker",
        "kakeiboLink": "investments_goals",
        "stageCoords": {"scene": "atelier", "xPercent": 28, "yPercent": 68},
        "skill": {"id": "golden_pocket_watch", "name": "Golden Pocket Watch",
                  "description": "Mempercepat waktu ekspedisi dungeon & penjualan idle sebanyak 1 jam instan.",
                  "durationSec": 0, "cooldownSec": 1800, "effectType": "INSTANT_TIME_WARP_SEC", "value": 3600},
    },
    {
        "id": "mone", "name": "Mone (萌音)", "role": "Merchant Supplier & Vault Banker",
        "kakeiboLink": "saving_jar_bonus",
        "stageCoords": {"scene": "atelier", "xPercent": 78, "yPercent": 40},
        "skill": {"id": "compound_konpeito", "name": "Compound Konpeito Interest",
                  "description": "Memberikan bunga instan 5% dari saldo Brankas Tabungan Toko.",
                  "durationSec": 0, "cooldownSec": 1800, "effectType": "VAULT_INTEREST_PAYOUT", "value": 0.05},
    },
    {
        "id": "zenimaru", "name": "Zenimaru (銭丸)", "role": "Guild Captain & Mercenary Leader",
        "kakeiboLink": "impulse_monster_slayer",
        "stageCoords": {"scene": "atelier", "xPercent": 20, "yPercent": 44},
        "skill": {"id": "vanguard_coin_charge", "name": "Vanguard Charge",
                  "description": "Meningkatkan Win Rate ekspedisi dungeon sebesar +25% dan loot +1 bahan langka.",
                  "durationSec": 600, "cooldownSec": 600, "effectType": "DUNGEON_WIN_BOOST", "value": 0.25},
    },
]

CHAPTERS = [
    {"chapter": 1, "title": "Toko Tua di Sudut Kota", "requiredRank": 1,
     "unlockedFacilities": ["restaurant", "blacksmith"], "unlockedDungeons": ["whispering_woods"], "recipeCap": 30,
     "lore": "Koneko mewarisi toko kelontong kakeknya beserta surat utang Kerajaan Aurelia sebesar 5.000.000 Koban."},
    {"chapter": 2, "title": "Benang Sihir & Ramuan", "requiredRank": 2,
     "unlockedFacilities": ["restaurant", "blacksmith", "seamstress", "wizardry"],
     "unlockedDungeons": ["whispering_woods", "ember_cavern"], "recipeCap": 60,
     "lore": "Mone membuka menara sihir lama; Kogane menemukan jam saku emas yang berdetak mundur."},
    {"chapter": 3, "title": "Investigasi Retakan Sihir", "requiredRank": 3,
     "unlockedDungeons": ["whispering_woods", "ember_cavern", "crystal_grotto"], "recipeCap": 100,
     "lore": "Retakan di Crystal Grotto mengeluarkan bunyi lonceng yang sama dengan jam saku Kogane."},
    {"chapter": 4, "title": "Turnamen Guild Kerajaan", "requiredRank": 4,
     "unlockedDungeons": ["whispering_woods", "ember_cavern", "crystal_grotto", "ancient_ruins"], "recipeCap": 130,
     "lore": "Zenimaru membawa guild ke turnamen; catatan pajak lama membuktikan Kerajaan yang berutang pada toko, bukan sebaliknya."},
    {"chapter": 5, "title": "Restu Sang Raja", "requiredRank": 5,
     "unlockedDungeons": ["whispering_woods", "ember_cavern", "crystal_grotto", "ancient_ruins", "abyssal_rift"],
     "recipeCap": 150, "lore": "Raja menutup Abyssal Rift dengan bantuan enam penjaga toko, dan menghapus utang itu."},
]

DUNGEONS = [
    {"id": "whispering_woods", "name": "Whispering Woods", "chapter": 1, "durationSec": 180,
     "baseWinRate": 0.70, "mercenaryCost": 120, "lootFolder": "fruits_and_vegetables", "monsterTokens": ["ghost", "yurei", "komori"]},
    {"id": "ember_cavern", "name": "Ember Cavern", "chapter": 2, "durationSec": 420,
     "baseWinRate": 0.55, "mercenaryCost": 300, "lootFolder": "flower_plants_tree_asset", "monsterTokens": ["jackolantern", "majo"]},
    {"id": "crystal_grotto", "name": "Crystal Grotto", "chapter": 3, "durationSec": 900,
     "baseWinRate": 0.45, "mercenaryCost": 650, "lootFolder": "accessories", "monsterTokens": ["skeleton", "gaikotsu", "mummy"]},
    {"id": "ancient_ruins", "name": "Ancient Ruins", "chapter": 4, "durationSec": 1800,
     "baseWinRate": 0.38, "mercenaryCost": 1200, "lootFolder": "materials", "monsterTokens": ["zombie", "okamiotoko", "frankenstein"]},
    {"id": "abyssal_rift", "name": "Abyssal Rift", "chapter": 5, "durationSec": 3600,
     "baseWinRate": 0.30, "mercenaryCost": 2500, "lootFolder": "nature", "monsterTokens": ["kyuketsuki", "frankenstein", "yurei"]},
]

# The twelve requests. `want` is a list of item-family keys that count
# as a perfect match; `tags` are what counts as acceptable.
REQUEST_SEEDS = [
    ("Garrick sang Penjaga Perbatasan", "Pedang besiku hampir meleleh menahan semburan magma di Ember Cavern! Aku butuh sesuatu yang menyeimbangkan panas ekstrem itu.",
     "Cari kudapan dingin berelemen es (`frost` + `fire_resist`).", ["icebar_chocomint", "icecream_cone_mint", "softcream_milk"], ["frost", "fire_resist"], 450, 15,
     "Garrick bercerita retakan sihir di dasar Ember Cavern mengeluarkan suara lonceng kuno yang mirip jam saku keluarga Kogane."),
    ("Elise dari Menara Penyihir", "Aku harus berjaga semalaman menyalin gulungan mantra kerajaan. Mataku berat dan udara menara sangat dingin!",
     "Minuman penambah fokus atau sesuatu yang menghangatkan (`focus` + `warm`).", ["drink_coffeefloat", "drink_icecoffee", "amagu"], ["focus", "warm"], 320, 10,
     "Elise menyerahkan catatan pajak lama Istana: Kakek Koneko pernah meminjamkan dana besar kepada Kerajaan."),
    ("Tomas si Kurir Hujan", "Rute kurirku melewati Lembah Rintik tiga hari berturut-turut. Suratnya basah semua!",
     "Perlengkapan tahan air dari Penjahit (`water_resist`).", ["kasa", "amagu", "nagagutsu"], ["water_resist"], 280, 8,
     "Salah satu surat yang basah beralamat ke 'Kantor Perbendaharaan - perihal: piutang Koban & Co.'"),
    ("Nenek Hana", "Cucuku demam dan tak mau makan. Dulu kakeknya selalu membawakan sesuatu yang manis dan lembut.",
     "Makanan manis yang menenangkan (`sweet` + `healing` atau `stamina`).", ["ohagi_tsubuan", "kurimanju", "tsukimidango"], ["sweet"], 200, 8,
     "Nenek Hana ingat Kakek Koneko: 'Dia menolak dibayar. Katanya, Kerajaan sudah berutang cukup banyak padanya.'"),
    ("Kapten Brann", "Pasukanku berangkat subuh ke Crystal Grotto. Kami butuh bekal yang tahan lama dan mengenyangkan.",
     "Bekal perjalanan dari Restoran (`travel` + `stamina`).", ["conveni_onigiri_sake", "sozai_bento_karaage", "conveni_sandwich_ham"], ["travel", "stamina"], 380, 12,
     "Brann menyebut Grotto 'berdenyut seperti jantung'. Setiap denyut, jam saku Kogane berdetak sekali."),
    ("Lady Ophelia", "Pesta dansa Istana minggu depan dan aku tak punya satu pun perhiasan yang pantas!",
     "Perhiasan dari Penjahit (`charm` + `luck`).", ["jewelry_emerald", "jewelry_oval", "jewelry_round"], ["charm", "luck"], 520, 14,
     "Ophelia berbisik: Bendahara Kerajaan sengaja 'menghilangkan' arsip piutang warga agar utang Istana tak tercatat."),
    ("Pak Jiro Penjaga Makam", "Arwah di pemakaman tua makin gelisah tiap bulan purnama. Aku butuh penangkal.",
     "Benda penolak dari Pandai Besi atau Menara Sihir (`ward` atau `dark`).", ["haka", "teruterubozu", "higanbana"], ["ward", "dark"], 300, 10,
     "Jiro: 'Arwah-arwah itu menggumamkan satu kata: Aurelia. Nama Kerajaan sebelum berganti nama.'"),
    ("Mira si Penyihir Muda", "Ujian sihirku besok! Aku perlu bahan ramuan yang memulihkan mana dengan cepat.",
     "Herba atau benda langit dari Menara Sihir (`mana` atau `healing`).", ["kikyo", "object_moon", "jewelry_emerald"], ["mana", "healing"], 340, 10,
     "Mira menemukan mantra yang hanya bisa dibaca dengan cahaya jam saku Kogane."),
    ("Bard Lorien", "Suaraku serak setelah menyanyi tiga malam di kedai. Konser Kerajaan tinggal dua hari!",
     "Minuman yang menyegarkan tenggorokan (`refresh`).", ["drink_icelemontea", "drink_lemonsquash", "drink_icetea"], ["refresh"], 220, 8,
     "Lorien menyanyikan balada lama: 'Enam penjaga, satu toko, dan raja yang lupa membayar.'"),
    ("Tukang Kayu Odin", "Palu kayuku patah. Pesanan lesung mochi untuk festival harus selesai!",
     "Perkakas dari Pandai Besi (`tool` + `blunt` atau `durable`).", ["kine", "usu"], ["tool", "durable"], 260, 8,
     "Odin pernah memperbaiki lantai toko ini. Di bawahnya ada ruang bawah tanah yang terkunci sihir."),
    ("Juru Hitung Istana Sera", "Audit pajak tahunan! Sempoa lamaku hilang dan angkanya tak masuk akal.",
     "Alat hitung presisi dari Pandai Besi (`precision` + `ledger`).", ["dentaku", "pc_desktop"], ["precision"], 410, 12,
     "Sera, diam-diam, menyerahkan salinan buku besar: piutang Koban & Co. kepada Kerajaan tercatat 5.000.000 Koban."),
    ("Anak-anak Panti Asuhan", "Hari ini ulang tahun kami bersama! Boleh minta sesuatu yang dingin dan lucu?",
     "Es krim atau permen (`sweet` + `frost`).", ["icecream_cone_double_vanilla_strawberry", "softcream_milk_strawberry", "candy_peroperocandy"], ["sweet", "frost"], 180, 10,
     "Anak-anak itu memanggil Koneko 'Kakak Kucing Penabung'. Nama yang pernah dipakai kakeknya."),
]

RECIPE_FAMILIES = {
    "restaurant": "Resep tungku: {a} + {b} = {out}",
    "blacksmith": "Tempaan: {a} + {b} = {out}",
    "seamstress": "Jahitan: {a} + {b} = {out}",
    "wizardry": "Ramuan: {a} + {b} = {out}",
}


def build_database(library: dict[str, list[dict]]) -> dict:
    # Raw materials: fruits & vegetables (the dungeon loot) plus a few
    # plants and minerals so every facility has something to draw on.
    raw_pool = dedupe_colour_variants(library.get("fruits_and_vegetables", []))
    raw_pool += dedupe_colour_variants(library.get("flower_plants_tree_asset", []))[:12]
    raw_pool += dedupe_colour_variants(library.get("materials", []))[:4]
    raw_pool += dedupe_colour_variants(library.get("nature", []))[:1]
    raw_materials = []
    for i, e in enumerate(raw_pool):
        raw_materials.append({
            "id": f"raw_{e['family']}",
            "name": humanize(e["stem"]),
            "icon": e["path"],
            "tier": tier_for(i, len(raw_pool)),
            "buyPrice": 8 + 6 * tier_for(i, len(raw_pool)),
            "tags": tags_for(e["stem"], ["ingredient", "raw"]),
        })
    raw_by_tier: dict[int, list[dict]] = {}
    for r in raw_materials:
        raw_by_tier.setdefault(r["tier"], []).append(r)

    # Craftable items: every facility pool, colour-deduped, spread
    # across tiers, each given a 2-3 ingredient recipe and a clue.
    items = []
    recipes = []
    for folder_key, (facility, base_tags) in FACILITY_MAP.items():
        if facility in ("raw_material", "monster"):
            continue
        pool = dedupe_colour_variants(library.get(folder_key, []))
        for i, e in enumerate(pool):
            tier = tier_for(i, len(pool))
            item_id = f"item_{e['family']}"
            name = humanize(e["stem"])
            tags = tags_for(e["stem"], base_tags)
            sell = int(round((40 + 55 * tier + 9 * len(tags)) * (1.15 if facility in ("seamstress", "wizardry") else 1.0)))
            items.append({
                "id": item_id, "name": name, "facility": facility, "icon": e["path"],
                "tier": tier, "sellPrice": sell, "tags": tags,
                "variants": e.get("variants", []), "sourceFolder": folder_key,
            })
            # Ingredients: one from the same tier, one from a lower
            # tier, a third on tiers 3+. Deterministic by index so the
            # database is stable between runs.
            same = raw_by_tier.get(tier) or raw_materials
            lower = raw_by_tier.get(max(1, tier - 1)) or raw_materials
            a = same[i % len(same)]
            b = lower[(i * 7 + 3) % len(lower)]
            ingredients = [{"itemId": a["id"], "qty": 1 + (i % 2)}, {"itemId": b["id"], "qty": 1}]
            if tier >= 3:
                c = raw_materials[(i * 11 + tier) % len(raw_materials)]
                if c["id"] not in (a["id"], b["id"]):
                    ingredients.append({"itemId": c["id"], "qty": 1})
            clue = RECIPE_FAMILIES[facility].format(a=a["name"], b="?" if tier >= 2 else b["name"], out=name)
            recipes.append({
                "id": f"recipe_{e['family']}", "outputItemId": item_id, "facility": facility,
                "tier": tier, "ingredients": ingredients, "recipeClue": clue,
                "unlockChapter": 1 if facility in ("restaurant", "blacksmith") else 2,
            })

    # Monsters, keyed by the tokens the dungeons name.
    monsters = []
    for e in dedupe_colour_variants(library.get("chara_monster_set", [])):
        monsters.append({"id": f"mon_{e['family']}", "name": humanize(e["stem"]), "icon": e["path"],
                         "family": e["family"], "hp": 20 + 10 * len(e.get("variants", []))})
    for d in DUNGEONS:
        d["monsters"] = [m["id"] for m in monsters if any(t in m["family"] for t in d["monsterTokens"])][:6]
        loot = [r["id"] for r in raw_materials if r["icon"].startswith(f"/koban-assets/svg/{d['lootFolder']}/")]
        d["lootTable"] = (loot or [r["id"] for r in raw_materials])[:8]

    # Requests, resolved against the generated item families.
    by_family = {it["id"].removeprefix("item_"): it for it in items}
    requests = []
    for n, (who, complaint, hint, want, acc, reward, rep, story) in enumerate(REQUEST_SEEDS, 1):
        perfect = []
        for w in want:
            for fam, it in by_family.items():
                if fam == w or fam.startswith(w):
                    perfect.append(it["id"])
                    break
        requests.append({
            "id": f"req_{n:02d}", "chapter": 1 + (n - 1) // 3, "customerName": who, "complaint": complaint,
            "koganeHint": hint, "perfectMatches": perfect, "acceptableTags": acc,
            "baseRewardKoban": reward, "reputationPoints": rep, "storySnippet": story,
        })

    chars = []
    for c in CHARACTERS:
        chars.append(dict(c, sprite=f"/koban-assets/chara/{c['id']}.png", face=f"/koban-assets/face/{c['id']}.jpg"))

    return {
        "meta": {
            "gameTitle": "Koban & Co. General Goods",
            "kingdomDebtTotal": 5000000,
            "weeklyDebtInstallment": 350000,
            "debtStages": [250000, 500000, 750000, 1000000, 1000000, 1500000],
            "vaultInterestPerHour": 0.004,
            "chapters": CHAPTERS,
            "scenes": {"atelier": "/koban-assets/places/atelier.jpg", "workshop": "/koban-assets/places/workshop.jpg"},
            "svgCount": sum(len(v) for v in library.values()),
        },
        "characters": chars,
        "facilities": FACILITIES,
        "rawMaterials": raw_materials,
        "items": items,
        "recipes": recipes,
        "monsters": monsters,
        "dungeons": DUNGEONS,
        "customerRequests": requests,
    }


# ---------------------------------------------------------------------------
# 6. Verify
# ---------------------------------------------------------------------------

def verify() -> list[str]:
    problems = []
    for cid in CHARACTER_IDS:
        p = PUBLIC_DIR / "chara" / f"{cid}.png"
        if not p.exists():
            problems.append(f"missing sprite {p}")
            continue
        img = Image.open(p).convert("RGBA")
        if img.getpixel((1, 1))[3] != 0:
            problems.append(f"{cid}.png corner is not transparent")
        # The die-cut border survived: there is still opaque white
        # somewhere in the image.
        whites = sum(1 for px in img.getdata() if px[3] > 200 and px[0] > 240 and px[1] > 240 and px[2] > 240)
        if whites < 200:
            problems.append(f"{cid}.png lost its white die-cut border")
    db_path = DATA_DIR / "database.json"
    if not db_path.exists():
        return problems + ["database.json missing"]
    db = json.loads(db_path.read_text())
    if len(db["characters"]) != 6:
        problems.append("not six characters")
    if len(db["facilities"]) != 4:
        problems.append("not four facilities")
    if len(db["items"]) < 150:
        problems.append(f"only {len(db['items'])} items")
    if len(db["customerRequests"]) != 12:
        problems.append("not twelve requests")
    if len(db["dungeons"]) != 5:
        problems.append("not five dungeons")
    for it in db["items"][:400]:
        if not (PROJECT_ROOT / "frontend" / "public" / it["icon"].lstrip("/")).exists():
            problems.append(f"icon missing on disk: {it['icon']}")
            break
    for r in db["customerRequests"]:
        if not r["perfectMatches"]:
            problems.append(f"{r['id']} has no perfect match")
    return problems


def main() -> int:
    if "--check" in sys.argv:
        problems = verify()
        print("\n".join(problems) if problems else "koban assets: OK")
        return 1 if problems else 0

    print("1/3 stickers, faces, rooms …")
    img_report = build_images()
    print("   ", img_report)
    print("2/3 SVG library …")
    library = copy_svgs(find_svg_root())
    print("    folders:", {k: len(v) for k, v in library.items()})
    print("3/3 database.json …")
    db = build_database(library)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(db, ensure_ascii=False, indent=1)
    (DATA_DIR / "database.json").write_text(payload)
    # The database is also written as a module. This project's ESLint
    # parser cannot parse an import attribute, so `import db from
    # './database.json' with { type: 'json' }` is a parse error even
    # though Vite accepts it - and the lint gate is the arbiter.
    (DATA_DIR / "database.js").write_text(
        "// Generated by scripts/build_koban_assets.py - do not edit.\n"
        "// The JSON next to this file is the source of truth.\n"
        f"export default {payload};\n"
    )
    print(f"    characters={len(db['characters'])} facilities={len(db['facilities'])} raw={len(db['rawMaterials'])} "
          f"items={len(db['items'])} recipes={len(db['recipes'])} monsters={len(db['monsters'])} "
          f"dungeons={len(db['dungeons'])} requests={len(db['customerRequests'])} svg={db['meta']['svgCount']}")
    problems = verify()
    print("\n".join(problems) if problems else "verify: OK")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
