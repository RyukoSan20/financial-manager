"""GmailCredentials Model - Secure storage for Gmail OAuth tokens."""
from sqlalchemy import Column, Integer, String, DateTime, Text
from app.core.database import Base
from datetime import datetime


class GmailCredentials(Base):
    __tablename__ = "gmail_credentials"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    encrypted_refresh_token = Column(Text, nullable=False)
    encrypted_access_token = Column(Text, nullable=True)
    token_type = Column(String(20), default="Bearer")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
