"""
Merchant Detection Service - Dynamic merchant extraction with fuzzy matching.
"""

import re
import logging
from typing import Optional, Dict, Any, List
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

# Common merchant patterns (Indonesian + Global)
KNOWN_MERCHANTS = [
    # Indonesian Retail
    "INDOMARET", "ALFAMART", "ALFAGIFT", "FAMILY MART", "FAMILYMART",
    "MATAKIOS", "MATA KIOS", "HOTEL", "GRAND LUCKY", "SUPERINDO",
    "YOGYA", "CARREFOUR", "HYPERMART", "GIANT", "TRANSMART",
    # Global Retail
    "WALMART", "TARGET", "COSTCO", "SAM'S CLUB", "KROGER",
    "SAFEWAY", "PUBLIX", "WHOLE FOODS", "TRADER JOE'S", "TRADER JOES",
    # Convenience Stores
    "7-ELEVEN", "7ELEVEN", "SEVEN ELEVEN", "LAWSON", "MINI STOP",
    "FAMILYMART", "AMPM",
    # Fast Food
    "MCDONALD", "MCDONALD'S", "KFC", "BURGER KING", "WENDY'S",
    "STARBUCKS", "SUBWAY", "PIZZA HUT", "DOMINO'S", "HOKBEN", "HOKKI",
    "CHIPOTLE", "TACO BELL", "DUNKIN", "DUNKIN' DONUTS",
    # Restaurants
    "RESTAURANT", "CAFE", "WARUNG", "RUMAH MAKAN", "PECEL LELE",
    "SOTO AYAM", "BAKSO", "MIE AYAM",
    # Pharmacies
    "GUARDIAN", "WATSONS", "ROBINSONS", "APOTIK", "APOTEK",
    # Gas Stations
    "PERTAMINA", "SHELL", "BP", "EXXON", "TOTAL",
    # E-Wallet/Payment
    "GOPAY", "OVO", "DANA", "LINKAJA", "SHOPEEPAY", "FLIP",
    # Banks (for SMS parsing)
    "BCA", "MANDIRI", "BNI", "BRI", "BTPN", "CIMB",
]

# Build a quick lookup set
MERCHANT_SET = {m.upper() for m in KNOWN_MERCHANTS}


def normalize_merchant_name(name: str) -> str:
    """Normalize merchant name for comparison."""
    if not name:
        return ""
    # Remove common suffixes
    name = name.upper().strip()
    suffixes_to_remove = [
        ' TBK', ' PT', ' TB', ' INC', ' LLC', ' LTD',
        ' ONLINE', ' STORE', ' OUTLET', ' INDONESIA'
    ]
    for suffix in suffixes_to_remove:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    return name


def similarity_score(s1: str, s2: str) -> float:
    """Calculate similarity ratio between two strings."""
    if not s1 or not s2:
        return 0.0
    return SequenceMatcher(None, s1.upper(), s2.upper()).ratio()


def find_best_merchant_match(candidate: str, threshold: float = 0.7) -> Optional[str]:
    """
    Find best matching merchant from known merchants.
    Returns matched merchant name or None if no match found.
    """
    if not candidate:
        return None
    
    candidate_normalized = normalize_merchant_name(candidate)
    
    # Exact match first
    if candidate_normalized in MERCHANT_SET:
        return candidate_normalized
    
    # Check partial matches
    best_score = 0.0
    best_match = None
    
    for merchant in MERCHANT_SET:
        # Check if merchant is contained in candidate
        if merchant in candidate_normalized or candidate_normalized in merchant:
            score = 0.9  # High score for partial match
        else:
            score = similarity_score(candidate_normalized, merchant)
        
        if score > best_score and score >= threshold:
            best_score = score
            best_match = merchant
    
    return best_match


def extract_merchant_from_lines(lines: List[str]) -> Dict[str, Any]:
    """
    Extract merchant name from receipt lines using heuristic:
    - Merchant name is usually in top 3 lines
    - Skip lines that are dates, addresses, phone numbers
    """
    if not lines:
        return {"merchant_name": None, "confidence": 0.0, "is_new": False}
    
    # Patterns to skip
    skip_patterns = [
        re.compile(r'^\d{2}[\.\/\-]\d{2}'),  # Date
        re.compile(r'^0\d{2}[\s\-]?\d{3,}', re.IGNORECASE),  # Phone
        re.compile(r'^Jl\.?\s', re.IGNORECASE),  # Address
        re.compile(r'^[=\-]{3,}$'),  # Separator
        re.compile(r'^Telp?\.?\s', re.IGNORECASE),  # Telephone
        re.compile(r'^Fax\.?\s', re.IGNORECASE),
    ]
    
    def should_skip(line: str) -> bool:
        line = line.strip()
        if not line or len(line) < 2:
            return True
        for pattern in skip_patterns:
            if pattern.match(line):
                return True
        return False
    
    # Try top lines
    for line in lines[:5]:  # Check top 5 lines
        line_clean = line.strip()
        if should_skip(line_clean):
            continue
        
        # Check for known merchant
        matched = find_best_merchant_match(line_clean)
        if matched:
            return {
                "merchant_name": matched.title(),
                "confidence": 0.9,
                "is_new": False,
                "raw_text": line_clean
            }
        
        # Check if any known merchant is mentioned anywhere in the line
        for merchant in MERCHANT_SET:
            if merchant in line_clean.upper():
                return {
                    "merchant_name": merchant.title(),
                    "confidence": 0.8,
                    "is_new": False,
                    "raw_text": line_clean
                }
    
    # No known merchant found - return first non-empty line as potential new merchant
    for line in lines[:3]:
        line_clean = line.strip()
        if line_clean and len(line_clean) > 2 and len(line_clean) < 50:
            return {
                "merchant_name": line_clean.title(),
                "confidence": 0.3,
                "is_new": True,
                "raw_text": line_clean
            }
    
    return {"merchant_name": None, "confidence": 0.0, "is_new": False}


def calculate_effective_price(raw_price: float, subtotal: float, grand_total: float) -> float:
    """
    Calculate effective price after proportional discount distribution.
    
    Formula: effective_price = raw_price * (grand_total / subtotal)
    """
    if subtotal <= 0 or grand_total <= 0:
        return raw_price
    
    ratio = grand_total / subtotal
    return round(raw_price * ratio, 2)
