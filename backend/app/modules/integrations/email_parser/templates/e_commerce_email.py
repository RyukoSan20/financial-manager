"""
E-Commerce Email Parser - Parses Shopee, Tokopedia, Grab, GoFood notifications.
"""
import re
from typing import Dict, Any, Optional, List
from datetime import datetime

from .base_email_parser import BaseEmailParser, ParsedTransaction


class ShopeeEmailParser(BaseEmailParser):
    """Parser for Shopee notification emails."""
    
    DOMAINS = ["shopee.co.id", "shopee.com"]
    
    def can_parse(self, email_data: Dict[str, Any]) -> bool:
        sender = email_data.get("from", "").lower()
        subject = email_data.get("subject", "").lower()
        return any(domain in sender for domain in self.DOMAINS) or "shopee" in subject
    
    def parse(self, email_data: Dict[str, Any]) -> Optional[ParsedTransaction]:
        body = email_data.get("body", "")
        subject = email_data.get("subject", "")
        
        # Check for successful transaction
        if not any(x in body.lower() for x in ["pembayaran", "success", "berhasil", "order"]):
            return None
        
        amount, raw_amount = self.extract_amount(body)
        if amount is None:
            return None
        
        # Extract order ID
        order_match = re.search(r'(?:Order|Ord)[^\d]*(\d{8,})', body, re.IGNORECASE)
        reference = order_match.group(1) if order_match else email_data.get("id", "")
        
        # Extract items
        items = self._extract_items(body)
        description = f"Shopee - {len(items)} item" if items else "Shopee"
        
        return ParsedTransaction(
            amount=amount,
            transaction_type="expense",
            description=description,
            merchant="Shopee",
            date=self.extract_date(body) or datetime.utcnow(),
            reference=reference,
            category="Belanja Online",
            raw_amount=raw_amount
        )
    
    def _extract_items(self, body: str) -> List[str]:
        """Extract item names from email body."""
        items = []
        # Common pattern: item names followed by price
        matches = re.findall(r'([A-Za-z0-9\s]{3,50})\s*[\n\r]\s*[\dRp.,]+', body)
        for match in matches[:5]:  # Limit to 5 items
            item = match.strip()
            if len(item) > 3 and len(item) < 50:
                items.append(item)
        return items


class TokopediaEmailParser(BaseEmailParser):
    """Parser for Tokopedia notification emails."""
    
    DOMAINS = ["tokopedia.com", "pt-tokopedia.com"]
    
    def can_parse(self, email_data: Dict[str, Any]) -> bool:
        sender = email_data.get("from", "").lower()
        return any(domain in sender for domain in self.DOMAINS)
    
    def parse(self, email_data: Dict[str, Any]) -> Optional[ParsedTransaction]:
        body = email_data.get("body", "")
        
        if not any(x in body.lower() for x in ["pembayaran", "success", "berhasil", "transaksi"]):
            return None
        
        amount, raw_amount = self.extract_amount(body)
        if amount is None:
            return None
        
        return ParsedTransaction(
            amount=amount,
            transaction_type="expense",
            description="Tokopedia",
            merchant="Tokopedia",
            date=self.extract_date(body) or datetime.utcnow(),
            reference=email_data.get("id", ""),
            category="Belanja Online",
            raw_amount=raw_amount
        )


class GrabEmailParser(BaseEmailParser):
    """Parser for Grab (GrabFood, GrabCar, GrabPay) notifications."""
    
    DOMAINS = ["grab.com", "grab.id"]
    
    def can_parse(self, email_data: Dict[str, Any]) -> bool:
        sender = email_data.get("from", "").lower()
        return any(domain in sender for domain in self.DOMAINS)
    
    def parse(self, email_data: Dict[str, Any]) -> Optional[ParsedTransaction]:
        body = email_data.get("body", "")
        
        # Determine service type
        service_type = "Grab"
        subject = email_data.get("subject", "").lower()
        
        if "food" in subject:
            service_type = "GrabFood"
        elif "car" in subject:
            service_type = "GrabCar"
        elif "pay" in subject:
            service_type = "GrabPay"
        
        amount, raw_amount = self.extract_amount(body)
        if amount is None:
            return None
        
        return ParsedTransaction(
            amount=amount,
            transaction_type="expense",
            description=service_type,
            merchant=service_type,
            date=self.extract_date(body) or datetime.utcnow(),
            reference=email_data.get("id", ""),
            category=self._categorize(service_type),
            raw_amount=raw_amount
        )
    
    def _categorize(self, service: str) -> str:
        if "Food" in service:
            return "Makanan & Minuman"
        elif "Car" in service:
            return "Transportasi"
        return "Transportasi"
