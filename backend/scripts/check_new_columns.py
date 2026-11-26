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

# The table of receipts, and the table of the lines of a receipt.
#
# The tax on a receipt is a column of its own. It was added by a
# migration, and the migration adds it only when it is missing, so it
# is there on a database that has been migrated and on one that was
# made from the models.
#
# It was checked here because a receipt that is saved writes the tax,
# and a database without the column answered "column tax_total of
# relation receipt_scans does not exist" and the receipt was lost.
#
# The columns are read from the models, not written out by hand. A
# column added to a model and forgotten here would let a broken
# database pass the check and lose a receipt in production.
RECEIPT_MODELS = ("ReceiptScan", "ReceiptItem")

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
    from app.models.breakdown_item import BreakdownItem

    breakdown_columns = _columns_for(engine, BREAKDOWN_TABLE)
    if not breakdown_columns:
        print(f"::error::the table {BREAKDOWN_TABLE} is missing")
        missing.append(BREAKDOWN_TABLE)
    else:
        for column in BreakdownItem.__table__.columns.keys():
            if column in breakdown_columns:
                print(f"the column {BREAKDOWN_TABLE}.{column} is there")
            else:
                print(f"::error::the column {BREAKDOWN_TABLE}.{column} is missing")
                missing.append(f"{BREAKDOWN_TABLE}.{column}")

    # The receipts, and the lines of the receipts.
    #
    # A receipt that is saved writes the tax and the lines. A database
    # without the tax column answers "column tax_total of relation
    # receipt_scans does not exist" and the receipt is lost, and the
    # reader is told nothing. So the columns are checked here, and the
    # check is what says so out loud.
    #
    # The columns come from the models, so a column added to a model
    # is checked without anyone having to remember to add it here.
    from app.models import receipt as receipt_models

    for model_name in RECEIPT_MODELS:
        model = getattr(receipt_models, model_name)
        table = model.__tablename__
        have = _columns_for(engine, table)
        if not have:
            print(f"::error::the table {table} is missing")
            missing.append(table)
            continue
        print(f"the table {table} is there")
        for column in model.__table__.columns.keys():
            if column in have:
                print(f"the column {table}.{column} is there")
            else:
                print(f"::error::the column {table}.{column} is missing")
                missing.append(f"{table}.{column}")

    # The household's tables, and every column their models declare.
    # The list is read from the models, so a column added to a model
    # and forgotten in the migration is caught here.
    from app.models.household import HOUSEHOLD_MODELS

    for model in HOUSEHOLD_MODELS:
        table = model.__tablename__
        have = _columns_for(engine, table)
        if not have:
            print(f"::error::the table {table} is missing")
            missing.append(table)
            continue
        print(f"the table {table} is there")
        for column in model.__table__.columns.keys():
            if column not in have:
                print(f"::error::the column {table}.{column} is missing")
                missing.append(f"{table}.{column}")

    if missing:
        print(f"::error::missing: {', '.join(missing)}")
        return 1

    print("the new columns are there")
    return 0


if __name__ == "__main__":
    sys.exit(main())
