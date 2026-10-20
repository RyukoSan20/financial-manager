"""
HTTP Client Configuration with Timeouts
Prevents hanging requests to external services (Maps, Gemini, Gmail)
"""
import httpx
from typing import Optional

# Default timeouts in seconds
DEFAULT_TIMEOUT = httpx.Timeout(
    timeout=10.0,      # Total timeout
    connect=5.0        # Connection timeout
)

# Strict timeouts for expensive operations
STRICT_TIMEOUT = httpx.Timeout(
    timeout=5.0,       # Total timeout (shorter for expensive ops)
    connect=3.0        # Connection timeout
)

# Map of service -> timeout config
SERVICE_TIMEOUTS = {
    "google_maps": STRICT_TIMEOUT,
    "gemini": httpx.Timeout(timeout=15.0, connect=5.0),  # AI can take longer
    "gmail": STRICT_TIMEOUT,
    "marketplace": httpx.Timeout(timeout=8.0, connect=3.0),
    "default": DEFAULT_TIMEOUT,
}


def get_http_client(service: Optional[str] = None, timeout: Optional[httpx.Timeout] = None) -> httpx.AsyncClient:
    """Get configured HTTP client for a service."""
    timeout_config = timeout or SERVICE_TIMEOUTS.get(service, DEFAULT_TIMEOUT)
    
    return httpx.AsyncClient(
        timeout=timeout_config,
        limits=httpx.Limits(
            max_keepalive_connections=20,
            max_connections=100
        )
    )


# Synchronous client for sync operations
def get_sync_http_client(service: Optional[str] = None) -> httpx.Client:
    """Get configured synchronous HTTP client."""
    timeout_config = SERVICE_TIMEOUTS.get(service, DEFAULT_TIMEOUT)
    
    return httpx.Client(timeout=timeout_config)
