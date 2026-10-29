"""Database configuration - supports SQLite and PostgreSQL."""

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# PostgreSQL doesn't support check_same_thread
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Connection pool settings optimized for 1-4 workers
# Calculation: workers × (pool_size + max_overflow) < max_connections (default 100)
# For 2 workers: 2 × (10 + 15) = 50 < 100 ✅
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,      # Check connection health before use
    pool_size=10,            # Persistent connections
    max_overflow=15,        # Additional connections when needed
    pool_recycle=3600,      # Recycle connections every hour
    pool_timeout=30,       # Wait max 30s for connection
    echo=False,              # Set True for SQL debugging
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
    """Initialize database tables and run migrations."""
    # Import ALL models to register with SQLAlchemy BEFORE create_all
    from app.models import (
        Account, Category, Transaction, Budget,
        Transfer, RecurringRule, Goal, GoalContribution,
        Debt, DebtPayment, NetWorthSnapshot, ReceiptScan, ReceiptItem
    )
    # Import User model for auth
    from app.models.user import User
    
    # Run migrations first
    run_migrations()
    
    Base.metadata.create_all(bind=engine)


def run_migrations():
    """Run database migrations for new columns."""
    with engine.connect() as conn:
        # The words the reader put on a transaction, and whether the
        # transaction has been confirmed yet. Both are added the way
        # the ones above are: if the column is not there, it is put
        # there; if it is, nothing happens. A reader whose database
        # is a year old gets the columns without losing a row.
        for statement in (
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tags TEXT",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false",
            "ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN NOT NULL DEFAULT false",
        ):
            try:
                conn.execute(text(statement))
                conn.commit()
            except Exception as e:
                # The column is already there, or the table is not.
                # Neither is a reason to refuse to start.
                conn.rollback()
                logger.debug(f"Migration skipped: {statement[:60]} -> {e}")

        # The index that makes a draft cheap to find. It is created
        # on its own, because a table that has been running for a
        # while has rows in it and the index cannot be added to the
        # same statement as the column.
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_transactions_user_draft
                ON transactions (user_id, is_draft)
            """))
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.debug(f"Draft index skipped -> {e}")

        # Add receipt_scan_id column to transactions if not exists
        try:
            conn.execute(text("""
                ALTER TABLE transactions 
                ADD COLUMN IF NOT EXISTS receipt_scan_id INTEGER REFERENCES receipt_scans(id)
            """))
            conn.commit()
        except Exception as e:
            # Column might already exist or table doesn't exist
            conn.rollback()
            print(f"Migration note: {e}")


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
