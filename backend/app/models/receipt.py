"""OCR Receipt and Item models for receipt scanning."""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class ReceiptScan(Base):
    """
    Stores OCR receipt scan metadata and results.
    Linked to Transaction via receipt_scan_id.
    """
    __tablename__ = "receipt_scans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Link to transaction
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    
    # OCR Result Data
    merchant_name = Column(String(100), nullable=True)
    total_amount = Column(Numeric(20, 2), nullable=True)
    subtotal = Column(Numeric(20, 2), nullable=True)
    discount_total = Column(Numeric(20, 2), nullable=True)
    payment_method = Column(String(50), nullable=True)
    receipt_date = Column(DateTime, nullable=True)
    
    # Location data
    address = Column(String(255), nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    
    # Confidence scores
    ocr_confidence = Column(Numeric(5, 2), nullable=True)  # 0-100
    engine_confidence = Column(Numeric(5, 2), nullable=True)  # 0-100 (math validation)
    holistic_confidence = Column(Numeric(5, 2), nullable=True)  # 0-100 (combined)
    
    # Detection metadata
    detection_type = Column(String(50), default="ENTERPRISE_LOCAL_OCR")
    raw_text = Column(Text, nullable=True)
    raw_lines = Column(JSON, nullable=True)  # Store as JSON array
    
    # Image data (optional - for audit)
    image_filename = Column(String(255), nullable=True)
    image_size = Column(Integer, nullable=True)
    
    # Status
    is_processed = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="receipt_scans")
    # Note: Transaction.receipt_scan uses one-way relationship
    items = relationship("ReceiptItem", back_populates="receipt_scan", cascade="all, delete-orphan")


class ReceiptItem(Base):
    """
    Individual items extracted from receipt OCR.
    Linked to ReceiptScan.
    """
    __tablename__ = "receipt_items"

    id = Column(Integer, primary_key=True, index=True)
    receipt_scan_id = Column(Integer, ForeignKey("receipt_scans.id"), nullable=False, index=True)
    
    # Item data
    raw_name = Column(String(255), nullable=True)  # Original OCR text
    canonical_name = Column(String(255), nullable=True)  # Matched catalog name
    
    # Pricing
    quantity = Column(Integer, default=1)
    price_per_unit = Column(Numeric(20, 2), nullable=True)
    total_price = Column(Numeric(20, 2), nullable=True)
    
    # Catalog matching
    category = Column(String(100), nullable=True)  # Auto-classified category
    match_confidence = Column(Numeric(5, 4), nullable=True)  # 0.0000 - 1.0000
    
    # Position in receipt
    line_number = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    receipt_scan = relationship("ReceiptScan", back_populates="items")


class ProductCatalog(Base):
    """
    Master product catalog for item matching.
    Used by catalog_service for fuzzy matching.
    """
    __tablename__ = "product_catalog"

    id = Column(Integer, primary_key=True, index=True)
    
    # Product info
    canonical_name = Column(String(255), nullable=False, index=True)
    short_name = Column(String(100), nullable=True)
    barcode = Column(String(50), nullable=True, index=True)
    
    # Categorization
    category = Column(String(100), nullable=True, index=True)
    subcategory = Column(String(100), nullable=True)
    brand = Column(String(100), nullable=True)
    
    # Pricing (optional reference)
    typical_price = Column(Numeric(20, 2), nullable=True)
    price_min = Column(Numeric(20, 2), nullable=True)
    price_max = Column(Numeric(20, 2), nullable=True)
    
    # Metadata
    merchant_types = Column(String(255), nullable=True)  # "indomaret,alfamart,carrefour"
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
