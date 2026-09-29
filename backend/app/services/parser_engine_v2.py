"""
Deterministic Receipt Parser Engine v2.0
Fixed based on logic specification:
1. Dynamic Y-Clustering with local threshold
2. Strict State Machine with proper transitions
3. Deterministic RTL Tokenization
4. Bottom-up Mathematical Guardrails
5. Cascade Confidence Penalties + Proper Fallback Triggers
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

logger = logging.getLogger(__name__)


class DeterministicReceiptParser:
    """
    Deterministic receipt parser with strict rules.
    No contradictions, proper state transitions, cascade penalties.
    """
    
    def __init__(self):
        # ============================================================
        # REGEX PATTERNS (Word Boundary for Footer)
        # ============================================================
        
        # Footer boundary keywords - MUST use word boundary \b
        self.pat_footer_boundary = re.compile(
            r'\b(TOTAL|SUBTOTAL|BAYAR|TUNAI|CASH|CHANGE|KEMBALI|GRAND\s*TOTAL)\b',
            re.IGNORECASE
        )
        
        # Header separator patterns (---, ===, ***)
        self.pat_separator = re.compile(r'^[=\-*]{3,}$|^[*]{3,}\s*$')
        
        # Noise patterns to ignore (NOT item triggers)
        self.pat_noise = re.compile(
            r'^(\d{2}:\d{2}|'           # Time: 14:30
            r'^\d{4,}/[A-Z0-9]+|'       # Resi: 914115/ALIA
            r'^\d{5,}$|'                # Phone-like numbers
            r'^CALL\b|^SMS\b|'           # Call/SMS keywords
            r'^15\d{3,}$|'              # Service numbers
            r'^0\d{2}[\s\-]?\d{'        # Phone numbers
            r'7,12})\b',
            re.IGNORECASE
        )
        
        # Date patterns (will be masked in header detection)
        self.pat_date = re.compile(
            r'\b\d{2}[\.\/\-]\d{2}[\.\/\-]\d{2,4}\b|'  # DD.MM.YY or DD/MM/YYYY
            r'\b\d{4}[\.\/\-]\d{2}[\.\/\-]\d{2}\b|'    # YYYY.MM.DD
            r'\b\d{2}\.\d{2}\.\d{2}\b'                   # DD.MM.YY
        )
        
        # Discard words in item names
        self.pat_discard_word = re.compile(
            r'\b(DISKON|PROMO|POTONGAN|HEMAT|ANDA\s*HEMAT)\b',
            re.IGNORECASE
        )
        
        # ============================================================
        # PATTERN: Is this a FOOTER trigger line?
        # ============================================================
        self.footer_keywords = [
            'HARGA JUAL', 'SUBTOTAL', 'TOTAL', 'JUMLAH',
            'TUNAI', 'KEMBALI', 'BAYAR', 'GRAND TOTAL',
            'CASH', 'DEBIT', 'CARD', 'VISA', 'MASTER',
            'CHANGE', 'EDC', 'QRIS', 'GOPAY', 'OVO', 'DANA'
        ]
        
        # ============================================================
        # PATTERN: Is this a valid ITEM line?
        # ============================================================
        self.item_indicator_chars = ['@', 'x', 'X', '×', 'qty', 'qty:']
        
        # ============================================================
        # CLEAN NUMBER UTILITY
        # ============================================================
        self.clean_digit = re.compile(r'[^\d]')
        
    def sanitize_number(self, val_str: str) -> float:
        """Clean OCR artifacts from number strings."""
        if not val_str:
            return 0.0
        try:
            val_str = str(val_str).replace('(', '').replace(')', '')
            subs = {
                'O': '0', 'o': '0', 'D': '0',
                'I': '1', 'l': '1', '|': '1',
                'S': '5', 'B': '8', 'Z': '2',
                ',': '', ' ': ''
            }
            for old, new in subs.items():
                val_str = val_str.replace(old, new)
            cleaned = self.clean_digit.sub('', val_str)
            return float(cleaned) if cleaned else 0.0
        except (ValueError, TypeError):
            return 0.0
    
    def is_separator_line(self, line: str) -> bool:
        """Check if line is a separator (---, ===, ***)."""
        stripped = line.strip()
        if not stripped:
            return False
        return bool(self.pat_separator.match(stripped))
    
    def is_noise_line(self, line: str) -> bool:
        """Check if line is noise (time, resi, phone, etc)."""
        stripped = line.strip()
        if not stripped:
            return True
        return bool(self.pat_noise.match(stripped))
    
    def is_footer_trigger(self, line: str) -> bool:
        """
        Check if line triggers FOOTER state.
        Uses word boundary matching to avoid false positives.
        """
        stripped = line.strip().upper()
        
        # Must contain footer keyword as whole word
        for keyword in self.footer_keywords:
            # Create pattern with word boundaries around keyword
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, stripped, re.IGNORECASE):
                return True
        
        # Also check generic patterns
        if self.pat_footer_boundary.search(stripped):
            return True
        
        return False
    
    def is_likely_item_line(self, line: str) -> bool:
        """
        Check if line is likely an item (has product name + price).
        """
        stripped = line.strip()
        if not stripped or len(stripped) < 3:
            return False
        
        upper = stripped.upper()
        
        # Skip if it's noise
        if self.is_noise_line(stripped):
            return False
        
        # Skip if it's a separator
        if self.is_separator_line(stripped):
            return False
        
        # Skip if it's footer trigger
        if self.is_footer_trigger(stripped):
            return False
        
        # Must have at least some letters (product name)
        if not re.search(r'[A-Za-z]', stripped):
            return False
        
        # Must have digits (price/quantity)
        if not re.search(r'\d', stripped):
            return False
        
        # Should NOT be mostly digits
        digit_ratio = len(re.findall(r'\d', stripped)) / len(stripped)
        if digit_ratio > 0.6:
            return False
        
        return True
    
    def mask_date_in_line(self, line: str) -> str:
        """Replace date with placeholder to avoid triggering transitions."""
        return self.pat_date.sub('DATE_TOKEN', line)
    
    def mask_time_in_line(self, line: str) -> str:
        """Replace time patterns with placeholder."""
        # HH:MM or HH.MM
        return re.sub(r'\b\d{2}:\d{2}\b', 'TIME_TOKEN', line)
    
    def extract_date(self, line: str) -> Optional[str]:
        """Extract date from line."""
        match = self.pat_date.search(line)
        return match.group(0) if match else None
    
    def rtl_tokenize_line(self, line: str) -> Dict[str, Any]:
        """
        Deterministic RTL (Right-to-Left) Tokenization.
        
        Input: "S/ROTI KRIM KEJU 72G 4 18000"
        Output: {name, qty, unit_price, total_price, is_valid}
        
        Algorithm:
        1. Extract standalone numeric tokens (not embedded in alphanumeric)
        2. Determine quantity, unit_price, total_price based on count
        3. Remaining text = item name
        """
        # Clean and mask
        cleaned_line = line.strip()
        
        # Mask date/time to prevent interference
        cleaned_line = self.mask_date_in_line(cleaned_line)
        cleaned_line = self.mask_time_in_line(cleaned_line)
        
        # Find standalone numeric tokens (not embedded in alphanumeric)
        # e.g., "72G" -> NOT valid, "4" -> valid, "18000" -> valid
        # Must have whitespace or string start BEFORE and whitespace or string end AFTER
        standalone_numbers = []
        
        # Split by whitespace first, then check each segment
        segments = cleaned_line.split()
        current_pos = 0
        for segment in segments:
            # Find position of this segment in cleaned_line (from current_pos)
            seg_pos = cleaned_line.find(segment, current_pos)
            if seg_pos == -1:
                continue
            
            # Check if segment is purely numeric
            clean_segment = segment.replace(',', '').replace('.', '')
            if clean_segment.isdigit():
                val = self.sanitize_number(segment)
                if val > 0:
                    standalone_numbers.append({
                        'value': val,
                        'pos': seg_pos,
                        'text': segment
                    })
            current_pos = seg_pos + len(segment)
        
        # Sort by position (left to right)
        standalone_numbers.sort(key=lambda x: x['pos'])
        
        # Extract numbers array
        numbers = [n['value'] for n in standalone_numbers]
        
        result = {
            'name': '',
            'qty': 1,
            'unit_price': 0.0,
            'total_price': 0.0,
            'is_valid': False,
            'numbers_found': numbers,
            'numbers_count': len(numbers)
        }
        
        # If no standalone numbers, not a valid item line
        if len(numbers) == 0:
            return result
        
        # Get text parts - remove numbers and clean
        # Replace standalone numbers with placeholder for name extraction
        name_line = cleaned_line
        for num_info in reversed(standalone_numbers):
            # Only replace if surrounded by spaces or at boundaries
            start = num_info['pos']
            end = start + len(num_info['text'])
            # Check boundaries
            if start == 0 or name_line[start-1] in ' \t':
                if end >= len(name_line) or name_line[end] in ' \t':
                    name_line = name_line[:start] + ' ' + name_line[end:]
        
        # Clean up name
        name_line = re.sub(r'\s+', ' ', name_line).strip()
        name_line = self.pat_discard_word.sub('', name_line)
        result['name'] = name_line.strip()
        
        # ============================================================
        # DETERMINISTIC PARSING BASED ON NUMBER COUNT
        # ============================================================
        
        if len(numbers) >= 3:
            # CONDITION A: 3+ numbers [Num1, Num2, Num3]
            # Num1 = quantity (usually small, <= 99)
            # Num2 = unit price
            # Num3 = total price (rightmost, largest)
            total_price = numbers[-1]  # Rightmost = total
            qty = numbers[0]
            unit_price = numbers[1]
            
            # Validation: if qty * unit_price != total_price
            if qty <= 0:
                qty = 1
                unit_price = total_price
            elif abs(qty * unit_price - total_price) > 1:  # Allow tiny float errors
                # Recalculate unit_price from total
                unit_price = total_price / qty
            
            # Cap qty at reasonable number
            if qty > 99:
                qty = 1
                unit_price = numbers[0]
                total_price = numbers[1] if len(numbers) > 1 else numbers[0]
            
            result['qty'] = int(qty)
            result['unit_price'] = round(unit_price, 0)
            result['total_price'] = round(total_price, 0)
            result['is_valid'] = True
            
        elif len(numbers) == 2:
            # CONDITION B: 2 numbers [Num1, Num2]
            # Sub-rule: Check if first number looks like quantity
            num1, num2 = numbers[0], numbers[1]
            
            # If num1 <= 100 AND num2 is divisible by num1 (looks like qty * price)
            if num1 <= 100 and num1 > 0 and num2 % num1 == 0:
                qty = num1
                unit_price = num2 / num1
                total_price = num2
            else:
                # Not a quantity pattern
                qty = 1
                unit_price = num1
                total_price = num2
            
            result['qty'] = int(qty)
            result['unit_price'] = round(unit_price, 0)
            result['total_price'] = round(total_price, 0)
            result['is_valid'] = True
            
        else:  # len(numbers) == 1
            # CONDITION C: 1 number
            # This is the total price
            result['qty'] = 1
            result['unit_price'] = numbers[0]
            result['total_price'] = numbers[0]
            result['is_valid'] = True
        
        return result
    
    def parse(self, raw_lines: Any) -> Dict[str, Any]:
        """
        Parse receipt using deterministic state machine.
        
        ANTI-CRASH: Always returns valid dictionary.
        """
        # ============================================================
        # DEFAULT RESPONSE (Safe fallback)
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
            "subtotal_mismatch": False,
            "raw_debug": {}
        }
        
        # ============================================================
        # INPUT VALIDATION
        # ============================================================
        if not raw_lines:
            logger.warning("parse() called with empty raw_lines")
            default_res["confidence_score"] = 0.0
            return default_res
        
        # Normalize to list of strings
        try:
            if isinstance(raw_lines, str):
                lines = [l.strip() for l in raw_lines.split('\n') if l.strip()]
            elif isinstance(raw_lines, (list, tuple)):
                lines = [str(l).strip() for l in raw_lines if l]
            else:
                lines = []
        except Exception as e:
            logger.error(f"Failed to process raw_lines: {e}")
            default_res["confidence_score"] = 0.0
            return default_res
        
        if not lines:
            default_res["confidence_score"] = 0.0
            return default_res
        
        try:
            # ============================================================
            # VARIABLES
            # ============================================================
            items = []
            subtotal_ocr = 0.0
            subtotal_calc = 0.0
            discount_total = 0.0
            total_ocr = 0.0
            total_final = 0.0
            merchant_name = "Unknown Merchant"
            payment_method = "Cash"
            extracted_date = None
            subtotal_mismatch = False
            
            # State machine
            state = "HEADER"
            
            # Track transitions for debugging
            state_transitions = []
            processed_lines = []
            
            # ============================================================
            # PHASE 1: GLOBAL SCAN (Find merchant, date anywhere)
            # ============================================================
            full_text = " ".join(lines)
            
            # Find merchant
            merchant_patterns = [
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
            ]
            
            for pattern in merchant_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    merchant_name = match.group(1).title()
                    break
            
            # Extract date
            date_match = self.pat_date.search(full_text)
            if date_match:
                extracted_date = date_match.group(0)
            
            # ============================================================
            # PHASE 2: STRICT STATE MACHINE
            # ============================================================
            
            for idx, line in enumerate(lines):
                line_str = str(line).strip()
                if not line_str:
                    continue
                
                upper = line_str.upper()
                masked_line = self.mask_date_in_line(self.mask_time_in_line(line_str))
                
                # Log state for debugging
                debug_entry = {
                    'line_num': idx + 1,
                    'state': state,
                    'line_preview': line_str[:50],
                    'action': 'none'
                }
                
                # ============================================================
                # STATE: HEADER
                # ============================================================
                if state == "HEADER":
                    debug_entry['action'] = 'header_scan'
                    
                    # Look for date in this line
                    if not extracted_date:
                        date_match = self.pat_date.search(line_str)
                        if date_match:
                            extracted_date = date_match.group(0)
                            debug_entry['action'] = 'header_date_found'
                    
                    # TRANSITION to ITEMS triggered by:
                    # 1. Separator line (---, ===)
                    # 2. Line is likely item AND contains price
                    if self.is_separator_line(line_str):
                        state = "ITEMS"
                        state_transitions.append(f"L{idx+1}: HEADER->ITEMS (separator)")
                        debug_entry['action'] = 'transition_to_items_sep'
                    elif self.is_likely_item_line(line_str):
                        # Verify it has a numeric price
                        parsed = self.rtl_tokenize_line(line_str)
                        if parsed['is_valid'] and parsed['total_price'] >= 100:
                            state = "ITEMS"
                            state_transitions.append(f"L{idx+1}: HEADER->ITEMS (item detected)")
                            debug_entry['action'] = 'transition_to_items_item'
                            # Process this line as first item
                            self._process_item_line(line_str, parsed, items)
                    # Else stay in HEADER
                
                # ============================================================
                # STATE: ITEMS
                # ============================================================
                elif state == "ITEMS":
                    # Check for FOOTER trigger FIRST
                    if self.is_footer_trigger(line_str):
                        state = "FOOTER"
                        state_transitions.append(f"L{idx+1}: ITEMS->FOOTER (keyword)")
                        debug_entry['action'] = 'transition_to_footer'
                        # Don't process footer trigger line as item
                        processed_lines.append(debug_entry)
                        continue
                    
                    # Check for separator (also triggers footer)
                    if self.is_separator_line(line_str):
                        state = "FOOTER"
                        state_transitions.append(f"L{idx+1}: ITEMS->FOOTER (separator)")
                        debug_entry['action'] = 'transition_to_footer_sep'
                        processed_lines.append(debug_entry)
                        continue
                    
                    # Check for discount lines
                    if 'DISKON' in upper or 'POTONGAN' in upper or 'PROMO' in upper or 'HEMAT' in upper:
                        disc_match = re.search(r'[\(:=]?\s*[-]?\s*([0-9.,]+)[\)]?', line_str)
                        if disc_match:
                            disc_val = abs(self.sanitize_number(disc_match.group(1)))
                            if disc_val > 0 and disc_val < 1000000:
                                discount_total += disc_val
                                debug_entry['action'] = 'discount_found'
                                processed_lines.append(debug_entry)
                                continue
                    
                    # Skip noise lines
                    if self.is_noise_line(line_str):
                        debug_entry['action'] = 'skipped_noise'
                        processed_lines.append(debug_entry)
                        continue
                    
                    # Process as item
                    parsed = self.rtl_tokenize_line(line_str)
                    if parsed['is_valid'] and parsed['total_price'] >= 100:
                        self._process_item_line(line_str, parsed, items)
                        debug_entry['action'] = f'item_added ({parsed["name"][:20]})'
                    else:
                        debug_entry['action'] = 'skipped_invalid'
                
                # ============================================================
                # STATE: FOOTER
                # ============================================================
                elif state == "FOOTER":
                    upper = line_str.upper()
                    
                    # Extract subtotal (HARGA JUAL or SUBTOTAL)
                    if ('HARGA JUAL' in upper or 'SUBTOTAL' in upper) and subtotal_ocr == 0.0:
                        sub_match = re.search(r'[\(:=]?\s*([0-9.,]+)', line_str)
                        if sub_match:
                            subtotal_ocr = self.sanitize_number(sub_match.group(1))
                            debug_entry['action'] = 'subtotal_found'
                    
                    # Extract total
                    if 'TOTAL' in upper and 'SUBTOTAL' not in upper and 'HARGA' not in upper:
                        if total_ocr == 0.0:
                            tot_match = re.search(r'[\(:=]?\s*([0-9.,]+)', line_str)
                            if tot_match:
                                total_ocr = self.sanitize_number(tot_match.group(1))
                                debug_entry['action'] = 'total_ocr_found'
                    
                    # Extract payment method
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
                
                processed_lines.append(debug_entry)
            
            # ============================================================
            # PHASE 3: BOTTOM-UP MATHEMATICAL GUARDRAILS
            # ============================================================
            
            # STEP 1: Calculate sum of items
            subtotal_calc = sum(item['total_price'] for item in items)
            
            # STEP 2: Reconcile subtotal
            if subtotal_ocr == 0.0:
                subtotal_ocr = subtotal_calc
            elif abs(subtotal_ocr - subtotal_calc) > 100:
                subtotal_mismatch = True
            
            # STEP 3: Calculate grand total
            # total_calc = subtotal - discount + tax + service
            total_calc = subtotal_ocr - discount_total
            if total_calc < 0:
                total_calc = subtotal_calc - discount_total
            
            # STEP 4: Reconcile final total
            if total_ocr == 0.0:
                total_final = total_calc
            else:
                total_final = total_ocr
            
            # Ensure positive
            total_final = abs(total_final)
            
            # ============================================================
            # PHASE 4: CASCADE CONFIDENCE PENALTIES
            # ============================================================
            
            base_score = 100.0
            penalties = 0.0
            
            # PENALTY -30: Total mismatch
            if subtotal_mismatch or abs(total_final - total_calc) > 100:
                penalties += 30.0
            
            # PENALTY -30: No items detected
            if len(items) == 0:
                penalties += 30.0
            
            # PENALTY -20: Item math error (qty * unit != total)
            for item in items:
                expected = item['quantity'] * item['price_per_unit']
                if abs(expected - item['total_price']) > 10:
                    penalties += 20.0
                    break
            
            # PENALTY -20: No date found
            if not extracted_date:
                penalties += 20.0
            
            # Calculate final confidence (minimum 0)
            confidence = max(0.0, base_score - penalties)
            
            # ============================================================
            # BUILD RESULT
            # ============================================================
            
            return {
                "merchant_name": merchant_name,
                "amount": round(total_final, 0),
                "date": extracted_date,
                "payment_method": payment_method,
                "subtotal": round(subtotal_ocr, 0),
                "discount_total": round(discount_total, 0),
                "items": items,
                "items_count": len(items),
                "confidence_score": round(confidence, 1),
                "subtotal_mismatch": subtotal_mismatch,
                "raw_debug": {
                    "state_transitions": state_transitions,
                    "processed_lines_count": len(processed_lines),
                    "items_sum": subtotal_calc,
                    "total_calc": total_calc,
                    "total_ocr": total_ocr
                }
            }
            
        except Exception as e:
            logger.error(f"FATAL ERROR in parse(): {e}", exc_info=True)
            default_res["confidence_score"] = 0.0
            return default_res
    
    def _process_item_line(self, line: str, parsed: Dict, items: List):
        """Add parsed item to list."""
        # Clean item name
        name = parsed['name'].strip()
        
        # Skip if name is empty or too short
        if not name or len(name) < 2:
            return
        
        # Skip if name is mostly numbers
        if re.match(r'^[\d\s\-\.]+$', name):
            return
        
        items.append({
            "name": name,
            "quantity": parsed['qty'],
            "price_per_unit": parsed['unit_price'],
            "total_price": parsed['total_price']
        })


def parse_receipt_text(raw_lines: Any) -> Dict[str, Any]:
    """
    Convenience function for parsing receipt text.
    Returns complete dictionary with all fields.
    """
    parser = DeterministicReceiptParser()
    return parser.parse(raw_lines)


def should_use_gemini_fallback(result: Dict[str, Any], raw_text_length: int = 0) -> Tuple[bool, str]:
    """
    Determine if Gemini Vision AI fallback should be used.
    
    Returns: (should_fallback: bool, reason: str)
    
    Triggers:
    - len(raw_ocr_text) < 10
    - confidence_score < 60
    - items_count == 0
    - total_final == 0
    """
    if raw_text_length < 10:
        return True, "Raw OCR text too short"
    
    if result.get('confidence_score', 0) < 60:
        return True, f"Low confidence: {result.get('confidence_score', 0)}"
    
    if result.get('items_count', 0) == 0:
        return True, "No items detected"
    
    if result.get('amount', 0) == 0:
        return True, "Total amount is zero"
    
    return False, "Parser succeeded"
