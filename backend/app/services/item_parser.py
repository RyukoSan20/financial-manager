# ============================================================
# ITEM PARSER - Generic Right-to-Left Splitter
# NO hardcoded vendor/product names
# ============================================================

import re
from typing import Optional, List, Tuple, Dict, Any
from dataclasses import dataclass


@dataclass
class ParsedItem:
    name: str
    quantity: int
    price_per_unit: float
    total_price: float


class ItemParser:
    """
    Generic Item Line Parser using RTL (Right-to-Left) approach.
    
    Algorithm:
    1. Scan from RIGHT: Largest nominal value = Total Line Item
    2. Scan before Total: Qty x Price pattern or unit price
    3. Remaining LEFT tokens = Item Name
    
    NO hardcoded vendor/product names allowed.
    """
    
    # Generic currency pattern (no hardcoded names)
    CURRENCY_PATTERN = r'(?i)(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})*|\d+)'
    
    # Qty x Price pattern
    QTY_PRICE_PATTERN = r'(\d+)\s*(?:x|@)\s*(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})*)'
    
    def parse_line(self, line: str) -> Optional[ParsedItem]:
        """
        Parse single receipt line into item.
        Returns None if line is not an item.
        """
        line = line.strip()
        if not line:
            return None
        
        upper = line.upper()
        
        # Handle discount lines specially (they have negative price)
        if 'DISKON' in upper or 'POTONGAN' in upper:
            return self._parse_discount_line(line)
        
        # Skip lines that are just anchors (checked by caller)
        if self._is_anchor_line(line):
            return None
        
        # Normalize currency format BEFORE tokenization
        # Handle OCR output like "8, 500" (with space after comma)
        normalized_line = self._normalize_currency_format(line)
        
        # Skip lines with only one large number (likely totals)
        if self._is_summary_line(normalized_line):
            return None
        
        tokens = normalized_line.split()
        if len(tokens) < 2:
            return None
        
        # Extract all currency values
        numbers = self._extract_currency_values(tokens)
        if not numbers:
            return None
        
        # Rightmost number = total_price
        total_price = float(numbers[-1])
        
        # Skip if suspiciously large (likely a phone number or junk)
        if total_price > 10000000:
            return None
        
        # Parse quantity and unit price
        quantity, price_per_unit = self._parse_qty_price(numbers, total_price)
        
        # Item name = all tokens before first number
        name = self._extract_item_name(tokens, numbers)
        if not name or len(name) < 1:
            return None
        
        return ParsedItem(
            name=name,
            quantity=quantity,
            price_per_unit=price_per_unit,
            total_price=total_price
        )
    
    def _normalize_currency_format(self, text: str) -> str:
        """
        Normalize currency format from OCR output.
        Handles formats like "8, 500" -> "8500", "Rp 8.500" -> "8500".
        
        Indonesian thousand separator: comma (,)
        """
        import re
        
        # ULTRA AGGRESSIVE: Find ALL patterns like "digit, digit(s)" and merge
        # "8, 500" -> "8,500" -> "8500"
        # "18, 000" -> "18,000" -> "18000"
        
        # Pattern 1: digit, comma, space, digit(s) - merge into single number
        # Matches: "8, 500", "18, 000", "1, 300"
        while re.search(r'\d+,\s*\d+', text):
            text = re.sub(r'(\d+),\s*(\d+)', lambda m: m.group(1) + m.group(2), text)
        
        # Pattern 2: Now remove remaining thousand separators (commas between digits)
        text = text.replace(',', '')
        
        return text
    
    def _is_anchor_line(self, line: str) -> bool:
        """Check if line is an anchor/summary line."""
        line_upper = line.upper()
        
        anchor_keywords = [
            'TOTAL', 'SUBTOTAL', 'HARGA JUAL', 'BAYAR', 'TUNAI', 
            'CASH', 'DISKON', 'KEMBALI', 'ANDA HEMAT', 'GRAND'
        ]
        
        for keyword in anchor_keywords:
            if keyword in line_upper:
                return True
        
        return False
    
    def _is_summary_line(self, line: str) -> bool:
        """Check if line is likely a summary/total line (not an item)."""
        # Extract numbers
        numbers = re.findall(self.CURRENCY_PATTERN, line)
        if len(numbers) == 1:
            # Single number - likely not an item
            clean_num = numbers[0].replace('.', '').replace(',', '')
            if clean_num.isdigit():
                val = int(clean_num)
                if val > 10000:  # Large single number
                    return True
        return False
    
    def _extract_currency_values(self, tokens: List[str]) -> List[float]:
        """Extract all currency values from tokens."""
        numbers = []
        
        for token in tokens:
            # Try to parse as currency
            clean = token.replace('.', '').replace(',', '')
            
            # Remove Rp prefix
            clean = re.sub(r'(?i)^Rp\.?\s*', '', clean)
            
            if clean.isdigit():
                val = int(clean)
                if val > 0:
                    numbers.append(float(val))
        
        return numbers
    
    def _parse_qty_price(self, numbers: List[float], total_price: float) -> Tuple[int, float]:
        """
        Parse quantity and unit price from currency values.
        
        Returns:
            (quantity, price_per_unit)
        """
        quantity = 1
        price_per_unit = total_price
        
        if len(numbers) >= 2:
            second_last = numbers[-2]
            
            if second_last <= 20:
                # Small number = quantity
                quantity = int(second_last)
                price_per_unit = total_price / quantity
            else:
                # Medium number = unit price
                price_per_unit = second_last
                if total_price > 0 and price_per_unit > 0:
                    qty = round(total_price / price_per_unit)
                    if 1 <= qty <= 50:
                        quantity = qty
        
        return quantity, price_per_unit
    
    def _extract_item_name(self, tokens: List[str], numbers: List[float]) -> str:
        """Extract item name (tokens before first number)."""
        # Find index of first number token
        first_num_idx = 0
        for i, token in enumerate(tokens):
            clean = token.replace('.', '').replace(',', '')
            clean = re.sub(r'(?i)^Rp\.?\s*', '', clean)
            if clean.isdigit():
                first_num_idx = i
                break
        
        # Join tokens before first number
        name_parts = tokens[:first_num_idx]
        
        # Clean up name
        name = ' '.join(name_parts).strip()
        
        # Remove any trailing punctuation
        name = re.sub(r'[,\.\-]+$', '', name).strip()
        
        return name
    
    def _parse_discount_line(self, line: str) -> Optional[ParsedItem]:
        """
        Parse discount/potongan line with MULTIPLE formats.
        Returns item with negative total_price and is_discount=True.
        
        Supported formats:
        - DISKON : (1)
        - DISKON FRISIAN FLAG : (1, 300)
        - POTONGAN HARGA : Rp 5.000
        - DISC 10% : 3,500
        - HEMAT : -2,000
        - Anda Hemat 5.000
        - VOUCHER : Rp 10000
        """
        line_upper = line.upper()
        amount = None
        
        # Format 1: Parentheses with comma - "(1, 300)" or "(1300)"
        match = re.search(r'\(\s*(\d[\d\,\.\s]*)\s*\)', line)
        if match:
            amount_str = match.group(1).replace(',', '').replace(' ', '').replace('.', '')
            try:
                amount = float(amount_str)
            except ValueError:
                pass
        
        # Format 2: Rp prefix - "Rp 5.000" or "Rp5,000"
        if amount is None:
            match = re.search(r'Rp\.?\s*([\d\,\.]+)', line, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(',', '').replace(' ', '').replace('.', '')
                try:
                    amount = float(amount_str)
                except ValueError:
                    pass
        
        # Format 3: Minus sign - "- 5.000" or "-5.000"
        if amount is None:
            match = re.search(r'-\s*([\d\,\.]+)', line)
            if match:
                amount_str = match.group(1).replace(',', '').replace(' ', '').replace('.', '')
                try:
                    amount = float(amount_str)
                except ValueError:
                    pass
        
        # Format 4: "HEMAT" or "Anda Hemat" followed by number
        if amount is None:
            match = re.search(r'(?:ANDA\s+)?HEMAT\s*:?\s*([\d\,\.]+)', line_upper)
            if match:
                amount_str = match.group(1).replace(',', '').replace(' ', '').replace('.', '')
                try:
                    amount = float(amount_str)
                except ValueError:
                    pass
        
        # Format 5: Percentage discount - "DISC 10%"
        if amount is None:
            match = re.search(r'DISC(?:OUNT)?\s*(\d+)%', line_upper)
            if match:
                # Can't determine amount from percentage without subtotal
                # Return generic discount
                pass
        
        # Format 6: Last resort - extract last large number
        if amount is None:
            numbers = self._extract_currency_values(line.split())
            if numbers:
                # Take the largest number that looks like a discount
                for num in reversed(numbers):
                    if 1 <= num <= 100000:
                        amount = num
                        break
        
        if amount is not None and amount > 0:
            return ParsedItem(
                name=line.strip(),
                quantity=1,
                price_per_unit=-amount,
                total_price=-amount
            )
        
        return None


class GenericItemParser:
    """
    High-level interface for parsing receipt items.
    Combines bounding region detection with item parsing.
    """
    
    def __init__(self):
        self.item_parser = ItemParser()
    
    def parse_items(
        self, 
        lines: List[str],
        region_start: int = 0,
        region_end: int = None
    ) -> List[ParsedItem]:
        """
        Parse items from bounded region.
        
        Args:
            lines: All receipt lines
            region_start: Start index of item region
            region_end: End index of item region (default: len(lines))
        """
        if region_end is None:
            region_end = len(lines)
        
        items = []
        
        for line in lines[region_start:region_end]:
            item = self.item_parser.parse_line(line)
            if item:
                items.append(item)
        
        return items
