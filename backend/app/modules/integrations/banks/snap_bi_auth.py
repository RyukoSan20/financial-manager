"""
BI-SNAP Authentication - Standard API authentication for Indonesian banks.
Implements RSA-SHA256 signatures and HMAC as per BI-SNAP specifications.
"""
import os
import base64
import json
import hmac
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend


class SNAPBIAuth:
    """
    BI-SNAP Standard Authentication for Indonesian Bank APIs.
    
    Supports:
    - Symmetric Signature (HMAC-SHA256)
    - Asymmetric Signature (RSA-SHA256)
    - Token-based authentication
    """
    
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        private_key: Optional[str] = None,
        public_key: Optional[str] = None
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.private_key = private_key or os.getenv("BANK_PRIVATE_KEY")
        self.public_key = public_key or os.getenv("BANK_PUBLIC_KEY")
        self.access_token: Optional[str] = None
        self.token_expires: Optional[datetime] = None
    
    def generate_hmac_signature(
        self,
        method: str,
        endpoint: str,
        timestamp: str,
        body: str = ""
    ) -> str:
        """
        Generate HMAC-SHA256 signature for API request.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            timestamp: ISO8601 timestamp
            body: Request body (empty string for GET)
        
        Returns:
            Base64-encoded HMAC signature
        """
        # Build signature string per BI-SNAP spec
        string_to_sign = f"{method}:{endpoint}:{timestamp}:{body}"
        
        # Generate HMAC using client secret
        signature = hmac.new(
            self.client_secret.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        return base64.b64encode(signature).decode('utf-8')
    
    def generate_rsa_signature(
        self,
        method: str,
        endpoint: str,
        timestamp: str,
        body: str = ""
    ) -> str:
        """
        Generate RSA-SHA256 signature for API request.
        
        Requires private key to be configured.
        """
        if not self.private_key:
            raise ValueError("Private key not configured for RSA signature")
        
        # Build signature string
        string_to_sign = f"{method}:{endpoint}:{timestamp}:{body}"
        
        # Load private key
        private_key_obj = serialization.load_pem_private_key(
            self.client_secret.encode('utf-8'),
            password=None,
            backend=default_backend()
        )
        
        # Sign the string
        signature = private_key_obj.sign(
            string_to_sign.encode('utf-8'),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        
        return base64.b64encode(signature).decode('utf-8')
    
    def get_authorization_header(
        self,
        method: str,
        endpoint: str,
        body: str = "",
        signature_method: str = "HMAC"
    ) -> Dict[str, str]:
        """
        Generate complete authorization headers for BI-SNAP API request.
        
        Args:
            method: HTTP method
            endpoint: API endpoint path
            body: Request body
            signature_method: "HMAC" or "RSA"
        
        Returns:
            Dict of headers to include in request
        """
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        
        if signature_method == "RSA":
            signature = self.generate_rsa_signature(method, endpoint, timestamp, body)
        else:
            signature = self.generate_hmac_signature(method, endpoint, timestamp, body)
        
        headers = {
            "X-Timestamp": timestamp,
            "X-Signature": signature,
            "X-Client-ID": self.client_id,
            "Content-Type": "application/json"
        }
        
        # Add OAuth token if available
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        
        return headers
    
    def verify_webhook_signature(
        self,
        signature: str,
        payload: str,
        timestamp: str
    ) -> bool:
        """
        Verify webhook callback signature from bank.
        
        Args:
            signature: Signature from bank
            payload: Raw request body
            timestamp: Timestamp from header
        
        Returns:
            True if signature is valid
        """
        # Bank-specific verification logic
        # This is a placeholder - each bank has different verification
        expected = self.generate_hmac_signature("POST", "webhook", timestamp, payload)
        return hmac.compare_digest(signature, expected)


class BCASNAPConnector(SNAPBIAuth):
    """BCA API authentication."""
    
    def __init__(self, api_key: str, api_secret: str, client_id: str):
        super().__init__(
            client_id=client_id,
            client_secret=api_secret
        )
        self.api_key = api_key
        self.base_url = "https://api.bca.co.id"
    
    def get_balance_headers(self, account_number: str) -> Dict[str, str]:
        """Get headers for balance inquiry."""
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        endpoint = f"/banking/v3/corporates/{account_number}/accounts"
        
        signature = self.generate_hmac_signature("GET", endpoint, timestamp)
        
        return {
            "X-BCA-Key": self.api_key,
            "X-BCA-Timestamp": timestamp,
            "X-BCA-Signature": signature,
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }


class MandiriSNAPConnector(SNAPBIAuth):
    """Livin' by Mandiri API authentication."""
    
    def __init__(self, client_id: str, client_secret: str):
        super().__init__(
            client_id=client_id,
            client_secret=client_secret
        )
        self.base_url = "https://api.bankmandiri.co.id"


class BRISNAPConnector(SNAPBIAuth):
    """BRI API authentication."""
    
    def __init__(self, client_id: str, client_secret: str):
        super().__init__(
            client_id=client_id,
            client_secret=client_secret
        )
        self.base_url = "https://bri-api.co.id"


class BNISNAPConnector(SNAPBIAuth):
    """BNI API authentication."""
    
    def __init__(self, client_id: str, client_secret: str):
        super().__init__(
            client_id=client_id,
            client_secret=client_secret
        )
        self.base_url = "https://apibni.co.id"


def get_bank_connector(
    bank: str,
    client_id: str,
    client_secret: str,
    **kwargs
) -> SNAPBIAuth:
    """
    Factory function to get bank connector by name.
    
    Args:
        bank: Bank name ("bca", "mandiri", "bri", "bni")
        client_id: API client ID
        client_secret: API client secret
        **kwargs: Additional bank-specific credentials
    
    Returns:
        Configured SNAPBIAuth instance
    """
    bank = bank.lower()
    
    if bank == "bca":
        return BCASNAPConnector(
            api_key=kwargs.get("api_key", client_id),
            api_secret=client_secret,
            client_id=client_id
        )
    elif bank == "mandiri":
        return MandiriSNAPConnector(client_id, client_secret)
    elif bank == "bri":
        return BRISNAPConnector(client_id, client_secret)
    elif bank == "bni":
        return BNISNAPConnector(client_id, client_secret)
    else:
        raise ValueError(f"Unknown bank: {bank}")
