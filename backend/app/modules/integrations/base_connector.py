"""
Base Connector - Abstract interface for all external integrations.
Standardizes connection patterns for bank APIs, e-wallets, and email providers.
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class ConnectionStatus(str, Enum):
    """Status of an integration connection."""
    ACTIVE = "active"
    PENDING = "pending"
    EXPIRED = "expired"
    ERROR = "error"
    DISCONNECTED = "disconnected"


class SyncStatus(str, Enum):
    """Status of data synchronization."""
    SYNCED = "synced"
    PENDING = "pending"
    FAILED = "failed"
    IN_PROGRESS = "in_progress"


@dataclass
class ConnectedAccount:
    """Represents a connected external account."""
    id: int
    user_id: int
    provider: str  # "bca", "gopay", "gmail", etc.
    account_name: str
    account_number: Optional[str] = None
    status: ConnectionStatus = ConnectionStatus.ACTIVE
    last_sync: Optional[datetime] = None
    sync_error: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "provider": self.provider,
            "account_name": self.account_name,
            "status": self.status.value if isinstance(self.status, Enum) else self.status,
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
        }


@dataclass
class SyncLog:
    """Log of a synchronization operation."""
    id: int
    connected_account_id: int
    sync_type: str  # "transactions", "balance", "profile"
    status: SyncStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    transactions_synced: int = 0
    error_message: Optional[str] = None


class BaseConnector(ABC):
    """
    Abstract base class for all connectors.
    
    All external integrations (banks, e-wallets, email) must implement this interface.
    """
    
    def __init__(self, user_id: int, account_id: int, credentials: Dict[str, str]):
        self.user_id = user_id
        self.account_id = account_id
        self.credentials = credentials
        self.provider_name = self.__class__.__name__.replace("Connector", "").lower()
    
    @abstractmethod
    async def authenticate(self) -> bool:
        """
        Authenticate with the external service.
        Returns True if authentication successful.
        """
        pass
    
    @abstractmethod
    async def refresh_token(self) -> bool:
        """
        Refresh the OAuth/access token.
        Returns True if refresh successful.
        """
        pass
    
    @abstractmethod
    async def get_balance(self) -> Dict[str, Any]:
        """
        Get account balance.
        Returns dict with balance information.
        """
        pass
    
    @abstractmethod
    async def get_transactions(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get transaction history.
        
        Args:
            start_date: Start of date range (default: 30 days ago)
            end_date: End of date range (default: today)
        
        Returns:
            List of transaction dicts with keys:
            - date: Transaction date
            - amount: Transaction amount (positive for income, negative for expense)
            - description: Transaction description
            - type: "income" or "expense"
            - reference: External reference ID
        """
        pass
    
    @abstractmethod
    async def get_profile(self) -> Dict[str, Any]:
        """Get account profile information."""
        pass
    
    async def sync(self) -> SyncLog:
        """
        Perform full synchronization of account data.
        Returns SyncLog with results.
        """
        sync_log = SyncLog(
            id=0,
            connected_account_id=self.account_id,
            sync_type="all",
            status=SyncStatus.IN_PROGRESS,
            started_at=datetime.utcnow()
        )
        
        try:
            # Authenticate
            if not await self.authenticate():
                sync_log.status = SyncStatus.FAILED
                sync_log.error_message = "Authentication failed"
                return sync_log
            
            # Get transactions
            transactions = await self.get_transactions()
            sync_log.transactions_synced = len(transactions)
            
            sync_log.status = SyncStatus.SYNCED
            sync_log.completed_at = datetime.utcnow()
            
        except Exception as e:
            sync_log.status = SyncStatus.FAILED
            sync_log.error_message = str(e)
        
        return sync_log
    
    async def disconnect(self) -> bool:
        """
        Disconnect the account.
        Revokes tokens and removes connection.
        """
        pass
    
    def validate_credentials(self) -> bool:
        """
        Validate that required credentials are present.
        """
        return True
    
    def get_required_credentials(self) -> List[str]:
        """
        Return list of required credential keys.
        """
        return []


class ConnectorRegistry:
    """
    Registry for all available connectors.
    Provides factory method to get connector by provider name.
    """
    
    _connectors = {}
    
    @classmethod
    def register(cls, provider: str, connector_class: type):
        """Register a connector class for a provider."""
        cls._connectors[provider.lower()] = connector_class
    
    @classmethod
    def get(cls, provider: str, user_id: int, account_id: int, credentials: Dict[str, str]):
        """Get a connector instance by provider name."""
        provider_lower = provider.lower()
        if provider_lower not in cls._connectors:
            raise ValueError(f"Unknown provider: {provider}")
        
        connector_class = cls._connectors[provider_lower]
        return connector_class(user_id, account_id, credentials)
    
    @classmethod
    def list_providers(cls) -> List[str]:
        """List all registered providers."""
        return list(cls._connectors.keys())


# Decorator for registering connectors
def register_connector(provider: str):
    """Decorator to register a connector class."""
    def decorator(connector_class: type):
        ConnectorRegistry.register(provider, connector_class)
        return connector_class
    return decorator
