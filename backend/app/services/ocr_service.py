"""
OCR Service using EasyOCR - No system dependencies required.
EasyOCR includes its own models and works out of the box on Railway.
"""

import io
import re
from typing import Optional, Tuple, List, Dict, Any
from dataclasses import dataclass
from PIL import Image, ImageEnhance, ImageFilter
import logging

logger = logging.getLogger(__name__)

# EasyOCR lazy import - only load when needed
easyocr_reader = None

def get_easyocr_reader():
    """Get or create EasyOCR reader (lazy initialization)."""
    global easyocr_reader
    if easyocr_reader is None:
        try:
            import easyocr
            # Initialize with Indonesian and English
            easyocr_reader = easyocr.Reader(['id', 'en'], gpu=False, verbose=False)
            logger.info("EasyOCR reader initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize EasyOCR: {e}")
            raise
    return easyocr_reader

@dataclass
class OCRResult:
    """Result from OCR processing."""
    text: str
    confidence: float
    bounding_boxes: List[Dict[str, Any]]
    merchant_name: Optional[str] = None
    amount: Optional[str] = None
    date: Optional[str] = None
    payment_method: Optional[str] = None

class OCRService:
    """OCR Service using EasyOCR for receipt scanning."""
    
    # Indonesian merchant patterns
    MERCHANT_PATTERNS = {
        # Retail
        r'alfamart|alfamat': ('Alfamart', 'Retail'),
        r'indomaret': ('Indomaret', 'Retail'),
        r'family mart|familymart': ('Family Mart', 'Retail'),
        r' Lawson': ('Lawson', 'Retail'),
        r'minimart|mini mart': ('Mini Mart', 'Retail'),
        
        # Fast Food
        r"mcd|macdonald|mcdonald": ('McDonald\'s', 'Food & Beverage'),
        r'kfc': ('KFC', 'Food & Beverage'),
        r'subway': ('Subway', 'Food & Beverage'),
        r'pizza hut': ('Pizza Hut', 'Food & Beverage'),
        r'hokben|hokki': ('HokBen', 'Food & Beverage'),
        r'burger king': ('Burger King', 'Food & Beverage'),
        r'wendy': ('Wendy\'s', 'Food & Beverage'),
        r'texas chicken': ('Texas Chicken', 'Food & Beverage'),
        r'jco': ('JCO', 'Food & Beverage'),
        r'starbucks': ('Starbucks', 'Food & Beverage'),
        r'kopi ove|koopi|coffee': ('Coffee Shop', 'Food & Beverage'),
        r'tea baru|teh kotak|teh botolan': ('Beverage', 'Food & Beverage'),
        
        # E-commerce
        r'shopee': ('Shopee', 'Shopping'),
        r'tokopedia': ('Tokopedia', 'Shopping'),
        r'lazada': ('Lazada', 'Shopping'),
        r'bukalapak': ('Bukalapak', 'Shopping'),
        r'tiktok shop': ('TikTok Shop', 'Shopping'),
        r'blibli': ('Blibli', 'Shopping'),
        r'amazon': ('Amazon', 'Shopping'),
        
        # Transport
        r'grab': ('Grab', 'Transport'),
        r'gojek': ('Gojek', 'Transport'),
        r'blue bird|bluebird': ('Blue Bird', 'Transport'),
        r'silver bird': ('Silver Bird', 'Transport'),
        r'go ride': ('GoRide', 'Transport'),
        r'go car': ('GoCar', 'Transport'),
        r'grab bike': ('GrabBike', 'Transport'),
        r'grab car': ('GrabCar', 'Transport'),
        
        # E-Wallet
        r'gopay': ('GoPay', 'E-Wallet'),
        r'dana': ('DANA', 'E-Wallet'),
        r'ovo': ('OVO', 'E-Wallet'),
        r'shopee pay|shopeepay': ('ShopeePay', 'E-Wallet'),
        r'linkaja|link aja': ('LinkAja', 'E-Wallet'),
        r'isaku|i.saku': ('i.Saku', 'E-Wallet'),
        r'qris': ('QRIS', 'E-Wallet'),
        
        # Bills & Utilities
        r'pln': ('PLN', 'Bills'),
        r'pdam': ('PDAM', 'Bills'),
        r'telkom|indihome': ('Telkom', 'Bills'),
        r'bpjs': ('BPJS', 'Bills'),
        r'transvision': ('Transvision', 'Bills'),
        r'indovision': ('Indovision', 'Bills'),
        r'xl axiata': ('XL Axiata', 'Bills'),
        r'telkomsel': ('Telkomsel', 'Bills'),
        r'im3': ('IM3', 'Bills'),
        r'tri': ('Tri', 'Bills'),
        r'smartfren': ('Smartfren', 'Bills'),
        
        # Supermarket
        r'hypermart': ('Hypermart', 'Supermarket'),
        r'carrefour': ('Carrefour', 'Supermarket'),
        r'giant': ('Giant', 'Supermarket'),
        r'matahari': ('Matahari', 'Supermarket'),
        r'superindo': ('Superindo', 'Supermarket'),
        r' ranch market|ranch': ('Ranch Market', 'Supermarket'),
        r'jakarta': ('Jakarta', 'Supermarket'),
        
        # Pharmacy
        r'guardian': ('Guardian', 'Pharmacy'),
        r'watson': ('Watsons', 'Pharmacy'),
        r'kimia farma|apotek kimia': ('Kimia Farma', 'Pharmacy'),
        r'apotek': ('Apotek', 'Pharmacy'),
    }
    
    # Amount patterns
    AMOUNT_PATTERNS = [
        r'(?:total|jumlah|nominal|jml|hrg|price|amount|ttl)[:\s]*[Rr]p\.?\s*([\d.,]+)',
        r'[Rr]p\.?\s*([\d][\d.,]*)',
        r'([\d]+(?:[.,]\d{3})*(?:[.,]\d{2})?)',
    ]
    
    # Date patterns
    DATE_PATTERNS = [
        r'(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})',
        r'(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})',
        r'(\w+)\s+(\d{1,2}),?\s+(\d{4})',
        r'(\d{1,2})\s+(\w+)\s+(\d{4})',
    ]
    
    # Category mapping
    CATEGORY_MAPPING = {
        'Retail': 'shopping',
        'Food & Beverage': 'food_beverages',
        'Shopping': 'shopping',
        'Transport': 'transport',
        'E-Wallet': 'other',
        'Bills': 'bills_utilities',
        'Supermarket': 'shopping',
        'Pharmacy': 'health',
    }
    
    def __init__(self):
        self.reader = None
        logger.info("OCRService initialized")
    
    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """Preprocess image for better OCR results."""
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too small
        width, height = image.size
        if width < 300 or height < 300:
            scale = max(300 / width, 300 / height)
            new_size = (int(width * scale), int(height * scale))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Increase contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        
        # Sharpen
        image = image.filter(ImageFilter.SHARPEN)
        
        return image
    
    def _extract_text(self, image: Image.Image) -> Tuple[str, float, List[Dict]]:
        """Extract text from image using EasyOCR."""
        try:
            reader = get_easyocr_reader()
            results = reader.readtext(
                image,
                paragraph=False,
                detail=1,
                decoder='greedy'
            )
            
            if not results:
                return "", 0.0, []
            
            # Combine all text
            all_text = []
            total_confidence = 0
            bounding_boxes = []
            
            for (bbox, text, confidence) in results:
                if text.strip():
                    all_text.append(text.strip())
                    total_confidence += confidence
                    bounding_boxes.append({
                        'text': text.strip(),
                        'bbox': bbox,
                        'confidence': confidence
                    })
            
            avg_confidence = total_confidence / len(results) if results else 0
            combined_text = '\n'.join(all_text)
            
            return combined_text, avg_confidence, bounding_boxes
            
        except Exception as e:
            logger.error(f"EasyOCR extraction failed: {e}")
            raise
    
    def _parse_amount(self, text: str) -> Tuple[Optional[str], Optional[float]]:
        """Extract amount from text."""
        lines = text.split('\n')
        
        # Look for patterns in reverse order (amount usually at top)
        for line in reversed(lines):
            line = line.strip()
            
            # Skip if too short or contains non-numeric
            if len(line) < 3:
                continue
            
            # Try to find amount with Rp prefix
            rp_match = re.search(r'[Rr]p\.?\s*([\d.,]+)', line)
            if rp_match:
                amount_str = rp_match.group(1).replace(',', '.')
                try:
                    # Handle both formats: 81.500 and 81,500
                    if ',' in rp_match.group(1):
                        amount_str = amount_str.replace('.', '')
                    amount = float(amount_str.replace('.', '').replace(',', '.'))
                    return rp_match.group(0), amount
                except:
                    continue
            
            # Try plain number (assume large numbers are amounts)
            num_match = re.findall(r'([\d]+(?:[.,]\d{3})*)', line)
            for num_str in reversed(num_match):
                try:
                    clean_num = num_str.replace(',', '')
                    amount = float(clean_num)
                    if amount > 1000:  # Likely an amount
                        return num_str, amount
                except:
                    continue
        
        return None, None
    
    def _parse_date(self, text: str) -> Optional[str]:
        """Extract date from text."""
        date_patterns = [
            (r'(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})', '%d/%m/%Y'),
            (r'(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})', '%d/%m/%y'),
            (r'(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})', '%Y/%m/%d'),
        ]
        
        for pattern, fmt in date_patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    from datetime import datetime
                    if len(match.group(3)) == 4:
                        date_str = f"{match.group(1)}/{match.group(2)}/{match.group(3)}"
                    else:
                        year = int(match.group(3))
                        if year < 100:
                            year += 2000
                        date_str = f"{match.group(1)}/{match.group(2)}/{year}"
                    return date_str
                except:
                    continue
        
        return None
    
    def _parse_merchant(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """Identify merchant from text."""
        text_lower = text.lower()
        
        for pattern, (merchant_name, category) in self.MERCHANT_PATTERNS.items():
            if re.search(pattern, text_lower):
                mapped_category = self.CATEGORY_MAPPING.get(category, 'other')
                return merchant_name, mapped_category
        
        return None, None
    
    def _parse_payment_method(self, text: str) -> Optional[str]:
        """Identify payment method."""
        text_lower = text.lower()
        
        methods = {
            'gopay': r'gopay',
            'dana': r'dana',
            'ovo': r'ovo',
            'shopeepay': r'shopee\s*pay|shopeepay',
            'linkaja': r'link\s*aja|linkaja',
            'cash': r'cash|tunai',
            'debit': r'debit',
            'credit': r'credit|kredit',
            'qris': r'qris',
        }
        
        for method, pattern in methods.items():
            if re.search(pattern, text_lower):
                return method.upper()
        
        return None
    
    def process_image(self, image_bytes: bytes) -> OCRResult:
        """Process receipt image and extract structured data."""
        try:
            # Load image
            image = Image.open(io.BytesIO(image_bytes))
            
            # Preprocess
            processed_image = self._preprocess_image(image)
            
            # Extract text
            text, confidence, bounding_boxes = self._extract_text(processed_image)
            
            if not text.strip():
                raise ValueError("No text detected in image")
            
            # Parse structured data
            merchant, category = self._parse_merchant(text)
            amount_str, amount = self._parse_amount(text)
            date = self._parse_date(text)
            payment_method = self._parse_payment_method(text)
            
            return OCRResult(
                text=text,
                confidence=confidence,
                bounding_boxes=bounding_boxes,
                merchant_name=merchant,
                amount=amount_str,
                date=date,
                payment_method=payment_method
            )
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise

# Singleton instance
ocr_service = OCRService()
