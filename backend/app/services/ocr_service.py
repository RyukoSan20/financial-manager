"""
Advanced OCR Service using Tesseract + AI-powered transaction parsing.
Supports Indonesian receipts, SMS, and multi-language OCR.
"""

import io
import re
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
import base64

from PIL import Image
import pytesseract


@dataclass
class ReceiptField:
    """Extracted field from receipt."""
    field_name: str
    value: str
    confidence: float
    position: Optional[Tuple[int, int, int, int]] = None


@dataclass
class ParsedReceipt:
    """Structured receipt data."""
    merchant_name: Optional[str] = None
    total_amount: Optional[Decimal] = None
    date: Optional[datetime] = None
    items: List[Dict] = None
    payment_method: Optional[str] = None
    card_number: Optional[str] = None
    tax_amount: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    receipt_number: Optional[str] = None
    raw_text: str = ""
    confidence_score: float = 0.0
    category_hint: Optional[str] = None  # AI-suggested category
    
    def __post_init__(self):
        if self.items is None:
            self.items = []


class IndonesianReceiptParser:
    """
    Parser khusus untuk struk/kwitansi Indonesia.
    Optimized patterns untuk merchant Indonesia.
    """
    
    # Pola untuk nama merchant
    MERCHANT_PATTERNS = [
        r'^(TOKO|TOKO|Toko)[:\s]*([A-Za-z0-9\s&,\.]+)',
        r'^([A-Z][A-Z\s&,\.]+?)(?:\s+\d|\s*$|\s+NAMA)',  # All caps name at start
        r'(?:NAMA\s*(?:TOKO|MERCHANT|STORE)?)[:\s]*([A-Za-z0-9\s&,\.]+)',
        r'(?:MERCHANT)[:\s]*([A-Za-z0-9\s&,\.]+)',
        # Common Indonesian merchants
        r'(ALFAMART|INDOMARET|MINI\s*MARKET|Alfamart|Indomaret)[:\s-]*([A-Za-z0-9\s]*)',
        r'(MCDONALD|McDonald|MCD)[:\s]*([A-Za-z0-9\s]*)',
        r'(STARBUCKS|STARBUCK)[:\s]*([A-Za-z0-9\s]*)',
        r'(GOJEK|GRAB|Grab)[:\s]*([A-Za-z0-9\s]*)',
        r'(WARKOP|KEDAI|KAFE|CAFE|RESTORAN|WARUNG)[:\s]*([A-Za-z0-9\s]*)',
    ]
    
    # Pola untuk jumlah total
    TOTAL_PATTERNS = [
        r'(?:TOTAL|JUMLAH|SUB\s*TOTAL|GRAND\s*TOTAL|Bayar|harus\s*dibayar)[:\s]*Rp?\s*([\d,\.]+)',
        r'(?:Rp\s*)?([\d,\.]+)\s*(?:TOTAL|BAYAR|JUMLAH|$)',
        r'(?:Rp\s*)?([\d,\.]+)\s*[-=]\s*(?:Rp\s*)?([\d,\.]+)',  # Subtotal = Total
        r'(?:TOTAL|BAYAR)[:\s]*\s*([\d,\.]+)',
        r'(?:Rp\.?\s*)?([\d]{1,3}(?:[.,]\d{3})*)',
    ]
    
    # Pola tanggal Indonesia
    DATE_PATTERNS = [
        r'(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})',
        r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agt|Aug|Sep|Oct|Nov|Des)[a-z]*\s+(\d{4})',
        r'(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})',
    ]
    
    # Pola metode pembayaran
    PAYMENT_METHOD_PATTERNS = [
        r'(?:CASH|TUNAI|DEBIT|KREDIT|CARD|ECASH|OVO|GOPAY|DANA|QRIS)',
        r'(?:PEMBAYARAN|METODE)[:\s]*([A-Za-z]+)',
    ]
    
    # Pola nomor kartu
    CARD_PATTERNS = [
        r'\*+(\d{4})\s*\*+(\d{4})\s*\*+(\d{4})\s*\*+(\d{4})',
        r'(?:CARD|MC|VISA)[:\s]*([\d\*]+)',
    ]
    
    # Pola nomor telepon
    PHONE_PATTERNS = [
        r'(?:TELP?|TEL|HP|PHONE)[:\s]*([\d\-\s]+)',
        r'0\d{2,4}[-\s]?\d{3,4}[-\s]?\d{3,4}',
    ]
    
    # Pola alamat
    ADDRESS_PATTERNS = [
        r'(?:JL|JALAN|JL\.|ALAMAT|ADDRESS)[:\s.]*([A-Za-z0-9\s.,\-]+?)(?:\d{5}|\n|$)',
        r'(?:KOTA|KECAMATAN|KELURAHAN)[:\s]*([A-Za-z0-9\s,\-]+)',
    ]
    
    def __init__(self):
        self.month_map = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
            'mei': 5, 'jun': 6, 'jul': 7, 'agt': 8, 'aug': 8,
            'sep': 9, 'oct': 10, 'nov': 11, 'des': 12
        }
    
    def parse_amount(self, amount_str: str) -> Optional[Decimal]:
        """Convert amount string to Decimal."""
        if not amount_str:
            return None
        # Remove Rp, spaces, dots (thousand separator), replace comma with dot
        cleaned = amount_str.replace('Rp', '').replace(' ', '').replace('.', '').replace(',', '.')
        # Remove any non-numeric except dot
        cleaned = re.sub(r'[^\d.]', '', cleaned)
        if not cleaned:
            return None
        try:
            return Decimal(cleaned)
        except:
            return None
    
    def parse_date(self, text: str) -> Optional[datetime]:
        """Extract date from text."""
        for pattern in self.DATE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    groups = match.groups()
                    if len(groups) == 3:
                        # Check if it's YYYY-MM-DD or DD-MM-YYYY
                        if len(groups[0]) == 4:  # YYYY-MM-DD
                            return datetime(int(groups[0]), int(groups[1]), int(groups[2]))
                        else:
                            day, month, year = int(groups[0]), int(groups[1]), int(groups[2])
                            if year < 100:
                                year += 2000
                            # Handle month name
                            if isinstance(groups[1], str) and not groups[1].isdigit():
                                month = self.month_map.get(groups[1][:3].lower(), 1)
                            return datetime(year, month, day)
                except (ValueError, IndexError):
                    continue
        return None
    
    def extract_merchant(self, lines: List[str]) -> Tuple[Optional[str], float]:
        """Extract merchant name from first few lines."""
        for i, line in enumerate(lines[:10]):
            line = line.strip()
            if len(line) < 3:
                continue
            # Skip lines that are mostly numbers or special chars
            if sum(c.isdigit() for c in line) > len(line) * 0.5:
                continue
            # Try merchant patterns
            for pattern in self.MERCHANT_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    groups = match.groups()
                    merchant = groups[-1].strip() if groups else line
                    if len(merchant) > 2:
                        return merchant, 0.85
            # Fallback: all caps line
            if line.isupper() and len(line) > 3 and len(line) < 50:
                return line, 0.70
        return None, 0.0
    
    def extract_total(self, text: str) -> Tuple[Optional[Decimal], float]:
        """Extract total amount from text."""
        amounts = []
        
        for pattern in self.TOTAL_PATTERNS:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                groups = match.groups()
                for g in groups:
                    if g:
                        amount = self.parse_amount(g)
                        if amount and amount > 0:
                            amounts.append((amount, match.start()))
        
        if not amounts:
            return None, 0.0
        
        # Take the largest amount (usually the total)
        amounts.sort(key=lambda x: x[0], reverse=True)
        return amounts[0]
    
    def extract_payment_method(self, text: str) -> Tuple[Optional[str], float]:
        """Extract payment method from text."""
        text_upper = text.upper()
        
        if 'QRIS' in text_upper:
            return 'QRIS', 0.95
        if 'OVO' in text_upper:
            return 'OVO', 0.95
        if 'GOPAY' in text_upper or 'GOJEK' in text_upper:
            return 'GOPAY', 0.95
        if 'DANA' in text_upper:
            return 'DANA', 0.95
        if 'CASH' in text_upper or 'TUNAI' in text_upper:
            return 'CASH', 0.90
        if 'DEBIT' in text_upper:
            return 'DEBIT', 0.85
        if 'KREDIT' in text_upper or 'CARD' in text_upper:
            return 'KREDIT', 0.85
        
        return None, 0.0
    
    def extract_card_number(self, text: str) -> Optional[str]:
        """Extract masked card number."""
        for pattern in self.CARD_PATTERNS:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        return None
    
    def extract_phone(self, text: str) -> Optional[str]:
        """Extract phone number."""
        for pattern in self.PHONE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)
        return None
    
    def extract_address(self, text: str) -> Optional[str]:
        """Extract address from text."""
        for pattern in self.ADDRESS_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def extract_items(self, lines: List[str]) -> List[Dict]:
        """Extract line items from receipt."""
        items = []
        item_pattern = r'([A-Za-z0-9\s&\-]+?)\s+([\d,\.]+)\s*$'
        
        for line in lines:
            match = re.search(item_pattern, line)
            if match:
                name, price = match.groups()
                amount = self.parse_amount(price)
                if amount and amount > 0 and len(name.strip()) > 1:
                    items.append({
                        'name': name.strip(),
                        'price': float(amount)
                    })
        
        return items[:20]  # Limit items
    
    def suggest_category(self, merchant: Optional[str], text: str) -> str:
        """Suggest category based on merchant name and text content."""
        text_lower = (text + ' ' + (merchant or '')).lower()
        
        # Food & Beverages
        if any(k in text_lower for k in ['cafe', 'kopi', 'coffee', 'kafe', 'warung', 'restoran', 
                                          'makan', 'food', 'grill', 'steak', 'pizza', 'burger',
                                          'nasi', 'mie', 'ayam', 'soto', 'bakso', 'sate',
                                          'starbucks', 'kfc', 'mcdonald', 'jco', 'dunkin',
                                          'alfamart', 'indomaret', 'family mart', ' Lawson']):
            return 'food_beverages'
        
        # Transport
        if any(k in text_lower for k in ['grab', 'gojek', 'taxi', 'transport', 'parkir', 'tol',
                                         'bensin', 'shell', 'pertamina', 'vix', 'bp']):
            return 'transport'
        
        # Shopping
        if any(k in text_lower for k in ['toko', 'shop', 'mart', 'supermarket', 'minimarket',
                                         'fashion', 'boutique', 'cloth', 'shoes', 'sepatu',
                                         'electronics', 'gadget', 'hp', 'laptop']):
            return 'shopping'
        
        # Bills & Utilities
        if any(k in text_lower for k in ['listrik', 'pln', 'air', 'pdam', 'telkom', 'internet',
                                         'bpjs', 'asuransi', 'pulsa', 'token', 'paket']):
            return 'bills_utilities'
        
        # Entertainment
        if any(k in text_lower for k in ['bioskop', 'cinema', 'game', 'netflix', 'spotify',
                                         'tiket', 'museum', 'theme park', 'hiburan']):
            return 'entertainment'
        
        # Healthcare
        if any(k in text_lower for k in ['apotek', 'pharmacy', 'rumah sakit', 'clinic', 'dokter',
                                         'health', 'vitamin', 'obat', 'medical']):
            return 'healthcare'
        
        # Default
        return 'other'
    
    def parse(self, ocr_text: str) -> ParsedReceipt:
        """Parse OCR text and extract receipt data."""
        lines = [l.strip() for l in ocr_text.split('\n') if l.strip()]
        
        # Extract all fields
        merchant, merchant_conf = self.extract_merchant(lines)
        total, total_conf = self.extract_total(ocr_text)
        date = self.parse_date(ocr_text)
        payment_method, payment_conf = self.extract_payment_method(ocr_text)
        card_number = self.extract_card_number(ocr_text)
        phone = self.extract_phone(ocr_text)
        address = self.extract_address(ocr_text)
        items = self.extract_items(lines)
        category = self.suggest_category(merchant, ocr_text)
        
        # Calculate overall confidence
        confidence = 0.0
        if merchant:
            confidence += 0.2
        if total:
            confidence += 0.4
        if date:
            confidence += 0.1
        if payment_method:
            confidence += 0.1
        if items:
            confidence += 0.2
        
        return ParsedReceipt(
            merchant_name=merchant,
            total_amount=total,
            date=date,
            items=items,
            payment_method=payment_method,
            card_number=card_number,
            phone=phone,
            address=address,
            raw_text=ocr_text,
            confidence_score=min(confidence, 0.95),
            category_hint=category
        )


class OCRService:
    """
    Main OCR Service - Combines Tesseract with smart parsing.
    """
    
    def __init__(self):
        self.receipt_parser = IndonesianReceiptParser()
        
        # Tesseract config for Indonesian receipts
        self.tesseract_config = '--oem 3 --psm 6 -l ind+eng'
        
    def preprocess_image(self, image: Image.Image) -> Image.Image:
        """Preprocess image for better OCR accuracy."""
        # Convert to grayscale
        img = image.convert('L')
        
        # Increase contrast
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.5)
        
        # Resize if too small
        if img.width < 300:
            scale = 300 / img.width
            new_size = (int(img.width * scale), int(img.height * scale))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        return img
    
    def extract_text(self, image: Image.Image, language: str = 'ind+eng') -> Tuple[str, float]:
        """Extract text from image using Tesseract."""
        # Preprocess
        processed = self.preprocess_image(image)
        
        # OCR with Tesseract
        custom_config = f'--oem 3 --psm 6 -l {language}'
        text = pytesseract.image_to_string(processed, config=custom_config)
        
        # Estimate confidence (Tesseract doesn't give per-image confidence easily)
        # Use length as proxy for quality
        if len(text.strip()) > 50:
            confidence = 0.80
        elif len(text.strip()) > 20:
            confidence = 0.60
        else:
            confidence = 0.40
        
        return text, confidence
    
    def process_image(
        self, 
        image_data: bytes | str,  # bytes or base64 string
        use_ai_enhancement: bool = False
    ) -> ParsedReceipt:
        """
        Process receipt image and extract transaction data.
        
        Args:
            image_data: Image bytes or base64 string
            use_ai_enhancement: Use AI to enhance parsing (optional)
            
        Returns:
            ParsedReceipt with extracted data
        """
        # Load image
        if isinstance(image_data, str):
            # Base64 string
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)
        else:
            image_bytes = image_data
        
        image = Image.open(io.BytesIO(image_bytes))
        
        # Extract text
        text, ocr_conf = self.extract_text(image)
        
        # Parse with Indonesian parser
        receipt = self.receipt_parser.parse(text)
        
        # Update confidence with OCR quality
        receipt.confidence_score = receipt.confidence_score * ocr_conf
        
        return receipt


# Global service instance
ocr_service = OCRService()


def parse_receipt_image(image_data: bytes | str, use_ai: bool = False) -> ParsedReceipt:
    """Main entry point for receipt parsing."""
    return ocr_service.process_image(image_data, use_ai_enhancement=use_ai)


def parse_receipt_text(ocr_text: str) -> ParsedReceipt:
    """Parse receipt from pre-OCR'd text."""
    parser = IndonesianReceiptParser()
    return parser.parse(ocr_text)
