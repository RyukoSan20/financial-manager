"""Category model for income/expense categorization with subcategories."""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # null for shared categories
    name = Column(String(100), nullable=False)
    # The same category in the other two languages. A category the
    # application ships with also carries a system_key, which names it
    # in a way that does not depend on any language.
    name_en = Column(String(100), nullable=True)
    name_ja = Column(String(100), nullable=True)
    system_key = Column(String(60), nullable=True, index=True)
    type = Column(String(20), nullable=False)  # income, expense
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)
    color = Column(String(20), nullable=True)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    
    # The category that holds the difference between what the bank
    # says and what was recorded. It is a flag rather than a new
    # category type, so the rules that work on categories keep
    # working unchanged.
    is_adjustment = Column(Boolean, default=False, nullable=False)

    # Self-referential relationship for subcategories
    subcategories = relationship("Category", backref="parent", remote_side=[id])
    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    budgets = relationship("Budget", back_populates="category")
    recurring_rules = relationship("RecurringRule", back_populates="category")
