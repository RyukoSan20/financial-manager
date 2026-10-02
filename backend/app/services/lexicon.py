# ============================================================
# MERCHANT LEXICON SERVICE
# ============================================================

from typing import Dict, List, Optional, Tuple

# Master list of Indonesian retail merchants
MERCHANT_LEXICON: Dict[str, Dict] = {
    # Convenience Stores
    "INDOMARET": {"type": "Retail", "category": "Minimarket", "aliases": ["INDOMARET", "INDOMART", "INDO MARET"]},
    "ALFAMART": {"type": "Retail", "category": "Minimarket", "aliases": ["ALFAMART", "ALFAMIDI", "ALFAMART MINI"]},
    "ALFAMIDI": {"type": "Retail", "category": "Minimarket", "aliases": ["ALFAMIDI", "AMIDI"]},
    "CERIA": {"type": "Retail", "category": "Minimarket", "aliases": ["CERIA"]},
    
    # Supermarkets
    "SUPERINDO": {"type": "Retail", "category": "Supermarket", "aliases": ["SUPERINDO", "SUPER INDO"]},
    "FARMERS_MARKET": {"type": "Retail", "category": "Supermarket", "aliases": ["FARMERS MARKET", "FARMERS", "FARMERS MARKET INDONESIA"]},
    "CARREFOUR": {"type": "Retail", "category": "Hypermarket", "aliases": ["CARREFOUR", "CARREFOUR HYPERMART"]},
    "GIANT": {"type": "Retail", "category": "Hypermarket", "aliases": ["GIANT", "GIANT HYPERMART"]},
    "HYPERMART": {"type": "Retail", "category": "Hypermarket", "aliases": ["HYPERMART"]},
    "MATAHARIMALL": {"type": "Retail", "category": "Mall", "aliases": ["MATAHARIMALL", "MATAHARI"]},
    
    # E-Wallets
    "GOPAY": {"type": "E-Wallet", "category": "Payment", "aliases": ["GOPAY", "GO-PAY"]},
    "OVO": {"type": "E-Wallet", "category": "Payment", "aliases": ["OVO"]},
    "DANA": {"type": "E-Wallet", "category": "Payment", "aliases": ["DANA"]},
    "SHOPEEPAY": {"type": "E-Wallet", "category": "Payment", "aliases": ["SHOPEEPAY", "SHOPEE PAY"]},
    "LINKAJA": {"type": "E-Wallet", "category": "Payment", "aliases": ["LINKAJA", "LINK AJA"]},
    
    # Banks
    "BCA": {"type": "Bank", "category": "Banking", "aliases": ["BCA", "BANK BCA"]},
    "MANDIRI": {"type": "Bank", "category": "Banking", "aliases": ["MANDIRI", "BANK MANDIRI"]},
    "BNI": {"type": "Bank", "category": "Banking", "aliases": ["BNI", "BANK BNI"]},
    "BRI": {"type": "Bank", "category": "Banking", "aliases": ["BRI", "BANK BRI"]},
    "BTPN": {"type": "Bank", "category": "Banking", "aliases": ["BTPN", "BTPN SYARIAH"]},
    
    # Food & Beverage
    "STARBUCKS": {"type": "F&B", "category": "Coffee Shop", "aliases": ["STARBUCKS", "STARBUCKS COFFEE"]},
    "KFC": {"type": "F&B", "category": "Fast Food", "aliases": ["KFC"]},
    "MCDONALD": {"type": "F&B", "category": "Fast Food", "aliases": ["MCDONALD", "MC DONALD", "MCD"]},
    "WENDYS": {"type": "F&B", "category": "Fast Food", "aliases": ["WENDYS", "WENDY'S"]},
    "PIZZA HUT": {"type": "F&B", "category": "Fast Food", "aliases": ["PIZZA HUT", "PIZZA"]},
    "DOMINOS": {"type": "F&B", "category": "Fast Food", "aliases": ["DOMINOS", "DOMINO'S"]},
    "CHILIPOKI": {"type": "F&B", "category": "Fast Food", "aliases": ["CHILIPOKI", "CHILI POKI"]},
    
    # Transport
    "GOJEK": {"type": "Transport", "category": "Ride-Hailing", "aliases": ["GOJEK", "GO-JEK"]},
    "GRAB": {"type": "Transport", "category": "Ride-Hailing", "aliases": ["GRAB"]},
    "MAXIM": {"type": "Transport", "category": "Ride-Hailing", "aliases": ["MAXIM"]},
    
    # Telecom
    "TELKOMSEL": {"type": "Telecom", "category": "Provider", "aliases": ["TELKOMSEL", "SIMPATI", "AS", "LOOP"]},
    "INDOSAT": {"type": "Telecom", "category": "Provider", "aliases": ["INDOSAT", "IM3", "MENTARI"]},
    "XL": {"type": "Telecom", "category": "Provider", "aliases": ["XL", "XL AXIATA"]},
}


def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    prev_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]


def similarity_ratio(s1: str, s2: str) -> float:
    """Calculate similarity ratio between two strings (0.0 to 1.0)."""
    if not s1 and not s2:
        return 1.0
    s1, s2 = s1.upper().strip(), s2.upper().strip()
    if s1 == s2:
        return 1.0
    distance = levenshtein_distance(s1, s2)
    max_len = max(len(s1), len(s2))
    return 1.0 - (distance / max_len) if max_len > 0 else 1.0


def match_merchant(ocr_text: str, threshold: float = 0.70) -> Tuple[bool, str, str, float]:
    """
    Match OCR text against merchant lexicon.
    
    Returns: (matched, canonical_name, merchant_type, confidence_score)
    """
    ocr_clean = ocr_text.upper().strip()
    
    best_match = None
    best_score = 0.0
    best_type = "Unknown"
    
    for canonical, info in MERCHANT_LEXICON.items():
        # Check canonical name
        score = similarity_ratio(ocr_clean, canonical)
        
        # Check aliases
        for alias in info.get("aliases", []):
            alias_score = similarity_ratio(ocr_clean, alias)
            if alias_score > score:
                score = alias_score
        
        if score > best_score:
            best_score = score
            best_match = canonical
            best_type = info.get("type", "Unknown")
    
    if best_score >= threshold:
        return True, best_match, best_type, best_score
    
    return False, ocr_text, "Unknown", 0.0
