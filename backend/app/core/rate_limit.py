"""
Rate Limiting Configuration
Prevents abuse of expensive API endpoints (Gemini, Maps, search, auth)
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

# Create limiter instance
limiter = Limiter(key_func=get_remote_address)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please slow down.",
            "retry_after": exc.detail
        }
    )


# Rate limit configurations per endpoint type
RATE_LIMITS = {
    # Auth endpoints - strict limits
    "auth_login": "5/minute",
    "auth_register": "3/minute",
    "auth_guest": "10/hour",
    "auth_google": "5/minute",
    
    # Search/AI endpoints - moderate limits (expensive)
    "search_price": "30/minute",
    "location": "60/minute",
    "ocr": "10/minute",
    "gemini": "20/minute",
    
    # General API - generous limits
    "default": "100/minute",
    "read": "200/minute",
}


def get_rate_limit_string(endpoint_type: str) -> str:
    """Get rate limit string for an endpoint type."""
    return RATE_LIMITS.get(endpoint_type, RATE_LIMITS["default"])
