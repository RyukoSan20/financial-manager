"""
The line items inside a financial record.

A budget for groceries is made of groceries. A goal for a trip to
Japan is made of a flight, a hotel, food and the rest, and those are
the numbers the reader actually needs to see. So one table holds the
breakdown for every kind of financial record, and the record points at
it.

This table was never migrated. It was created by the server's startup
path, which builds the tables from the models, and so it was there -
but alembic did not know about it, and a server that was ever started
without the models loaded, or a database that was ever built by hand,
would not have had it at all.

That is what happened in production: a request that wrote a
breakdown answered with "no such table: breakdown_items". The write
was saved with a savepoint so that one broken feature could not take
the rest of the request down with it, and that was the right thing to
do at the time. But a savepoint hides a missing table; it does not
create one.

So the table is created here, and it is made the same way the startup
path makes it, so that the two agree.

The table is created only when it is missing, and the columns are
added only when they are missing, so running this twice changes
nothing and running it on a database that already has the table does
nothing.

Revision ID: 20261108_breakdown_items
Revises: 20261104_receipt_tax_total
Create Date: 2026-11-08
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20261108_breakdown_items"
down_revision = "20261104_receipt_tax_total"
branch_labels = None
depends_on = None


BREAKDOWN = "breakdown_items"


def _table_exists():
    """Whether the table is already there."""
    from sqlalchemy import inspect

    return BREAKDOWN in inspect(op.get_bind()).get_table_names()


def _columns():
    """The columns the table has now."""
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    if BREAKDOWN not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(BREAKDOWN)}


def upgrade():
    if not _table_exists():
        # The table is made from the models at startup, so on a server
        # that has run the application it is already there and this
        # does nothing. On a database that was built by hand, or one
        # whose startup path failed, this is what makes it.
        op.create_table(
            BREAKDOWN,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("parent_type", sa.String(length=20), nullable=False),
            sa.Column("parent_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("quantity", sa.Numeric(10, 2), nullable=False),
            sa.Column("unit_price", sa.Numeric(20, 2), nullable=False),
            sa.Column("total_price", sa.Numeric(20, 2), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=True),
            sa.Column("kind", sa.String(length=20), nullable=False),
            sa.Column("is_discount", sa.Boolean(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("source", sa.String(length=20), nullable=False),
            sa.Column("is_estimated", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )

        indexes = [
            ("ix_breakdown_items_id", ["id"]),
            ("ix_breakdown_items_user_id", ["user_id"]),
            ("ix_breakdown_items_parent_type", ["parent_type"]),
            ("ix_breakdown_items_parent_id", ["parent_id"]),
        ]
        for name, columns in indexes:
            op.create_index(name, BREAKDOWN, columns)

        return

    # The table is there but was made by an older version of the model,
    # so a column that the model declares is missing. It is added only
    # when it is missing.
    existing = _columns()

    wanted = {
        "category": sa.Column("category", sa.String(length=50), nullable=True),
        "notes": sa.Column("notes", sa.Text(), nullable=True),
        "is_estimated": sa.Column(
            "is_estimated", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        "source": sa.Column(
            "source", sa.String(length=20), nullable=False, server_default="user"
        ),
        "kind": sa.Column(
            "kind", sa.String(length=20), nullable=False, server_default="expense"
        ),
        "is_discount": sa.Column(
            "is_discount", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        "quantity": sa.Column(
            "quantity", sa.Numeric(10, 2), nullable=False, server_default="1"
        ),
        "unit_price": sa.Column(
            "unit_price", sa.Numeric(20, 2), nullable=False, server_default="0"
        ),
        "total_price": sa.Column(
            "total_price", sa.Numeric(20, 2), nullable=False, server_default="0"
        ),
    }

    for name, column in wanted.items():
        if name in existing:
            continue
        op.add_column(BREAKDOWN, column)


def downgrade():
    # The lines are the reader's own data. Dropping the table throws
    # it away, so the downgrade leaves it alone. A table that was
    # created here and never filled can be dropped by hand.
    pass
