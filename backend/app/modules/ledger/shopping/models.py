"""
Shopping Models - Item-level shopping tracking.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index, Text
from datetime import datetime
try:
    from app.db.base import Base
except ImportError:
    from sqlalchemy.ext.declarative import declarative_base
    Base = declarative_base()


class ShoppingItem(Base):
    """Individual item from a shopping transaction."""
    
    __tablename__ = "shopping_items"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey('transactions.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    # Item details
    item_name = Column(String(255), nullable=False)
    item_name_normalized = Column(String(255))
    quantity = Column(Float, default=1)
    unit = Column(String(50))  # pcs, kg, liter, etc.
    unit_price = Column(String(20))  # Price per unit
    total_price = Column(String(20))  # quantity * unit_price
    discount = Column(String(20), default=0)
    
    # Categorization
    category = Column(String(100))
    sub_category = Column(String(100))
    product_type = Column(String(100))  # food, beverage, household, etc.
    
    # Brand info
    brand = Column(String(100))
    sku = Column(String(100))
    
    # Price tracking
    is_price_tracked = Column(Integer, default=0)  # Boolean
    last_seen_price = Column(String(20))
    price_history = Column(Text)  # JSON array of price history
    
    # Metadata
    receipt_source = Column(String(50))  # ocr, manual, email
    raw_text = Column(Text)  # Original OCR text for this item
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_shopping_user', 'user_id'),
        Index('ix_shopping_transaction', 'transaction_id'),
        Index('ix_shopping_item_name', 'item_name'),
    )


class Wishlist(Base):
    """User wishlist for tracking desired items."""
    
    __tablename__ = "wishlists"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    item_name = Column(String(255), nullable=False)
    category = Column(String(100))
    target_price = Column(String(20))  # Desired price
    current_price = Column(String(20))  # Last known price
    
    # Store info
    store_name = Column(String(255))
    store_url = Column(String(500))
    
    # Priority
    priority = Column(Integer, default=1)  # 1=high, 2=medium, 3=low
    
    # Status
    is_purchased = Column(Integer, default=0)
    purchased_at = Column(DateTime)
    
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_wishlist_user', 'user_id'),
    )


class PriceHistory(Base):
    """Tracks price history for items."""
    
    __tablename__ = "price_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    item_name = Column(String(255), nullable=False)
    item_name_normalized = Column(String(255))
    
    # Price data
    price = Column(String(20), nullable=False)
    store_name = Column(String(255))
    store_location = Column(String(255))
    
    # Source
    source = Column(String(50))  # receipt, manual, online
    
    recorded_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_price_user_item', 'user_id', 'item_name_normalized'),
    )
