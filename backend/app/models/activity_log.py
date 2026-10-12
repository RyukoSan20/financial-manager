"""
Activity Logging System for Financial Manager
Tracks all user actions with session ID for debugging and analytics.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base
from datetime import datetime
import json
import uuid


class ActivityLog(Base):
    """Model for tracking user activities."""
    __tablename__ = "activity_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource = Column(String(100), nullable=True, index=True)
    resource_id = Column(String(100), nullable=True)
    method = Column(String(10), nullable=True)
    endpoint = Column(String(255), nullable=True)
    request_data = Column(JSONB, nullable=True)
    response_status = Column(Integer, nullable=True)
    response_data = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    extra_data = Column(JSONB, nullable=True)  # Renamed from 'metadata'
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index('idx_activity_session_created', 'session_id', 'created_at'),
        Index('idx_activity_user_created', 'user_id', 'created_at'),
        Index('idx_activity_action_created', 'action', 'created_at'),
    )
    
    def __repr__(self):
        return f"<ActivityLog(id={self.id}, action={self.action}, session={self.session_id})>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "action": self.action,
            "resource": self.resource,
            "resource_id": self.resource_id,
            "method": self.method,
            "endpoint": self.endpoint,
            "request_data": self.request_data,
            "response_status": self.response_status,
            "ip_address": self.ip_address,
            "duration_ms": self.duration_ms,
            "error_message": self.error_message,
            "metadata": self.extra_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ActivityLogger:
    """Helper class for logging activities."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    def log(
        self,
        session_id: str,
        action: str,
        user_id: int = None,
        resource: str = None,
        resource_id: str = None,
        method: str = None,
        endpoint: str = None,
        request_data: dict = None,
        response_status: int = None,
        response_data: dict = None,
        ip_address: str = None,
        user_agent: str = None,
        duration_ms: int = None,
        error_message: str = None,
        extra_data: dict = None,
    ):
        """Create a new activity log entry."""
        try:
            log_entry = ActivityLog(
                session_id=session_id,
                user_id=user_id,
                action=action,
                resource=resource,
                resource_id=resource_id,
                method=method,
                endpoint=endpoint,
                request_data=request_data,
                response_status=response_status,
                response_data=response_data,
                ip_address=ip_address,
                user_agent=user_agent,
                duration_ms=duration_ms,
                error_message=error_message,
                extra_data=extra_data,
            )
            self.db.add(log_entry)
            self.db.commit()
            return log_entry
        except Exception as e:
            # Don't fail the main operation if logging fails
            self.db.rollback()
            print(f"Failed to log activity: {e}")
            return None
    
    def log_api_request(
        self,
        session_id: str,
        action: str,
        endpoint: str,
        method: str,
        request_data: dict = None,
        user_id: int = None,
        ip_address: str = None,
        user_agent: str = None,
    ):
        """Log an API request."""
        return self.log(
            session_id=session_id,
            action=action,
            user_id=user_id,
            resource="api",
            method=method,
            endpoint=endpoint,
            request_data=self._sanitize_data(request_data),
            ip_address=ip_address,
            user_agent=user_agent,
        )
    
    def log_user_action(
        self,
        session_id: str,
        action: str,
        user_id: int,
        resource: str,
        resource_id: str = None,
        metadata: dict = None,
    ):
        """Log a user action (create, update, delete)."""
        return self.log(
            session_id=session_id,
            action=action,
            user_id=user_id,
            resource=resource,
            resource_id=resource_id,
            extra_data=metadata,
        )
    
    def log_error(
        self,
        session_id: str,
        action: str,
        error_message: str,
        endpoint: str = None,
        request_data: dict = None,
        user_id: int = None,
    ):
        """Log an error."""
        return self.log(
            session_id=session_id,
            action=action,
            user_id=user_id,
            endpoint=endpoint,
            request_data=self._sanitize_data(request_data),
            error_message=error_message,
        )
    
    def log_auth(
        self,
        session_id: str,
        action: str,
        user_id: int = None,
        email: str = None,
        ip_address: str = None,
        success: bool = True,
        error_message: str = None,
    ):
        """Log authentication events."""
        return self.log(
            session_id=session_id,
            action=action,
            user_id=user_id,
            resource="auth",
            request_data={"email": email, "success": success},
            ip_address=ip_address,
            error_message=error_message,
        )
    
    def _sanitize_data(self, data: dict) -> dict:
        """Remove sensitive data from logs."""
        if not data:
            return None
        
        sensitive_keys = [
            'password', 'token', 'secret', 'key', 'authorization',
            'credit_card', 'card_number', 'cvv', 'ssn', 'api_key'
        ]
        
        sanitized = {}
        for key, value in data.items():
            if any(s in key.lower() for s in sensitive_keys):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = value
        
        return sanitized if sanitized else None


# Utility functions
def generate_session_id() -> str:
    """Generate a unique session ID."""
    return str(uuid.uuid4())


def get_client_ip(request) -> str:
    """Extract client IP from request."""
    if hasattr(request, 'client') and request.client:
        return request.client.host
    return None


def get_user_agent(request) -> str:
    """Extract user agent from request."""
    if hasattr(request, 'headers'):
        return request.headers.get('user-agent', None)
    return None
