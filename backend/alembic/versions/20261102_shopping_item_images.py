"""
The picture of a shopping item, and where its price came from.

A shopping list is a list of things the reader is thinking about
buying, and a list of names is much harder to recognise than a list of
pictures. So the item keeps the address of a picture.

The source of the price is kept beside it. A price that came from a
live search and a price that came from the reader's own catalogue are
not the same kind of number, and the screen has to be able to say
which one it is showing. The two are kept apart so that the screen
never presents a reference price as though it were a price in a shop.

The server builds its tables from the models at startup, and then
alembic runs on top of that. So the column this migration adds may
already be there, made by the models rather than by this file. The
migration therefore looks before it reaches, and only adds what is
missing. A migration that fails because the column is already there
is a migration that cannot be deployed to a server that was started
before it existed.

Revision ID: 20261102_shopping_item_images
Revises: 20261102_split_invitations
Create Date: 2026-11-02
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20261102_shopping_item_images"
down_revision = "20261102_split_invitations"
branch_labels = None
depends_on = None


TABLE = "shopping_items_new"

# The columns this migration adds, with their type.
COLUMNS = (
    ("image_url", sa.String(length=500)),
    ("price_source", sa.String(length=30)),
)


def _columns():
    """The columns the table has now."""
    from sqlalchemy import inspect

    inspector = inspect(op.get_bind())
    if TABLE not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(TABLE)}


def upgrade():
    existing = _columns()
    if not existing:
        # The table itself is not there, which means the server has
        # not been started with the models that make it. There is
        # nothing to add to, and the migration that makes the table
        # will.
        return

    for name, column_type in COLUMNS:
        if name in existing:
            continue
        op.add_column(TABLE, sa.Column(name, column_type, nullable=True))


def downgrade():
    existing = _columns()
    for name, _column_type in reversed(COLUMNS):
        if name not in existing:
            continue
        op.drop_column(TABLE, name)
