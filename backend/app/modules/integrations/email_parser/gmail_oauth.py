"""
Gmail OAuth2 - OAuth2 authentication for Gmail read-only access.
Handles token refresh and email fetching.
"""
import os
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta


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
    
    def __init__(
        self,
        client_id: str = None,
        client_secret: str = None,
        redirect_uri: str = None
    ):
        self.client_id = client_id or os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("GOOGLE_CLIENT_SECRET")
        self.redirect_uri = redirect_uri or os.getenv("GMAIL_REDIRECT_URI", "https://my-financial-manager.online/api/integrations/gmail/callback")
    
    def get_auth_url(self, state: str = None) -> str:
        """Generate OAuth authorization URL."""
        import urllib.parse
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.GMAIL_SCOPES),
            "access_type": "offline",
            "prompt": "consent"
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
        })
        
        if response.status_code == 200:
            return response.json()
        
        raise Exception(f"Token exchange failed: {response.text}")
    
    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh expired access token."""
        import requests
        
        response = requests.post(self.TOKEN_URL, json={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        })
        
        if response.status_code == 200:
            return response.json()
        
        raise Exception(f"Token refresh failed: {response.text}")
    
    def get_access_token(self, credentials: Dict[str, Any]) -> str:
        """Get valid access token, refreshing if necessary."""
        if not credentials:
            raise Exception("No credentials provided")
        
        access_token = credentials.get("access_token")
        refresh_token = credentials.get("refresh_token")
        expiry = credentials.get("expiry")
        
        # Check if token is expired
        if expiry:
            if datetime.utcnow() >= datetime.fromisoformat(expiry):
                # Refresh token
                new_tokens = self.refresh_access_token(refresh_token)
                return new_tokens["access_token"]
        
        return access_token


class GmailService:
    """
    Gmail API service for fetching and parsing emails.
    """
    
    BASE_URL = "https://gmail.googleapis.com/gmail/v1"
    
    def __init__(self, access_token: str):
        self.access_token = access_token
    
    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
    
    def list_messages(
        self,
        query: str = None,
        max_results: int = 50
    ) -> list:
        """List messages matching query."""
        import requests
        
        url = f"{self.BASE_URL}/users/me/messages"
        params = {
            "maxResults": max_results,
            "q": query or ""
        }
        
        response = requests.get(url, headers=self._headers(), params=params)
        
        if response.status_code == 200:
            data = response.json()
            return data.get("messages", [])
        
        return []
    
    def get_message(self, message_id: str) -> Dict[str, Any]:
        """Get full message by ID."""
        import requests
        import base64
        
        url = f"{self.BASE_URL}/users/me/messages/{message_id}"
        
        response = requests.get(url, headers=self._headers())
        
        if response.status_code == 200:
            msg = response.json()
            
            # Extract headers
            headers = {}
            for h in msg.get("payload", {}).get("headers", []):
                headers[h["name"].lower()] = h["value"]
            
            # Extract body
            body = self._extract_body(msg.get("payload", {}))
            
            return {
                "id": msg["id"],
                "thread_id": msg["threadId"],
                "from": headers.get("from", ""),
                "to": headers.get("to", ""),
                "subject": headers.get("subject", ""),
                "date": headers.get("date", ""),
                "body": body,
                "snippet": msg.get("snippet", "")
            }
        
        return None
    
    def _extract_body(self, payload: Dict) -> str:
        """Extract text body from message payload."""
        if "parts" in payload:
            for part in payload["parts"]:
                if part.get("mimeType") == "text/plain":
                    data = part.get("body", {}).get("data", "")
                    if data:
                        import base64
                        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
        
        # Single part message
        data = payload.get("body", {}).get("data", "")
        if data:
            import base64
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
        
        return ""


def get_gmail_service(credentials: Dict[str, Any]) -> GmailService:
    """Factory function to create Gmail service."""
    oauth = GmailOAuth()
    access_token = oauth.get_access_token(credentials)
    return GmailService(access_token)
