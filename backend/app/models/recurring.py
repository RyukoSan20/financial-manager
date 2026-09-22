"""Recurring transaction rule model."""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Transaction details
    type = Column(String(20), nullable=False)  # income, expense, transfer
    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)
    description = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Account(s)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    to_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)  # For transfers
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Recurring schedule
    frequency = Column(String(20), nullable=False)  # daily, weekly, biweekly, monthly, quarterly, yearly, custom
    interval_value = Column(Integer, default=1)  # e.g., every 2 weeks
    day_of_month = Column(Integer, nullable=True)  # 1-31, for monthly
    day_of_week = Column(Integer, nullable=True)  # 0-6 (Mon-Sun), for weekly
    
    # Dates
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # null = indefinite
    next_occurrence = Column(Date, nullable=True)
    
    # Settings
    is_active = Column(Boolean, default=True)
    auto_generate = Column(Boolean, default=True)  # Auto-create transactions
    reminder_days_before = Column(Integer, nullable=True)  # Days before to send reminder
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("Account", foreign_keys=[account_id], back_populates="recurring_rules")
    to_account = relationship("Account", foreign_keys=[to_account_id])
    category = relationship("Category", back_populates="recurring_rules")
    generated_transactions = relationship("Transaction", back_populates="recurring_rule")
