"""
Robust Receipt Parser Engine
RTL Tokenization + State Machine + Mathematical Guardrails
"""

import re
from typing import List, Dict, Any, Optional

class RobustReceiptParserEngine:
    def __init__(self):
        self.clean_digit = re.compile(r'[^\d]')
        self.pat_footer = re.compile(
            r'^(HARGA\s*JUAL|TOTAL|SUBTOTAL|TUNAI|KEMBALI|CASH|BAYAR|GRAND\s*TOTAL)',
            re.IGNORECASE
        )
        self.pat_date = re.compile(r'\d{2}[\.\/\-]\d{2}[\.\/\-]\d{2,4}')
        self.pat_number = re.compile(r'^[\d]+$')
        
        # Indonesian merchant patterns
        self.merchant_patterns = [
            'indomaret', 'alfamart', 'alfagift', 'family mart', 'familymart',
            'lawson', 'carrefour', 'superindo', 'hypermart', 'giant',
            'transmart', 'indomaret', 'alfamart', 'mcdonald', "mcd",
            'kfc', 'starbucks', 'hokben', 'burger king', 'pizza hut',
            'grab', 'gojek', 'shopee', 'tokopedia', 'lazada',
            'seven eleven', '7-eleven', 'cvs', 'guardian', 'watsons',
            'century', 'apotek', 'rs', 'rumah sakit'
        ]

    def sanitize_number(self, val_str: str) -> float:
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
        
        # Remove non-digits
        cleaned = self.clean_digit.sub('', val_str)
        return float(cleaned) if cleaned else 0.0

    def is_likely_item_line(self, line: str) -> bool:
        """Check if line is likely an item (has price-like numbers)."""
        # Skip if it's a header/footer marker
        skip_words = ['diskon', 'promo', 'potongan', 'kembalian', 'tunai', 
                     'card', 'master', 'visa', 'debit', 'credit', 'qr',
                     'ppn', 'tax', 'service', 'charge', 'member', 'poin',
                     'welcome', 'thank', 'struk', 'receipt', 'transaksi']
        
        line_lower = line.lower()
        if any(word in line_lower for word in skip_words):
            return False
        
        # Must have at least some digits
        if not re.search(r'\d', line):
            return False
        
        return True

    def extract_numbers_from_line(self, line: str) -> List[str]:
        """RTL Tokenization: Extract numeric tokens from right to left."""
        tokens = line.split()
        numeric_tokens = []
        text_tokens = []
        
        # Process tokens from right to left
        for token in reversed(tokens):
            num_val = self.sanitize_number(token)
            
            # If it's a valid price/number and we don't have too many
            if num_val > 0 and len(numeric_tokens) < 3:
                numeric_tokens.append(token)
            else:
                text_tokens.append(token)
        
        # Reverse back to correct order
        numeric_tokens.reverse()
        text_tokens.reverse()
        
        return {
            'numbers': numeric_tokens,
            'text': ' '.join(text_tokens),
            'parsed_numbers': [self.sanitize_number(n) for n in numeric_tokens]
        }

    def parse(self, raw_lines: List[str]) -> Dict[str, Any]:
        """Main parsing function with state machine."""
        
        items = []
        subtotal = 0.0
        discount_total = 0.0
        total_amount = 0.0
        merchant_name = "Unknown Merchant"
        address_lines = []
        payment_method = "Cash"
        
        name_buffer = []
        in_items_section = False
        header_done = False
        has_discount = False
        
        for index, line in enumerate(raw_lines):
            line_str = line.strip()
            if not line_str:
                continue
            
            line_upper = line_str.upper()
            
            # === HEADER DETECTION ===
            if not header_done:
                # Merchant name detection
                for pattern in self.merchant_patterns:
                    line_lower = line_str.lower()
                    if pattern in line_lower:
                        merchant_name = line_str.title()
                        break
                
                # Address detection
                if 'JL.' in line_upper or 'JALAN' in line_upper:
                    address_lines.append(line_str)
                
                # Date or item-like content marks end of header
                if self.pat_date.search(line_str) or index > 5:
                    header_done = True
                    in_items_section = True
                    continue
            
            # === FOOTER DETECTION ===
            if self.pat_footer.search(line_str):
                in_items_section = False
                
                if 'TOTAL' in line_upper and 'DISCOUNT' not in line_upper:
                    total_amount = self.sanitize_number(line_str)
                elif 'HARGA JUAL' in line_upper or 'SUBTOTAL' in line_upper:
                    subtotal = self.sanitize_number(line_str)
                elif 'TUNAI' in line_upper:
                    payment_method = 'Cash'
                continue
            
            # === DISCOUNT/PROMO LINE ===
            if 'DISKON' in line_upper or 'PROMO' in line_upper or 'POTONGAN' in line_upper:
                has_discount = True
                disc_val = self.sanitize_number(line_str)
                if disc_val > 0:
                    discount_total += disc_val
                continue
            
            # === PAYMENT METHOD DETECTION ===
            payment_methods = {
                'gopay': 'GoPay', 'dana': 'DANA', 'ovo': 'OVO',
                'shopee pay': 'ShopeePay', 'shopeepay': 'ShopeePay',
                'linkaja': 'LinkAja', 'qris': 'QRIS',
                'debit': 'Debit', 'cash': 'Cash', 'tunai': 'Cash',
                'credit': 'Credit', 'kartu kredit': 'Credit Card'
            }
            for pattern, method in payment_methods.items():
                if pattern in line_lower:
                    payment_method = method
                    break
            
            # === ITEM PARSING (RTL Tokenization) ===
            if in_items_section and self.is_likely_item_line(line_str):
                parsed = self.extract_numbers_from_line(line_str)
                
                if parsed['numbers']:
                    nums = parsed['parsed_numbers']
                    
                    # Determine quantity, unit price, total price
                    if len(nums) == 3:
                        qty = int(nums[0]) if nums[0] <= 99 else 1
                        unit_price = nums[1]
                        total_price = nums[2]
                    elif len(nums) == 2:
                        qty = 1
                        # Check if first is quantity (small) or part of price
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
                    
                    # Build full item name from buffer
                    full_name = ' '.join(name_buffer + [parsed['text']]).strip()
                    name_buffer = []
                    
                    # Only add if looks like a real item
                    if total_price >= 100 and len(full_name) > 1:
                        items.append({
                            'name': full_name,
                            'quantity': qty,
                            'price_per_unit': unit_price,
                            'total_price': total_price
                        })
                else:
                    # Buffer multi-line item names
                    if len(name_buffer) < 2:
                        name_buffer.append(line_str)
            
            elif not in_items_section and line_str:
                # Buffer potential multi-line item names
                if len(name_buffer) < 2:
                    name_buffer.append(line_str)

        # === MATHEMATICAL GUARDRAILS ===
        sum_items = sum(item['total_price'] for item in items)
        
        # If TOTAL is missing/zero, calculate from items
        if total_amount == 0.0:
            if subtotal > 0:
                total_amount = subtotal
            else:
                total_amount = sum_items - discount_total if sum_items > discount_total else sum_items
        
        # If subtotal missing, use sum of items
        if subtotal == 0.0 and items:
            subtotal = sum_items

        return {
            'merchant_name': merchant_name,
            'address': ' '.join(address_lines) if address_lines else None,
            'payment_method': payment_method,
            'subtotal': subtotal,
            'discount_total': discount_total,
            'amount': total_amount,
            'items': items,
            'items_count': len(items)
        }


def parse_receipt_text(raw_lines: List[str]) -> Dict[str, Any]:
    """Convenience function for parsing receipt text."""
    engine = RobustReceiptParserEngine()
    return engine.parse(raw_lines)
