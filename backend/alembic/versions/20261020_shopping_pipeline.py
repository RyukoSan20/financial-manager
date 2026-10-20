"""Shopping Pipeline Migration - Kanban Board

Creates new shopping_items_new table with kanban stages.
Creates wishlist_items table.

Revision ID: 20261020_shopping_pipeline
Revises: 6b5c4ef16180
Create Date: 2026-10-20
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '20261020_shopping_pipeline'
down_revision = '003_category_hints_unique_index'
branch_labels = None
depends_on = None


def upgrade():
    # Create shopping_items_new table
    op.create_table(
        'shopping_items_new',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Integer(), default=1),
        sa.Column('price', sa.Integer(), nullable=True),
        sa.Column('stage', sa.String(20), default='wishlist'),
        sa.Column('position', sa.Integer(), default=0),
        sa.Column('marketplace', sa.String(50), nullable=True),
        sa.Column('product_url', sa.String(500), nullable=True),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=True),
        sa.Column('tracking_number', sa.String(64), nullable=True),
        sa.Column('courier', sa.String(32), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('purchased_at', sa.DateTime(), nullable=True),
        sa.Column('received_at', sa.DateTime(), nullable=True),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Indexes
    op.create_index('ix_shopping_user_stage', 'shopping_items_new', ['user_id', 'stage'])
    op.create_index('ix_shopping_user_position', 'shopping_items_new', ['user_id', 'position'])
    op.create_index('ix_shopping_transaction', 'shopping_items_new', ['transaction_id'])
    
    # Create wishlist_items table
    op.create_table(
        'wishlist_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('target_price', sa.Integer(), nullable=True),
        sa.Column('marketplace', sa.String(50), nullable=True),
        sa.Column('search_url', sa.String(500), nullable=True),
        sa.Column('priority', sa.String(20), default='medium'),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('shopping_item_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('ix_wishlist_user', 'wishlist_items', ['user_id'])


def downgrade():
    op.drop_table('wishlist_items')
    op.drop_table('shopping_items_new')
