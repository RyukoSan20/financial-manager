"""
Production Receipt Parser Engine v2
Fixed: HEADER stuck fallback, Footer false-positive, name_buffer flush, engine confidence
"""

import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class ProductionReceiptParserEngine:
    """
    Production-grade receipt parser with:
    - Strict State Machine (HEADER -> ITEMS -> FOOTER)
    - RTL Tokenization (numbers from right)
    - Name Buffer for multi-line items
    - Mathematical Guardrails & Holistic Confidence
    """
    
    def __init__(self):
        self.clean_digit = re.compile(r'[^\d]')
        
        # Header detection patterns
        self.pat_header_trigger = re.compile(
            r'(INDOMARET|ALFAMART|ALFAGIFT|FAMILY MART|SUPERINDO|YOGYA|'
            r'TRANSFE|STATION|MERAH PUTIH|CARREFOUR|HYPERMART|GIANT)',
            re.IGNORECASE
        )
        
        # Footer detection - MUST be followed by actual total amount or specific keywords
        # Prevents "TOTAL CARE" / "CASHWEIN" from triggering footer
        self.pat_footer_trigger = re.compile(
            r'^(HARGA\s*JUAL|SUBTOTAL|TUNAI|KEMBALI|BAYAR|EDC|BANK|GRAND\s*TOTAL|'
            r'TOTAL\s*BAYAR|SISA\s*KEMBALI|TOTAL\s+JUAL)'
            r'|'
            r'^TOTAL\s*[:=]?\s*[\d]'
            r'|'
            r'^(TOTAL|BAYAR)\s+[\d.,]{4,}$',
            re.IGNORECASE
        )
        
        # Phone number pattern to filter from items
        self.pat_phone = re.compile(r'\b08[12][\d\s\-]{7,12}\b')
        
        # Date patterns (extended to handle more formats)
        self.pat_date = re.compile(
            r'(\d{2}[\.\/\-]\d{2}[\.\/\-]\d{2,4}|'
            r'\d{4}[\.\/\-]\d{2}[\.\/\-]\d{2})'
        )
        
        # Indonesian merchant patterns
        self.merchant_patterns = [
            'indomaret', 'alfamart', 'alfagift', 'family mart', 'familymart',
            'lawson', 'carrefour', 'superindo', 'hypermart', 'giant',
            'transmart', 'seven eleven', '7-eleven', 'cvs', 'guardian',
            'mcdonald', 'mcd', 'kfc', 'starbucks', 'hokben', 'burger king',
            'grab', 'gojek', 'shopee', 'tokopedia', 'lazada'
        ]

    def sanitize_num(self, val_str: str) -> float:
        """Clean OCR artifacts from number strings."""
        if not val_str:
            return 0.0
        
        # OCR character substitutions
        substitutions = {
            'O': '0', 'o': '0', 'D': '0',
            'I': '1', 'l': '1', '|': '1',
            'S': '5', 'B': '8', 'Z': '2',
            ',': '', ' ': ''
        }
        
        for old, new in substitutions.items():
            val_str = val_str.replace(old, new)
        
        cleaned = self.clean_digit.sub('', val_str)
        return float(cleaned) if cleaned else 0.0

    def is_valid_item_line(self, line: str) -> bool:
        """Check if line is likely an item (not header/footer/promo)."""
        line_upper = line.upper()
        line_lower = line.lower()
        
        # Skip footer/header markers
        skip_words = [
            'DISKON', 'PROMO', 'POTONGAN', 'KEMBALI', 'TUNAI', 
            'CARD', 'MASTER', 'VISA', 'DEBIT', 'CREDIT', 'QRIS',
            'PPN', 'TAX', 'SERVICE', 'CHARGE', 'MEMBER', 'POIN',
            'WELCOME', 'THANK', 'STRUK', 'RECEIPT', 'TRANSAKSI',
            'GOPAY', 'DANA', 'OVO', 'SHOPEPAY', 'LINKAJA'
        ]
        
        if any(word in line_upper for word in skip_words):
            return False
        
        # Must contain digits
        if not re.search(r'\d', line):
            return False
        
        # Filter phone numbers (header artifacts)
        if self.pat_phone.search(line):
            cleaned = re.sub(r'[\s\-\(\)]', '', line)
            if re.match(r'^08[\d]{8,12}$', cleaned):
                return False
        
        return True

    def has_numeric_price_token(self, line: str) -> bool:
        """Check if line has numeric token that looks like a price (>= 3 digits)."""
        tokens = line.split()
        for token in tokens:
            num_val = self.sanitize_num(token)
            if num_val >= 100:  # Real price (not qty)
                return True
        return False

    def parse(self, raw_lines: List[str]) -> Dict[str, Any]:
        """
        Parse receipt with strict state machine.
        
        States:
        - HEADER: Merchant name, address, phone (no item parsing)
        - ITEMS: Item parsing with RTL tokenizer (only this state parses items)
        - FOOTER: Total, payment method (no item parsing)
        """
        
        items = []
        subtotal = 0.0
        discount_total = 0.0
        total_amount = 0.0
        merchant_name = "Unknown Merchant"
        payment_method = "Cash"
        
        # State machine
        state = "HEADER"
        name_buffer: List[str] = []
        
        for line in raw_lines:
            line_str = line.strip()
            if not line_str:
                continue
            
            line_upper = line_str.upper()
            line_lower = line_str.lower()
            tokens = line_str.split()
            
            # Check if line has price-like numeric token (for fallback detection)
            has_price_token = self.has_numeric_price_token(line_str)
            
            # ==========================================
            # STATE 1: HEADER
            # ==========================================
            if state == "HEADER":
                # Detect merchant name
                for pattern in self.merchant_patterns:
                    if pattern in line_lower:
                        merchant_name = line_str.title()
                        break
                
                # CRITICAL FIX: Transition to ITEMS if:
                # 1. Date is found, OR
                # 2. Line has price-like token AND no phone number (fallback heuristic)
                # This prevents parser from being stuck in HEADER forever
                date_found = self.pat_date.search(line_str)
                should_transition = date_found or (has_price_token and not self.pat_phone.search(line_str))
                
                if should_transition:
                    state = "ITEMS"
                    # Don't continue - let ITEMS process handle this line too
                    # This fixes the "stuck in HEADER" bug
            
            # ==========================================
            # FOOTER DETECTION (can happen from ITEMS)
            # CRITICAL FIX: Only trigger on actual footer patterns
            # Prevents "TOTAL CARE" / "CASHWEIN" from stopping parsing
            # ==========================================
            if self.pat_footer_trigger.search(line_str):
                # Flush any pending name buffer before footer
                name_buffer.clear()
                state = "FOOTER"
                
                # Parse footer values
                if total_amount == 0.0:
                    if 'TOTAL' in line_upper and 'DISCOUNT' not in line_upper:
                        total_amount = self.sanitize_num(line_str)
                    elif 'BAYAR' in line_upper:
                        total_amount = self.sanitize_num(line_str)
                
                if 'HARGA JUAL' in line_upper or 'SUBTOTAL' in line_upper:
                    subtotal = self.sanitize_num(line_str)
                elif 'TUNAI' in line_upper:
                    payment_method = 'Cash'
                
                continue
            
            # ==========================================
            # STATE 2: ITEMS (RTL Tokenization Active)
            # ==========================================
            if state == "ITEMS":
                # Skip discount/promo lines
                if 'DISKON' in line_upper or 'PROMO' in line_upper or 'POTONGAN' in line_upper:
                    disc_match = re.search(r'[\(:=]?\s*[-]?\s*([0-9OIDI|.,\s]+)[\)]?', line_str)
                    if disc_match:
                        discount_total += self.sanitize_num(disc_match.group(1))
                    continue
                
                # Only process valid item lines
                if not self.is_valid_item_line(line_str):
                    continue
                
                # RTL Tokenization: Extract numbers from right to left
                numeric_tokens = []
                text_tokens = []
                
                for token in reversed(tokens):
                    num_val = self.sanitize_num(token)
                    
                    # Valid price: 100-99999999
                    if 100 <= num_val <= 99999999 and len(numeric_tokens) < 3:
                        numeric_tokens.append(token)
                    else:
                        text_tokens.append(token)
                
                numeric_tokens.reverse()
                text_tokens.reverse()
                line_item_name = " ".join(text_tokens).strip()
                
                if numeric_tokens:
                    nums = [self.sanitize_num(n) for n in numeric_tokens]
                    
                    # Parse quantity, unit price, total price
                    if len(nums) == 3:
                        qty = int(nums[0]) if nums[0] <= 99 else 1
                        unit_price = nums[1]
                        total_price = nums[2]
                    elif len(nums) == 2:
                        qty = 1
                        if nums[0] <= 10:
                            qty = int(nums[0])
                            unit_price = nums[1]
                        else:
                            unit_price = nums[0]
                        total_price = nums[1]
                    else:
                        qty = 1
                        unit_price = nums[0]
                        total_price = nums[0]
                    
                    # CRITICAL FIX: Flush name buffer when item is found
                    full_name = " ".join(name_buffer + [line_item_name]).strip()
                    name_buffer.clear()
                    
                    # Only add if looks like real item
                    if total_price >= 100 and len(full_name) > 1:
                        items.append({
                            "name": full_name,
                            "quantity": qty,
                            "price_per_unit": unit_price,
                            "total_price": total_price
                        })
                else:
                    # No numbers found - buffer for next line (multi-line item name)
                    if len(line_str) > 2 and not self.pat_phone.search(line_str):
                        if len(name_buffer) < 3:  # Max 3 lines for item name
                            name_buffer.append(line_str)
            
            # ==========================================
            # STATE 3: FOOTER
            # ==========================================
            if state == "FOOTER":
                # CRITICAL FIX: Flush any remaining name buffer at footer
                name_buffer.clear()
                
                if total_amount == 0.0:
                    if 'TOTAL' in line_upper and 'DISCOUNT' not in line_upper:
                        total_amount = self.sanitize_num(line_str)
                    elif 'BAYAR' in line_upper:
                        total_amount = self.sanitize_num(line_str)
                
                if 'HARGA JUAL' in line_upper or 'SUBTOTAL' in line_upper:
                    subtotal = self.sanitize_num(line_str)
                
                # Detect payment method
                payment_methods = {
                    'gopay': 'GoPay', 'dana': 'DANA', 'ovo': 'OVO',
                    'shopee pay': 'ShopeePay', 'shopeepay': 'ShopeePay',
                    'linkaja': 'LinkAja', 'qris': 'QRIS',
                    'cash': 'Cash', 'tunai': 'Cash',
                    'debit': 'Debit', 'credit': 'Credit'
                }
                for pattern, method in payment_methods.items():
                    if pattern in line_lower:
                        payment_method = method
                        break
        
        # ==========================================
        # CRITICAL FIX: Flush remaining name buffer at end
        # (for items that end the receipt without footer)
        # ==========================================
        # If we still have items but no valid total, flush remaining buffer
        # Note: This is a soft flush - we don't add partial names as items
        
        # ==========================================
        # MATHEMATICAL GUARDRAILS
        # ==========================================
        sum_items = sum(item['total_price'] for item in items)
        
        # If TOTAL missing/zero, calculate from items
        if total_amount == 0.0:
            if subtotal > 0:
                total_amount = subtotal
            else:
                total_amount = sum_items - discount_total if sum_items > discount_total else sum_items
        
        # If subtotal missing, use sum of items
        if subtotal == 0.0 and items:
            subtotal = sum_items
        
        # ==========================================
        # HOLISTIC CONFIDENCE SCORE (from engine)
        # ==========================================
        # 50% base + 25% item completeness + 25% math validity
        confidence = 50.0  # Start at 50%
        
        if len(items) > 0:
            confidence += 15.0  # Has items
        if len(items) >= 3:
            confidence += 10.0  # Good item count
        
        # Math validation: total should equal subtotal - discount
        expected_total = subtotal - discount_total
        if total_amount > 0:
            if abs(total_amount - expected_total) <= 100:
                confidence += 25.0  # Math is valid
            elif abs(total_amount - sum_items) <= 100:
                confidence += 15.0  # Math is close (discount not parsed)
        
        return {
            "merchant_name": merchant_name,
            "payment_method": payment_method,
            "subtotal": subtotal,
            "discount_total": discount_total,
            "amount": total_amount,
            "confidence_score": round(min(confidence, 100.0), 1),
            "items": items,
            "items_count": len(items)
        }


def parse_receipt_text(raw_lines: List[str]) -> Dict[str, Any]:
    """Convenience function for parsing receipt text."""
    engine = ProductionReceiptParserEngine()
    return engine.parse(raw_lines)
