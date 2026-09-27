"""Smart Parser Service for OCR, SMS, and QRIS transaction detection."""

import re
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass

from app.services.merchant_classifier import classify_transaction, suggest_category, merchant_classifier


@dataclass
class ParsedTransaction:
    """Structured transaction data from parser."""
    amount: Decimal
    transaction_type: str  # "DEBIT" or "CREDIT"
    merchant_name: Optional[str] = None
    description: Optional[str] = None
    date_time: Optional[datetime] = None
    account_source: Optional[str] = None
    card_number: Optional[str] = None
    reference_number: Optional[str] = None
    confidence_score: float = 0.0
    detection_type: str = "TEXT"
    raw_text: str = ""


class TextParserService:
    """Parse transaction data from SMS, QRIS text, and other text sources."""
    
    # Indonesian bank SMS patterns
    BANK_PATTERNS = {
        "BCA": {
            "debit": [
                r"\. ([A-Z0-9]+) ([A-Z][a-z]+) (?:melakukan|transfer|berbelanja|pembayaran)\s*(?:sejumlah|senilai|sebesar)?\s*Rp[\s.]*([\d,]+)",
                r"Rp[\s.]*([\d,]+)\s*(?:dari|ke)\s*([A-Z0-9]+)",
                r"Pembayaran\s+(?:ke\s+)?([A-Za-z0-9\s]+?)\s*(?:sejumlah|senilai|sebesar)?\s*Rp[\s.]*([\d,]+)",
            ],
            "credit": [
                r"(?:Transfer|Masuk|Penerimaan)\s+(?:dari)?\s*([A-Z0-9]+)\s*(?:senilai|sejumlah)?\s*Rp[\s.]*([\d,]+)",
                r"Rp[\s.]*([\d,]+)\s*(?:masuk|diterima|transfer)\s*(?:dari)?\s*([A-Z0-9]+)",
            ],
        },
        "MANDIRI": {
            "debit": [
                r"\. ([A-Z0-9]+)\s+([A-Z][a-z]+)\s+Rp([\d,]+)",
                r"Pembayaran\s+([A-Za-z0-9\s]+?)\s+Rp([\d,]+)",
            ],
            "credit": [
                r"Transfer\s+masuk\s+Rp([\d,]+)\s+dari\s+([A-Z0-9]+)",
                r"Received\s+Rp([\d,]+)\s+from\s+([A-Z0-9]+)",
            ],
        },
        "BRI": {
            "debit": [
                r"\. ([A-Z0-9]+)\s+([A-Z][a-z]+)\s+([\d,]+)",
                r"Transaksi\s+([A-Za-z0-9\s]+?)\s+([\d,]+)",
            ],
            "credit": [
                r"Setor\s+tunai?\s+Rp([\d,]+)",
                r"Trf\s+masuk\s+Rp([\d,]+)",
            ],
        },
        "BNI": {
            "debit": [
                r"\. ([A-Z0-9]+)\s+([A-Za-z]+)\s+([\d,]+)",
            ],
            "credit": [
                r"(?:Transfer|Normal)\s+(?:masuk|dari)\s+([A-Z0-9]+)\s+Rp([\d,]+)",
            ],
        },
        "GENERIC": {
            "debit": [
                r"(?:pembayaran|transaksi|belanja|transfer|debit)\s*(?:ke|untuk)?\s*([A-Za-z0-9\s]+?)\s*(?:sejumlah|senilai|sebesar)?\s*Rp[\s.]*([\d,]+)",
                r"Rp[\s.]*([\d,]+)\s*(?:ke|untuk)\s*([A-Za-z0-9\s]+?)(?:\s+dari|$)",
            ],
            "credit": [
                r"(?:transfer|masuk|penerimaan)\s*(?:dari)?\s*([A-Za-z0-9\s]+?)\s*(?:senilai|sejumlah|sebesar)?\s*Rp[\s.]*([\d,]+)",
                r"Rp[\s.]*([\d,]+)\s*(?:masuk|diterima)\s*(?:dari)?\s*([A-Za-z0-9\s]+?)",
            ],
        },
    }
    
    # E-wallet and QRIS patterns
    EWALLET_PATTERNS = {
        "GOPAY": {
            "pattern": r"(?:Gopay|GO-PAY|GOJEK)\s*(?:Payment|Transfer)?\s*(?:ke|from)?\s*([A-Za-z0-9\s]+?)?\s*(?:sejumlah|senilai|sebesar)?\s*Rp[\s.]*([\d,]+)",
            "type": "debit",
        },
        "OVO": {
            "pattern": r"(?:OVO)\s*(?:Payment|Transfer)?\s*(?:ke|from)?\s*([A-Za-z0-9\s]+?)?\s*(?:sejumlah|senilai)?\s*Rp[\s.]*([\d,]+)",
            "type": "debit",
        },
        "DANA": {
            "pattern": r"(?:DANA)\s*(?:Payment|Transfer)?\s*(?:ke|from)?\s*([A-Za-z0-9\s]+?)?\s*(?:sejumlah|senilai)?\s*Rp[\s.]*([\d,]+)",
            "type": "debit",
        },
        "SHOPEEPAY": {
            "pattern": r"(?:ShopeePay|Spice)\s*(?:Payment)?\s*(?:ke|from)?\s*([A-Za-z0-9\s]+?)?\s*(?:sejumlah|senilai)?\s*Rp[\s.]*([\d,]+)",
            "type": "debit",
        },
        "QRIS": {
            "pattern": r"(?:QRIS|Pembayaran\s+QR)\s*(?:di)?\s*([A-Za-z0-9\s]+?)?\s*Rp[\s.]*([\d,]+)",
            "type": "debit",
        },
    }
    
    # Date patterns
    DATE_PATTERNS = [
        r"(\d{1,2})/(\d{1,2})/(\d{4})",
        r"(\d{1,2})-(\d{1,2})-(\d{4})",
        r"(\d{4})-(\d{1,2})-(\d{1,2})",
        r"(\d{1,2})\s+(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agt|Sep|Oct|Nov|Des)[a-z]*\s+(\d{4})",
    ]
    
    # Enhanced amount patterns - handle various Indonesian formats
    # Must match the FULL amount including thousand separators
    AMOUNT_PATTERNS = {
        # Standard: Rp81.500 or Rp 81.500 or Rp81.500,00
        "full": [
            r'Rp\.?\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)',
            r'([\d]{1,3}(?:[.,]\d{3})*)\s*(?:Rp\.?|Rupiah)',
        ],
        # For SMS format: "Nomor Rp81.500" or " Sejumlah Rp50.000"
        "sms": [
            r'(?:Sejumlah|Nominal|Total|Bayar)[:\s]*Rp\.?\s*([\d.,]+)',
            r'Rp\.?\s*([\d.,]+)',
        ],
    }
    
    def parse_amount(self, amount_str: str) -> Optional[Decimal]:
        """Convert amount string to Decimal, handling Indonesian format."""
        if not amount_str:
            return None
        # Remove spaces
        cleaned = amount_str.strip()
        # Check if it contains Rp
        has_rp = 'rp' in cleaned.lower()
        # Remove Rp prefix
        cleaned = re.sub(r'rp\.?\s*', '', cleaned, flags=re.IGNORECASE)
        # Handle thousand separator: 81.500 -> 81500
        # Handle decimal: 81.500,00 -> 81500.00
        # First, normalize: replace . with '' (thousand sep), replace , with '.'
        cleaned = cleaned.replace('.', '').replace(',', '.')
        # Remove any remaining non-numeric except dot
        cleaned = re.sub(r'[^\d.]', '', cleaned)
        if not cleaned:
            return None
        try:
            return Decimal(cleaned)
        except:
            return None
    
    def extract_amount_from_sms(self, text: str) -> Optional[Decimal]:
        """Extract amount from Indonesian bank SMS with field labels."""
        # Try to find "Nominal" or "Sejumlah" field first (most reliable)
        patterns = [
            # Nominal: Rp81.500
            r'Nominal\s*[:\s]*Rp\.?\s*([\d.,]+)',
            # Sejumlah: Sejumlah Rp50.000
            r'Sejumlah\s*[:\s]*Rp\.?\s*([\d.,]+)',
            # Total: Total Rp81.500
            r'Total\s*(?:pembayaran)?\s*[:\s]*Rp\.?\s*([\d.,]+)',
            # Nominal field
            r'(?:Nominal|Total)\s+pembayaran\s+[:\s]*Rp\.?\s*([\d.,]+)',
            # Generic Rp followed by amount
            r'Rp\.?\s*([\d]{1,3}(?:[.,]\d{3})+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount = self.parse_amount(match.group(1))
                if amount and amount > 0:
                    return amount
        
        return None
    
    def parse_date(self, text: str) -> Optional[datetime]:
        """Extract date from text."""
        for pattern in self.DATE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    groups = match.groups()
                    if len(groups) == 3:
                        if len(groups[2]) == 4:  # YYYY-MM-DD format
                            return datetime(
                                int(groups[0]), int(groups[1]), int(groups[2])
                            )
                        elif len(groups[0]) == 4:  # YYYY-MM-DD
                            return datetime(
                                int(groups[0]), int(groups[1]), int(groups[2])
                            )
                        else:  # DD/MM/YYYY or similar
                            day, month, year = int(groups[0]), int(groups[1]), int(groups[2])
                            if year < 100:
                                year += 2000
                            return datetime(year, month, day)
                except (ValueError, IndexError):
                    continue
        return None
    
    def detect_bank(self, text: str) -> str:
        """Detect which bank the SMS is from."""
        text_lower = text.lower()
        
        if "bca" in text_lower:
            return "BCA"
        elif "mandiri" in text_lower:
            return "MANDIRI"
        elif "bri" in text_lower:
            return "BRI"
        elif "bni" in text_lower:
            return "BNI"
        elif "gopay" in text_lower or "gojek" in text_lower:
            return "GOPAY"
        elif "ovo" in text_lower:
            return "OVO"
        elif "dana" in text_lower:
            return "DANA"
        elif "shopeepay" in text_lower or "spice" in text_lower:
            return "SHOPEEPAY"
        elif "qris" in text_lower:
            return "QRIS"
        
        return "GENERIC"
    
    def parse_text(self, raw_text: str) -> List[ParsedTransaction]:
        """Parse raw SMS/text and extract transaction data using AI classification."""
        results = []
        
        # Normalize text
        text = raw_text.strip()
        if not text:
            return results
        
        # Detect source
        detection_type = "SMS_BANK"
        if "qris" in text.lower():
            detection_type = "QRIS_TEXT"
        
        # Use AI classifier for merchant and category detection
        classification = classify_transaction(text)
        
        # Try to extract amount using enhanced SMS field extraction
        amount = self.extract_amount_from_sms(text)
        
        # If still no amount, try patterns
        if not amount or amount < 100:
            amount = self.extract_amount_from_sms(text)
        
        # Extract merchant from various fields
        merchant = None
        
        # Try "Dibayarkan ke" field (for bank SMS)
        merchant_match = re.search(r'Dibayarkan ke\s+([^\n\-]+)', text, re.IGNORECASE)
        if merchant_match:
            raw_merchant = merchant_match.group(1).strip()
            # Clean up: remove card numbers, extra info
            merchant = re.sub(r'[\d\*]+.*$', '', raw_merchant).strip()
            if '-' in merchant:
                merchant = merchant.split('-')[0].strip()
        
        # Try "Diterima dari" field (for incoming transfers)
        if not merchant:
            received_match = re.search(r'(?:Diterima dari|Dari)\s+([^\n\-]+)', text, re.IGNORECASE)
            if received_match:
                merchant = received_match.group(1).strip()
        
        # If merchant found, re-classify with known merchant
        if merchant:
            classification = classify_transaction(text, merchant)
        
        # Detect transaction type from context
        tx_type = "DEBIT"
        if any(k in text.lower() for k in ['transfer masuk', 'penerimaan', 'diterima', 'masuk dari', 'dari:', 'dari ']):
            tx_type = "CREDIT"
        
        # Use classification to determine transaction type
        if classification.transaction_type_hint:
            if tx_type == "DEBIT":  # Only override if it's a debit
                pass  # Keep the detected type
        
        # Get category suggestion from classifier
        category_hint = merchant_classifier.get_category_suggestion(classification)
        
        # If classification confidence is low, try text-based category
        if classification.confidence < 0.7:
            cat_suggestion, cat_conf = suggest_category(text)
            if cat_conf > classification.confidence:
                category_hint = cat_suggestion
        
        # Parse date
        date_time = self.parse_date(text)
        
        # Calculate confidence
        confidence = classification.confidence
        if amount and amount >= 1000:
            confidence += 0.1
        if merchant:
            confidence += 0.05
        
        # Build description
        description = merchant or classification.display_name or "Transaksi"
        if tx_type == "CREDIT":
            description = f"Terima dari {merchant}" if merchant else "Penerimaan"
        
        # Create result
        if amount and amount > 0:
            results.append(ParsedTransaction(
                amount=amount,
                transaction_type=tx_type,
                merchant_name=merchant or classification.display_name,
                description=description,
                date_time=date_time,
                account_source=classification.source_type.replace("_", " ").title(),
                confidence_score=min(confidence, 0.95),
                detection_type=detection_type,
                raw_text=raw_text,
            ))
        
        # If no results from classifier, try pattern matching
        if not results:
            # Try e-wallet patterns
            for wallet_name, config in self.EWALLET_PATTERNS.items():
                matches = re.finditer(config["pattern"], text, re.IGNORECASE)
                for match in matches:
                    groups = match.groups()
                    try:
                        extracted_amount = amount  # Use already extracted amount
                        
                        if extracted_amount and extracted_amount >= 1000:
                            results.append(ParsedTransaction(
                                amount=extracted_amount,
                                transaction_type=config["type"].upper(),
                                merchant_name=wallet_name.upper(),
                                description=f"{wallet_name}: {config['type']}",
                                date_time=date_time,
                                account_source=wallet_name.upper(),
                                confidence_score=0.85,
                                detection_type="SMS_BANK",
                                raw_text=raw_text,
                            ))
                            break
                    except Exception:
                        continue
                if results:
                    break
        
        # If still no results, try generic patterns with enhanced extraction
        if not results and amount and amount >= 100:
            results.append(ParsedTransaction(
                amount=amount,
                transaction_type=tx_type,
                merchant_name=merchant or "Unknown",
                description=merchant or "Transaksi",
                date_time=date_time,
                account_source="BANK",
                confidence_score=0.70,
                detection_type=detection_type,
                raw_text=raw_text,
            ))
        
        return results


class OCRParserService:
    """Parse receipt images using OCR patterns (Tesseract-compatible)."""
    
    # Common Indonesian receipt patterns
    RECEIPT_PATTERNS = {
        "total": [
            r"(?:TOTAL|JUMLAH|SUB\s*TOTAL|GRAND\s*TOTAL)[:\s]*Rp?\s*([\d,]+)",
            r"(?:HARUS\s*DIBAYAR|TAGIHAN)[:\s]*Rp?\s*([\d,]+)",
            r"Rp\s*([\d,]+)\s*(?:$|\n|TUNAI|KARTU)",
        ],
        "merchant": [
            r"^([A-Z][A-Za-z0-9\s&]+)$",  # Store name at top
            r"(?:TOKO|TOKO|Toko)[:\s]*([A-Za-z0-9\s]+)",
            r"(?:NAMA\s*)?([A-Za-z0-9\s&]+)\s*(?:KUPON|POTONGAN|$)",
        ],
        "date": [
            r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})",
            r"(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})",
        ],
        "address": [
            r"([A-Za-z0-9\s.,\-]+(?:JL|JALAN|JL\.|KOTA|KOTA|BANK)[\s,A-Za-z0-9\-]+)",
            r"(?:ALAMAT|ADDRESS)[:\s]*([A-Za-z0-9\s.,\-]+)",
        ],
    }
    
    def parse_amount(self, amount_str: str) -> Decimal:
        """Convert amount string to Decimal."""
        cleaned = amount_str.replace(" ", "").replace(".", "").replace(",", ".")
        return Decimal(cleaned)
    
    def parse_receipt_text(self, ocr_text: str) -> ParsedTransaction:
        """Parse OCR text from receipt image."""
        text = ocr_text.strip()
        
        # Extract total amount
        total_amount = None
        for pattern in self.RECEIPT_PATTERNS["total"]:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                try:
                    total_amount = self.parse_amount(match.group(1))
                    break
                except Exception:
                    continue
        
        # Extract merchant name
        merchant_name = None
        lines = text.split("\n")
        for i, line in enumerate(lines[:5]):  # Check first 5 lines
            line = line.strip()
            if len(line) > 3 and line.isupper():
                merchant_name = line
                break
        
        # Extract date
        date_time = None
        for pattern in self.RECEIPT_PATTERNS["date"]:
            match = re.search(pattern, text)
            if match:
                try:
                    groups = match.groups()
                    if len(groups) == 3:
                        if len(groups[0]) == 4:
                            date_time = datetime(
                                int(groups[0]), int(groups[1]), int(groups[2])
                            )
                        else:
                            day, month, year = int(groups[0]), int(groups[1]), int(groups[2])
                            if year < 100:
                                year += 2000
                            date_time = datetime(year, month, day)
                except Exception:
                    continue
        
        # Extract address
        address = None
        for pattern in self.RECEIPT_PATTERNS["address"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                address = match.group(1).strip()
                break
        
        # Calculate confidence based on what we found
        confidence = 0.5
        if total_amount:
            confidence += 0.3
        if merchant_name:
            confidence += 0.1
        if date_time:
            confidence += 0.1
        
        return ParsedTransaction(
            amount=total_amount or Decimal("0"),
            transaction_type="DEBIT",  # Receipts are usually expenses
            merchant_name=merchant_name,
            description=f"Pembelian di {merchant_name}" if merchant_name else "Pembelian",
            date_time=date_time,
            address=address if address else None,
            confidence_score=min(confidence, 0.95),
            detection_type="OCR_RECEIPT",
            raw_text=ocr_text,
        )


# Global parser instances
text_parser = TextParserService()
ocr_parser = OCRParserService()


def parse_sms_or_qris(raw_text: str) -> List[ParsedTransaction]:
    """Main entry point for parsing SMS/QRIS text."""
    return text_parser.parse_text(raw_text)


def parse_receipt(ocr_text: str) -> ParsedTransaction:
    """Main entry point for parsing receipt OCR text."""
    return ocr_parser.parse_receipt_text(ocr_text)
