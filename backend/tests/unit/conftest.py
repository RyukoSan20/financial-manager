"""
The shared bill, tested over the wire.

The application is built here with a small database behind it, so
that a test can make a group, let a guest join from a link, and check
what came back.

The tables are copied out of the models rather than written out by
hand. A hand-written table drifts away from the model, and the first
thing that breaks is a column the model has and the table does not.

Only the tables the shared bill needs are copied, because the whole
schema cannot be made on a small database: one of the other tables
uses a column type that only the big one has.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.api.routes import split_bills, split_guest

# The tables the shared bill needs, and the ones they point at.
SPLIT_TABLES = (
    "users",
    "accounts",
    "categories",
    "transactions",
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


class TheReader:
    """
    The person using the application.

    A stand-in for the signed-in reader. It has the two things the
    routes ask for: who it is and whether it is active.
    """

    id = 1
    email = "host@example.test"
    name = "The Host"
    is_active = True


@pytest.fixture()
def split_client():
    """
    The application, with a small database behind it.
    """
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.receipt  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    private = MetaData()

    # A table that is pointed at is copied along with the table that
    # points at it. A foreign key to a table that is not there has
    # nothing to point at, and the database cannot be made.
    copied = set()

    def copy_table(name):
        if name in copied or name not in Base.metadata.tables:
            return
        copied.add(name)
        source = Base.metadata.tables[name]
        for column in source.columns:
            for foreign_key in column.foreign_keys:
                copy_table(foreign_key.target_fullname.split(".")[0])
        source.to_metadata(private)

    for name in SPLIT_TABLES:
        copy_table(name)

    private.create_all(engine)
    Session = sessionmaker(bind=engine)

    app = FastAPI()
    app.include_router(split_bills.router, prefix="/api/split")
    app.include_router(split_guest.router, prefix="/api/split")

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: TheReader()

    with TestClient(app) as test_client:
        test_client.db = Session
        yield test_client
