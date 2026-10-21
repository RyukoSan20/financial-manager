"""User Settings API - CRUD for app preferences, notifications, and support requests.

Endpoints (all under /api/settings):
- GET    /api/settings/           -> full settings object (auto-creates defaults)
- PUT    /api/settings/           -> partial update of settings
- POST   /api/settings/reset      -> reset to defaults
- GET    /api/settings/notifications
- PUT    /api/settings/notifications
- GET    /api/settings/app
- PUT    /api/settings/app
- GET    /api/settings/support    -> list own support requests
- POST   /api/settings/support    -> create support request (contact form)
- GET    /api/settings/support/{id}
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.user_settings import UserSettings, SupportRequest

router = APIRouter(prefix="/api/settings", tags=["Settings"])


# === Schemas ===

class AppSettingsResponse(BaseModel):
    theme: str = "light"
    language: str = "id"
    currency: str = "IDR"
    date_format: str = "DD/MM/YYYY"
    start_of_week: str = "monday"
    timezone: str = "Asia/Jakarta"
    auto_backup: bool = False
    biometric_login: bool = False


class NotificationSettingsResponse(BaseModel):
    email_notifications: bool = True
    push_notifications: bool = True
    transaction_alerts: bool = True
    budget_alerts: bool = True
    weekly_summary: bool = True
    monthly_summary: bool = False
    reminder_frequency: str = "weekly"
    reminder_days_before: int = 3


class SettingsResponse(BaseModel):
    app: AppSettingsResponse
    notifications: NotificationSettingsResponse
    updated_at: Optional[datetime] = None


class AppSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    currency: Optional[str] = None
    date_format: Optional[str] = None
    start_of_week: Optional[str] = None
    timezone: Optional[str] = None
    auto_backup: Optional[bool] = None
    biometric_login: Optional[bool] = None


class NotificationSettingsUpdate(BaseModel):
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    transaction_alerts: Optional[bool] = None
    budget_alerts: Optional[bool] = None
    weekly_summary: Optional[bool] = None
    monthly_summary: Optional[bool] = None
    reminder_frequency: Optional[str] = None
    reminder_days_before: Optional[int] = Field(default=None, ge=0, le=30)


class SupportRequestCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)
    email: Optional[str] = None


class SupportRequestResponse(BaseModel):
    id: int
    subject: str
    message: str
    email: Optional[str] = None
    status: str
    response: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# === Helpers ===

def _get_or_create_settings(db: Session, user_id: int) -> UserSettings:
    """Get user settings row, creating with defaults if missing."""
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not settings:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _to_app_response(s: UserSettings) -> AppSettingsResponse:
    return AppSettingsResponse(
        theme=s.theme, language=s.language, currency=s.currency,
        date_format=s.date_format, start_of_week=s.start_of_week,
        timezone=s.timezone, auto_backup=s.auto_backup,
        biometric_login=s.biometric_login,
    )


def _to_notif_response(s: UserSettings) -> NotificationSettingsResponse:
    return NotificationSettingsResponse(
        email_notifications=s.email_notifications,
        push_notifications=s.push_notifications,
        transaction_alerts=s.transaction_alerts,
        budget_alerts=s.budget_alerts,
        weekly_summary=s.weekly_summary,
        monthly_summary=s.monthly_summary,
        reminder_frequency=s.reminder_frequency,
        reminder_days_before=s.reminder_days_before,
    )


# === Endpoints ===

@router.get("", response_model=SettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all settings for current user (creates defaults on first call)."""
    s = _get_or_create_settings(db, current_user.id)
    return SettingsResponse(
        app=_to_app_response(s),
        notifications=_to_notif_response(s),
        updated_at=s.updated_at,
    )


@router.put("", response_model=SettingsResponse)
def update_settings(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update app and/or notification settings in one call.

    Accepts {"app": {...}, "notifications": {...}} - any subset of fields.
    """
    s = _get_or_create_settings(db, current_user.id)

    app_fields = {
        "theme", "language", "currency", "date_format",
        "start_of_week", "timezone", "auto_backup", "biometric_login",
    }
    notif_fields = {
        "email_notifications", "push_notifications", "transaction_alerts",
        "budget_alerts", "weekly_summary", "monthly_summary",
        "reminder_frequency", "reminder_days_before",
    }

    app_update = payload.get("app") or {}
    notif_update = payload.get("notifications") or {}

    # Also accept flat payload (top-level keys)
    for key, value in payload.items():
        if key in ("app", "notifications"):
            continue
        if key in app_fields:
            app_update[key] = value
        elif key in notif_fields:
            notif_update[key] = value

    for key, value in app_update.items():
        if key in app_fields and value is not None:
            setattr(s, key, value)

    for key, value in notif_update.items():
        if key in notif_fields and value is not None:
            setattr(s, key, value)

    db.commit()
    db.refresh(s)

    return SettingsResponse(
        app=_to_app_response(s),
        notifications=_to_notif_response(s),
        updated_at=s.updated_at,
    )


@router.post("/reset", response_model=SettingsResponse)
def reset_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reset all settings back to defaults."""
    db.query(UserSettings).filter(UserSettings.user_id == current_user.id).delete()
    db.commit()
    s = _get_or_create_settings(db, current_user.id)
    return SettingsResponse(
        app=_to_app_response(s),
        notifications=_to_notif_response(s),
        updated_at=s.updated_at,
    )


@router.get("/app", response_model=AppSettingsResponse)
def get_app_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(db, current_user.id)
    return _to_app_response(s)


@router.put("/app", response_model=AppSettingsResponse)
def update_app_settings(
    payload: AppSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(db, current_user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(s, key, value)
    db.commit()
    db.refresh(s)
    return _to_app_response(s)


@router.get("/notifications", response_model=NotificationSettingsResponse)
def get_notification_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(db, current_user.id)
    return _to_notif_response(s)


@router.put("/notifications", response_model=NotificationSettingsResponse)
def update_notification_settings(
    payload: NotificationSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(db, current_user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(s, key, value)
    db.commit()
    db.refresh(s)
    return _to_notif_response(s)


# === Support / Contact form ===

@router.get("/support", response_model=List[SupportRequestResponse])
def list_support_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List current user's support requests."""
    requests = (
        db.query(SupportRequest)
        .filter(SupportRequest.user_id == current_user.id)
        .order_by(SupportRequest.created_at.desc())
        .all()
    )
    return requests


@router.post("/support", response_model=SupportRequestResponse, status_code=status.HTTP_201_CREATED)
def create_support_request(
    payload: SupportRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a contact form message from Help & Support page."""
    request = SupportRequest(
        user_id=current_user.id,
        subject=payload.subject,
        message=payload.message,
        email=payload.email or current_user.email,
        status="open",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.get("/support/{request_id}", response_model=SupportRequestResponse)
def get_support_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single support request (own requests only)."""
    request = (
        db.query(SupportRequest)
        .filter(SupportRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Support request not found")
    if request.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your support request")
    return request
