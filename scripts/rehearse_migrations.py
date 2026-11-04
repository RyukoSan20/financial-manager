"""
Rehearse the migrations against a throwaway PostgreSQL.

The server's database was made from the models at startup, not by
alembic. There is no ``alembic_version`` table in it, and running
the whole chain against it would try to build every table from the
beginning on top of tables that are already there.

So this rehearses the same way the server is:

1. the schema is built from the models, the way the server builds it;
2. alembic is told which revision the database is at, without running
   anything (``prepare_migrations.py`` does the same on the server);
3. the newest migration is run, and then undone, and then run again.

Only the newest migration is exercised, because that is the only one
that has never been on the server. The older ones have been there
since before, and re-running them against a schema that was built
from the models is not what happens in production either.

    python scripts/rehearse_migrations.py <url>
"""

import os
import sys


HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(HERE, "backend")

sys.path.insert(0, BACKEND)

from alembic.config import Config  # noqa: E402
from alembic import command  # noqa: E402


# The revision the server's database is at before the newest
# migration. The newest one is the one that is applied by the
# upgrade rather than assumed to be there.
# The revision the server's database is at before the newest
# migration. The newest one is the one that is applied by the
# upgrade rather than assumed to be there.
#
# The server is at the shared bill. Everything after that has never
# been on the server, so everything after that is what has to be
# rehearsed.
STAMP_REVISION = "20261031_smart_split_bill"

# How many migrations have never been on the server. The downgrade
# has to walk back over all of them, and the upgrade has to walk
# forward over all of them again, or a migration that only works on
# its own is rehearsed and not the real thing.
NEW_MIGRATIONS = 7


def _build_schema(url):
    """
    Build the tables the way the server builds them.

    The models are imported first, so that everything is registered
    with the metadata, and then the metadata is told to make the
    tables.
    """
    from app.core.database import Base, engine

    # Every model, so that every table is in the metadata.
    #
    # The models the package exports are imported, and the two it
    # does not are imported by name, because the server imports them
    # by name too and the tables have to be the same on both sides.
    import app.models  # noqa: F401
    from app.models.user import User  # noqa: F401
    from app.models.user_settings import UserSettings  # noqa: F401

    Base.metadata.create_all(bind=engine)
    print(f"    schema built: {len(Base.metadata.tables)} tables")


def _config(url):
    config = Config(os.path.join(BACKEND, "alembic.ini"))
    config.set_main_option("script_location", os.path.join(BACKEND, "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    return config


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    url = sys.argv[1]
    os.environ["DATABASE_URL"] = url

    print("--- the schema, made from the models ---")
    _build_schema(url)

    config = _config(url)

    print("--- stamp the revision the server is at ---")
    command.stamp(config, STAMP_REVISION)
    print("--- stamped ---")

    print("--- upgrade head ---")
    command.upgrade(config, "head")
    print("--- upgrade head: OK ---")

    print(f"--- downgrade {NEW_MIGRATIONS} step(s) ---")
    command.downgrade(config, f"-{NEW_MIGRATIONS}")
    print(f"--- downgrade {NEW_MIGRATIONS} step(s): OK ---")

    print("--- upgrade head again ---")
    command.upgrade(config, "head")
    print("--- upgrade head again: OK ---")

    print("REHEARSAL PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
