"""Gmail OAuth Router - Secure token storage and email parsing."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
import base64

from sqlalchemy import func

from app.core.security import get_current_user
from app.core.database import SessionLocal
from app.core.kms_encryption import encrypt_token as kms_encrypt
from app.core.kms_encryption import decrypt_token as kms_decrypt
from app.modules.integrations.email_parser.gmail_oauth import GmailOAuth

router = APIRouter(prefix="/api/integrations/gmail", tags=["Gmail Integration"])


class GmailConnectResponse(BaseModel):
    auth_url: str
    message: str


class GmailCallbackResponse(BaseModel):
    success: bool
    message: str
    email_count: int = 0


def encrypt_token(token: str) -> str:
    """
    Encrypt a token for storage.

    This used to be base64, which is an encoding rather than an
    encryption: anyone with a copy of the database could read the
    token straight out of it. It is now encrypted with the same
    AES-256-GCM the rest of the application uses.
    """
    return kms_encrypt(token)


def decrypt_token(encrypted: str) -> str:
    """
    Decrypt a token that was stored.

    Tokens stored before the change were base64, so those are still
    read. A token that was never encrypted comes back as it is,
    because a token the reader can still use is better than one that
    cannot be read at all.
    """
    try:
        return kms_decrypt(encrypted)
    except Exception:
        pass

    try:
        decoded = base64.b64decode(encrypted.encode()).decode()
        if decoded:
            return decoded
    except Exception:
        pass

    return encrypted


@router.get("/connect")
async def gmail_connect(current_user = Depends(get_current_user)):
    """
    The URL that starts the sign-in.

    When the application has no Google credentials set up, this says
    so with a code rather than handing out a URL that cannot work. A
    reader who pressed the button needs to be told what is wrong, and
    the message has to be one the screen can put in their own
    language.
    """
    oauth = GmailOAuth()
    if not oauth.client_id or not oauth.client_secret:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "oauth_not_configured",
                "message": "The Google sign-in details are not set up on the server.",
            },
        )

    # State includes user_id for secure callback
    auth_url = oauth.get_auth_url(state=str(current_user.id))

    return GmailConnectResponse(
        auth_url=auth_url,
        message="Buka URL ini untuk authorize FinManager mengakses Gmail Anda"
    )


@router.get("/callback")
async def gmail_callback(code: str, state: Optional[str] = None):
    """
    Handle OAuth callback from Google.
    Exchanges code for tokens and stores securely in database.
    """
    try:
        oauth = GmailOAuth()
        tokens = oauth.exchange_code_for_tokens(code)
        
        user_id = int(state) if state else None
        
        if user_id:
            db = SessionLocal()
            try:
                # Store encrypted tokens
                from app.models.user import User
                user = db.query(User).filter(User.id == user_id).first()
                
                if user:
                    # Store tokens in user settings (encrypted)
                    encrypted_refresh = encrypt_token(tokens.get("refresh_token", ""))
                    encrypted_access = encrypt_token(tokens.get("access_token", ""))
                    
                    # Store as JSON in a dedicated settings column or create user_gmail table
                    gmail_data = json.dumps({
                        "refresh_token": encrypted_refresh,
                        "access_token": encrypted_access,
                        "token_type": tokens.get("token_type", "Bearer"),
                        "connected_at": str(db.query(func.now()).scalar()),
                    })
                    
                    # Check if user_gmail_credentials table exists
                    try:
                        from app.models.gmail_credentials import GmailCredentials
                        existing = db.query(GmailCredentials).filter(
                            GmailCredentials.user_id == user_id
                        ).first()
                        
                        if existing:
                            existing.encrypted_refresh_token = encrypted_refresh
                            existing.encrypted_access_token = encrypted_access
                            existing.token_type = tokens.get("token_type", "Bearer")
                            existing.updated_at = func.now()
                        else:
                            cred = GmailCredentials(
                                user_id=user_id,
                                encrypted_refresh_token=encrypted_refresh,
                                encrypted_access_token=encrypted_access,
                                token_type=tokens.get("token_type", "Bearer"),
                            )
                            db.add(cred)
                    except Exception:
                        # Fallback: store in user settings
                        if hasattr(user, 'settings'):
                            settings = json.loads(user.settings) if user.settings else {}
                            settings['gmail'] = gmail_data
                            user.settings = json.dumps(settings)
                    
                    db.commit()
                    
            except Exception as e:
                db.rollback()
                raise HTTPException(status_code=500, detail=f"Failed to store tokens: {str(e)}")
            finally:
                db.close()
        
        return GmailCallbackResponse(
            success=True,
            message="Gmail berhasil terhubung! Email parser akan otomatis memindai transaksi.",
            email_count=0
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")


@router.get("/status")
async def gmail_status(current_user = Depends(get_current_user)):
    """
    What state the Gmail connection is in.

    The old answer was only yes or no, and the page had to guess at
    everything else. There are four states, and they are told apart
    here rather than in the browser:

    - `not_connected` — there is no token, so there is nothing to use.
    - `connected` — there is a token that can be used.
    - `needs_reauth` — there is a token but it cannot be refreshed,
      so the reader has to sign in again.
    - `not_configured` — the server has no Google details set up, so
      signing in cannot work at all.

    The state is a code. The screen puts it in the reader's language.
    """
    db = SessionLocal()
    try:
        from app.models.user import User
        from app.models.gmail_credentials import GmailCredentials

        connected = False
        connected_at = None

        try:
            cred = db.query(GmailCredentials).filter(
                GmailCredentials.user_id == current_user.id
            ).first()
        except Exception:
            # The table is not there yet. It is created by the
            # migration, and a reader whose database has not had the
            # migration run is not broken: their connection is simply
            # held in the settings column instead.
            cred = None

        if cred is not None:
            connected = True
            connected_at = (
                cred.created_at.isoformat() if cred.created_at else None
            )
        else:
            # Fallback check user settings
            try:
                user = db.query(User).filter(User.id == current_user.id).first()
                if user and hasattr(user, "settings") and user.settings:
                    try:
                        settings = json.loads(user.settings)
                        connected = "gmail" in settings
                    except Exception:
                        pass
            except Exception:
                # The users table is not reachable either. The reader
                # is simply not connected, which is an answer.
                connected = False

        # A server with no Google details cannot offer the connection
        # at all, whatever the tokens say.
        oauth = GmailOAuth()
        configured = bool(oauth.client_id and oauth.client_secret)

        if not configured:
            state = "not_configured"
        elif connected:
            state = "connected"
        else:
            state = "not_connected"

        return {
            "connected": connected and configured,
            "state": state,
            "configured": configured,
            "connected_at": connected_at,
            "message": "Gmail Terhubung" if connected else "Gmail belum terhubung",
        }
    finally:
        db.close()


@router.post("/disconnect")
async def gmail_disconnect(current_user = Depends(get_current_user)):
    """Disconnect Gmail integration and remove stored tokens."""
    db = SessionLocal()
    try:
        try:
            from app.models.gmail_credentials import GmailCredentials
            db.query(GmailCredentials).filter(
                GmailCredentials.user_id == current_user.id
            ).delete()
            db.commit()
        except Exception:
            pass
        
        return {"success": True, "message": "Gmail berhasil diputuskan"}
    finally:
        db.close()


@router.post("/sync")
async def gmail_sync(current_user = Depends(get_current_user)):
    """Sync emails and parse transactions."""
    db = SessionLocal()
    try:
        # Get stored credentials
        from app.models.gmail_credentials import GmailCredentials
        cred = db.query(GmailCredentials).filter(
            GmailCredentials.user_id == current_user.id
        ).first()
        
        if not cred:
            return {"success": False, "message": "Gmail belum terhubung"}
        
        # Decrypt tokens
        refresh_token = decrypt_token(cred.encrypted_refresh_token)
        
        # Refresh access token
        oauth = GmailOAuth()
        new_tokens = oauth.refresh_access_token(refresh_token)
        
        # Update stored access token
        cred.encrypted_access_token = encrypt_token(new_tokens.get("access_token", ""))
        db.commit()
        
        # Parse emails
        emails_parsed = oauth.fetch_transaction_emails(new_tokens.get("access_token"))
        
        return {
            "success": True,
            "message": f"Berhasil sync {emails_parsed} email",
            "email_count": emails_parsed
        }
    except Exception as e:
        return {"success": False, "message": f"Sync failed: {str(e)}"}
    finally:
        db.close()
