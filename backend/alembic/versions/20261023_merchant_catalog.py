"""Merchant catalogue and user products migration

Creates the catalogue of shops the user spends money at, and the list of
products they buy. Both are created automatically by the receipt scanner
so a shop or a product the user has never seen before is stored instead of
discarded.

Revision ID: 20261023_merchant_catalog
Revises: 20261021_user_settings
Create Date: 2026-10-23
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '20261023_merchant_catalog'
down_revision = '20261021_user_settings'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'merchant_catalog',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('normalized_name', sa.String(length=255), nullable=True),
        sa.Column('merchant_type', sa.String(length=50), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('scan_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('total_spent', sa.Numeric(precision=20, scale=2), nullable=True, server_default='0'),
        sa.Column('last_seen_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_merchant_catalog_user_id', 'merchant_catalog', ['user_id'])
    op.create_index('ix_merchant_catalog_normalized_name', 'merchant_catalog', ['normalized_name'])
    op.create_index('ix_merchant_catalog_user_name', 'merchant_catalog', ['user_id', 'normalized_name'])

    op.create_table(
        'user_products',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('normalized_name', sa.String(length=255), nullable=True),
        sa.Column('canonical_name', sa.String(length=255), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('typical_price', sa.Numeric(precision=20, scale=2), nullable=True),
        sa.Column('min_price', sa.Numeric(precision=20, scale=2), nullable=True),
        sa.Column('max_price', sa.Numeric(precision=20, scale=2), nullable=True),
        sa.Column('purchase_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('last_seen_at', sa.DateTime(), nullable=True),
        sa.Column('catalog_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['catalog_id'], ['product_catalog.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_products_user_id', 'user_products', ['user_id'])
    op.create_index('ix_user_products_normalized_name', 'user_products', ['normalized_name'])
    op.create_index('ix_user_products_user_name', 'user_products', ['user_id', 'normalized_name'])


def downgrade():
    op.drop_index('ix_user_products_user_name', table_name='user_products')
    op.drop_index('ix_user_products_normalized_name', table_name='user_products')
    op.drop_index('ix_user_products_user_id', table_name='user_products')
    op.drop_table('user_products')

    op.drop_index('ix_merchant_catalog_user_name', table_name='merchant_catalog')
    op.drop_index('ix_merchant_catalog_normalized_name', table_name='merchant_catalog')
    op.drop_index('ix_merchant_catalog_user_id', table_name='merchant_catalog')
    op.drop_table('merchant_catalog')
