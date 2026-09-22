"""Smart Parser Service for OCR, SMS, and QRIS transaction detection."""

import re
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List
from dataclasses import dataclass


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
    
    def parse_amount(self, amount_str: str) -> Decimal:
        """Convert amount string to Decimal."""
        # Remove spaces, dots (thousand separator), replace comma with dot
        cleaned = amount_str.replace(" ", "").replace(".", "").replace(",", ".")
        return Decimal(cleaned)
    
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
        """Parse raw SMS/text and extract transaction data."""
        results = []
        
        # Normalize text
        text = raw_text.strip()
        if not text:
            return results
        
        # Detect source
        detection_type = "SMS_BANK"
        if "qris" in text.lower():
            detection_type = "QRIS_TEXT"
        
        bank = self.detect_bank(text)
        
        # Try to parse with bank's specific patterns
        patterns = self.BANK_PATTERNS.get(bank, self.BANK_PATTERNS["GENERIC"])
        
        # Try debit patterns
        for pattern in patterns.get("debit", []):
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                groups = match.groups()
                if len(groups) >= 2:
                    try:
                        # Try to find amount and merchant from groups
                        amount = None
                        merchant = None
                        
                        for g in groups:
                            if g and re.search(r"[\d,]+", g):
                                try:
                                    amount = self.parse_amount(g)
                                except:
                                    pass
                            elif g and len(g) > 1:
                                merchant = g.strip()
                        
                        if amount:
                            results.append(ParsedTransaction(
                                amount=amount,
                                transaction_type="DEBIT",
                                merchant_name=merchant,
                                description=merchant,
                                date_time=self.parse_date(text),
                                account_source=bank,
                                confidence_score=0.75,
                                detection_type=detection_type,
                                raw_text=raw_text,
                            ))
                    except Exception:
                        continue
        
        # Try credit patterns
        for pattern in patterns.get("credit", []):
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                groups = match.groups()
                if len(groups) >= 2:
                    try:
                        amount = None
                        source = None
                        
                        for g in groups:
                            if g and re.search(r"[\d,]+", g):
                                try:
                                    amount = self.parse_amount(g)
                                except:
                                    pass
                            elif g and len(g) > 1:
                                source = g.strip()
                        
                        if amount:
                            results.append(ParsedTransaction(
                                amount=amount,
                                transaction_type="CREDIT",
                                merchant_name=source,
                                description=f"Transfer dari {source}" if source else "Penerimaan",
                                date_time=self.parse_date(text),
                                account_source=bank,
                                confidence_score=0.75,
                                detection_type=detection_type,
                                raw_text=raw_text,
                            ))
                    except Exception:
                        continue
        
        # Try e-wallet patterns
        for wallet_name, config in self.EWALLET_PATTERNS.items():
            matches = re.finditer(config["pattern"], text, re.IGNORECASE)
            for match in matches:
                groups = match.groups()
                try:
                    amount = None
                    merchant = None
                    
                    for g in groups:
                        if g and re.search(r"[\d,]+", g):
                            amount = self.parse_amount(g)
                        elif g and len(g.strip()) > 1:
                            merchant = g.strip()
                    
                    if amount:
                        results.append(ParsedTransaction(
                            amount=amount,
                            transaction_type=config["type"].upper(),
                            merchant_name=merchant,
                            description=f"{wallet_name}: {merchant}" if merchant else wallet_name,
                            date_time=self.parse_date(text),
                            account_source=wallet_name,
                            confidence_score=0.80,
                            detection_type="SMS_BANK",
                            raw_text=raw_text,
                        ))
                except Exception:
                    continue
        
        # If no results, try generic patterns
        if not results:
            # Try to find any amount in the text
            amount_matches = re.findall(r"Rp[\s.]*([\d,]+)", text, re.IGNORECASE)
            if amount_matches:
                for amt_str in amount_matches:
                    try:
                        amount = self.parse_amount(amt_str)
                        results.append(ParsedTransaction(
                            amount=amount,
                            transaction_type="DEBIT",  # Default to debit for unknown sources
                            description=text[:100],
                            date_time=self.parse_date(text),
                            confidence_score=0.30,  # Low confidence for generic parse
                            detection_type=detection_type,
                            raw_text=raw_text,
                        ))
                    except Exception:
                        continue
        
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
