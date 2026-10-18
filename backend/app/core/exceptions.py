"""
Global Exception Handling - RFC 7807 Problem Details
Standardizes error responses across the API.
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from typing import Optional, Dict, Any
from datetime import datetime
import uuid


class AppException(Exception):
    """Base application exception with RFC 7807 support."""
    
    def __init__(
        self,
        status_code: int,
        title: str,
        detail: str = "",
        instance: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None
    ):
        self.status_code = status_code
        self.title = title
        self.detail = detail
        self.instance = instance
        self.extra = extra or {}
        super().__init__(detail)


class NotFoundError(AppException):
    """Resource not found."""
    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            status_code=404,
            title="Resource Not Found",
            detail=f"{resource} with identifier '{identifier}' was not found.",
            instance=f"/{resource}/{identifier}"
        )


class UnauthorizedError(AppException):
    """Authentication required."""
    def __init__(self, detail: str = "Authentication required"):
        super().__init__(
            status_code=401,
            title="Unauthorized",
            detail=detail
        )


class ForbiddenError(AppException):
    """Access denied."""
    def __init__(self, detail: str = "You do not have permission to access this resource"):
        super().__init__(
            status_code=403,
            title="Forbidden",
            detail=detail
        )


class ConflictError(AppException):
    """Resource conflict (duplicate)."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=409,
            title="Conflict",
            detail=detail
        )


class ValidationAppError(AppException):
    """Business logic validation error."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=422,
            title="Unprocessable Entity",
            detail=detail
        )


class RateLimitError(AppException):
    """Rate limit exceeded."""
    def __init__(self, retry_after: int = 60):
        super().__init__(
            status_code=429,
            title="Too Many Requests",
            detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
            extra={"retry_after": retry_after}
        )


class ServiceUnavailableError(AppException):
    """External service unavailable."""
    def __init__(self, service: str):
        super().__init__(
            status_code=503,
            title="Service Unavailable",
            detail=f"The {service} service is currently unavailable. Please try again later."
        )


def create_problem_response(
    status_code: int,
    title: str,
    detail: str = "",
    instance: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None
) -> JSONResponse:
    """Create RFC 7807 Problem Details response."""
    body = {
        "type": f"https://finmanager.online/errors/{status_code}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": instance or f"/{uuid.uuid4()}",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if extra:
        body["extensions"] = extra
    
    return JSONResponse(status_code=status_code, content=body)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom AppException."""
    return create_problem_response(
        status_code=exc.status_code,
        title=exc.title,
        detail=exc.detail,
        instance=exc.instance,
        extra=exc.extra
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation errors."""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    return create_problem_response(
        status_code=422,
        title="Validation Error",
        detail="Request validation failed",
        instance=str(request.url),
        extra={"errors": errors}
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    # In production, log the error and return generic message
    # In development, include the actual error
    import os
    is_dev = os.getenv("DEBUG", "false").lower() == "true"
    
    if is_dev:
        import traceback
        return create_problem_response(
            status_code=500,
            title="Internal Server Error",
            detail=str(exc),
            instance=str(request.url),
            extra={"traceback": traceback.format_exc()}
        )
    
    return create_problem_response(
        status_code=500,
        title="Internal Server Error",
        detail="An unexpected error occurred. Please try again later.",
        instance=str(request.url)
    )
