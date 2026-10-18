"""
Error Interceptor - Global FastAPI error handling middleware.
Catches all exceptions and formats them as RFC 7807 Problem Details.
Also publishes errors to Redis for AI analysis.
"""
import traceback
import json
import uuid
from datetime import datetime
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.logger import get_logger, api_logger
from app.core.exceptions import (
    AppException,
    ValidationException,
    AuthenticationException,
    AuthorizationException,
    NotFoundException,
    ConflictException,
)


logger = get_logger("error_interceptor")


class ErrorInterceptorMiddleware(BaseHTTPMiddleware):
    """
    Middleware that intercepts all exceptions and formats them consistently.
    Also publishes errors to Redis for real-time monitoring.
    """
    
    def __init__(self, app: ASGIApp, redis_client=None):
        super().__init__(app)
        self.redis = redis_client
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and catch any errors."""
        request_id = str(uuid.uuid4())[:8]
        
        # Add request ID to state
        request.state.request_id = request_id
        
        try:
            response = await call_next(request)
            return response
            
        except AppException as e:
            # Handle known application exceptions (RFC 7807)
            return await self._handle_app_exception(request, e, request_id)
            
        except Exception as e:
            # Handle unexpected exceptions
            return await self._handle_unexpected_exception(request, e, request_id)
    
    async def _handle_app_exception(
        self,
        request: Request,
        exc: AppException,
        request_id: str
    ) -> JSONResponse:
        """Handle known application exceptions."""
        # Log the error
        logger.error(
            "app_exception",
            request_id=request_id,
            path=str(request.url.path),
            method=request.method,
            error_type=type(exc).__name__,
            error_message=str(exc),
            status_code=exc.status_code
        )
        
        # Publish to Redis
        await self._publish_error(
            error_type="app_exception",
            error_message=str(exc),
            status_code=exc.status_code,
            path=str(request.url.path),
            method=request.method,
            request_id=request_id,
            user_id=self._get_user_id(request)
        )
        
        # Return RFC 7807 response
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "type": f"https://my-financial-manager.online/errors/{exc.error_code}",
                "title": exc.title,
                "detail": str(exc),
                "status": exc.status_code,
                "instance": str(request.url.path),
                "error_code": exc.error_code,
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
    
    async def _handle_unexpected_exception(
        self,
        request: Request,
        exc: Exception,
        request_id: str
    ) -> JSONResponse:
        """Handle unexpected exceptions."""
        # Log full traceback
        tb = traceback.format_exc()
        logger.error(
            "unexpected_exception",
            request_id=request_id,
            path=str(request.url.path),
            method=request.method,
            error_type=type(exc).__name__,
            error_message=str(exc),
            traceback=tb
        )
        
        # Log to API logger
        api_logger.log_error(
            error=exc,
            request_path=str(request.url.path),
            request_method=request.method
        )
        
        # Publish to Redis for AI analysis
        await self._publish_error(
            error_type="unexpected_exception",
            error_message=str(exc),
            error_class=type(exc).__name__,
            traceback=tb,
            path=str(request.url.path),
            method=request.method,
            request_id=request_id,
            user_id=self._get_user_id(request),
            query_params=str(request.query_params),
            headers=dict(request.headers)
        )
        
        # Return generic error response
        return JSONResponse(
            status_code=500,
            content={
                "type": "https://my-financial-manager.online/errors/internal-error",
                "title": "Internal Server Error",
                "detail": "An unexpected error occurred. Please try again later.",
                "status": 500,
                "instance": str(request.url.path),
                "error_code": "INTERNAL_ERROR",
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
    
    async def _publish_error(self, **error_data):
        """Publish error to Redis for real-time monitoring."""
        if not self.redis:
            return
        
        try:
            import asyncio
            error_payload = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat(),
                "source": "backend",
                **error_data
            }
            
            # Use asyncio to publish without blocking
            loop = asyncio.get_event_loop()
            await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: self.redis.publish("error:stream", json.dumps(error_payload))
                ),
                timeout=1.0
            )
        except Exception as e:
            # Don't let Redis errors affect the main flow
            logger.warning("redis_publish_failed", error=str(e))
    
    def _get_user_id(self, request: Request) -> int:
        """Extract user ID from request if authenticated."""
        try:
            if hasattr(request.state, "user"):
                user = request.state.user
                if hasattr(user, "id"):
                    return user.id
                if isinstance(user, dict):
                    return user.get("id")
        except Exception:
            pass
        return None


class ErrorResponseFormatter:
    """
    Utility class for formatting error responses consistently.
    """
    
    @staticmethod
    def format_validation_error(
        errors: list,
        request_id: str = None
    ) -> dict:
        """Format validation error response."""
        return {
            "type": "https://my-financial-manager.online/errors/validation-error",
            "title": "Validation Error",
            "detail": "Request validation failed",
            "status": 422,
            "error_code": "VALIDATION_ERROR",
            "errors": errors,
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    @staticmethod
    def format_auth_error(
        message: str,
        request_id: str = None
    ) -> dict:
        """Format authentication error response."""
        return {
            "type": "https://my-financial-manager.online/errors/authentication-error",
            "title": "Authentication Error",
            "detail": message,
            "status": 401,
            "error_code": "AUTH_ERROR",
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    @staticmethod
    def format_not_found_error(
        resource: str,
        request_id: str = None
    ) -> dict:
        """Format not found error response."""
        return {
            "type": "https://my-financial-manager.online/errors/not-found",
            "title": "Resource Not Found",
            "detail": f"{resource} not found",
            "status": 404,
            "error_code": "NOT_FOUND",
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
        }


def setup_error_interceptor(app: ASGIApp, redis_client=None):
    """
    Setup error interceptor middleware for FastAPI app.
    
    Usage:
        from app.core.error_interceptor import setup_error_interceptor
        
        app = FastAPI()
        setup_error_interceptor(app, redis_client)
    """
    app.add_middleware(ErrorInterceptorMiddleware, redis_client=redis_client)
