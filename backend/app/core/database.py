"""Database configuration - supports SQLite and PostgreSQL."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import get_settings

settings = get_settings()

# PostgreSQL doesn't support check_same_thread
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,  # Enable connection health checks
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    from app.models import (
        Account, Category, Transaction, Budget,
        Transfer, RecurringRule, Goal, GoalContribution,
        Debt, DebtPayment, NetWorthSnapshot
    )
    # Import User model for auth
    from app.models.user import User
    Base.metadata.create_all(bind=engine)


def seed_categories():
    """Seed default categories if none exist."""
    from app.models.category import Category
    
    default_categories = [
        # Income
        {"name": "Gaji", "type": "income", "icon": "💰", "color": "#4CAF50"},
        {"name": "Freelance", "type": "income", "icon": "💻", "color": "#2196F3"},
        {"name": "Investasi", "type": "income", "icon": "📈", "color": "#9C27B0"},
        {"name": "Bonus", "type": "income", "icon": "🎁", "color": "#FF9800"},
        {"name": "Lainnya (Income)", "type": "income", "icon": "📦", "color": "#607D8B"},
        # Expense
        {"name": "Makanan & Minuman", "type": "expense", "icon": "🍔", "color": "#F44336"},
        {"name": "Transportasi", "type": "expense", "icon": "🚗", "color": "#3F51B5"},
        {"name": "Belanja", "type": "expense", "icon": "🛒", "color": "#E91E63"},
        {"name": "Kesehatan", "type": "expense", "icon": "🏥", "color": "#00BCD4"},
        {"name": "Pendidikan", "type": "expense", "icon": "📚", "color": "#795548"},
        {"name": "Hiburan", "type": "expense", "icon": "🎬", "color": "#FF5722"},
        {"name": "Tagihan & Utilitas", "type": "expense", "icon": "📄", "color": "#9E9E9E"},
        {"name": "Investasi & Tabungan", "type": "expense", "icon": "🏦", "color": "#4CAF50"},
        {"name": "Lainnya (Expense)", "type": "expense", "icon": "📦", "color": "#607D8B"},
    ]
    
    db = SessionLocal()
    try:
        existing = db.query(Category).first()
        if not existing:
            for cat_data in default_categories:
                db_category = Category(**cat_data)
                db.add(db_category)
            db.commit()
            print(f"Seeded {len(default_categories)} default categories")
    finally:
        db.close()
