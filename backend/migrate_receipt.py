#!/usr/bin/env python3
"""
Database migration: Add receipt_scan_id column to transactions table.
Run with: railway run python migrate_receipt.py
"""

from sqlalchemy import create_engine, text
from app.core.config import get_settings

def run_migration():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='transactions' AND column_name='receipt_scan_id'
        """))
        
        if result.fetchone():
            print("Column receipt_scan_id already exists")
            return
        
        # Add column
        conn.execute(text("""
            ALTER TABLE transactions 
            ADD COLUMN receipt_scan_id INTEGER REFERENCES receipt_scans(id)
        """))
        conn.commit()
        print("Column receipt_scan_id added successfully!")

if __name__ == "__main__":
    run_migration()
