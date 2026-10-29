"""
Make the alembic history match the database that is actually there.

The database on the server was made from the models at startup, not by
alembic. There is no ``alembic_version`` table in it. Running
``alembic upgrade head`` against it would try to build every table
from the beginning, on top of the tables that are already there.

So before the upgrade runs, this script tells alembic which revision
the database is at, without running anything. The stamp is to the
revision *before* the newest one, so that the newest one is applied by
the upgrade rather than assumed to be there.

Running it twice does nothing the second time: once the history
exists, the database is left alone.

Prints one word, ``stamped`` or ``already``, so the caller can say
what happened.

    python scripts/prepare_migrations.py
"""

import os
import sys


# The revision the database is at before the newest migration. The
# newest one is the one that adds the columns the newer pages read.
STAMP_REVISION = "20261023_merchant_catalog"


def _settings():
    """The application's settings, without importing the whole app."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from app.core.config import get_settings

    return get_settings()


def _has_alembic_history(engine):
    """
    Is there an alembic_version table?

    A database that has never been stamped has no history, and the
    answer is no.

    The question is asked through the inspector rather than by
    running a query, because the query that asks it is written
    differently for PostgreSQL and for SQLite, and this script has to
    work on both.
    """
    from sqlalchemy import inspect

    return inspect(engine).has_table("alembic_version")


def main():
    import sqlalchemy as sa

    url = os.environ.get("DATABASE_URL") or _settings().DATABASE_URL
    engine = sa.create_engine(url)

    if _has_alembic_history(engine):
        print("already")
        return 0

    from alembic import command
    from alembic.config import Config

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config = Config(os.path.join(backend_dir, "alembic.ini"))
    config.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    config.set_main_option("sqlalchemy.url", url)

    command.stamp(config, STAMP_REVISION)
    print("stamped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
