"""
Merchant Normalizer - Fuzzy matching for messy merchant names.
"""
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict


@dataclass
class NormalizationResult:
    """Result of merchant name normalization."""
    original: str
    normalized: str
    category: str
    brand: str
    confidence: float
    suggestions: List[str]


# Known brand mappings for Indonesia
BRAND_MAPPINGS = {
    # Coffee & Cafes
    "starbucks": ("Starbucks", "Cafe"),
    "kopi kenjangan": ("Kopi Kenangan", "Cafe"),
    "kopi kini": ("Kopi Kenangan", "Cafe"),
    "janji jiwa": ("Janji Jiwa", "Cafe"),
    "hocko": ("Hocko", "Cafe"),
    "djournal": ("DJournal", "Cafe"),
    "excelso": ("Excelso", "Cafe"),
    "coffee bean": ("The Coffee Bean", "Cafe"),
    "twenty one": ("Twenty One", "Cafe"),
    
    # Fast Food
    "mcd": ("McDonald's", "Fast Food"),
    "mc donald": ("McDonald's", "Fast Food"),
    "kfc": ("KFC", "Fast Food"),
    "rj": ("Richeese Factory", "Fast Food"),
    "richeese": ("Richeese Factory", "Fast Food"),
    "hokben": ("HokBen", "Fast Food"),
    "hoka hoka bento": ("HokBen", "Fast Food"),
    "burger king": ("Burger King", "Fast Food"),
    "wendy": ("Wendy's", "Fast Food"),
    
    # Convenience Stores
    "indomaret": ("Indomaret", "Minimarket"),
    "indomar": ("Indomaret", "Minimarket"),
    "alfamart": ("Alfamart", "Minimarket"),
    "alfamidi": ("AlfaMidi", "Minimarket"),
    " Lawson": ("Lawson", "Minimarket"),
    
    # Supermarkets
    "transmart": ("Transmart", "Supermarket"),
    "carrefour": ("Carrefour", "Supermarket"),
    "giant": ("Giant", "Supermarket"),
    "hypermart": ("Hypermart", "Supermarket"),
    "hero": ("Hero", "Supermarket"),
    "duta martyr": ("Hero", "Supermarket"),
    "lotte": ("Lotte", "Supermarket"),
    
    # E-Commerce
    "shopee": ("Shopee", "E-Commerce"),
    "tokopedia": ("Tokopedia", "E-Commerce"),
    "blibli": ("Blibli", "E-Commerce"),
    "lazada": ("Lazada", "E-Commerce"),
    "bukalapak": ("Bukalapak", "E-Commerce"),
    
    # Transport
    "grab": ("Grab", "Transport"),
    "gojek": ("Gojek", "Transport"),
    "blue bird": ("Blue Bird", "Transport"),
    "silver bird": ("Silver Bird", "Transport"),
    
    # Fashion
    "uniqlo": ("Uniqlo", "Fashion"),
    "zara": ("Zara", "Fashion"),
    "hm": ("H&M", "Fashion"),
    "gap": ("Gap", "Fashion"),
    "sogo": ("Sogo", "Fashion"),
    "metro": ("Metro", "Fashion"),
    "panengg": ("Panengg", "Fashion"),
    
    # Electronics
    "electronic city": ("Electronic City", "Elektronik"),
    "bestDenki": ("Best Denki", "Elektronik"),
    " eras": ("Eras", "Elektronik"),
    "撸小": ("Lumo", "Elektronik"),
}


class MerchantNormalizer:
    """
    Normalizes messy merchant names from receipts/statements.
    Uses fuzzy matching to find the canonical brand name.
    """
    
    def __init__(self):
        self.mappings = BRAND_MAPPINGS
        self._build_index()
    
    def _build_index(self):
        """Build searchable index from mappings."""
        self.searchable = []
        for keyword, (brand, category) in self.mappings.items():
            self.searchable.append((keyword, brand, category))
    
    def normalize(self, raw_name: str) -> NormalizationResult:
        """
        Normalize a merchant name.
        
        Examples:
        - "PT MITRA ADIPERKASA TBK S" -> "Starbucks"
        - "STARBUCKS COFFEE GRAND INDONESIA" -> "Starbucks"
        - "INDOMARET RETAIL STORE" -> "Indomaret"
        """
        if not raw_name:
            return NormalizationResult(
                original="",
                normalized="Unknown",
                category="Lainnya",
                brand="",
                confidence=0.0,
                suggestions=[]
            )
        
        raw_lower = raw_name.lower().strip()
        
        # Step 1: Exact/substring match
        for keyword, brand, category in self.searchable:
            if keyword in raw_lower:
                return NormalizationResult(
                    original=raw_name,
                    normalized=brand,
                    category=category,
                    brand=brand,
                    confidence=0.95,
                    suggestions=[]
                )
        
        # Step 2: Fuzzy match using Levenshtein distance
        best_match = self._fuzzy_match(raw_lower)
        if best_match:
            return best_match
        
        # Step 3: Extract known patterns
        category = self._extract_category(raw_lower)
        
        return NormalizationResult(
            original=raw_name,
            normalized=raw_name.title(),
            category=category,
            brand="",
            confidence=0.3,
            suggestions=self._get_suggestions(raw_lower)
        )
    
    def _fuzzy_match(self, raw_name: str) -> Optional[NormalizationResult]:
        """Use Levenshtein distance for fuzzy matching."""
        # Simple implementation - can be enhanced with rapidfuzz
        for keyword, brand, category in self.searchable:
            # Calculate similarity
            similarity = self._calculate_similarity(raw_name, keyword)
            
            if similarity > 0.8:
                return NormalizationResult(
                    original=raw_name,
                    normalized=brand,
                    category=category,
                    brand=brand,
                    confidence=similarity,
                    suggestions=[]
                )
        
        return None
    
    def _calculate_similarity(self, s1: str, s2: str) -> float:
        """Calculate simple similarity score."""
        if not s1 or not s2:
            return 0.0
        
        # Character-based Jaccard similarity
        set1 = set(s1)
        set2 = set(s2)
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def _extract_category(self, name: str) -> str:
        """Extract category from merchant name."""
        name_lower = name.lower()
        
        categories = {
            "restaurant": ["restaurant", "cafe", "kedai", "warung", "makan"],
            "fashion": ["boutique", "cloth", "wear", "fashion", "store"],
            "grocery": ["mart", "market", "supermarket", "belanja", "grocery"],
            "electronics": ["electronic", "gadget", "hp", "komputer", "laptop"],
            "pharmacy": ["apotek", "pharmacy", "kesehatan"],
            "fuel": ["bensin", "shell", "pertamina", "total", "bp"],
            "transport": ["taxi", "transport", "parkir", "toll"],
        }
        
        for category, keywords in categories.items():
            if any(k in name_lower for k in keywords):
                return category.title()
        
        return "Lainnya"
    
    def _get_suggestions(self, name: str) -> List[str]:
        """Get suggested normalizations."""
        suggestions = []
        
        for keyword, brand, _ in self.searchable:
            if any(c in name for c in keyword[:3]):
                suggestions.append(brand)
                if len(suggestions) >= 3:
                    break
        
        return suggestions


# Singleton
merchant_normalizer = MerchantNormalizer()


def normalize_merchant(raw_name: str) -> NormalizationResult:
    """Convenience function to normalize a merchant name."""
    return merchant_normalizer.normalize(raw_name)
