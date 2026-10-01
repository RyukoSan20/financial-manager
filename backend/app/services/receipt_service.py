# ============================================================
# HYBRID RECEIPT PROCESSING SERVICE
# OCR + Regex Engine + Gemini AI Fallback & Enrichment
# ============================================================

import os
import logging
import re
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class ParsedItem:
    """Parsed receipt item."""
    name: str
    canonical_name: Optional[str] = None
    quantity: int = 1
    price_per_unit: float = 0.0
    total_price: float = 0.0
    category: Optional[str] = None
    match_confidence: float = 0.0

@dataclass
class ParsedReceipt:
    """Parsed receipt result."""
    merchant_name: Optional[str] = None
    merchant_type: str = "Retail"  # Retail, Bank/Financial, F&B, Service, Utilities, Other
    merchant_location: Optional[str] = None
    transaction_date: Optional[str] = None
    items: List[ParsedItem] = field(default_factory=list)
    subtotal: float = 0.0
    discount: float = 0.0
    total_amount: float = 0.0
    payment_method: Optional[str] = None
    confidence: float = 0.0
    parse_method: str = "unknown"  # regex, gemini_fallback, gemini_enrichment
    raw_text: Optional[str] = None
    raw_lines: List[str] = field(default_factory=list)
    
    def items_total(self) -> float:
        """Calculate sum of all item totals."""
        return sum(item.total_price for item in self.items)
    
    def sanity_check(self) -> Tuple[bool, str]:
        """
        Validate parsed receipt.
        Returns (passed, reason).
        """
        # Check if we have items
        if not self.items:
            return False, "No items parsed"
        
        # Check if total_amount is reasonable
        if self.total_amount <= 0:
            return False, "Total amount is zero or negative"
        
        # Check math: sum of items should match total (within ABSOLUTE 500 tolerance)
        # RIGID CHECK: If diff > 500, regex failed - call Gemini fallback
        items_sum = self.items_total()
        if items_sum > 0:
            diff = abs(items_sum - self.total_amount)
            if diff > 500:  # Absolute threshold, not percentage
                return False, f"Math mismatch: items sum={items_sum}, total={self.total_amount} (diff={diff})"
        
        return True, "OK"


# ============================================================
# THOUSAND SEPARATOR NORMALIZER
# ============================================================

def normalize_thousand_separators(text: str) -> str:
    """
    Normalize Indonesian thousand separators:
    - "18.000" -> "18000"
    - "8,500" -> "8500"
    - "18 000" -> "18000"
    """
    if not text:
        return text
    
    # Handle comma as thousand separator: "8,500" -> "8500"
    # But not decimal: "35.50" should stay as is in some cases
    # Strategy: commas followed by exactly 3 digits are thousand separators
    text = re.sub(r'(\d),(\d{3})(?!\d)', r'\1\2', text)
    
    # Handle space as thousand separator: "18 000" -> "18000"
    text = re.sub(r'(\d)\s+(\d{3})(?!\d)', r'\1\2', text)
    
    return text


def parse_number(text: str) -> float:
    """Parse Indonesian number string to float."""
    if not text:
        return 0.0
    
    text = str(text).strip()
    
    # Check for discount parentheses
    is_negative = '(' in text and ')' in text
    text = text.replace('(', '').replace(')', '').replace(',', '').replace('.', '')
    
    # Extract digits
    digits = re.sub(r'[^\d]', '', text)
    
    if not digits:
        return 0.0
    
    value = float(digits)
    return -value if is_negative else value


# ============================================================
# REGEX ENGINE (LOCAL PARSER)
# ============================================================

def parse_receipt_with_regex(lines: List[str]) -> ParsedReceipt:
    """
    Parse receipt using LOCAL REGION BOUNDING + RIGHT-TO-LEFT GENERIC PARSING.
    Generic - works for ANY global receipt format.
    
    Step 1: Find ITEM REGION (INDEX_START to INDEX_END)
    Step 2: Parse items RIGHT-TO-LEFT (generic)
    Step 3: Extract total amount
    """
    receipt = ParsedReceipt(parse_method="regex")
    receipt.raw_lines = lines
    
    # =========================================================
    # STEP 1: REGIONAL BOUNDING BOX - Find item region
    # =========================================================
    
    # Summary keywords that mark end of item section (EARLY STOP - first occurrence)
    summary_keywords = [
        'HARGA JUAL', 'SUBTOTAL', 'SUB TOTAL', 'DISKON', 
        'TOTAL', 'ANDA HEMAT', 'TUNAI', 'CASH', 'BAYAR', 'KEMBALI', 'GRAND'
    ]
    
    index_start = 0
    index_end = len(lines)
    
    # Patterns that indicate garbage/OCR noise
    garbage_patterns = [
        'download', '口品', '★', '●', '■', '□', '◆', '◇',
        'http', 'www.', '.com', '.net', '.org',
        'receipt', 'invoice', 'struk', 'bill'
    ]
    
    def is_valid_merchant_name(name: str) -> bool:
        """Check if merchant name is valid (not garbage OCR)"""
        name_upper = name.upper()
        # Check for garbage patterns
        if any(p in name_upper for p in garbage_patterns):
            return False
        # Must have at least some alphabetic characters
        alpha_count = len(re.sub(r'[^a-zA-Z]', '', name))
        if alpha_count < 2:
            return False
        return True
    
    # Find INDEX_START: first separator line OR first non-metadata line
    for i, line in enumerate(lines[:15]):
        line_upper = line.upper().strip()
        line_clean = line.strip()
        
        # Found separator line
        if '---' in line_clean or '===' in line_clean or '___' in line_clean:
            index_start = i + 1
            break
        
        # Skip date/time metadata lines
        if re.match(r'^[\d\.\-\:\s]+$', line_clean) and len(line_clean) < 25:
            continue
        
        # Skip empty lines
        if not line_clean:
            continue
        
        # This is likely merchant name - validate first
        if index_start == 0 and is_valid_merchant_name(line_clean):
            receipt.merchant_name = line_clean
            index_start = i + 1
            break
    
    # If no valid merchant found, try to find one more aggressively
    if not receipt.merchant_name:
        for i, line in enumerate(lines[:15]):
            line_clean = line.strip()
            if len(line_clean) > 2 and len(line_clean) < 50:
                # Skip if it's only numbers/dates
                if re.match(r'^[\d\s\-\.\:\/]+$', line_clean):
                    continue
                # Skip if it contains garbage
                if not is_valid_merchant_name(line_clean):
                    continue
                receipt.merchant_name = line_clean
                index_start = i + 1
                break
    
    # Find INDEX_END: FIRST occurrence of summary keyword (EARLY STOP)
    for i, line in enumerate(lines):
        line_upper = line.upper()
        if any(kw in line_upper for kw in summary_keywords):
            index_end = i  # EXCLUDE this line and everything after
            break
    
    # Extract items from bounded region (INDEX_START to INDEX_END-1)
    item_lines = lines[index_start:index_end]
    
    # =========================================================
    # STEP 2: RIGHT-TO-LEFT GENERIC PARSING
    # =========================================================
    
    for line in item_lines:
        line_clean = normalize_thousand_separators(line.strip())
        line_upper = line_clean.upper()
        
        # Skip empty lines
        if not line_clean or len(line_clean) < 3:
            continue
        
        # Skip lines that are mostly numbers
        alpha_count = len(re.sub(r'[\d\s\-\.\,\:\/]', '', line_clean))
        numeric_count = len(re.sub(r'[^\d]', '', line_clean))
        if alpha_count < 2 and numeric_count > len(line_clean) * 0.7:
            continue
        
        # Skip lines with summary keywords
        if any(kw in line_upper for kw in summary_keywords):
            continue
        
        # Skip phone/hotline patterns
        if re.match(r'^[\d\s\-\.]+$', line_clean):
            continue
        
        # Skip lines with parentheses (promo info) or negative/minus prices
        # These are discount/promo lines, NOT items
        if '(' in line or ')' in line or '- ' in line_clean or line_clean.startswith('-'):
            continue
        # Also skip if price looks like a discount (starts with minus in the number)
        if re.search(r'-\s*\d', line_clean):
            continue
        
        # Parse item using RIGHT-TO-LEFT approach
        item = parse_item_line_rtl(line_clean)
        if item and item.total_price > 0:
            receipt.items.append(item)
    
    # =========================================================
    # STEP 3: Extract total amount (from entire document)
    # =========================================================
    
    for line in lines:
        line_upper = line.upper()
        
        if 'TOTAL' in line_upper or 'GRAND' in line_upper:
            normalized_line = normalize_thousand_separators(line)
            numbers = re.findall(r'[\d\,\.]+', normalized_line)
            for num in reversed(numbers):
                val = parse_number(num)
                if val > 1000:  # Likely total
                    receipt.total_amount = val
                    break
        
        # Payment method
        if 'GOPAY' in line_upper or 'OVO' in line_upper or 'DANA' in line_upper:
            receipt.payment_method = 'E-Wallet'
        elif 'TUNAI' in line_upper or 'CASH' in line_upper:
            receipt.payment_method = 'Cash'
        elif 'DEBIT' in line_upper:
            receipt.payment_method = 'Debit'
        elif 'QRIS' in line_upper:
            receipt.payment_method = 'QRIS'
        
        # Date extraction
        date_match = re.search(r'(\d{2})[\.\-](\d{2})[\.\-](\d{2,4})', line)
        if date_match and not receipt.transaction_date:
            day, month, year = date_match.groups()
            if len(year) == 2:
                year = '20' + year
            receipt.transaction_date = f"{year}-{month}-{day}"
    
    # Calculate subtotal from items
    receipt.subtotal = sum(item.total_price for item in receipt.items)
    
    # Discount
    receipt.discount = receipt.subtotal - receipt.total_amount
    
    # Confidence based on item count
    if receipt.items:
        receipt.confidence = min(0.9, 0.5 + 0.1 * len(receipt.items))
    
    return receipt


def parse_item_line_rtl(line: str) -> Optional[ParsedItem]:
    """
    RIGHT-TO-LEFT GENERIC PARSER for ANY receipt item line.
    
    Algorithm:
    1. Tokenize by whitespace
    2. Extract RIGHTMOST numbers as prices (rightmost = total_price)
    3. Extract quantity from remaining right-side numbers (if small int)
    4. Everything LEFT becomes item_name
    
    This works for ANY product name, ANY language, ANY format.
    """
    # Normalize separators
    line = normalize_thousand_separators(line)
    
    # Tokenize
    tokens = line.split()
    if len(tokens) < 2:
        return None
    
    # Find all numbers in tokens
    numbers = []
    for i, token in enumerate(tokens):
        # Clean token (remove dots for thousand separator)
        clean = token.replace('.', '')
        if clean.isdigit():
            numbers.append((i, int(clean)))
        elif re.match(r'^\d+,\d+$', token):
            # European decimal (1,500)
            clean = token.replace(',', '')
            numbers.append((i, int(clean)))
    
    if not numbers:
        return None
    
    # RIGHT-TO-LEFT assignment
    # Rightmost number = total_price
    last_idx, last_val = numbers[-1]
    total_price = float(last_val)
    
    # Second rightmost number = price_per_unit or quantity
    price_per_unit = total_price
    quantity = 1
    
    if len(numbers) >= 2:
        second_last_idx, second_last_val = numbers[-2]
        
        # Check if it's quantity (small integer <= 20)
        if second_last_val <= 20:
            quantity = second_last_val
            price_per_unit = total_price / quantity
        else:
            # It's probably unit price, calculate qty
            price_per_unit = float(second_last_val)
            if total_price > 0 and price_per_unit > 0:
                # Estimate qty from total/unit price
                qty_estimate = round(total_price / price_per_unit)
                if qty_estimate >= 1 and qty_estimate <= 50:
                    quantity = qty_estimate
    
    # Third rightmost could be quantity if first two are both prices
    if len(numbers) >= 3 and quantity == 1:
        third_last_idx, third_last_val = numbers[-3]
        if third_last_val <= 20:
            # Recalculate
            quantity = third_last_val
            # Recalculate unit price
            if len(numbers) >= 2:
                price_per_unit = float(numbers[-1][1]) / quantity
    
    # Everything BEFORE the numbers is the item name
    # Find the index of the first number token
    first_number_idx = numbers[0][0]
    
    # Item name = all tokens before first number
    item_name = ' '.join(tokens[:first_number_idx])
    
    # Clean up item name
    item_name = item_name.strip()
    if not item_name or len(item_name) < 2:
        return None
    
    # Skip if total_price is suspiciously high (likely a phone number or junk)
    if total_price > 10000000:  # > 10 million
        return None
    
    return ParsedItem(
        name=item_name,
        quantity=quantity,
        price_per_unit=price_per_unit,
        total_price=total_price
    )
    
    # Split by whitespace
    parts = line.split()
    if len(parts) < 2:
        return None
    
    # Find numeric parts from RIGHT (prices are always at the end)
    numeric_parts = []
    text_parts = []
    
    for part in reversed(parts):
        clean_part = normalize_thousand_separators(part)
        if re.match(r'^[\d\,\.]+$', clean_part):
            numeric_parts.append(clean_part)
        else:
            text_parts.append(part)
    
    # Reverse back to correct order
    numeric_parts.reverse()
    text_parts.reverse()
    
    if len(numeric_parts) < 1:
        return None
    
    # Parse numbers
    numbers = [parse_number(n) for n in numeric_parts]
    
    # Single number: just price
    if len(numeric_parts) == 1:
        return ParsedItem(
            name=" ".join(text_parts) if text_parts else "Item",
            quantity=1,
            price_per_unit=numbers[0],
            total_price=numbers[0]
        )
    
    # Multiple numbers: determine qty, unit, total
    total_price = numbers[-1]
    
    # Skip negative (discounts)
    if total_price < 0:
        return None
    
    qty = 1
    unit_price = total_price
    
    if len(numbers) >= 3:
        # Likely: qty, unit_price, total (from right)
        possible_qty = numbers[-3]
        possible_unit = numbers[-2]
        
        if 0 < possible_qty <= 20 and possible_unit >= 100:
            qty = int(possible_qty)
            unit_price = possible_unit
    elif len(numbers) == 2:
        # Could be: unit_price, total
        if numbers[0] <= 10 and total_price % numbers[0] == 0 and numbers[0] > 0:
            qty = int(numbers[0])
            unit_price = total_price / qty
        elif numbers[0] >= 100:
            unit_price = numbers[0]
    
    # Build name from text parts
    name = " ".join(text_parts)
    
    # Validate
    if total_price < 1 or not name:
        return None
    
    return ParsedItem(
        name=name,
        quantity=qty,
        price_per_unit=unit_price,
        total_price=total_price
    )


# ============================================================
# GEMINI ENRICHMENT & FALLBACK
# ============================================================

def enrich_with_gemini(receipt: ParsedReceipt, image_bytes: bytes = None) -> ParsedReceipt:
    """
    Use Gemini AI for enrichment (merchant type, categories) or full fallback.
    Only called when regex fails or for enrichment.
    """
    from app.services.gemini_vision import extract_receipt_with_gemini, format_gemini_result
    
    try:
        api_key = os.environ.get('GEMINI_API_KEY')
        
        if not api_key:
            logger.warning("Gemini API key not configured")
            return receipt
        
        # Call Gemini
        if image_bytes:
            gemini_result = extract_receipt_with_gemini(image_bytes, api_key)
        else:
            # No image, skip Gemini
            return receipt
        
        if gemini_result:
            # Convert Gemini result to ParsedReceipt
            ocr_result = format_gemini_result(gemini_result)
            
            # Update receipt with Gemini data
            if gemini_result.get('merchant'):
                receipt.merchant_name = gemini_result['merchant'].get('name') or receipt.merchant_name
                receipt.merchant_type = gemini_result['merchant'].get('type', 'Other')
                receipt.merchant_location = gemini_result['merchant'].get('location')
            
            if gemini_result.get('items'):
                receipt.items = []
                for item_data in gemini_result['items']:
                    receipt.items.append(ParsedItem(
                        name=item_data.get('name', 'Unknown'),
                        quantity=int(item_data.get('quantity', 1)),
                        price_per_unit=float(item_data.get('price_per_unit', 0)),
                        total_price=float(item_data.get('total_price', 0)),
                        category=item_data.get('category')
                    ))
            
            receipt.total_amount = float(gemini_result.get('total_amount', receipt.total_amount))
            receipt.parse_method = "gemini_fallback"
            
    except Exception as e:
        logger.warning(f"Gemini enrichment failed: {e}")
    
    return receipt


def build_enrichment_prompt(receipt: ParsedReceipt) -> str:
    """Build prompt for enriching already-parsed receipt."""
    return f"""You are a receipt enrichment AI. The receipt has already been parsed, but needs:
1. Merchant type classification (Retail, Bank/Financial, F&B, Service, Utilities, Other)
2. Item category suggestions
3. Location extraction

Current parsed data:
- Merchant: {receipt.merchant_name or 'Unknown'}
- Date: {receipt.transaction_date or 'Unknown'}
- Total: Rp {receipt.total_amount:,.0f}
- Items: {len(receipt.items)}

Respond ONLY with valid JSON:
{{
  "merchant_type": "Retail|Bank/Financial|F&B|Service|Utilities|Other",
  "merchant_location": "city or address if found, null if not",
  "items": [
    {{
      "name": "original name",
      "category": "Makanan/Minuman|Belanja|Transfer|Transport|Entertainment|Lainnya"
    }}
  ]
}}"""


def build_full_parse_prompt() -> str:
    """Build prompt for full receipt parsing."""
    return """You are a receipt parsing AI. Extract ALL information from this receipt and return ONLY valid JSON:

{
  "merchant": {
    "name": "official brand/bank name",
    "type": "Retail|Bank/Financial|F&B|Service|Utilities|Other",
    "location": "city/address if available, null if not"
  },
  "transaction_date": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "original product/service name",
      "canonical_name": "standardized name",
      "quantity": 1,
      "price_per_unit": 0.0,
      "total_price": 0.0,
      "category": "category name"
    }
  ],
  "subtotal": 0.0,
  "discount": 0.0,
  "total_amount": 0.0,
  "payment_method": "Cash|Debit|E-Wallet|QRIS|Credit|null"
}

Important:
- For bank/transfer receipts, type="Bank/Financial" and items should be "Biaya Admin" or "Transfer"
- For utility bills, type="Utilities"
- Always extract real item names, not just "Item 1, Item 2"
- Price in Indonesian Rupiah (Rp)"""


def parse_gemini_response(gemini_result: Dict, existing: ParsedReceipt = None) -> ParsedReceipt:
    """Parse Gemini JSON response into ParsedReceipt."""
    if existing is None:
        existing = ParsedReceipt()
    
    try:
        # Extract merchant info
        if 'merchant' in gemini_result:
            merchant = gemini_result['merchant']
            existing.merchant_name = merchant.get('name') or existing.merchant_name
            existing.merchant_type = merchant.get('type', existing.merchant_type)
            existing.merchant_location = merchant.get('location')
        
        # Extract items
        if 'items' in gemini_result:
            for item_data in gemini_result['items']:
                if isinstance(item_data, dict):
                    item = ParsedItem(
                        name=item_data.get('name', 'Unknown'),
                        canonical_name=item_data.get('canonical_name'),
                        quantity=int(item_data.get('quantity', 1)),
                        price_per_unit=float(item_data.get('price_per_unit', 0)),
                        total_price=float(item_data.get('total_price', 0)),
                        category=item_data.get('category')
                    )
                    existing.items.append(item)
        
        # Extract amounts
        existing.total_amount = float(gemini_result.get('total_amount', existing.total_amount))
        existing.subtotal = float(gemini_result.get('subtotal', existing.subtotal))
        existing.discount = float(gemini_result.get('discount', existing.discount))
        
        # Date
        if 'transaction_date' in gemini_result and gemini_result['transaction_date']:
            existing.transaction_date = gemini_result['transaction_date']
        
        # Payment method
        if 'payment_method' in gemini_result:
            existing.payment_method = gemini_result['payment_method']
        
        # Calculate subtotal if not provided
        if existing.subtotal == 0 and existing.items:
            existing.subtotal = sum(item.total_price for item in existing.items)
        
    except Exception as e:
        logger.warning(f"Failed to parse Gemini response: {e}")
    
    return existing


# ============================================================
# HYBRID PIPELINE
# ============================================================

def process_receipt_hybrid(
    image_bytes: bytes,
    raw_text: str = None,
    lines: List[str] = None,
    use_gemini_fallback: bool = True,
    use_gemini_enrichment: bool = True
) -> ParsedReceipt:
    """
    Hybrid receipt processing pipeline:
    1. Parse with regex (fast, free)
    2. Validate with sanity check
    3. Conditional Gemini for enrichment or fallback
    """
    
    # Step 1: Get lines to parse
    if lines is None:
        if raw_text:
            lines = raw_text.split('\n')
        else:
            # Need OCR extraction first
            from app.services.ocr_service import ocr_service
            ocr_result = ocr_service.process_image(image_bytes)
            raw_text = ocr_result.text
            lines = ocr_result.raw_lines or raw_text.split('\n')
    
    # Step 2: Parse with regex
    receipt = parse_receipt_with_regex(lines)
    receipt.raw_text = raw_text
    
    # Step 3: Sanity check
    passed, reason = receipt.sanity_check()
    logger.info(f"Sanity check: passed={passed}, reason={reason}")
    logger.info(f"Items: {len(receipt.items)}, sum={receipt.items_total()}, total={receipt.total_amount}")
    
    # Keep original items as fallback
    original_items = list(receipt.items)
    
    if passed:
        logger.info(f"Regex parse passed: {len(receipt.items)} items, total={receipt.total_amount}")
        
        # Optional: Enrich with Gemini for categories
        if use_gemini_enrichment and receipt.merchant_name:
            receipt = enrich_with_gemini(receipt, image_bytes)
    
    else:
        logger.warning(f"Regex parse failed: {reason}")
        
        # Check discount scenario: items sum > total
        items_sum = receipt.items_total()
        if receipt.total_amount > 0 and items_sum > receipt.total_amount:
            discount = items_sum - receipt.total_amount
            logger.info(f"Discount scenario detected: items={items_sum}, total={receipt.total_amount}, discount={discount}")
            receipt.discount = discount
            # Items are valid - just has discount, no Gemini needed
        elif use_gemini_fallback and image_bytes:
            # Try Gemini to improve
            logger.info("Calling Gemini fallback...")
            receipt = enrich_with_gemini(receipt, image_bytes)
            
            # Only replace if Gemini returned items
            if not receipt.items:
                logger.info("Gemini returned no items, keeping original regex items")
                receipt.items = original_items
    
    # Step 5: Post-process if we have items
    if receipt.items:
        receipt = post_process_receipt(receipt)
    else:
        # No items at all - use partial from regex
        receipt.items = original_items
        receipt = post_process_receipt(receipt)
    
    # Fallback merchant name
    if not receipt.merchant_name:
        # Try to find from raw lines
        for line in (receipt.raw_lines or []):
            if line and len(line.strip()) > 2 and len(line.strip()) < 50:
                if not any(c in line.upper() for c in ['TOTAL', 'Rp', 'TUNAI', '---']):
                    receipt.merchant_name = line.strip()
                    break
        if not receipt.merchant_name:
            receipt.merchant_name = "Merchant"
    
    # Fallback total from items
    if receipt.total_amount <= 0 and receipt.items:
        receipt.total_amount = sum(item.total_price for item in receipt.items)
    
    # Ensure at least some items
    if not receipt.items and receipt.total_amount > 0:
        # Create a generic item
        receipt.items.append(ParsedItem(
            name="Items",
            quantity=1,
            price_per_unit=receipt.total_amount,
            total_price=receipt.total_amount
        ))
    
    return receipt


def post_process_receipt(receipt: ParsedReceipt) -> ParsedReceipt:
    """
    Post-process receipt to fix missing data and validate prices.
    """
    # Validate items: price must not exceed total_amount (unless it's a valid multi-item)
    if receipt.total_amount > 0:
        valid_items = []
        for item in receipt.items:
            # Skip items where price > total_amount (likely junk lines like phone numbers)
            if item.total_price > receipt.total_amount * 0.8:
                # Item price is > 80% of total - might be junk
                # But allow if it's clearly an item name pattern
                item_lower = item.name.lower()
                if any(kw in item_lower for kw in ['call', 'sms', 'hotline', 'www', 'http']):
                    continue  # Skip non-item lines
            valid_items.append(item)
        receipt.items = valid_items
    
    for item in receipt.items:
        # If price_per_unit is 0 but total_price > 0 and qty > 1
        if item.price_per_unit == 0 and item.total_price > 0 and item.quantity > 1:
            item.price_per_unit = item.total_price / item.quantity
        
        # If total_price is 0 but price_per_unit > 0 and qty > 1
        if item.total_price == 0 and item.price_per_unit > 0 and item.quantity > 1:
            item.total_price = item.price_per_unit * item.quantity
        
        # If both are 0 but qty exists, calculate from other items if possible
        if item.price_per_unit == 0 and item.total_price == 0:
            # Try to estimate from subtotal
            if receipt.subtotal > 0 and len(receipt.items) > 0:
                avg_price = receipt.subtotal / len(receipt.items)
                item.price_per_unit = avg_price
                item.total_price = avg_price * item.quantity
    
    # Recalculate subtotal
    receipt.subtotal = sum(item.total_price for item in receipt.items)
    
    return receipt


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def receipt_to_dict(receipt: ParsedReceipt) -> Dict[str, Any]:
    """Convert ParsedReceipt to dictionary for JSON serialization."""
    return {
        "merchant_name": receipt.merchant_name,
        "merchant_type": receipt.merchant_type,
        "merchant_location": receipt.merchant_location,
        "transaction_date": receipt.transaction_date,
        "items": [
            {
                "name": item.name,
                "canonical_name": item.canonical_name,
                "quantity": item.quantity,
                "price_per_unit": item.price_per_unit,
                "total_price": item.total_price,
                "category": item.category,
                "match_confidence": item.match_confidence
            }
            for item in receipt.items
        ],
        "subtotal": receipt.subtotal,
        "discount": receipt.discount,
        "total_amount": receipt.total_amount,
        "payment_method": receipt.payment_method,
        "confidence": receipt.confidence,
        "parse_method": receipt.parse_method,
        "raw_text": receipt.raw_text,
        "items_count": len(receipt.items)
    }
