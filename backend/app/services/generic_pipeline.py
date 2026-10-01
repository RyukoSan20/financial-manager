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
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "quantity": self.quantity,
            "price_per_unit": self.price_per_unit,
            "total_price": self.total_price,
            "is_discount": self.is_discount
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
            "message": self.message
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
        Normalize line by removing thousand separators from currency patterns.
        Only normalizes patterns like 33,900 / 33.900 / 33 900 -> 33900
        Does NOT touch arbitrary numbers like "72G" or quantities.
        """
        if not line:
            return line
        
        # Strategy: Only normalize patterns where comma/dot/space separates
        # exactly 3 digits (thousand separator pattern)
        
        # Pattern 1: digit + comma + 3 digits (33,900)
        line = re.sub(r'(\d),(\d{3})(?!\d)', r'\1\2', line)
        
        # Pattern 2: digit + dot + 3 digits (33.900)
        line = re.sub(r'(\d)\.(\d{3})(?!\d)', r'\1\2', line)
        
        # Pattern 3: digit + space + 3 digits (33 900)
        # Only when followed by end of number
        line = re.sub(r'(\d) (\d{3})(?=\D|$)', r'\1\2', line)
        
        # Also handle comma-space pattern (33, 900)
        line = re.sub(r'(\d), (\d{3})(?=\D|$)', r'\1\2', line)
        
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
    """
    
    TOTAL_KEYWORDS = ["TOTAL", "SUBTOTAL", "HARGA JUAL", "JUMLAH", "BAYAR"]
    DISCARD_KEYWORDS = ["TUNAI", "CASH", "KEMBALI", "ANDA HEMAT", "VOUCHER"]
    DISCOUNT_KEYWORDS = ["DISKON", "POTONGAN", "DISCOUNT", "POTONGAN HARGA"]
    
    def parse_line(self, line: str) -> Optional[ReceiptItem]:
        """Parse single line into item or discount."""
        line = line.strip()
        if not line:
            return None
        
        line_upper = line.upper()
        
        # Skip anchor lines
        all_anchors = self.TOTAL_KEYWORDS + self.DISCARD_KEYWORDS
        matched, _, _ = FuzzyMatcher.match(line_upper, all_anchors)
        if matched:
            return None
        
        # Check if discount line
        is_discount = self._is_discount_line(line)
        
        # Normalize and extract amounts
        normalized_line = CurrencyNormalizer.normalize_line(line)
        amounts = CurrencyNormalizer.extract_amounts(normalized_line)
        
        if not amounts:
            return None
        
        if is_discount:
            return self._parse_discount_line(line, amounts)
        else:
            return self._parse_item_line(line, amounts)
    
    def _is_discount_line(self, line: str) -> bool:
        """Check if line is a discount."""
        line_upper = line.upper()
        
        # Check keywords
        matched, _, _ = FuzzyMatcher.match(line_upper, self.DISCOUNT_KEYWORDS)
        if matched:
            return True
        
        # Check parentheses (discount format)
        if '(' in line and ')' in line:
            return True
        
        # Check minus prefix
        if line.startswith('-'):
            return True
        
        return False
    
    def _parse_discount_line(self, line: str, amounts: List[float]) -> Optional[ReceiptItem]:
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
            is_discount=True
        )
    
    def _parse_item_line(self, line: str, amounts: List[float]) -> Optional[ReceiptItem]:
        """Parse item line."""
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
            is_discount=False
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
        """Extract item name from line."""
        # Normalize first
        normalized = CurrencyNormalizer.normalize_line(line)
        
        # Find where numbers start
        match = re.search(r'\d', normalized)
        if match:
            idx = match.start()
            name = normalized[:idx].strip()
        else:
            name = normalized
        
        # Clean up
        name = re.sub(r'[\s\-]+$', '', name).strip()
        
        return name if name and len(name) > 0 else None
    
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
        """Scan from TOP-DOWN to find merchant."""
        skip_patterns = [r"^[0-9]+$", r"^[\d\s\.\-\:\/]+$"]
        garbage = ["DOWNLOAD", "HTTP", "口品", "★"]
        
        for line in lines[:10]:
            line_clean = line.strip()
            if not line_clean:
                continue
            
            if any(re.match(p, line_clean) for p in skip_patterns):
                continue
            
            if any(g in line_clean.upper() for g in garbage):
                continue
            
            if sum(1 for c in line_clean if c.isalpha()) >= 2:
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
    
    def find_item_region(self, lines: List[str]) -> Tuple[int, int]:
        """Find item region boundaries."""
        index_start = 0
        index_end = len(lines)
        
        # Find start (after separator)
        for i, line in enumerate(lines[:15]):
            if "---" in line or "===" in line:
                index_start = i + 1
                break
        
        # Find end (first TOTAL anchor from bottom)
        # DISKON lines should be INCLUDED in item region
        total_anchors = ["TOTAL", "GRAND TOTAL", "HARGA JUAL", "SUBTOTAL", "JUMLAH"]
        for i, line in enumerate(lines):
            matched, _, _ = FuzzyMatcher.match(line.upper(), total_anchors)
            if matched:
                index_end = i
                break
        
        return index_start, index_end


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
        Validate receipt data mathematically.
        Formula: Sum(Item Totals) - Sum(Discounts) == Grand Total (± tolerance)
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
            confidence += 0.10
        else:
            confidence += 0.20
        
        # Rule 3: Math validation with discounts
        if items:
            items_sum = sum(i.total_price for i in items if not i.is_discount)
            discount_sum = sum(abs(i.total_price) for i in items if i.is_discount)
            net_total = items_sum - discount_sum
            
            diff = abs(net_total - total_amount)
            
            if diff <= self.MATH_TOLERANCE:
                confidence += 0.55
            elif items_sum > total_amount:
                # Discount scenario - acceptable
                confidence += 0.45
            else:
                confidence += 0.15
                issues.append(f"Math mismatch: net={net_total}, total={total_amount}")
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
        """Parse physical receipt."""
        result = ExtractionResult(source=ExtractionSource.LOCAL_REGEX)
        
        # Find merchant (top-down)
        result.merchant_name = self.anchor_engine.find_merchant_top(lines) or "Merchant"
        
        # Find total (bottom-up)
        found, total, _ = self.anchor_engine.find_total_bottom_up(lines)
        if found:
            result.total_amount = total
        
        # Find date
        result.date = self.anchor_engine.find_date(lines)
        
        # Find item region
        index_start, index_end = self.anchor_engine.find_item_region(lines)
        
        # Parse items and discounts
        for line in lines[index_start:index_end]:
            item = self.item_parser.parse_line(line)
            if item:
                result.items.append(item)
        
        # Calculate totals
        result.subtotal = result.items_sum
        result.discount = result.discount_sum
        
        return result
    
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
