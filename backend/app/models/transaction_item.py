"""Transaction Item model for itemized receipt details."""

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class TransactionItem(Base):
    __tablename__ = "transaction_items"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Item details
    name = Column(String(255), nullable=False)
    quantity = Column(Numeric(10, 2), default=1)
    unit_price = Column(Numeric(20, 2), nullable=False)
    total_price = Column(Numeric(20, 2), nullable=False)
    
    # Optional categorization
    category_name = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    transaction = relationship("Transaction", back_populates="items")

    def __repr__(self):
        return f"<TransactionItem {self.name} x{self.quantity} @ {self.unit_price}>"
