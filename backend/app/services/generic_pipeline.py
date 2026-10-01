# ============================================================
# GENERIC HYBRID PIPELINE
# Rule-First, AI-Last
# ============================================================
# 
# Architecture:
# Layer 1: DOM/Transfer Parser (HTML email receipts)
# Layer 2: OCR Regex Parser (Physical receipts)
# Layer 3: Integrity Gatekeeper (Math validation)
# Layer 4: Gemini Fallback (If Layer 1+2 fail)
#
# NO hardcoded vendor/product names
# ============================================================

import os
import re
import logging
from typing import Dict, Any, List, Optional
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


class EmailTransferParser:
    """
    Layer 1: Parse email/transfer receipts using generic patterns.
    NO hardcoded vendor names.
    """
    
    def parse(self, html_content: str) -> ExtractionResult:
        """Parse email using generic key-value extraction."""
        result = ExtractionResult(source=ExtractionSource.EMAIL_DOM)
        
        if not html_content:
            result.message = "No HTML content"
            return result
        
        html_lower = html_content.lower()
        
        # Extract amount - generic pattern
        amount = self._extract_amount(html_content)
        if amount and amount > 0:
            result.total_amount = amount
            result.success = True
        
        # Extract merchant - generic
        merchant = self._extract_merchant(html_content)
        if merchant:
            result.merchant_name = merchant
        
        # Extract date - generic
        date = self._extract_date(html_content)
        if date:
            result.date = date
        
        # Calculate confidence
        if result.total_amount > 0:
            result.confidence = 0.90
            result.message = "Email parsed"
        else:
            result.confidence = 0.0
            result.message = "No amount found"
        
        return result
    
    def _extract_amount(self, text: str) -> Optional[float]:
        """Extract amount using generic pattern."""
        # Pattern: Rp followed by number
        pattern = r'Rp\.?\s*([\d]+(?:[.,][\d]{3})*)'
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            num_str = match.group(1).replace('.', '').replace(',', '')
            try:
                return float(num_str)
            except ValueError:
                pass
        return None
    
    def _extract_merchant(self, text: str) -> Optional[str]:
        """Extract merchant using generic pattern."""
        # Pattern: "ke" or "tujuan" followed by merchant name
        patterns = [
            r'(?:dibayarkan ke|tujuan|merchant|toko)[:\s]*([A-Za-z][A-Za-z0-9\s\-]+?)(?:\s*[-:]|</)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                if len(name) > 2:
                    return name
        
        return None
    
    def _extract_date(self, text: str) -> Optional[str]:
        """Extract date using generic pattern."""
        patterns = [
            r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})',
            r'(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)
        
        return None


class OCRParser:
    """
    Layer 2: Parse physical receipts using generic RTL parsing.
    NO hardcoded product names.
    """
    
    # Generic currency pattern (matches with or without separators)
    CURRENCY_PATTERN = r'[\d]+(?:[.,][\d]{3})*'
    
    # Anchor keywords - configurable
    TOTAL_ANCHORS = ['TOTAL', 'SUBTOTAL', 'HARGA JUAL', 'JUMLAH', 'BAYAR']
    DISCARD_ANCHORS = ['TUNAI', 'CASH', 'KEMBALI', 'DISKON', 'ANDA HEMAT']
    
    def parse(self, lines: List[str]) -> ExtractionResult:
        """Parse receipt using generic patterns."""
        result = ExtractionResult(source=ExtractionSource.LOCAL_REGEX)
        result.raw_lines = lines
        
        if not lines:
            result.message = "No lines provided"
            return result
        
        # Find item region boundaries
        index_start, index_end = self._find_item_region(lines)
        
        # Extract merchant (top)
        merchant = self._extract_merchant(lines)
        if merchant:
            result.merchant_name = merchant
        
        # Extract total (bottom-up)
        total = self._extract_total_bottom_up(lines)
        if total:
            result.total_amount = total
        
        # Extract date
        date = self._extract_date(lines)
        if date:
            result.date = date
        
        # Parse items
        items = self._parse_items(lines, index_start, index_end)
        result.items = items
        result.subtotal = sum(i.total_price for i in items)
        
        # Calculate discount
        if result.subtotal > result.total_amount > 0:
            result.discount = result.subtotal - result.total_amount
        
        # Validation
        result = self._validate(result)
        
        return result
    
    def _find_item_region(self, lines: List[str]) -> tuple:
        """Find item region boundaries."""
        index_start = 0
        index_end = len(lines)
        
        # Find start (after separator)
        for i, line in enumerate(lines[:15]):
            if '---' in line or '===' in line:
                index_start = i + 1
                break
        
        # Find end (first anchor from bottom)
        all_anchors = self.TOTAL_ANCHORS + self.DISCARD_ANCHORS
        for i, line in enumerate(lines):
            line_upper = line.upper()
            if any(a in line_upper for a in all_anchors):
                index_end = i
                break
        
        return index_start, index_end
    
    def _extract_merchant(self, lines: List[str]) -> Optional[str]:
        """Extract merchant from top of receipt."""
        skip_patterns = [r'^[0-9]+$', r'^[\d\s\.\-\:\/]+$']
        garbage = ['DOWNLOAD', 'HTTP', '口品', '★']
        
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
    
    def _extract_total_bottom_up(self, lines: List[str]) -> Optional[float]:
        """Extract total by scanning from bottom-up."""
        for i in range(len(lines) - 1, -1, -1):
            line = lines[i].upper()
            
            # Check for total anchor
            if any(a in line for a in self.TOTAL_ANCHORS):
                # Extract number - handle both , and . as separators
                numbers = re.findall(r'(\d+)', lines[i])
                for num_str in reversed(numbers):
                    try:
                        val = float(num_str)
                        if val > 1000:
                            return val
                    except ValueError:
                        continue
        
        return None
    
    def _extract_date(self, lines: List[str]) -> Optional[str]:
        """Extract date from receipt."""
        pattern = r'(\d{2})[\.\-](\d{2})[\.\-](\d{2,4})'
        
        for line in lines:
            match = re.search(pattern, line)
            if match:
                day, month, year = match.groups()
                if len(year) == 2:
                    year = '20' + year
                return f"{year}-{month}-{day}"
        
        return None
    
    def _parse_items(
        self, 
        lines: List[str], 
        index_start: int, 
        index_end: int
    ) -> List[ReceiptItem]:
        """Parse items from bounded region."""
        items = []
        
        for line in lines[index_start:index_end]:
            item = self._parse_item_line(line)
            if item:
                items.append(item)
        
        return items
    
    def _parse_item_line(self, line: str) -> Optional[ReceiptItem]:
        """Parse single line into item."""
        line = line.strip()
        if not line:
            return None
        
        line_upper = line.upper()
        
        # Skip anchors
        all_anchors = self.TOTAL_ANCHORS + self.DISCARD_ANCHORS
        if any(a in line_upper for a in all_anchors):
            return None
        
        # Skip lines with parentheses or discounts
        if '(' in line or line.startswith('-'):
            return None
        
        tokens = line.split()
        if len(tokens) < 2:
            return None
        
        # Extract numbers
        numbers = []
        for token in tokens:
            clean = token.replace('.', '').replace(',', '')
            if clean.isdigit():
                numbers.append(int(clean))
        
        if not numbers:
            return None
        
        # Rightmost = total_price
        total_price = float(numbers[-1])
        
        # Skip large numbers (likely not items)
        if total_price > 10000000 or (len(numbers) == 1 and total_price > 1000):
            return None
        
        # Quantity and unit price
        quantity = 1
        price_per_unit = total_price
        
        if len(numbers) >= 2 and numbers[-2] <= 20:
            quantity = numbers[-2]
            price_per_unit = total_price / quantity
        
        # Name = text before first number
        first_num_idx = 0
        for i, token in enumerate(tokens):
            clean = token.replace('.', '').replace(',', '')
            if clean.isdigit():
                first_num_idx = i
                break
        
        name = ' '.join(tokens[:first_num_idx]).strip()
        if not name:
            return None
        
        return ReceiptItem(
            name=name,
            quantity=quantity,
            price_per_unit=price_per_unit,
            total_price=total_price
        )
    
    def _validate(self, result: ExtractionResult) -> ExtractionResult:
        """Validate and calculate confidence."""
        # Must have total
        if result.total_amount <= 0:
            result.success = False
            result.confidence = 0.0
            result.message = "No total amount"
            return result
        
        # Must have items
        if not result.items:
            result.confidence = 0.50
            result.message = "No items parsed"
            return result
        
        # Math check
        diff = abs(result.items_sum - result.total_amount)
        
        if diff <= 500:
            result.confidence = 0.95
            result.success = True
            result.message = "Perfect match"
        elif result.subtotal > result.total_amount:
            result.confidence = 0.85
            result.success = True
            result.message = f"Discount scenario (discount={result.discount})"
        else:
            result.confidence = 0.60
            result.success = False
            result.message = f"Math mismatch (diff={diff})"
        
        return result


class HybridPipeline:
    """
    Main pipeline orchestrator.
    Layer 1 → Layer 2 → [Integrity Check] → Layer 4 (Gemini)
    """
    
    def __init__(self):
        self.email_parser = EmailTransferParser()
        self.ocr_parser = OCRParser()
    
    async def parse(
        self,
        raw_input: Dict[str, Any],
        image_bytes: bytes = None
    ) -> ExtractionResult:
        """
        Execute hybrid pipeline.
        """
        # Layer 1: Email/Transfer
        if raw_input.get('html_content'):
            result = self.email_parser.parse(raw_input['html_content'])
            if result.confidence >= 0.80:
                logger.info(f"Layer 1 success: {result.message}")
                return result
        
        # Layer 2: Physical Receipt
        lines = raw_input.get('ocr_lines') or raw_input.get('lines') or []
        if lines:
            result = self.ocr_parser.parse(lines)
            
            # Check if we need Gemini
            if result.confidence >= 0.80 and result.success:
                logger.info(f"Layer 2 success: {result.message}")
                return result
            
            # Try Gemini fallback
            if image_bytes:
                logger.info(f"Layer 2 partial (conf={result.confidence}), trying Gemini")
                gemini_result = await self._parse_with_gemini(image_bytes)
                if gemini_result and gemini_result.confidence >= 0.80:
                    return gemini_result
            
            # Return Layer 2 result if we have items
            if result.items:
                return result
        
        # All failed
        result = ExtractionResult()
        result.message = "All layers failed"
        return result
    
    async def _parse_with_gemini(self, image_bytes: bytes) -> Optional[ExtractionResult]:
        """Parse with Gemini AI."""
        try:
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                return None
            
            from app.services.gemini_vision import extract_receipt_with_gemini
            
            gemini_data = extract_receipt_with_gemini(image_bytes, api_key)
            if not gemini_data:
                return None
            
            result = ExtractionResult(source=ExtractionSource.GEMINI_FALLBACK)
            
            if gemini_data.get('merchant'):
                result.merchant_name = gemini_data['merchant'].get('name', 'Merchant')
                result.merchant_type = gemini_data['merchant'].get('type', 'Other')
            
            result.total_amount = float(gemini_data.get('total_amount', 0) or 0)
            result.date = gemini_data.get('transaction_date')
            
            if gemini_data.get('items'):
                for item_data in gemini_data['items']:
                    result.items.append(ReceiptItem(
                        name=item_data.get('name', 'Unknown'),
                        quantity=int(item_data.get('quantity', 1)),
                        price_per_unit=float(item_data.get('price_per_unit', 0)),
                        total_price=float(item_data.get('total_price', 0))
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
_pipeline: Optional[HybridPipeline] = None

def get_pipeline() -> HybridPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = HybridPipeline()
    return _pipeline
