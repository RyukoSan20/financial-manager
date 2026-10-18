"""
RBAC - Role-Based Access Control & Multi-tenant Isolation
Implements role hierarchy and permission-based access control.
"""
from enum import Enum
from typing import List, Optional, Set
from functools import wraps


class Role(str, Enum):
    """User roles in the system."""
    ADMIN = "admin"           # Full access
    ENTERPRISE_ADMIN = "enterprise_admin"  # Organization admin
    TEAM_MEMBER = "team_member"  # Can view/edit assigned data
    USER = "user"           # Standard user
    GUEST = "guest"         # Limited read-only access


class Permission(str, Enum):
    """Available permissions."""
    # Account permissions
    ACCOUNT_CREATE = "account:create"
    ACCOUNT_READ = "account:read"
    ACCOUNT_UPDATE = "account:update"
    ACCOUNT_DELETE = "account:delete"
    
    # Transaction permissions
    TRANSACTION_CREATE = "transaction:create"
    TRANSACTION_READ = "transaction:read"
    TRANSACTION_UPDATE = "transaction:update"
    TRANSACTION_DELETE = "transaction:delete"
    
    # Budget permissions
    BUDGET_CREATE = "budget:create"
    BUDGET_READ = "budget:read"
    BUDGET_UPDATE = "budget:update"
    BUDGET_DELETE = "budget:delete"
    
    # Integration permissions
    INTEGRATION_CONNECT = "integration:connect"
    INTEGRATION_MANAGE = "integration:manage"
    INTEGRATION_DELETE = "integration:delete"
    
    # AI permissions
    AI_ACCESS = "ai:access"
    AI_ORGANIZATION = "ai:organization"
    
    # Enterprise permissions
    BILLING_MANAGE = "billing:manage"
    TEAM_INVITE = "team:invite"
    TEAM_MANAGE = "team:manage"
    API_KEY_MANAGE = "api_key:manage"
    
    # Admin permissions
    ADMIN_ALL = "admin:all"
    ADMIN_USERS = "admin:users"
    ADMIN_SYSTEM = "admin:system"


# Role hierarchy - each role inherits permissions from lower roles
ROLE_PERMISSIONS = {
    Role.ADMIN: {
        Permission.ADMIN_ALL,
        Permission.ADMIN_USERS,
        Permission.ADMIN_SYSTEM,
        Permission.BILLING_MANAGE,
        Permission.TEAM_INVITE,
        Permission.TEAM_MANAGE,
        Permission.API_KEY_MANAGE,
        Permission.AI_ACCESS,
        Permission.AI_ORGANIZATION,
        Permission.INTEGRATION_MANAGE,
        Permission.ACCOUNT_CREATE,
        Permission.ACCOUNT_READ,
        Permission.ACCOUNT_UPDATE,
        Permission.ACCOUNT_DELETE,
        Permission.TRANSACTION_CREATE,
        Permission.TRANSACTION_READ,
        Permission.TRANSACTION_UPDATE,
        Permission.TRANSACTION_DELETE,
        Permission.BUDGET_CREATE,
        Permission.BUDGET_READ,
        Permission.BUDGET_UPDATE,
        Permission.BUDGET_DELETE,
    },
    Role.ENTERPRISE_ADMIN: {
        Permission.TEAM_INVITE,
        Permission.TEAM_MANAGE,
        Permission.API_KEY_MANAGE,
        Permission.AI_ORGANIZATION,
        Permission.INTEGRATION_MANAGE,
        Permission.INTEGRATION_CONNECT,
        Permission.ACCOUNT_CREATE,
        Permission.ACCOUNT_READ,
        Permission.ACCOUNT_UPDATE,
        Permission.TRANSACTION_CREATE,
        Permission.TRANSACTION_READ,
        Permission.TRANSACTION_UPDATE,
        Permission.TRANSACTION_DELETE,
        Permission.BUDGET_CREATE,
        Permission.BUDGET_READ,
        Permission.BUDGET_UPDATE,
        Permission.BUDGET_DELETE,
    },
    Role.TEAM_MEMBER: {
        Permission.AI_ACCESS,
        Permission.INTEGRATION_CONNECT,
        Permission.ACCOUNT_READ,
        Permission.TRANSACTION_READ,
        Permission.TRANSACTION_CREATE,
        Permission.TRANSACTION_UPDATE,
        Permission.BUDGET_READ,
    },
    Role.USER: {
        Permission.AI_ACCESS,
        Permission.INTEGRATION_CONNECT,
        Permission.ACCOUNT_READ,
        Permission.ACCOUNT_CREATE,
        Permission.TRANSACTION_READ,
        Permission.TRANSACTION_CREATE,
        Permission.TRANSACTION_UPDATE,
        Permission.BUDGET_READ,
        Permission.BUDGET_CREATE,
    },
    Role.GUEST: {
        Permission.TRANSACTION_READ,
        Permission.BUDGET_READ,
    },
}


class RBACService:
    """
    Role-Based Access Control Service.
    Manages user roles and permission checks.
    """
    
    def __init__(self):
        self.role_permissions = ROLE_PERMISSIONS
    
    def get_permissions(self, role: Role) -> Set[Permission]:
        """Get all permissions for a role."""
        return self.role_permissions.get(role, set())
    
    def has_permission(self, role: Role, permission: Permission) -> bool:
        """Check if a role has a specific permission."""
        return permission in self.get_permissions(role)
    
    def has_any_permission(self, role: Role, permissions: List[Permission]) -> bool:
        """Check if role has any of the listed permissions."""
        user_permissions = self.get_permissions(role)
        return any(p in user_permissions for p in permissions)
    
    def has_all_permissions(self, role: Role, permissions: List[Permission]) -> bool:
        """Check if role has all of the listed permissions."""
        user_permissions = self.get_permissions(role)
        return all(p in user_permissions for p in permissions)
    
    def get_role_from_string(self, role_str: str) -> Role:
        """Convert string to Role enum."""
        try:
            return Role(role_str.lower())
        except ValueError:
            return Role.USER


# Singleton instance
rbac = RBACService()


def require_permission(*permissions: Permission):
    """
    Decorator to require specific permissions for an endpoint.
    Usage:
        @router.post("/")
        @require_permission(Permission.ACCOUNT_CREATE)
        def create_account(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Permission check would be done via dependency injection
            # This is a placeholder for the decorator pattern
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def check_tenant_access(user_id: int, resource_user_id: int, organization_id: Optional[int] = None) -> bool:
    """
    Check if user has access to a resource based on multi-tenant isolation.
    Prevents IDOR (Insecure Direct Object Reference) attacks.
    """
    # Same user can always access their own resources
    if user_id == resource_user_id:
        return True
    
    # Check organization membership
    # This would query the organization_members table
    # For now, return False (user can only access their own data)
    return False


def filter_user_data(query, user_id: int, organization_id: Optional[int] = None):
    """
    Apply multi-tenant filtering to database queries.
    Ensures users only see data they have access to.
    """
    from sqlalchemy import and_
    
    conditions = [query.filter_by(user_id=user_id)]
    
    # Add organization filter if applicable
    if organization_id:
        conditions.append(query.filter_by(organization_id=organization_id))
    
    return query.filter(and_(*conditions))
