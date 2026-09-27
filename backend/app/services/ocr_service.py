"""
OCR Service using EasyOCR - Lazy loading, auto-caching models.
Models downloaded once and cached.
"""

import io
import re
import os
import logging
from typing import Optional, Tuple, Dict
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

class OCRService:
    """OCR Service using EasyOCR for receipt scanning."""
    
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
        
        # E-commerce
        r'shopee': ('Shopee', 'shopping'),
        r'tokopedia': ('Tokopedia', 'shopping'),
        r'lazada': ('Lazada', 'shopping'),
        
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
    }
    
    def __init__(self):
        self._reader = None
        self._init_error = None
    
    def _get_reader(self):
        """Lazy init EasyOCR reader with timeout."""
        if self._reader is not None or self._init_error:
            return self._reader
        
        import signal
        import threading
        
        def init_reader(result_container):
            try:
                import easyocr
                # Download models to persistent location
                cache_dir = os.environ.get('EASYOCR_CACHE_DIR', '/tmp/easyocr')
                os.makedirs(cache_dir, exist_ok=True)
                
                reader = easyocr.Reader(
                    ['en', 'id'],  # English + Indonesian
                    gpu=False,
                    download=True,
                    model_storage_directory=cache_dir
                )
                result_container['reader'] = reader
            except Exception as e:
                result_container['error'] = str(e)
        
        result = {}
        timeout = 120  # 2 minutes for first download
        
        # Run in thread with timeout
        thread = threading.Thread(target=init_reader, args=(result,))
        thread.daemon = True
        thread.start()
        thread.join(timeout=timeout)
        
        if 'error' in result:
            self._init_error = result['error']
            logger.error(f"EasyOCR init failed: {self._init_error}")
            return None
        
        if 'reader' in result:
            self._reader = result['reader']
            logger.info("EasyOCR initialized successfully")
            return self._reader
        
        # Timeout
        self._init_error = "Timeout initializing EasyOCR"
        logger.error(self._init_error)
        return None
    
    def _preprocess_image(self, image_bytes: bytes) -> Image.Image:
        """Preprocess image for better OCR."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            width, height = image.size
            if width < 800:
                scale = 800 / width
                new_size = (int(width * scale), int(height * scale))
                image = image.resize(new_size, Image.LANCZOS)
            
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.3)
            
            return image
            
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            raise
    
    def _extract_with_easyocr(self, image_bytes: bytes) -> Tuple[str, float]:
        """Extract text using EasyOCR."""
        reader = self._get_reader()
        
        if reader is None:
            return "", 0
        
        try:
            image = self._preprocess_image(image_bytes)
            
            # Convert PIL Image to numpy array for EasyOCR
            import numpy as np
            img_array = np.array(image)
            
            # OCR
            results = reader.readtext(img_array)
            
            if not results:
                return "", 0
            
            # Combine all text
            full_text = ""
            confidences = []
            
            for (bbox, text, conf) in results:
                full_text += text + "\n"
                confidences.append(conf)
            
            avg_confidence = sum(confidences) / len(confidences) * 100 if confidences else 0
            
            logger.info(f"EasyOCR extracted {len(full_text)} chars, confidence: {avg_confidence:.1f}%")
            return full_text.strip(), avg_confidence
            
        except Exception as e:
            logger.error(f"EasyOCR failed: {e}")
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
            text, confidence = self._extract_with_easyocr(image_bytes)
            
            if not text:
                logger.warning("No text extracted from image")
                return OCRResult(text="", confidence=0)
            
            amount_str, amount_value = self._parse_amount(text)
            merchant_name = self._parse_merchant(text)
            payment_method = self._parse_payment_method(text)
            
            logger.info(f"OCR Result: merchant={merchant_name}, amount={amount_str}, confidence={confidence:.1f}%")
            
            return OCRResult(
                text=text[:500],
                confidence=confidence,
                merchant_name=merchant_name,
                amount=amount_str,
                amount_value=amount_value,
                date=None,
                payment_method=payment_method
            )
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise ValueError(f"OCR processing failed: {str(e)}")
    
    def get_status(self) -> Dict:
        """Get OCR status."""
        if self._init_error:
            return {
                "status": "error",
                "message": self._init_error,
                "ready": False
            }
        elif self._reader:
            return {
                "status": "ready",
                "message": "OCR ready",
                "ready": True
            }
        else:
            return {
                "status": "initializing",
                "message": "Initializing OCR models...",
                "ready": False
            }

# Singleton instance
ocr_service = OCRService()
