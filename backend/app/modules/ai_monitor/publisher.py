"""
AI Monitor Publisher - Redis Pub/Sub for error event streaming.
Publishes errors to Redis channel for real-time AI analysis.
"""
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
import asyncio


class ErrorPublisher:
    """
    Publisher for error events to Redis Pub/Sub channel.
    Non-blocking publish to ensure API performance.
    """
    
    CHANNEL = "error:stream"
    
    def __init__(self, redis_client=None):
        self.redis = redis_client
        self._loop = None
    
    def _get_loop(self):
        """Get or create event loop."""
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop
    
    async def publish(self, error_data: Dict[str, Any]) -> bool:
        """
        Publish error to Redis channel.
        Returns True if successful.
        """
        if not self.redis:
            print(f"[ErrorPublisher] No Redis, would publish: {error_data.get('error_type')}")
            return False
        
        try:
            # Prepare payload
            payload = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat(),
                "source": "backend",
                **error_data
            }
            
            # Publish to Redis channel
            subscriber_count = self.redis.publish(self.CHANNEL, json.dumps(payload))
            
            print(f"[ErrorPublisher] Published error {payload['id']} to {subscriber_count} subscribers")
            return True
            
        except Exception as e:
            print(f"[ErrorPublisher] Failed to publish: {e}")
            return False
    
    async def publish_exception(
        self,
        error: Exception,
        path: str,
        method: str,
        user_id: int = None,
        request_id: str = None,
        **kwargs
    ) -> bool:
        """Publish exception as structured error event."""
        import traceback
        
        return await self.publish({
            "error_type": "exception",
            "error_class": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback.format_exc(),
            "path": path,
            "method": method,
            "user_id": user_id,
            "request_id": request_id,
            **kwargs
        })
    
    async def publish_validation_error(
        self,
        errors: list,
        path: str,
        method: str,
        user_id: int = None,
        request_id: str = None
    ) -> bool:
        """Publish validation error event."""
        return await self.publish({
            "error_type": "validation_error",
            "errors": errors,
            "path": path,
            "method": method,
            "user_id": user_id,
            "request_id": request_id
        })
    
    async def publish_auth_error(
        self,
        message: str,
        path: str,
        method: str,
        request_id: str = None
    ) -> bool:
        """Publish authentication error event."""
        return await self.publish({
            "error_type": "auth_error",
            "error_message": message,
            "path": path,
            "method": method,
            "request_id": request_id
        })


class ErrorEventBuffer:
    """
    In-memory buffer for errors when Redis is unavailable.
    Flushes to Redis when connection is restored.
    """
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.buffer = []
        self.publisher = ErrorPublisher()
    
    def add(self, error_data: Dict[str, Any]):
        """Add error to buffer."""
        self.buffer.append({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            **error_data
        })
        
        # Trim buffer if too large
        if len(self.buffer) > self.max_size:
            self.buffer = self.buffer[-self.max_size:]
    
    async def flush(self, redis_client):
        """Flush buffered errors to Redis."""
        if not redis_client or not self.buffer:
            return
        
        self.publisher.redis = redis_client
        
        for error in self.buffer:
            await self.publisher.publish(error)
        
        cleared = len(self.buffer)
        self.buffer.clear()
        print(f"[ErrorBuffer] Flushed {cleared} buffered errors")


# Singleton instances
error_publisher = ErrorPublisher()
error_buffer = ErrorEventBuffer()


# Helper functions
async def publish_error(**error_data) -> bool:
    """Publish error to Redis channel."""
    return await error_publisher.publish(error_data)


async def publish_exception_error(
    error: Exception,
    path: str,
    method: str,
    **kwargs
) -> bool:
    """Publish exception to Redis."""
    return await error_publisher.publish_exception(
        error=error,
        path=path,
        method=method,
        **kwargs
    )
