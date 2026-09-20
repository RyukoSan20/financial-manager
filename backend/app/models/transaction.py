"""Transaction model for income/expense/transfer records.

Transaction types:
- income: Money coming in (salary, freelance, etc.)
- expense: Money going out (food, transport, etc.)
- transfer_out: Money transferred FROM an account (debit)
- transfer_in: Money transferred TO an account (credit)
"""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False)  # income, expense, transfer_out, transfer_in
    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)
    date = Column(Date, nullable=False, default=datetime.utcnow)
    description = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Foreign keys
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Transfer linking - transfer_out points to Transfer record
    transfer_id = Column(Integer, ForeignKey("transfers.id"), nullable=True)
    
    # Recurring transaction
    is_recurring = Column(Boolean, default=False)
    recurring_rule_id = Column(Integer, ForeignKey("recurring_rules.id"), nullable=True)
    
    # Metadata
    is_deleted = Column(Boolean, default=False)  # Soft delete
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    transfer = relationship("Transfer", back_populates="transactions")
    recurring_rule = relationship("RecurringRule", back_populates="generated_transactions")
