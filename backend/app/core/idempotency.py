"""
Idempotency Module - Prevents duplicate transaction recording.
Uses Redis to store idempotency keys.
"""
import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, Any


class IdempotencyChecker:
    """
    Prevents duplicate recording of transactions using idempotency keys.
    Based on RFC 9110 HTTP semantics.
    """
    
    def __init__(self, redis_client=None):
        self.redis = redis_client
        self.default_ttl = 24 * 60 * 60  # 24 hours
    
    def generate_key(self, user_id: int, source: str, external_id: str) -> str:
        """
        Generate deterministic idempotency key.
        Format: idempotency:{user_id}:{source}:{external_id_hash}
        """
        hash_input = f"{user_id}:{source}:{external_id}"
        hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:16]
        return f"idempotency:{user_id}:{hash_value}"
    
    async def check_and_store(
        self,
        key: str,
        response_data: dict,
        ttl: Optional[int] = None
    ) -> tuple[bool, Optional[dict]]:
        """
        Check if key exists and store if not.
        
        Returns:
            Tuple of (is_new_request, cached_response)
            - is_new_request=True, cached_response=None: First request, proceed
            - is_new_request=False, cached_response=data: Duplicate, return cached
        """
        if not self.redis:
            # No Redis = skip idempotency (development mode)
            return True, None
        
        ttl = ttl or self.default_ttl
        
        try:
            # Try to get existing entry
            existing = self.redis.get(key)
            
            if existing:
                # Duplicate request - return cached response
                return False, json.loads(existing)
            
            # Store new entry with TTL
            self.redis.setex(
                key,
                ttl,
                json.dumps(response_data)
            )
            
            return True, None
            
        except Exception:
            # On Redis error, allow the request
            return True, None
    
    async def invalidate(self, key: str) -> bool:
        """Remove idempotency key (for cleanup/testing)."""
        if not self.redis:
            return False
        
        try:
            self.redis.delete(key)
            return True
        except Exception:
            return False
    
    def is_duplicate_reference(
        self,
        user_id: int,
        source: str,
        reference_id: str
    ) -> bool:
        """
        Check if a transaction with this reference already exists.
        Used for deduplication of bank transfers.
        """
        if not self.redis:
            return False
        
        key = self.generate_key(user_id, source, reference_id)
        
        try:
            return self.redis.exists(key) > 0
        except Exception:
            return False


# Singleton instance
idempotency = IdempotencyChecker()


async def check_transaction_idempotency(
    user_id: int,
    source: str,
    external_id: str,
    response: dict
) -> tuple[bool, Optional[dict]]:
    """
    Check idempotency for transaction recording.
    Returns (is_new, cached_response).
    """
    key = idempotency.generate_key(user_id, source, external_id)
    return await idempotency.check_and_store(key, response)


def mark_transaction_recorded(
    user_id: int,
    source: str,
    external_id: str
) -> str:
    """
    Mark a transaction as recorded for idempotency tracking.
    Returns the idempotency key.
    """
    key = idempotency.generate_key(user_id, source, external_id)
    # Store with default TTL
    if idempotency.redis:
        idempotency.redis.setex(
            key,
            idempotency.default_ttl,
            json.dumps({"recorded_at": datetime.utcnow().isoformat()})
        )
    return key
