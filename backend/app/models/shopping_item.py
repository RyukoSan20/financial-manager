"""
Shopping Item Model - Kanban Board Pipeline

NEW model for the shopping board pipeline.
Fields needed for: wishlist -> mau dibeli -> dipesan -> dikirim -> diterima flow.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.sql import func

try:
    from app.db.base import Base
except ImportError:
    from sqlalchemy.ext.declarative import declarative_base
    Base = declarative_base()


class ShoppingItem(Base):
    """
    Kanban board shopping item.
    
    Pipeline stages: wishlist -> to_buy -> ordered -> shipped -> received -> cancelled
    Each item tracks: name, price, quantity, marketplace, tracking, rating, notes.
    """
    __tablename__ = "shopping_items_new"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Basic info
    name = Column(String(255), nullable=False)
    quantity = Column(Integer, default=1)
    price = Column(Integer, nullable=True)  # harga satuan rencana (Rupiah)
    
    # Pipeline stage: wishlist, to_buy, ordered, shipped, received, cancelled
    stage = Column(String(20), default='wishlist', index=True)
    position = Column(Integer, default=0)  # ordering within stage
    
    # Source
    marketplace = Column(String(50), nullable=True)  # shopee, tokopedia, dll
    product_url = Column(String(500), nullable=True)  # https only
    
    # Category (nullable, no FK constraint to avoid SQLAlchemy metadata issues)
    category_id = Column(Integer, nullable=True)
    
    # Tracking (for shipped stage)
    tracking_number = Column(String(64), nullable=True)
    courier = Column(String(32), nullable=True)
    
    # Rating & Notes
    rating = Column(Integer, nullable=True)  # 1-5 stars
    notes = Column(String(500), nullable=True)
    
    # Purchase tracking
    purchased_at = Column(DateTime, nullable=True)  # when marked as ordered
    received_at = Column(DateTime, nullable=True)  # when marked as received
    
    # Link to expense transaction (nullable FK - will be set when item is converted)
    # Note: transaction_id FK is nullable and not enforced at model level
    # to avoid SQLAlchemy metadata issues
    transaction_id = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index('ix_shopping_user_stage', 'user_id', 'stage'),
        Index('ix_shopping_user_position', 'user_id', 'position'),
    )
    
    def __repr__(self):
        return f"<ShoppingItem {self.id}: {self.name} [{self.stage}]>"


class WishlistItem(Base):
    """
    Simple wishlist item - legacy support.
    """
    __tablename__ = "wishlist_items"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    target_price = Column(Integer, nullable=True)
    marketplace = Column(String(50), nullable=True)
    search_url = Column(String(500), nullable=True)
    priority = Column(String(20), default='medium')  # high, medium, low
    notes = Column(String(500), nullable=True)
    
    # Link to shopping item
    shopping_item_id = Column(Integer, ForeignKey('shopping_items_new.id'), nullable=True)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
