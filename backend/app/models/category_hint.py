"""Category Hints Table - User learning for auto-suggest"""
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Index
from app.core.database import Base
from datetime import datetime


class CategoryHint(Base):
    """Stores user's category learning hints (tokens -> category mappings)"""
    __tablename__ = "category_hints"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    token = Column(String(100), nullable=False)
    category_id = Column(Integer, nullable=False)
    hits = Column(Integer, default=1, nullable=False)
    last_used = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_category_hints_user_token', 'user_id', 'token', unique=True),
    )
