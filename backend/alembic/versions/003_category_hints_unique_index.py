"""
The category hints table, and the index that keeps it unique.

Revision ID: 003_category_hints_unique_index
Revises: 6b5c4ef16180
Create Date: 2026-10-21

This revision was missing from the repository while three later
revisions referred to it by name. Alembic could not walk the chain
past it, so ``alembic upgrade head`` did not run at all: the whole
migration history was one broken link away from being unusable.

The table it creates is the one the model describes: a word the reader
has used, and the category it belongs to, so that the next receipt
from the same shop is read on its own.

The unique index on ``(user_id, token)`` is what makes the hint a
single row rather than a pile of them. A reader cannot have two
different categories for the same word.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "003_category_hints_unique_index"
down_revision = "6b5c4ef16180"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "category_hints",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("token", sa.String(length=100), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("hits", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_used", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "idx_category_hints_user_token",
        "category_hints",
        ["user_id", "token"],
        unique=True,
    )
    op.create_index("ix_category_hints_user_id", "category_hints", ["user_id"])


def downgrade():
    op.drop_index("ix_category_hints_user_id", table_name="category_hints")
    op.drop_index("idx_category_hints_user_token", table_name="category_hints")
    op.drop_table("category_hints")
