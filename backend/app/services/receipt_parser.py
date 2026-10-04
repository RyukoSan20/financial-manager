"""Enterprise Receipt Parser using Gemini 1.5 Flash with Structured Outputs."""

import json
import re
from typing import Optional, Dict, Any, List
from decimal import Decimal, InvalidOperation
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.models.transaction_item import TransactionItem


class ReceiptParser:
    """Parse receipt images using Gemini 1.5 Flash with JSON structured outputs."""

    PROMPT_TEMPLATE = """
    Anda adalah AI yang mengekstrak informasi dari struk/penerimaan pembayaran.
    
    Ekstrak informasi berikut dari gambar struk dan kembalikan dalam format JSON:
    {
        "merchant_name": "nama toko/merchant",
        "date": "tanggal transaksi (YYYY-MM-DD)",
        "total_amount": "total harga (angka saja, tanpa titik/koma)",
        "items": [
            {
                "name": "nama item",
                "quantity": jumlah,
                "unit_price": harga per unit,
                "total_price": harga total item
            }
        ],
        "category": "kategori (makanan, transport, belanja, tagihan, kesehatan, hiburan, dll)",
        "location": "lokasi/alamat toko (jika ada)"
    }
    
    Aturan:
    - Jika tidak yakin, gunakan null untuk field yang tidak ditemukan
    - total_amount harus dalam bentuk angka saja (tanpa Rp, titik, koma)
    - date dalam format YYYY-MM-DD
    - items adalah array of objects dengan field name, quantity, unit_price, total_price
    """

    def __init__(self, db: Session):
        self.db = db

    async def parse_with_gemini(self, image_base64: str) -> Dict[str, Any]:
        """
        Parse receipt image using Gemini 1.5 Flash with JSON structured output.
        
        Args:
            image_base64: Base64 encoded image (with or without data URI prefix)
        
        Returns:
            Parsed receipt data as dictionary
        """
        try:
            import os
            import google.generativeai as genai
            
            # Configure Gemini
            api_key = os.getenv("GEMINI_API_KEY", "")
            model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            
            # Clean base64 (remove data URI prefix if present)
            clean_base64 = image_base64
            if "base64," in image_base64:
                clean_base64 = image_base64.split("base64,")[1]
            
            # Generate content with JSON response
            response = model.generate_content(
                contents=[{
                    "parts": [
                        {"text": self.PROMPT_TEMPLATE},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": clean_base64
                            }
                        }
                    ]
                }],
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.1,
                }
            )
            
            # Parse JSON response
            text = response.text.strip()
            if text.startswith("```json"):
                text = text.replace("```json", "").replace("```", "").strip()
            elif text.startswith("```"):
                text = text.replace("```", "").strip()
            
            parsed_data = json.loads(text)
            
            # Normalize field names (support both Indonesian and English)
            normalized = self._normalize_fields(parsed_data)
            
            # Calculate confidence based on completeness
            confidence = self._calculate_confidence(normalized)
            
            return {
                "success": True,
                "data": normalized,
                "confidence": confidence,
                "raw_response": text
            }
            
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse JSON: {str(e)}",
                "confidence": 0.0,
                "data": {}
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "confidence": 0.0,
                "data": {}
            }

    def _normalize_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize field names to English format."""
        normalized = {}
        
        # Merchant name (support multiple field names)
        normalized["merchant_name"] = (
            data.get("merchant_name") or 
            data.get("nama_toko") or 
            data.get("store_name") or
            data.get("vendor")
        )
        
        # Date (support multiple formats)
        date_str = data.get("date") or data.get("tanggal") or data.get("transaction_date")
        normalized["date"] = self._parse_date(date_str)
        
        # Total amount (support multiple field names)
        total = data.get("total_amount") or data.get("total_price") or data.get("total_harga") or "0"
        normalized["total_amount"] = self._parse_amount(total)
        
        # Items
        items = data.get("items") or []
        normalized["items"] = self._normalize_items(items)
        
        # Category
        normalized["category"] = data.get("category") or data.get("kategori")
        
        # Location
        normalized["location"] = data.get("location") or data.get("alamat")
        
        return normalized

    def _parse_date(self, date_str: Optional[str]) -> Optional[str]:
        """Parse date string to YYYY-MM-DD format."""
        if not date_str:
            return None
        
        # Already in correct format
        if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
            return date_str
        
        # Try common Indonesian formats
        patterns = [
            (r"(\d{1,2})/(\d{1,2})/(\d{4})", r"\3-\2-\1"),  # DD/MM/YYYY
            (r"(\d{1,2})-(\d{1,2})-(\d{4})", r"\3-\2-\1"),  # DD-MM-YYYY
            (r"(\d{1,2})\.(\d{1,2})\.(\d{4})", r"\3-\2-\1"),  # DD.MM.YYYY
        ]
        
        for pattern, replacement in patterns:
            match = re.search(pattern, date_str)
            if match:
                try:
                    from datetime import datetime
                    result = re.sub(pattern, replacement, date_str)
                    datetime.strptime(result, "%Y-%m-%d")
                    return result
                except ValueError:
                    continue
        
        return date_str  # Return as-is if parsing fails

    def _parse_amount(self, amount_str: str) -> Decimal:
        """Parse amount string to Decimal."""
        if not amount_str:
            return Decimal("0")
        
        # Remove currency symbols and whitespace
        cleaned = re.sub(r"[Rp\s]", "", str(amount_str))
        
        # Remove thousand separators (dots in IDR)
        cleaned = cleaned.replace(".", "").replace(",", ".")
        
        try:
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return Decimal("0")

    def _normalize_items(self, items: List[Dict]) -> List[Dict]:
        """Normalize item data."""
        normalized_items = []
        
        for item in items:
            if not isinstance(item, dict):
                continue
            
            normalized_items.append({
                "name": item.get("name") or item.get("nama") or "Item",
                "quantity": float(item.get("quantity") or item.get("jumlah") or 1),
                "unit_price": float(self._parse_amount(str(item.get("unit_price") or item.get("harga_satuan") or "0"))),
                "total_price": float(self._parse_amount(str(item.get("total_price") or item.get("harga_total") or "0"))),
            })
        
        return normalized_items

    def _calculate_confidence(self, data: Dict[str, Any]) -> float:
        """Calculate confidence score based on data completeness."""
        score = 0.0
        total_fields = 5
        
        if data.get("merchant_name"):
            score += 0.2
        if data.get("date"):
            score += 0.2
        if data.get("total_amount") and data["total_amount"] > 0:
            score += 0.3
        if data.get("items") and len(data["items"]) > 0:
            score += 0.2
        if data.get("category"):
            score += 0.1
        
        return round(score, 2)

    async def create_transaction_from_parsed(
        self,
        user_id: int,
        parsed_data: Dict[str, Any],
        account_id: int,
        source: str = "ocr",
        auto_approve: bool = False,
        raw_data: str = None
    ) -> Transaction:
        """
        Create transaction from parsed receipt data atomically with items.
        
        Args:
            user_id: User ID
            parsed_data: Normalized data from Gemini
            account_id: Account ID to link
            source: Transaction source
            auto_approve: Auto-approve if confidence is high
            raw_data: Raw JSON response from Gemini
        
        Returns:
            Created Transaction object
        """
        from datetime import datetime
        
        # Determine status
        confidence = parsed_data.get("_confidence", 0.8)
        status = "approved" if (auto_approve and confidence >= 0.8) else "pending"
        
        # Determine type (expense by default for receipts)
        trans_type = "expense"
        
        # Parse date
        date_str = parsed_data.get("date")
        try:
            trans_date = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else datetime.utcnow().date()
        except ValueError:
            trans_date = datetime.utcnow().date()
        
        # Create transaction
        transaction = Transaction(
            user_id=user_id,
            type=trans_type,
            amount=parsed_data.get("total_amount", Decimal("0")),
            currency="IDR",
            date=trans_date,
            description=f"Receipt: {parsed_data.get('merchant_name', 'Unknown')}",
            account_id=account_id,
            status=status,
            source=source,
            raw_data=raw_data,
            merchant_name=parsed_data.get("merchant_name"),
            merchant_address=parsed_data.get("location"),
            confidence_score=Decimal(str(confidence)),
            detection_type="OCR_RECEIPT"
        )
        
        self.db.add(transaction)
        self.db.flush()  # Get transaction ID
        
        # Create transaction items
        items = parsed_data.get("items", [])
        for item_data in items:
            item = TransactionItem(
                transaction_id=transaction.id,
                name=item_data.get("name", "Item"),
                quantity=Decimal(str(item_data.get("quantity", 1))),
                unit_price=Decimal(str(item_data.get("unit_price", 0))),
                total_price=Decimal(str(item_data.get("total_price", 0))),
                category_name=item_data.get("category")
            )
            self.db.add(item)
        
        self.db.commit()
        self.db.refresh(transaction)
        
        return transaction


# Synchronous wrapper for API routes
def parse_receipt_sync(db: Session, image_base64: str) -> Dict[str, Any]:
    """Synchronous wrapper for receipt parsing."""
    import asyncio
    
    parser = ReceiptParser(db)
    
    # Run async method in sync context
    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(parser.parse_with_gemini(image_base64))
        return result
    finally:
        loop.close()
