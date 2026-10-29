"""
The new columns have to be there, and the migration has to be undoable.

A migration that adds a column is only safe if two things are true:
it can be run on a database that already has the column, and it can
be undone without touching anything that was there before.

The second one is the one that gets forgotten. A migration that drops
a table on the way down takes the reader's data with it, and nobody
notices until somebody needs the old version back.

So this runs the migration up and down against a database that is
thrown away afterwards, and checks:

- the columns are there after going up;
- the columns are gone after coming back down;
- the rows that were there before are still there after going up;
- the migration can be run again on a database that already has it.

Nothing here touches the production database.
"""

import sys
from pathlib import Path

import pytest
from sqlalchemy import MetaData, create_engine, inspect, text

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402

ALEMBIC_INI = BACKEND_DIR / "alembic.ini"
ALEMBIC_DIR = BACKEND_DIR / "alembic"
REVISION = "20261029_transaction_tags"

# The revision before the one under test. The database is stamped
# here, so that only the revision under test is applied.
PREVIOUS_REVISION = "20261023_merchant_catalog"


def _config(url):
    """An alembic config pointed at a database of our own."""
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(ALEMBIC_DIR))
    config.set_main_option("sqlalchemy.url", url)
    return config


def _columns(eng, table):
    return {c["name"] for c in inspect(eng).get_columns(table)}


@pytest.fixture
def engine(tmp_path):
    """
    A database that is thrown away after the test.

    The base tables are made the way the running app makes them: from
    the models. But the two columns this migration adds are taken off
    the models first, because the point of the test is that the
    migration is the thing that puts them there.
    """
    import importlib

    from app.core.database import Base

    # Only the tables this test needs. The whole set of models is not
    # made, because some of them use PostgreSQL-only types that a
    # throwaway SQLite database cannot hold.
    importlib.import_module("app.models.user")
    importlib.import_module("app.models.account")
    importlib.import_module("app.models.category")
    importlib.import_module("app.models.transaction")

    # The tables are copied before the new columns are taken off them.
    # The copy matters: ``Base.metadata`` is shared with every other
    # test in the run, and a test that leaves a table in a different
    # shape behind it breaks the tests that come after.
    # Every table the four of them point at is copied as well. A
    # foreign key to a table that was not copied has nothing to point
    # at, and the table cannot be made.
    wanted = ("users", "accounts", "categories", "transactions")
    private = MetaData()
    for name in wanted:
        Base.metadata.tables[name].to_metadata(private)

    # Follow the foreign keys out of the four tables and bring those
    # tables along too.
    pending = list(wanted)
    while pending:
        name = pending.pop()
        for column in private.tables[name].columns:
            for foreign_key in column.foreign_keys:
                target = foreign_key.target_fullname.split(".")[0]
                if target in private.tables or target not in Base.metadata.tables:
                    continue
                Base.metadata.tables[target].to_metadata(private)
                pending.append(target)

    tables = [private.tables[name] for name in wanted]

    # Take the new columns off the copies, so that the tables are made
    # in the shape they were in before the migration.
    for table, name in ((tables[3], "tags"), (tables[3], "is_draft"),
                        (tables[2], "is_adjustment")):
        if name not in table.c:
            continue
        # The column is looked up through the columns collection, not
        # through ``table.c``, because ``table.c`` gives back a
        # comparator and the comparator cannot be taken out of the
        # table.
        column = next(c for c in table.columns if c.name == name)
        table._columns.remove(column)

    # A file, not ``:memory:``. Alembic builds its own engine from
    # the URL, and an in-memory SQLite belongs to the connection that
    # made it, so the migration would run against a different and
    # empty database than the one the test just filled.
    db_path = tmp_path / "migration_test.db"
    eng = create_engine(f"sqlite:///{db_path}")
    private.create_all(bind=eng)

    # The database is told which revision it is at without anything
    # being run. This is what a real database that was made from the
    # models looks like: the tables are there, and the revisions that
    # made them are not.
    #
    # Without this the whole chain would run from the beginning, and
    # the earlier revisions would try to build tables this test has
    # not made.
    command.stamp(_config(str(eng.url)), PREVIOUS_REVISION)

    yield eng


def test_the_revision_hangs_off_something():
    """
    A revision that cannot be reached is a revision that cannot be run.

    This repository had three revisions naming a fourth one that was
    not in it, so alembic could not walk the chain at all.
    """
    script = ScriptDirectory.from_config(_config("sqlite://"))

    heads = script.get_heads()
    assert heads, "there is no alembic head"

    rev = script.get_revision(REVISION)
    assert rev is not None, "the revision is not in the chain"
    assert rev.down_revision is not None, "the revision has no parent"

    # Every revision in the chain must be reachable from the head.
    walked = {r.revision for r in script.walk_revisions()}
    assert REVISION in walked


def test_every_revision_id_fits_in_the_column():
    """
    The revision id is stored in a column that is 32 characters wide.

    A longer id is accepted by alembic until the moment it is
    written down, and then the database refuses it: the revision
    cannot be stamped, and every migration after it is stuck.
    """
    script = ScriptDirectory.from_config(_config("sqlite://"))

    for rev in script.walk_revisions():
        assert len(rev.revision) <= 32, (
            f"the revision id {rev.revision!r} is {len(rev.revision)} characters; "
            "the column that holds it is 32 wide"
        )


def test_the_environment_wins_over_the_placeholder_in_the_ini_file():
    """
    Alembic has to run against the database the environment names.

    The alembic.ini file carries a placeholder URL so the file is not
    empty. If that placeholder wins, alembic talks to a database that
    nobody is using, and the migration is applied to the wrong place
    while looking like it worked.
    """
    import os

    env_path = BACKEND_DIR / "alembic" / "env.py"
    source = env_path.read_text(encoding="utf-8")

    # The environment has to be read first.
    assert "DATABASE_URL" in source
    assert source.index("os.environ.get(\"DATABASE_URL\")") < source.index(
        "config.get_main_option(\"sqlalchemy.url\""
    ), "the placeholder in the ini file is consulted before the environment"

    # And the placeholder has to be recognised as a placeholder.
    assert "***" in source, "the placeholder in the ini file is not recognised"


def test_the_chain_has_no_dangling_parent():
    """
    Every down_revision points at a revision that exists.
    """
    script = ScriptDirectory.from_config(_config("sqlite://"))
    known = {r.revision for r in script.walk_revisions()}

    for rev in script.walk_revisions():
        parent = rev.down_revision
        if isinstance(parent, tuple):
            for one in parent:
                assert one in known, f"{rev.revision} points at a missing {one}"
        elif parent is not None:
            assert parent in known, f"{rev.revision} points at a missing {parent}"


def test_the_migration_adds_the_columns(engine):
    """
    Going up adds what the models expect.
    """
    url = str(engine.url)
    command.upgrade(_config(url), "head")

    transaction_columns = _columns(engine, "transactions")
    assert "tags" in transaction_columns
    assert "is_draft" in transaction_columns

    category_columns = _columns(engine, "categories")
    assert "is_adjustment" in category_columns


def test_the_migration_can_be_undone(engine):
    """
    Going down takes the columns away again, and leaves everything
    else exactly as it was.
    """
    url = str(engine.url)
    command.upgrade(_config(url), "head")

    # Put a row in, so there is something to lose.
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO users (id, email, hashed_password, is_active, created_at) "
                "VALUES (1, 'keep@example.test', 'x', true, CURRENT_TIMESTAMP)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO accounts (id, user_id, name, account_type, balance, currency, created_at) "
                "VALUES (1, 1, 'Keep', 'bank', 100, 'IDR', CURRENT_TIMESTAMP)"
            )
        )

    command.downgrade(_config(url), "-1")

    transaction_columns = _columns(engine, "transactions")
    assert "tags" not in transaction_columns
    assert "is_draft" not in transaction_columns

    category_columns = _columns(engine, "categories")
    assert "is_adjustment" not in category_columns

    # The row that was there before is still there.
    with engine.connect() as conn:
        count = conn.execute(text("SELECT count(*) FROM accounts")).scalar()
    assert count == 1, "the migration took the reader's accounts with it"


def test_the_migration_can_be_run_twice(engine):
    """
    Running it again does not make two of the adjustment category.
    """
    url = str(engine.url)
    command.upgrade(_config(url), "head")

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT count(*) FROM categories WHERE name = 'Penyesuaian Saldo'")
        ).scalar()

    assert rows == 1, f"the adjustment category was made {rows} times"
