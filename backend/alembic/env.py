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
# Three things can say. In order:
#
# 1. The DATABASE_URL in the environment. This is what the server and
#    the container set, and it is the one that is right in production.
# 2. The URL that is already in the config, if it is not the
#    placeholder that is written into alembic.ini. That placeholder is
#    not a real database; it is there so the file is not empty.
# 3. The application's settings, which read the environment anyway.
#
# The environment comes first because the placeholder in alembic.ini
# would otherwise win, and alembic would talk to a database that
# nobody is using.
from_env = os.environ.get("DATABASE_URL")
from_config = config.get_main_option("sqlalchemy.url", None)

if from_env:
    config.set_main_option("sqlalchemy.url", from_env)
elif from_config and "***" not in from_config and "user" not in from_config.split("@")[0]:
    # A real URL, written by a caller that knows the database.
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
