"""
Location Models - Merchant location and geofencing data.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Index
from datetime import datetime
try:
    from app.db.base import Base
except ImportError:
    from sqlalchemy.ext.declarative import declarative_base
    Base = declarative_base()


class MerchantLocation(Base):
    """Stores merchant/store location data for geofencing."""
    
    __tablename__ = "merchant_locations"
    
    id = Column(Integer, primary_key=True, index=True)
    merchant_name_raw = Column(String(255), nullable=False)  # Original messy name
    merchant_name_normalized = Column(String(255), nullable=True)  # Cleaned name
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)
    country = Column(String(50), default="Indonesia")
    postal_code = Column(String(10), nullable=True)
    category = Column(String(50), nullable=True)  # mall, retail, restaurant, etc.
    sub_category = Column(String(100), nullable=True)
    brand_id = Column(String(50), nullable=True)  # Link to brand database
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes for fast lookup
    __table_args__ = (
        Index('ix_merchant_normalized', 'merchant_name_normalized'),
        Index('ix_merchant_city', 'city'),
        Index('ix_merchant_category', 'category'),
        Index('ix_merchant_location', latitude, longitude),
    )


class TransactionLocation(Base):
    """Links transactions to merchant locations for spending analytics."""
    
    __tablename__ = "transaction_locations"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey('transactions.id'), nullable=False)
    merchant_location_id = Column(Integer, ForeignKey('merchant_locations.id'), nullable=True)
    
    # Captured location data
    captured_latitude = Column(Float, nullable=True)
    captured_longitude = Column(Float, nullable=True)
    captured_address = Column(Text, nullable=True)
    
    # Geofence info
    inside_geofence = Column(Boolean, default=False)
    nearest_store_name = Column(String(255), nullable=True)
    nearest_store_distance_meters = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class SpendingByLocation(Base):
    """Aggregated spending statistics by location."""
    
    __tablename__ = "spending_by_location"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    merchant_location_id = Column(Integer, ForeignKey('merchant_locations.id'), nullable=False)
    
    period_month = Column(String(7))  # YYYY-MM format
    total_transactions = Column(Integer, default=0)
    total_amount = Column(String(20))  # Using String to avoid precision issues
    average_transaction = Column(String(20))
    
    last_visited = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_spending_user_period', 'user_id', 'period_month'),
    )
