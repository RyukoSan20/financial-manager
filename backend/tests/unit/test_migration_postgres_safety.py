"""
The migration has to be undoable on the database the server actually
runs.

The tests for the migration itself run on SQLite, because that is
what the test suite has. SQLite is forgiving in ways PostgreSQL is
not, and two of the things this migration does are exactly the kind
of thing SQLite forgives:

- taking a column off a table is done by rewriting the table on
  SQLite, and by a plain statement on PostgreSQL. The rewrite makes
  a copy, and the copy is a table the other tables still point at,
  so on PostgreSQL it fails in a way that is hard to read.

- dropping an index that is not there is an error. The usual way of
  writing that is to try it and catch the failure. On PostgreSQL a
  statement that fails leaves the transaction unusable, so a failure
  that is caught still spoils everything that comes after it.

Neither of these shows up on SQLite. Both of them showed up on the
real database during the rehearsal, and the rehearsal is the only
place they could show up: the fix has to be written down so it is
not undone by a well-meaning tidy-up.

So these tests read the migration and check the two rules.

Nothing here touches the production database.
"""

from pathlib import Path

import pytest


MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "20261031_smart_split_bill.py"
)


@pytest.fixture(scope="module")
def source() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_the_migration_is_there(source):
    assert source, "the migration file could not be read"


def test_a_failed_statement_is_not_caught_and_carried_on(source):
    """
    Nothing in the migration may catch a failure and carry on.

    On PostgreSQL a statement that fails leaves the transaction
    unusable. Every statement after it fails too, and the error
    that is finally reported is about a statement that had nothing
    wrong with it. So a failure that is caught is a failure that
    hides the real one.
    """
    lines = source.split("\n")
    for number, line in enumerate(lines, start=1):
        stripped = line.strip()
        if "except Exception" in stripped:
            pytest.fail(
                f"line {number} catches a failure and carries on: {stripped!r}. "
                "On PostgreSQL that hides the statement that actually failed."
            )


def test_a_column_is_not_taken_away_by_rewriting_the_table(source):
    """
    The plain way of taking a column away is used, not the batch way.

    The batch way makes a copy of the table and swaps it, and the
    copy is a table the other tables still point at.
    """
    assert "batch_alter_table" not in source or "sqlite" in source, (
        "the migration rewrites the table to take a column away. "
        "That works on SQLite and fails on PostgreSQL."
    )


def test_the_indexes_that_are_there_are_found_before_they_are_dropped(source):
    """
    Which indexes exist is asked first.

    Trying to drop an index that is not there, and catching the
    failure, leaves the transaction unusable on PostgreSQL.
    """
    assert "get_indexes" in source, (
        "the migration does not ask which indexes are there, so it has "
        "to drop them by trying and catching the failure."
    )


def test_the_drop_of_an_index_is_not_wrapped_in_a_catch(source):
    """
    The dropping of an index is not inside a try.
    """
    lines = source.split("\n")
    for number, line in enumerate(lines, start=1):
        if "op.drop_index" in line:
            # Look back a few lines for the try that would swallow it.
            window = "\n".join(lines[max(0, number - 4):number])
            assert "try:" not in window, (
                f"line {number} drops an index inside a try. On PostgreSQL "
                "a failure that is caught still spoils the transaction."
            )


def test_the_environment_is_used_when_the_file_says_nothing(monkeypatch):
    """
    The file carries no database any more, so the environment is the
    only thing left to say which one it is.

    This is the case that reached production: the file had a stand-in
    in it, the stand-in was not recognised, and the migration went
    looking for a database on a port nothing was listening on.
    """
    import pathlib

    backend_dir = pathlib.Path(__file__).resolve().parents[2]
    env_path = backend_dir / "alembic" / "env.py"
    source = env_path.read_text(encoding="utf-8")

    # The environment has to be read, and it has to be able to win.
    assert "from_env = os.environ.get(\"DATABASE_URL\")" in source
    assert "elif from_env:" in source
    assert "config.set_main_option(\"sqlalchemy.url\", from_env)" in source

    # And the branch that reads it has to come after the branch for a
    # url the caller set for itself, because a caller that knows the
    # database knows it better than the environment does.
    assert source.index("if from_config and not _is_a_placeholder(from_config):") \
        < source.index("elif from_env:")

    # The file itself must not name a database.
    ini = (backend_dir / "alembic.ini").read_text(encoding="utf-8")
    for line in ini.splitlines():
        if line.strip().startswith("sqlalchemy.url"):
            value = line.split("=", 1)[1].strip()
            assert not value, f"the ini file still names a database ({value!r})"
