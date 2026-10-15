"""Merchant models for multi-store management."""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class BusinessType(str, enum.Enum):
    GROCERY = "grocery"           # Toko kelontong
    FOOD_STALL = "food_stall"      # Warung makan
    COFFEE_SHOP = "coffee_shop"    # Kedai kopi
    MINI_MARKET = "mini_market"    # Minimarket
    PHARMACY = "pharmacy"          # Apotek
    RESTAURANT = "restaurant"      # Restaurant
    OTHER = "other"


class SettlementStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Merchant(Base):
    """Merchant/Store model for business tracking."""
    __tablename__ = "merchants"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Store info
    store_name = Column(String(255), nullable=False)
    business_type = Column(String(50), default=BusinessType.OTHER.value)
    store_phone = Column(String(20), nullable=True)
    store_address = Column(Text, nullable=True)
    
    # QRIS/Payment settings
    qris_merchant_id = Column(String(100), nullable=True)
    qris_enabled = Column(Boolean, default=False)
    
    # Default accounts for this merchant
    default_sales_account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    default_cash_account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    default_qris_account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    
    # Settings
    is_active = Column(Boolean, default=True)
    auto_settlement = Column(Boolean, default=True)  # Auto daily settlement
    settlement_time = Column(String(5), default="23:59")  # HH:MM
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    products = relationship("MerchantProduct", back_populates="merchant", cascade="all, delete-orphan")
    daily_settlements = relationship("DailySettlement", back_populates="merchant", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="merchant")

    def __repr__(self):
        return f"<Merchant {self.store_name}>"


class MerchantProduct(Base):
    """Products/items sold by merchant."""
    __tablename__ = "merchant_products"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    sku = Column(String(50), nullable=True)
    price = Column(Float, nullable=False, default=0)
    cost_price = Column(Float, nullable=True)  # HPP
    stock = Column(Integer, default=0)
    unit = Column(String(20), default="pcs")  # pcs, kg, liter, etc
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    merchant = relationship("Merchant", back_populates="products")

    def __repr__(self):
        return f"<MerchantProduct {self.name}>"


class DailySettlement(Base):
    """Daily cash/QRIS reconciliation record."""
    __tablename__ = "daily_settlements"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    
    # Sales summary
    total_sales = Column(Float, default=0)
    total_qris_sales = Column(Float, default=0)
    total_cash_sales = Column(Float, default=0)
    total_edc_sales = Column(Float, default=0)
    
    # Expenses
    total_operational_expense = Column(Float, default=0)  # Beli bahan, etc
    
    # Net calculation
    gross_profit = Column(Float, default=0)  # total_sales - cost of goods
    net_profit = Column(Float, default=0)    # gross_profit - operational_expense
    
    # Transfer to personal account
    transfer_to_personal = Column(Float, default=0)
    personal_account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    
    # Status
    status = Column(String(20), default=SettlementStatus.PENDING.value)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    merchant = relationship("Merchant", back_populates="daily_settlements")

    def __repr__(self):
        return f"<DailySettlement {self.merchant_id} - {self.date}>"
