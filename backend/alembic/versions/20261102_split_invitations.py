"""
Invitations to a shared bill, sent by email.

This makes the table that holds an invitation: the group it is for,
who it was written for, the hash of the token, the status and the
time it runs out.

The token itself is not stored. What is stored is its hash, so a copy
of the database does not give away an invitation.

The server builds its tables from the models at startup, and then
alembic runs on top of that. So a table this migration makes may
already be there, made by the models rather than by this file. The
migration therefore looks before it reaches, and only makes what is
missing. A migration that fails because the table is already there is
a migration that cannot be deployed to a server that was started
before it existed.

Revision ID: 20261102_split_invitations
Revises: 20261102_multi_jurisdiction_tax
Create Date: 2026-11-02
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20261102_split_invitations"
down_revision = "20261102_multi_jurisdiction_tax"
branch_labels = None
depends_on = None


TABLE = "split_invitations"

# The indexes, with the columns they are on. The unique one is marked,
# because it is the only one that is not allowed to be made twice.
INDEXES = (
    ("ix_split_invitations_id", ("id",), False),
    ("ix_split_invitations_group_id", ("group_id",), False),
    ("ix_split_invitations_invited_by", ("invited_by",), False),
    ("ix_split_invitations_email", ("email",), False),
    ("ix_split_invitations_status", ("status",), False),
    ("ix_split_invitations_token_hash", ("token_hash",), True),
    ("ix_split_invitations_member_id", ("member_id",), False),
    ("ix_split_invitations_expires_at", ("expires_at",), False),
    ("ix_split_invitations_group_email", ("group_id", "email"), False),
)


def _tables():
    """The tables that are there now."""
    from sqlalchemy import inspect

    return set(inspect(op.get_bind()).get_table_names())


def _indexes():
    """The indexes that are there now."""
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    if TABLE not in inspector.get_table_names():
        return set()
    return {index["name"] for index in inspector.get_indexes(TABLE)}


def upgrade():
    tables = _tables()

    if TABLE not in tables:
        op.create_table(
            TABLE,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("group_id", sa.Integer(), nullable=False),
            sa.Column("invited_by", sa.Integer(), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("role", sa.String(length=20), nullable=False, server_default="MEMBER"),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="INVITED"),
            sa.Column("token_hash", sa.String(length=128), nullable=False),
            sa.Column("member_id", sa.Integer(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("joined_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["group_id"], ["split_groups.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["member_id"], ["split_members.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    # An index that is already there is left alone. Making it again
    # is an error, and an error in a migration stops the deployment.
    existing = _indexes()
    for name, columns, unique in INDEXES:
        if name in existing:
            continue
        op.create_index(name, TABLE, list(columns), unique=unique)


def downgrade():
    # The indexes go first. An index that points at a column that is
    # not there cannot be made, and the column cannot be taken away
    # while an index is standing on it.
    existing = _indexes()
    for name, _columns, _unique in reversed(INDEXES):
        if name not in existing:
            continue
        op.drop_index(name, table_name=TABLE)

    if TABLE in _tables():
        op.drop_table(TABLE)
