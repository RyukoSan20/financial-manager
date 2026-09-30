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

# Full parse prompt
FULL_PARSE_PROMPT = """You are an expert receipt parsing AI. Extract ALL information from this receipt image.

Return ONLY valid JSON (no markdown, no explanation):
{
  "merchant": {
    "name": "official brand/bank name",
    "type": "Retail|Bank/Financial|F&B|Service|Utilities|Other",
    "location": "city/address if available, null if not"
  },
  "transaction_date": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "original product/service name",
      "canonical_name": "standardized name",
      "quantity": 1,
      "price_per_unit": 0.0,
      "total_price": 0.0,
      "category": "category name"
    }
  ],
  "subtotal": 0.0,
  "discount": 0.0,
  "total_amount": 0.0,
  "payment_method": "Cash|Debit|E-Wallet|QRIS|Credit|null"
}

Important:
- For bank/transfer receipts (BCA, Mandiri, BNI, BTN, etc.), type="Bank/Financial" and items should be "Biaya Admin" or "Transfer"
- For utility bills (PLN, PDAM, Internet), type="Utilities"
- For e-wallet (GoPay, OVO, DANA), type="Service"
- Always extract real item names, not just "Item 1, Item 2"
- Price in Indonesian Rupiah (Rp)
- Look carefully at ALL items listed on the receipt"""


def extract_receipt_with_gemini(
    image_bytes: bytes, 
    api_key: str,
    prompt_type: str = "full"
) -> Optional[Dict[str, Any]]:
    """
    Use Gemini Vision AI to extract receipt data from image.
    
    prompt_type: "full" (complete parse) or "enrichment" (just merchant type/categories)
    
    Returns dict with:
    - merchant_name: str
    - merchant_type: str (Retail, Bank/Financial, F&B, etc.)
    - merchant_location: str
    - amount: float
    - date: str (optional)
    - payment_method: str
    - items: list of {name, quantity, price_per_unit, total_price, category}
    - subtotal: float
    - discount: float
    - total_amount: float
    - confidence: float
    """
    if not api_key:
        logger.warning("GEMINI_API_KEY not configured")
        return None
    
    try:
        # Encode image to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Use full parse prompt
        prompt = FULL_PARSE_PROMPT
        
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
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json"
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
        
        with urllib.request.urlopen(req, timeout=60) as response:
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
        logger.info(f"Gemini Vision extracted: merchant={data.get('merchant', {}).get('name')}, items={len(data.get('items', []))}")
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
    
    # Extract merchant info
    merchant_data = gemini_data.get('merchant', {})
    merchant = merchant_data.get('name', 'Unknown')
    
    # Extract amounts
    total_amount = float(gemini_data.get('total_amount', 0) or 0)
    subtotal = float(gemini_data.get('subtotal', 0) or 0)
    discount = float(gemini_data.get('discount', 0) or 0)
    
    # Format items
    items = gemini_data.get('items', [])
    formatted_items = []
    for item in items:
        # Handle both price and price_per_unit keys
        price_per_unit = (
            item.get('price_per_unit') or 
            item.get('price') or 
            item.get('unit_price') or 
            0
        )
        total_price = (
            item.get('total_price') or 
            item.get('total') or 
            item.get('amount') or 
            price_per_unit
        )
        
        formatted_items.append({
            'name': item.get('name', item.get('canonical_name', 'Unknown')),
            'canonical_name': item.get('canonical_name'),
            'quantity': int(item.get('quantity', 1) or 1),
            'price_per_unit': float(price_per_unit or 0),
            'total_price': float(total_price or 0),
            'category': item.get('category')
        })
    
    # Format amount string
    amount_str = f"Rp {int(total_amount):,}".replace(',', '.')
    
    return OCRResult(
        text=f"[Gemini AI] {merchant} - {amount_str}",
        confidence=float(gemini_data.get('confidence', 0.8)) * 100,
        raw_lines=[merchant, str(total_amount)],
        merchant_name=merchant,
        amount=amount_str,
        amount_value=float(total_amount),
        date=gemini_data.get('transaction_date'),
        payment_method=gemini_data.get('payment_method', 'Unknown'),
        items=formatted_items,
        address=merchant_data.get('location')
    )
