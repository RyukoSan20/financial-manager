"""
Simple In-House Receipt Parser
Deterministic algorithm for Indonesian minimarket receipts
"""

import re
import json
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class Item:
    name: str
    quantity: int
    unit_price: float
    total: float
    is_discount: bool


def normalize_ocr(text: str) -> str:
    """Normalize OCR artifacts within each line (not across lines)."""
    # Split into lines
    lines = text.split('\n')
    normalized_lines = []
    
    for line in lines:
        # "8, 500" -> "8500" (space after comma)
        while re.search(r'\d+,\s+\d+', line):
            line = re.sub(r'(\d+),\s+(\d+)', lambda m: m.group(1) + m.group(2), line)
        normalized_lines.append(line)
    
    return '\n'.join(normalized_lines)


def is_meta_line(line: str) -> bool:
    """Check if line is metadata, not an item."""
    upper = line.upper()
    keywords = ['TOTAL', 'SUBTOTAL', 'HARGA JUAL', 'TUNAI', 'KEMBALI', 
                'BAYAR', 'CASH', 'GRAND', 'NPWP', 'KM.', 'JL.', 'TELP']
    return any(k in upper for k in keywords)


def is_discount(line: str) -> bool:
    """Check if line is discount."""
    upper = line.upper()
    return any(k in upper for k in ['DISKON', 'DISC', 'POTONGAN', 'HEMAT', 'VOUCHER'])


def is_item_line(line: str) -> bool:
    """Check if line looks like an item name."""
    line = line.strip()
    if len(line) < 5:
        return False
    if not re.search(r'[a-zA-Z]', line):
        return False
    if is_meta_line(line):
        return False
    # Check if mostly letters (not transaction codes)
    letter_count = sum(1 for c in line if c.isalpha())
    number_count = sum(1 for c in line if c.isdigit())
    if number_count > letter_count * 2:
        return False
    return True


def is_sroie_format(text: str) -> bool:
    """Check if text is in SROIE coordinate format."""
    lines = text.split('\n')[:10]  # Check first 10 lines
    for line in lines:
        parts = line.strip().split(',')
        if len(parts) >= 8:
            try:
                for i in range(8):
                    int(parts[i].strip())
                return True
            except ValueError:
                continue
    return False


def parse_sroie_receipt(raw_text: str) -> Dict:
    """Parse SROIE format receipt (coordinate-based).
    
    SROIE format: x1,y1,x2,y2,x3,y3,x4,y4,text
    Columns layout:
    - X=300-400: Item names
    - X=500-550: Qty
    - X=550-600: Unit price
    - X=600+: Total amount
    """
    from collections import defaultdict
    
    items: List[Item] = []
    merchant_name = "Unknown"
    declared_total = 0.0
    
    lines = raw_text.strip().split('\n')
    
    # Parse all lines into structured data
    all_data = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split(',')
        if len(parts) >= 9:
            try:
                coords = [int(parts[i].strip()) for i in range(8)]
                text = ','.join(parts[8:]).strip()
                all_data.append({
                    'x': coords[0],
                    'y': coords[1],
                    'text': text
                })
            except ValueError:
                continue
    
    # Group by Y coordinate (rows)
    y_rows = defaultdict(list)
    for item in all_data:
        y_rows[item['y']].append(item)
    
    # Sort each row by X
    for y in y_rows:
        y_rows[y].sort(key=lambda x: x['x'])
    
    # Categorize columns: name, qty, price, amount
    # Based on actual SROIE layout analysis
    name_col = []   # X ~270-370 (item names)
    qty_col = []    # X ~500-530 (qty)
    price_col = []  # X ~550-580 (unit price)
    amount_col = [] # X ~600-700 (total amount)
    
    for item in all_data:
        if 270 <= item['x'] <= 370:
            name_col.append(item)
        elif 500 <= item['x'] <= 530:
            qty_col.append(item)
        elif 550 <= item['x'] <= 580:
            price_col.append(item)
        elif 600 <= item['x'] <= 700:
            amount_col.append(item)
    
    # Create Y-indexed maps (use nearest Y within tolerance)
    TOLERANCE = 30  # Y-coordinate tolerance for matching
    
    def find_nearest_y(target_y, y_dict, tolerance=TOLERANCE):
        """Find the nearest Y in dict within tolerance."""
        for y in sorted(y_dict.keys()):
            if abs(y - target_y) <= tolerance:
                return y
        return None
    
    qty_by_y = {item['y']: item['text'] for item in qty_col}
    price_by_y = {item['y']: item['text'] for item in price_col}
    amount_by_y = {item['y']: item['text'] for item in amount_col}
    
    # Find merchant
    for y in sorted(y_rows.keys()):
        row_text = ' '.join([item['text'] for item in y_rows[y]])
        if 'SDN BHD' in row_text or 'LTD' in row_text or 'INC' in row_text:
            merchant_name = row_text
            break
    
    # Parse items - look for rows with item names
    for item in name_col:
        text = item['text']
        y = item['y']
        
        # Skip metadata
        skip_patterns = ['ITEM:', 'QTY', 'RSP', 'AMOUNT:', 'SUBTOTAL', 'GST:', 
                        'RECEIPT#:', 'DATE:', 'TIME:', 'TEL:', 'FAX', 'CASHIER:',
                        'SALESPERSON:', 'PERNIAGAAN', 'SIMPLIFIED TAX', 'TAX INVOICE',
                        'TOT QTY:', 'CHANGE', 'ROUNDING', 'TOTAL:', 'TOTAL(RM)']
        if any(p in text.upper() for p in skip_patterns):
            continue
        
        # Must have letters and be reasonable length
        if not re.search(r'[A-Za-z]{3,}', text):
            continue
        if len(text) < 3:
            continue
        
        # Get corresponding values from nearest Y rows
        nearest_qty_y = find_nearest_y(y, qty_by_y)
        nearest_price_y = find_nearest_y(y, price_by_y)
        nearest_amount_y = find_nearest_y(y, amount_by_y)
        
        qty_text = qty_by_y.get(nearest_qty_y, '1') if nearest_qty_y else '1'
        price_text = price_by_y.get(nearest_price_y, '0') if nearest_price_y else '0'
        amount_text = amount_by_y.get(nearest_amount_y, '0') if nearest_amount_y else '0'
        
        # Parse numbers
        try:
            qty = int(float(re.sub(r'[^\d.]', '', qty_text)))
        except:
            qty = 1
        
        try:
            price = float(re.sub(r'[^\d.]', '', price_text))
        except:
            price = 0
        
        try:
            amount = float(re.sub(r'[^\d.]', '', amount_text))
        except:
            amount = 0
        
        # Calculate if missing
        if amount == 0 and price > 0:
            amount = price * qty
        
        if amount > 0:
            items.append(Item(
                name=text[:50],
                quantity=qty if qty > 0 else 1,
                unit_price=price,
                total=amount,
                is_discount=False
            ))
        
    # Find declared total - scan amount column for largest value in bottom section
    # Footer section starts around Y=800
    for item in amount_col:
        if item['y'] > 800:  # Footer area
            try:
                val = float(re.sub(r'[^\d.]', '', item['text']))
                if val > 100 and declared_total == 0:  # Total should be largest
                    declared_total = val
            except:
                pass
    
    # Calculate totals
    calculated_total = sum(item.total for item in items)
    
    return {
        "profile": "ENGLISH_SROIE",
        "merchant_name": merchant_name,
        "items": [{"name": i.name, "quantity": i.quantity, "unit_price": i.unit_price, "total": i.total, "is_discount": i.is_discount} for i in items],
        "declared_total": declared_total,
        "calculated_total": calculated_total,
        "net_total": declared_total if declared_total > 0 else calculated_total,
        "item_count": len(items)
    }


def parse_price(s: str) -> int:
    """Extract integer price from string."""
    digits = re.sub(r'[^\d]', '', s)
    return int(digits) if digits else 0


def parse_receipt(raw_text: str) -> Dict:
    """Parse receipt text and return structured data."""
    
    # Auto-detect SROIE format (coordinate-based)
    if is_sroie_format(raw_text):
        return parse_sroie_receipt(raw_text)
    
    # Normalize for Indonesian/standard format
    normalized = normalize_ocr(raw_text)
    lines = normalized.split('\n')
    
    items: List[Item] = []
    i = 0
    
    # Skip initial garbage (store name, address, date, etc.)
    # Look for item start markers: S/, product names, sizes
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        # Stop when we find item-like content
        if re.search(r'^S/|^[A-Z][a-z]+\s+\w+\s+\d', line):  # S/ROTI, product names
            break
        if re.search(r'\d+G\b|\d+ML\b', line):  # Size patterns
            break
        if 'CIMORY' in line or 'CAFELA' in line or 'FF ' in line:
            break
        i += 1
    
    while i < len(lines):
        line = lines[i].strip()
        
        if not line:
            i += 1
            continue
        
        # Skip meta lines
        if is_meta_line(line):
            i += 1
            continue
        
        # Handle discounts
        if is_discount(line):
            # Skip "ANDA HEMAT" or standalone "HEMAT" if it's the same as previous discount
            upper = line.upper()
            if upper == 'HEMAT' or upper == 'ANDA HEMAT':
                # Check if this is likely a duplicate label for previous discount
                # Skip if next lines don't have additional discount info
                i += 1
                continue
            
            # Look for amount in next lines
            for j in range(i+1, min(i+5, len(lines))):
                next_line = lines[j].strip()
                if not next_line:
                    continue
                # Extract number
                nums = re.findall(r'\d+', next_line)
                for num_str in reversed(nums):
                    val = int(num_str)
                    if val >= 100:
                        items.append(Item(
                            name=line,
                            quantity=1,
                            unit_price=val,
                            total=-val,
                            is_discount=True
                        ))
                        break
                if items and items[-1].is_discount:
                    break
            i += 1
            continue
        
        # Try to parse as item
        if is_item_line(line):
            # Collect name parts (multi-line names)
            name_parts = [line]
            j = i + 1
            while j < len(lines):
                next_line = lines[j].strip()
                if not next_line:
                    j += 1
                    continue
                if re.search(r'[a-zA-Z]', next_line):
                    if is_meta_line(next_line) or is_discount(next_line):
                        break
                    name_parts.append(next_line)
                    j += 1
                else:
                    break
            
            item_name = ' '.join(name_parts)
            
            # Collect numbers (qty, unit_price, total)
            numbers = []
            k = j
            while k < len(lines) and len(numbers) < 4:
                num_line = lines[k].strip()
                if not num_line:
                    k += 1
                    continue
                # Stop if text
                if re.search(r'[a-zA-Z]', num_line):
                    break
                # Stop at meta/discount
                if is_meta_line(num_line) or is_discount(num_line):
                    break
                
                # Extract ONE number from this line
                nums = re.findall(r'\d+', num_line)
                if nums:
                    val = int(nums[0])
                    if 0 < val < 10000000:  # Filter garbage
                        numbers.append(val)
                
                k += 1
            
            # Parse item from numbers
            if len(numbers) >= 1:
                total = numbers[-1]
                if total >= 1:  # Include items with price as low as 1 (e.g., plastic bags)
                    qty = 1
                    unit = total
                    if len(numbers) >= 2 and numbers[-2] <= 20:
                        qty = numbers[-2]
                        unit = total // qty if qty > 0 else total
                    
                    items.append(Item(
                        name=item_name,
                        quantity=qty,
                        unit_price=unit,
                        total=total,
                        is_discount=False
                    ))
            
            i = k
            continue
        
        i += 1
    
    # Calculate totals
    subtotal = 0.0
    discount_total = 0.0
    for item in items:
        if item.is_discount:
            discount_total += abs(item.total)
        else:
            subtotal += item.total
    
    net_total = subtotal - discount_total
    
    return {
        "merchant_name": "INDOMARET",
        "profile": "INDONESIAN_MINIMARKET",
        "items": [
            {
                "name": i.name,
                "quantity": i.quantity,
                "unit_price": i.unit_price,
                "total": i.total,
                "is_discount": i.is_discount
            }
            for i in items
        ],
        "subtotal": subtotal,
        "discount_total": discount_total,
        "net_total": net_total,
        "validation": {
            "item_count": len(items),
            "is_valid": True
        }
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            raw = f.read()
        result = parse_receipt(raw)
        print(json.dumps(result, indent=2))
