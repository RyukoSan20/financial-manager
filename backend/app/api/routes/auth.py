"""Enhanced Authentication routes with Guest, Email & Google OAuth support."""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
import re
import secrets
from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, get_current_user_optional
)
from app.models.user import User
from app.schemas.user import Token, MessageResponse
import os

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Google OAuth Config
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")


# === Pydantic Models ===

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    username: Optional[str] = None
    full_name: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v


class GuestLoginRequest(BaseModel):
    device_id: str = Field(..., min_length=10)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v


class GoogleAuthRequest(BaseModel):
    id_token: str
    access_token: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    default_currency: Optional[str] = None
    timezone: Optional[str] = None


class PasswordStrengthResponse(BaseModel):
    score: int  # 0-4 (weak to strong)
    feedback: List[str]


# === Password Strength Checker ===

def check_password_strength(password: str) -> tuple[int, List[str]]:
    """Check password strength and return score + feedback."""
    score = 0
    feedback = []
    
    if len(password) >= 8:
        score += 1
    elif len(password) < 6:
        feedback.append("Password too short (min 8 chars)")
    
    if len(password) >= 12:
        score += 1
    
    if re.search(r'[A-Z]', password):
        score += 1
    else:
        feedback.append("Add uppercase letters")
    
    if re.search(r'[a-z]', password):
        score += 1
    else:
        feedback.append("Add lowercase letters")
    
    if re.search(r'\d', password):
        score += 1
    else:
        feedback.append("Add numbers")
    
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        score += 1
    else:
        feedback.append("Add special characters (!@#$%)")
    
    # Normalize score to 0-4
    normalized_score = min(4, max(0, score - 2))
    
    return normalized_score, feedback


# === Email/Password Auth ===

@router.post("/register", response_model=Token, status_code=201)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register new user with email and password."""
    # Check if email exists
    existing = db.query(User).filter(User.email == request.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Check username if provided
    if request.username:
        existing_username = db.query(User).filter(
            User.username == request.username.lower()
        ).first()
        if existing_username:
            raise HTTPException(
                status_code=400,
                detail="Username already taken"
            )
    
    # Create user with hashed password
    hashed_password = get_password_hash(request.password)
    user = User(
        email=request.email.lower(),
        username=request.username.lower() if request.username else None,
        full_name=request.full_name,
        hashed_password=hashed_password,
        is_active=True,
        email_verified=False,  # Can implement email verification later
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create token
    access_token = create_access_token(user.id)
    
    return Token(
        access_token=access_token,
        user={
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "is_active": user.is_active,
        }
    )


@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password."""
    user = db.query(User).filter(User.email == request.email.lower()).first()
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not user.hashed_password:
        raise HTTPException(
            status_code=401,
            detail="This account uses Google sign-in. Please use 'Sign in with Google'."
        )
    
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="Account is inactive. Please contact support."
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    access_token = create_access_token(user.id)
    
    return Token(
        access_token=access_token,
        user={
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "is_active": user.is_active,
        }
    )


# === Guest Login ===

@router.post("/guest", response_model=Token)
def guest_login(request: GuestLoginRequest, db: Session = Depends(get_db)):
    """Login as guest with unique device ID. Creates temporary account."""
    # Check if guest with this device already exists
    guest_email = f"guest_{request.device_id}@finmanager.local"
    existing = db.query(User).filter(User.email == guest_email).first()
    
    if existing:
        # Update last login
        existing.last_login = datetime.utcnow()
        db.commit()
        access_token = create_access_token(existing.id)
        return Token(
            access_token=access_token,
            user={
                "id": existing.id,
                "email": existing.email,
                "username": existing.username,
                "full_name": existing.full_name,
                "is_active": existing.is_active,
            }
        )
    
    # Create new guest user
    hashed_password = get_password_hash(secrets.token_urlsafe(32))
    guest_user = User(
        email=guest_email,
        username=f"guest_{request.device_id[:8]}",
        full_name="Guest User",
        hashed_password=hashed_password,
        is_active=True,
        is_guest=True,
    )
    db.add(guest_user)
    db.commit()
    db.refresh(guest_user)
    
    access_token = create_access_token(guest_user.id)
    
    return Token(
        access_token=access_token,
        user={
            "id": guest_user.id,
            "email": guest_user.email,
            "username": guest_user.username,
            "full_name": guest_user.full_name,
            "is_active": guest_user.is_active,
        }
    )


# === Google OAuth ===

@router.get("/google/url")
def google_auth_url():
    """Get Google OAuth authorization URL."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured"
        )
    
    scopes = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
    
    import urllib.parse
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": scopes,
        "access_type": "online",
        "prompt": "select_account",
    }
    
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    
    return {"url": auth_url}


@router.post("/google/callback", response_model=Token)
async def google_callback(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Handle Google OAuth callback."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured"
        )
    
    try:
        # Verify Google token
        import requests
        google_user_url = "https://www.googleapis.com/oauth2/v3/userinfo"
        headers = {"Authorization": f"Bearer {request.access_token}"}
        user_response = requests.get(google_user_url, headers=headers)
        
        if user_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        
        google_user = user_response.json()
        google_email = google_user.get("email", "").lower()
        google_name = google_user.get("name", "")
        google_picture = google_user.get("picture", "")
        
        if not google_email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
        
        # Find or create user
        user = db.query(User).filter(User.email == google_email).first()
        
        if not user:
            # Create new user
            user = User(
                email=google_email,
                full_name=google_name,
                hashed_password=None,  # No password for Google users
                is_active=True,
                is_guest=False,
                google_picture=google_picture,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Update last login
        user.last_login = datetime.utcnow()
        user.google_picture = user.google_picture or google_picture
        db.commit()
        
        access_token = create_access_token(user.id)
        
        return Token(
            access_token=access_token,
            user={
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "is_active": user.is_active,
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google authentication failed: {str(e)}")


# === Profile Endpoints ===

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "is_guest": getattr(current_user, 'is_guest', False),
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
    }


@router.put("/me", response_model=dict)
def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile."""
    if request.username and request.username != current_user.username:
        existing = db.query(User).filter(
            User.username == request.username.lower(),
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = request.username.lower()
    
    if request.full_name is not None:
        current_user.full_name = request.full_name
    if request.default_currency is not None:
        current_user.default_currency = request.default_currency
    if request.timezone is not None:
        current_user.timezone = request.timezone
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
    }


@router.put("/change-password", response_model=MessageResponse)
def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password."""
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="Cannot change password for OAuth accounts"
        )
    
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )
    
    current_user.hashed_password = get_password_hash(request.new_password)
    db.commit()
    
    return MessageResponse(message="Password changed successfully")


@router.post("/password-strength")
def check_strength(password: str):
    """Check password strength."""
    score, feedback = check_password_strength(password)
    
    labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"]
    
    return PasswordStrengthResponse(
        score=score,
        feedback=feedback if feedback else ["Strong password!"]
    )


# === Logout (client-side token removal) ===

@router.post("/logout", response_model=MessageResponse)
def logout(current_user: User = Depends(get_current_user)):
    """Logout (client should remove token)."""
    # In JWT, logout is handled client-side by removing the token
    # Server can maintain a token blacklist for enhanced security
    return MessageResponse(message="Logged out successfully")


# === Supabase Token Exchange ===
# Allow frontend to exchange Supabase token for backend JWT

class SupabaseTokenRequest(BaseModel):
    email: str
    supabase_id: str
    provider: str = "google"


@router.post("/supabase-exchange", response_model=Token)
def supabase_token_exchange(
    request: SupabaseTokenRequest,
    db: Session = Depends(get_db)
):
    """Exchange Supabase user info for backend JWT. Creates user if not exists."""
    # Find or create user by email
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        # Create new user
        user = User(
            email=request.email,
            username=request.email.split("@")[0],
            hashed_password=None,  # No password - OAuth only
            is_active=True,
            google_id=request.supabase_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create backend JWT
    access_token = create_access_token(user.id)
    
    return Token(
        access_token=access_token,
        user={
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "is_active": user.is_active,
        }
    )
