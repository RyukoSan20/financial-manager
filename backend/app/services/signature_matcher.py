# ============================================================
# ITEM SIGNATURE MATCHING ENGINE
# ============================================================
# 
# Instead of relying on OCR text for merchant name,
# we infer merchant from UNIQUE ITEM PATTERNS in the receipt.
#
# For example, Indomaret receipts have distinctive items:
# - "S/ROTI" prefix (Sari Roti brand sold at Indomaret)
# - "CIMORY" products
# - "FF LOW FAT" (Frisian Flag)
# - "CAFELA" coffee
# ============================================================

from typing import Dict, List, Optional, Tuple
import re

# ============================================================
# MERCHANT SIGNATURES (Item Pattern Fingerprints)
# ============================================================

MERCHANT_SIGNATURES: Dict[str, Dict] = {
    "INDOMARET": {
        "type": "Retail",
        "category": "Minimarket",
        "confidence_threshold": 0.70,  # Lowered from 0.75
        "item_signatures": [
            # Unique product patterns
            {"pattern": r'S/ROTI', "weight": 0.25, "description": "Sari Roti bread"},
            {"pattern": r'CIMORY', "weight": 0.20, "description": "Cimory dairy"},
            {"pattern": r'FRISIAN FLAG|FRISIAN', "weight": 0.15, "description": "Frisian Flag milk"},
            {"pattern": r'CAFELA|CAFE LA', "weight": 0.15, "description": "Cafela coffee"},
            {"pattern": r'FF LOW FAT|FF\.', "weight": 0.15, "description": "Frisian Flag low fat"},
            {"pattern": r'INDOMIE|MIE GORENG', "weight": 0.10, "description": "Indomie"},
            {"pattern": r'PLASTIK SDG', "weight": 0.05, "description": "Plastic bag (common at Indomaret)"},
        ],
        "tax_signatures": [
            {"pattern": r'NPWP.*?(\d{2}\.\d{2}\.\d{2})', "weight": 0.10},
        ],
    },
    
    "ALFAMART": {
        "type": "Retail", 
        "category": "Minimarket",
        "confidence_threshold": 0.75,
        "item_signatures": [
            {"pattern": r'BIG BROW', "weight": 0.30, "description": "Big Brown cookies"},
            {"pattern": r'OKKY|OKI', "weight": 0.20, "description": "Okky/Japanese candy"},
            {"pattern": r'WOW', "weight": 0.15, "description": "WOW products"},
            {"pattern": r'NICEPACK', "weight": 0.15, "description": "Nicepack"},
            {"pattern": r'CHITATO', "weight": 0.10, "description": "Chitato chips"},
        ],
        "tax_signatures": [],
    },
    
    "SUPERINDO": {
        "type": "Retail",
        "category": "Supermarket", 
        "confidence_threshold": 0.80,
        "item_signatures": [
            {"pattern": r'FARMERS|FARMER', "weight": 0.25, "description": "Farmers market brand"},
            {"pattern": r'BOULANGERIE', "weight": 0.20, "description": "Bakery products"},
            {"pattern": r'CHOICE', "weight": 0.15, "description": "Choice brand"},
            {"pattern": r'DELI', "weight": 0.15, "description": "Deli brand"},
        ],
        "tax_signatures": [],
    },
    
    "GENERIC_MINIMARKET": {
        "type": "Retail",
        "category": "Minimarket",
        "confidence_threshold": 0.60,
        "item_signatures": [
            {"pattern": r'ROTI', "weight": 0.20, "description": "Bread products"},
            {"pattern": r'SUSU|MILK', "weight": 0.15, "description": "Milk products"},
            {"pattern": r'MIE|MI\s', "weight": 0.15, "description": "Noodles"},
            {"pattern": r'KOPI|COFFEE', "weight": 0.15, "description": "Coffee"},
            {"pattern": r'PLASTIK', "weight": 0.10, "description": "Plastic bag"},
            {"pattern": r'SNACK', "weight": 0.10, "description": "Snacks"},
        ],
        "tax_signatures": [],
    },
}


def match_items_to_merchant(item_names: List[str]) -> Tuple[bool, str, str, str, float]:
    """
    Infer merchant from item patterns.
    
    Returns: (matched, merchant_name, merchant_type, category, confidence)
    """
    if not item_names:
        return False, "", "Unknown", "Unknown", 0.0
    
    # Combine all item names for matching
    combined_text = " ".join(item_names).upper()
    
    best_match = None
    best_score = 0.0
    best_type = "Retail"
    best_category = "Unknown"
    
    for merchant, info in MERCHANT_SIGNATURES.items():
        total_weight = 0.0
        matched_weight = 0.0
        
        for sig in info.get("item_signatures", []):
            pattern = sig["pattern"].upper()
            weight = sig["weight"]
            total_weight += weight
            
            if re.search(pattern, combined_text, re.IGNORECASE):
                matched_weight += weight
        
        # Calculate normalized score
        if total_weight > 0:
            score = matched_weight / total_weight
        else:
            score = 0.0
        
        # Check if score meets threshold
        threshold = info.get("confidence_threshold", 0.75)
        
        if score >= threshold and score > best_score:
            best_score = score
            best_match = merchant
            best_type = info.get("type", "Retail")
            best_category = info.get("category", "Unknown")
    
    if best_match and best_score >= 0.70:
        return True, best_match, best_type, best_category, best_score
    
    return False, "", "Unknown", "Unknown", 0.0


def infer_merchant_from_items(items: List[Dict]) -> Dict:
    """
    Main function to infer merchant from parsed items.
    
    Returns dict with merchant info or empty if no match.
    """
    if not items:
        return {}
    
    item_names = [item.get("name", "") for item in items]
    
    matched, merchant, mtype, category, confidence = match_items_to_merchant(item_names)
    
    if matched:
        return {
            "merchant_name": merchant,
            "merchant_type": mtype,
            "category": category,
            "confidence": confidence,
            "source": "item_signature"
        }
    
    return {}
