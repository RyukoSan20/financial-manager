"""Financial goal model for tracking savings targets."""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    target_amount = Column(Numeric(20, 2), nullable=False)
    current_amount = Column(Numeric(20, 2), default=0, nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)
    
    # Target date
    target_date = Column(Date, nullable=False)
    
    # Goal type
    goal_type = Column(String(50), nullable=False)  # savings, debt_payoff, investment, purchase, emergency_fund
    
    # Linked account for contributions
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    
    # Status
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Icon and color for UI
    icon = Column(String(50), nullable=True)
    color = Column(String(20), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="goals")
    contributions = relationship("GoalContribution", back_populates="goal", order_by="desc(GoalContribution.created_at)")


class GoalContribution(Base):
    __tablename__ = "goal_contributions"

    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)
    date = Column(Date, nullable=False, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    
    # Link to transaction if contributed via transaction
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    goal = relationship("Goal", back_populates="contributions")
    transaction = relationship("Transaction")
