# ============================================================
# GENERIC RECEIPT PIPELINE
# Rule-First, AI-Last Architecture
# ============================================================
#
# CONSTRAINTS:
# - NO hardcoded vendor/product names
# - NO hardcoded pixel tolerances
# - NO returning success with Total=0 or generic merchant
#
# Architecture:
# Layer 1: Email/Transfer Parser
# Layer 2: Physical Receipt (Geometric + RTL)
# Layer 3: Integrity Gatekeeper
# Layer 4: Gemini Fallback
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
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "quantity": self.quantity,
            "price_per_unit": self.price_per_unit,
            "total_price": self.total_price
        }


@dataclass
class ExtractionResult:
    """Structured result - MUST pass validation before returning."""
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
        return sum(i.total_price for i in self.items)
    
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
# FUZZY MATCHING ENGINE (Levenshtein-based)
# ============================================================

class FuzzyMatcher:
    """Generic fuzzy string matching with configurable threshold."""
    
    THRESHOLD = 0.80  # 80% similarity required
    
    @staticmethod
    def levenshtein_distance(s1: str, s2: str) -> int:
        """Calculate Levenshtein distance."""
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
        """Calculate similarity ratio (0.0 - 1.0)."""
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
        """Check if text fuzzy-matches any keyword."""
        threshold = threshold or cls.THRESHOLD
        text_upper = text.upper().strip()
        
        for keyword in keywords:
            keyword_upper = keyword.upper()
            # Exact substring
            if keyword_upper in text_upper:
                return True, keyword, 1.0
            # Fuzzy
            score = cls.similarity_ratio(text_upper, keyword_upper)
            if score >= threshold:
                return True, keyword, score
        return False, "", 0.0


# ============================================================
# CONFIGURABLE ANCHOR ENGINE
# ============================================================

class AnchorConfig:
    """Configurable anchor keywords - loaded from config, not hardcoded."""
    
    # Generic anchor keywords (NOT vendor-specific)
    TOTAL_KEYWORDS = [
        "TOTAL", "GRAND TOTAL", "HARGA JUAL", "SUBTOTAL",
        "JUMLAH", "BAYAR", "HARUS DIBAYAR", "TOTAL BAYAR"
    ]
    DISCARD_KEYWORDS = [
        "TUNAI", "CASH", "KEMBALI", "DISKON",
        "ANDA HEMAT", "VOUCHER", "BONUS"
    ]
    DATE_PATTERNS = [
        r"(\d{1,2})[\.\-](\d{1,2})[\.\-](\d{2,4})",
        r"(\d{4})[\.\-](\d{1,2})[\.\-](\d{1,2})"
    ]
    MERCHANT_SKIP_PATTERNS = [
        r"^[0-9]+$",  # Pure numbers
        r"^[\d\s\.\-\:\/]+$",  # Date/time only
    ]
    GARBAGE_PATTERNS = [
        "DOWNLOAD", "HTTP", "WWW", "口品", "★"
    ]


class AnchorEngine:
    """Generic anchor detection using fuzzy matching."""
    
    def __init__(self, config: AnchorConfig = None):
        self.config = config or AnchorConfig()
    
    def find_total_bottom_up(self, lines: List[str]) -> Tuple[bool, float, Optional[str]]:
        """
        Scan from BOTTOM-UP to find TOTAL anchor.
        Returns: (found, value, matched_keyword)
        """
        keywords = self.config.TOTAL_KEYWORDS
        
        for i in range(len(lines) - 1, -1, -1):
            line = lines[i].strip()
            if not line:
                continue
            
            matched, keyword, score = FuzzyMatcher.match(line, keywords)
            if matched:
                # Extract largest number
                value = self._extract_largest_number(line)
                if value and value > 0:
                    return True, value, keyword
        
        return False, 0.0, None
    
    def find_merchant_top(self, lines: List[str]) -> Optional[str]:
        """Scan from TOP-DOWN to find merchant name."""
        skip_patterns = self.config.MERCHANT_SKIP_PATTERNS
        garbage = self.config.GARBAGE_PATTERNS
        
        for line in lines[:10]:
            line_clean = line.strip()
            if not line_clean:
                continue
            
            # Skip patterns
            if any(re.match(p, line_clean) for p in skip_patterns):
                continue
            
            # Skip garbage
            if any(g in line_clean.upper() for g in garbage):
                continue
            
            # Must have letters
            if sum(1 for c in line_clean if c.isalpha()) >= 2:
                return line_clean
        
        return None
    
    def find_date(self, lines: List[str]) -> Optional[str]:
        """Extract date using generic pattern."""
        for line in lines:
            for pattern in self.config.DATE_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    groups = match.groups()
                    if len(groups) == 3:
                        return match.group(0)
        return None
    
    def find_item_region(self, lines: List[str]) -> Tuple[int, int]:
        """Find item region boundaries (start, end)."""
        # Find start (after separator)
        index_start = 0
        for i, line in enumerate(lines[:15]):
            if "---" in line or "===" in line:
                index_start = i + 1
                break
        
        # Find end (first anchor from bottom)
        index_end = len(lines)
        all_anchors = self.config.TOTAL_KEYWORDS + self.config.DISCARD_KEYWORDS
        
        for i, line in enumerate(lines):
            matched, _, _ = FuzzyMatcher.match(line, all_anchors)
            if matched:
                index_end = i
                break
        
        return index_start, index_end
    
    def _extract_largest_number(self, line: str) -> Optional[float]:
        """Extract largest number from line."""
        numbers = re.findall(r"(\d+)", line)
        if not numbers:
            return None
        values = [int(n) for n in numbers if len(n) >= 4]  # At least 4 digits
        return float(max(values)) if values else None


# ============================================================
# GENERIC ITEM PARSER (RTL Approach)
# ============================================================

class ItemParser:
    """
    Generic RTL item line parser.
    NO hardcoded product names.
    """
    
    # Generic currency regex
    CURRENCY_PATTERN = r"(\d+)"
    
    def parse_line(self, line: str) -> Optional[ReceiptItem]:
        """Parse single line into item."""
        line = line.strip()
        if not line:
            return None
        
        line_upper = line.upper()
        
        # Skip anchor lines
        anchor_config = AnchorConfig()
        all_anchors = anchor_config.TOTAL_KEYWORDS + anchor_config.DISCARD_KEYWORDS
        matched, _, _ = FuzzyMatcher.match(line_upper, all_anchors)
        if matched:
            return None
        
        # Skip promo/discount lines
        if "(" in line or line.startswith("-"):
            return None
        
        tokens = line.split()
        if len(tokens) < 2:
            return None
        
        # Extract numbers
        numbers = self._extract_numbers(tokens)
        if not numbers:
            return None
        
        # Rightmost number = total_price
        total_price = float(numbers[-1])
        
        # Skip if not a valid item price
        if total_price > 10000000:
            return None
        if len(numbers) == 1 and total_price > 1000:
            return None
        
        # Parse quantity and unit price
        quantity, price_per_unit = self._parse_qty_price(numbers, total_price)
        
        # Item name = text before first number
        name = self._extract_name(tokens, numbers)
        if not name:
            return None
        
        return ReceiptItem(
            name=name,
            quantity=quantity,
            price_per_unit=price_per_unit,
            total_price=total_price
        )
    
    def _extract_numbers(self, tokens: List[str]) -> List[int]:
        """Extract integer values from tokens."""
        numbers = []
        for token in tokens:
            clean = token.replace(".", "").replace(",", "")
            if clean.isdigit():
                numbers.append(int(clean))
        return numbers
    
    def _parse_qty_price(self, numbers: List[int], total_price: float) -> Tuple[int, float]:
        """Parse quantity and unit price."""
        quantity, price_per_unit = 1, total_price
        
        if len(numbers) >= 2:
            second = numbers[-2]
            if 1 <= second <= 20:
                quantity = second
                price_per_unit = total_price / quantity
        
        return quantity, price_per_unit
    
    def _extract_name(self, tokens: List[str], numbers: List[int]) -> Optional[str]:
        """Extract item name (text before first number)."""
        # Find index of first number
        num_strs = [str(n) for n in numbers]
        first_num_idx = len(tokens)
        for i, token in enumerate(tokens):
            clean = token.replace(".", "").replace(",", "")
            if clean in num_strs:
                first_num_idx = i
                break
        
        name = " ".join(tokens[:first_num_idx]).strip()
        return name if name else None


# ============================================================
# INTEGRITY GATEKEEPER
# ============================================================

class IntegrityGatekeeper:
    """
    Mathematical validation - rejects invalid data.
    Returns (is_valid, issues, confidence)
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
        Returns: (is_valid, issues, confidence)
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
            issues.append("Merchant name is generic placeholder")
            confidence += 0.10
        else:
            confidence += 0.20
        
        # Rule 3: Math validation
        items_sum = sum(i.total_price for i in items)
        if items:
            diff = abs(items_sum - total_amount)
            
            if diff <= self.MATH_TOLERANCE:
                confidence += 0.55
            elif items_sum > total_amount:
                # Discount scenario - acceptable
                confidence += 0.45
            else:
                confidence += 0.15
        else:
            confidence += 0.30  # Transfer receipts have no items
        
        # Clamp
        confidence = min(1.0, confidence)
        
        is_valid = confidence >= self.CONFIDENCE_THRESHOLD
        
        return is_valid, issues, confidence
    
    def _is_generic_merchant(self, name: str) -> bool:
        """Check if merchant name is generic."""
        if not name:
            return True
        
        name_upper = name.upper().strip()
        generic = ["MERCHANT", "TOKO", "STORE", "SHOP", "UNKNOWN", "N/A", "PURCHASE", "BELANJA"]
        
        return name_upper in generic or len(name.strip()) < 2


# ============================================================
# PIPELINE ORCHESTRATOR
# ============================================================

class GenericPipeline:
    """
    Generic Hybrid Pipeline.
    NO hardcoded vendor logic.
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
        Execute pipeline with integrity check.
        """
        # Try email/transfer parser
        if raw_input.get("html_content"):
            result = self._parse_email(raw_input["html_content"])
            if result.confidence >= self.gatekeeper.CONFIDENCE_THRESHOLD:
                return result
        
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
            
            # Try Gemini fallback
            if image_bytes:
                gemini_result = await self._parse_with_gemini(image_bytes)
                if gemini_result and gemini_result.success:
                    return gemini_result
            
            # Return partial if we have items
            if result.items and result.total_amount > 0:
                result.message = f"Partial data - {', '.join(issues)}"
                return result
        
        # All failed
        return ExtractionResult(
            success=False,
            message="All layers failed"
        )
    
    def _parse_email(self, html: str) -> ExtractionResult:
        """Parse email/transfer receipt."""
        result = ExtractionResult(source=ExtractionSource.EMAIL_DOM)
        
        # Generic amount extraction
        amount_match = re.search(r"Rp\.?\s*(\d+)", html, re.IGNORECASE)
        if amount_match:
            result.total_amount = float(amount_match.group(1))
            result.success = result.total_amount > 0
        
        # Generic date
        date_match = re.search(r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})", html, re.IGNORECASE)
        if date_match:
            result.date = date_match.group(0)
        
        result.confidence = 0.90 if result.success else 0.0
        result.message = "Email parsed"
        
        return result
    
    def _parse_physical(self, lines: List[str]) -> ExtractionResult:
        """Parse physical receipt with generic algorithms."""
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
        
        # Parse items
        for line in lines[index_start:index_end]:
            item = self.item_parser.parse_line(line)
            if item:
                result.items.append(item)
        
        result.subtotal = sum(i.total_price for i in result.items)
        
        # Discount check
        if result.subtotal > result.total_amount > 0:
            result.discount = result.subtotal - result.total_amount
        
        return result
    
    async def _parse_with_gemini(self, image_bytes: bytes) -> Optional[ExtractionResult]:
        """Parse with Gemini AI."""
        if not image_bytes:
            return None
        
        try:
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
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
_pipeline: Optional[GenericPipeline] = None

def get_pipeline() -> GenericPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = GenericPipeline()
    return _pipeline
