"""
OCR Service using Tesseract OCR - Installed via Dockerfile.
Fast, no model download needed.
"""

import io
import re
import logging
from typing import Optional, Tuple, List, Dict
from dataclasses import dataclass
from PIL import Image, ImageEnhance

logger = logging.getLogger(__name__)

@dataclass
class OCRResult:
    """Result from OCR processing."""
    text: str
    confidence: float
    merchant_name: Optional[str] = None
    amount: Optional[str] = None
    amount_value: Optional[float] = None
    date: Optional[str] = None
    payment_method: Optional[str] = None
    items: Optional[List[Dict]] = None  # List of extracted items
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class OCRService:
    """OCR Service using Tesseract for receipt scanning."""
    
    # Indonesian merchant patterns
    MERCHANT_PATTERNS = {
        # Retail
        r'alfamart|alfamat': ('Alfamart', 'shopping'),
        r'indomaret': ('Indomaret', 'shopping'),
        r'family mart|familymart': ('Family Mart', 'shopping'),
        r'lawson': ('Lawson', 'shopping'),
        
        # Fast Food
        r"mcd|macdonald|mcdonald": ('McDonald\'s', 'food_beverages'),
        r'kfc': ('KFC', 'food_beverages'),
        r'subway': ('Subway', 'food_beverages'),
        r'pizza hut': ('Pizza Hut', 'food_beverages'),
        r'hokben|hokki': ('HokBen', 'food_beverages'),
        r'burger king': ('Burger King', 'food_beverages'),
        r'starbucks': ('Starbucks', 'food_beverages'),
        r'jco': ('JCO', 'food_beverages'),
        r'celsius': ('Celsius', 'food_beverages'),
        r'kopi kini': ('Kopi Kini', 'food_beverages'),
        
        # E-commerce
        r'shopee': ('Shopee', 'shopping'),
        r'tokopedia': ('Tokopedia', 'shopping'),
        r'lazada': ('Lazada', 'shopping'),
        r'blibli': ('Blibli', 'shopping'),
        
        # Transport
        r'grab': ('Grab', 'transport'),
        r'gojek': ('Gojek', 'transport'),
        r'blue bird|bluebird': ('Blue Bird', 'transport'),
        r'shell': ('Shell', 'transport'),
        r'pertamina': ('Pertamina', 'transport'),
        
        # E-Wallet
        r'gopay': ('GoPay', 'other'),
        r'dana': ('DANA', 'other'),
        r'ovo': ('OVO', 'other'),
        r'shopee pay|shopeepay': ('ShopeePay', 'other'),
        r'linkaja|link aja': ('LinkAja', 'other'),
        r'qris': ('QRIS', 'other'),
        
        # Bills
        r'pln': ('PLN', 'bills_utilities'),
        r'pdam': ('PDAM', 'bills_utilities'),
        r'telkom|indihome': ('Telkom', 'bills_utilities'),
        r'bpjs': ('BPJS', 'bills_utilities'),
        
        # Supermarket
        r'carrefour': ('Carrefour', 'shopping'),
        r'hypermart': ('Hypermart', 'shopping'),
        r'giant': ('Giant', 'shopping'),
        r'matahari': ('Matahari', 'shopping'),
    }
    
    # Indonesian city/region patterns
    CITY_PATTERNS = [
        r'(?:jalan|jl\.?)\s*([A-Za-z0-9\s,]+?)(?:,|\n)',
        r'([A-Za-z]+(?: Utara| Selatan| Timur| Barat)?)(?:,|\n)',
        r'(?:kota|kabupaten)\s+([A-Za-z\s]+?)(?:,|\n)',
        r'([A-Za-z]+)(?:\s+-\s+\d+)',
    ]
    
    def _preprocess_image(self, image_bytes: bytes) -> Image.Image:
        """Preprocess image for better OCR."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize if too small
            width, height = image.size
            if width < 800:
                scale = 800 / width
                new_size = (int(width * scale), int(height * scale))
                image = image.resize(new_size, Image.LANCZOS)
            
            # Increase contrast
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.5)
            
            # Sharpen
            enhancer = ImageEnhance.Sharpness(image)
            image = enhancer.enhance(1.5)
            
            # Convert to grayscale
            image = image.convert('L')
            
            return image
            
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            raise
    
    def _extract_with_tesseract(self, image_bytes: bytes) -> Tuple[str, float]:
        """Extract text using Tesseract OCR."""
        try:
            import pytesseract
            
            # Preprocess image
            image = self._preprocess_image(image_bytes)
            
            # OCR with Indonesian + English
            text = pytesseract.image_to_string(
                image, 
                lang='eng+ind',
                config='--psm 6'
            )
            
            # Get confidence (average, not sum)
            try:
                data = pytesseract.image_to_data(image, lang='eng+ind', output_type=pytesseract.Output.DICT)
                confidences = [int(c) for c in data['conf'] if int(c) > 0]
                confidence = sum(confidences) / len(confidences) if confidences else 0
            except:
                confidence = 70
            
            logger.info(f"Tesseract extracted {len(text)} chars, confidence: {min(confidence, 100):.1f}%")
            return text.strip(), min(confidence, 100)  # Cap at 100%
            
        except ImportError as e:
            logger.error(f"pytesseract not installed: {e}")
            return "", 0
        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")
            return "", 0
    
    def _parse_amount(self, text: str) -> Tuple[Optional[str], Optional[float]]:
        """Extract amount from text."""
        patterns = [
            r'(?:total|jumlah|amount|nominal|bayar)[:\s]*[Rr]p\.?\s*([\d.,]+)',
            r'[Rr]p\.?\s*([\d.,]+)',
            r'([\d.,]+)\s*(?:k|rb|ribu|juta)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text.lower())
            if matches:
                amount_str = matches[-1]
                amount_str = amount_str.replace('.', '').replace(',', '.')
                try:
                    value = float(amount_str)
                    if value > 0:
                        return amount_str, value
                except:
                    pass
        
        return None, None
    
    def _parse_address(self, text: str, merchant_name: str = None) -> Optional[str]:
        """Extract address/location from receipt text."""
        # Try to find address patterns
        patterns = [
            r'(?:jalan|jl\.?)\s*([A-Za-z0-9\s,]+?)(?:\n|,)',
            r'(?:jl\.?)\s*([A-Za-z0-9\s]+?\s+(?:no\.?|No\.?)\s*\d+)',
            r'([A-Za-z]+(?: Utara| Selatan| Timur| Barat| Pusat)?)\s*,',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                addr = match.group(1).strip()
                if len(addr) > 5:
                    return addr
        
        # If merchant found, try to return region
        if merchant_name:
            return f"{merchant_name} Store"
        
        return None
    
    def _extract_items(self, text: str) -> List[Dict]:
        """Extract individual items from receipt text."""
        items = []
        
        # Common receipt patterns for items
        # Pattern: item name followed by price
        patterns = [
            # "Item Name ... Rp 10.000"
            r'([A-Za-z0-9\s]+?)\s+(?:x\d+\s+)?(?:@[^,]+,\s*)?[Rr]p\.?\s*([\d.,]+)',
            # "1. Item Name ........ 10.000"
            r'(?:^\d+[\.\)]\s*)?([A-Za-z][A-Za-z0-9\s]+?)\s+\.+\s*([\d,]+)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.MULTILINE)
            for match in matches:
                if len(match) == 2:
                    name = match[0].strip()
                    price_str = match[1].strip().replace('.', '').replace(',', '.')
                    try:
                        price = float(price_str)
                        if price > 0 and len(name) > 2:
                            items.append({
                                "name": name,
                                "price": price,
                                "quantity": 1
                            })
                    except:
                        pass
        
        return items[:20]  # Limit to 20 items
    
    def _parse_merchant(self, text: str) -> Optional[str]:
        """Extract merchant name from text."""
        text_lower = text.lower()
        
        for pattern, (merchant_name, _) in self.MERCHANT_PATTERNS.items():
            if re.search(pattern, text_lower):
                return merchant_name
        
        return None
    
    def _parse_payment_method(self, text: str) -> Optional[str]:
        """Extract payment method from text."""
        text_lower = text.lower()
        
        methods = {
            r'gopay': 'GoPay',
            r'dana': 'DANA',
            r'ovo': 'OVO',
            r'shopeepay|shopee pay': 'ShopeePay',
            r'linkaja|link aja': 'LinkAja',
            r'qris': 'QRIS',
            r'cash|tunai': 'Cash',
            r'debit': 'Debit',
            r'credit|kartu kredit': 'Credit',
        }
        
        for pattern, method in methods.items():
            if re.search(pattern, text_lower):
                return method
        
        return None
    
    def process_image(self, image_bytes: bytes) -> OCRResult:
        """Process receipt image and extract structured data."""
        try:
            # Extract text using Tesseract
            text, confidence = self._extract_with_tesseract(image_bytes)
            
            if not text:
                logger.warning("No text extracted from image")
                return OCRResult(text="", confidence=0)
            
            # Parse extracted data
            amount_str, amount_value = self._parse_amount(text)
            merchant_name = self._parse_merchant(text)
            payment_method = self._parse_payment_method(text)
            items = self._extract_items(text)
            address = self._parse_address(text, merchant_name)
            
            logger.info(f"OCR Result: merchant={merchant_name}, amount={amount_str}, items={len(items)}, address={address}, confidence={confidence:.1f}%")
            
            return OCRResult(
                text=text[:500],
                confidence=confidence,
                merchant_name=merchant_name,
                amount=amount_str,
                amount_value=amount_value,
                date=None,
                payment_method=payment_method,
                items=items,
                latitude=None,
                longitude=None
            )
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise ValueError(f"OCR processing failed: {str(e)}")
    
    def get_status(self) -> Dict:
        """Get OCR status."""
        try:
            import pytesseract
            return {
                "status": "ready",
                "message": "Tesseract OCR ready",
                "ready": True
            }
        except ImportError:
            return {
                "status": "error",
                "message": "Tesseract not installed",
                "ready": False
            }

# Singleton instance
ocr_service = OCRService()
