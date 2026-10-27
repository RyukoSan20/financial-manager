"""
Gmail API access.

The class here is the one the rest of the module talks to. It was
taken out at some point and the two files that used it were never
updated, so the whole email parser stopped importing and the router
was never registered. This puts it back, and puts it back doing the
job the caller expects:

- `list_messages` gives back the short summaries, the way the Gmail
  list endpoint does.
- `get_message` gives back one message with its headers and its body
  already taken apart, which is the shape the email parsers expect
  (`from`, `subject`, `body`, `id`).

Nothing here is called unless a reader has connected their Gmail
account, and the scope asked for is read-only.
"""

from typing import Any, Dict, List, Optional

import base64

from .gmail_oauth import GmailOAuth


class GmailService:
    """
    A thin wrapper over the Gmail REST API.

    It holds an access token and makes the two calls the poller needs.
    It is not a general-purpose client: the point is that the poller
    and the router do not have to know the shape of the API responses.
    """

    MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"

    def __init__(self, access_token: str, timeout: int = 30):
        self.access_token = access_token
        self.timeout = timeout

    # === The calls ===

    def list_messages(
        self, query: str = "", max_results: int = 20
    ) -> List[Dict[str, Any]]:
        """
        The messages that match a search.

        Each one is the short summary Gmail gives, which is what has
        the id and the thread. The body is fetched one message at a
        time, because fetching every body in a list is slow and most
        of them are not transaction emails.
        """
        import requests

        params: Dict[str, Any] = {"maxResults": max_results}
        if query:
            params["q"] = query

        response = requests.get(
            self.MESSAGES_URL,
            headers=self._headers(),
            params=params,
            timeout=self.timeout,
        )
        if response.status_code != 200:
            return []

        data = response.json()
        messages = data.get("messages", [])
        return messages if isinstance(messages, list) else []

    def get_message(self, message_id: str) -> Optional[Dict[str, Any]]:
        """
        One message, with its headers and its body already taken
        apart.

        The shape is the one the parsers expect: `from`, `subject`,
        `date`, `body` and `id`. If the message cannot be read, this
        returns nothing rather than raising, because one unreadable
        email should not stop a whole poll.
        """
        import requests

        url = f"{self.MESSAGES_URL}/{message_id}?format=full"
        response = requests.get(
            url, headers=self._headers(), timeout=self.timeout
        )
        if response.status_code != 200:
            return None

        data = response.json()
        payload = data.get("payload", {}) or {}
        headers = {
            h.get("name", "").lower(): h.get("value", "")
            for h in payload.get("headers", [])
            or []
        }

        return {
            "id": data.get("id", message_id),
            "threadId": data.get("threadId", ""),
            "from": headers.get("from", ""),
            "to": headers.get("to", ""),
            "subject": headers.get("subject", ""),
            "date": headers.get("date", ""),
            "snippet": data.get("snippet", ""),
            "body": self._extract_body(payload),
        }

    # === The helpers ===

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def _extract_body(self, payload: Dict[str, Any]) -> str:
        """
        The plain-text body of a message.

        A message can have the body split into parts, and the part
        that is plain text is the one wanted. When there is no plain
        part the whole body is used, because a parser can still find
        the amount in it.
        """
        body = ""

        def walk(part):
            nonlocal body
            if body:
                return
            mime = part.get("mimeType", "")
            if mime == "text/plain":
                data = part.get("body", {}).get("data", "")
                if data:
                    body = self._decode(data)
                    return
            for child in part.get("parts", []) or []:
                walk(child)

        walk(payload)

        if not body:
            data = payload.get("body", {}).get("data", "")
            if data:
                body = self._decode(data)

        return body

    @staticmethod
    def _decode(data: str) -> str:
        try:
            return base64.urlsafe_b64decode(data.encode()).decode(
                "utf-8", errors="ignore"
            )
        except Exception:
            return ""


def get_gmail_service(credentials: Dict[str, Any]) -> Optional[GmailService]:
    """
    A service for a set of stored credentials.

    The credentials are what the callback stored: an access token, and
    a refresh token for when the access token has expired. If the
    access token has expired, it is refreshed here, so the caller does
    not have to know about expiry.
    """
    if not credentials:
        return None

    access_token = credentials.get("access_token")
    refresh_token = credentials.get("refresh_token")

    if not access_token and refresh_token:
        try:
            oauth = GmailOAuth()
            tokens = oauth.refresh_access_token(refresh_token)
            access_token = tokens.get("access_token")
        except Exception:
            return None

    if not access_token:
        return None

    return GmailService(access_token)
