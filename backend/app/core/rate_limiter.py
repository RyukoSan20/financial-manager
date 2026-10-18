"""
Rate Limiter - Redis-backed rate limiting per subscription tier.
Implements token bucket algorithm with sliding window.
"""
import time
from typing import Optional, Tuple
from functools import wraps


class RateLimiter:
    """
    Redis-backed rate limiter using sliding window algorithm.
    Limits API calls based on subscription tier.
    """
    
    # Subscription tier limits (requests per minute)
    TIER_LIMITS = {
        "free": 60,        # 60 requests/minute
        "starter": 300,    # 300 requests/minute
        "pro": 1000,       # 1000 requests/minute
        "business": 5000,   # 5000 requests/minute
        "enterprise": 20000, # Unlimited
    }
    
    def __init__(self, redis_client=None):
        self.redis = redis_client
    
    def _get_key(self, identifier: str, tier: str = "free") -> str:
        """Generate Redis key for rate limit."""
        return f"rate_limit:{tier}:{identifier}"
    
    async def check_rate_limit(
        self,
        identifier: str,
        tier: str = "free",
        limit: Optional[int] = None
    ) -> Tuple[bool, int, int]:
        """
        Check if request is within rate limit.
        
        Returns:
            Tuple of (is_allowed, remaining_requests, retry_after_seconds)
        """
        if not self.redis:
            # No Redis = no rate limiting (development mode)
            return True, -1, 0
        
        limit = limit or self.TIER_LIMITS.get(tier, 60)
        key = self._get_key(identifier, tier)
        window = 60  # 1 minute window
        
        try:
            # Use sliding window counter
            now = time.time()
            window_start = now - window
            
            # Remove old entries
            self.redis.zremrangebyscore(key, 0, window_start)
            
            # Count current requests
            current = self.redis.zcard(key)
            
            if current >= limit:
                # Get oldest entry to calculate retry time
                oldest = self.redis.zrange(key, 0, 0, withscores=True)
                if oldest:
                    retry_after = int(oldest[0][1] + window - now) + 1
                else:
                    retry_after = 60
                return False, 0, max(1, retry_after)
            
            # Add current request
            self.redis.zadd(key, {str(now): now})
            self.redis.expire(key, window + 1)
            
            remaining = limit - current - 1
            return True, remaining, 0
            
        except Exception:
            # On Redis error, allow the request
            return True, -1, 0
    
    async def get_usage(self, identifier: str, tier: str = "free") -> dict:
        """Get current rate limit usage statistics."""
        if not self.redis:
            return {"used": 0, "limit": -1, "remaining": -1}
        
        key = self._get_key(identifier, tier)
        window = 60
        
        try:
            now = time.time()
            window_start = now - window
            
            # Clean old entries
            self.redis.zremrangebyscore(key, 0, window_start)
            
            used = self.redis.zcard(key)
            limit = self.TIER_LIMITS.get(tier, 60)
            
            return {
                "used": used,
                "limit": limit,
                "remaining": max(0, limit - used),
                "resets_in": window
            }
        except Exception:
            return {"used": 0, "limit": -1, "remaining": -1}


# Singleton instance
rate_limiter = RateLimiter()


async def check_api_rate_limit(
    user_id: int,
    tier: str = "free"
) -> Tuple[bool, int, int]:
    """Check rate limit for API endpoint."""
    return await rate_limiter.check_rate_limit(f"user:{user_id}", tier)


async def check_integration_rate_limit(
    user_id: int,
    integration_type: str
) -> Tuple[bool, int, int]:
    """Check rate limit for integration endpoints (bank sync, OCR, etc)."""
    identifier = f"integration:{user_id}:{integration_type}"
    # Integrations have stricter limits
    return await rate_limiter.check_rate_limit(identifier, "free", limit=10)
