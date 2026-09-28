"""
Gemini Vision AI Service - Fallback OCR when local OCR fails.
Uses Gemini 1.5 Flash multimodal model to extract receipt data.
"""

import json
import base64
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Gemini API endpoint
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


def extract_receipt_with_gemini(image_bytes: bytes, api_key: str) -> Optional[Dict[str, Any]]:
    """
    Use Gemini Vision AI to extract receipt data from image.
    
    Returns dict with:
    - merchant_name: str
    - amount: float
    - date: str (optional)
    - payment_method: str
    - items: list of {name, quantity, price}
    - confidence: float
    """
    if not api_key:
        logger.warning("GEMINI_API_KEY not configured")
        return None
    
    try:
        # Encode image to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Prompt for structured receipt extraction
        prompt = """You are an expert receipt parser. Extract structured data from this receipt image.
        
        Return ONLY valid JSON (no markdown, no explanation):
        {
            "merchant_name": "Store name or Unknown",
            "amount": 0,
            "date": "DD.MM.YY format or null",
            "payment_method": "Cash/Card/GoPay/OVO/DANA/QRIS or Unknown",
            "items": [
                {"name": "item name", "quantity": 1, "price": 0}
            ],
            "confidence": 0.0
        }
        
        Rules:
        - amount = total amount paid (in Rupiah, numeric)
        - payment_method = how they paid (look for TUNAI=Cash, GOPAY=GoPay, OVO=OVO, DANA=DANA, QRIS=QRIS)
        - confidence = how sure you are (0.0 to 1.0)
        - If you cannot read something clearly, use "Unknown" or 0
        """
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_base64
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1024
            }
        }
        
        import urllib.request
        
        url = f"{GEMINI_API_URL}?key={api_key}"
        data = json.dumps(payload).encode('utf-8')
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
        
        # Extract JSON from response
        text = result['candidates'][0]['content']['parts'][0]['text']
        
        # Clean and parse JSON
        text = text.strip()
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        text = text.strip()
        
        data = json.loads(text)
        logger.info(f"Gemini Vision extracted: merchant={data.get('merchant_name')}, amount={data.get('amount')}")
        return data
        
    except json.JSONDecodeError as e:
        logger.error(f"Gemini returned invalid JSON: {e}")
        return None
    except Exception as e:
        logger.error(f"Gemini Vision failed: {e}")
        return None


def format_gemini_result(gemini_data: Dict[str, Any]) -> 'OCRResult':
    """
    Convert Gemini result to OCRResult format.
    """
    from app.services.ocr_service import OCRResult
    
    merchant = gemini_data.get('merchant_name', 'Unknown')
    amount_val = gemini_data.get('amount', 0)
    if isinstance(amount_val, str):
        amount_val = float(amount_val.replace('Rp', '').replace('.', '').replace(',', '.').strip())
    
    items = gemini_data.get('items', [])
    formatted_items = []
    for item in items:
        formatted_items.append({
            'name': item.get('name', 'Unknown'),
            'price': item.get('price', 0),
            'quantity': item.get('quantity', 1)
        })
    
    amount_str = f"Rp {int(amount_val):,}".replace(',', '.')
    
    return OCRResult(
        text=f"[Gemini AI Extracted] {merchant} - {amount_str}",
        confidence=gemini_data.get('confidence', 0.8) * 100,
        raw_lines=[merchant, str(amount_val)],
        merchant_name=merchant,
        amount=amount_str,
        amount_value=float(amount_val),
        date=gemini_data.get('date'),
        payment_method=gemini_data.get('payment_method', 'Unknown'),
        items=formatted_items,
        address=None
    )
