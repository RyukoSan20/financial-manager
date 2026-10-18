"""
Base Email Parser - Abstract interface for all email parsers.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ParsedTransaction:
    """Structured transaction extracted from email."""
    amount: float
    transaction_type: str  # "income" or "expense"
    description: str
    merchant: str
    date: datetime
    reference: str
    category: str = "Lainnya"
    raw_amount: str = ""  # Raw amount string for debugging


class BaseEmailParser(ABC):
    """
    Abstract base class for email parsers.
    Each parser handles a specific email format.
    """
    
    DOMAINS: list = []
    
    @abstractmethod
    def can_parse(self, email_data: Dict[str, Any]) -> bool:
        """
        Check if this parser can handle the email.
        Returns True if the email matches this parser's domain/pattern.
        """
        pass
    
    @abstractmethod
    def parse(self, email_data: Dict[str, Any]) -> Optional[ParsedTransaction]:
        """
        Parse email and extract transaction data.
        Returns ParsedTransaction if successful, None otherwise.
        """
        pass
    
    def extract_amount(self, text: str, pattern: str = None) -> Tuple[Optional[float], str]:
        """
        Extract amount from text.
        Returns (amount, raw_amount_string).
        """
        import re
        
        # Common patterns for Indonesian amounts
        patterns = [
            r'Rp\.?\s*([\d\,\.]+)',
            r'([\d\,\.]+)\s*Rp',
            r'Total\s*:?\s*Rp\.?\s*([\d\,\.]+)',
            r'Jumlah\s*:?\s*Rp\.?\s*([\d\,\.]+)',
        ]
        
        if pattern:
            patterns.insert(0, pattern)
        
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                raw = match.group(1).replace('.', '').replace(',', '')
                try:
                    return float(raw), match.group(0)
                except ValueError:
                    continue
        
        return None, ""
    
    def extract_date(self, text: str) -> Optional[datetime]:
        """Extract date from text."""
        import re
        from dateutil import parser
        
        patterns = [
            r'(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})',
            r'(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})',
            r'(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})',
        ]
        
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                try:
                    return parser.parse(match.group(0), dayfirst=True)
                except:
                    continue
        
        return None
    
    def generate_idempotency_key(
        self,
        user_id: int,
        email_id: str,
        amount: float,
        merchant: str
    ) -> str:
        """Generate unique idempotency key for this transaction."""
        import hashlib
        import json
        
        data = {
            "user_id": user_id,
            "email_id": email_id,
            "amount": round(amount, 2),
            "merchant": merchant.lower().strip()
        }
        
        hash_str = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:16]
        return f"email_{user_id}_{hash_str}"
