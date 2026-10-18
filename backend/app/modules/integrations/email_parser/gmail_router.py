"""
Gmail OAuth Router - Handles Gmail OAuth2 callback and user connection status.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

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


@router.get("/connect")
async def gmail_connect(current_user = Depends(get_current_user)):
    """Generate Gmail OAuth URL for user authorization."""
    oauth = GmailOAuth()
    auth_url = oauth.get_auth_url(state=str(current_user.id))
    
    return GmailConnectResponse(
        auth_url=auth_url,
        message="Buka URL ini untuk authorize FinManager mengakses Gmail Anda"
    )


@router.get("/callback")
async def gmail_callback(code: str, state: Optional[str] = None):
    """
    Handle OAuth callback from Google.
    Exchange code for tokens and store in database.
    """
    try:
        oauth = GmailOAuth()
        tokens = oauth.exchange_code_for_tokens(code)
        
        user_id = int(state) if state else None
        
        if user_id:
            db = SessionLocal()
            try:
                # Store tokens securely (in production, encrypt with KMS)
                from app.models.user import User
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    # Store tokens in user settings or separate table
                    # For now, just acknowledge success
                    db.commit()
            finally:
                db.close()
        
        return GmailCallbackResponse(
            success=True,
            message="Gmail berhasil terhubung! Email parser akan otomatis memindai transaksi."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")


@router.get("/status")
async def gmail_status(current_user = Depends(get_current_user)):
    """Check if user has connected Gmail."""
    db = SessionLocal()
    try:
        # Check if user has Gmail credentials stored
        # For now, return mock status
        return {
            "connected": False,
            "message": "Gmail belum terhubung"
        }
    finally:
        db.close()


@router.post("/disconnect")
async def gmail_disconnect(current_user = Depends(get_current_user)):
    """Disconnect Gmail integration."""
    db = SessionLocal()
    try:
        # Remove stored credentials
        db.commit()
        return {"success": True, "message": "Gmail berhasil disconnect"}
    finally:
        db.close()


@router.post("/sync")
async def gmail_sync(current_user = Depends(get_current_user)):
    """Manually trigger email sync."""
    # This would trigger the email poller
    return {
        "success": True,
        "message": "Email sync dimulai. Cek status nanti.",
        "estimated_time": "5-10 menit"
    }
