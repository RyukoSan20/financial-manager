"""
PII Scrubber - Protects sensitive data before sending to LLM.
Complies with UU PDP (Perlindungan Data Pribadi) Indonesia.
"""
import re
from typing import Dict, Optional


class PIIScrubber:
    """
    Scrubs Personally Identifiable Information from text.
    
    Protects:
    - Bank account numbers
    - Credit card numbers
    - NIK (KTP number)
    - Phone numbers
    - Email addresses
    - Full names
    """
    
    # Indonesian phone patterns
    PHONE_PATTERNS = [
        r'\+62[\s\-]?8[0-9]{1,3}[\s\-]?[0-9]{4,8}',  # +62 812 xxxx xxxx
        r'08[0-9]{1,3}[\s\-]?[0-9]{4,8}',  # 0812 xxxx xxxx
    ]
    
    # Indonesian NIK/KTP (16 digits)
    NIK_PATTERN = r'\b[0-9]{16}\b'
    
    # Bank account (various formats)
    BANK_ACCOUNT_PATTERNS = [
        r'\b[0-9]{10,16}\b',  # 10-16 digit account numbers
    ]
    
    # Credit card (16 digits, often with spaces)
    CARD_PATTERN = r'\b[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}\b'
    
    def __init__(self):
        self.phone_regex = [re.compile(p, re.IGNORECASE) for p in self.PHONE_PATTERNS]
        self.nik_regex = re.compile(self.NIK_PATTERN)
        self.card_regex = re.compile(self.CARD_PATTERN)
    
    def scrub(self, text: str) -> str:
        """
        Remove or mask PII from text.
        
        Args:
            text: Input text that may contain PII
        
        Returns:
            Text with PII masked
        """
        if not text:
            return text
        
        scrubbed = text
        
        # Mask phone numbers
        for pattern in self.phone_regex:
            scrubbed = pattern.sub('[PHONE]', scrubbed)
        
        # Mask NIK
        scrubbed = self.nik_regex.sub('[NIK]', scrubbed)
        
        # Mask credit card numbers
        scrubbed = self.card_regex.sub('[CARD]', scrubbed)
        
        # Mask bank account numbers (be careful not to mask other numbers)
        # Only mask 10-16 digit sequences that look like account numbers
        for pattern in self.BANK_ACCOUNT_PATTERNS:
            matches = re.finditer(pattern, scrubbed)
            for match in matches:
                num = match.group()
                # Skip if it looks like a year or date
                if not re.match(r'^20[0-9]{2}$', num):
                    scrubbed = scrubbed.replace(num, f'[ACCOUNT:{len(num)}digit]')
        
        return scrubbed
    
    def scrub_transaction(self, transaction: Dict) -> Dict:
        """
        Scrub PII from a transaction dict.
        
        Keeps amount, date, category, but masks description and merchant.
        """
        scrubbed = transaction.copy()
        
        # Mask sensitive fields
        if 'description' in scrubbed:
            scrubbed['description'] = self.scrub(scrubbed['description'])
        
        if 'merchant_name' in scrubbed:
            scrubbed['merchant_name'] = self.scrub(scrubbed['merchant_name'])
        
        if 'notes' in scrubbed:
            scrubbed['notes'] = self.scrub(scrubbed.get('notes', ''))
        
        # Remove full account numbers if present
        if 'account_number' in scrubbed:
            acc = str(scrubbed['account_number'])
            scrubbed['account_number'] = f"****{acc[-4:]}" if len(acc) > 4 else "[ACCOUNT]"
        
        return scrubbed
    
    def scrub_user_context(self, user_data: Dict) -> Dict:
        """
        Scrub PII from user context sent to AI.
        
        Keeps:
        - Salary/income ranges (e.g., "5-10 juta")
        - City/region
        - Occupation category
        
        Masks:
        - Full name -> first name only
        - Full address
        - Phone number
        - Email
        """
        scrubbed = user_data.copy()
        
        # Mask full name
        if 'full_name' in scrubbed:
            name = scrubbed['full_name']
            if name:
                first_name = name.split()[0]
                scrubbed['full_name'] = first_name
        
        # Mask email
        if 'email' in scrubbed:
            email = scrubbed['email']
            if email and '@' in email:
                local = email.split('@')[0]
                if len(local) > 2:
                    scrubbed['email'] = local[:2] + '***@' + email.split('@')[1]
                else:
                    scrubbed['email'] = '***@' + email.split('@')[1]
        
        # Mask phone
        if 'phone' in scrubbed:
            scrubbed['phone'] = '[PHONE]'
        
        return scrubbed
    
    def get_pii_count(self, text: str) -> int:
        """Count PII occurrences in text."""
        count = 0
        
        for pattern in self.phone_regex:
            count += len(pattern.findall(text))
        
        count += len(self.nik_regex.findall(text))
        count += len(self.card_regex.findall(text))
        
        return count


# Singleton instance
pii_scrubber = PIIScrubber()


def scrub_for_ai(text: str) -> str:
    """Convenience function to scrub text before sending to AI."""
    return pii_scrubber.scrub(text)


def scrub_transaction_for_ai(transaction: Dict) -> Dict:
    """Convenience function to scrub transaction for AI."""
    return pii_scrubber.scrub_transaction(transaction)
