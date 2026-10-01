# ============================================================
# HYBRID PARSING PIPELINE
# Rule-First, AI-Last Architecture
# ============================================================
# 
# Layer 1: Email DOM Parser (for email receipts) - 0ms, $0
# Layer 2: Local Regex Bounded Parser (for physical receipts) - 10ms, $0  
# Layer 3: Redis Queue + Gemini Fallback (for complex cases) - Async
#
# Key Principle: PURE FUNCTIONS - no mutation, return ParsingResult
# ============================================================

import os
import re
import logging
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ParseLayer(Enum):
    EMAIL_DOM = "email_dom"
    QR_CODE = "qr_code"
    LOCAL_REGEX = "local_regex"
    GEMINI_FALLBACK = "gemini_fallback"
    NONE = "none"


@dataclass
class ParsingResult:
    """
    Immutable result object from parsing pipeline.
    Each layer returns this - no mutation allowed.
    """
    success: bool = False
    data: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.0
    layer: ParseLayer = ParseLayer.NONE
    message: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "confidence": self.confidence,
            "layer": self.layer.value,
            "message": self.message
        }


# ============================================================
# LAYER 1: EMAIL DOM PARSER
# For digital receipts from email (Gojek, Grab, Tokopedia, etc.)
# ============================================================

def parse_email_dom(html_content: str) -> ParsingResult:
    """
    Parse email receipts using HTML structure.
    Fast, deterministic, $0 cost.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        logger.warning("BeautifulSoup not available, skipping email parsing")
        return ParsingResult()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    html_upper = html_content.upper()
    
    # Gojek Detection
    if "GOJEK" in html_upper or "PT APLIKASI KARYA ANAK BANGSA" in html_upper:
        return _parse_gojek_email(soup)
    
    # Grab Detection
    if "GRAB" in html_upper:
        return _parse_grab_email(soup)
    
    # Tokopedia Detection
    if "TOKOPEDIA" in html_upper:
        return _parse_tokopedia_email(soup)
    
    # Shopee Detection
    if "SHOPEE" in html_upper or "SHOPEEFOOD" in html_upper:
        return _parse_shopee_email(soup)
    
    # Mandiri Detection
    if "BANK MANDIRI" in html_upper:
        return _parse_mandiri_email(soup)
    
    return ParsingResult()


def _parse_gojek_email(soup) -> ParsingResult:
    """Parse Gojek email receipt."""
    try:
        # Look for total payment pattern
        total_text = None
        for elem in soup.find_all(string=lambda t: t and "Total Pembayaran" in str(t)):
            total_text = elem.strip()
            break
        
        if not total_text:
            for elem in soup.find_all(['td', 'span', 'div']):
                if elem.string and "TOTAL" in elem.string.upper():
                    total_text = elem.get_text()
                    break
        
        if total_text:
            # Extract numeric value
            numbers = re.findall(r'[\d\,\.]+', total_text)
            if numbers:
                # Take largest number as total
                total = max(float(n.replace(',', '').replace('.', '')) for n in numbers)
                
                return ParsingResult(
                    success=True,
                    confidence=0.98,
                    data={
                        "merchant_name": "Gojek",
                        "merchant_type": "Service",
                        "total_amount": total,
                        "items": [],
                        "transaction_date": None
                    },
                    layer=ParseLayer.EMAIL_DOM,
                    message="Gojek email parsed successfully"
                )
    except Exception as e:
        logger.warning(f"Gojek email parse failed: {e}")
    
    return ParsingResult()


def _parse_grab_email(soup) -> ParsingResult:
    """Parse Grab email receipt."""
    # Similar pattern for Grab
    return ParsingResult()


def _parse_tokopedia_email(soup) -> ParsingResult:
    """Parse Tokopedia email receipt."""
    return ParsingResult()


def _parse_shopee_email(soup) -> ParsingResult:
    """Parse Shopee email receipt."""
    return ParsingResult()


def _parse_mandiri_email(soup) -> ParsingResult:
    """Parse Mandiri email receipt."""
    return ParsingResult()


# ============================================================
# LAYER 2: LOCAL REGEX BOUNDED PARSER
# For physical receipts - strict math validation required
# ============================================================

def parse_receipt_bounded_regex(lines: List[str]) -> ParsingResult:
    """
    Parse physical receipts using bounded region + RTL parsing.
    STRICT: Only returns success=True if math is 100% valid.
    """
    if not lines:
        return ParsingResult()
    
    # Summary anchors - mark end of item region
    summary_anchors = [
        'HARGA JUAL', 'SUBTOTAL', 'SUB TOTAL', 'DISKON', 
        'TOTAL', 'ANDA HEMAT', 'TUNAI', 'CASH', 'BAYAR', 'KEMBALI'
    ]
    
    # Find INDEX_END - first summary keyword
    index_end = len(lines)
    for i, line in enumerate(lines):
        line_upper = line.upper()
        if any(kw in line_upper for kw in summary_anchors):
            index_end = i
            break
    
    # Find INDEX_START - first separator or merchant line
    index_start = 0
    for i, line in enumerate(lines[:15]):
        line_clean = line.strip()
        
        # Separator found
        if '---' in line_clean or '===' in line_clean:
            index_start = i + 1
            break
        
        # Skip date/time lines
        if re.match(r'^[\d\.\-\:\s]+$', line_clean) and len(line_clean) < 25:
            continue
        
        # Skip empty
        if not line_clean:
            continue
        
        # Valid merchant candidate
        if is_valid_merchant_name(line_clean):
            index_start = i + 1
            break
    
    # Parse items from bounded region
    item_lines = lines[index_start:index_end]
    parsed_items = []
    
    for line in item_lines:
        item = parse_item_rtl(line)
        if item and item["total_price"] > 0:
            parsed_items.append(item)
    
    # Extract total amount
    total_amount = extract_total_from_lines(lines)
    
    # Extract merchant name
    merchant_name = extract_clean_merchant(lines[:15])
    
    # STRICT MATH CHECK
    items_sum = sum(item["total_price"] for item in parsed_items)
    
    logger.info(f"Layer 2 Regex: items={len(parsed_items)}, sum={items_sum}, total={total_amount}")
    
    # Only return success if math is 100% valid
    if total_amount > 0 and abs(items_sum - total_amount) <= 100:
        return ParsingResult(
            success=True,
            confidence=1.0,
            data={
                "merchant_name": merchant_name,
                "total_amount": total_amount,
                "items": parsed_items,
                "items_sum": items_sum,
                "transaction_date": extract_date_from_lines(lines)
            },
            layer=ParseLayer.LOCAL_REGEX,
            message=f"Local regex parsed {len(parsed_items)} items"
        )
    
    # Math check failed - return failure without mutation
    # Next layer (Gemini) will handle this
    return ParsingResult(
        success=False,
        confidence=0.0,
        data={
            "merchant_name": merchant_name,
            "partial_items": parsed_items,  # May help Gemini
            "total_amount": total_amount
        },
        layer=ParseLayer.LOCAL_REGEX,
        message=f"Math check failed: sum={items_sum}, total={total_amount}"
    )


def is_valid_merchant_name(name: str) -> bool:
    """Check if merchant name is valid (not garbage OCR)."""
    if not name or len(name) < 2:
        return False
    
    # Garbage patterns
    garbage = ['download', '口品', '★', '●', 'http', 'www.', 'receipt', 'invoice']
    name_upper = name.upper()
    
    if any(g in name_upper for g in garbage):
        return False
    
    # Must have alphabetic characters
    alpha_count = len(re.sub(r'[^a-zA-Z]', '', name))
    return alpha_count >= 2


def parse_item_rtl(line: str) -> Optional[Dict[str, Any]]:
    """
    RIGHT-TO-LEFT parsing for item lines.
    Returns dict with name, quantity, price_per_unit, total_price.
    """
    line = line.strip()
    if not line:
        return None
    
    # Skip promo/discount lines
    if '(' in line or line.startswith('-') or re.search(r'-\s*\d', line):
        return None
    
    # Skip phone/hotline patterns
    if re.match(r'^[\d\s\-\.]+$', line):
        return None
    
    # Tokenize
    tokens = line.split()
    if len(tokens) < 2:
        return None
    
    # Find all numbers
    numbers = []
    for token in tokens:
        clean = token.replace('.', '').replace(',', '')
        if clean.isdigit():
            numbers.append(int(clean))
    
    if not numbers:
        return None
    
    # Rightmost = total_price
    total_price = float(numbers[-1])
    
    # Skip if suspiciously high
    if total_price > 10000000:
        return None
    
    # Quantity and unit price
    quantity = 1
    price_per_unit = total_price
    
    if len(numbers) >= 2:
        second = numbers[-2]
        if second <= 20:
            quantity = second
            price_per_unit = total_price / quantity
    
    # Item name = everything before first number
    first_num_idx = 0
    for i, token in enumerate(tokens):
        clean = token.replace('.', '').replace(',', '')
        if clean.isdigit():
            first_num_idx = i
            break
    
    name = ' '.join(tokens[:first_num_idx]).strip()
    
    if not name or len(name) < 1:
        return None
    
    return {
        "name": name,
        "quantity": quantity,
        "price_per_unit": price_per_unit,
        "total_price": total_price
    }


def extract_total_from_lines(lines: List[str]) -> float:
    """Extract total amount from receipt lines."""
    for line in lines:
        line_upper = line.upper()
        if 'TOTAL' in line_upper or 'GRAND' in line_upper:
            numbers = re.findall(r'[\d\,\.]+', line)
            for num in reversed(numbers):
                val = float(num.replace(',', '').replace('.', ''))
                if val > 1000:
                    return val
    return 0.0


def extract_clean_merchant(lines: List[str]) -> str:
    """Extract clean merchant name from lines."""
    for line in lines:
        line_clean = line.strip()
        if is_valid_merchant_name(line_clean):
            return line_clean
    return "Merchant"


def extract_date_from_lines(lines: List[str]) -> Optional[str]:
    """Extract date from receipt lines."""
    for line in lines:
        match = re.search(r'(\d{2})[\.\-](\d{2})[\.\-](\d{2,4})', line)
        if match:
            day, month, year = match.groups()
            if len(year) == 2:
                year = '20' + year
            return f"{year}-{month}-{day}"
    return None


# ============================================================
# LAYER 3: GEMINI FALLBACK (Async via Queue)
# ============================================================

async def enqueue_gemini_processing(
    image_bytes: bytes,
    partial_data: Dict[str, Any] = None,
    user_id: str = None
) -> str:
    """
    Queue Gemini processing for complex receipts.
    Returns job_id for tracking.
    """
    try:
        # Use Redis queue (BullMQ pattern)
        # For now, return job_id for tracking
        import uuid
        job_id = str(uuid.uuid4())
        
        logger.info(f"Queued Gemini job: {job_id}")
        
        # TODO: Implement actual queue with Redis/BullMQ
        # For now, log the pending job
        return job_id
        
    except Exception as e:
        logger.error(f"Failed to queue Gemini job: {e}")
        return None


# ============================================================
# MAIN PIPELINE EXECUTOR
# ============================================================

async def execute_hybrid_pipeline(
    raw_payload: Dict[str, Any],
    image_bytes: bytes = None,
    user_id: str = None
) -> ParsingResult:
    """
    Execute Rule-First, AI-Last pipeline.
    
    1. Check for email receipt → Email DOM Parser
    2. Check for QR code → QR Parser
    3. Parse OCR lines → Local Regex (strict math check)
    4. If all fail → Queue Gemini Fallback
    """
    # Layer 1: Email DOM Parser
    if raw_payload.get("html_content"):
        result = parse_email_dom(raw_payload["html_content"])
        if result.success and result.confidence >= 0.95:
            logger.info("Layer 1 success: Email DOM")
            return result
    
    # Layer 2: QR Code Parser
    if raw_payload.get("qr_payload"):
        # TODO: Implement QR parsing
        pass
    
    # Layer 3: Local Regex Bounded Parser
    if raw_payload.get("ocr_lines"):
        result = parse_receipt_bounded_regex(raw_payload["ocr_lines"])
        if result.success and result.confidence == 1.0:
            logger.info("Layer 3 success: Local Regex")
            return result
        else:
            logger.info(f"Layer 3 failed: {result.message}")
            # Return partial data - don't lose what we have
    
    # Layer 4: Queue Gemini Fallback
    if image_bytes:
        job_id = await enqueue_gemini_processing(
            image_bytes=image_bytes,
            partial_data=raw_payload.get("ocr_lines"),
            user_id=user_id
        )
        
        if job_id:
            return ParsingResult(
                success=False,
                data={"job_id": job_id},
                confidence=0.0,
                layer=ParseLayer.GEMINI_FALLBACK,
                message="Transaction queued for AI processing"
            )
    
    # All layers failed
    return ParsingResult(
        success=False,
        message="All parsing layers failed"
    )
