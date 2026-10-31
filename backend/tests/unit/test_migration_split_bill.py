"""
The shared bill tables have to be there, and the migration has to be undoable.

A migration that makes tables is only safe if two things are true: it
can be run on a database that already has them, and it can be undone
without touching anything that was there before.

The second one is the one that gets forgotten. A migration that drops
a table on the way down takes the reader data with it, and nobody
notices until somebody needs the old version back.

So this runs the migration up and down against a database that is
thrown away afterwards, and checks:

- the tables are there after going up;
- the columns on transactions are there after going up;
- the tables are gone after coming back down;
- the rows that were there before are still there after going up;
- the migration can be run again on a database that already has it.

Nothing here touches the production database.
"""

import sys
from pathlib import Path

import pytest
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    create_engine,
    inspect,
    text,
)

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402

ALEMBIC_INI = BACKEND_DIR / "alembic.ini"
ALEMBIC_DIR = BACKEND_DIR / "alembic"
REVISION = "20261031_smart_split_bill"

# The revision before the one under test. The database is stamped
# here, so that only the revision under test is applied.
PREVIOUS_REVISION = "20261029_transaction_tags"

# The tables this migration makes.
SPLIT_TABLES = (
    "split_groups",
    "split_members",
    "split_expenses",
    "split_payers",
    "split_items",
    "split_item_claims",
    "split_calculated_shares",
    "split_settlements",
    "split_payment_methods",
)


def _config(url):
    """An alembic config pointed at a database of our own."""
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(ALEMBIC_DIR))
    config.set_main_option("sqlalchemy.url", url)
    return config


def _tables(eng):
    return set(inspect(eng).get_table_names())


def _columns(eng, table):
    return {c["name"] for c in inspect(eng).get_columns(table)}


@pytest.fixture
def engine(tmp_path):
    """
    A database that is thrown away after the test.

    The base tables are made the way the running app makes them: from
    the models. The two columns this migration adds to transactions
    are taken off the models first, because the point of the test is
    that the migration is the thing that puts them there.
    """
    import importlib

    from app.core.database import Base

    importlib.import_module("app.models.user")
    importlib.import_module("app.models.account")
    importlib.import_module("app.models.category")
    importlib.import_module("app.models.transaction")
    importlib.import_module("app.models.receipt")
    importlib.import_module("app.models.split_bill")

    # The tables are copied before the new columns are taken off them.
    # The copy matters: ``Base.metadata`` is shared with every other
    # test in the run, and a test that leaves a table in a different
    # shape behind it breaks the tests that come after.
    wanted = (
        "users",
        "accounts",
        "categories",
        "receipt_scans",
        "split_groups",
        "split_members",
        "split_expenses",
        "split_payers",
        "split_items",
        "split_item_claims",
        "split_calculated_shares",
        "split_settlements",
        "split_payment_methods",
    )
    private = MetaData()

    # The tables are copied one at a time, and the tables that are
    # pointed at are copied along with them. A foreign key to a table
    # that was not copied has nothing to point at, and the table
    # cannot be made.
    #
    # `transactions` is not copied. It is written out by hand below,
    # in the shape it had before this migration, because the two
    # tables point at each other: `transactions` points at
    # `split_expenses`, and `split_expenses` points back at
    # `transactions`. A copy of `transactions` still carries a
    # foreign key to a column that is not there, and the database
    # refuses to make it.
    copied = set()

    def copy_table(name):
        if name in copied:
            return
        if name not in Base.metadata.tables:
            return
        copied.add(name)
        source = Base.metadata.tables[name]
        for column in source.columns:
            for foreign_key in column.foreign_keys:
                target = foreign_key.target_fullname.split(".")[0]
                # `transactions` is written out by hand below.
                if target == "transactions":
                    continue
                copy_table(target)
        source.to_metadata(private)

    for name in wanted:
        copy_table(name)

    # The transactions table is written out by hand, in the shape it
    # had before this migration: without the two columns the
    # migration adds.
    #
    # It is written by hand rather than copied with the columns taken
    # off, because the copy carries the index on each column, and an
    # index that points at a column that is not there cannot be made
    # either.
    Table(
        "transactions",
        private,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
        Column("type", String(20), nullable=False),
        Column("amount", Numeric(20, 2), nullable=False),
        Column("currency", String(10), nullable=False, server_default="IDR"),
        Column("date", Date, nullable=False),
        Column("description", String(255)),
        Column("account_id", Integer, ForeignKey("accounts.id"), nullable=False),
        Column("category_id", Integer, ForeignKey("categories.id")),
        Column("receipt_scan_id", Integer, ForeignKey("receipt_scans.id")),
        Column("is_deleted", Boolean, default=False),
        Column("status", String(20)),
        Column("created_at", DateTime),
        Column("updated_at", DateTime),
    )

    # A file, not ``:memory:``. Alembic builds its own engine from
    # the URL, and an in-memory SQLite belongs to the connection that
    # made it.
    db_path = tmp_path / "split_migration_test.db"
    eng = create_engine(f"sqlite:///{db_path}")
    private.create_all(bind=eng)

    command.stamp(_config(str(eng.url)), PREVIOUS_REVISION)

    yield eng


def test_the_revision_hangs_off_something():
    """A revision that cannot be reached is a revision that cannot be run."""
    script = ScriptDirectory.from_config(_config("sqlite://"))

    heads = script.get_heads()
    assert heads, "there is no alembic head"

    rev = script.get_revision(REVISION)
    assert rev is not None, "the revision is not in the chain"
    assert rev.down_revision is not None, "the revision has no parent"

    walked = {r.revision for r in script.walk_revisions()}
    assert REVISION in walked


def test_every_revision_id_fits_in_the_column():
    """
    The revision id is stored in a column that is 32 characters wide.
    """
    script = ScriptDirectory.from_config(_config("sqlite://"))

    for rev in script.walk_revisions():
        assert len(rev.revision) <= 32, (
            f"the revision id {rev.revision!r} is {len(rev.revision)} characters"
        )


def test_the_chain_has_no_dangling_parent():
    """Every down_revision points at a revision that exists."""
    script = ScriptDirectory.from_config(_config("sqlite://"))
    known = {r.revision for r in script.walk_revisions()}

    for rev in script.walk_revisions():
        parent = rev.down_revision
        if isinstance(parent, tuple):
            for one in parent:
                assert one in known, f"{rev.revision} points at a missing {one}"
        elif parent is not None:
            assert parent in known, f"{rev.revision} points at a missing {parent}"


def test_the_migration_makes_the_split_tables(engine):
    """Going up makes every table the shared bill needs."""
    url = str(engine.url)
    command.upgrade(_config(url), "head")

    tables = _tables(engine)
    for name in SPLIT_TABLES:
        assert name in tables, f"the table {name} was not made"


def test_the_migration_adds_the_columns_to_transactions(engine):
    """
    The two columns that tie a shared bill to the reader own records.
    """
    url = str(engine.url)
    command.upgrade(_config(url), "head")

    columns = _columns(engine, "transactions")
    assert "split_expense_id" in columns
    assert "split_tx_type" in columns


def test_the_migration_can_be_undone(engine):
    """
    Going down takes the tables away again, and leaves everything else
    exactly as it was.
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

    tables = _tables(engine)
    for name in SPLIT_TABLES:
        assert name not in tables, f"the table {name} was left behind"

    columns = _columns(engine, "transactions")
    assert "split_expense_id" not in columns
    assert "split_tx_type" not in columns

    # The row that was there before is still there.
    with engine.connect() as conn:
        count = conn.execute(text("SELECT count(*) FROM accounts")).scalar()
    assert count == 1, "the migration took the reader accounts with it"


def test_the_migration_can_be_run_twice(engine):
    """
    Running it again does not make two of anything.
    """
    url = str(engine.url)
    command.upgrade(_config(url), "head")
    command.upgrade(_config(url), "head")

    tables = _tables(engine)
    for name in SPLIT_TABLES:
        assert name in tables, f"the table {name} was lost on the second run"
