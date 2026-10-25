"""Account/Wallet model."""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
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

    # The bank or provider this account is held at. Two accounts of the
    # same type but in different currencies are usually held at
    # different places, and this says which one.
    bank_name = Column(String(100), nullable=True)

    # What kind of holding this is, in the words of the currency it is
    # in. A rupiah savings account and a yen savings account are not
    # the same thing, and this is where that difference is written
    # down.
    account_kind = Column(String(50), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")
    budgets = relationship("Budget", back_populates="account", foreign_keys="Budget.account_id")
    allocation_budgets = relationship("Budget", back_populates="allocation_account", foreign_keys="Budget.allocation_account_id")
    recurring_rules = relationship("RecurringRule", back_populates="account", foreign_keys="RecurringRule.account_id")
    goals = relationship("Goal", back_populates="account")
    debts = relationship("Debt", back_populates="account")
