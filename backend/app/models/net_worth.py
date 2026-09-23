"""Net worth snapshot model for historical tracking."""

from sqlalchemy import Column, Integer, Numeric, DateTime, Date, String, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class NetWorthSnapshot(Base):
    __tablename__ = "net_worth_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, default=datetime.utcnow)
    currency = Column(String(10), default="IDR", nullable=False)
    
    # Total values
    total_assets = Column(Numeric(20, 2), nullable=False)
    total_liabilities = Column(Numeric(20, 2), nullable=False)
    net_worth = Column(Numeric(20, 2), nullable=False)
    
    # Breakdown
    cash_balance = Column(Numeric(20, 2), default=0)
    bank_balance = Column(Numeric(20, 2), default=0)
    investment_balance = Column(Numeric(20, 2), default=0)
    other_assets = Column(Numeric(20, 2), default=0)
    total_debt = Column(Numeric(20, 2), default=0)
    
    # Period info
    period_type = Column(String(20), default="monthly")  # daily, weekly, monthly
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    
    # Change from previous
    change_from_previous = Column(Numeric(20, 2), default=0)
    change_percent = Column(Numeric(10, 4), default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="net_worth_snapshots")
