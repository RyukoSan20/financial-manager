"""
Production Receipt Parser Engine v3
Fixed: Resi number filter, strict footer, negative total guardrail, global merchant scan, 2-digit date
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
        
        # Extended Merchant Keywords (searchable anywhere)
        self.pat_merchant = re.compile(
            r'(INDOMARET|ALFAMART|ALFAGIFT|FAMILY MART|SUPERINDO|YOGYA|'
            r'CARREFOUR|HYPERMART|GIANT|TRANSMART|LAWSON|MCDONALD|KFC|STARBUCKS)',
            re.IGNORECASE
        )
        
        # Strict Footer Trigger - ONLY these exact patterns
        self.pat_footer_trigger = re.compile(
            r'^HARGA\s*JUAL\s*[:=]?\s*[\d]'
            r'|^SUBTOTAL\s*[:=]?\s*[\d]'
            r'|^TUNAI\s*[:=]?\s*[\d]'
            r'|^KEMBALI\s*[:=]?\s*[\d]'
            r'|^BAYAR\s*[:=]?\s*[\d]'
            r'|^GRAND\s*TOTAL\s*[:=]?\s*[\d]'
            r'|^TOTAL\s+[:=]\s*[\d]'
            r'|^TOTAL\s+[\d]{4,}'  # TOTAL followed by large number
            r'|ANDA\s*HEMAT'
            r'|LAYANAN\s*KONSUMEN',
            re.IGNORECASE
        )
        
        # Phone, Transaction Ref, Resi Number Pattern (ignore these)
        self.pat_noise = re.compile(
            r'(\b08[12][\d\s\-]{7,12}\b|'  # Phone: 081234567890
            r'\d{5,}/[A-Z0-9]+|'            # Resi: 914115/ALIA
            r'\bCALL\b|\bSMS\b|'             # CALL/SMS
            r'\d{2}:\d{2}|'                  # Time: 06:46
            r'^=+$|'                          # Separator: ====
            r'\b15\d{3,}\b)',                # Call center: 1500580
            re.IGNORECASE
        )
        
        # Date Pattern (supports 2-digit year: DD.MM.YY)
        self.pat_date = re.compile(
            r'(\d{2}[\.\/\-]\d{2}[\.\/\-]\d{2,4})'
        )
        
        # Discard words (not real items)
        self.pat_discard = re.compile(
            r'^(TOTAL|TUNAI|KEMBALI|DISKON|PROMO|BAYAR|HARGA|STRUK|RECEIPT|TERIMA|'
            r'KASIH|UNTUNG|SEHAT|HEMAT|ANDA|CARD|VISA|MASTER|DEBIT|QRIS)$',
            re.IGNORECASE
        )

    def sanitize_num(self, val_str: str) -> float:
        """Clean OCR artifacts from number strings."""
        if not val_str:
            return 0.0
        
        # Remove parentheses (discount format like "(1,300)")
        val_str = val_str.replace('(', '').replace(')', '')
        
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

    def is_valid_price_token(self, token: str, line: str) -> bool:
        """Check if token is a valid price (not resi, phone, date)."""
        # Ignore if line has noise patterns
        if self.pat_noise.search(line):
            return False
        
        # Ignore if token contains special chars (resi format)
        if '/' in token or ':' in token:
            return False
        
        # Validate numeric range for retail prices
        num = self.sanitize_num(token)
        
        # Valid retail price: Rp 100 to Rp 5,000,000
        return 100 <= num <= 5000000

    def is_valid_item_line(self, line: str) -> bool:
        """Check if line is likely a real item (not noise)."""
        # Skip separator lines
        if line.startswith('=') or line.startswith('-'):
            return False
        
        # Skip if contains discard words
        if self.pat_discard.search(line.strip()):
            return False
        
        # Must contain digits
        if not re.search(r'\d', line):
            return False
        
        # Skip if entire line is noise
        if self.pat_noise.search(line):
            return False
        
        return True

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
        extracted_date = None
        
        # State machine
        state = "HEADER"
        name_buffer: List[str] = []
        
        # Global scan for merchant (fallback if header is logo/image)
        full_text = " ".join(raw_lines)
        merchant_match = self.pat_merchant.search(full_text)
        if merchant_match:
            merchant_name = merchant_match.group(0).title()
        
        for line in raw_lines:
            line_str = line.strip()
            if not line_str:
                continue
            
            # Skip separator lines
            if line_str.startswith('=') or line_str.startswith('-'):
                continue
            
            line_upper = line_str.upper()
            tokens = line_str.split()
            
            # Extract date (support 2-digit year)
            if not extracted_date:
                date_match = self.pat_date.search(line_str)
                if date_match:
                    extracted_date = date_match.group(1)
            
            # Check if line has valid price token
            has_valid_price = any(self.is_valid_price_token(t, line_str) for t in tokens)
            
            # ==========================================
            # STATE 1: HEADER
            # ==========================================
            if state == "HEADER":
                # Look for merchant in header
                merchant_match = self.pat_merchant.search(line_str)
                if merchant_match:
                    merchant_name = merchant_match.group(0).title()
                
                # Transition to ITEMS if:
                # 1. Date found, OR
                # 2. Valid price token AND no noise patterns
                if self.pat_date.search(line_str) or (has_valid_price and not self.pat_noise.search(line_str)):
                    state = "ITEMS"
            
            # ==========================================
            # FOOTER DETECTION
            # ==========================================
            if self.pat_footer_trigger.search(line_str):
                name_buffer.clear()
                state = "FOOTER"
                
                # Parse footer values
                if "TOTAL" in line_upper and "HARGA" not in line_upper and total_amount == 0.0:
                    tot_val = self.sanitize_num(line_str)
                    # Safety: only accept reasonable totals
                    if 0 < tot_val < 50000000:
                        total_amount = tot_val
                elif "HARGA JUAL" in line_upper:
                    subtotal = self.sanitize_num(line_str)
                elif "TUNAI" in line_upper:
                    payment_method = "Cash"
                
                continue
            
            # ==========================================
            # STATE 2: ITEMS (RTL Tokenization Active)
            # ==========================================
            if state == "ITEMS":
                # Handle discount lines (all variations)
                if "DISKON" in line_upper or "POTONGAN" in line_upper or "PROMO" in line_upper:
                    # Extract discount value
                    disc_match = re.search(r'[\(:=]?\s*[-]?\s*([0-9.,]+)[\)]?', line_str)
                    if disc_match:
                        disc_val = abs(self.sanitize_num(disc_match.group(1)))
                        if disc_val > 0:
                            discount_total += disc_val
                    continue
                
                # Skip invalid lines
                if not self.is_valid_item_line(line_str):
                    continue
                
                # RTL Tokenization: Extract numbers from right to left
                numeric_tokens = []
                text_tokens = []
                
                for token in reversed(tokens):
                    num_val = self.sanitize_num(token)
                    # Valid price and within limit
                    if 100 <= num_val <= 5000000 and len(numeric_tokens) < 3:
                        numeric_tokens.append(token)
                    else:
                        text_tokens.append(token)
                
                numeric_tokens.reverse()
                text_tokens.reverse()
                
                # Remove discard words from item name
                discard_strip = re.compile(
                    r'\b(TOTAL|TUNAI|KEMBALI|DISKON|PROMO|BAYAR)\b',
                    re.IGNORECASE
                )
                line_item_name = discard_strip.sub('', ' '.join(text_tokens)).strip()
                
                if numeric_tokens and not self.pat_noise.search(line_str):
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
                    
                    # Flush name buffer (multi-line item names)
                    full_name = " ".join(name_buffer + [line_item_name]).strip()
                    name_buffer.clear()
                    
                    # Validate item
                    if total_price >= 100 and len(full_name) > 1:
                        items.append({
                            "name": full_name,
                            "quantity": qty,
                            "price_per_unit": unit_price,
                            "total_price": total_price
                            })
                else:
                    # Buffer multi-line item names
                    if len(line_str) > 2 and not self.pat_noise.search(line_str) and not self.pat_discard.search(line_str):
                        if len(name_buffer) < 3:
                            name_buffer.append(line_str)
            
            # ==========================================
            # STATE 3: FOOTER
            # ==========================================
            if state == "FOOTER":
                # Flush buffer at footer
                name_buffer.clear()
                
                # Handle discount in footer too
                if "DISKON" in line_upper or "POTONGAN" in line_upper or "PROMO" in line_upper:
                    disc_match = re.search(r'[\(:=]?\s*[-]?\s*([0-9.,]+)[\)]?', line_str)
                    if disc_match:
                        disc_val = abs(self.sanitize_num(disc_match.group(1)))
                        if disc_val > 0:
                            discount_total += disc_val
                    continue
                
                if "TOTAL" in line_upper and "HARGA" not in line_upper and total_amount == 0.0:
                    tot_val = self.sanitize_num(line_str)
                    if 0 < tot_val < 50000000:
                        total_amount = tot_val
                elif "HARGA JUAL" in line_upper:
                    subtotal = self.sanitize_num(line_str)
                
                # Detect payment method
                if 'GOPAY' in line_upper:
                    payment_method = "GoPay"
                elif 'OVO' in line_upper:
                    payment_method = "OVO"
                elif 'DANA' in line_upper:
                    payment_method = "DANA"
                elif 'QRIS' in line_upper:
                    payment_method = "QRIS"
        
        # ==========================================
        # MATHEMATICAL GUARDRAILS
        # ==========================================
        sum_items = sum(item['total_price'] for item in items)
        
        # If TOTAL missing/zero/unreasonable, calculate from items
        if total_amount == 0.0 or total_amount > 50000000:
            if subtotal > 0:
                total_amount = subtotal
            else:
                total_amount = sum_items - discount_total if sum_items > discount_total else sum_items
        
        # If subtotal missing, use sum of items
        if subtotal == 0.0 and items:
            subtotal = sum_items
        
        # Force positive total
        total_amount = abs(total_amount)
        
        # ==========================================
        # HOLISTIC CONFIDENCE SCORE
        # ==========================================
        confidence = 50.0
        
        if len(items) > 0:
            confidence += 15.0
        if len(items) >= 3:
            confidence += 10.0
        
        # Math validation
        expected_total = subtotal - discount_total
        if total_amount > 0:
            if abs(total_amount - expected_total) <= 100:
                confidence += 25.0
            elif abs(total_amount - sum_items) <= 100:
                confidence += 15.0
        
        return {
            "merchant_name": merchant_name,
            "date": extracted_date,
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
