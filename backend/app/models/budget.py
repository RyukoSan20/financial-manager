"""Budget model for tracking spending limits."""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)
    period = Column(String(20), nullable=False)  # weekly, monthly, yearly
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    
    # Category and account scoping
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # null = overall budget
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)  # null = all accounts
    
    is_active = Column(Boolean, default=True)
    rollover = Column(Boolean, default=False)  # Carry forward unused budget
    
    # Auto-allocation: deduct from account balance on budget period reset
    auto_allocate = Column(Boolean, default=False)  # Auto-deduct from account on monthly reset
    allocation_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)  # Which account to deduct from
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")
    account = relationship("Account", back_populates="budgets")
