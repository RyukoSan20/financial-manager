"""
Migration script to add merchant columns to Railway database.
Run this ONCE when deploying to Railway.
"""
from sqlalchemy import text
from app.core.database import engine

def run_migration():
    """Add merchant-related columns to transactions table."""
    with engine.connect() as conn:
        # Add missing columns if they don't exist
        migrations = [
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT FALSE",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_id INTEGER",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100)",
        ]
        
        for sql in migrations:
            try:
                conn.execute(text(sql))
                print(f"✅ Executed: {sql[:50]}...")
            except Exception as e:
                print(f"⚠️ {sql[:30]}... : {e}")
        
        conn.commit()
        print("✅ Migration complete!")

if __name__ == "__main__":
    run_migration()
