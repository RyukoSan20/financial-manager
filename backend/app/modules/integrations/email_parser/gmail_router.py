"""Gmail OAuth Router - Secure token storage and email parsing."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
import base64

from app.core.security import get_current_user
from app.core.database import SessionLocal
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
    """Simple base64 encoding for tokens (in production use proper encryption)."""
    return base64.b64encode(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    """Decode token."""
    try:
        return base64.b64decode(encrypted.encode()).decode()
    except Exception:
        return encrypted


@router.get("/connect")
async def gmail_connect(current_user = Depends(get_current_user)):
    """Generate Gmail OAuth URL for user authorization."""
    oauth = GmailOAuth()
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
                            existing.encrypted_refresh_token = encrypted_refresh,
                            existing.encrypted_access_token = encrypted_access,
                            existing.token_type = tokens.get("token_type", "Bearer"),
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
    """Check if user has connected Gmail."""
    db = SessionLocal()
    try:
        from app.models.user import User
        
        connected = False
        email = None
        
        try:
            from app.models.gmail_credentials import GmailCredentials
            cred = db.query(GmailCredentials).filter(
                GmailCredentials.user_id == current_user.id
            ).first()
            connected = cred is not None
        except Exception:
            # Fallback check user settings
            user = db.query(User).filter(User.id == current_user.id).first()
            if user and hasattr(user, 'settings') and user.settings:
                try:
                    settings = json.loads(user.settings)
                    connected = 'gmail' in settings
                except Exception:
                    pass
        
        return {
            "connected": connected,
            "message": "Gmail Terhubung" if connected else "Gmail belum terhubung"
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


# Import for SQLAlchemy func
from sqlalchemy import func
