"""
Check that the columns the new migration adds are really there.

The startup path adds them with `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS`, which runs whether alembic managed it or not. So even when
alembic fails, the columns are there. This is the check that says so
out loud instead of assuming it.

It reads the table the way the application does, so it works on
PostgreSQL and on SQLite.
"""

import os
import sys


def _add_app_to_path():
    """Make the app importable no matter where this is run from."""
    here = os.path.dirname(os.path.abspath(__file__))
    backend = os.path.dirname(here)
    if backend not in sys.path:
        sys.path.insert(0, backend)


# The table of the line items inside a financial record.
#
# It was created by the models at startup and was never migrated, so
# it was there but alembic did not know about it. A database that was
# built any other way did not have it at all, and a request that
# wrote a breakdown answered "no such table: breakdown_items".
#
# So it is checked here, and the check is what says so out loud.
BREAKDOWN_TABLE = "breakdown_items"

BREAKDOWN_COLUMNS = (
    "id", "user_id", "parent_type", "parent_id", "name",
    "quantity", "unit_price", "total_price", "category", "kind",
    "is_discount", "notes", "source", "is_estimated",
    "created_at", "updated_at",
)

# The tables a shared bill is made of.
SPLIT_TABLES = (
    "split_groups",
    "split_members",
    "split_expenses",
    "split_payers",
    "split_items",
    "split_item_claims",
    "split_calculated_shares",
    "split_settlements",
    "split_payment_methods",
)


def _columns_for(engine, table):
    """The column names of one table, whichever database this is."""
    from sqlalchemy import inspect

    inspector = inspect(engine)
    if not inspector.has_table(table):
        return set()
    return {column["name"] for column in inspector.get_columns(table)}


def main():
    _add_app_to_path()
    try:
        from app.core.database import engine
    except ImportError:
        print("the app is not on the path; run this from the backend folder")
        return 1

    wanted = {
        "transactions": {"tags", "is_draft", "split_expense_id", "split_tx_type"},
        "categories": {"is_adjustment"},
    }

    missing = []
    for table, columns in wanted.items():
        have = _columns_for(engine, table)
        if not have:
            print(f"::error::the table {table} is not there")
            missing.append(table)
            continue
        for column in sorted(columns):
            if column in have:
                print(f"the column {table}.{column} is there")
            else:
                print(f"::error::the column {table}.{column} is missing")
                missing.append(f"{table}.{column}")

    # The tables of a shared bill. They are made by the migration, so
    # they are the thing that has to be checked: if the migration did
    # not run, the columns on transactions can be there and the
    # feature still cannot work.
    from sqlalchemy import inspect

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    for table in SPLIT_TABLES:
        if table in tables:
            print(f"the table {table} is there")
        else:
            print(f"::error::the table {table} is missing")
            missing.append(table)

    # The line items, and every column the model declares. A table
    # that is there but half made is as broken as one that is not there
    # at all.
    breakdown_columns = _columns_for(engine, BREAKDOWN_TABLE)
    if not breakdown_columns:
        print(f"::error::the table {BREAKDOWN_TABLE} is missing")
        missing.append(BREAKDOWN_TABLE)
    else:
        for column in BREAKDOWN_COLUMNS:
            if column in breakdown_columns:
                print(f"the column {BREAKDOWN_TABLE}.{column} is there")
            else:
                print(f"::error::the column {BREAKDOWN_TABLE}.{column} is missing")
                missing.append(f"{BREAKDOWN_TABLE}.{column}")

    if missing:
        print(f"::error::missing: {', '.join(missing)}")
        return 1

    print("the new columns are there")
    return 0


if __name__ == "__main__":
    sys.exit(main())
