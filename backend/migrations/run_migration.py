#!/usr/bin/env python3
"""
Database Migration Script for Financial Manager
Phase 1: Multi-Tenancy
Phase 2: Parser/OCR Features

Usage:
    python3 -m migrations.run_migration
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def get_database_url():
    """Get database URL from environment or .env file."""
    # Try environment first
    db_url = os.environ.get('DATABASE_URL')
    if db_url:
        return db_url
    
    # Try .env file
    env_path = Path(__file__).parent.parent.parent / '.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip()
    
    raise ValueError("DATABASE_URL not found in environment or .env file")


def run_migration():
    """Run the migration script."""
    db_url = get_database_url()
    print(f"Connecting to database...")
    
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Read migration file
    migration_path = Path(__file__).parent / '001_phase1_phase2.sql'
    with open(migration_path, 'r') as f:
        sql = f.read()
    
    print(f"Running migration: {migration_path.name}")
    
    # Execute migration
    try:
        cur.execute(sql)
        print("Migration completed successfully!")
    except Exception as e:
        print(f"Migration error: {e}")
        raise
    finally:
        cur.close()
        conn.close()


def verify_migration():
    """Verify migration was applied correctly."""
    db_url = get_database_url()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n=== Verification ===")
    
    # Check user_id columns
    print("\n1. Checking user_id columns...")
    cur.execute("""
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'user_id'
        GROUP BY table_name
    """)
    tables = cur.fetchall()
    print(f"   Tables with user_id: {', '.join(t[0] for t in tables)}")
    
    # Check parser columns
    print("\n2. Checking parser columns on transactions...")
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name IN ('merchant_name', 'raw_source_text', 'confidence_score', 
                          'latitude', 'longitude', 'merchant_address', 'detection_type')
    """)
    cols = cur.fetchall()
    print(f"   Parser columns: {', '.join(c[0] for c in cols)}")
    
    # Check data counts
    print("\n3. Checking data counts...")
    tables_to_check = ['accounts', 'transactions', 'budgets', 'goals', 'debts']
    for table in tables_to_check:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()
            count = count[0] if count else 0
            print(f"   {table}: {count} rows")
        except Exception as e:
            print(f"   {table}: Error - {e}")
    
    cur.close()
    conn.close()
    print("\n=== Verification Complete ===")


if __name__ == '__main__':
    if '--verify' in sys.argv:
        verify_migration()
    else:
        run_migration()
        verify_migration()
