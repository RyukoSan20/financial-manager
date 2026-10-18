"""
Parser Registry - Routes emails to appropriate parsers.
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from .templates.base_email_parser import BaseEmailParser, ParsedTransaction
from .templates.bca_email import BCAEmailParser
from .templates.gopay_ovo_email import GoPayEmailParser, OVOEmailParser, DanaEmailParser
from .templates.e_commerce_email import ShopeeEmailParser, TokopediaEmailParser, GrabEmailParser


@dataclass
class ParseResult:
    """Result of parsing an email."""
    success: bool
    transaction: Optional[ParsedTransaction] = None
    parser_used: str = ""
    error: str = ""


class ParserRegistry:
    """
    Registry of email parsers by domain/type.
    Routes incoming emails to the appropriate parser.
    """
    
    def __init__(self):
        self.parsers: List[BaseEmailParser] = [
            # Bank parsers
            BCAEmailParser(),
            # E-Wallet parsers
            GoPayEmailParser(),
            OVOEmailParser(),
            DanaEmailParser(),
            # E-Commerce parsers
            ShopeeEmailParser(),
            TokopediaEmailParser(),
            GrabEmailParser(),
        ]
    
    def parse(self, email_data: Dict[str, Any]) -> ParseResult:
        """
        Parse email using the appropriate parser.
        Returns ParseResult with transaction data or error.
        """
        # Try each parser in order
        for parser in self.parsers:
            try:
                if parser.can_parse(email_data):
                    result = parser.parse(email_data)
                    if result:
                        return ParseResult(
                            success=True,
                            transaction=result,
                            parser_used=parser.__class__.__name__
                        )
            except Exception as e:
                continue
        
        # No parser matched
        return ParseResult(
            success=False,
            error="No parser matched this email format"
        )
    
    def parse_with_llm_fallback(
        self,
        email_data: Dict[str, Any],
        llm_client = None
    ) -> ParseResult:
        """
        Parse email, falling back to LLM if no parser matches.
        Uses Gemini for semantic extraction.
        """
        # Try standard parsers first
        result = self.parse(email_data)
        if result.success:
            return result
        
        # Try LLM if available
        if llm_client:
            return self._parse_with_llm(email_data, llm_client)
        
        return result
    
    def _parse_with_llm(
        self,
        email_data: Dict[str, Any],
        llm_client
    ) -> ParseResult:
        """Use LLM to parse email when standard parsers fail."""
        import json
        
        prompt = f"""Extract transaction data from this email:

From: {email_data.get('from', '')}
Subject: {email_data.get('subject', '')}
Date: {email_data.get('date', '')}

Body (first 1000 chars):
{email_data.get('body', '')[:1000]}

Respond in JSON:
{{
  "amount": float,
  "type": "income" or "expense",
  "description": "string",
  "merchant": "string",
  "reference": "string",
  "category": "string"
}}

If no transaction found, respond: {{"error": "no_transaction"}}"""
        
        try:
            response = llm_client.generate(prompt)
            
            # Parse JSON response
            import re
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                
                if "error" in data:
                    return ParseResult(success=False, error="LLM could not extract transaction")
                
                from datetime import datetime
                return ParseResult(
                    success=True,
                    transaction=ParsedTransaction(
                        amount=data.get("amount", 0),
                        transaction_type=data.get("type", "expense"),
                        description=data.get("description", ""),
                        merchant=data.get("merchant", ""),
                        date=datetime.utcnow(),
                        reference=data.get("reference", ""),
                        category=data.get("category", "Lainnya")
                    ),
                    parser_used="LLM_Fallback"
                )
                
        except Exception as e:
            return ParseResult(success=False, error=f"LLM parsing failed: {str(e)}")
        
        return ParseResult(success=False, error="LLM parsing unavailable")


# Singleton instance
parser_registry = ParserRegistry()


def parse_email(email_data: Dict[str, Any]) -> ParseResult:
    """Convenience function to parse an email."""
    return parser_registry.parse(email_data)
