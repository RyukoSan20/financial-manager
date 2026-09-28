"""
Production Receipt Parser Engine v3.2 (Anti-Crash)
- 100% exception-safe
- Always returns complete dictionary
- Proper error logging
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
    - ANTI-CRASH: Never throws exceptions to caller
    """
    
    def __init__(self):
        self.clean_digit = re.compile(r'[^\d]')
        
        # Extended Merchant Keywords (searchable anywhere)
        self.pat_merchant = re.compile(
            r'(INDOMARET|ALFAMART|ALFAGIFT|FAMILY\s*MART|SUPERINDO|YOGYA|'
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
            r'|^TOTAL\s+[\d]{4,}'
            r'|ANDA\s*HEMAT'
            r'|LAYANAN\s*KONSUMEN',
            re.IGNORECASE
        )
        
        # Phone, Transaction Ref, Resi Number Pattern (ignore these)
        self.pat_noise = re.compile(
            r'(\b08[12][\d\s\-]{7,12}\b|'
            r'\d{5,}/[A-Z0-9]+|'
            r'\bCALL\b|\bSMS\b|'
            r'\d{2}:\d{2}|'
            r'^=+$|'
            r'\b15\d{3,}\b)',
            re.IGNORECASE
        )
        
        # Date Pattern (supports multiple formats)
        self.pat_date = re.compile(
            r'(\d{2}[\.\/\-]\d{2}[\.\/\-]\d{2,4})'
            r'|(\d{4}[\.\/\-]\d{2}[\.\/\-]\d{2})'
            r'|(\d{4}\.\d{2})'
            r'|(\d{2}\.\d{2}\.\d{2})'
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
        
        try:
            val_str = str(val_str).replace('(', '').replace(')', '')
            subs = {
                'O': '0', 'o': '0', 'D': '0',
                'I': '1', 'l': '1', '|': '1',
                'S': '5', 'B': '8', 'Z': '2', ',': '', ' ': ''
            }
            for old, new in subs.items():
                val_str = val_str.replace(old, new)
            
            cleaned = self.clean_digit.sub('', val_str)
            return float(cleaned) if cleaned else 0.0
        except (ValueError, TypeError):
            return 0.0

    def is_valid_price_token(self, token: str, line: str) -> bool:
        """Check if token is a valid price (not resi, phone, date)."""
        if not token:
            return False
        
        try:
            if self.pat_noise.search(line):
                return False
            
            if '/' in str(token) or ':' in str(token):
                return False
            
            num = self.sanitize_num(token)
            return 100 <= num <= 5000000
        except Exception:
            return False

    def is_valid_item_line(self, line: str) -> bool:
        """Check if line is likely a real item (not noise)."""
        if not line:
            return False
        
        try:
            if line.startswith('=') or line.startswith('-'):
                return False
            
            if self.pat_discard.search(line.strip()):
                return False
            
            if not re.search(r'\d', line):
                return False
            
            if self.pat_noise.search(line):
                return False
            
            return True
        except Exception:
            return False

    def parse(self, raw_lines: Any) -> Dict[str, Any]:
        """
        Parse receipt with strict state machine.
        ANTI-CRASH: Always returns valid dictionary with all required keys.
        """
        # Safe default response with ALL required keys
        default_res = {
            "merchant_name": "Unknown Merchant",
            "amount": 0.0,
            "date": None,
            "payment_method": "Cash",
            "subtotal": 0.0,
            "discount_total": 0.0,
            "items": [],
            "items_count": 0,
            "confidence_score": 50.0
        }
        
        # Validate input
        if not raw_lines:
            logger.warning("parse() called with empty raw_lines")
            return default_res
        
        # Ensure raw_lines is a list of strings
        try:
            if isinstance(raw_lines, str):
                # If single string, split by newlines
                lines = [l.strip() for l in raw_lines.split('\n') if l.strip()]
            elif isinstance(raw_lines, (list, tuple)):
                lines = [str(l).strip() for l in raw_lines if l]
            else:
                lines = []
            
            if not lines:
                return default_res
        except Exception as e:
            logger.error(f"Failed to process raw_lines: {e}")
            return default_res
        
        try:
            items = []
            subtotal = 0.0
            discount_total = 0.0
            total_amount = 0.0
            merchant_name = "Unknown Merchant"
            payment_method = "Cash"
            extracted_date = None
            
            state = "HEADER"
            name_buffer = []
            
            # Global scan for merchant (fallback if header is logo/image)
            full_text = " ".join(lines)
            merchant_match = self.pat_merchant.search(full_text)
            if merchant_match:
                merchant_name = merchant_match.group(0).title()
            
            for line in lines:
                try:
                    line_str = str(line).strip()
                    if not line_str:
                        continue
                    
                    if line_str.startswith('=') or line_str.startswith('-'):
                        continue
                    
                    line_upper = line_str.upper()
                    tokens = line_str.split()
                    
                    # Extract date
                    if not extracted_date:
                        date_match = self.pat_date.search(line_str)
                        if date_match:
                            for g in date_match.groups():
                                if g:
                                    extracted_date = g
                                    break
                    
                    has_valid_price = any(self.is_valid_price_token(t, line_str) for t in tokens)
                    
                    # HEADER state
                    if state == "HEADER":
                        if self.pat_date.search(line_str) or (has_valid_price and not self.pat_noise.search(line_str)):
                            state = "ITEMS"
                    
                    # FOOTER detection
                    if self.pat_footer_trigger.search(line_str):
                        name_buffer.clear()
                        state = "FOOTER"
                        continue
                    
                    # ITEMS state
                    if state == "ITEMS":
                        if "DISKON" in line_upper or "POTONGAN" in line_upper or "PROMO" in line_upper:
                            disc_match = re.search(r'[\(:=]?\s*[-]?\s*([0-9.,]+)[\)]?', line_str)
                            if disc_match:
                                disc_val = abs(self.sanitize_num(disc_match.group(1)))
                                if disc_val > 0:
                                    discount_total += disc_val
                            continue
                        
                        if not self.is_valid_item_line(line_str):
                            continue
                        
                        # RTL Tokenization
                        numeric_tokens = []
                        text_tokens = []
                        
                        for token in reversed(tokens):
                            num_val = self.sanitize_num(token)
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
                            
                            full_name = " ".join(name_buffer + [line_item_name]).strip()
                            name_buffer.clear()
                            
                            if total_price >= 100 and len(full_name) > 1:
                                items.append({
                                    "name": full_name,
                                    "quantity": qty,
                                    "price_per_unit": unit_price,
                                    "total_price": total_price
                                })
                        else:
                            if len(line_str) > 2 and not self.pat_noise.search(line_str):
                                if len(name_buffer) < 3:
                                    name_buffer.append(line_str)
                    
                    # FOOTER state
                    if state == "FOOTER":
                        name_buffer.clear()
                        
                        if "TOTAL" in line_upper and "HARGA" not in line_upper and total_amount == 0.0:
                            tot_val = self.sanitize_num(line_str)
                            if 0 < tot_val < 50000000:
                                total_amount = tot_val
                        elif "HARGA JUAL" in line_upper:
                            subtotal = self.sanitize_num(line_str)
                        
                        if 'GOPAY' in line_upper:
                            payment_method = "GoPay"
                        elif 'OVO' in line_upper:
                            payment_method = "OVO"
                        elif 'DANA' in line_upper:
                            payment_method = "DANA"
                        elif 'QRIS' in line_upper:
                            payment_method = "QRIS"
                
                except Exception as e:
                    logger.warning(f"Error processing line '{line_str[:30]}': {e}")
                    continue
            
            # Mathematical Guardrails
            sum_items = sum(item.get('total_price', 0) for item in items)
            
            if total_amount == 0.0 or total_amount > 50000000:
                if subtotal > 0:
                    total_amount = subtotal
                else:
                    total_amount = sum_items - discount_total if sum_items > discount_total else sum_items
            
            if subtotal == 0.0 and items:
                subtotal = sum_items
            
            total_amount = abs(total_amount)
            
            # Calculate confidence
            confidence = 50.0
            if len(items) > 0:
                confidence += 15.0
            if len(items) >= 3:
                confidence += 10.0
            
            expected_total = subtotal - discount_total
            if total_amount > 0:
                if abs(total_amount - expected_total) <= 100:
                    confidence += 25.0
                elif abs(total_amount - sum_items) <= 100:
                    confidence += 15.0
            
            return {
                "merchant_name": merchant_name,
                "amount": total_amount,
                "date": extracted_date,
                "payment_method": payment_method,
                "subtotal": subtotal,
                "discount_total": discount_total,
                "items": items,
                "items_count": len(items),
                "confidence_score": round(min(confidence, 100.0), 1)
            }
            
        except Exception as e:
            logger.error(f"FATAL ERROR in parse(): {e}", exc_info=True)
            return default_res


def parse_receipt_text(raw_lines: Any) -> Dict[str, Any]:
    """Convenience function for parsing receipt text."""
    engine = ProductionReceiptParserEngine()
    return engine.parse(raw_lines)
