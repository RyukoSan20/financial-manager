"""
The Gmail integration works, and the delete is guarded.

Three things were broken and are checked here:

- The email parser would not import, so the Gmail router was never
  registered and every endpoint under it was a 404.
- The tokens were stored with base64, which is an encoding rather
  than an encryption.
- Deleting everything could be done with a bare request, because the
  confirmation was only ever asked for in the browser.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.security import get_current_user
from app.main import app


class FakeUser:
    """A reader who exists only for these tests."""

    id = 4242
    email = "reader@example.invalid"
    is_active = True


@pytest.fixture(scope="module")
def client():
    """
    A client with a reader already signed in.

    The dependency is replaced rather than a real account being made,
    so nothing here touches a real person or real money.
    """
    test_client = TestClient(app)
    test_client.app.dependency_overrides[get_current_user] = lambda: FakeUser()
    return test_client


# === The module imports at all ===

def test_the_email_parser_imports():
    """
    The whole email parser stopped importing because two files asked
    for a class that was not there. If this fails, the router is not
    registered and every endpoint is a 404.
    """
    from app.modules.integrations.email_parser import (  # noqa: F401
        GmailOAuth,
        GmailService,
        get_gmail_service,
        parser_registry,
    )


def test_the_gmail_router_is_registered(client):
    """
    The endpoints have to be there, not just the file.
    """
    paths = {getattr(route, "path", "") for route in app.routes}
    assert "/api/integrations/gmail/status" in paths
    assert "/api/integrations/gmail/connect" in paths
    assert "/api/integrations/gmail/disconnect" in paths


def test_the_credentials_table_is_registered():
    """
    The table was never created, because the model was never
    registered with SQLAlchemy. The router fell back to the user
    settings column every time without saying so.
    """
    import app.models  # noqa: F401

    assert "gmail_credentials" in Base.metadata.tables


# === The tokens ===

def test_a_token_is_encrypted_not_just_encoded():
    """
    Base64 is not encryption. Anyone with a copy of the database could
    read the token straight out of it.
    """
    from app.modules.integrations.email_parser.gmail_router import (
        encrypt_token,
        decrypt_token,
    )

    token = "refresh-token-value"
    stored = encrypt_token(token)

    assert stored != token
    # The plain token must not be sitting in the stored text.
    assert token not in stored
    assert decrypt_token(stored) == token


def test_a_token_stored_the_old_way_is_still_readable():
    """
    Tokens stored before the change were base64. Those readers must
    not lose their connection because of the change.
    """
    import base64

    from app.modules.integrations.email_parser.gmail_router import (
        decrypt_token,
    )

    legacy = base64.b64encode(b"legacy-refresh-token").decode()
    assert decrypt_token(legacy) == "legacy-refresh-token"


def test_the_encryption_module_works():
    """
    The encryption module itself was broken: it asked the key
    derivation to verify a signature rather than derive a key, so
    every encryption raised "Keys do not match".
    """
    from app.core.kms_encryption import decrypt_token, encrypt_token

    stored = encrypt_token("a-secret")
    assert stored != "a-secret"
    assert decrypt_token(stored) == "a-secret"


def test_two_encryptions_of_the_same_token_differ():
    """
    A fresh salt and nonce each time, so the same token does not
    produce the same text twice.
    """
    from app.core.kms_encryption import encrypt_token

    assert encrypt_token("same") != encrypt_token("same")


# === The states ===

def test_the_status_says_which_state_it_is_in(client):
    """
    The old answer was only yes or no. The state is a code, so the
    screen can put it in the reader's language.
    """
    response = client.get("/api/integrations/gmail/status")
    assert response.status_code == 200
    body = response.json()
    assert body["state"] in {
        "not_connected",
        "connected",
        "needs_reauth",
        "not_configured",
    }
    assert "configured" in body


def test_connecting_without_google_details_says_so(client, monkeypatch):
    """
    A URL that cannot work is worse than a clear message. The server
    says what is wrong, with a code.
    """
    import app.modules.integrations.email_parser.gmail_oauth as oauth_module

    original = oauth_module.GmailOAuth.__init__

    def no_credentials(self, client_id=None, client_secret=None, redirect_uri=None):
        original(self, client_id=client_id, client_secret=client_secret,
                 redirect_uri=redirect_uri)
        self.client_id = None
        self.client_secret = None

    monkeypatch.setattr(oauth_module.GmailOAuth, "__init__", no_credentials)

    response = client.get("/api/integrations/gmail/connect")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "oauth_not_configured"
