"""
Audit Logger - Tracks all data access and modifications.
Compliant with UU PDP (Perlindungan Data Pribadi) Indonesia.
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum


class AuditAction(str, Enum):
    """Types of auditable actions."""
    # Authentication
    LOGIN = "auth.login"
    LOGOUT = "auth.logout"
    LOGIN_FAILED = "auth.login_failed"
    
    # Data operations
    CREATE = "data.create"
    READ = "data.read"
    UPDATE = "data.update"
    DELETE = "data.delete"
    
    # Financial operations
    TRANSACTION_CREATE = "transaction.create"
    TRANSACTION_DELETE = "transaction.delete"
    ACCOUNT_CONNECT = "account.connect"
    ACCOUNT_DISCONNECT = "account.disconnect"
    
    # AI operations
    AI_QUERY = "ai.query"
    AI_DATA_ACCESS = "ai.data_access"
    
    # Admin operations
    USER_IMPERSONATE = "admin.impersonate"
    SETTING_CHANGE = "settings.change"
    PERMISSION_CHANGE = "permission.change"


class AuditLogger:
    """
    Audit logging for compliance and security monitoring.
    Stores logs in database for queryable audit trail.
    """
    
    def __init__(self, db_session=None):
        self.db = db_session
    
    def log(
        self,
        action: AuditAction,
        user_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Log an auditable action.
        
        Args:
            action: Type of action performed
            user_id: ID of user performing action
            resource_type: Type of resource affected (e.g., "transaction", "account")
            resource_id: ID of affected resource
            metadata: Additional context data
            ip_address: Client IP address
            user_agent: Client user agent string
        
        Returns:
            Created audit log entry
        """
        timestamp = datetime.utcnow()
        
        log_entry = {
            "timestamp": timestamp.isoformat(),
            "action": action.value if isinstance(action, AuditAction) else action,
            "user_id": user_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "metadata": metadata or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
        }
        
        # Store in database if session available
        if self.db:
            self._store_in_db(log_entry)
        
        # Also print for development
        print(f"[AUDIT] {timestamp.isoformat()} | {action.value if isinstance(action, AuditAction) else action} | User:{user_id} | {resource_type}:{resource_id}")
        
        return log_entry
    
    def _store_in_db(self, entry: Dict[str, Any]):
        """Store audit entry in database."""
        # This would create an AuditLog model and store it
        # For now, we'll use print as placeholder
        pass
    
    def query_logs(
        self,
        user_id: Optional[int] = None,
        action: Optional[AuditAction] = None,
        resource_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Query audit logs with filters.
        
        This would query the audit_logs table.
        """
        # Placeholder implementation
        return []
    
    def get_user_activity_summary(
        self,
        user_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get summary of user activity for reporting.
        """
        # Placeholder
        return {
            "user_id": user_id,
            "period_days": days,
            "total_actions": 0,
            "by_action_type": {},
            "by_resource_type": {},
            "suspicious_activities": []
        }


# Singleton instance
audit_logger = AuditLogger()


def log_action(
    action: AuditAction,
    user_id: Optional[int] = None,
    **kwargs
):
    """Convenience function for logging actions."""
    return audit_logger.log(action, user_id=user_id, **kwargs)


def log_data_access(
    resource_type: str,
    resource_id: str,
    user_id: int,
    action: str = "read",
    **kwargs
):
    """Log data access for compliance."""
    action_enum = AuditAction.READ if action == "read" else AuditAction.UPDATE
    return audit_logger.log(
        action=action_enum,
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        **kwargs
    )
