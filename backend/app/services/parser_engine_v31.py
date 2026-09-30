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
    """Clean receipt line - remove Rp, normalize spaces, fix thousand separators."""
    if not line:
        return ""
    line = str(line).strip()
    # Remove currency prefix
    line = re.sub(r'(?i)\b(rp|idr)\.?\s*', '', line)
    
    # Fix thousand separator: "18 000" -> "18000", "33 900" -> "33900", "5 200" -> "5200"
    # Generic pattern: 1-3 digits + space + exactly 3 digits -> merge them
    line = re.sub(r'(\b\d{1,3})\s+(\d{3}\b)', r'\1\2', line)
    
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
    Parse single-line item with RIGHT-TO-LEFT number extraction:
    S/ROTI KRIM KEJU 72G 4 4500 18,000
    CIMORY MIX BERRY 225ML 1 8500 8,500
    PLASTIK SDG 1 1 1
    
    Rule: RIGHTMOST numbers are ALWAYS [qty, unit_price, total]
          Everything LEFT is the product name
    """
    # Normalize
    cleaned = normalize_receipt_line(line)
    if not cleaned:
        return None
    
    # BLACKLIST: Skip summary/footer lines
    upper_clean = cleaned.upper()
    blacklist = ['HARGA JUAL', 'TOTAL', 'TUNAI', 'KEMBALI', 'ANDA HEMAT', 
                 'DISKON', 'BAYAR', 'TAGIHAN', 'SALDO', 'REF ']
    for kw in blacklist:
        if kw in upper_clean:
            return None
    
    # Split by whitespace
    parts = cleaned.split()
    if len(parts) < 2:
        return None
    
    # RIGHT-TO-LEFT: Extract numbers from RIGHT side only
    # Numbers embedded in product names (like "72G", "225ML") are on the LEFT
    numeric_parts = []
    text_parts = []
    
    for part in reversed(parts):
        clean_part = part.replace(',', '')
        if clean_part.replace('-', '').isdigit():
            numeric_parts.append(part)
        else:
            text_parts.append(part)
    
    # Reverse back to correct order
    numeric_parts.reverse()  # Now: [qty?, unit_price?, total]
    text_parts.reverse()      # Now: [name words in order]
    
    # Need at least 1 number (price 1 for plastic bags)
    if len(numeric_parts) < 1:
        return None
    
    # Parse numbers from RIGHT
    numbers = [parse_number_indonesia(n) for n in numeric_parts]
    
    # Single number item (e.g., "PLASTIK SDG 1")
    if len(numeric_parts) == 1:
        name = " ".join(text_parts) if text_parts else "Item"
        return {
            "name": name,
            "quantity": 1,
            "price_per_unit": numbers[0],
            "total_price": numbers[0]
        }
    
    # RIGHT-TO-LEFT assignment:
    # numbers[-1] = total_price (rightmost)
    # numbers[-2] = price_per_unit (second from right)
    # numbers[-3] = quantity (third from right) - if reasonable
    total_price = numbers[-1]
    
    # Skip negative (discounts)
    if total_price < 0:
        return None
    
    # Detect qty and unit_price from right side
    qty = 1
    unit_price = total_price
    
    if len(numbers) >= 3:
        # Third from right = quantity (must be small, like 1-20)
        third_num = numbers[-3]
        second_num = numbers[-2]
        
        # If third number looks like quantity (1-20), use it
        if 0 < third_num <= 20 and second_num >= 100:
            qty = int(third_num)
            unit_price = second_num
    elif len(numbers) == 2:
        second_num = numbers[-2]
        if second_num <= 10 and total_price % second_num == 0 and second_num > 0:
            qty = int(second_num)
            unit_price = total_price / qty
        elif second_num >= 100:
            unit_price = second_num
    
    # Everything left (text_parts) is the product name
    name_parts = [p for p in text_parts if len(p) > 0]
    item_name = " ".join(name_parts)
    
    if total_price < 1 or not item_name:
        return None
    
    return {
        "name": item_name,
        "quantity": qty,
        "price_per_unit": unit_price,
        "total_price": total_price
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
    """Extract date from receipt text. Returns ISO format YYYY-MM-DD."""
    from datetime import datetime
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()
            try:
                day = int(groups[0])
                month = int(groups[1])
                raw_year = int(groups[2])
                
                # Convert 2-digit year
                if raw_year < 100:
                    year = 2000 + raw_year
                else:
                    year = raw_year
                
                # Validate date is reasonable (not in far future)
                dt = datetime(year, month, day)
                return dt.strftime('%Y-%m-%d')
            except (ValueError, IndexError):
                pass
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
                    # Accept all items, even price 1 (e.g., plastic bag)
                    if item and item['total_price'] >= 1:
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
