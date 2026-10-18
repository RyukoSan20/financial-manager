"""
Structured Logger - JSON format logging.
Uses structlog if available, falls back to standard logging.
"""
import json
import logging
import sys
from typing import Any, Dict
from datetime import datetime

# Try to import structlog, fall back to standard logging
try:
    import structlog
    HAS_STRUCTLOG = True
except ImportError:
    HAS_STRUCTLOG = False
    structlog = None


def get_logger(name: str = "finmanager"):
    """Get a structured logger instance."""
    if HAS_STRUCTLOG:
        return structlog.get_logger(name)
    
    # Fallback to standard logging
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
    return JsonLogger(logger)


class JsonLogger:
    """Fallback JSON logger when structlog is not available."""
    
    def __init__(self, logger):
        self.logger = logger
    
    def _format(self, **kwargs):
        return json.dumps({
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs
        })
    
    def info(self, msg, **kwargs):
        self.logger.info(self._format(message=msg, level="info", **kwargs))
    
    def error(self, msg, **kwargs):
        self.logger.error(self._format(message=msg, level="error", **kwargs))
    
    def warning(self, msg, **kwargs):
        self.logger.warning(self._format(message=msg, level="warning", **kwargs))
    
    def debug(self, msg, **kwargs):
        self.logger.debug(self._format(message=msg, level="debug", **kwargs))


class RequestContext:
    """Request context holder for correlation ID and user tracking."""
    _context: Dict[str, Any] = {}
    
    @classmethod
    def set(cls, **kwargs):
        cls._context.update(kwargs)
    
    @classmethod
    def get(cls, key: str, default: Any = None) -> Any:
        return cls._context.get(key, default)
    
    @classmethod
    def clear(cls):
        cls._context.clear()
    
    @classmethod
    def as_dict(cls) -> Dict[str, Any]:
        return cls._context.copy()


class AuditLog:
    """Audit logger for compliance - logs all data access and modifications."""
    
    def __init__(self):
        self.logger = get_logger("audit")
    
    def log(
        self,
        action: str,
        user_id: int = None,
        resource_type: str = None,
        resource_id: str = None,
        metadata: Dict[str, Any] = None,
        ip_address: str = None,
        user_agent: str = None
    ):
        """Log an auditable action."""
        self.logger.info(
            "audit_event",
            action=action,
            user_id=user_id or 0,
            resource_type=resource_type or "",
            resource_id=resource_id or "",
            metadata=metadata or {},
            ip_address=ip_address or "",
            user_agent=user_agent or "",
            timestamp=datetime.utcnow().isoformat()
        )


class APILogger:
    """API request/response logger."""
    
    def __init__(self):
        self.logger = get_logger("api")
    
    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        user_id: int = None,
        ip_address: str = None,
        request_id: str = None
    ):
        """Log an API request."""
        self.logger.info(
            "api_request",
            method=method,
            path=path,
            status_code=status_code,
            duration_ms=round(duration_ms, 2),
            user_id=user_id or 0,
            ip_address=ip_address or "",
            request_id=request_id or ""
        )
    
    def log_error(
        self,
        error: Exception,
        request_path: str,
        request_method: str,
        user_id: int = None
    ):
        """Log an error."""
        self.logger.error(
            "api_error",
            error_type=type(error).__name__,
            error_message=str(error),
            request_path=request_path,
            request_method=request_method,
            user_id=user_id or 0
        )


# Singleton instances
audit_log = AuditLog()
api_logger = APILogger()
