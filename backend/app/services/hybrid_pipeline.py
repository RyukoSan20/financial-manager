# ============================================================
# HYBRID RECEIPT PIPELINE
# Rule-First, AI-Last Architecture
# ============================================================
# 
# Layer 1: Email/Transfer Receipt (DOM Parser)
# Layer 2: Physical Receipt (Spatial Anchor + RTL Parser)
# Layer 3: Gemini Fallback (Queue)
#
# Each layer returns structured data with confidence score.
# Only proceed to next layer if confidence < 0.80
# ============================================================

import re
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ExtractionSource(Enum):
    EMAIL_DOM = "email_dom"
    QR_CODE = "qr_code"
    LOCAL_REGEX = "local_regex"
    GEMINI_FALLBACK = "gemini_fallback"
    NONE = "none"


@dataclass
class ReceiptItem:
    name: str = ""
    quantity: int = 1
    price_per_unit: float = 0.0
    total_price: float = 0.0
    category: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "quantity": self.quantity,
            "price_per_unit": self.price_per_unit,
            "total_price": self.total_price,
            "category": self.category
        }


@dataclass
class ExtractionResult:
    """Structured extraction result."""
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
    raw_lines: List[str] = field(default_factory=list)
    
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
            "raw_lines": self.raw_lines
        }
    
    @property
    def items_sum(self) -> float:
        return sum(i.total_price for i in self.items)


# ============================================================
# LAYER 1: EMAIL / TRANSFER RECEIPT PARSER
# ============================================================

class EmailTransferParser:
    """
    Parse email/transfer receipts using key-value extraction.
    Labels: "Dibayarkan ke", "Nominal", "Tanggal"
    """
    
    # Label keywords for key-value extraction
    LABEL_MERCHANT = [
        'dibayarkan ke', 'tujuan transfer', 'rekening tujuan',
        'merchant', 'toko', 'tujuan'
    ]
    LABEL_AMOUNT = [
        'nominal', 'jumlah', 'total', 'amount', 'sebesar',
        'transfer', 'pembayaran', 'total pembayaran'
    ]
    LABEL_DATE = [
        'tanggal', 'tgl', 'date', 'waktu', 'datetime',
        'tanggal transaksi', 'waktu transaksi'
    ]
    
    def parse_html(self, html_content: str) -> ExtractionResult:
        """Parse email HTML for transfer/e-wallet receipts."""
        result = ExtractionResult(source=ExtractionSource.EMAIL_DOM)
        
        html_lower = html_content.lower()
        
        # Extract amount
        amount = self._extract_amount(html_content)
        if amount and amount > 0:
            result.total_amount = amount
            result.success = True
        
        # Extract merchant
        merchant = self._extract_merchant(html_content)
        if merchant:
            result.merchant_name = merchant
        
        # Extract date
        date = self._extract_date(html_content)
        if date:
            result.date = date
        
        # Calculate confidence
        if result.total_amount > 0:
            result.confidence = 0.95
            result.message = f"Email parsed: {result.merchant_name}"
        else:
            result.confidence = 0.0
            result.message = "No amount found in email"
        
        return result
    
    def _extract_amount(self, text: str) -> Optional[float]:
        """Extract amount from text using label-value patterns."""
        text_upper = text.upper()
        
        for label in self.LABEL_AMOUNT:
            # Pattern: Label followed by amount
            pattern = rf'{label}[^\d]*Rp\.?\s*([\d,\.]+)'
            match = re.search(pattern, text_upper, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(',', '').replace('.', '')
                try:
                    return float(amount_str)
                except ValueError:
                    continue
        
        # Fallback: Extract any large number with Rp
        pattern = r'Rp\.?\s*([\d]+)'
        matches = re.findall(pattern, text_upper)
        if matches:
            amounts = [int(m.replace('.', '')) for m in matches if int(m.replace('.', '')) > 1000]
            if amounts:
                return float(max(amounts))
        
        return None
    
    def _extract_merchant(self, text: str) -> Optional[str]:
        """Extract merchant name."""
        for label in self.LABEL_MERCHANT:
            pattern = rf'{label}[^\w]*([A-Za-z][A-Za-z0-9\s\-]+?)(?:\s*[-:]|</|"|\n)'
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                if len(name) > 2 and len(name) < 50:
                    return name
        return None
    
    def _extract_date(self, text: str) -> Optional[str]:
        """Extract date from text."""
        patterns = [
            r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})',
            r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})',
            r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)
        
        return None


# ============================================================
# LAYER 2: PHYSICAL RECEIPT PARSER
# ============================================================

class PhysicalReceiptParser:
    """
    Parse physical receipts using:
    - Bottom-up anchoring for TOTAL
    - Y-bounding box grouping for items
    - Math validation
    """
    
    # Bottom-up anchor keywords
    TOTAL_ANCHORS = [
        'total', 'grand total', 'harus dibayar', 'harga jual',
        'subtotal', 'jumlah', 'bayar'
    ]
    
    # Discard anchors (stop processing)
    DISCARD_ANCHORS = [
        'tunai', 'cash', 'kembali', 'kembalian', 'anda hemat',
        'diskon', 'voucher', 'bonus'
    ]
    
    def parse(self, lines: List[str]) -> ExtractionResult:
        """Parse physical receipt with bottom-up anchoring."""
        result = ExtractionResult(source=ExtractionSource.LOCAL_REGEX)
        result.raw_lines = lines
        
        if not lines:
            result.message = "No lines provided"
            return result
        
        # Extract total using bottom-up search
        total = self._extract_total_bottom_up(lines)
        if total:
            result.total_amount = total
        
        # Extract merchant (top of receipt)
        merchant = self._extract_merchant_top(lines)
        if merchant:
            result.merchant_name = merchant
        
        # Extract date
        date = self._extract_date(lines)
        if date:
            result.date = date
        
        # Parse items
        items = self._parse_items(lines, result.total_amount)
        result.items = items
        result.subtotal = sum(i.total_price for i in items)
        
        # Calculate discount if subtotal > total
        if result.subtotal > result.total_amount > 0:
            result.discount = result.subtotal - result.total_amount
        
        # Validate with math check
        result = self._validate_and_score(result)
        
        return result
    
    def _extract_total_bottom_up(self, lines: List[str]) -> Optional[float]:
        """Extract total by searching from bottom-up."""
        # Reverse search for TOTAL anchor
        for i in range(len(lines) - 1, -1, -1):
            line = lines[i].upper()
            
            # Check if line contains discard anchor
            if any(anchor in line.lower() for anchor in self.DISCARD_ANCHORS):
                continue
            
            # Check if line contains total anchor
            if any(anchor in line.lower() for anchor in self.TOTAL_ANCHORS):
                # Extract number
                numbers = re.findall(r'([\d]+)', lines[i])
                for num_str in reversed(numbers):
                    try:
                        amount = float(num_str)
                        if amount > 1000:  # Likely total
                            return amount
                    except ValueError:
                        continue
        
        # Fallback: find largest number in bottom portion
        for i in range(len(lines) - 1, max(0, len(lines) - 10), -1):
            numbers = re.findall(r'([\d]+)', lines[i])
            for num_str in reversed(numbers):
                try:
                    amount = float(num_str)
                    if amount > 10000:
                        return amount
                except ValueError:
                    continue
        
        return None
    
    def _extract_merchant_top(self, lines: List[str]) -> Optional[str]:
        """Extract merchant name from top of receipt."""
        for line in lines[:10]:
            line_clean = line.strip()
            if not line_clean:
                continue
            
            # Skip date/time lines
            if re.match(r'^[\d\.\-\:\s]+$', line_clean) and len(line_clean) < 25:
                continue
            
            # Skip separator lines
            if '---' in line_clean or '===' in line_clean:
                continue
            
            # Skip garbage
            garbage = ['download', '口品', '★', 'http', 'www']
            if any(g in line_clean.lower() for g in garbage):
                continue
            
            # Must have letters
            if sum(1 for c in line_clean if c.isalpha()) >= 2:
                return line_clean
        
        return None
    
    def _extract_date(self, lines: List[str]) -> Optional[str]:
        """Extract date from receipt."""
        for line in lines:
            match = re.search(r'(\d{2})[\.\-](\d{2})[\.\-](\d{2,4})', line)
            if match:
                day, month, year = match.groups()
                if len(year) == 2:
                    year = '20' + year
                return f"{year}-{month}-{day}"
        return None
    
    def _parse_items(self, lines: List[str], total: float) -> List[ReceiptItem]:
        """Parse items from receipt lines."""
        items = []
        
        # Find item region boundaries
        index_start = 0
        index_end = len(lines)
        
        for i, line in enumerate(lines[:15]):
            if '---' in line or '===' in line:
                index_start = i + 1
                break
        
        for i, line in enumerate(lines):
            line_upper = line.upper()
            if any(anchor in line_upper for anchor in self.DISCARD_ANCHORS + self.TOTAL_ANCHORS):
                index_end = i
                break
        
        # Parse only items in bounded region
        for line in lines[index_start:index_end]:
            line = line.strip()
            if not line:
                continue
            item = self._parse_item_line(line)
            if item:
                items.append(item)
        
        return items
    
    def _parse_item_line(self, line: str) -> Optional[ReceiptItem]:
        """Parse single item line using RTL approach."""
        line = line.strip()
        if not line:
            return None
        
        # Skip lines that are mostly just the TOTAL/DISCARD anchor
        line_upper = line.upper()
        discard_keywords = self.DISCARD_ANCHORS + self.TOTAL_ANCHORS
        for keyword in discard_keywords:
            if line_upper.startswith(keyword) or line_upper == keyword:
                return None
        
        # Skip promo/discount lines
        if '(' in line or line.startswith('-') or 'discount' in line.lower():
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
        
        # Rightmost number = total_price
        total_price = float(numbers[-1])
        
        # Skip suspiciously high prices (likely summary lines)
        if total_price > 10000000:
            return None
        
        # Skip if line only has one number (not an item)
        if len(numbers) == 1 and total_price > 1000:
            return None
        
        # Quantity
        quantity = 1
        price_per_unit = total_price
        
        if len(numbers) >= 2 and numbers[-2] <= 20:
            quantity = numbers[-2]
            price_per_unit = total_price / quantity
        
        # Name = everything before first number
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
    
    def _validate_and_score(self, result: ExtractionResult) -> ExtractionResult:
        """Validate math and calculate confidence."""
        # Must have total amount
        if result.total_amount <= 0:
            result.success = False
            result.confidence = 0.0
            result.message = "No total amount found"
            return result
        
        # Must have valid merchant (not generic)
        if result.merchant_name in ["Merchant", ""]:
            result.confidence = max(0.3, result.confidence)
        
        # Must have items
        if not result.items:
            result.success = False
            result.confidence = max(0.5, result.confidence)
            result.message = "No items parsed"
            return result
        
        # Math validation
        items_sum = result.items_sum
        diff = abs(items_sum - result.total_amount)
        
        # Add discount to total for comparison
        expected = result.total_amount + result.discount
        
        if abs(items_sum - expected) < 1:  # Perfect match
            result.confidence = 0.95
            result.success = True
            result.message = "Perfect math match"
        elif diff <= 500:  # Within tolerance
            result.confidence = 0.85
            result.success = True
            result.message = f"Math within tolerance (diff={diff})"
        elif result.subtotal > result.total_amount:  # Discount scenario
            result.confidence = 0.80
            result.success = True
            result.message = f"Discount scenario (discount={result.discount})"
        else:  # Math mismatch
            result.confidence = 0.50
            result.success = False
            result.message = f"Math mismatch (sum={items_sum}, total={result.total_amount})"
        
        return result


# ============================================================
# MAIN PIPELINE ORCHESTRATOR
# ============================================================

class ReceiptPipeline:
    """
    Hybrid Receipt Pipeline:
    Layer 1: Email/Transfer Parser
    Layer 2: Physical Receipt Parser  
    Layer 3: Gemini Fallback (if needed)
    """
    
    def __init__(self):
        self.email_parser = EmailTransferParser()
        self.physical_parser = PhysicalReceiptParser()
    
    async def parse(
        self,
        raw_input: Dict[str, Any],
        image_bytes: bytes = None
    ) -> ExtractionResult:
        """
        Execute hybrid pipeline.
        Returns structured result with confidence score.
        """
        # Try Layer 1: Email/Transfer
        if raw_input.get('html_content'):
            result = self.email_parser.parse_html(raw_input['html_content'])
            if result.confidence >= 0.80:
                logger.info(f"Layer 1 success: {result.message}")
                return result
        
        # Try Layer 2: Physical Receipt
        lines = raw_input.get('ocr_lines') or raw_input.get('lines') or []
        if lines:
            result = self.physical_parser.parse(lines)
            if result.confidence >= 0.80:
                logger.info(f"Layer 2 success: {result.message}")
                return result
            
            # Layer 2 partial success - check if we need Gemini
            if result.confidence < 0.80 or result.total_amount == 0:
                logger.info(f"Layer 2 failed (conf={result.confidence}), attempting Gemini")
                
                # Try Gemini fallback
                gemini_result = await self._parse_with_gemini(image_bytes)
                if gemini_result and gemini_result.confidence >= 0.80:
                    return gemini_result
                
                # Gemini failed - return layer 2 result anyway
                # Better partial data than nothing
                if result.items:
                    result.message = f"{result.message} (Gemini unavailable)"
                    return result
        
        # No successful parse
        result = ExtractionResult()
        result.message = "All layers failed"
        return result
    
    async def _parse_with_gemini(self, image_bytes: bytes) -> Optional[ExtractionResult]:
        """Parse with Gemini AI fallback."""
        if not image_bytes:
            return None
        
        try:
            import os
            api_key = os.environ.get('GEMINI_API_KEY')
            
            if not api_key:
                logger.warning("No Gemini API key")
                return None
            
            from app.services.gemini_vision import extract_receipt_with_gemini
            
            result_data = extract_receipt_with_gemini(image_bytes, api_key)
            
            if not result_data:
                return None
            
            # Convert to ExtractionResult
            result = ExtractionResult(source=ExtractionSource.GEMINI_FALLBACK)
            result.confidence = 0.85
            
            if result_data.get('merchant'):
                result.merchant_name = result_data['merchant'].get('name', 'Merchant')
                result.merchant_type = result_data['merchant'].get('type', 'Other')
            
            result.total_amount = float(result_data.get('total_amount', 0) or 0)
            result.date = result_data.get('transaction_date')
            result.payment_method = result_data.get('payment_method')
            
            if result_data.get('items'):
                for item_data in result_data['items']:
                    result.items.append(ReceiptItem(
                        name=item_data.get('name', 'Unknown'),
                        quantity=int(item_data.get('quantity', 1)),
                        price_per_unit=float(item_data.get('price_per_unit', 0)),
                        total_price=float(item_data.get('total_price', 0))
                    ))
            
            if result.total_amount > 0 and result.items:
                result.success = True
                result.message = "Gemini fallback success"
            else:
                result.message = "Gemini returned incomplete data"
            
            return result
            
        except Exception as e:
            logger.error(f"Gemini fallback error: {e}")
            return None


# Global instance
_pipeline: Optional[ReceiptPipeline] = None

def get_pipeline() -> ReceiptPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = ReceiptPipeline()
    return _pipeline
