"""
Email Parser Module - Automated Gmail transaction reader.
"""
from .gmail_oauth import GmailOAuth, GmailService, get_gmail_service
from .gmail_router import router as gmail_router
from .parser_registry import parser_registry, parse_email, ParserRegistry, ParseResult
from .email_poller import EmailPoller, PollerConfig, run_poller_for_user

__all__ = [
    "GmailOAuth",
    "GmailService", 
    "get_gmail_service",
    "parser_registry",
    "parse_email",
    "ParserRegistry",
    "ParseResult",
    "EmailPoller",
    "PollerConfig",
    "run_poller_for_user"
]
