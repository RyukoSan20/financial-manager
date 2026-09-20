"""Account/Wallet model."""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    account_type = Column(String(50), nullable=False)  # cash, bank, e-wallet, credit_card, investment
    balance = Column(Numeric(20, 2), default=0, nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)
    is_active = Column(Boolean, default=True)
    is_credit = Column(Boolean, default=False)  # True for credit cards (negative balance = debt)
    credit_limit = Column(Numeric(20, 2), nullable=True)
    
    # For investment accounts
    initial_balance = Column(Numeric(20, 2), nullable=True)  # Starting balance for investment tracking
    
    # Icon and color
    icon = Column(String(50), nullable=True)
    color = Column(String(20), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    transactions = relationship("Transaction", back_populates="account")
    budgets = relationship("Budget", back_populates="account")
    recurring_rules = relationship("RecurringRule", back_populates="account", foreign_keys="RecurringRule.account_id")
    goals = relationship("Goal", back_populates="account")
    debts = relationship("Debt", back_populates="account")
