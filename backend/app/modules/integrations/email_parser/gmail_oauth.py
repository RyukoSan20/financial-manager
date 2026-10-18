"""
Gmail OAuth2 - Secure token storage and email parsing.
Handles Gmail OAuth2 authentication and transaction email parsing.
"""
import os
import base64
from typing import Optional, Dict, Any, List


class GmailOAuth:
    """
    Gmail OAuth2 client for read-only email access.
    Uses OAuth2 with gmail.readonly scope.
    """
    
    GMAIL_SCOPES = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.metadata"
    ]
    
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GMAIL_API = "https://gmail.googleapis.com"
    
    def __init__(
        self,
        client_id: str = None,
        client_secret: str = None,
        redirect_uri: str = None
    ):
        self.client_id = client_id or os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("GOOGLE_CLIENT_SECRET")
        self.redirect_uri = redirect_uri or os.getenv(
            "GMAIL_REDIRECT_URI", 
            "https://my-financial-manager.online/api/integrations/gmail/callback"
        )
    
    def get_auth_url(self, state: str = None) -> str:
        """Generate OAuth authorization URL with secure state parameter."""
        import urllib.parse
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.GMAIL_SCOPES),
            "access_type": "offline",  # Get refresh token
            "prompt": "consent"  # Force consent to get refresh token
        }
        
        if state:
            params["state"] = state
        
        return f"{self.AUTH_URL}?{urllib.parse.urlencode(params)}"
    
    def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access/refresh tokens."""
        import requests
        
        response = requests.post(self.TOKEN_URL, json={
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code"
        }, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            # Calculate token expiry
            from datetime import datetime, timedelta
            data["expiry"] = (
                datetime.utcnow() + 
                timedelta(seconds=data.get("expires_in", 3600))
            ).isoformat()
            return data
        
        raise Exception(f"Token exchange failed: {response.text}")
    
    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh expired access token using refresh token."""
        import requests
        
        response = requests.post(self.TOKEN_URL, json={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            from datetime import datetime, timedelta
            data["expiry"] = (
                datetime.utcnow() + 
                timedelta(seconds=data.get("expires_in", 3600))
            ).isoformat()
            return data
        
        raise Exception(f"Token refresh failed: {response.text}")
    
    def fetch_transaction_emails(self, access_token: str, max_results: int = 20) -> int:
        """Fetch emails that look like transaction notifications."""
        import requests
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Search for bank/e-wallet transaction emails
        query = "from:(bank*.com OR wallet*.com OR noreply@*bank*.co.id OR noreply@*ewallet*.com) subject:(transaksi OR transfer OR payment OR mutasi)"
        
        # List messages
        list_url = f"{self.GMAIL_API}/gmail/v1/users/me/messages"
        params = {"q": query, "maxResults": max_results}
        
        response = requests.get(list_url, headers=headers, params=params, timeout=30)
        
        if response.status_code != 200:
            return 0
        
        data = response.json()
        messages = data.get("messages", [])
        
        return len(messages)
    
    def get_email_body(self, access_token: str, message_id: str) -> Optional[str]:
        """Get email body content."""
        import requests
        
        headers = {"Authorization": f"Bearer {access_token}"}
        url = f"{self.GMAIL_API}/gmail/v1/users/me/messages/{message_id}?format=full"
        
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        payload = data.get("payload", {})
        
        # Extract body
        body = ""
        if "parts" in payload:
            for part in payload["parts"]:
                if part.get("mimeType") == "text/plain":
                    body_data = part.get("body", {}).get("data", "")
                    if body_data:
                        body = base64.b64decode(body_data).decode("utf-8", errors="ignore")
                        break
        
        if not body:
            body_data = payload.get("body", {}).get("data", "")
            if body_data:
                body = base64.b64decode(body_data).decode("utf-8", errors="ignore")
        
        return body
    
    def parse_transaction(self, email_body: str) -> Optional[Dict[str, Any]]:
        """Parse transaction details from email body."""
        import re
        
        transaction = {}
        
        # Extract amount (various Indonesian bank formats)
        amount_patterns = [
            r"Rp\.?\s*([\d,\.]+)",
            r"amount[:\s]*([\d,\.]+)",
            r"total[:\s]*Rp\.?\s*([\d,\.]+)",
            r"sebesar\s*Rp\.?\s*([\d,\.]+)",
        ]
        
        for pattern in amount_patterns:
            match = re.search(pattern, email_body, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(",", "").replace(".", "")
                transaction["amount"] = int(amount_str)
                break
        
        # Extract date
        date_patterns = [
            r"(\d{2}/\d{2}/\d{4})",
            r"(\d{4}-\d{2}-\d{2})",
            r"(\d{1,2}\s+\w+\s+\d{4})",
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, email_body)
            if match:
                transaction["date"] = match.group(1)
                break
        
        # Extract merchant/name
        merchant_patterns = [
            r"ke\s+([A-Z][A-Za-z\s]+?)(?:\s+atau|\s+pada|\s+di)",
            r"toko[:\s]*([^\n]+)",
            r"merchant[:\s]*([^\n]+)",
        ]
        
        for pattern in merchant_patterns:
            match = re.search(pattern, email_body)
            if match:
                transaction["merchant"] = match.group(1).strip()
                break
        
        return transaction if transaction else None
