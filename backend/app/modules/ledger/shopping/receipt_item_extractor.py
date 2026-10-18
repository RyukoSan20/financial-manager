"""
Receipt Item Extractor - Extracts individual items from receipt OCR text.
"""
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class ExtractedItem:
    """Individual item extracted from receipt."""
    name: str
    quantity: float
    unit_price: float
    total_price: float
    raw_line: str


class ReceiptItemExtractor:
    """
    Extracts line items from receipt OCR text.
    Handles various receipt formats from Indonesian stores.
    """
    
    # Common Indonesian receipt patterns
    ITEM_PATTERNS = [
        # Pattern: Item name + price at end
        r'(.+?)\s+([\d,]+)\s*$',
        # Pattern: Quantity x Price = Total
        r'([\d]+)\s*[xX]\s*([\d,.]+)\s*=\s*([\d,.]+)',
        # Pattern: Name then price on next lines
        r'^(.+?)$\s*^([\d,.]+)$',
    ]
    
    def extract(self, ocr_text: str) -> List[ExtractedItem]:
        """
        Extract items from OCR text.
        Returns list of ExtractedItem objects.
        """
        items = []
        lines = ocr_text.split('\n')
        
        for i, line in enumerate(lines):
            item = self._parse_line(line)
            if item:
                items.append(item)
        
        return items
    
    def _parse_line(self, line: str) -> Optional[ExtractedItem]:
        """Parse a single line from receipt."""
        line = line.strip()
        if not line or len(line) < 3:
            return None
        
        # Try different patterns
        parsed = self._try_patterns(line)
        if parsed:
            return parsed
        
        # Check if line contains a price
        price_match = re.search(r'([\d,]+)\s*$', line)
        if price_match:
            # Extract price
            price_str = price_match.group(1).replace(',', '')
            try:
                price = float(price_str)
                if price > 0 and price < 100000000:  # Reasonable price range
                    name = re.sub(r'[\d,]+$', '', line).strip()
                    if name:
                        return ExtractedItem(
                            name=name,
                            quantity=1,
                            unit_price=price,
                            total_price=price,
                            raw_line=line
                        )
            except ValueError:
                pass
        
        return None
    
    def _try_patterns(self, line: str) -> Optional[ExtractedItem]:
        """Try parsing with different regex patterns."""
        # Pattern: 2 x 15,000 = 30,000
        match = re.match(r'([\d.]+)\s*[xX]\s*([\d,]+)\s*=\s*([\d,.]+)', line)
        if match:
            qty = float(match.group(1))
            unit_price = float(match.group(2).replace(',', ''))
            total = float(match.group(3).replace(',', ''))
            name = re.sub(r'[\d\s=xX,]+$', '', line).strip()
            
            return ExtractedItem(
                name=name or "Item",
                quantity=qty,
                unit_price=unit_price,
                total_price=total,
                raw_line=line
            )
        
        return None
    
    def categorize_items(self, items: List[ExtractedItem]) -> Dict[str, Any]:
        """Categorize extracted items."""
        categories = {
            "needs": [],      # Kebutuhan pokok
            "wants": [],      # Keinginan
            "other": []       # Lainnya
        }
        
        NEEDS_KEYWORDS = [
            "beras", "minyak", "gula", "telur", "susu", "roti",
            "sabun", "shampoo", "odol", "tisu", "obat", "obat nyamuk",
            "gas", "pembersih", "detergen", "mie", "sarden", "kornet"
        ]
        
        for item in items:
            name_lower = item.name.lower()
            
            if any(k in name_lower for k in NEEDS_KEYWORDS):
                categories["needs"].append(item.name)
            else:
                categories["wants"].append(item.name)
        
        return categories


def extract_receipt_items(ocr_text: str) -> List[ExtractedItem]:
    """Convenience function to extract items."""
    extractor = ReceiptItemExtractor()
    return extractor.extract(ocr_text)
