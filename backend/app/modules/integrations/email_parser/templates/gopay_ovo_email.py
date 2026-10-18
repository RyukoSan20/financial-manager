"""
E-Wallet Email Parser - Parses GoPay, OVO, and DANA notifications.
"""
import re
from typing import Dict, Any, Optional
from datetime import datetime

from .base_email_parser import BaseEmailParser, ParsedTransaction


class GoPayEmailParser(BaseEmailParser):
    """Parser for GoPay notification emails."""
    
    DOMAINS = ["gopay.co.id", "gojek.com"]
    
    def can_parse(self, email_data: Dict[str, Any]) -> bool:
        sender = email_data.get("from", "").lower()
        return any(domain in sender for domain in self.DOMAINS)
    
    def parse(self, email_data: Dict[str, Any]) -> Optional[ParsedTransaction]:
        body = email_data.get("body", "")
        
        # Determine transaction type
        is_success = any(x in body.lower() for x in ["berhasil", "success", "sukses"])
        is_payment = any(x in body.lower() for x in ["pembayaran", "payment", "bayar"])
        
        if not is_success:
            return None
        
        # Extract amount
        amount, raw_amount = self.extract_amount(body)
        if amount is None:
            return None
        
        # Extract reference
        ref_match = re.search(r'(?:ID|Ref|Trx)[^\w]*([A-Z0-9]{8,})', body, re.IGNORECASE)
        reference = ref_match.group(1) if ref_match else email_data.get("id", "")
        
        # Extract merchant
        merchant_match = re.search(r'(?:Merchant|Toko|Tempat)[^\w]*([^\n]{3,50})', body, re.IGNORECASE)
        merchant = merchant_match.group(1).strip() if merchant_match else "GoPay"
        
        return ParsedTransaction(
            amount=amount,
            transaction_type="expense" if is_payment else "income",
            description=f"GoPay - {merchant}",
            merchant=f"GoPay - {merchant}",
            date=self.extract_date(body) or datetime.utcnow(),
            reference=reference,
            category="E-Wallet",
            raw_amount=raw_amount
        )


class OVOEmailParser(BaseEmailParser):
    """Parser for OVO notification emails."""
    
    DOMAINS = ["ovo.id", "pt-ovo.com"]
    
    def can_parse(self, email_data: Dict[str, Any]) -> bool:
        sender = email_data.get("from", "").lower()
        return any(domain in sender for domain in self.DOMAINS)
    
    def parse(self, email_data: Dict[str, Any]) -> Optional[ParsedTransaction]:
        body = email_data.get("body", "")
        
        if "berhasil" not in body.lower():
            return None
        
        amount, raw_amount = self.extract_amount(body)
        if amount is None:
            return None
        
        reference = re.search(r'(?:ID|Trx|Ref)[^\w]*([A-Z0-9]+)', body, re.IGNORECASE)
        
        return ParsedTransaction(
            amount=amount,
            transaction_type="expense",
            description="OVO Transaction",
            merchant="OVO",
            date=self.extract_date(body) or datetime.utcnow(),
            reference=reference.group(1) if reference else email_data.get("id", ""),
            category="E-Wallet",
            raw_amount=raw_amount
        )


class DanaEmailParser(BaseEmailParser):
    """Parser for DANA notification emails."""
    
    DOMAINS = ["dana.id", "mydana.com"]
    
    def can_parse(self, email_data: Dict[str, Any]) -> bool:
        sender = email_data.get("from", "").lower()
        return any(domain in sender for domain in self.DOMAINS)
    
    def parse(self, email_data: Dict[str, Any]) -> Optional[ParsedTransaction]:
        body = email_data.get("body", "")
        
        if "sukses" not in body.lower():
            return None
        
        amount, raw_amount = self.extract_amount(body)
        if amount is None:
            return None
        
        reference = re.search(r'(?:ID|Trx)[^\w]*([A-Z0-9]+)', body, re.IGNORECASE)
        
        return ParsedTransaction(
            amount=amount,
            transaction_type="expense",
            description="DANA Transaction",
            merchant="DANA",
            date=self.extract_date(body) or datetime.utcnow(),
            reference=reference.group(1) if reference else email_data.get("id", ""),
            category="E-Wallet",
            raw_amount=raw_amount
        )
