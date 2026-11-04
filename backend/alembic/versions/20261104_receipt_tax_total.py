"""
The tax on a receipt, kept as a number of its own.

A receipt carries three numbers and they do not add up on their own:

    subtotal - discount + tax = net

Until now the tax was not kept at all. It was folded into the total,
so the reader could see what they paid but not how much of it was
tax. So the tax is now a column of its own, and the editor can show
the three parts side by side.

The column is added only when it is missing, because the server
builds its tables from the models at startup and then alembic runs on
top of that. The column may already be there.

Revision ID: 20261104_receipt_tax_total
Revises: 20261103_merchant_product_images
Create Date: 2026-11-04
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20261104_receipt_tax_total"
down_revision = "20261103_merchant_product_images"
branch_labels = None
depends_on = None


RECEIPTS = "receipt_scans"


def _columns():
    """The columns the table of receipts has now."""
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    if RECEIPTS not in inspector.get_table_names():
        return None
    return {column["name"] for column in inspector.get_columns(RECEIPTS)}


def upgrade():
    existing = _columns()
    if existing is None:
        # The table is made from the models at startup, so there is
        # nothing for this file to do here.
        return

    if "tax_total" not in existing:
        op.add_column(
            RECEIPTS,
            sa.Column("tax_total", sa.Numeric(20, 2), nullable=True),
        )


def downgrade():
    existing = _columns()
    if existing is not None and "tax_total" in existing:
        op.drop_column(RECEIPTS, "tax_total")
