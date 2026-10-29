"""
Add the columns the newer pages read.

Three things, all of them additive:

- ``transactions.tags`` — a list of words on a transaction. A row of
  text, so it holds ``["kerja", "liburan"]`` and nothing more. It is
  a list in a column rather than a table of its own, because there is
  no query that needs to join, and a column is one thing to add and
  one thing to take away.
- ``transactions.is_draft`` — a transaction that has been entered but
  not yet confirmed. The receipt reader makes drafts so that a
  reading can be checked before it becomes a record.
- ``categories.is_adjustment`` — marks the category that holds the
  difference between what the bank says and what was recorded. It
  is a flag rather than a new category type, so the existing
  category rules keep working unchanged.

The rule for this file: **it is additive and it is reversible.** Every
column goes with a ``DROP COLUMN`` in the downgrade, so the migration
can be undone without losing anything that was there before. The
categories that are added are removed by name, and only those that
this migration added.

Nothing here is run automatically. The owner reads it and runs it.
"""

from alembic import op
import sqlalchemy as sa

# The revision chain. This one follows the shopping pipeline.
revision = "20261029_transaction_tags_and_drafts"
down_revision = "20261023_merchant_catalog"
branch_labels = None
depends_on = None


# The category that holds a balance adjustment. It is looked up by
# name, so it is written down here once.
ADJUSTMENT_CATEGORY = "Penyesuaian Saldo"


def _add_column(table, column):
    """
    Put a column on a table, if the table is there.

    The base tables in this database are not made by alembic: they are
    made from the models at startup. So a fresh database reaches this
    revision with the table already there, and an empty one reaches it
    with nothing. Both have to work.

    The column is also left out when it is already there, because the
    startup migration adds the same column. Running this twice must
    not be an error.
    """
    from sqlalchemy import inspect

    if table not in inspect(op.get_bind()).get_table_names():
        return False
    if column.name in {c["name"] for c in inspect(op.get_bind()).get_columns(table)}:
        return False
    op.add_column(table, column)
    return True


def upgrade():
    # --- transactions.tags -------------------------------------------------
    _add_column("transactions", sa.Column("tags", sa.Text(), nullable=True))

    # --- transactions.is_draft ---------------------------------------------
    _add_column(
        "transactions",
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # A draft is not a record, so it is not shown with the others. The
    # index is on the pair that the query uses: the drafts of one
    # reader, newest first.
    op.create_index(
        "idx_transactions_user_draft",
        "transactions",
        ["user_id", "is_draft"],
        unique=False,
        if_not_exists=True,
    )

    # --- categories.is_adjustment ------------------------------------------
    _add_column(
        "categories",
        sa.Column("is_adjustment", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # The adjustment category itself. It is only added when it is not
    # already there, so running this twice does not make two of it.
    op.execute(
        """
        INSERT INTO categories (name, type, is_adjustment)
        SELECT :name, 'expense', true
        WHERE NOT EXISTS (
            SELECT 1 FROM categories WHERE name = :name
        )
        """.replace(":name", repr(ADJUSTMENT_CATEGORY))
    )


def downgrade():
    from sqlalchemy import inspect

    tables = inspect(op.get_bind()).get_table_names()

    # The categories this migration added are taken away. Only those:
    # a category the owner made themselves is left alone.
    if "categories" in tables:
        op.execute(
            f"DELETE FROM categories WHERE name = {repr(ADJUSTMENT_CATEGORY)} AND is_adjustment = true"
        )

    if "transactions" in tables:
        op.drop_index("idx_transactions_user_draft", table_name="transactions")
        op.drop_column("transactions", "is_draft")
        op.drop_column("transactions", "tags")

    if "categories" in tables:
        op.drop_column("categories", "is_adjustment")
