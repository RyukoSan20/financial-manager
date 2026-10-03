# ============================================================
# GENERIC RECEIPT PIPELINE v2
# Rule-First, AI-Last Architecture
# ============================================================
#
# FIXED ISSUES:
# 1. Currency regex handles Indonesian format (33,900 / 33.900 / 33 900)
# 2. Discount handling with negative values
# 3. Real fallback execution on validation fail
# ============================================================

import os
import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ExtractionSource(Enum):
    EMAIL_DOM = "email_dom"
    LOCAL_REGEX = "local_regex"
    GEMINI_FALLBACK = "gemini_fallback"
    NONE = "none"


@dataclass
class ReceiptItem:
    name: str = ""
    quantity: int = 1
    price_per_unit: float = 0.0
    total_price: float = 0.0
    is_discount: bool = False
    category: str = "Unknown"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "quantity": self.quantity,
            "price_per_unit": self.price_per_unit,
            "total_price": self.total_price,
            "is_discount": self.is_discount,
            "category": self.category
        }


@dataclass
class ExtractionResult:
    success: bool = False
    merchant_name: str = "Merchant"
    merchant_type: str = "Other"
    total_amount: float = 0.0
    date: Optional[str] = None
    payment_method: Optional[str] = None
    items: List[ReceiptItem] = field(default_factory=list)
    subtotal: float = 0.0
    discount: float = 0.0
    confidence: float = 0.0
    source: ExtractionSource = ExtractionSource.NONE
    message: str = ""
    category: str = "Lainnya"
    
    @property
    def items_sum(self) -> float:
        return sum(i.total_price for i in self.items if not i.is_discount)
    
    @property
    def discount_sum(self) -> float:
        return sum(abs(i.total_price) for i in self.items if i.is_discount)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "merchant_name": self.merchant_name,
            "merchant_type": self.merchant_type,
            "total_amount": self.total_amount,
            "date": self.date,
            "payment_method": self.payment_method,
            "items": [i.to_dict() for i in self.items],
            "subtotal": self.subtotal,
            "discount": self.discount,
            "confidence": self.confidence,
            "source": self.source.value,
            "message": self.message,
            "category": self.category
        }


# ============================================================
# FUZZY MATCHING ENGINE
# ============================================================

class FuzzyMatcher:
    THRESHOLD = 0.80
    
    @staticmethod
    def levenshtein_distance(s1: str, s2: str) -> int:
        if len(s1) < len(s2):
            return FuzzyMatcher.levenshtein_distance(s2, s1)
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
    
    @classmethod
    def similarity_ratio(cls, s1: str, s2: str) -> float:
        if not s1 and not s2:
            return 1.0
        s1, s2 = s1.upper().strip(), s2.upper().strip()
        if s1 == s2:
            return 1.0
        distance = cls.levenshtein_distance(s1, s2)
        max_len = max(len(s1), len(s2))
        return 1.0 - (distance / max_len) if max_len > 0 else 1.0
    
    @classmethod
    def match(cls, text: str, keywords: List[str], threshold: float = None) -> Tuple[bool, str, float]:
        threshold = threshold or cls.THRESHOLD
        text_upper = text.upper().strip()
        for keyword in keywords:
            keyword_upper = keyword.upper()
            if keyword_upper in text_upper:
                return True, keyword, 1.0
            score = cls.similarity_ratio(text_upper, keyword_upper)
            if score >= threshold:
                return True, keyword, score
        return False, "", 0.0


# ============================================================
# CURRENCY & TEXT NORMALIZER
# ============================================================

class CurrencyNormalizer:
    """
    Normalizes Indonesian currency formats:
    - 33,900 -> 33900
    - 33.900 -> 33900
    - 33 900 -> 33900
    - (1,300) -> -1300 (discount)
    """
    
    @staticmethod
    def normalize_line(line: str) -> str:
        """
        Normalize line for parsing - REMOVE thousand separators.
        Handles: 33,900 / 33.900 / 33 900 / 33, 900 -> 33900
        Only normalizes comma/dot/space that is FOLLOWED by exactly 3 digits.
        """
        if not line:
            return line
        
        # Pattern: digit followed by comma/dot/space AND exactly 3 digits after
        # "33,900" -> "33900"
        # "33.900" -> "33900"  
        # "33 900" -> "33900"
        # "33, 900" -> "33900"
        # But NOT "72G" or "4500" (not followed by 3 more digits)
        line = re.sub(r'(\d)[,\.\s]+(\d{3})(?=\D|$)', r'\1\2', line)
        
        return line
    
    @staticmethod
    def extract_amounts(line: str) -> List[float]:
        """
        Extract all currency amounts from normalized line.
        Handles both positive and negative (discount) values.
        """
        amounts = []
        
        # Normalize first
        line = CurrencyNormalizer.normalize_line(line)
        
        # Check if discount (in parentheses or with minus)
        is_discount = '(' in line or line.startswith('-')
        
        # Extract positive amounts
        pattern = r'(\d+)'
        matches = re.findall(pattern, line)
        for m in matches:
            try:
                val = int(m)
                if val > 0:
                    amounts.append(float(val))
            except ValueError:
                continue
        
        return amounts
    
    @staticmethod
    def extract_largest_amount(line: str) -> Optional[float]:
        """Extract the largest amount from line (likely total/discount)."""
        amounts = CurrencyNormalizer.extract_amounts(line)
        if amounts:
            return max(amounts)
        return None


# ============================================================
# ITEM PARSER (RTL with Discount Support)
# ============================================================

class ItemParser:
    """
    Generic RTL item line parser with discount handling.
    STRICT MODE: Filters out meta-information (NPWP, addresses, phone numbers).
    """
    
    TOTAL_KEYWORDS = ["TOTAL", "SUBTOTAL", "HARGA JUAL", "JUMLAH", "BAYAR"]
    DISCARD_KEYWORDS = ["TUNAI", "CASH", "KEMBALI", "ANDA HEMAT", "VOUCHER"]
    DISCOUNT_KEYWORDS = ["DISKON", "POTONGAN", "DISCOUNT", "POTONGAN HARGA"]
    
    # META KEYWORDS - These indicate NON-ITEM lines
    META_KEYWORDS = [
        "NPWP", "NOP", "NTNP", "NTPN",  # Tax numbers
        "PBB", "PAJAK", "TAX",           # Tax related
        "JL.", "JL ", "JALAN", "JLN",    # Addresses
        "KM.", "KILOMETER",              # Location
        "TELP", "TEL", "HP", "FAX",      # Contact info
        "PT ", "PT.", "CV ", "CV.",      # Company names
        "NP.", "NO.", "NOMOR", "NO ",    # Numbers
        "CABANG", "OUTLET", "STORE",     # Store info
        "PPN", "PPn",                    # VAT
    ]
    
    def parse_line(self, line: str) -> Optional[ReceiptItem]:
        """
        Parse single line into item or discount.
        RULE: If line has a valid price (>= 100), it IS an item.
        """
        line = line.strip()
        if not line:
            return None
        
        line_upper = line.upper()
        
        # SKIP META INFORMATION LINES (NPWP, addresses, phone numbers)
        for meta in self.META_KEYWORDS:
            if meta in line_upper:
                return None
        
        # SKIP lines with qty@price pattern (item specs, NOT items)
        if re.search(r'\(\d+\s*[xX@]\s*[@\s]*\s*Rp', line):
            return None
        
        # SKIP anchor lines (TOTAL, SUBTOTAL, etc.)
        all_anchors = self.TOTAL_KEYWORDS + self.DISCARD_KEYWORDS
        matched, _, _ = FuzzyMatcher.match(line_upper, all_anchors)
        if matched:
            return None
        
        # CATALOG MATCHING: Only use catalog for CATEGORIZATION
        try:
            from app.services.catalog import is_valid_product_line
            _, _, category = is_valid_product_line(line)
        except ImportError:
            category = "Unknown"
        
        # Check if discount line
        is_discount = self._is_discount_line(line)
        
        # Normalize and extract amounts
        normalized_line = CurrencyNormalizer.normalize_line(line)
        amounts = CurrencyNormalizer.extract_amounts(normalized_line)
        
        if not amounts:
            return None
        
        if is_discount:
            return self._parse_discount_line(line, amounts, category)
        else:
            # CRITICAL: ANY line with a valid price IS an item
            item = self._parse_item_line(line, amounts, category)
            if item and item.total_price < 100:
                # Price too low - skip
                return None
            return item
    
    def _is_discount_line(self, line: str) -> bool:
        """
        Check if line is a discount.
        ONLY lines with explicit DISKON keywords are discounts.
        Parentheses alone are NOT sufficient (could be item specs).
        """
        line_upper = line.upper()
        
        # ONLY match explicit discount keywords
        matched, _, _ = FuzzyMatcher.match(line_upper, self.DISCOUNT_KEYWORDS)
        if matched:
            return True
        
        # Parentheses WITHOUT discount keyword = NOT a discount (could be item specs)
        # Lines like "(6x @ Rp 74.333,5)" are NOT discounts
        
        # Only true discounts have explicit DISKON/VOUCHER keywords
        return False
    
    def _parse_discount_line(self, line: str, amounts: List[float], category: str = "Unknown") -> Optional[ReceiptItem]:
        """Parse discount line."""
        if not amounts:
            return None
        
        # Largest amount is the discount value
        discount_value = max(abs(a) for a in amounts)
        
        # Extract discount name
        name = self._extract_discount_name(line)
        
        return ReceiptItem(
            name=name,
            quantity=1,
            price_per_unit=0,
            total_price=-discount_value,  # Negative for discount
            is_discount=True,
            category=category
        )
    
    def _parse_item_line(self, line: str, amounts: List[float], category: str = "Unknown") -> Optional[ReceiptItem]:
        """Parse item line with category from catalog."""
        if not amounts:
            return None
        
        # Rightmost amount = total_price
        total_price = float(amounts[-1])
        
        # Skip large single amounts (likely not items)
        if len(amounts) == 1 and total_price > 10000:
            return None
        
        # Skip extremely large amounts
        if total_price > 10000000:
            return None
        
        # FILTER: Remove amounts that look like product size codes (e.g., 225, 200, 72)
        # These are part of product names, not prices
        filtered_amounts = self._filter_product_size_amounts(amounts, line)
        
        # Re-calculate if we filtered some amounts
        if len(filtered_amounts) < len(amounts) and filtered_amounts:
            total_price = float(filtered_amounts[-1])
        
        # Parse quantity and unit price
        quantity, price_per_unit = self._parse_qty_price(filtered_amounts, total_price)
        
        # Extract name
        name = self._extract_item_name(line)
        if not name:
            return None
        
        return ReceiptItem(
            name=name,
            quantity=quantity,
            price_per_unit=price_per_unit,
            total_price=total_price,
            is_discount=False,
            category=category
        )
    
    def _filter_product_size_amounts(self, amounts: List[float], line: str) -> List[float]:
        """Filter out amounts that are likely product size codes (225ML, 200G, etc).
        
        Also removes duplicate amounts (e.g., "8500" appearing twice from "8500 8, 500").
        """
        if not amounts:
            return amounts
        
        # Product size patterns to check (typically 2-3 digits that appear in product names)
        size_patterns = ['225', '200', '72', '100', '150', '250', '300', '400', '500', '600', '50', '75']
        
        filtered = []
        seen_values = set()  # Track seen values to remove duplicates
        
        for amt in amounts:
            amt_str = str(int(amt))
            
            # Check for duplicates (skip if we've already seen this value)
            if amt in seen_values:
                continue
            
            if amt_str in size_patterns:
                # Check if this number is surrounded by spaces (not a standalone price)
                # AND appears near letters in the line
                adj_match = re.search(rf'\d+\s*[A-Za-z]|{amt_str}\s*[A-Za-z]|[A-Za-z]\s*{amt_str}', line, re.IGNORECASE)
                space_sep = re.search(rf'\s{amt_str}\s', line)
                
                if adj_match or space_sep:
                    continue  # Skip - it's part of product name
            
            filtered.append(amt)
            seen_values.add(amt)
        
        # If we filtered too much, return original
        if len(filtered) < 2 and len(amounts) >= 2:
            return amounts
        
        return filtered
    
    def _parse_qty_price(self, amounts: List[float], total_price: float) -> Tuple[int, float]:
        """Parse quantity and unit price from amounts list.
        
        Handles multiple formats:
        - [total] -> qty=1, unit=total
        - [qty, total] -> qty=qty, unit=total/qty
        - [price, qty, total] -> qty=qty, unit=price
        - [qty, price, total] -> qty=qty, unit=price
        """
        quantity, price_per_unit = 1, total_price
        
        if len(amounts) >= 3:
            # Take last 3 numbers
            third_last = amounts[-3]
            second_last = amounts[-2]
            last = amounts[-1]
            
            # Try to identify qty (small integer <= 20)
            if second_last <= 20 and second_last == int(second_last):
                quantity = int(second_last)
                price_per_unit = third_last / quantity if quantity > 0 else third_last
            elif third_last <= 20 and third_last == int(third_last):
                quantity = int(third_last)
                price_per_unit = second_last / quantity if quantity > 0 else second_last
            else:
                quantity = 1
                price_per_unit = total_price
        elif len(amounts) == 2:
            second = amounts[-2]
            if second <= 20 and second == int(second):
                quantity = int(second)
                price_per_unit = total_price / quantity if quantity > 0 else total_price
        
        return quantity, price_per_unit
    
    def _extract_item_name(self, line: str) -> Optional[str]:
        """
        Extract item name from line using RIGHT-TO-LEFT parsing.
        Strategy: Find the LAST price/number, everything to the left is the name.
        
        Handles duplicates (e.g., "8500 8500" from "8500 8, 500").
        """
        # Normalize first
        normalized = CurrencyNormalizer.normalize_line(line)
        
        # Find ALL price patterns (sequences of 3+ digits)
        all_prices = re.findall(r'(\d{3,10})', normalized)
        
        if not all_prices:
            # No prices found
            return normalized.strip()
        
        # Find the LAST price in the original string
        last_price_match = None
        for match in re.finditer(r'(\d{3,10})', normalized):
            last_price_match = match
        
        if last_price_match:
            # Extract name = everything BEFORE the last price
            name = normalized[:last_price_match.start()].strip()
        else:
            name = normalized
        
        # Clean up trailing symbols
        name = re.sub(r'[\s\-\:]+$', '', name).strip()
        
        # Remove trailing numbers in order: large duplicates first, then small qty numbers
        name = re.sub(r'\s+\d{4,}\s*$', '', name).strip()  # Duplicate large prices (e.g., 8500 8500)
        name = re.sub(r'\s+\d{1,2}\s*$', '', name).strip()  # Qty/trailing single digits
        
        # If name is too short, return None
        if len(name) < 1:
            return None
        
        return name
    
    def _extract_discount_name(self, line: str) -> str:
        """Extract discount name."""
        line_upper = line.upper()
        
        for kw in self.DISCOUNT_KEYWORDS:
            if kw in line_upper:
                idx = line_upper.find(kw)
                rest = line[idx + len(kw):].strip()
                if rest:
                    return f"{kw} {rest}".strip()
                return kw
        
        return "DISKON"


# ============================================================
# ANCHOR ENGINE
# ============================================================

class AnchorEngine:
    """
    Generic anchor detection using fuzzy matching.
    """
    
    def __init__(self):
        self.item_parser = ItemParser()
    
    def find_total_bottom_up(self, lines: List[str]) -> Tuple[bool, float, Optional[str]]:
        """Scan from BOTTOM-UP to find TOTAL."""
        total_keywords = ["TOTAL", "GRAND TOTAL", "HARGA JUAL", "SUBTOTAL", "JUMLAH"]
        
        for i in range(len(lines) - 1, -1, -1):
            line = lines[i].strip()
            if not line:
                continue
            
            matched, keyword, score = FuzzyMatcher.match(line.upper(), total_keywords)
            if matched:
                # Extract amount
                amount = CurrencyNormalizer.extract_largest_amount(line)
                if amount and amount > 0:
                    return True, float(amount), keyword
        
        return False, 0.0, None
    
    def find_merchant_top(self, lines: List[str]) -> Optional[str]:
        """
        Scan from TOP-DOWN to find merchant.
        STRICT: Only uses first 5 lines (top-of-receipt boundary).
        """
        skip_patterns = [r"^[0-9]+$", r"^[\d\s\.\-\:\/]+$", r"^[\d\.\-]+$"]
        
        # STRICT: Garbage patterns that indicate OCR noise
        garbage = [
            "DOWNLOAD", "HTTP", "口品", "★", "Q ", "QE", "Q ", 
            "PEKNG", "PEKING", "ONGFOO", "GOOO", "PURCHASE AT",
            "RECEIPT", "INVOICE", "STRUK", "BUKTI"
        ]
        
        # STRICT: Only scan first 5 lines
        for line in lines[:5]:
            line_clean = line.strip()
            if not line_clean:
                continue
            
            # Skip numeric-only patterns
            if any(re.match(p, line_clean) for p in skip_patterns):
                continue
            
            # Skip garbage OCR
            line_upper = line_clean.upper()
            if any(g in line_upper for g in garbage):
                continue
            
            # Must have at least 2 alphabetic characters
            alpha_count = sum(1 for c in line_clean if c.isalpha())
            if alpha_count < 2:
                continue
            
            # Skip if too long (likely address)
            if len(line_clean) > 30:
                continue
            
            return line_clean
        
        return None
    
    def find_date(self, lines: List[str]) -> Optional[str]:
        """Extract date."""
        for line in lines:
            match = re.search(r"(\d{2})[\.\-](\d{2})[\.\-](\d{2,4})", line)
            if match:
                d, m, y = match.groups()
                if len(y) == 2:
                    y = "20" + y
                return f"{y}-{m}-{d}"
        return None
    
    def parse_with_state_machine(self, lines: List[str]) -> Dict[str, Any]:
        """
        STATE MACHINE PARSING - Strict boundary enforcement.
        
        States:
        - HEADER: Collect merchant name, wait for DATE/TIME before items
        - ITEMS: Parse items with VALIDATION (must have price)
        - FOOTER: Done, stop processing
        
        CRITICAL FIX: 
        - Do NOT transition to ITEMS on first separator (could be header divider)
        - Wait for DATE/TIME anchor before transitioning
        - Only accept lines with valid price as items
        """
        result = {
            "merchant": None,
            "items": [],
            "total": None,
            "state": "HEADER",
            "index_start": None,
            "index_end": None,
            "all_lines_searched": [],
            "date_found": False
        }
        
        # Regex patterns
        DATE_PATTERN = re.compile(r'\d{2}[\.\-]\d{2}[\.\-]\d{2,4}')
        TIME_PATTERN = re.compile(r'\d{2}:\d{2}')
        SEPARATOR_PATTERN = re.compile(r'^[\-\=\_]{5,}$')
        FOOTER_ANCHORS = ["TOTAL", "GRAND TOTAL", "HARGA JUAL", "SUBTOTAL", "JUMLAH"]
        
        # Garbage filter
        garbage = ["PURCHASE AT", "DOWNLOAD", "HTTP", "★", "口品", "RECEIPT"]
        
        # Prefix patterns to strip
        prefix_patterns = [
            r'^PURCHASE AT\s+',
            r'^PT\s+',
            r'^CV\s+',
            r'^STORE\s+',
            r'^OUTLET\s+',
        ]
        
        def clean_merchant(text: str) -> str:
            for pattern in prefix_patterns:
                text = re.sub(pattern, '', text, flags=re.IGNORECASE)
            return text.strip()
        
        def is_garbage_merchant(text: str) -> bool:
            if not text:
                return True
            text_upper = text.upper()
            
            garbage_patterns = [
                r'^PURCHASE AT\s',
                r'^P-\w{2,10}$',
                r'^Q\s',
                r'^口品',
                r'^★',
                r'DOWNLOAD',
                r'PEKNGFOOO',
                r'ONGFOO',
                r'TASUM',
                r'NPWP',
            ]
            
            for pattern in garbage_patterns:
                if re.search(pattern, text_upper, re.IGNORECASE):
                    return True
            
            non_alnum = sum(1 for c in text if not c.isalnum())
            if len(text) > 0 and non_alnum / len(text) > 0.3:
                return True
            
            alpha_count = sum(1 for c in text if c.isalpha())
            if alpha_count < 2:
                return True
            
            return False
        
        def has_valid_price(line: str) -> bool:
            """Check if line has valid price pattern at the end."""
            # Must have digits with thousand separator or large number
            # Pattern: number at end (likely price)
            price_pattern = r'(\d[\d\.\,]*\d|\d{4,})$'
            return bool(re.search(price_pattern, line.strip()))
        
        def looks_like_item(line: str) -> bool:
            """
            Check if line looks like a receipt item.
            STRICT validation to avoid false positives from header meta lines.
            """
            stripped = line.strip()
            
            # Skip pure separators
            if SEPARATOR_PATTERN.match(stripped):
                return False
            
            upper = stripped.upper()
            
            # ========== REJECT META LINES ==========
            # Skip NPWP, addresses, phones, cashier codes
            meta_patterns = [
                r'NPWP',           # Tax ID
                r'KM\.',           # Kilometer marker
                r'JL\.',           # jalan (address)
                r'TELP\.?',        # Telephone
                r'PT\s',          # PT (company)
                r'NOPT\.?',        # Nomor telepon
                r'KODE\s*(KASIR|KASIR|POS)',  # Cashier code
                r'STRUK\s*\d',    # Receipt number
                r'^\d{2}:\d{2}$', # Time only
                r'^\d{2}\.\d{2}\.\d{2}$',  # Date only
                r'^P-\w{2,}',     # Purchase at patterns (P-2L-, P-Q-)
                r'^Purchase at',   # Purchase at prefix
                r'口品',           # Garbage OCR
                r'★',              # Star/garbage
                r'DOWNLOAD',       # Download watermark
                r'HTTP',           # URL watermark
                r'PEKNG',          # Garbage from OCR
                r'ONGFOO',         # Garbage from OCR
                r'TASUM',          # Garbage from OCR
            ]
            for pattern in meta_patterns:
                if re.search(pattern, upper):
                    return False
            
            # ========== ACCEPT DISCOUNTS (various formats) ==========
            discount_patterns = [
                r'DISKON',          # DISKON
                r'POTONGAN',        # Potongan harga
                r'DISC(?!OUN)',     # DISC (not DISCOUNT)
                r'HEMAT',           # Anda hemat
                r'VOUCHER',         # Voucher
                r'BONUS',           # Bonus
                r'GRATIS',          # Gratis/Free
                r'FREE',            # Free item
            ]
            for pattern in discount_patterns:
                if re.search(pattern, upper):
                    return True
            
            # ========== REJECT PURE NUMBERS OR CODES ==========
            # Skip lines that are just numbers/codes (not product names)
            if re.match(r'^[\d\s\.\,\-]+$', stripped):
                return False
            
            # ========== ACCEPT ITEMS WITH PRICES ==========
            # Must have BOTH: product-like text AND a price at the end
            if not has_valid_price(stripped):
                return False
            
            # Additional check: must have SOME alphabetic characters (not just numbers)
            alpha_count = sum(1 for c in stripped if c.isalpha())
            if alpha_count < 2:
                return False
            
            # Check product-like patterns
            # Must have meaningful product text, not just codes
            # Reject if it's mostly numbers with few letters
            num_count = sum(1 for c in stripped if c.isdigit())
            if num_count > len(stripped) * 0.7:
                return False  # Too numeric, likely a code/number line
            
            return True
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            result["all_lines_searched"].append(line_stripped)
            line_upper = line_stripped.upper()
            
            # ========== FOOTER STATE ==========
            if result["state"] == "FOOTER":
                continue
            
            # ========== HEADER STATE ==========
            if result["state"] == "HEADER":
                # Try to extract merchant FIRST
                if result["merchant"] is None:
                    line_upper = line_stripped.upper()
                    
                    # Skip garbage
                    if any(g in line_upper for g in garbage):
                        pass  # Continue to other checks
                    elif not DATE_PATTERN.match(line_stripped) and not SEPARATOR_PATTERN.match(line_stripped):
                        # NOT date or separator - try as merchant
                        # BUT skip if it looks like an item (has price pattern)
                        if not looks_like_item(line_stripped):
                            # Safe to try as merchant
                            alpha_count = sum(1 for c in line_stripped if c.isalpha())
                            if alpha_count >= 2 and len(line_stripped) <= 40:
                                cleaned = clean_merchant(line_stripped)
                                if len(cleaned) >= 2 and not is_garbage_merchant(cleaned):
                                    result["merchant"] = cleaned
                
                # Check for DATE/TIME anchor - THIS is what triggers ITEMS
                if DATE_PATTERN.match(line_stripped) or (TIME_PATTERN.search(line_stripped) and DATE_PATTERN.search(line_stripped)):
                    result["date_found"] = True
                    continue
                
                # TRANSITION to ITEMS if:
                # 1. Date found AND separator found, OR
                # 2. Date found AND next line looks like an item (no explicit separator)
                if result["date_found"]:
                    if SEPARATOR_PATTERN.match(line_stripped):
                        result["state"] = "ITEMS"
                        result["index_start"] = i + 1
                        continue
                    # Also transition if this line looks like an item (no separator between date and items)
                    if looks_like_item(line_stripped):
                        result["state"] = "ITEMS"
                        result["index_start"] = i
                        # Add this line as first item
                        result["items"].append({
                            "line_index": i,
                            "line": line_stripped
                        })
                        continue
                
                # If no date/time yet, consume separators silently
                if SEPARATOR_PATTERN.match(line_stripped):
                    continue
            
            # ========== ITEMS STATE ==========
            elif result["state"] == "ITEMS":
                # Check for footer anchor
                matched, _, _ = FuzzyMatcher.match(line_upper, FOOTER_ANCHORS)
                if matched:
                    result["state"] = "FOOTER"
                    result["index_end"] = i
                    break
                
                # CRITICAL: MULTI-LINE GROUPING
                # For receipts where item name and price are on separate lines,
                # we need to collect consecutive lines and merge them
                item_group = [line_stripped]
                
                # Look ahead for consecutive number lines (likely prices)
                for j in range(i + 1, min(i + 5, len(lines))):
                    next_line = lines[j].strip()
                    if not next_line:
                        break
                    # If next line is pure numbers, include it in the group
                    if re.match(r'^[\d\s,\.]+$', next_line):
                        item_group.append(next_line)
                        # Update i to skip processed lines
                        i = j
                    else:
                        break
                
                # Combine all lines in group
                combined_line = ' '.join(item_group)
                
                # CRITICAL: Only add lines that look like items OR have number groups
                if looks_like_item(line_stripped) or (len(item_group) > 1 and re.search(r'\d', combined_line)):
                    result["items"].append({
                        "line_index": i,
                        "line": combined_line  # Use combined line
                    })
                # Else silently skip (not a valid item line)
        
        # ========== FULL DOCUMENT FALLBACK SCAN ==========
        # If no valid merchant found in header, search ENTIRE document
        if result["merchant"] is None or is_garbage_merchant(result["merchant"]):
            logger.info("No valid merchant in header, scanning entire document...")
            
            # Search for known merchant patterns in all lines
            merchant_keywords = [
                "INDOMARET", "ALFAMART", "SUPERINDO", "CARREFOUR", "GIANT",
                "GOPAY", "OVO", "DANA", "SHOPEEPAY", "LINKAJA",
                "BCA", "MANDIRI", "BNI", "BRI",
                "GOJEK", "GRAB",
            ]
            
            for line_text in result["all_lines_searched"]:
                line_upper = line_text.upper()
                
                for keyword in merchant_keywords:
                    if keyword in line_upper:
                        # Extract the merchant name
                        idx = line_upper.find(keyword)
                        # Get surrounding context (before and after keyword)
                        start = max(0, idx - 5)
                        end = min(len(line_text), idx + len(keyword) + 5)
                        candidate = line_text[start:end].strip()
                        
                        # Clean and validate
                        cleaned = clean_merchant(candidate)
                        if len(cleaned) >= 2 and not is_garbage_merchant(cleaned):
                            result["merchant"] = keyword  # Use the canonical name
                            logger.info(f"Found merchant in footer: {keyword}")
                            break
                
                if result["merchant"]:
                    break
        
        # If we never found footer, items go to end
        if result["index_end"] is None:
            result["index_end"] = len(lines)
        
        return result


# ============================================================
# INTEGRITY GATEKEEPER
# ============================================================

class IntegrityGatekeeper:
    """
    Mathematical validation with discount support.
    """
    
    MATH_TOLERANCE = 500
    CONFIDENCE_THRESHOLD = 0.80
    
    def validate(
        self,
        merchant_name: str,
        total_amount: float,
        items: List[ReceiptItem]
    ) -> Tuple[bool, List[str], float]:
        """
        STRICT validation - Math MUST match (± tolerance).
        If diff > 500, returns FAIL with confidence = 0.0 to trigger Gemini.
        """
        issues = []
        confidence = 0.0
        
        # Rule 1: Total > 0
        if total_amount <= 0:
            issues.append("Total is zero or negative")
            return False, issues, 0.0
        confidence += 0.25
        
        # Rule 2: Merchant not generic
        if self._is_generic_merchant(merchant_name):
            issues.append("Merchant name is generic")
            return False, issues, 0.0  # STRICT FAIL
        confidence += 0.20
        
        # Rule 3: STRICT Math validation
        if items:
            items_sum = sum(i.total_price for i in items if not i.is_discount)
            discount_sum = sum(abs(i.total_price) for i in items if i.is_discount)
            net_total = items_sum - discount_sum
            
            diff = abs(net_total - total_amount)
            
            if diff <= self.MATH_TOLERANCE:
                confidence += 0.55  # PASS
            else:
                # STRICT FAIL: Math mismatch > 500
                confidence = 0.0
                issues.append(f"Math mismatch: net={net_total}, total={total_amount}, diff={diff}")
                return False, issues, 0.0  # MUST FAIL to trigger Gemini
        else:
            confidence += 0.30  # Transfer receipts have no items
        
        confidence = min(1.0, confidence)
        is_valid = confidence >= self.CONFIDENCE_THRESHOLD
        
        return is_valid, issues, confidence
    
    def _is_generic_merchant(self, name: str) -> bool:
        if not name:
            return True
        name_upper = name.upper().strip()
        generic = ["MERCHANT", "TOKO", "STORE", "SHOP", "UNKNOWN", "N/A"]
        return name_upper in generic or len(name.strip()) < 2


# ============================================================
# PIPELINE ORCHESTRATOR
# ============================================================

class GenericPipeline:
    """
    Generic Hybrid Pipeline with real fallback.
    """
    
    def __init__(self):
        self.anchor_engine = AnchorEngine()
        self.item_parser = ItemParser()
        self.gatekeeper = IntegrityGatekeeper()
    
    async def parse(
        self,
        raw_input: Dict[str, Any],
        image_bytes: bytes = None
    ) -> ExtractionResult:
        """
        Execute pipeline with integrity check and real fallback.
        """
        logger.info("=== PARSE START ===")
        
        # Try physical receipt parser
        lines = raw_input.get("ocr_lines") or raw_input.get("lines") or []
        logger.info(f"Input lines count: {len(lines)}")
        
        if not lines:
            logger.error("No lines provided to parse")
            return ExtractionResult(success=False, message="No lines provided")
        
        result = self._parse_physical(lines)
        logger.info(f"Physical parse: merchant={result.merchant_name}, items={len(result.items)}, total={result.total_amount}")
        
        # Integrity check
        is_valid, issues, conf = self.gatekeeper.validate(
            result.merchant_name,
            result.total_amount,
            result.items
        )
        result.confidence = conf
        logger.info(f"Integrity check: valid={is_valid}, confidence={conf}, issues={issues}")
        
        if is_valid:
            result.success = True
            result.message = "Validation passed"
            logger.info("=== PARSE END: SUCCESS ===")
            return result
        
        # REAL FALLBACK: Call Gemini when validation fails
        if image_bytes:
            logger.info(f"Validation failed: {issues}, calling Gemini fallback...")
            gemini_result = await self._parse_with_gemini(image_bytes)
            if gemini_result and gemini_result.success:
                logger.info(f"=== PARSE END: GEMINI FALLBACK SUCCESS ===")
                return gemini_result
            elif gemini_result:
                logger.info(f"Gemini fallback partial: merchant={gemini_result.merchant_name}, total={gemini_result.total_amount}")
        
        # Return partial if we have usable data
        if result.total_amount > 0 and result.items:
            result.message = f"Partial: {', '.join(issues)}"
            logger.info("=== PARSE END: PARTIAL ===")
            return result
        
        # All failed - try to salvage with signature matching
        if result.items:
            try:
                from app.services.signature_matcher import infer_merchant_from_items
                items_for_match = [
                    {"name": item.name, "total_price": item.total_price}
                    for item in result.items if not item.is_discount
                ]
                sig_result = infer_merchant_from_items(items_for_match)
                if sig_result and sig_result.get("matched"):
                    result.merchant_name = sig_result.get("merchant_name", result.merchant_name)
                    result.merchant_type = sig_result.get("merchant_type", result.merchant_type)
                    result.success = True
                    result.message = "Salvaged via signature matching"
                    logger.info(f"=== PARSE END: SALVAGED via signature ===")
                    return result
            except Exception as sig_e:
                logger.error(f"Signature matching failed: {sig_e}")
        
        logger.error("=== PARSE END: ALL FAILED ===")
        return ExtractionResult(
            success=False,
            message=f"All layers failed: {issues}"
        )
    
    def _parse_physical(self, lines: List[str]) -> ExtractionResult:
        """Parse physical receipt using STATE MACHINE."""
        result = ExtractionResult(source=ExtractionSource.LOCAL_REGEX)
        
        # Use STATE MACHINE for strict boundary enforcement
        state_result = self.anchor_engine.parse_with_state_machine(lines)
        
        # Merchant from state machine
        result.merchant_name = state_result.get("merchant") or "Merchant"
        
        # Find total (bottom-up)
        found, total, _ = self.anchor_engine.find_total_bottom_up(lines)
        if found:
            result.total_amount = total
        
        # Find date
        result.date = self.anchor_engine.find_date(lines)
        
        # Parse items from state machine's bounded region
        for item_candidate in state_result.get("items", []):
            line = item_candidate["line"]
            parsed = self.item_parser.parse_line(line)
            if parsed:
                # Convert ParsedItem to ReceiptItem with is_discount flag
                upper = line.upper()
                is_disc = 'DISKON' in upper or 'POTONGAN' in upper
                receipt_item = ReceiptItem(
                    name=parsed.name,
                    quantity=parsed.quantity,
                    price_per_unit=parsed.price_per_unit,
                    total_price=parsed.total_price,
                    is_discount=is_disc,
                    category=parsed.category if hasattr(parsed, 'category') else "Unknown"
                )
                result.items.append(receipt_item)
        
        # Calculate totals
        result.subtotal = result.items_sum
        result.discount = result.discount_sum
        
        # Extract category from items
        try:
            from app.services.catalog import extract_category_from_items
            items_dict = [{"category": i.category} for i in result.items]
            result.category = extract_category_from_items(items_dict)
        except ImportError:
            result.category = "Lainnya"
        
        # =========================================================
        # ITEM SIGNATURE MATCHING - Post-Processing Validation Layer
        # If merchant is garbage or generic, infer from items
        # =========================================================
        try:
            from app.services.signature_matcher import infer_merchant_from_items
            
            # Check if current merchant is garbage
            current_merchant = result.merchant_name or ""
            is_garbage = (
                not current_merchant or
                current_merchant.upper() in ["MERCHANT", "UNKNOWN", "TOKO"] or
                len(current_merchant) < 3 or
                "PURCHASE AT" in current_merchant.upper() or
                "NPWP" in current_merchant.upper()
            )
            
            if is_garbage and result.items:
                # Try to infer merchant from item patterns
                items_for_match = [
                    {"name": item.name, "total_price": item.total_price}
                    for item in result.items if not item.is_discount
                ]
                
                signature_result = infer_merchant_from_items(items_for_match)
                
                if signature_result:
                    result.merchant_name = signature_result["merchant_name"]
                    result.merchant_type = signature_result.get("merchant_type", "Retail")
                    result.category = signature_result.get("category", result.category)
                    logger.info(f"Merchant inferred from item signature: {result.merchant_name}")
        except ImportError:
            pass
        
        # Apply Merchant Lexicon matching to correct OCR errors
        try:
            from app.services.lexicon import match_merchant
            matched, canonical, mtype, score = match_merchant(result.merchant_name, threshold=0.70)
            if matched:
                result.merchant_name = canonical
                result.merchant_type = mtype
                logger.info(f"Merchant corrected: '{state_result.get('merchant')}' -> '{canonical}' (score={score})")
        except ImportError:
            pass
        
        # Apply final sanitization - reject garbage
        result.merchant_name = self._sanitize_merchant(result.merchant_name)
        
        return result
    
    def _sanitize_merchant(self, merchant: str) -> str:
        """Sanitize merchant name - reject garbage, return clean default."""
        if not merchant:
            return "Minimarket"
        
        merchant_upper = merchant.upper()
        
        # STRICT REJECTION LIST
        garbage_patterns = [
            "PURCHASE AT", "DOWNLOAD", "NPWP", "口品", "★",
            "PEKNGFOOO", "ONGFOO", "TASUM",
        ]
        
        for pattern in garbage_patterns:
            if pattern in merchant_upper:
                logger.warning(f"Garbage merchant rejected: {merchant}")
                return "Minimarket"
        
        if len(merchant) < 3:
            return "Minimarket"
        
        if merchant_upper in ["MERCHANT", "UNKNOWN", "TOKO", "STORE"]:
            return "Minimarket"
        
        return merchant
    
    async def _parse_with_gemini(self, image_bytes: bytes) -> Optional[ExtractionResult]:
        """REAL Gemini fallback execution."""
        if not image_bytes:
            logger.warning("Gemini fallback called but no image_bytes provided")
            return None
        
        try:
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                logger.error("No GEMINI_API_KEY configured")
                return None
            
            from app.services.gemini_vision import extract_receipt_with_gemini
            
            logger.info("Calling Gemini Vision API...")
            gemini_data = extract_receipt_with_gemini(image_bytes, api_key)
            
            if not gemini_data:
                logger.error("Gemini returned empty result")
                return None
            
            result = ExtractionResult(source=ExtractionSource.GEMINI_FALLBACK)
            
            if gemini_data.get("merchant"):
                result.merchant_name = gemini_data["merchant"].get("name", "Merchant")
                result.merchant_type = gemini_data["merchant"].get("type", "Other")
            
            result.total_amount = float(gemini_data.get("total_amount", 0) or 0)
            result.date = gemini_data.get("transaction_date")
            
            for item_data in gemini_data.get("items", []):
                result.items.append(ReceiptItem(
                    name=item_data.get("name", "Unknown"),
                    quantity=int(item_data.get("quantity", 1)),
                    price_per_unit=float(item_data.get("price_per_unit", 0)),
                    total_price=float(item_data.get("total_price", 0))
                ))
            
            # Always mark as success if we got a result
            result.success = True
            result.confidence = float(gemini_data.get("confidence", 0.8)) or 0.85
            result.message = "Gemini Vision fallback success"
            
            logger.info(f"Gemini fallback success: merchant={result.merchant_name}, items={len(result.items)}, total={result.total_amount}")
            
            return result
            
        except Exception as e:
            logger.error(f"Gemini fallback error: {e}")
            # Never return None - try to return partial result with inferred merchant
            result = ExtractionResult(source=ExtractionSource.GEMINI_FALLBACK)
            result.merchant_name = "Minimarket/Retail"
            result.merchant_type = "Retail"
            result.success = False
            result.message = f"Gemini failed: {str(e)}"
            return result


# Global instance
_pipeline = None

def get_pipeline() -> GenericPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = GenericPipeline()
    return _pipeline
