# ============================================================
# SMART CATALOG & DICTIONARY MATCHING ENGINE
# ============================================================

from typing import Dict, List, Set, Tuple, Optional
import re

# ============================================================
# MASTER PRODUCT CATALOG (Indonesian Retail)
# ============================================================

PRODUCT_CATALOG: Dict[str, Dict] = {
    # Dairy & Beverages
    "CIMORY": {"category": "Makanan & Minuman", "keywords": ["CIMORY", "YOGURT", "SUSU"]},
    "FRISIAN FLAG": {"category": "Makanan & Minuman", "keywords": ["FRISIAN", "FLAG", "SUSU"]},
    "ULU": {"category": "Makanan & Minuman", "keywords": ["ULU", "SARI", "TEMPATI"]},
    "TEH": {"category": "Makanan & Minuman", "keywords": ["TEH", "TEBU", "KOTAK", "CUP"]},
    "KOPI": {"category": "Makanan & Minuman", "keywords": ["KOPI", "CAFÉ", "CAFE", "ESPRESO", "EXPRESO"]},
    "SUSU": {"category": "Makanan & Minuman", "keywords": ["SUSU", "MILK", "UHT"]},
    "YOGURT": {"category": "Makanan & Minuman", "keywords": ["YOGURT", "Yakult"]},
    
    # Bread & Bakery
    "ROTI": {"category": "Makanan & Minuman", "keywords": ["ROTI", "BREAD", "PINK", "HOKI", "PARAJE"]},
    "PANDAN": {"category": "Makanan & Minuman", "keywords": ["PANDAN"]},
    "SARI ROTI": {"category": "Makanan & Minuman", "keywords": ["SARI ROTI", "S/ROTI"]},
    
    # Snacks
    "CHITATO": {"category": "Makanan & Minuman", "keywords": ["CHITATO", "LAYS", "KRITIKU"]},
    "POCARI": {"category": "Makanan & Minuman", "keywords": ["POCARI", "POCARISWEAT"]},
    "MIE": {"category": "Makanan & Minuman", "keywords": ["MIE", "MI GORENG", "MI REBUS", "INDOMIE", "SUPERMI"]},
    
    # Personal Care
    "SHAMPOO": {"category": "Perawatan Diri", "keywords": ["SHAMPOO", "SAMPO"]},
    "SABUN": {"category": "Perawatan Diri", "keywords": ["SABUN", "SOAP", "LIFEBUOY", "DOVE"]},
    "ODOL": {"category": "Perawatan Diri", "keywords": ["ODOL", "PASTA GIGI", "TOOTHPASTE"]},
    "PEWANGI": {"category": "Perawatan Diri", "keywords": ["PEWANGI", "PEWANGI PAKAIAN"]},
    
    # Household
    "PLASTIK": {"category": "Rumah Tangga", "keywords": ["PLASTIK", "PLASTIC", "KANTONG"]},
    "SABLON": {"category": "Rumah Tangga", "keywords": ["SABLON"]},
    "SANDAL": {"category": "Rumah Tangga", "keywords": ["SANDAL", "SEPATU"]},
    "PEMBERSIH": {"category": "Rumah Tangga", "keywords": ["PEMBERSIH", "CAIRAN"]},
    
    # General retail tokens
    "Beras": {"category": "Makanan & Minuman", "keywords": ["BERAS", "RICE"]},
    "Gula": {"category": "Makanan & Minuman", "keywords": ["GULA", "SUGAR"]},
    "Minyak": {"category": "Makanan & Minuman", "keywords": ["MINYAK", "OIL"]},
    "Telur": {"category": "Makanan & Minuman", "keywords": ["TELUR", "EGG"]},
    "Kopi": {"category": "Makanan & Minuman", "keywords": ["KOPI", "COFFEE"]},
    "Teh": {"category": "Makanan & Minuman", "keywords": ["TEH", "TEA"]},
    
    # Common product keywords
    "MIX": {"category": "Makanan & Minuman", "keywords": ["MIX", "BERRY", "STRAWBERRY"]},
    "VANILA": {"category": "Makanan & Minuman", "keywords": ["VANILA", "VANILLA", "VAN"]},
    "CHOCO": {"category": "Makanan & Minuman", "keywords": ["CHOCO", "CHOCOLATE", "COKLAT"]},
    "COFFEE": {"category": "Makanan & Minuman", "keywords": ["COFFEE", "ESPRESO", "ESPRESSO", "LATTE"]},
}

# Build searchable keyword index
KEYWORD_INDEX: Set[str] = set()
CATEGORY_MAP: Dict[str, str] = {}

for product, info in PRODUCT_CATALOG.items():
    CATEGORY_MAP[product] = info["category"]
    for keyword in info["keywords"]:
        KEYWORD_INDEX.add(keyword.upper())


def tokenize(line: str) -> List[str]:
    """Tokenize line into words."""
    # Remove currency symbols and normalize
    cleaned = re.sub(r'[^\w\s]', ' ', line)
    tokens = cleaned.upper().split()
    return tokens


def find_catalog_matches(line: str) -> List[Tuple[str, str]]:
    """
    Find catalog matches in a line.
    Returns list of (matched_keyword, category) tuples.
    """
    tokens = tokenize(line)
    matches = []
    
    for token in tokens:
        # Direct match in keyword index
        if token in KEYWORD_INDEX:
            for product, info in PRODUCT_CATALOG.items():
                if token in [k.upper() for k in info["keywords"]]:
                    matches.append((token, info["category"]))
                    break
    
    return matches


def calculate_catalog_score(line: str) -> Tuple[float, List[str]]:
    """
    Calculate how many catalog keywords are found in the line.
    Returns (score, matched_keywords)
    """
    tokens = tokenize(line)
    matched = []
    
    for token in tokens:
        if token in KEYWORD_INDEX:
            matched.append(token)
    
    # Score = matched tokens / total tokens, normalized to 0-1
    if not tokens:
        return 0.0, []
    
    score = len(matched) / max(len(tokens), 1)
    return score, matched


def is_valid_product_line(line: str, min_keyword_threshold: int = 1) -> Tuple[bool, List[str], str]:
    """
    Check if line is a valid product/item line based on catalog matching.
    
    Returns: (is_valid, matched_keywords, category)
    """
    if not line or len(line.strip()) < 3:
        return False, [], "Unknown"
    
    matches = find_catalog_matches(line)
    
    if matches:
        categories = [m[1] for m in matches]
        # Return most common category
        category = max(set(categories), key=categories.count) if categories else "Unknown"
        keywords = [m[0] for m in matches]
        return True, keywords, category
    
    return False, [], "Unknown"


def extract_category_from_items(items: List[Dict]) -> str:
    """
    Determine overall transaction category from item list.
    """
    if not items:
        return "Lainnya"
    
    category_counts: Dict[str, int] = {}
    for item in items:
        cat = item.get("category", "Unknown")
        if cat != "Unknown":
            category_counts[cat] = category_counts.get(cat, 0) + 1
    
    if category_counts:
        return max(category_counts.keys(), key=lambda k: category_counts[k])
    
    return "Lainnya"
