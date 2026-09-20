"""Transfer model for account-to-account transfers."""

from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)
    date = Column(Date, nullable=False, default=datetime.utcnow)
    description = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Accounts
    from_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    to_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    from_account = relationship("Account", foreign_keys=[from_account_id])
    to_account = relationship("Account", foreign_keys=[to_account_id])
    
    # Child transactions (created from this transfer)
    transactions = relationship("Transaction", back_populates="transfer")
