from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base
from app.core.config import get_settings

settings = get_settings()

# this is the Alembic Config object
config = context.config

# Which database to run against.
#
# Two things can say, and the one that is more specific wins.
#
# A URL written into the config by the caller is the most specific of
# all: somebody said which database they meant, and they are the only
# one who knows. A test that builds a throwaway database and points
# alembic at it says exactly that.
#
# The DATABASE_URL in the environment comes next. This is what the
# server and the container set, and it is the one that is right in
# production.
#
# The placeholder in alembic.ini comes last. It is not a database at
# all; it is there so the file is not empty, and if it were allowed to
# win, alembic would talk to a database that nobody is using while
# looking like it had worked.
#
# So: the config wins if it holds a real URL, otherwise the
# environment does, and otherwise the application's settings do.
from_env = os.environ.get("DATABASE_URL")
from_config = config.get_main_option("sqlalchemy.url", None)


def _is_a_placeholder(url):
    """
    Is this the stand-in in the ini file rather than a database?

    A url that is empty is a stand-in: the ini file now says nothing
    about the database, and the environment is asked instead.
    """
    return not url


if from_env:
    # The environment is the one that is right in production. The
    # server and the container set it, and it points at the database
    # the application itself is using.
    #
    # This comes first because the file is read through a parser that
    # expands %(...)s, and a stand-in written in the file comes back
    # changed in a way that cannot be recognised reliably. An empty
    # value is the only stand-in that survives being read.
    config.set_main_option("sqlalchemy.url", from_env)
elif from_config and not _is_a_placeholder(from_config):
    # A caller that knows the database has already said which one.
    pass
else:
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
