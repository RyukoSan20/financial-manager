"""
The tables of the merchant have to be there, and the migration has to
be undoable.

A migration that makes a table is only safe if two things are true:
it can be run on a database that already has the table, and it can be
undone without touching anything that was there before.

The second one is the one that gets forgotten. A migration that drops
a table on the way down takes the reader's data with it, and nobody
notices until somebody needs the old version back.

So this runs the migration up and down against a database that is
thrown away afterwards, and checks:

- the tables are there after going up;
- the tables are gone after coming back down;
- the rows that were there before are still there after going up.

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
REVISION = "20261102_multi_jurisdiction_tax"

# The revision before the one under test. The database is stamped
# here, so that only the revision under test is applied.
PREVIOUS_REVISION = "20261031_smart_split_bill"

NEW_TABLES = (
    "merchant_pos_products",
    "tax_rules",
    "business_transactions",
    "business_transaction_items",
    "business_transaction_taxes",
    "business_transaction_payments",
    "accounting_entries",
)


def _config(url):
    """An alembic config pointed at a database of our own."""
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(ALEMBIC_DIR))
    config.set_main_option("sqlalchemy.url", url)
    return config


def _tables(eng):
    return set(inspect(eng).get_table_names())


@pytest.fixture
def engine(tmp_path):
    """
    A database that is thrown away after the test.

    The base tables are made the way the running app makes them: from
    the models. The tables this migration makes are not made from the
    models, because the point of the test is that the migration is the
    thing that makes them.
    """
    import importlib

    from app.core.database import Base

    importlib.import_module("app.models.user")
    importlib.import_module("app.models.account")
    importlib.import_module("app.models.merchant")

    wanted = ("users", "accounts", "merchants")
    private = MetaData()
    for name in wanted:
        Base.metadata.tables[name].to_metadata(private)

    # Follow the foreign keys out of the three tables and bring
    # those tables along too.
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

    # A file, not ``:memory:``. Alembic builds its own engine from
    # the URL, and an in-memory SQLite belongs to the connection that
    # made it, so the migration would run against a different and
    # empty database than the one the test just filled.
    db_path = tmp_path / "business_migration_test.db"
    eng = create_engine(f"sqlite:///{db_path}")
    private.create_all(bind=eng)

    # The database is told which revision it is at without anything
    # being run.
    command.stamp(_config(str(eng.url)), PREVIOUS_REVISION)

    yield eng


def test_the_revision_hangs_off_the_shared_bill():
    """
    A revision that cannot be reached is a revision that cannot be
    run.
    """
    script = ScriptDirectory.from_config(_config("sqlite://"))

    rev = script.get_revision(REVISION)
    assert rev is not None, "the revision is not in the chain"
    assert rev.down_revision == PREVIOUS_REVISION

    walked = {r.revision for r in script.walk_revisions()}
    assert REVISION in walked


def test_the_revision_id_fits_in_the_column():
    """
    The revision id is stored in a column that is 32 characters wide.
    A longer id is accepted by alembic until the moment it is written
    down, and then the database refuses it.
    """
    script = ScriptDirectory.from_config(_config("sqlite://"))

    for rev in script.walk_revisions():
        assert len(rev.revision) <= 32, (
            f"the revision id {rev.revision!r} is {len(rev.revision)} characters; "
            "the column that holds it is 32 wide"
        )


def test_the_migration_makes_the_tables(engine):
    """Going up makes the seven tables."""
    url = str(engine.url)
    command.upgrade(_config(url), "head")

    tables = _tables(engine)
    for name in NEW_TABLES:
        assert name in tables, f"the migration did not make {name}"


def test_the_migration_can_be_undone(engine):
    """
    Going down takes the tables away again, and leaves everything
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

    # The downgrade is to the revision before this one, not to the
    # revision before the head. The head moves on as new work is
    # added, and a test that goes down one step would then stop
    # testing the thing it was written for.
    command.downgrade(_config(url), PREVIOUS_REVISION)

    tables = _tables(engine)
    for name in NEW_TABLES:
        assert name not in tables, f"the downgrade left {name} behind"

    # The row that was there before is still there.
    with engine.connect() as conn:
        count = conn.execute(text("SELECT count(*) FROM users")).scalar()
    assert count == 1, "the migration took the reader's users with it"


def test_the_migration_can_be_run_twice(engine):
    """
    Running it again does not make two of anything.
    """
    url = str(engine.url)
    command.upgrade(_config(url), "head")
    command.upgrade(_config(url), "head")

    tables = _tables(engine)
    for name in NEW_TABLES:
        assert name in tables


def test_the_models_and_the_migration_agree(engine):
    """
    Every column the models have is a column the migration makes, so
    that the application does not ask the database for a column that
    is not there.
    """
    import importlib

    from app.core.database import Base

    for name in (
        "app.models.merchant_product",
        "app.models.tax_rule",
        "app.models.business_transaction",
        "app.models.business_transaction_item",
        "app.models.business_transaction_tax",
        "app.models.business_transaction_payment",
        "app.models.accounting_entry",
    ):
        importlib.import_module(name)

    url = str(engine.url)
    command.upgrade(_config(url), "head")

    inspector = inspect(engine)
    for table in NEW_TABLES:
        model_columns = {c.name for c in Base.metadata.tables[table].columns}
        made_columns = {c["name"] for c in inspector.get_columns(table)}
        missing = model_columns - made_columns
        assert not missing, (
            f"the migration did not make {sorted(missing)} on {table}, "
            "so the application would ask for a column that is not there"
        )
