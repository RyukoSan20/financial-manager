"""
Which kind of shop this is.

A warung, a freelance studio, and a company that sells across borders
are three different jobs that share the same tables. The difference is
not in the tables. It is in which questions the person at the counter
has to answer.

So the shop keeps the name of its mode, and a place to keep the
settings that only make sense in one of them.

The mode has a default of warung. A shop that has not said what it
is, is treated as a warung, because the warung is the mode that asks
for the least. If we are wrong about which mode this is, we have asked
for too little rather than too much.

The server builds its tables from the models at startup, and then
alembic runs on top of that. So the columns this migration adds may
already be there, made by the models rather than by this file. The
migration therefore looks before it reaches, and only adds what is
missing.

Revision ID: 20261103_business_profile
Revises: 20261102_shopping_item_images
Create Date: 2026-11-03
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20261103_business_profile"
down_revision = "20261102_shopping_item_images"
branch_labels = None
depends_on = None


MERCHANTS = "merchants"
SETTINGS = "merchant_business_profiles"


def _columns(table):
    """The columns a table has now."""
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return None
    return {column["name"] for column in inspector.get_columns(table)}


def _tables():
    from sqlalchemy import inspect

    return set(inspect(op.get_bind()).get_table_names())


def upgrade():
    # --- the mode the shop runs in ---------------------------------------
    existing = _columns(MERCHANTS)
    if existing is not None and "business_profile" not in existing:
        op.add_column(
            MERCHANTS,
            sa.Column(
                "business_profile",
                sa.String(length=30),
                nullable=False,
                server_default="UMKM",
            ),
        )

    # --- the settings that only one mode has ----------------------------
    if SETTINGS in _tables():
        return

    op.create_table(
        SETTINGS,
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "merchant_id",
            sa.Integer,
            sa.ForeignKey(f"{MERCHANTS}.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        # --- invoicing ---------------------------------------------------
        sa.Column("invoice_prefix", sa.String(length=20), nullable=True),
        sa.Column("payment_terms_days", sa.Integer, nullable=True),
        sa.Column("default_invoice_type", sa.String(length=30), nullable=True),
        # --- cross-border ------------------------------------------------
        sa.Column("transaction_currency", sa.String(length=3), nullable=True),
        sa.Column("functional_currency", sa.String(length=3), nullable=True),
        sa.Column("settlement_currency", sa.String(length=3), nullable=True),
        sa.Column("default_exchange_rate", sa.Numeric(20, 6), nullable=True),
        sa.Column("exchange_rate_source", sa.String(length=50), nullable=True),
        sa.Column("seller_country", sa.String(length=2), nullable=True),
        sa.Column("default_tax_region", sa.String(length=30), nullable=True),
        # --- the journal -------------------------------------------------
        sa.Column("revenue_account_code", sa.String(length=50), nullable=True),
        sa.Column("cogs_account_code", sa.String(length=50), nullable=True),
        sa.Column("tax_payable_account_code", sa.String(length=50), nullable=True),
        sa.Column("withholding_account_code", sa.String(length=50), nullable=True),
        sa.Column("receivable_account_code", sa.String(length=50), nullable=True),
        sa.Column(
            "auto_post_journal",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )


def downgrade():
    tables = _tables()
    if SETTINGS in tables:
        op.drop_table(SETTINGS)

    # An index on the column has to go before the column does. A
    # database that is asked to drop a column that an index still
    # stands on will refuse.
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    if MERCHANTS in inspector.get_table_names():
        for index in inspector.get_indexes(MERCHANTS):
            if index.get("column_names") == ["business_profile"]:
                op.drop_index(index["name"], table_name=MERCHANTS)

    existing = _columns(MERCHANTS)
    if existing is not None and "business_profile" in existing:
        op.drop_column(MERCHANTS, "business_profile")
