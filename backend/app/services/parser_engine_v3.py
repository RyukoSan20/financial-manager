"""
Deterministic Receipt Parser Engine v3.0
4-Stage Modular Pipeline Architecture:

Stage 1: Text Normalization & Token Preprocessor
Stage 2: Fuzzy Boundary Detector (State Transition)
Stage 3: Multi-Line Buffered State Machine
Stage 4: Signed Math Validation & Confidence Recalibration
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Lazy import rapidfuzz only when needed
_rapidfuzz = None

def _get_rapidfuzz():
    global _rapidfuzz
    if _rapidfuzz is None:
        try:
            from rapidfuzz import fuzz
            _rapidfuzz = fuzz
        except ImportError:
            logger.warning("rapidfuzz not available, using fallback")
            _rapidfuzz = None
    return _rapidfuzz


# ============================================================
# STAGE 1: TEXT NORMALIZATION PREPROCESSOR
# ============================================================

def normalize_receipt_line(line: str) -> str:
    """
    Stage 1: Text Normalization & Token Preprocessor
    
    Cleans each line before parsing:
    1. Remove currency symbols (Rp, IDR)
    2. Remove thousand separators (,- suffix)
    3. Split multiplier operators (2x15000 -> 2 x 15000)
    4. Clean extra whitespace
    """
    if not line:
        return ""
    
    line = str(line).strip()
    
    # 1. Remove currency symbols
    line = re.sub(r'(?i)\b(rp|idr)\.?\s*', '', line)
    
    # 2. Remove thousand separator suffix (,- pattern at end)
    line = re.sub(r',\s*$', '', line)
    
    # 3. Split multiplier operators (2x15000 -> 2 x 15000, 2*5000 -> 2 * 5000)
    line = re.sub(r'(\d+)\s*([xX*])\s*(\d+)', r'\1 \2 \3', line)
    
    # 4. Clean extra whitespace
    line = re.sub(r'\s+', ' ', line).strip()
    
    return line


# ============================================================
# STAGE 2: FUZZY BOUNDARY DETECTOR
# ============================================================

FOOTER_KEYWORDS = ["TOTAL", "SUBTOTAL", "TUNAI", "CASH", "KEMBALI", "BAYAR", "CHANGE", "TAX", "PPN", "HARGA JUAL"]

def is_footer_boundary(line: str, threshold: float = 75.0) -> bool:
    """
    Stage 2: Fuzzy Boundary Detector
    
    Detects footer keywords using fuzzy matching to tolerate OCR typos.
    Examples: T0TAL, TOT4L, TUNA1 -> matched to TOTAL, TUNAI
    
    Returns True if line contains a footer keyword.
    """
    if not line:
        return False
    
    tokens = line.upper().split()
    fuzz = _get_rapidfuzz()
    
    for token in tokens:
        # Skip pure digit tokens (large numbers shouldn't trigger footer)
        if token.isdigit():
            continue
        
        # Remove non-alphanumeric characters from token
        clean_token = re.sub(r'[^A-Za-z]', '', token)
        if not clean_token:
            continue
        
        for keyword in FOOTER_KEYWORDS:
            clean_keyword = re.sub(r'[^A-Za-z]', '', keyword)
            
            if fuzz:
                # Use rapidfuzz for fuzzy matching
                score = fuzz.ratio(clean_token, clean_keyword)
                if score >= threshold:
                    return True
            else:
                # Fallback: exact match
                if clean_token == clean_keyword:
                    return True
    
    return False


# ============================================================
# STAGE 3: MULTI-LINE BUFFERED STATE MACHINE
# ============================================================

def parse_items_section(lines: List[str]) -> List[Dict[str, Any]]:
    """
    Stage 3: Multi-Line Buffered State Machine
    
    Parses items with pending_name_buffer for 2-line item format:
    - Line 1: Item name (no price) -> buffer it
    - Line 2: Quantity + Price -> combine with buffered name
    
    Handles:
    - Single-line items (name + price on same line)
    - 2-line items (name on line 1, price on line 2)
    - Multi-qty items (3 18000 or 3x18000)
    """
    items = []
    pending_name_buffer = []
    
    # Also track running sum for math validation
    running_sum = 0.0
    
    for raw_line in lines:
        # Apply Stage 1 normalization
        cleaned_line = normalize_receipt_line(raw_line)
        if not cleaned_line:
            continue
        
        # Skip separator lines
        if re.match(r'^[=\-*]{3,}$', cleaned_line):
            continue
        
        # Extract numbers (including negative for discounts)
        # Pattern: optional minus, digits, optional decimal/comma
        numbers_raw = re.findall(r'-?\d+[.,]?\d*', cleaned_line)
        numbers = []
        for n in numbers_raw:
            val = parse_number(n)
            if val != 0:
                numbers.append(val)
        
        # Extract text parts (alphabetic tokens only)
        text_tokens = re.findall(r'[a-zA-Z]+', cleaned_line)
        line_text = " ".join(text_tokens).strip()
        
        # ============================================================
        # CONDITION A: Line with NO numbers = Name-only line (buffer it)
        # ============================================================
        if len(numbers) == 0:
            if len(line_text) > 2:
                pending_name_buffer.append(line_text)
            continue
        
        # ============================================================
        # CONDITION B: Line has numbers = Price line
        # ============================================================
        
        # Parse price (rightmost number = total price, RTL)
        price = numbers[-1]  # RTL: rightmost = price
        
        # Skip negative prices (discounts), but allow negative for promo handling
        if price < 0:
            # Negative price = discount, skip adding as item but track it
            running_sum += price  # e.g., -1300
            pending_name_buffer.clear()
            continue
        
        # Parse quantity (leftmost reasonable number)
        qty = 1
        unit_price = price
        
        if len(numbers) >= 2:
            possible_qty = numbers[0]
            # Quantity should be reasonable: 1-99
            if 0 < possible_qty < 100 and price % possible_qty == 0:
                qty = int(possible_qty)
                unit_price = price / qty
        
        # Check for multiplier pattern (3 x 18000)
        mult_match = re.search(r'(\d+)\s*[xX*]\s*(\d+)', cleaned_line)
        if mult_match:
            qty = int(mult_match.group(1))
            unit_price = float(mult_match.group(2))
            price = qty * unit_price
        
        # Determine item name
        if len(line_text) > 2 and len(line_text) < 50:
            # Line has its own text = standalone item
            item_name = line_text
        elif pending_name_buffer:
            # Combine buffered name(s) with line text
            combined = " ".join(pending_name_buffer + [line_text])
            item_name = combined.strip()
        else:
            item_name = line_text if line_text else "UNKNOWN_ITEM"
        
        # Validate item
        if price >= 100 and item_name and item_name != "UNKNOWN_ITEM":
            items.append({
                "name": item_name,
                "qty": qty,
                "price": price,
                "unit_price": unit_price
            })
            running_sum += price
        
        # Clear buffer after item is created
        pending_name_buffer.clear()
    
    return items


def parse_number(num_str: str) -> float:
    """Parse Indonesian number format: 12.500 or 12,500 -> 12500"""
    if not num_str:
        return 0.0
    
    # Remove whitespace
    num_str = str(num_str).strip()
    
    # Handle negative
    is_negative = num_str.startswith('-')
    if is_negative:
        num_str = num_str[1:]
    
    # Remove thousand separators (dots in Indonesian format)
    # and convert decimal comma to dot
    if ',' in num_str and '.' in num_str:
        # Both present: last one is decimal
        if num_str.rfind(',') > num_str.rfind('.'):
            num_str = num_str.replace('.', '').replace(',', '.')
        else:
            num_str = num_str.replace(',', '')
    elif ',' in num_str:
        # Only comma: could be decimal or thousand sep
        # If comma is last 2-3 chars, it's decimal
        parts = num_str.split(',')
        if len(parts) == 2 and len(parts[1]) <= 2:
            num_str = num_str.replace(',', '.')
        else:
            num_str = num_str.replace(',', '')
    else:
        # No comma: just remove dots (thousand separators)
        num_str = num_str.replace('.', '')
    
    try:
        value = float(num_str)
        return -value if is_negative else value
    except ValueError:
        return 0.0


# ============================================================
# STAGE 4: SIGNED MATH VALIDATION & CONFIDENCE RECALIBRATION
# ============================================================

def calculate_confidence(items: List[Dict], parsed_total: Optional[float], 
                         subtotal: Optional[float] = None,
                         discount_total: float = 0.0,
                         has_date: bool = False,
                         merchant_found: bool = False) -> Tuple[float, Dict[str, Any]]:
    """
    Stage 4: Signed Math Validation & Confidence Recalibration
    
    Calculates confidence with proportional penalties instead of harsh cuts.
    Tolerates small rounding differences and tax.
    
    Returns: (confidence_score, debug_info)
    """
    score = 100.0
    penalties = []
    debug_info = {}
    
    # Base penalties
    if not items:
        penalties.append(("no_items", 30.0))
        return 0.0, {"reason": "no_items"}
    
    if not merchant_found:
        penalties.append(("no_merchant", 10.0))
    
    if not has_date:
        penalties.append(("no_date", 20.0))
    
    # Calculate item sum (use total_price)
    sum_items = sum(item.get("total_price", 0) for item in items)
    expected_total = subtotal - discount_total if subtotal else sum_items
    
    debug_info["item_sum"] = sum_items
    debug_info["expected_total"] = expected_total
    debug_info["discount"] = discount_total
    
    # Mathematical validation with tolerance
    if parsed_total is not None and parsed_total > 0:
        diff = abs(sum_items - parsed_total)
        
        if diff > 2.0:  # Allow small rounding error
            # Proportional penalty based on deviation
            percentage_err = (diff / parsed_total) * 100 if parsed_total > 0 else 100
            debug_info["diff"] = diff
            debug_info["percentage_err"] = percentage_err
            
            if percentage_err > 5.0:
                # Deviation > 5% = significant error
                penalties.append(("math_mismatch_5pct", 30.0))
            elif percentage_err > 1.0:
                # Deviation 1-5% = minor rounding/tax
                penalties.append(("math_mismatch_1pct", 10.0))
    else:
        penalties.append(("no_total_found", 20.0))
    
    # Apply penalties
    for reason, penalty in penalties:
        score -= penalty
    
    debug_info["penalties"] = penalties
    debug_info["final_score"] = max(0.0, score)
    
    return max(0.0, score), debug_info


# ============================================================
# MAIN PARSER CLASS
# ============================================================

class ReceiptParserV3:
    """
    Receipt Parser with 4-Stage Modular Pipeline:
    
    Stage 1: Text Normalization (clean Rp, multipliers)
    Stage 2: Fuzzy Boundary Detection (fuzz.ratio for typos)
    Stage 3: Multi-Line Buffered State Machine (name buffer)
    Stage 4: Signed Math Validation (proportional penalties)
    """
    
    def __init__(self):
        self.pending_name_buffer = []
        self.items = []
        self.footer_keywords = FOOTER_KEYWORDS
        
        # Merchant detection patterns
        self.merchant_patterns = [
            r'\b(INDOMARET)\b',
            r'\b(ALFAMART|ALFAGIFT)\b',
            r'\b(FAMILY\s*MART|FAMILYMART)\b',
            r'\b(LAWSON)\b',
            r'\b(MCDONALD|MCD)\b',
            r'\b(KFC)\b',
            r'\b(STARBUCKS)\b',
            r'\b(HOKBEN|HOKKI)\b',
            r'\b(BURGER\s*KING)\b',
            r'\b(PIZZA\s*HUT)\b',
            r'\b(GRAB)\b',
            r'\b(GOJEK|GOPAY)\b',
            r'\b(SHOPEE|TOKOPEDIA)\b',
            r'\b(BUKALAPAK)\b',
        ]
        
        # Date pattern
        self.date_pattern = re.compile(
            r'\b\d{2}[\.\/\-]\d{2}[\.\/\-]\d{2,4}\b|'
            r'\b\d{4}[\.\/\-]\d{2}[\.\/\-]\d{2}\b'
        )
        
        # Payment method patterns
        self.payment_patterns = {
            'GOPAY': r'\bGOP?\s?PAY?\b',
            'OVO': r'\bOVO\b',
            'DANA': r'\bDANA\b',
            'QRIS': r'\bQRIS\b',
            'CASH': r'\b(TUNAI|CASH)\b',
            'DEBIT': r'\b(DEBIT|CARD|VISA|MASTER)\b',
        }
    
    def parse(self, raw_lines: Any) -> Dict[str, Any]:
        """
        Main parse method using 4-stage pipeline.
        """
        # ============================================================
        # DEFAULT RESPONSE (Anti-crash)
        # ============================================================
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
        
        # Input validation
        if not raw_lines:
            return default_res
        
        # Normalize to list
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
            # ============================================================
            # PIPELINE VARIABLES
            # ============================================================
            items = []
            pending_name_buffer = []
            subtotal = 0.0
            discount_total = 0.0
            total = 0.0
            merchant_name = "Unknown Merchant"
            payment_method = "Cash"
            extracted_date = None
            state = "HEADER"
            state_transitions = []
            
            # ============================================================
            # PIPELINE STAGE 1 & 2: SCAN ALL LINES
            # ============================================================
            
            full_text = " ".join(lines)
            
            # Detect merchant (global scan)
            for pattern in self.merchant_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    merchant_name = match.group(1).title()
                    break
            
            # Extract date
            date_match = self.date_pattern.search(full_text)
            if date_match:
                extracted_date = date_match.group(0)
            
            # ============================================================
            # PIPELINE STAGE 3: STATE MACHINE WITH MULTI-LINE BUFFER
            # ============================================================
            
            for idx, raw_line in enumerate(lines):
                line = raw_line.strip()
                if not line:
                    continue
                
                # Stage 1: Normalize
                normalized = normalize_receipt_line(line)
                upper_line = normalized.upper()
                
                # ============================================================
                # STATE: HEADER
                # ============================================================
                if state == "HEADER":
                    # Look for date
                    if not extracted_date:
                        date_m = self.date_pattern.search(normalized)
                        if date_m:
                            extracted_date = date_m.group(0)
                    
                    # Check if separator -> transition to ITEMS
                    if re.match(r'^[=\-*]{3,}$', normalized):
                        state = "ITEMS"
                        state_transitions.append(f"L{idx+1}: HEADER -> ITEMS (separator)")
                        pending_name_buffer.clear()
                        continue
                    
                    # Check if footer boundary -> transition to FOOTER
                    if is_footer_boundary(normalized):
                        state = "FOOTER"
                        state_transitions.append(f"L{idx+1}: HEADER -> FOOTER ({normalized[:30]})")
                        pending_name_buffer.clear()
                    
                    # Check if this line looks like an item (has numbers + text)
                    else:
                        has_numbers = bool(re.search(r'\d', normalized))
                        has_text = bool(re.search(r'[a-zA-Z]', normalized))
                        if has_numbers and has_text:
                            state = "ITEMS"
                            state_transitions.append(f"L{idx+1}: HEADER -> ITEMS (item)")
                            # Don't continue - process this line as item
                
                # ============================================================
                # STATE: ITEMS
                # ============================================================
                if state == "ITEMS":
                    # Check for separator -> transition to FOOTER
                    if re.match(r'^[=\-*]{3,}$', normalized):
                        state = "FOOTER"
                        state_transitions.append(f"L{idx+1}: ITEMS -> FOOTER (separator)")
                        pending_name_buffer.clear()
                        continue
                    
                    # Check for footer boundary (Stage 2: Fuzzy)
                    if is_footer_boundary(normalized):
                        state = "FOOTER"
                        state_transitions.append(f"L{idx+1}: ITEMS -> FOOTER ({normalized[:30]})")
                        pending_name_buffer.clear()
                        continue
                    
                    # Skip if now in FOOTER state
                    if state == "FOOTER":
                        continue
                    
                    # Extract numbers using segment-based approach
                    segments = normalized.split()
                    numbers = []
                    has_number = False
                    
                    for seg in segments:
                        clean_seg = seg.replace(',', '').replace('.', '')
                        if clean_seg.isdigit() and clean_seg:
                            val = parse_number(clean_seg)
                            if val != 0:
                                numbers.append(val)
                                has_number = True
                    
                    # Extract text (alphabetic tokens, preserving slashes for S/, M/, etc.)
                    # But EXCLUDE segments that are mixed with numbers (like "72G")
                    text_tokens = []
                    for seg in segments:
                        # Only add if segment has ONLY letters (and slashes)
                        clean_seg = re.sub(r'[^a-zA-Z/]', '', seg)
                        if clean_seg and not any(c.isdigit() for c in seg):
                            text_tokens.append(clean_seg)
                    line_text = " ".join(text_tokens).strip()
                    
                    # Check for discount
                    if any(kw in upper_line for kw in ['DISKON', 'POTONGAN', 'HEMAT', 'PROMO', 'ANDA']):
                        if numbers:
                            disc = abs(numbers[-1])
                            if 0 < disc < 1000000:
                                discount_total += disc
                                continue
                    
                    # Multi-line buffer logic (Stage 3)
                    if not numbers:
                        # Line has NO numbers = name buffer
                        if line_text and len(line_text) > 2:
                            pending_name_buffer.append(line_text)
                    else:
                        # Line HAS numbers = price line
                        price = numbers[-1]
                        
                        # Skip negative prices
                        if price < 0:
                            discount_total += abs(price)
                            pending_name_buffer.clear()
                            continue
                        
                        # Determine qty
                        qty = 1
                        unit_price = price
                        
                        if len(numbers) >= 2:
                            possible_qty = numbers[0]
                            if 0 < possible_qty < 100 and price % possible_qty == 0:
                                qty = int(possible_qty)
                                unit_price = price / qty
                        
                        # Check multiplier pattern
                        mult_match = re.search(r'(\d+)\s*[xX*]\s*(\d+)', normalized)
                        if mult_match:
                            qty = int(mult_match.group(1))
                            unit_price = float(mult_match.group(2))
                            price = qty * unit_price
                        
                        # Build item name
                        if line_text and 2 < len(line_text) < 50:
                            item_name = line_text
                        elif pending_name_buffer:
                            item_name = " ".join(pending_name_buffer)
                        else:
                            item_name = "UNKNOWN"
                        
                        if price >= 100 and item_name != "UNKNOWN":
                            items.append({
                                "name": item_name,
                                "quantity": qty,
                                "price_per_unit": unit_price,
                                "total_price": price
                            })
                        
                        pending_name_buffer.clear()
                
                # ============================================================
                # STATE: FOOTER
                # ============================================================
                elif state == "FOOTER":
                    upper = normalized.upper()
                    
                    # Check for discount in footer too
                    if any(kw in upper for kw in ['DISKON', 'POTONGAN', 'HEMAT', 'PROMO', 'ANDA']):
                        nums = re.findall(r'\d+[.,]?\d*', normalized)
                        if nums:
                            disc = abs(parse_number(nums[-1]))
                            if 0 < disc < 1000000:
                                discount_total += disc
                                continue
                    
                    # Extract subtotal
                    if ('HARGA JUAL' in upper_line or 'SUBTOTAL' in upper_line) and subtotal == 0:
                        nums = re.findall(r'\d+[.,]?\d*', normalized)
                        if nums:
                            subtotal = parse_number(nums[-1])
                    
                    # Extract total
                    if 'TOTAL' in upper_line and 'SUBTOTAL' not in upper_line and 'HARGA' not in upper_line:
                        if total == 0:
                            nums = re.findall(r'\d+[.,]?\d*', normalized)
                            if nums:
                                total = parse_number(nums[-1])
                    
                    # Detect payment method
                    for method, pattern in self.payment_patterns.items():
                        if re.search(pattern, upper_line):
                            payment_method = method
                            break
            
            # ============================================================
            # PIPELINE STAGE 4: MATH VALIDATION & CONFIDENCE
            # ============================================================
            
            # If no subtotal found, use sum of items
            if subtotal == 0 and items:
                subtotal = sum(item["total_price"] for item in items)
            
            # If no total found, calculate: subtotal - discount
            if total == 0:
                total = subtotal - discount_total
            
            # Calculate confidence (Stage 4)
            confidence, conf_debug = calculate_confidence(
                items=items,
                parsed_total=total,
                subtotal=subtotal,
                discount_total=discount_total,
                has_date=bool(extracted_date),
                merchant_found=merchant_name != "Unknown Merchant"
            )
            
            return {
                "merchant_name": merchant_name,
                "amount": round(abs(total), 0),
                "date": extracted_date,
                "payment_method": payment_method,
                "subtotal": round(subtotal, 0),
                "discount_total": round(discount_total, 0),
                "items": items,
                "items_count": len(items),
                "confidence_score": round(confidence, 1),
                "raw_debug": {
                    "state_transitions": state_transitions,
                    "confidence_debug": conf_debug,
                    "pipeline_stage": "v3.0"
                }
            }
            
        except Exception as e:
            logger.error(f"Parser v3 error: {e}", exc_info=True)
            return default_res


def parse_receipt_text_v3(raw_lines: Any) -> Dict[str, Any]:
    """Entry point for v3 parser."""
    parser = ReceiptParserV3()
    return parser.parse(raw_lines)


def should_use_gemini_fallback_v3(result: Dict[str, Any], raw_text_length: int = 0) -> Tuple[bool, str]:
    """
    Determine if Gemini Vision AI fallback should be used.
    
    Triggers:
    - raw_text_length < 10
    - confidence_score < 60
    - items_count == 0
    - total_final == 0
    """
    if raw_text_length < 10:
        return True, "Raw text too short"
    
    if result.get('confidence_score', 0) < 60:
        return True, f"Low confidence: {result.get('confidence_score', 0)}"
    
    if result.get('items_count', 0) == 0:
        return True, "No items detected"
    
    if result.get('amount', 0) == 0:
        return True, "Total is zero"
    
    return False, "Parser succeeded"
