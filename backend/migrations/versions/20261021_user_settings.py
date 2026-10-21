"""User Settings Migration

Creates user_settings (1:1 with users) and support_requests tables.

Revision ID: 20261021_user_settings
Revises: 20261020_shopping_pipeline
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '20261021_user_settings'
down_revision = '20261020_shopping_pipeline'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'user_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('theme', sa.String(20), nullable=False, server_default='light'),
        sa.Column('language', sa.String(10), nullable=False, server_default='id'),
        sa.Column('currency', sa.String(10), nullable=False, server_default='IDR'),
        sa.Column('date_format', sa.String(20), nullable=False, server_default='DD/MM/YYYY'),
        sa.Column('start_of_week', sa.String(10), nullable=False, server_default='monday'),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='Asia/Jakarta'),
        sa.Column('auto_backup', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('biometric_login', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('email_notifications', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('push_notifications', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('transaction_alerts', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('budget_alerts', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('weekly_summary', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('monthly_summary', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('reminder_frequency', sa.String(10), nullable=False, server_default='weekly'),
        sa.Column('reminder_days_before', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_settings_user_id', 'user_settings', ['user_id'], unique=True)

    op.create_table(
        'support_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('subject', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('response', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_support_requests_user_id', 'support_requests', ['user_id'])


def downgrade():
    op.drop_index('ix_support_requests_user_id', table_name='support_requests')
    op.drop_table('support_requests')
    op.drop_index('ix_user_settings_user_id', table_name='user_settings')
    op.drop_table('user_settings')
