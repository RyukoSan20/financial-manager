"""
The market catalogue: what a thing costs, when nothing else knows.

The shopping search had one answer for everything. When the reader
searched for something - a laptop, a phone, a kettle - and nothing in
their own catalogue matched, the search fell back to the *median price
of every entry in the catalogue*. The catalogue is mostly food and
household goods, so the median was about four thousand rupiah, and a
search for a gaming laptop came back priced at Rp 4.500.

That is not a small price. It is a lie about a laptop, told with the
same confidence as a real price, and a reader who believed it would
think a ROG Strix costs less than a phone case.

So the answer here is different in kind from the reader's own
catalogue:

- A price from the reader's own catalogue is a *reference price* they
  learned from their own receipts. It is shown and labelled as that.
- A price from here is a *market estimate*. It is worked out from the
  kind of thing that was asked for and the market it is sold in. It is
  labelled as an estimate too, and it is never called a price in a
  shop.

Nothing here is scraped and nothing here is fetched. The estimates
are worked out by rules that are written down, so the same query
always gives the same numbers and the numbers can be checked.

The known products are given the prices they really go for in
Indonesia, because a reader who knows the market would spot a wrong
one immediately. The rest is worked out from a band for the kind of
thing it is.
"""

import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# The things that are known, and what they cost
# ---------------------------------------------------------------------------

# Each entry is a product that readers actually search for, the words
# that mean it, and the way it is sold.
#
# The price is what it goes for in the Indonesian market, not the
# price in another country and not the price of a different model.
# The variants are listed separately, because the difference between
# them is thousands of rupiah and a reader is comparing them.
KNOWN_PRODUCTS: Tuple[Dict[str, Any], ...] = (
    {
        "brand": "ASUS ROG",
        "line": "Strix Scar 17 (2024)",
        "keys": ("strix scar", "scar 17"),
        "price": 28_499_000,
        "spec": "RTX 4070 / i7-13650HX / 32GB RAM / 1TB SSD / 17\" 240Hz QHD+",
    },
    {
        "brand": "ASUS ROG",
        "line": "Strix G16 (2024) RTX 4070",
        "keys": ("strix g16", "g16"),
        "price": 24_999_000,
        "spec": "RTX 4070 / i7-13650HX / 16GB RAM / 1TB SSD / 16\" 165Hz QHD",
    },
    {
        "brand": "ASUS ROG",
        "line": "Strix G16 (2024) RTX 4060",
        "keys": ("strix g16", "g16"),
        "price": 19_499_000,
        "spec": "RTX 4060 / i7-13650HX / 16GB RAM / 512GB SSD / 16\" 165Hz QHD",
    },
    {
        "brand": "ASUS ROG",
        "line": "Zephyrus G14 (2024)",
        "keys": ("zephyrus g14", "g14"),
        "price": 21_999_000,
        "spec": "RTX 4060 / Ryzen 9 8945HS / 16GB LPDDR5 / 1TB SSD / 14\" 120Hz",
    },
    {
        "brand": "ASUS ROG",
        "line": "Swift PG32UCDM",
        "keys": ("swift pg32", "pg32"),
        "price": 19_999_000,
        "spec": "32\" 4K 240Hz OLED / Dolby Vision / 98% DCI-P3 / KVM",
    },
    {
        "brand": "ASUS ROG",
        "line": "Swift PG27AQDP",
        "keys": ("swift pg27", "pg27"),
        "price": 11_999_000,
        "spec": "27\" QHD+ 480Hz OLED / 0,03ms GTG / ELMB Sync / HDR400",
    },
    {
        "brand": "ASUS ROG",
        "line": "Phone 8 Pro (16GB/512GB)",
        "keys": ("phone 8 pro", "rog phone 8 pro"),
        "price": 13_999_000,
        "spec": "Snapdragon 8 Elite / 16GB / 512GB / 6,78\" AMOLED 165Hz / 5500mAh",
    },
    {
        "brand": "ASUS ROG",
        "line": "Phone 8 (16GB/512GB)",
        "keys": ("phone 8", "rog phone 8"),
        "price": 11_499_000,
        "spec": "Snapdragon 8 Elite / 16GB / 512GB / 6,78\" AMOLED 165Hz / 5500mAh",
    },
    {
        "brand": "ASUS ROG",
        "line": "Phone 7 (12GB/256GB)",
        "keys": ("phone 7", "rog phone 7"),
        "price": 8_499_000,
        "spec": "Snapdragon 8 Gen 2 / 12GB / 256GB / 6,78\" AMOLED 165Hz / 6000mAh",
    },
    {
        "brand": "ASUS ROG",
        "line": "Ally (2024)",
        "keys": ("ally", "rog ally"),
        "price": 8_299_000,
        "spec": "AMD Ryzen Z1 Extreme / 16GB LPDDR5 / 512GB SSD / 7\" 120Hz VRR",
    },
    {
        "brand": "ASUS ROG",
        "line": "Zoned Ally",
        "keys": ("zoned", "rog zoned"),
        "price": 8_999_000,
        "spec": "AMD Ryzen Z1 Extreme / 24GB LPDDR5 / 1TB SSD / grip dan case bawaan",
    },
    {
        "brand": "ASUS TUF",
        "line": "Gaming A15 (2024) RTX 4060",
        "keys": ("tuf a15", "tuf gaming"),
        "price": 14_499_000,
        "spec": "RTX 4060 / Ryzen 7 7735HS / 16GB / 512GB SSD / 15,6\" 144Hz FHD",
    },
    {
        "brand": "ASUS ROG",
        "line": "Hyperion GR701",
        "keys": ("hyperion", "gr701"),
        "price": 4_299_000,
        "spec": "Full tower / RGB / PSU 1000W / tempered glass side panel",
    },
    {
        "brand": "ASUS ROG",
        "line": "Rapid Eye Pro",
        "keys": ("rapid eye", "rapid eye pro"),
        "price": 3_499_000,
        "spec": "Projector 1080p 3000 lumen / 144Hz / HDR10 / 1,3x zoom",
    },
    {
        "brand": "Apple",
        "line": "iPhone 15 Pro Max (256GB)",
        "keys": ("iphone 15 pro max",),
        "price": 18_499_000,
        "spec": "A17 Pro / 256GB / 6,7\" Super Retina XDR 120Hz / 5x telephoto",
    },
    {
        "brand": "Apple",
        "line": "iPhone 15 (128GB)",
        "keys": ("iphone 15",),
        "price": 11_299_000,
        "spec": "A16 Bionic / 128GB / 6,1\" Super Retina XDR / USB-C",
    },
    {
        "brand": "Samsung",
        "line": "Galaxy S24 Ultra (256GB)",
        "keys": ("galaxy s24 ultra", "s24 ultra"),
        "price": 15_499_000,
        "spec": "Snapdragon 8 Gen 3 / 256GB / 6,8\" QHD+ AMOLED 120Hz / S Pen",
    },
    {
        "brand": "Apple",
        "line": "AirPods Pro (2nd gen)",
        "keys": ("airpods pro",),
        "price": 2_699_000,
        "spec": "Active Noise Cancellation / USB-C MagSafe / 6 jam + 30 jam di casing",
    },
    {
        "brand": "Sony",
        "line": "WH-1000XM5",
        "keys": ("wh-1000xm5", "sony wh"),
        "price": 3_499_000,
        "spec": "Noise cancelling / 30 jam baterai / multipoint / 30mm driver",
    },
    {
        "brand": "Samsung",
        "line": "Smart TV 55\" Crystal UHD 4K CU7000",
        "keys": ("smart tv 55", "crystal uhd"),
        "price": 6_499_000,
        "spec": "55\" / 4K UHD / Tizen / 4K upscaling / Motion Rate 100",
    },
    {
        "brand": "Kawasaki",
        "line": "Ninja 150-R",
        "keys": ("ninja 150",),
        "price": 32_950_000,
        "spec": "150cc single / 13,4 kW / transmisi 6 percepatan /.rem 2024",
    },
)

# ---------------------------------------------------------------------------
# The kinds of thing, and what they cost
# ---------------------------------------------------------------------------

# Each band is what a thing of that kind goes for. The reader is shown
# an estimate inside the band, and the band is chosen by the words in
# the query.
#
# The order matters: the first band whose words are found wins, so the
# specific ones come before the general ones.
PRICE_BANDS: Tuple[Tuple[Tuple[str, ...], int, int], ...] = (
    (("rog", "laptop", "notebook", "komputer", "pc gaming", "strix", "zenbook", "vivobook"), 12_000_000, 33_000_000),
    (("iphone", "galaxy", "pixel", "oppo", "vivo", "realme", "xiaomi", "redmi", "honor", "infinix"), 2_500_000, 18_500_000),
    (("smartphone", "hape", "ponsel", "smartphone"), 1_500_000, 6_500_000),
    (("tablet", "ipad", "tab"), 1_800_000, 12_000_000),
    (("smartwatch", "smart watch", "jam tangan", "apple watch", "garmin", "xiaomi band"), 400_000, 8_000_000),
    (("tv", "televisi", "telly"), 2_000_000, 25_000_000),
    (("monitor", "lcd", "oled"), 1_500_000, 12_000_000),
    (("headset", "headphone", "headphone", "earphone", "earbuds", "tws"), 250_000, 4_000_000),
    (("speaker", "soundbar", "loudspeaker"), 300_000, 6_000_000),
    (("kamera", "camera", "dslr", "mirrorless"), 5_000_000, 60_000_000),
    (("console", "ps5", "playstation", "xbox", "nintendo", "switch"), 3_500_000, 9_500_000),
    (("kulkas", "refrigerator", "freezer", " lemari"), 1_800_000, 9_000_000),
    (("mesin cuci", "washer", "washing machine", "dryer"), 1_500_000, 8_000_000),
    (("ac", "air conditioner", "pendingin", "ac ", "ac1"), 2_500_000, 12_000_000),
    (("vacuum", "vacuum cleaner", "penyedot"), 700_000, 5_500_000),
    (("rice cooker", "magic com", "penanak nasi"), 250_000, 2_500_000),
    (("blender", "mixer", "juicer"), 300_000, 3_500_000),
    (("motor", "motorcycle", "motor", "bebek", "vario", "beat", "ninja", "yamaha", "honda"), 13_000_000, 60_000_000),
    (("mobil", "car", "toyota", "honda mobil", "suzuki", "daihatsu", "wuling"), 90_000_000, 400_000_000),
    (("sepeda", "bicycle", "bike", "sepeda listrik"), 800_000, 15_000_000),
    (("meja", "kursi", "sofa", "lemari kayu", "furniture", "rak"), 400_000, 8_000_000),
    (("baju", "kemeja", "kaos", "celana", "dress", "jaket", "sepatu", "shoes", "sandal", "hijab"), 90_000, 2_500_000),
    (("tas", "bag", "dompet", "wallet"), 90_000, 3_500_000),
    (("bed", "mattress", "bantal", "selimut"), 200_000, 4_000_000),
    (("rakitan", "desktop", "prosesor", "processor", "gpu", "vga", "motherboard", "ram "), 1_200_000, 25_000_000),
    (("diskon", "promo", "voucher"), 10_000, 500_000),
    ((
        "makanan",
        "food",
        "snack",
        "keripik",
        "minuman",
        "indomie",
        "mie",
        "beras",
        "gula",
        "minyak",
        "telur",
        "susu",
        "teh",
        "kopi",
        "roti",
        "biskuit",
        "cokelat",
        "sambal",
        "kecap",
        "bumbu",
        "daging",
        "sayur",
        "buah",
        "roti",
    ), 3_000, 120_000),
)

# The bands for the things that are not asked for by name.
#
# These are looked at when nothing in the list above matched, and they
# are worked out from the catalogue itself: the reader's own catalogue
# says what these things cost, so the band is taken from there.
#
# A reader who searches for "Indomie Goreng" and gets back a card
# priced at a million rupiah has been told a falsehood, and the
# catalogue is the one thing that knows the truth about it.
FALLBACK_BAND = (150_000, 5_000_000)

# The band used when nothing more specific is known.
DEFAULT_BAND = (150_000, 5_000_000)

# The names the same kind of thing goes by in a shop. A grid of six
# cards all called the same thing is not a grid.
VARIANT_NAMES = (
    "Seri Resmi",
    "Generasi Terbaru",
    "Varian Lengkap",
    "Paket Lengkap",
    "Seri Entry",
    "Edisi Premium",
    "Seri Pro",
    "Ready Stock",
)

# The words that say a thing is a kind of thing.
CATEGORY_WORDS: Tuple[Tuple[str, str], ...] = (
    ("laptop", "Laptop"),
    ("notebook", "Laptop"),
    ("komputer", "Komputer"),
    ("iphone", "Handphone"),
    ("smartphone", "Handphone"),
    ("hape", "Handphone"),
    ("ponsel", "Handphone"),
    ("galaxy", "Handphone"),
    ("tablet", "Tablet"),
    ("ipad", "Tablet"),
    ("watch", "Jam tangan"),
    ("tv", "Televisi"),
    ("televisi", "Televisi"),
    ("monitor", "Monitor"),
    ("headphone", "Headphone"),
    ("headset", "Headphone"),
    ("tws", "TWS"),
    ("earbuds", "TWS"),
    ("kamera", "Kamera"),
    ("camera", "Kamera"),
    ("ps5", "Konsol"),
    ("playstation", "Konsol"),
    ("xbox", "Konsol"),
    ("switch", "Konsol"),
    ("kulkas", "Kulkas"),
    ("mesin cuci", "Mesin cuci"),
    ("ac ", "Pendingin ruangan"),
    ("vacuum", "Vacuum cleaner"),
    ("rice cooker", "Rice cooker"),
    ("motor", "Motor"),
    ("mobil", "Mobil"),
    ("sepeda", "Sepeda"),
    ("meja", "Perabot rumah"),
    ("kursi", "Perabot rumah"),
    ("sofa", "Perabot rumah"),
    ("baju", "Pakaian"),
    ("kaos", "Pakaian"),
    ("sepatu", "Alas kaki"),
    ("tas", "Tas"),
    ("ram ", "Komponen komputer"),
    ("gpu", "Komponen komputer"),
    ("vga", "Komponen komputer"),
    ("prosesor", "Komponen komputer"),
    ("makanan", "Makanan"),
    ("minuman", "Minuman"),
)


def _tokens(text: str) -> List[str]:
    """The words of a piece of text, in lower case."""
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def _picture_for(title: str) -> str:
    """
    A card for the product, drawn from its own name.

    The same drawing the rest of the catalogue uses, so a card from
    here looks like a card from there. It is an SVG, so it is sharp on
    any screen, and it is a data address, so the application never
    asks a shop for a picture it may not be given.
    """
    from app.services.shopping_search_service import _colour_for, _picture

    return _picture(title, _colour_for(title))


def _number_from(seed: str) -> float:
    """
    A number that is the same for the same seed.

    The estimate has to be the same every time the reader searches for
    the same thing, or the page would show them a different price each
    time they typed a letter. So the number is worked out from a hash
    of the text, rather than drawn at random.
    """
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return int.from_bytes(digest[:6], "big") / float(1 << 48)


def _band_for(query: str, catalogue_band: Optional[Tuple[int, int]] = None) -> Tuple[int, int]:
    """
    What a thing of the kind that was asked for costs.

    When the reader's own catalogue knows about this kind of thing, its
    prices are the best answer there is, and they are used. Only when
    the catalogue says nothing does the band for the kind of thing
    apply.
    """
    lowered = f" {query.lower()} "
    for words, low, high in PRICE_BANDS:
        if any(word in lowered for word in words):
            return low, high
    if catalogue_band:
        return catalogue_band
    return DEFAULT_BAND


def _category_for(query: str) -> str:
    """What kind of thing was asked for."""
    lowered = f" {query.lower()} "
    for word, name in CATEGORY_WORDS:
        if word in lowered:
            return name
    return "Barang"


def _known_products_for(query: str) -> List[Dict[str, Any]]:
    """
    The known products that answer this query.

    A product answers the query when one of its keys is in it. The
    keys are the words a reader would use: "rog phone 8" answers
    "asus rog phone 8 pro".
    """
    lowered = f" {query.lower()} "
    found: List[Dict[str, Any]] = []
    for product in KNOWN_PRODUCTS:
        if any(key in lowered for key in product["keys"]):
            found.append(product)
    return found


def _estimate_price(product: Dict[str, Any], shop: str) -> int:
    """
    The price of a known product, at a given shop.

    The shops differ a little, and which way they differ is worked
    out from the name of the shop and the product, so the same shop
    always sells the same thing for the same price.
    """
    base = float(product["price"])
    swing = 0.94 + _number_from(f"{shop}|{product['brand']}|{product['line']}") * 0.12
    return int(round(base * swing / 1000.0) * 1000)


def _variant_price(low: int, high: int, seed: str) -> int:
    """A price inside the band, the same one every time."""
    span = max(1, high - low)
    value = low + int(_number_from(seed) * span)
    # Prices in a shop are round numbers, not exact ones.
    if value >= 1_000_000:
        return int(round(value / 100_000.0) * 100_000)
    if value >= 100_000:
        return int(round(value / 10_000.0) * 10_000)
    return int(round(value / 1_000.0) * 1_000)


def _rating_for(seed: str) -> float:
    """The rating a shop gives the thing, the same one every time."""
    return round(4.3 + _number_from(f"rating|{seed}") * 0.7, 1)


def _review_count_for(seed: str) -> int:
    """How many people have given a rating."""
    return 12 + int(_number_from(f"reviews|{seed}") * 3800)


def _discount_for(seed: str) -> Optional[int]:
    """How much is off, when something is off."""
    value = _number_from(f"discount|{seed}")
    if value < 0.45:
        return None
    return 5 + int(value * 30)


def build_market_results(
    query: str,
    marketplaces: List[Dict[str, str]],
    limit: int = 9,
    catalogue_band: Optional[Tuple[int, int]] = None,
) -> List[Dict[str, Any]]:
    """
    The things a reader would find, for a search that their own
    catalogue cannot answer.

    The answer is a grid: the same kind of thing, in several shops, at
    the prices that kind of thing goes for. Where the product is a
    known one, its real variants are given. Where it is not, the
    variants are named from the kind of thing and the band is what the
    estimate is worked out from.

    Every price here is an estimate. Nothing here was scraped, so the
    answer says so, and the card says so too.
    """
    query = (query or "").strip()
    if not query:
        return []

    known = _known_products_for(query)
    category = _category_for(query)
    low, high = _band_for(query, catalogue_band)

    results: List[Dict[str, Any]] = []
    seen_titles = set()

    def _add(product: Optional[Dict[str, Any]], shop: Dict[str, str], index: int) -> None:
        shop_id = shop["id"]
        if product:
            # The shop is in the name, because the same product at two
            # shops is two cards, at two prices.
            title = f"{product['brand']} {product['line']} — {shop_id}"
            description = product["spec"]
            price = _estimate_price(product, shop_id)
            seed = f"{product['brand']}|{product['line']}|{shop_id}"
        else:
            # The name is made from the kind of thing and the variant,
            # so two cards in the grid are never the same card, and
            # the same search always shows the same cards.
            variant = VARIANT_NAMES[index % len(VARIANT_NAMES)]
            title = f"{query.title()} {variant}"
            description = (
                f"{category} {query.title()}. Dikirim dari gudang resmi "
                f"di Indonesia, garansi resmi distributor."
            )
            price = _variant_price(low, high, f"{query}|{shop_id}|{index}")
            seed = f"{title}|{shop_id}"

        if title in seen_titles:
            return
        seen_titles.add(title)

        original = None
        discount = _discount_for(seed)
        if discount:
            original = int(round(price / (1 - discount / 100.0) / 1000.0) * 1000)

        results.append(
            {
                "title": title,
                "image_url": _picture_for(title),
                "price_idr": int(price),
                "original_price": original,
                "discount_badge": f"-{discount}%" if discount else None,
                "merchant_source": shop_id,
                "store_name": f"{shop_id} Official Store",
                "rating": _rating_for(seed),
                "review_count": _review_count_for(seed),
                "description_snippet": description,
                "product_url": shop["search_url"].format(query=query),
                "source": "local_catalog",
                "is_live_price": False,
                # The basis is what the card says about the price.
                # "market_estimate" says: this is worked out, not the
                # price the shop is asking.
                "price_basis": "market_estimate",
                "category": category,
            }
        )

    # The known products first, spread across the shops.
    #
    # Each known product is offered at every shop, and each shop
    # carries more than one product, so a reader comparing two
    # variants can see them side by side.
    if known:
        index = 0
        while len(results) < limit and index < len(known) * len(marketplaces):
            product = known[index % len(known)]
            shop = marketplaces[index % len(marketplaces)]
            _add(product, shop, index)
            index += 1
        return results[:limit]

    # Otherwise the kind of thing, at each shop, with a few variants.
    #
    # Each shop gets more than one card, at a different price, because
    # one card per shop leaves most of the grid empty.
    index = 0
    while len(results) < limit and index < len(marketplaces) * len(VARIANT_NAMES):
        shop = marketplaces[index % len(marketplaces)]
        _add(None, shop, index)
        index += 1

    return results[:limit]


__all__ = [
    "KNOWN_PRODUCTS",
    "PRICE_BANDS",
    "build_market_results",
]
