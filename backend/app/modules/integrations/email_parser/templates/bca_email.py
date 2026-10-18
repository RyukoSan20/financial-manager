"""
BCA Email Parser - Parses BCA transfer and transaction notifications.
"""
import re
from typing import Dict, Any, Optional
from datetime import datetime

from .base_email_parser import BaseEmailParser, ParsedTransaction


class BCAEmailParser(BaseEmailParser):
    """Parser for BCA bank notification emails."""
    
    DOMAINS = ["bca.co.id", "koran.bca.co.id"]
    
    def can_parse(self, email_data: Dict[str, Any]) -> bool:
        """Check if email is from BCA."""
        sender = email_data.get("from", "").lower()
        return any(domain in sender for domain in self.DOMAINS)
    
    def parse(self, email_data: Dict[str, Any]) -> Optional[ParsedTransaction]:
        """Parse BCA email for transaction data."""
        subject = email_data.get("subject", "").lower()
        body = email_data.get("body", "")
        
        # Determine transaction type
        is_credit = any(x in subject for x in ["masuk", "credit", "transfer masuk", "penerimaan"])
        is_debit = any(x in subject for x in ["keluar", "debit", "transfer keluar", "pengeluaran"])
        
        transaction_type = "income" if is_credit else "expense"
        
        # Extract amount
        amount, raw_amount = self.extract_amount(body)
        if amount is None:
            return None
        
        # Extract reference/transaction ID
        ref_match = re.search(r'(?:No\.|Nomor|Ref)[^\d]*(\d{10,})', body, re.IGNORECASE)
        reference = ref_match.group(1) if ref_match else email_data.get("id", "")
        
        # Extract date
        date = self.extract_date(body)
        if date is None:
            date = datetime.utcnow()
        
        # Extract merchant/description
        merchant = self._extract_merchant(body, subject)
        
        # Extract description
        desc_match = re.search(r'(?:Keterangan|Deskripsi|Catatan)[:\s]*(.+?)(?:\n|$)', body, re.IGNORECASE)
        description = desc_match.group(1).strip() if desc_match else merchant
        
        return ParsedTransaction(
            amount=amount,
            transaction_type=transaction_type,
            description=description,
            merchant=merchant,
            date=date,
            reference=reference,
            category=self._categorize(body, transaction_type),
            raw_amount=raw_amount
        )
    
    def _extract_merchant(self, body: str, subject: str) -> str:
        """Extract merchant/recipient name."""
        # Try to find account name
        name_match = re.search(r'(?:Nama|Rekening|Penerima)[^\w]*([A-Z][A-Za-z\s]{2,30})', body)
        if name_match:
            return name_match.group(1).strip()
        
        return "BCA Transfer"
    
    def _categorize(self, body: str, tx_type: str) -> str:
        """Categorize transaction based on content."""
        body_lower = body.lower()
        
        if tx_type == "income":
            if any(x in body_lower for x in ["gaji", "salary", "fee"]):
                return "Gaji & Pendapatan"
            return "Transfer Masuk"
        
        # Expense categories
        if any(x in body_lower for x in ["belanja", "mart", "supermarket", "indomaret", "alfamart"]):
            return "Belanja"
        if any(x in body_lower for x in ["makan", "food", "restaurant", "cafe"]):
            return "Makanan & Minuman"
        if any(x in body_lower for x in ["transport", "grab", "gojek", "bensin"]):
            return "Transportasi"
        
        return "Transfer Keluar"
