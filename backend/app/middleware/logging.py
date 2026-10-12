"""
Logging Middleware - Auto-log all API requests
"""

import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import json


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all API requests."""
    
    async def dispatch(self, request: Request, call_next):
        # Generate session ID if not exists
        session_id = request.headers.get('x-session-id') or str(uuid.uuid4())
        
        # Get client info
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get('user-agent', '')
        
        # Record start time
        start_time = time.time()
        
        # Process request
        response = None
        error_message = None
        
        try:
            response = await call_next(request)
            response_status = response.status_code
        except Exception as e:
            error_message = str(e)
            response_status = 500
            raise
        finally:
            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log the request (async in background)
            self._log_request(
                session_id=session_id,
                method=request.method,
                endpoint=str(request.url.path),
                query_params=dict(request.query_params),
                response_status=response_status,
                duration_ms=duration_ms,
                client_ip=client_ip,
                user_agent=user_agent,
                error_message=error_message,
            )
        
        # Add session ID to response headers
        if response:
            response.headers['x-session-id'] = session_id
        
        return response
    
    def _log_request(
        self,
        session_id: str,
        method: str,
        endpoint: str,
        query_params: dict,
        response_status: int,
        duration_ms: int,
        client_ip: str,
        user_agent: str,
        error_message: str = None,
    ):
        """Log request to database (called in sync context)."""
        import asyncio
        from app.core.database import get_db
        from app.models.activity_log import ActivityLog
        
        def _do_log():
            try:
                db = next(get_db())
                log = ActivityLog(
                    session_id=session_id,
                    action=f"{method} {endpoint}",
                    resource="api",
                    method=method,
                    endpoint=endpoint,
                    request_data=query_params if query_params else None,
                    response_status=response_status,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    duration_ms=duration_ms,
                    error_message=error_message,
                )
                db.add(log)
                db.commit()
                db.close()
            except Exception as e:
                print(f"Logging error: {e}")
        
        # Run in background thread
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.run_in_executor(None, _do_log)
            else:
                _do_log()
        except:
            _do_log()
