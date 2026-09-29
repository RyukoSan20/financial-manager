"""
Parser v3.1 - Critical Fixes for Indonesian Receipt Format
- Single-line item parsing with Qty, Unit Price, Total columns
- Parentheses discount handling: (1,300) -> -1300
- Full-text merchant search
- Tightened Gemini fallback triggers
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Lazy import rapidfuzz
_rapidfuzz = None

def _get_rapidfuzz():
    global _rapidfuzz
    if _rapidfuzz is None:
        try:
            from rapidfuzz import fuzz
            _rapidfuzz = fuzz
        except ImportError:
            _rapidfuzz = None
    return _rapidfuzz


# ============================================================
# STAGE 1: NORMALIZATION
# ============================================================

def normalize_receipt_line(line: str) -> str:
    """Clean receipt line - remove Rp, normalize spaces."""
    if not line:
        return ""
    line = str(line).strip()
    # Remove currency prefix
    line = re.sub(r'(?i)\b(rp|idr)\.?\s*', '', line)
    return re.sub(r'\s+', ' ', line).strip()


def parse_number_indonesia(val_str: str) -> float:
    """
    Parse Indonesian number format handling:
    - Thousand separators: 18.000 -> 18000
    - Decimal: 35.200 -> 35200
    - Discount parentheses: (1,300) -> -1300 or (1) -> -1
    """
    if not val_str:
        return 0.0
    
    val_str = str(val_str).strip()
    
    # Check for discount parentheses (negative)
    is_negative = '(' in val_str and ')' in val_str
    
    # Remove parentheses and commas
    clean = val_str.replace('(', '').replace(')', '').replace(',', '').replace('.', '')
    
    # Extract digits
    digits = re.sub(r'[^\d]', '', clean)
    
    if not digits:
        return 0.0
    
    value = float(digits)
    return -value if is_negative else value


# ============================================================
# STAGE 2: FUZZY BOUNDARY
# ============================================================

FOOTER_KEYWORDS = ["TOTAL", "SUBTOTAL", "TUNAI", "CASH", "KEMBALI", "BAYAR", "CHANGE", "TAX", "PPN", "HARGA JUAL"]

def is_footer_boundary(line: str, threshold: float = 75.0) -> bool:
    """Fuzzy footer detection with typo tolerance."""
    if not line:
        return False
    
    tokens = line.upper().split()
    fuzz = _get_rapidfuzz()
    
    for token in tokens:
        # Skip pure digits
        if token.isdigit():
            continue
        # Clean token
        clean_token = re.sub(r'[^A-Za-z]', '', token)
        if not clean_token:
            continue
        
        for keyword in FOOTER_KEYWORDS:
            clean_kw = re.sub(r'[^A-Za-z]', '', keyword)
            if fuzz:
                if fuzz.ratio(clean_token, clean_kw) >= threshold:
                    return True
            else:
                if clean_token == clean_kw:
                    return True
    return False


# ============================================================
# MERCHANT DETECTION (Full-text search)
# ============================================================

MERCHANT_PATTERNS = [
    (r'\b(INDOMARET|INDOMARCO)\b', "Indomaret"),
    (r'\b(ALFAMART|ALFAGIFT|SATRIA\s*ANTARA)\b', "Alfamart"),
    (r'\b(FAMILY\s*MART|FAMILYMART)\b', "Family Mart"),
    (r'\b(LAWSON)\b', "Lawson"),
    (r'\b(MCDONALD|MCD)\b', "McDonald's"),
    (r'\b(KFC)\b', "KFC"),
    (r'\b(STARBUCKS)\b', "Starbucks"),
    (r'\b(HOKBEN|HOKKI)\b', "HokBen"),
    (r'\b(BURGER\s*KING)\b', "Burger King"),
    (r'\b(PIZZA\s*HUT)\b', "Pizza Hut"),
    (r'\b(GRAB)\b', "Grab"),
    (r'\b(GOJEK|GOPAY)\b', "Gojek"),
    (r'\b(TOKOPEDIA|TOKO\s*PEDIA)\b', "Tokopedia"),
    (r'\b(SHOPEE)\b', "Shopee"),
]

def detect_merchant(full_text: str) -> str:
    """
    Detect merchant from FULL receipt text (not just top lines).
    Search entire receipt including footer.
    """
    upper_text = full_text.upper()
    
    for pattern, name in MERCHANT_PATTERNS:
        if re.search(pattern, upper_text, re.IGNORECASE):
            return name
    
    return "Unknown Merchant"


# ============================================================
# STAGE 3: SINGLE-LINE ITEM PARSING
# ============================================================

def parse_single_line_item(line: str) -> Optional[Dict[str, Any]]:
    """
    Parse single-line item with format:
    S/ROTI KRIM KEJU 72G 4 4500 18,000
    CIMORY MIX BERRY 225 1 8500 8,500
    
    Pattern: [NAME] [UNIT] QTY UNIT_PRICE TOTAL
    """
    # Normalize
    cleaned = normalize_receipt_line(line)
    if not cleaned:
        return None
    
    # Split by whitespace
    parts = cleaned.split()
    if len(parts) < 2:
        return None
    
    # Find where numbers start (from the right)
    numeric_parts = []
    text_parts = []
    
    for part in reversed(parts):
        # Check if this part is a number (possibly with comma)
        clean_part = part.replace(',', '')
        if clean_part.replace('-', '').isdigit():
            numeric_parts.append(part)
        else:
            text_parts.append(part)
    
    # Reverse to get left-to-right order
    numeric_parts.reverse()  # Now: [first_num, ..., last_num]
    text_parts.reverse()     # Now: [first_text, ..., last_text]
    
    # Need at least 2 numbers (unit_price + total, or qty + total)
    if len(numeric_parts) < 2:
        # Check if this is just a name-only line (buffer it)
        return None
    
    # Parse numbers
    numbers = [parse_number_indonesia(n) for n in numeric_parts]
    
    # Determine: is there a unit price?
    # Typical Indonesian receipt: NAME UNIT QTY UNIT_PRICE TOTAL
    # e.g., "S/ROTI KRIM KEJU 72G 4 4500 18,000"
    # parts: ["S/ROTI", "KRIM", "KEJU", "72G", "4", "4500", "18,000"]
    
    total_price = numbers[-1]  # Rightmost = total
    
    # Skip if total is negative (discount)
    if total_price < 0:
        return None
    
    # Try to detect qty
    qty = 1
    unit_price = total_price
    
    if len(numbers) >= 3:
        # Likely: qty, unit_price, total
        possible_qty = numbers[0]
        possible_unit = numbers[1]
        
        # Check if first number is reasonable qty (<= 10 or divides evenly)
        if 0 < possible_qty <= 10:
            qty = int(possible_qty)
            unit_price = possible_unit if possible_unit > 0 else total_price
        elif len(numeric_parts) >= 2:
            # Maybe: unit_price, total
            unit_price = numbers[0]
            qty = 1
    
    elif len(numbers) == 2:
        # Could be: qty + total OR unit_price + total
        if numbers[0] <= 10 and total_price % numbers[0] == 0:
            qty = int(numbers[0])
            unit_price = total_price / qty
        else:
            unit_price = numbers[0]
            qty = 1
    
    # Build item name from text parts
    # Exclude any text that looks like unit (ends with G, ML, etc.) or is just a few chars
    name_parts = []
    for part in text_parts:
        # Skip single chars, numbers embedded, common units
        if len(part) <= 1:
            continue
        # Skip pure digits (already handled)
        if part.replace('-', '').isdigit():
            continue
        name_parts.append(part)
    
    item_name = ' '.join(name_parts) if name_parts else ' '.join(text_parts)
    
    # Validate
    if total_price < 100 or not item_name:
        return None
    
    return {
        "name": item_name,
        "quantity": qty,
        "price_per_unit": unit_price,
        "total_price": total_price,
        "raw_numbers": numeric_parts
    }


def parse_discount_line(line: str) -> Optional[float]:
    """Parse discount line like 'DISKON FRISIAN FLAG : (1,300)'"""
    cleaned = normalize_receipt_line(line)
    upper = cleaned.upper()
    
    discount_keywords = ['DISKON', 'POTONGAN', 'HEMAT', 'PROMO', 'ANDA']
    
    for kw in discount_keywords:
        if kw in upper:
            # Find number in parentheses or after colon
            match = re.search(r'\(?\s*([\d,.]+)\s*\)?', cleaned)
            if match:
                return abs(parse_number_indonesia(match.group(1)))
    
    return None


# ============================================================
# DATE EXTRACTION
# ============================================================

DATE_PATTERNS = [
    r'\b(\d{2})[\.\/\-](\d{2})[\.\/\-](\d{2,4})\b',  # DD.MM.YY or DD/MM/YYYY
    r'\b(\d{4})[\.\/\-](\d{2})[\.\/\-](\d{2})\b',    # YYYY.MM.DD
]

def extract_date(text: str) -> Optional[str]:
    """Extract date from receipt text."""
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()
            # Normalize format
            if len(groups[2]) == 2:
                return f"{groups[0]}.{groups[1]}.{groups[2]}"
            else:
                return f"{groups[0]}.{groups[1]}.{groups[2][-2:]}"
    return None


# ============================================================
# MAIN PARSER CLASS
# ============================================================

class ReceiptParserV31:
    """
    Receipt Parser v3.1 with fixes:
    - Single-line item parsing
    - Parentheses discount handling
    - Full-text merchant detection
    - Tightened fallback triggers
    """
    
    def parse(self, raw_lines: Any) -> Dict[str, Any]:
        """Parse receipt with 4-stage pipeline."""
        
        default_res = {
            "merchant_name": "Unknown Merchant",
            "amount": 0.0,
            "date": None,
            "payment_method": "Cash",
            "subtotal": 0.0,
            "discount_total": 0.0,
            "items": [],
            "items_count": 0,
            "confidence_score": 0.0,
            "raw_debug": {}
        }
        
        # Normalize input
        if not raw_lines:
            return default_res
        
        try:
            if isinstance(raw_lines, str):
                lines = [l.strip() for l in raw_lines.split('\n') if l.strip()]
            elif isinstance(raw_lines, (list, tuple)):
                lines = [str(l).strip() for l in raw_lines if l]
            else:
                lines = []
        except:
            return default_res
        
        if not lines:
            return default_res
        
        try:
            items = []
            subtotal = 0.0
            discount_total = 0.0
            total = 0.0
            payment_method = "Cash"
            state = "HEADER"
            state_transitions = []
            
            full_text = ' '.join(lines)
            
            # Stage 1: Detect merchant from FULL text
            merchant_name = detect_merchant(full_text)
            
            # Extract date
            extracted_date = extract_date(full_text)
            
            # Stage 2 & 3: Process lines
            for idx, line in enumerate(lines):
                cleaned = normalize_receipt_line(line)
                if not cleaned:
                    continue
                
                upper = cleaned.upper()
                
                # Check separator (first = end header, subsequent = end items/start footer)
                if re.match(r'^[=\-*]{3,}$', cleaned):
                    if state == "HEADER":
                        state = "ITEMS"
                        state_transitions.append(f"L{idx+1}: SEPARATOR -> ITEMS")
                    elif state == "ITEMS":
                        state = "FOOTER"
                        state_transitions.append(f"L{idx+1}: SEPARATOR -> FOOTER")
                    continue
                
                # Check footer trigger
                if is_footer_boundary(cleaned):
                    if state != "FOOTER":
                        state = "FOOTER"
                        state_transitions.append(f"L{idx+1}: FOOTER ({cleaned[:30]})")
                
                # Process based on state
                if state == "HEADER":
                    # Look for date
                    if not extracted_date:
                        extracted_date = extract_date(cleaned)
                    
                    # If line has date pattern AND numbers like resi/time, stay in HEADER
                    # Only transition to ITEMS on separator or clear item line
                    has_text = bool(re.search(r'[A-Za-z]{4,}', cleaned))  # At least 4 letters
                    has_multiple_numbers = len(re.findall(r'\d{3,}', cleaned)) >= 2  # Multiple 3+ digit numbers
                    
                    # Stay in HEADER if this is likely metadata (date + resi + time)
                    if extracted_date and has_multiple_numbers and not has_text:
                        # This is likely a date/transaksi line, skip
                        continue
                    
                    if has_text and has_multiple_numbers:
                        # Line with product name and prices
                        state = "ITEMS"
                        state_transitions.append(f"L{idx+1}: HEADER -> ITEMS")
                
                elif state == "ITEMS":
                    # Skip if now in FOOTER
                    if state == "FOOTER":
                        continue
                    
                    # Check for footer trigger
                    if is_footer_boundary(cleaned):
                        state = "FOOTER"
                        state_transitions.append(f"L{idx+1}: ITEMS -> FOOTER")
                        continue
                    
                    # Try discount parsing first
                    disc = parse_discount_line(cleaned)
                    if disc and disc > 0:
                        discount_total += disc
                        continue
                    
                    # Try single-line item parsing
                    item = parse_single_line_item(cleaned)
                    if item and item['total_price'] >= 100:
                        items.append({
                            "name": item['name'],
                            "quantity": item['quantity'],
                            "price_per_unit": item['price_per_unit'],
                            "total_price": item['total_price']
                        })
                
                elif state == "FOOTER":
                    upper = cleaned.upper()
                    
                    # Check discount
                    disc = parse_discount_line(cleaned)
                    if disc and disc > 0:
                        discount_total += disc
                        continue
                    
                    # Extract subtotal
                    if ('HARGA JUAL' in upper or 'SUBTOTAL' in upper) and subtotal == 0:
                        nums = re.findall(r'[\d,.]+', cleaned)
                        if nums:
                            subtotal = parse_number_indonesia(nums[-1])
                    
                    # Extract total
                    if 'TOTAL' in upper and 'SUBTOTAL' not in upper and 'HARGA' not in upper:
                        if total == 0:
                            nums = re.findall(r'[\d,.]+', cleaned)
                            if nums:
                                total = parse_number_indonesia(nums[-1])
                    
                    # Detect payment
                    if 'GOPAY' in upper:
                        payment_method = "GoPay"
                    elif 'OVO' in upper:
                        payment_method = "OVO"
                    elif 'DANA' in upper:
                        payment_method = "DANA"
                    elif 'QRIS' in upper:
                        payment_method = "QRIS"
                    elif 'TUNAI' in upper or 'CASH' in upper:
                        payment_method = "Cash"
                    elif 'DEBIT' in upper or 'CARD' in upper:
                        payment_method = "Debit"
            
            # Stage 4: Math Validation & Confidence
            item_sum = sum(item['total_price'] for item in items)
            
            # Reconcile subtotal
            if subtotal == 0:
                subtotal = item_sum
            
            # Calculate total
            if total == 0:
                total = subtotal - discount_total
            
            # Confidence calculation
            confidence = 100.0
            
            if not items:
                confidence -= 30
            if total == 0:
                confidence -= 30
            if abs(item_sum - total) > 100 and total > 0:
                confidence -= 20
            if not extracted_date:
                confidence -= 10
            
            return {
                "merchant_name": merchant_name,
                "amount": round(abs(total), 0),
                "date": extracted_date,
                "payment_method": payment_method,
                "subtotal": round(subtotal, 0),
                "discount_total": round(discount_total, 0),
                "items": items,
                "items_count": len(items),
                "confidence_score": max(0.0, confidence),
                "raw_debug": {
                    "state_transitions": state_transitions,
                    "item_sum": item_sum
                }
            }
            
        except Exception as e:
            logger.error(f"Parser v3.1 error: {e}", exc_info=True)
            return default_res


def parse_receipt_text_v31(raw_lines: Any) -> Dict[str, Any]:
    """Entry point for v3.1 parser."""
    parser = ReceiptParserV31()
    return parser.parse(raw_lines)


def should_use_gemini_fallback_v31(result: Dict[str, Any], raw_text_length: int = 0) -> Tuple[bool, str]:
    """
    Determine if Gemini Vision AI fallback should be used.
    
    TRIGGER if ANY of:
    - raw_text_length < 10
    - confidence < 50
    - items_count == 0 AND amount == 0
    - amount == 0 (even if items exist)
    """
    if raw_text_length < 10:
        return True, "Raw text too short"
    
    conf = result.get('confidence_score', 0)
    if conf < 50:
        return True, f"Low confidence: {conf}"
    
    items_count = result.get('items_count', 0)
    amount = result.get('amount', 0)
    
    # If no items AND no amount = failure
    if items_count == 0 and amount == 0:
        return True, "No items and no amount detected"
    
    # If amount is 0 even though items exist
    if amount == 0 and items_count > 0:
        return True, "Items detected but total is zero"
    
    # If total mismatch is too high
    item_sum = result.get('raw_debug', {}).get('item_sum', 0)
    if item_sum > 0 and amount == 0:
        return True, "Total should be calculated from items"
    
    return False, "Parser succeeded"
