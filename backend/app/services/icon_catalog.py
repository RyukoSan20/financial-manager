"""
The icon set a category or a merchant can wear.

The catalogue used to have a short list of emoji, and anything new that
the user typed was given a generic one. The user asked to be able to
pick the icon themselves, freely.

So the list is long, grouped by what the thing is, and it is served
from the backend. The reason it lives here and not in the frontend is
that the same list has to be used by the web app, by the receipt
scanner when it names a new merchant, and by anything else that has to
describe a category. One list, one place.

Every entry carries a keyword list. The keyword list is what lets the
receipt scanner suggest an icon for a merchant it has never seen, and
what lets the frontend offer a search that finds "apotek" when the
user types "obat".
"""

from typing import Any, Dict, List, Optional


# Each group is a set of icons that go together, so the picker can be
# browsed by kind rather than shown as one long list.
ICON_GROUPS: List[Dict[str, Any]] = [
    {
        "id": "food",
        "label": "Makanan & Minuman",
        "icons": [
            {"value": "🍔", "label": "Burger", "keywords": ["burger", "hamburger"]},
            {"value": "🍕", "label": "Pizza", "keywords": ["pizza", "piza"]},
            {"value": "🍜", "label": "Mi rebus", "keywords": ["mie", "noodle", "ramen"]},
            {"value": "🍚", "label": "Nasi", "keywords": ["nasi", "rice"]},
            {"value": "🍛", "label": "Nasi kuning", "keywords": ["nasi kuning", "nasigoreng"]},
            {"value": "🍣", "label": "Sushi", "keywords": ["sushi", "sashimi"]},
            {"value": "🍱", "label": "Bento", "keywords": ["bento", "prasmanan"]},
            {"value": "🍗", "label": "Ayam goreng", "keywords": ["ayam", "fried chicken"]},
            {"value": "🍖", "label": "Daging", "keywords": ["daging", "meat", "steak"]},
            {"value": "🐟", "label": "Ikan", "keywords": ["ikan", "fish", "tuna", "sarden"]},
            {"value": "🥚", "label": "Telur", "keywords": ["telur", "egg"]},
            {"value": "🥛", "label": "Susu", "keywords": ["susu", "milk"]},
            {"value": "☕", "label": "Kopi", "keywords": ["kopi", "coffee", "espresso"]},
            {"value": "🧋", "label": "Boba", "keywords": ["boba", "bubble tea", "milktea"]},
            {"value": "🍵", "label": "Teh", "keywords": ["teh", "tea"]},
            {"value": "🥤", "label": "Minuman dingin", "keywords": ["soda", "coke", "pepsi", "air mineral"]},
            {"value": "🍺", "label": "Bir", "keywords": ["bir", "beer", "alkohol"]},
            {"value": "🍷", "label": "Anggur", "keywords": ["anggur", "wine"]},
            {"value": "🍰", "label": "Kue", "keywords": ["kue", "cake", "bolu"]},
            {"value": "🍪", "label": "Biskuit", "keywords": ["biscuit", "cookie", "wafer"]},
            {"value": "🍫", "label": "Cokelat", "keywords": ["cokelat", "chocolate", "choco"]},
            {"value": "🍿", "label": "Popcorn", "keywords": ["popcorn", "keripik"]},
            {"value": "🥨", "label": "Roti", "keywords": ["roti", "bread", "sambon"]},
            {"value": "🍞", "label": "Roti tawar", "keywords": ["bread", "sambon", "tawar"]},
            {"value": "🧀", "label": "Keju", "keywords": ["keju", "cheese"]},
            {"value": "🥗", "label": "Salad", "keywords": ["salad", "sayur"]},
            {"value": "🌽", "label": "Jagung", "keywords": ["jagung", "corn"]},
            {"value": "🍅", "label": "Tomat", "keywords": ["tomat", "tomato"]},
            {"value": "🥑", "label": "Alpukat", "keywords": ["alpukat", "avocado"]},
            {"value": "🍌", "label": "Pisang", "keywords": ["pisang", "banana"]},
            {"value": "🍎", "label": "Buah", "keywords": ["apel", "apple", "buah"]},
            {"value": "🍇", "label": "Anggur buah", "keywords": ["anggur", "grape"]},
            {"value": "🍉", "label": "Semangka", "keywords": ["semangka", "melon"]},
            {"value": "🥑", "label": "Sayur", "keywords": ["sayur", "vegetable"]},
            {"value": "🍲", "label": "Masakan", "keywords": ["masakan", "masak", "soto", "gulai"]},
            {"value": "🍱", "label": "Makan siang", "keywords": ["lunch", "makan siang", "nasi campur"]},
            {"value": "🍽️", "label": "Restoran", "keywords": ["restoran", "restaurant", "warung", "cafe", "kafe", "kedai", "rumah makan", "food court", "mcd", "kfc", "burger"]},
            {"value": "🥡", "label": "Makan di jalan", "keywords": ["gerobak", "kaki lima"]},
            {"value": "🍦", "label": "Es krim", "keywords": ["es krim", "ice cream"]},
        ],
    },
    {
        "id": "shopping",
        "label": "Belanja",
        "icons": [
            {"value": "🛒", "label": "Keranjang", "keywords": ["belanja", "shopping"]},
            {"value": "🏪", "label": "Minimarket", "keywords": ["minimarket", "supermarket", "indomaret", "alfamart", "hypermarket", "swalayan", "souvenir", "toko"]},
            {"value": "🏬", "label": "Mal", "keywords": ["mal", "mall", "plaza"]},
            {"value": "🛍️", "label": "Tas belanja", "keywords": ["tas", "shopping bag"]},
            {"value": "👕", "label": "Baju", "keywords": ["baju", "kaos", "shirt", "clothes"]},
            {"value": "👖", "label": "Celana", "keywords": ["celana", "jeans", "pants"]},
            {"value": "👗", "label": "Dress", "keywords": ["dress", "gamis"]},
            {"value": "👟", "label": "Sepatu", "keywords": ["sepatu", "shoes", "sandal"]},
            {"value": "🧥", "label": "Jaket", "keywords": ["jaket", "jacket", "hoodie"]},
            {"value": "👜", "label": "Tas", "keywords": ["tas", "handbag", "backpack"]},
            {"value": "💄", "label": "Kosmetik", "keywords": ["kosmetik", "lipstik", "foundation"]},
            {"value": "💍", "label": "Perhiasan", "keywords": ["perhiasan", "jewellery", "cincin"]},
            {"value": "⌚", "label": "Jam tangan", "keywords": ["jam", "watch"]},
            {"value": "📱", "label": "Gadget", "keywords": ["hp", "handphone", "phone", "smartphone"]},
            {"value": "💻", "label": "Laptop", "keywords": ["laptop", "komputer", "computer"]},
            {"value": "🎧", "label": "Headset", "keywords": ["headset", "earphone", "tws"]},
            {"value": "🔌", "label": "Elektronik", "keywords": ["elektronik", "charger", "kabel", "usb"]},
            {"value": "🔋", "label": "Baterai", "keywords": ["baterai", "battery", "powerbank"]},
            {"value": "💡", "label": "Lampu", "keywords": ["lampu", "lamp"]},
            {"value": "🧸", "label": "Mainan", "keywords": ["mainan", "toy"]},
            {"value": "📚", "label": "Buku", "keywords": ["buku", "book", "novel"]},
            {"value": "✏️", "label": "Alat tulis", "keywords": ["alat tulis", "stationery", "pulpen", "buku tulis"]},
            {"value": "🎁", "label": "Hadiah", "keywords": ["hadiah", "gift"]},
        ],
    },
    {
        "id": "home",
        "label": "Rumah & Kebutuhan",
        "icons": [
            {"value": "🏠", "label": "Rumah", "keywords": ["rumah", "house", "hunian"]},
            {"value": "🛋️", "label": "Perabot", "keywords": ["perabot", "sofa", "kursi"]},
            {"value": "🛏️", "label": "Tempat tidur", "keywords": ["kasur", "bed", "bantal"]},
            {"value": "🧹", "label": "Kebersihan", "keywords": ["sapu", "tempat sampah", "bersih"]},
            {"value": "🧼", "label": "Sabun", "keywords": ["sabun", "soap", "cuci"]},
            {"value": "🧴", "label": "Shampo", "keywords": ["shampo", "shampoo", "sampo"]},
            {"value": "🧽", "label": "Sponsor", "keywords": ["sponsor", "spon"]},
            {"value": "🧻", "label": "Tisu", "keywords": ["tisu", "tissue"]},
            {"value": "🚿", "label": "Air", "keywords": ["air", "shower", "mandi"]},
            {"value": "🚽", "label": "Toilet", "keywords": ["toilet", "wc", "squat"]},
            {"value": "🍽️", "label": "Dapur", "keywords": ["dapur", "panci", "wajan"]},
            {"value": "🔪", "label": "Peralatan dapur", "keywords": ["pisau", "sendok", "peredik"]},
            {"value": "🔧", "label": "Perbaikan", "keywords": ["perbaikan", "servis", "bengkel", "tambal ban", "ganti oli", "tune up"]},
            {"value": "🧰", "label": "Perkakas", "keywords": ["perkakas", "tool", "obang"]},
            {"value": "💧", "label": "Air bersih", "keywords": ["air bersih", "pdam"]},
            {"value": "🔥", "label": "Gas & BBM", "keywords": ["gas", "bbm", "pertamax", "bensin"]},
            {"value": "💡", "label": "Listrik", "keywords": ["listrik", "pln", "token listrik"]},
            {"value": "🌱", "label": "Taman", "keywords": ["taman", "tanah", "pot"]},
            {"value": "🐱", "label": "Hewan peliharaan", "keywords": ["kucing", "anjing", "pet"]},
        ],
    },
    {
        "id": "health",
        "label": "Kesehatan",
        "icons": [
            {"value": "💊", "label": "Obat", "keywords": ["obat", "medicine", "tablet", "apotek", "pharmacy", "farmasi"]},
            {"value": "🏥", "label": "Rumah sakit", "keywords": ["rumah sakit", "hospital"]},
            {"value": "🩺", "label": "Dokter", "keywords": ["dokter", "doctor", "klinik"]},
            {"value": "🦷", "label": "Gigi", "keywords": ["gigi", "dokter gigi", "sikat gigi"]},
            {"value": "👁️", "label": "Mata", "keywords": ["mata", "kacamata", "optik"]},
            {"value": "🧘", "label": "Olahraga", "keywords": ["sport", "gym", "yoga", "lari"]},
            {"value": "⚽", "label": "Bola", "keywords": ["sepak bola", "bola", "futsal"]},
            {"value": "🏀", "label": "Basket", "keywords": ["basket", "baskel"]},
            {"value": "🏃", "label": "Lari", "keywords": ["lari", "run"]},
            {"value": "🧘‍♀️", "label": "Kesehatan mental", "keywords": ["mental", "meditasi"]},
            {"value": "💆", "label": "Pijat", "keywords": ["pijat", "massage", "spa"]},
            {"value": "🩹", "label": "Perawatan", "keywords": ["pertolongan", "plester"]},
        ],
    },
    {
        "id": "transport",
        "label": "Transportasi",
        "icons": [
            {"value": "🚗", "label": "Mobil", "keywords": ["mobil", "car", "parkir", "bengkel", "oli", "sparepart", "ban"]},
            {"value": "🚕", "label": "Taksi", "keywords": ["taksi", "taxi", "grab", "gojek"]},
            {"value": "🚌", "label": "Bus", "keywords": ["bus", "transjakarta", "k Transjakarta"]},
            {"value": "🚂", "label": "Kereta", "keywords": ["kereta", "train", "kai"]},
            {"value": "✈️", "label": "Pesawat", "keywords": ["pesawat", "plane", "flight", "tiket"]},
            {"value": "🚁", "label": "Helikopter", "keywords": ["helikopter"]},
            {"value": "⛵", "label": "Kapal", "keywords": ["kapal", "ferry"]},
            {"value": "🚲", "label": "Sepeda", "keywords": ["sepeda", "bike", "gopay"]},
            {"value": "🛵", "label": "Motor", "keywords": ["motor", "motorcycle"]},
            {"value": "🛢️", "label": "BBM", "keywords": ["bbm", "bensin", "pertamax"]},
            {"value": "🅿️", "label": "Parkir", "keywords": ["parkir", "parking"]},
            {"value": "🛣️", "label": "Tol", "keywords": ["tol", "jalan"]},
            {"value": "🛟", "label": "Ban", "keywords": ["ban", "tire"]},
            {"value": "🚦", "label": "Lampu lalu lintas", "keywords": ["lalu lintas", "macet"]},
        ],
    },
    {
        "id": "finance",
        "label": "Keuangan",
        "icons": [
            {"value": "💰", "label": "Uang", "keywords": ["uang", "money", "cash"]},
            {"value": "💳", "label": "Kartu", "keywords": ["kartu", "card", "debit", "kredit"]},
            {"value": "🏦", "label": "Bank", "keywords": ["bank", "bca", "bni", "bri", "mandiri", "bsi"]},
            {"value": "💵", "label": "Tunai", "keywords": ["tunai", "cash"]},
            {"value": "🧾", "label": "Struk", "keywords": ["struk", "nota", "receipt", "invoice"]},
            {"value": "📊", "label": "Laporan", "keywords": ["laporan", "report", "analisis"]},
            {"value": "📈", "label": "Naik", "keywords": ["naik", "gain", "profit", "untung"]},
            {"value": "📉", "label": "Turun", "keywords": ["turun", "loss", "rugi"]},
            {"value": "🧮", "label": "Hitungan", "keywords": ["hitung", "kalkulator"]},
            {"value": "🏷️", "label": "Diskon", "keywords": ["diskon", "voucher", "promo", "kupon"]},
            {"value": "🎯", "label": "Target", "keywords": ["target", "tujuan", "goal"]},
            {"value": "📅", "label": "Tagihan", "keywords": ["tagihan", "bill", "jatuh tempo"]},
            {"value": "🔁", "label": "Berulang", "keywords": ["berulang", "recurring", "langganan"]},
            {"value": "🤝", "label": "Pinjaman", "keywords": ["pinjaman", "utang", "kredit"]},
            {"value": "💼", "label": "Kerja", "keywords": ["kerja", "gaji", "salary", "kantor"]},
            {"value": "🏛️", "label": "Pajak", "keywords": ["pajak", "tax", "spt"]},
            {"value": "🏦", "label": "Tabungan", "keywords": ["tabungan", "deposito"]},
        ],
    },
    {
        "id": "education",
        "label": "Pendidikan",
        "icons": [
            {"value": "🎓", "label": "Wisuda", "keywords": ["wisuda", "graduation", "kuliah"]},
            {"value": "🏫", "label": "Sekolah", "keywords": ["sekolah", "school", "smp", "sma"]},
            {"value": "📝", "label": "Ujian", "keywords": ["ujian", "test", "uas"]},
            {"value": "💡", "label": "Kursus", "keywords": ["kursus", "course", "kelas"]},
            {"value": "🔬", "label": "Laboratorium", "keywords": ["lab", "laboratorium"]},
            {"value": "🌐", "label": "Bahasa", "keywords": ["bahasa", "language", "inggris"]},
        ],
    },
    {
        "id": "entertainment",
        "label": "Hiburan",
        "icons": [
            {"value": "🎬", "label": "Film", "keywords": ["film", "movie", "bioskop", "netflix"]},
            {"value": "🎮", "label": "Game", "keywords": ["game", "gameplay", "steam"]},
            {"value": "🎵", "label": "Musik", "keywords": ["musik", "music", "spotify", "concert"]},
            {"value": "🎤", "label": "Konser", "keywords": ["konser", "concert"]},
            {"value": "📺", "label": "TV", "keywords": ["tv", "televisi", "channel"]},
            {"value": "🎭", "label": "Pertunjukan", "keywords": ["pertunjukan", "theater", "drama"]},
            {"value": "📷", "label": "Fotografi", "keywords": ["foto", "camera", "photography"]},
            {"value": "🎨", "label": "Seni", "keywords": ["seni", "art", "gambar"]},
            {"value": "⚽", "label": "Olahraga", "keywords": ["liga", "bola", "sepak bola"]},
            {"value": "🎲", "label": "Hobi", "keywords": ["hobi", "game"]},
            {"value": "🎣", "label": "Memancing", "keywords": ["memancing", "fishing"]},
            {"value": "🧗", "label": "Mendaki", "keywords": ["mendaki", "climbing", "gunung"]},
        ],
    },
    {
        "id": "services",
        "label": "Layanan",
        "icons": [
            {"value": "📶", "label": "Internet", "keywords": ["internet", "wifi", "indihome", "telkomsel"]},
            {"value": "📱", "label": "Pulsa", "keywords": ["pulsa", "sim card", "telkomsel", "simPATI"]},
            {"value": "🧾", "label": "Tagihan", "keywords": ["tagihan", "bill"]},
            {"value": "🚿", "label": "Air", "keywords": ["pdam", "air"]},
            {"value": "🗑️", "label": "Sampah", "keywords": ["sampah", "trash"]},
            {"value": "✂️", "label": "Potong rambut", "keywords": ["potong rambut", "barber", "salon"]},
            {"value": "🧑‍💼", "label": "Jasa", "keywords": ["jasa", "service", "servis"]},
            {"value": "🚚", "label": "Kurir", "keywords": ["kurir", "ongkir", "shipping", "jne", "tiki"]},
            {"value": "📦", "label": "Pengiriman", "keywords": ["paket", "package", "belanja online"]},
            {"value": "🏨", "label": "Hotel", "keywords": ["hotel", "penginapan", "stay"]},
            {"value": "✈️", "label": "Liburan", "keywords": ["liburan", "travel", "tour"]},
        ],
    },
    {
        "id": "general",
        "label": "Umum",
        "icons": [
            {"value": "⭐", "label": "Bintang", "keywords": ["bintang", "favorit", "star"]},
            {"value": "❤️", "label": "Hati", "keywords": ["hati", "love", "favorit"]},
            {"value": "✅", "label": "Centang", "keywords": ["centang", "check", "selesai"]},
            {"value": "🔔", "label": "Lonceng", "keywords": ["lonceng", "notifikasi", "notification"]},
            {"value": "📌", "label": "Pin", "keywords": ["pin", "pinned"]},
            {"value": "🏷️", "label": "Label", "keywords": ["label", "tag"]},
            {"value": "🔖", "label": "Bookmark", "keywords": ["bookmark", "tandai"]},
            {"value": "❓", "label": "Pertanyaan", "keywords": ["tanya", "unknown", "lainnya"]},
            {"value": "📦", "label": "Paket", "keywords": ["paket", "barang"]},
            {"value": "🗂️", "label": "Berkas", "keywords": ["berkas", "file", "dokumen"]},
            {"value": "🧾", "label": "Nota", "keywords": ["nota", "struk"]},
            {"value": "🎁", "label": "Hadiah", "keywords": ["hadiah"]},
            {"value": "💎", "label": "Nilai", "keywords": ["nilai", "value", "berharga"]},
            {"value": "🔔", "label": "Alarm", "keywords": ["alarm", "pengingat"]},
            {"value": "🎯", "label": "Sasaran", "keywords": ["sasaran", "target"]},
        ],
    },
]


def _flatten() -> List[Dict[str, Any]]:
    """Every icon, with the group it belongs to."""
    flat: List[Dict[str, Any]] = []
    for group in ICON_GROUPS:
        for icon in group["icons"]:
            flat.append(
                {
                    "value": icon["value"],
                    "label": icon["label"],
                    "group": group["id"],
                    "group_label": group["label"],
                    "keywords": icon.get("keywords", []),
                }
            )
    return flat


ALL_ICONS: List[Dict[str, Any]] = _flatten()


def icon_values() -> List[str]:
    """Every icon value that exists."""
    return [icon["value"] for icon in ALL_ICONS]


def is_valid_icon(value: Optional[str]) -> bool:
    """Whether this icon is one of ours."""
    if not value:
        return False
    return value in set(icon_values())


def find_icon(value: Optional[str]) -> Optional[Dict[str, Any]]:
    """The entry for this icon value."""
    if not value:
        return None
    for icon in ALL_ICONS:
        if icon["value"] == value:
            return icon
    return None


def suggest_icon(
    text: str,
    limit: int = 5,
    category: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    The icons that fit this text best.

    Used when the system names a merchant or a product it has never seen
    and has to give it an icon. The keyword list is what makes this
    work: "apotek" finds the medicine icon, "warung" finds the
    restaurant one.

    The category is a second hint. When the text itself says nothing
    useful ("Telur Premium") but the category says "Makanan", the
    icons of that group are preferred.
    """
    if not text and not category:
        return []

    needle = (text or "").lower().strip()
    scored: List[tuple] = []

    for icon in ALL_ICONS:
        score = 0

        # The category points at a group. It is a weak signal on its
        # own, so it only breaks a tie.
        if category:
            cat = category.lower().strip()
            if cat and cat in icon["group_label"].lower():
                score = max(score, 2)
        label = icon["label"].lower()
        haystack = f"{label} {' '.join(icon['keywords'])}"

        # The text contains the keyword. A longer keyword that matches
        # is a stronger signal.
        for keyword in icon["keywords"]:
            if keyword and keyword in needle:
                score = max(score, len(keyword))

        # The keyword contains the text. This is the case where the
        # user typed "apotek" and the keyword is "apotek", or where
        # they typed something shorter than the word.
        for keyword in icon["keywords"]:
            if keyword and needle in keyword:
                score = max(score, len(needle))

        # The label itself matches.
        if label and (label in needle or needle in label):
            score = max(score, len(label) + 1)

        if score:
            scored.append((score, icon))

    scored.sort(key=lambda pair: (-pair[0], len(pair[1]["label"])))
    return [icon for _, icon in scored[:limit]]


def suggest_icon_value(text: str, fallback: str = "🏷️") -> str:
    """One icon for this text."""
    matches = suggest_icon(text, limit=1)
    if matches:
        return matches[0]["value"]
    return fallback
