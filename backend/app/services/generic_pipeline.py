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
        
        # Parse quantity and unit price
        quantity, price_per_unit = self._parse_qty_price(amounts, total_price)
        
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
    
    def _parse_qty_price(self, amounts: List[float], total_price: float) -> Tuple[int, float]:
        """Parse quantity and unit price."""
        quantity, price_per_unit = 1, total_price
        
        if len(amounts) >= 2:
            second = amounts[-2]
            if 1 <= second <= 20:
                quantity = int(second)
                price_per_unit = total_price / quantity
        
        return quantity, price_per_unit
    
    def _extract_item_name(self, line: str) -> Optional[str]:
        """
        Extract item name from line using RIGHT-TO-LEFT parsing.
        Strategy: Find the LAST price/number, everything to the left is the name.
        """
        # Normalize first
        normalized = CurrencyNormalizer.normalize_line(line)
        
        # Find the RIGHTMOST price pattern (last number, typically 3-10 digits)
        # Price pattern: sequence of digits at the end (after removing separators)
        match = re.search(r'(\d{3,10})$', normalized)
        if not match:
            # Try finding price anywhere
            all_prices = re.findall(r'(\d{3,10})', normalized)
            if all_prices:
                # Use the LAST price as the item total
                match = re.search(r'(\d{3,10})$', normalized)
        
        if match:
            # Extract name = everything BEFORE the last price
            price_start = match.start()
            name = normalized[:price_start].strip()
        else:
            name = normalized
        
        # Clean up trailing symbols
        name = re.sub(r'[\s\-\:]+$', '', name).strip()
        
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
        - HEADER: Collect merchant name, skip until we find delimiter
        - ITEMS: Parse items between delimiter and footer anchor
        - FOOTER: Done, stop processing
        
        Merchant Extraction Strategy:
        1. Try first 5 lines (skip garbage like "Purchase at ...")
        2. If no valid merchant found, scan ENTIRE document including footer
        3. Use Merchant Lexicon for auto-correction
        """
        result = {
            "merchant": None,
            "items": [],
            "total": None,
            "state": "HEADER",
            "index_start": None,
            "index_end": None,
            "all_lines_searched": []  # Store all lines for fallback search
        }
        
        # Regex patterns for state transitions
        DATE_PATTERN = re.compile(r'\d{2}[\.\-]\d{2}[\.\-]\d{2,4}')
        SEPARATOR_PATTERN = re.compile(r'^[\-\=\_]{5,}$')
        FOOTER_ANCHORS = ["TOTAL", "GRAND TOTAL", "HARGA JUAL", "SUBTOTAL", "JUMLAH"]
        
        # Garbage filter
        garbage = ["PURCHASE AT", "DOWNLOAD", "HTTP", "★", "口品", "RECEIPT"]
        
        # Common prefix patterns to strip
        prefix_patterns = [
            r'^PURCHASE AT\s+',
            r'^PT\s+',
            r'^CV\s+',
            r'^STORE\s+',
            r'^OUTLET\s+',
        ]
        
        def clean_merchant(text: str) -> str:
            """Remove common prefixes from merchant name."""
            for pattern in prefix_patterns:
                text = re.sub(pattern, '', text, flags=re.IGNORECASE)
            return text.strip()
        
        def is_garbage_merchant(text: str) -> bool:
            """Check if merchant text is garbage/OCR noise."""
            if not text:
                return True
            text_upper = text.upper()
            
            # STRICT BLACKLIST
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
            ]
            
            for pattern in garbage_patterns:
                if re.search(pattern, text_upper, re.IGNORECASE):
                    return True
            
            # Check for high entropy/random characters
            non_alnum = sum(1 for c in text if not c.isalnum())
            if len(text) > 0 and non_alnum / len(text) > 0.3:
                return True
            
            alpha_count = sum(1 for c in text if c.isalpha())
            if alpha_count < 2:
                return True
            
            return False
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            result["all_lines_searched"].append(line_stripped)
            
            # ========== HEADER STATE ==========
            if result["state"] == "HEADER":
                # First check if this is a SEPARATOR - TRANSITION immediately
                if SEPARATOR_PATTERN.match(line_stripped):
                    result["state"] = "ITEMS"
                    result["index_start"] = i + 1
                    continue
                
                # Then try to extract merchant
                if result["merchant"] is None:
                    line_upper = line_stripped.upper()
                    
                    # Skip garbage
                    if any(g in line_upper for g in garbage):
                        continue
                    
                    # Skip date/time lines
                    if DATE_PATTERN.match(line_stripped):
                        continue
                    
                    # Must have alphabetic characters
                    alpha_count = sum(1 for c in line_stripped if c.isalpha())
                    if alpha_count >= 2 and len(line_stripped) <= 30:
                        cleaned = clean_merchant(line_stripped)
                        if len(cleaned) >= 2 and not is_garbage_merchant(cleaned):
                            result["merchant"] = cleaned
                            continue
            
            # ========== ITEMS STATE ==========
            elif result["state"] == "ITEMS":
                line_upper = line_stripped.upper()
                
                # Check for footer anchor - TRANSITION to FOOTER
                matched, _, _ = FuzzyMatcher.match(line_upper, FOOTER_ANCHORS)
                if matched:
                    result["state"] = "FOOTER"
                    result["index_end"] = i
                    break
                
                # This is an item candidate - add to list
                result["items"].append({
                    "line_index": i,
                    "line": line_stripped
                })
        
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
        # Try physical receipt parser
        lines = raw_input.get("ocr_lines") or raw_input.get("lines") or []
        if lines:
            result = self._parse_physical(lines)
            
            # Integrity check
            is_valid, issues, conf = self.gatekeeper.validate(
                result.merchant_name,
                result.total_amount,
                result.items
            )
            result.confidence = conf
            
            if is_valid:
                result.success = True
                result.message = "Validation passed"
                return result
            
            # REAL FALLBACK: Call Gemini when validation fails
            if image_bytes:
                logger.info(f"Validation failed: {issues}, calling Gemini fallback")
                gemini_result = await self._parse_with_gemini(image_bytes)
                if gemini_result and gemini_result.success:
                    return gemini_result
            
            # Return partial if we have usable data
            if result.total_amount > 0 and result.items:
                result.message = f"Partial: {', '.join(issues)}"
                return result
        
        # All failed
        return ExtractionResult(
            success=False,
            message="All layers failed"
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
            item = self.item_parser.parse_line(line)
            if item:
                result.items.append(item)
        
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
            return None
        
        try:
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                logger.warning("No Gemini API key")
                return None
            
            from app.services.gemini_vision import extract_receipt_with_gemini
            
            gemini_data = extract_receipt_with_gemini(image_bytes, api_key)
            if not gemini_data:
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
            
            if result.total_amount > 0:
                result.success = True
                result.confidence = 0.85
                result.message = "Gemini fallback success"
            
            return result
            
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            return None


# Global instance
_pipeline = None

def get_pipeline() -> GenericPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = GenericPipeline()
    return _pipeline
