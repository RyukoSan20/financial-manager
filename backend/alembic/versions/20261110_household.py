"""
The household's tables.

A household shares a calendar, chores, a shopping list, notes, and
the targets somebody chose to show. Each of those is a table that
hangs off ``households``.

Each table is created only when it is missing, so running this twice
changes nothing, and running it on a server whose startup already
made the tables does nothing.

Revision ID: 20261110_household
Revises: 20261108_breakdown_items
Create Date: 2026-11-10
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20261110_household"
down_revision = "20261108_breakdown_items"
branch_labels = None
depends_on = None


def _household_fk():
    return sa.Column(
        "household_id",
        sa.Integer(),
        sa.ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )


def _tables():
    """The tables, in the order they have to be made."""
    return [
        (
            "households",
            [
                sa.Column("id", sa.Integer(), primary_key=True),
                sa.Column(
                    "owner_id",
                    sa.Integer(),
                    sa.ForeignKey("users.id", ondelete="CASCADE"),
                    nullable=False,
                ),
                sa.Column("name", sa.String(length=120), nullable=False),
                sa.Column("mode", sa.String(length=20), nullable=False, server_default="family"),
                sa.Column("invite_code", sa.String(length=8), nullable=False),
                sa.Column("created_at", sa.DateTime(), nullable=True),
                sa.Column("updated_at", sa.DateTime(), nullable=True),
            ],
            [("ix_households_id", ["id"], False),
             ("ix_households_owner_id", ["owner_id"], False),
             ("ix_households_invite_code", ["invite_code"], True)],
        ),
        (
            "household_members",
            [
                sa.Column("id", sa.Integer(), primary_key=True),
                _household_fk(),
                sa.Column(
                    "user_id",
                    sa.Integer(),
                    sa.ForeignKey("users.id", ondelete="CASCADE"),
                    nullable=True,
                ),
                sa.Column("name", sa.String(length=100), nullable=False),
                sa.Column("email", sa.String(length=255), nullable=True),
                sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
                sa.Column("avatar", sa.String(length=40), nullable=False, server_default="avatar-default"),
                sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
                sa.Column("joined_at", sa.DateTime(), nullable=True),
                sa.Column("last_active_at", sa.DateTime(), nullable=True),
            ],
            [("ix_household_members_id", ["id"], False),
             ("ix_household_members_household_id", ["household_id"], False),
             ("ix_household_members_user_id", ["user_id"], False)],
        ),
        (
            "household_agendas",
            [
                sa.Column("id", sa.Integer(), primary_key=True),
                _household_fk(),
                sa.Column("title", sa.String(length=200), nullable=False),
                sa.Column("date", sa.Date(), nullable=False),
                sa.Column("time", sa.String(length=20), nullable=True),
                sa.Column("location", sa.String(length=200), nullable=True),
                sa.Column("kind", sa.String(length=20), nullable=False, server_default="meeting"),
                sa.Column("status", sa.String(length=20), nullable=False, server_default="upcoming"),
                sa.Column("created_by", sa.String(length=100), nullable=True),
                sa.Column("created_at", sa.DateTime(), nullable=True),
            ],
            [("ix_household_agendas_id", ["id"], False),
             ("ix_household_agendas_household_id", ["household_id"], False)],
        ),
        (
            "household_tasks",
            [
                sa.Column("id", sa.Integer(), primary_key=True),
                _household_fk(),
                sa.Column("title", sa.String(length=200), nullable=False),
                sa.Column("assignee", sa.String(length=100), nullable=True),
                sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
                sa.Column("reward_points", sa.Integer(), nullable=False, server_default="10"),
                sa.Column("completed_at", sa.DateTime(), nullable=True),
                sa.Column("created_at", sa.DateTime(), nullable=True),
            ],
            [("ix_household_tasks_id", ["id"], False),
             ("ix_household_tasks_household_id", ["household_id"], False)],
        ),
        (
            "household_needs",
            [
                sa.Column("id", sa.Integer(), primary_key=True),
                _household_fk(),
                sa.Column("title", sa.String(length=200), nullable=False),
                sa.Column("estimated_price", sa.Numeric(20, 2), nullable=False, server_default="0"),
                sa.Column("assignee", sa.String(length=100), nullable=True),
                sa.Column("purchased", sa.Boolean(), nullable=False, server_default=sa.false()),
                sa.Column("transaction_id", sa.Integer(), nullable=True),
                sa.Column("wishlist_item_id", sa.Integer(), nullable=True),
                sa.Column("purchased_at", sa.DateTime(), nullable=True),
                sa.Column("created_at", sa.DateTime(), nullable=True),
            ],
            [("ix_household_needs_id", ["id"], False),
             ("ix_household_needs_household_id", ["household_id"], False)],
        ),
        (
            "household_notes",
            [
                sa.Column("id", sa.Integer(), primary_key=True),
                _household_fk(),
                sa.Column("author", sa.String(length=100), nullable=True),
                sa.Column("body", sa.Text(), nullable=False),
                sa.Column("color", sa.String(length=20), nullable=False, server_default="lemon"),
                sa.Column("created_at", sa.DateTime(), nullable=True),
            ],
            [("ix_household_notes_id", ["id"], False),
             ("ix_household_notes_household_id", ["household_id"], False)],
        ),
        (
            "household_goal_links",
            [
                sa.Column("id", sa.Integer(), primary_key=True),
                _household_fk(),
                sa.Column(
                    "goal_id",
                    sa.Integer(),
                    sa.ForeignKey("goals.id", ondelete="CASCADE"),
                    nullable=False,
                ),
                sa.Column("shared_by", sa.String(length=100), nullable=True),
                sa.Column("created_at", sa.DateTime(), nullable=True),
            ],
            [("ix_household_goal_links_id", ["id"], False),
             ("ix_household_goal_links_household_id", ["household_id"], False),
             ("ix_household_goal_links_goal_id", ["goal_id"], False)],
        ),
        (
            "household_activities",
            [
                sa.Column("id", sa.Integer(), primary_key=True),
                _household_fk(),
                sa.Column("actor", sa.String(length=100), nullable=True),
                sa.Column("action", sa.String(length=40), nullable=False),
                sa.Column("detail", sa.String(length=255), nullable=True),
                sa.Column("created_at", sa.DateTime(), nullable=True),
            ],
            [("ix_household_activities_id", ["id"], False),
             ("ix_household_activities_household_id", ["household_id"], False),
             ("ix_household_activities_created_at", ["created_at"], False)],
        ),
    ]


def upgrade():
    from sqlalchemy import inspect

    existing = set(inspect(op.get_bind()).get_table_names())

    for name, columns, indexes in _tables():
        if name in existing:
            continue
        op.create_table(name, *columns)
        for index_name, index_columns, unique in indexes:
            op.create_index(index_name, name, index_columns, unique=unique)


def downgrade():
    # What a household wrote down is its own. Dropping the tables
    # throws it away, so the downgrade leaves them alone.
    pass
