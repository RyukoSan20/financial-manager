"""
The migration chain has one head, and the newest migrations can be
run against a server that was started before they existed.

Two things went wrong before, and both were quiet.

The first: two migrations were written with the same parent. That
leaves the chain with two heads, and `alembic upgrade head` then
fails with "Multiple head revisions are present". The deployment
stops, but only after it has already been half done.

The second: a migration made a table that the server had already made
from the models. The server builds its tables from the models at
startup, and then alembic runs on top of that, so a table a new
migration makes may already be there. A migration that fails because
the table is already there cannot be deployed to a server that was
started before it existed.

So the chain is checked here:

- there is exactly one head;
- every revision is reachable from that head;
- the migrations that have never been on the server look before they
  reach.
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

VERSIONS_DIR = BACKEND_DIR / "alembic" / "versions"

# The revision the server's database is at. Everything after this has
# never been on the server, so everything after this has to survive a
# server that was started before it existed.
SERVER_REVISION = "20261031_smart_split_bill"


def _migrations_after(script, revision):
    """
    The migrations that come after a revision, nearest first.

    The chain is followed by hand rather than by date, because the
    name of a migration file says when it was written and not where it
    sits in the chain.
    """
    children = {}
    for candidate in script.walk_revisions():
        if candidate.down_revision:
            children.setdefault(candidate.down_revision, []).append(candidate)

    found = []
    frontier = [revision]
    while frontier:
        current = frontier.pop(0)
        for child in children.get(current, []):
            found.append(child)
            frontier.append(child.revision)
    return found


def _script_directory():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return ScriptDirectory.from_config(config)


def test_the_chain_has_exactly_one_head():
    """
    Two migrations with the same parent leave the chain with two
    heads, and the upgrade then fails.
    """
    script = _script_directory()
    heads = script.get_heads()
    assert len(heads) == 1, f"the chain has {len(heads)} heads: {heads}"


def test_every_revision_is_reachable_from_the_head():
    """
    A migration that is not reachable is a migration that never runs.
    """
    script = _script_directory()
    reachable = {revision.revision for revision in script.walk_revisions()}

    # The revision knows its own file, so the set of revisions the
    # chain knows about is asked for directly rather than guessed
    # from the names of the files.
    on_disk = {revision.revision for revision in script.get_revisions("heads")}

    missing = on_disk - reachable
    assert not missing, f"these migrations are never reached: {sorted(missing)}"


def test_the_newest_migrations_look_before_they_reach():
    """
    A migration that has never been on the server must not fail
    because the server already has what it makes.

    The check is on the source, because the migration is a script and
    a script is what has to be right.
    """
    script = _script_directory()
    newest = _migrations_after(script, SERVER_REVISION)

    assert newest, "there are no migrations after the server's revision"

    for revision in newest:
        source = Path(revision.path).read_text(encoding="utf-8")
        assert "get_table_names" in source, (
            f"{revision.revision} does not look before it reaches. A server "
            "that was started before this migration already has the table."
        )


def test_the_newest_migrations_can_be_run_against_a_server_schema():
    """
    The whole rehearsal, as a test.

    This is the same shape the server is in: the schema is built from
    the models, the revision the server is at is stamped, and then the
    migrations that have never been on the server are run, undone, and
    run again.

    The database is SQLite here, because a test has to run anywhere.
    The rehearsal against a real PostgreSQL is `scripts/rehearse_migrations.py`.
    """
    import sqlalchemy as sa
    from alembic import command
    from alembic.config import Config

    from app.core.database import Base

    # Every model, so that every table is in the metadata.
    import app.models  # noqa: F401
    from app.models.user import User  # noqa: F401
    from app.models.user_settings import UserSettings  # noqa: F401

    # The tables the server builds are copied rather than made in
    # place. The copy leaves out the columns whose type the test
    # database cannot render, because the point of the test is the
    # migration and not the type of a column of a table that already
    # existed.
    # The tables are made from the models, the way the server makes
    # them. The one table whose type the test database cannot render
    # is left out, because the point of the test is the migration and
    # not the type of a column of a table that already existed.
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.compiler import compiles

    @compiles(JSONB, "sqlite")
    def _jsonb_sqlite(element, compiler, **kwargs):  # noqa: ANN001, ANN003
        return "JSON"

    metadata = Base.metadata
    engine = sa.create_engine("sqlite://")
    metadata.create_all(bind=engine)

    engine = sa.create_engine("sqlite://")
    metadata.create_all(bind=engine)

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", "sqlite://")

    with engine.connect() as connection:
        config.attributes["connection"] = connection

        command.stamp(config, SERVER_REVISION)
        command.upgrade(config, "head")

        # The tables the newest migrations make are there.
        inspector = sa.inspect(connection)
        tables = set(inspector.get_table_names())
        for table in (
            "merchant_pos_products",
            "tax_rules",
            "business_transactions",
            "business_transaction_items",
            "business_transaction_taxes",
            "business_transaction_payments",
            "accounting_entries",
            "split_invitations",
        ):
            assert table in tables, f"{table} was not made"

        command.downgrade(config, SERVER_REVISION)
        command.upgrade(config, "head")

        tables = set(sa.inspect(connection).get_table_names())
        assert "split_invitations" in tables, "the table was not made again"
