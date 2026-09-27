"""
OCR Service using Gemini AI - No model download needed!
Uses Google's Gemini to extract text from receipt images.
"""

import io
import re
import base64
import logging
from typing import Optional, Tuple, List, Dict, Any
from dataclasses import dataclass
from PIL import Image, ImageEnhance, ImageFilter

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
    """OCR Service using Gemini AI for receipt scanning."""
    
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
    
    def _preprocess_image(self, image_bytes: bytes) -> str:
        """Convert image to base64 for Gemini."""
        return base64.b64encode(image_bytes).decode('utf-8')
    
    def _extract_with_ai(self, image_bytes: bytes) -> Optional[Dict]:
        """Extract data using Gemini AI."""
        try:
            import os
            
            # Get Gemini API key
            api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GEMINI_API_KEY_1')
            if not api_key:
                logger.warning("No Gemini API key found")
                return None
            
            import urllib.request
            import json
            
            # Prepare image
            image_base64 = self._preprocess_image(image_bytes)
            
            # Gemini API call
            # Use gemini-1.5-flash which is widely available
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            
            prompt = """You are an Indonesian receipt parser. Extract the following from this receipt image:
1. merchant_name: The store/merchant name (in Indonesian or English)
2. amount: The total amount paid (just the number, no currency symbol)
3. date: Transaction date if visible (YYYY-MM-DD format)
4. payment_method: Payment method (cash, debit, credit, e-wallet name, etc.)
5. category: Best category for this transaction (food_beverages, shopping, transport, bills_utilities, entertainment, health, other)

Return ONLY valid JSON like this:
{"merchant_name": "McDonald's", "amount": "25000", "date": "2024-01-15", "payment_method": "GoPay", "category": "food_beverages"}

If you cannot read the receipt clearly, still try your best. Return empty string for unknown fields."""

            data = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_base64
                        }}
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 500
                }
            }
            
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))
            
            # Parse response
            text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            
            # Extract JSON from response
            json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            
            return None
            
        except Exception as e:
            logger.error(f"Gemini OCR failed: {e}")
            return None
    
    def _fallback_parse(self, image_bytes: bytes) -> Tuple[str, float]:
        """Fallback: basic image to text using PIL and pattern matching."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            
            # Try to get any visible text from image metadata
            # This is a last resort - mainly for receipt numbers, etc.
            
            return "", 0.0
            
        except Exception as e:
            logger.error(f"Fallback parse failed: {e}")
            return "", 0.0
    
    def _parse_amount(self, amount_str: str) -> Optional[float]:
        """Parse amount string to float."""
        if not amount_str:
            return None
        
        # Remove currency symbols and spaces
        cleaned = re.sub(r'[Rp\s.,]', '', str(amount_str))
        
        try:
            return float(cleaned)
        except:
            return None
    
    def _parse_merchant_fallback(self, text: str) -> Optional[str]:
        """Try to identify merchant from any text."""
        text_lower = text.lower()
        
        for pattern, (merchant_name, _) in self.MERCHANT_PATTERNS.items():
            if re.search(pattern, text_lower):
                return merchant_name
        
        return None
    
    def process_image(self, image_bytes: bytes) -> OCRResult:
        """Process receipt image and extract structured data using AI."""
        try:
            # Try AI extraction first
            ai_result = self._extract_with_ai(image_bytes)
            
            if ai_result:
                amount_value = self._parse_amount(ai_result.get('amount', ''))
                
                return OCRResult(
                    text=f"Merchant: {ai_result.get('merchant_name', 'Unknown')}",
                    confidence=0.85,
                    merchant_name=ai_result.get('merchant_name'),
                    amount=ai_result.get('amount'),
                    amount_value=amount_value,
                    date=ai_result.get('date'),
                    payment_method=ai_result.get('payment_method')
                )
            
            # Fallback to basic parsing
            logger.info("Using fallback parser - AI extraction failed")
            text, confidence = self._fallback_parse(image_bytes)
            
            # Try to find merchant from text
            merchant = self._parse_merchant_fallback(text)
            
            return OCRResult(
                text=text,
                confidence=confidence,
                merchant_name=merchant
            )
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise ValueError(f"OCR processing failed: {str(e)}")

# Singleton instance
ocr_service = OCRService()
