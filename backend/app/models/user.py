"""User model for authentication with Guest & OAuth support."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)  # Nullable for OAuth accounts
    full_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_guest = Column(Boolean, default=False)  # Guest user flag
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # OAuth fields
    google_id = Column(String(255), unique=True, nullable=True)
    google_picture = Column(Text, nullable=True)
    
    # Email verification
    email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String(255), nullable=True)
    
    # Password reset
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    
    # Default preferences
    default_currency = Column(String(10), default="IDR")
    timezone = Column(String(50), default="Asia/Jakarta")
    
    # Relationships (for back_populates from other models)
    accounts = relationship("Account", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    budgets = relationship("Budget", back_populates="user")
    goals = relationship("Goal", back_populates="user")
    debts = relationship("Debt", back_populates="user")
    recurring_rules = relationship("RecurringRule", back_populates="user")
    transfers = relationship("Transfer", back_populates="user")
    categories = relationship("Category", back_populates="user")
    net_worth_snapshots = relationship("NetWorthSnapshot", back_populates="user")
