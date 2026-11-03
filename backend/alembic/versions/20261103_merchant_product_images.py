"""
A place to keep the picture of a thing for sale.

The photograph was taken and handed back with an address, and the
product had nowhere to put it. So a photograph that was uploaded was
a photograph that was thrown away, and the shelf of goods looked the
same whether the goods had been photographed or not.

The column is added only when it is missing, because the server
builds its tables from the models at startup and then alembic runs on
top of that. The column may already be there.

Revision ID: 20261103_merchant_product_images
Revises: 20261103_business_profile
Create Date: 2026-11-03
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20261103_merchant_product_images"
down_revision = "20261103_business_profile"
branch_labels = None
depends_on = None


PRODUCTS = "merchant_products"


def _columns():
    """The columns the table of goods has now."""
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    if PRODUCTS not in inspector.get_table_names():
        return None
    return {column["name"] for column in inspector.get_columns(PRODUCTS)}


def upgrade():
    existing = _columns()
    if existing is None:
        # The table is made from the models at startup, so there is
        # nothing for this file to do here.
        return

    if "image_url" not in existing:
        op.add_column(
            PRODUCTS,
            sa.Column("image_url", sa.String(length=500), nullable=True),
        )


def downgrade():
    existing = _columns()
    if existing is not None and "image_url" in existing:
        op.drop_column(PRODUCTS, "image_url")
