"""User Settings model - stores per-user preferences.

Single row per user (user_id unique). Stores:
- App preferences: theme, language, currency, date_format, start_of_week
- Notification preferences: email/push toggles, budget alerts, weekly summary
- Support requests: contact form messages
"""
from sqlalchemy import (
    Column, Integer, BigInteger, String, Boolean, Text, DateTime, Index
)
from app.core.database import Base
from datetime import datetime


class UserSettings(Base):
    """User settings and preferences (1:1 with users)"""
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, nullable=False, unique=True, index=True)

    # App preferences
    theme = Column(String(20), default="light", nullable=False)
    language = Column(String(10), default="id", nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)
    date_format = Column(String(20), default="DD/MM/YYYY", nullable=False)
    start_of_week = Column(String(10), default="monday", nullable=False)
    timezone = Column(String(50), default="Asia/Jakarta", nullable=False)
    auto_backup = Column(Boolean, default=False, nullable=False)
    biometric_login = Column(Boolean, default=False, nullable=False)

    # Notification preferences
    email_notifications = Column(Boolean, default=True, nullable=False)
    push_notifications = Column(Boolean, default=True, nullable=False)
    transaction_alerts = Column(Boolean, default=True, nullable=False)
    budget_alerts = Column(Boolean, default=True, nullable=False)
    weekly_summary = Column(Boolean, default=True, nullable=False)
    monthly_summary = Column(Boolean, default=False, nullable=False)
    reminder_frequency = Column(String(10), default="weekly", nullable=False)
    reminder_days_before = Column(Integer, default=3, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_user_settings_user', 'user_id', unique=True),
    )


class SupportRequest(Base):
    """Help & Support contact form submissions"""
    __tablename__ = "support_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    email = Column(String(255), nullable=True)
    status = Column(String(20), default="open", nullable=False)  # open|resolved|closed
    response = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_support_requests_user', 'user_id'),
    )
