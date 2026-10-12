#!/usr/bin/env python3
"""
Backup and restore script for Financial Manager database.
Usage:
  python3 backup_restore.py export > backup.json
  python3 backup_restore.py import backup.json
"""

import os
import sys
import json
from datetime import datetime

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://rafi:rafi123@localhost:5432/financial_manager"
)

def get_engine_and_session():
    """Get SQLAlchemy engine and session."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    return engine, Session()

def export_all():
    """Export all data from database."""
    from sqlalchemy import text
    engine, session = get_engine_and_session()
    
    tables_to_export = [
        "users", "accounts", "categories", "transactions", "transaction_items",
        "budgets", "debts", "debt_payments", "recurring_rules",
        "goals", "goal_contributions", "transfers",
        "product_catalog", "receipt_scans", "receipt_items",
        "scan_jobs", "scan_chunks", "net_worth_snapshots"
    ]
    
    data = {
        "exported_at": datetime.utcnow().isoformat(),
        "database_url_host": DATABASE_URL.split("@")[1].split(":")[0] if "@" in DATABASE_URL else "unknown",
        "tables": {}
    }
    
    for table_name in tables_to_export:
        try:
            result = session.execute(text(f"SELECT * FROM {table_name}"))
            columns = result.keys()
            rows = result.fetchall()
            data["tables"][table_name] = []
            for row in rows:
                row_dict = {}
                for col, val in zip(columns, row):
                    if hasattr(val, 'isoformat'):
                        val = val.isoformat()
                    row_dict[col] = val
                data["tables"][table_name].append(row_dict)
            print(f"Exported {len(rows)} rows from {table_name}", file=sys.stderr)
        except Exception as e:
            print(f"Error exporting {table_name}: {e}", file=sys.stderr)
            data["tables"][table_name] = []
    
    session.close()
    return data

def import_all(backup_data):
    """Import all data to database."""
    from sqlalchemy import text
    
    engine, session = get_engine_and_session()
    
    print("Disabling FK checks...", file=sys.stderr)
    session.execute(text("SET session_replication_role = replica"))
    
    for table_name, rows in backup_data.get("tables", {}).items():
        count = 0
        for row_data in rows:
            try:
                # Convert string dates back to datetime
                for key, val in list(row_data.items()):
                    if isinstance(val, str) and ('date' in key.lower() or 'time' in key.lower()):
                        try:
                            row_data[key] = datetime.fromisoformat(val.replace('Z', '+00:00'))
                        except:
                            pass
                
                columns = ", ".join(row_data.keys())
                placeholders = ", ".join([f":{k}" for k in row_data.keys()])
                query = text(f"""
                    INSERT INTO {table_name} ({columns})
                    VALUES ({placeholders})
                    ON CONFLICT DO UPDATE SET
                    {", ".join([f"{k} = EXCLUDED.{k}" for k in row_data.keys()])}
                """)
                session.execute(query, row_data)
                count += 1
            except Exception as e:
                print(f"Error importing row in {table_name}: {e}", file=sys.stderr)
        
        print(f"Imported {count} rows to {table_name}", file=sys.stderr)
    
    session.commit()
    session.close()
    print("Import completed!", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 backup_restore.py [export|import] [file]")
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == "export":
        data = export_all()
        print(json.dumps(data, indent=2, default=str))
    elif action == "import":
        if len(sys.argv) < 3:
            print("Usage: python3 backup_restore.py import <file>")
            sys.exit(1)
        with open(sys.argv[2], 'r') as f:
            backup_data = json.load(f)
        import_all(backup_data)
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)
