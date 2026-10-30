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

from app.services.receipt_text import normalize_printed_amounts

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
    """
    Clean a receipt line: remove the currency mark, and put the
    numbers back together.

    A receipt from a thermal printer lays the characters out in a
    fixed width grid, so the amount 33.900 is read as "33, 900" or
    "33 900". The parser then reads "33" as the amount and misses the
    900, and the reader is told their shopping cost 33 rupiah.

    The numbers are put back together first, here, so that nothing
    downstream has to know about the grid.
    """
    if not line:
        return ""
    line = str(line).strip()

    # Put the printed numbers back together, before the currency mark
    # is removed, so the amount is whole when the mark is taken off.
    line = normalize_printed_amounts(line)

    # Remove currency prefix
    line = re.sub(r'(?i)\b(rp|idr)\.?\s*', '', line)

    # A number that is left with a thousands separator written as a
    # dot is read as one number, not as a decimal. The dot is kept
    # here, because the amount helpers downstream know what to do with
    # it, and the reader is never shown a raw dot.

    return re.sub(r'\s+', ' ', line).strip()


def parse_number_indonesia(val_str: str) -> float:
    """
    Read a number written the way money is written in Indonesia.

    - Thousand separators: 18.000 -> 18000
    - The written form with a decimal point: 200.000,00 -> 200000
    - A dot that is not a thousands group is a decimal point:
      12.50 -> 12.5
    - Discount parentheses: (1,300) -> -1300 or (1) -> -1

    The two separators are told apart by where they are. A dot that
    groups three digits and is followed by more groups is a thousands
    separator. Anything else is a decimal point.

    Getting this wrong is not a small mistake. "Rp 200.000,00" read as
    two hundred million instead of two hundred thousand tells the
    reader that their withdrawal was a thousand times bigger than it
    was.
    """
    if not val_str:
        return 0.0

    val_str = str(val_str).strip()

    # Check for discount parentheses (negative)
    is_negative = '(' in val_str and ')' in val_str

    # Take out everything that is not part of the number, and keep
    # the separators for a moment.
    clean = re.sub(r'[^\d.,]', '', val_str)
    if not clean:
        return 0.0

    has_comma = ',' in clean
    has_dot = '.' in clean

    if has_comma and has_dot:
        # Written the Indonesian way: 1.234.567,50
        if clean.rfind(',') > clean.rfind('.'):
            # The comma comes last, so it is the decimal point.
            whole = clean.replace('.', '').replace(',', '.')
        else:
            # The dot comes last, so it is the decimal point.
            whole = clean.replace(',', '')
    elif has_comma:
        # Either 1,234,567 or 12,50
        if re.fullmatch(r'\d{1,3}(,\d{3})+', clean):
            whole = clean.replace(',', '')
        else:
            whole = clean.replace(',', '.')
    elif has_dot:
        # Either 1.234.567 or 12.50
        if re.fullmatch(r'\d{1,3}(\.\d{3})+', clean):
            whole = clean.replace('.', '')
        else:
            whole = clean
    else:
        whole = clean

    try:
        value = float(whole)
    except ValueError:
        return 0.0

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
    The shop this receipt is from.

    The shop is read off the receipt rather than looked up in a list.
    The list could not grow: a receipt from a shop nobody had thought
    of came back as "Unknown Merchant", and the reader had to fix it by
    hand every single time.

    The list is still consulted, because a shop that is already known
    is worth recognising straight away, but it is only a starting
    point. What the receipt itself says comes first when it is clear
    enough, and the words a machine prints at the end of a receipt are
    never taken for a shop.
    """
    upper_text = full_text.upper()

    # The shop as the receipt says it. A company name at the top, or
    # the name after "dibayarkan ke", is more certain than a list
    # entry, because it is what this receipt actually says.
    from app.services.catalog_autodiscovery import best_merchant

    lines = [line for line in full_text.split("\n") if line.strip()]
    candidate = best_merchant(lines)
    if candidate is not None and candidate.source in ("company_line", "paid_to"):
        return candidate.name

    for pattern, name in MERCHANT_PATTERNS:
        if re.search(pattern, upper_text, re.IGNORECASE):
            return name

    # A name read from the receipt, even if it is not certain. It is
    # better than "Unknown Merchant", and the reader can change it.
    if candidate is not None:
        return candidate.name

    return "Unknown Merchant"


# ============================================================
# STAGE 3: SINGLE-LINE ITEM PARSING
# ============================================================

# A number in the middle of a word of text.
#
# The separator in a number is a comma or a dot, and the digits either
# side of it have to be there: "8,500" is one number and "8,50" is one
# number, while "TOTAL" is not a number at all.
_NUMBER_TOKEN = re.compile(r'^\d[\d.,]*\d$|^\d$')

# A word with a number stuck to it: "72G", "225ML", "4.000KG". The
# number is part of the name and not a price.
_WORD_WITH_NUMBER = re.compile(r'^[A-Za-z][\w]*\d[\w.]*$')


def _split_into_words_and_numbers(text):
    """
    Split a line into its numbers and its words.

    A number is one piece even when it has a thousands separator in
    it. The amount 8.500 is printed as "8,500" and splitting it in two
    made the parser read the price as 500 and lose the eight - so the
    reader was told their shopping cost 500 instead of 8.500.

    Returns a list of (is_number, piece) in the order they were
    printed.
    """
    pieces = []
    for word in text.split():
        # "8,500" or "50.000.000" - one number.
        if _NUMBER_TOKEN.match(word):
            pieces.append((True, word))
            continue
        # "8," or "500," - a number that the printer put a separator
        # next to. The separator is not part of the number.
        stripped = word.rstrip(",.")
        if stripped and _NUMBER_TOKEN.match(stripped):
            pieces.append((True, stripped))
            continue
        pieces.append((False, word))
    return pieces


def _is_a_product_code(piece: str) -> bool:
    """
    Is this a product code rather than an amount of money?

    A supermarket prints the code of the product before its name, and
    the code is a long run of digits. A price is never that long
    without a separator in it, so a bare run of seven digits or more
    is a code.

    The codes are the numbers at the LEFT of the line, and this is
    only ever asked about the leftmost one.
    """
    digits = piece.replace(".", "").replace(",", "")
    if not digits.isdigit():
        return False
    if len(digits) < 7:
        return False
    # A price is written with a separator in it. A code is not.
    return "." not in piece and "," not in piece


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
                 'DISKON', 'BAYAR', 'TAGIHAN', 'SALDO', 'REF ',
                 'JUMLAH', 'QTY', 'ITEM', 'ITEMS', 'TOA', 'KUANTITAS']
    for kw in blacklist:
        if kw in upper_clean:
            return None
    
    # The line is split into words and numbers.
    #
    # A number is one token even when it has a separator in it. The
    # amount 8.500 is written as "8,500" on a receipt, and splitting
    # it into two made the parser read the price as 500 and lose the
    # eight. So the split is done on the separators that are not part
    # of a number.
    numeric_parts = []
    text_parts = []
    
    for is_number, part in _split_into_words_and_numbers(cleaned):
        if is_number:
            numeric_parts.append(part)
        else:
            text_parts.append(part)
    
    # Need at least 1 number (price 1 for plastic bags)
    if len(numeric_parts) < 1:
        return None
    
    # Parse numbers from RIGHT
    numbers = [parse_number_indonesia(n) for n in numeric_parts]

    # A supermarket prints the product's code before the name. The
    # code is a long run of digits and it is not money.
    #
    # It was read as the price, so a line whose price was 103.390 was
    # priced at 35.597.816 and the total of the receipt came out as
    # forty-three million instead of half a million.
    if len(numeric_parts) > 1 and _is_a_product_code(numeric_parts[0]):
        numeric_parts = numeric_parts[1:]
        numbers = numbers[1:]

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

    # A code that was printed as part of the name is not part of the
    # name. "61836173 GREENFIELDS" is GREENFIELDS.
    if name_parts and _is_a_product_code(name_parts[0]):
        name_parts = name_parts[1:]
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
# FINDING THE TOTAL
# ============================================================

# The words a receipt uses for the amount that was actually paid.
#
# "TOTAL" on its own is only one of them. A supermarket receipt says
# "TOTAL BELANJA", a receipt from a machine says "TOTAL BAYAR", a
# school receipt says "JUMLAH", and an ATM slip says "Nominal". A
# parser that knows only "TOTAL" reads nothing on those, and tells
# the reader their receipt was worth nothing.
TOTAL_LABELS = (
    "TOTAL",
    "JUMLAH",
    "NOMINAL",
    "GRAND TOTAL",
    "TOTAL BAYAR",
    "TOTAL BELANJA",
    "TOTAL HARUS BAYAR",
    "JUMLAH BAYAR",
    "JUMLAH BELANJA",
    "AMOUNT",
    "TOTAL AMOUNT",
    # A supermarket prints the total as the count of items and the sum
    # of them: "15 ITEMS TOA, : 503.510". That line is the total, and
    # it is the only place the real figure appears.
    "ITEMS TOA",
    "ITEM TOA",
    "ITEM TO A",
)

# Words that look like a total but are not one. They are checked
# first, because "TOTAL QTY" holds a count and "SUBTOTAL" holds the
# price before the discount.
NOT_A_TOTAL = (
    "SUBTOTAL",
    "SUB TOTAL",
    "TOTAL QTY",
    "TOTAL ITEM",
    "TOTAL ITEM(S)",
    "TOTAL BARANG",
    "HARGA JUAL",
    "HARGA",
    "PPN",
    "DISKON",
    "DISC",
    "VOUCHER",
    "VOUCHER BERLAKU",
    "TUNAI",
    "CASH",
    "KEMBALI",
    "CHANGE",
    "NO. ",
    "NO:",
)


def _numbers_in(line):
    """
    The numbers on a line, read the way this parser reads them.

    The numbers are returned in the order they were printed, so that
    the caller can choose between the first and the biggest.
    """
    found = []
    for piece in re.findall(r"[\d][\d.,]*", line):
        value = parse_number_indonesia(piece)
        if value > 0:
            found.append(value)
    return found


def _is_an_item_count_line(upper: str) -> bool:
    """
    Is this the line that says how many items there were?

    A restaurant prints "ITEMS: 8 212,733" - the count and the sum.
    The count is not money.
    """
    if "ITEM" not in upper:
        return False
    return upper.startswith("ITEMS") or upper.startswith("ITEM ") or " ITEMS" in upper


def find_total(lines):
    """
    Work out what the receipt came to.

    The label and the amount are looked for together, and the amount
    may be on the line after the label: a thermal printer runs them
    together, but a receipt printed on paper puts them apart.

    On the line that is found, the biggest number is taken rather than
    the last one. A receipt line often holds a voucher and a change
    beside the total, and the total is the biggest of them.

    Returns (amount, line_index) or (0.0, None).
    """
    for index, raw in enumerate(lines):
        cleaned = normalize_receipt_line(raw)
        if not cleaned:
            continue

        upper = cleaned.upper()

        # A line that says what is NOT the total wins over one that
        # says what is. "TOTAL QTY 3" holds a count, and the count is
        # the smaller number, so reading it as the amount would tell
        # the reader their shopping cost three rupiah.
        if any(bad in upper for bad in NOT_A_TOTAL):
            continue

        # "ITEMS: 8 212,733" holds the number of items and the sum of
        # them, and the sum is the money. The count is the smaller of
        # the two, so the biggest is taken.
        if _is_an_item_count_line(upper):
            counts = _numbers_in(cleaned)
            if len(counts) >= 2:
                return max(counts), index

        if not any(good in upper for good in TOTAL_LABELS):
            continue

        numbers = _numbers_in(cleaned)
        if numbers:
            return max(numbers), index

        # The label is on its own. The amount is on the next line.
        for ahead in range(index + 1, min(index + 3, len(lines))):
            next_line = normalize_receipt_line(lines[ahead])
            if not next_line:
                continue
            next_numbers = _numbers_in(next_line)
            if next_numbers:
                return max(next_numbers), ahead

    return 0.0, None


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
                    #
                    # The same rules as everywhere else: a line that
                    # says what is not a total is not read as one, and
                    # the biggest number on the line is the total.
                    # "TOTAL QTY 3" is a count of the items, and
                    # reading it as the amount told the reader their
                    # shopping cost three rupiah.
                    if total == 0:
                        line_total, _ = find_total([cleaned])
                        if line_total > 0:
                            total = line_total
                    
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
            
            # The total is looked for across the whole receipt, not
            # only in the footer.
            #
            # A receipt is not always laid out so that the total ends
            # up in the footer. There is no separator line on some of
            # them, and on others the total sits above the payment
            # line. Looking in the footer only meant that a receipt
            # which had a perfectly good TOTAL on it was read as
            # having no total at all.
            found_total, _found_at = find_total(lines)
            if found_total > 0:
                total = found_total

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
