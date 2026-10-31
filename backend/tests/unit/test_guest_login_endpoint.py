"""
Two guests with similar device ids must both get an account.

This is the bug that was found while checking the interface in a
browser: the guest login answered 500. The reason was in the log.

The username for a guest account was made by cutting the device id
to its first eight characters. The database has a unique index on the
username. So two devices whose ids started the same way wanted the
same username, and the second one was refused with a 500.

The rule is in `app.core.guest_identity`. This checks the endpoint
itself, because a rule that is written down but not used is still a
bug.
"""

import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB, UUID  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402

from app.api.routes.auth import router as auth_router  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.models.user import User  # noqa: E402


@compiles(JSONB, "sqlite")
def _jsonb_as_text(element, compiler, **kw):
    return "TEXT"


@compiles(ARRAY, "sqlite")
def _array_as_text(element, compiler, **kw):
    return "TEXT"


@compiles(INET, "sqlite")
def _inet_as_text(element, compiler, **kw):
    return "TEXT"


@compiles(UUID, "sqlite")
def _uuid_as_text(element, compiler, **kw):
    return "TEXT"


@pytest.fixture()
def client():
    """The guest endpoint, on a database that is thrown away after."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    app = FastAPI()
    app.include_router(auth_router, prefix="/api")

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db

    try:
        with TestClient(app) as test_client:
            yield test_client, session
    finally:
        session.close()
        engine.dispose()


def test_two_guests_with_the_same_prefix_both_get_an_account(client):
    """
    The bug: `guest_` plus the first eight characters of the device
    id. The second guest of this pair was refused with a 500.
    """
    test_client, session = client

    first = test_client.post("/api/guest", json={"device_id": "sharedprefixaaa"})
    second = test_client.post("/api/guest", json={"device_id": "sharedprefixbbb"})

    assert first.status_code == 200, f"the first guest was refused: {first.text}"
    assert second.status_code == 200, (
        f"the second guest was refused: {second.text}"
    )


def test_the_two_guests_are_two_different_accounts(client):
    """They get in, so they are two accounts and not one account twice."""
    test_client, session = client

    test_client.post("/api/guest", json={"device_id": "sharedprefixaaa"})
    test_client.post("/api/guest", json={"device_id": "sharedprefixbbb"})

    users = session.query(User).filter(User.email.like("guest_%")).all()
    assert len(users) == 2, f"expected two guest accounts, found {len(users)}"
    assert len({u.username for u in users}) == 2, "the two guests share a username"


def test_the_same_device_gets_the_same_account_back(client):
    """A guest who comes back keeps the same account."""
    test_client, session = client

    first = test_client.post("/api/guest", json={"device_id": "returningdevice"})
    second = test_client.post("/api/guest", json={"device_id": "returningdevice"})

    assert first.status_code == 200
    assert second.status_code == 200

    users = session.query(User).filter(User.email.like("guest_%")).all()
    assert len(users) == 1, f"expected one guest account, found {len(users)}"

    # And it is the same token, so the reader stays signed in.
    assert (
        first.json()["access_token"] == second.json()["access_token"]
    ), "the same device was given a different token"


def test_a_device_id_with_awkward_characters_still_works(client):
    """
    The device id comes from the browser, so it may hold anything. The
    name of the account has to survive that.
    """
    test_client, session = client

    response = test_client.post(
        "/api/guest", json={"device_id": "weird id/with'chars\"and spaces"}
    )

    assert response.status_code == 200, f"the guest was refused: {response.text}"

    user = session.query(User).filter(User.email.like("guest_%")).first()
    assert user is not None
    assert " " not in user.username
    assert "'" not in user.username


def test_the_token_of_a_guest_does_not_change_with_the_clock(client, monkeypatch):
    """
    A guest who comes back keeps the same token.

    The token was made from the moment it was asked for, down to the
    microsecond, so two asks made two different tokens. The test above
    only failed when the two asks landed on different microseconds,
    which is why it was passed half the time and failed half the time.

    Here the clock is moved on between the two asks, so the token must
    still be the same one.
    """
    import datetime as _datetime

    test_client, session = client

    first = test_client.post("/api/guest", json={"device_id": "clockdevice"})

    # The clock moves on. The clock in the module that makes the token
    # is the one that is moved, because that is the one that used to
    # decide when the token stops being valid.
    moved = []

    class _Clock:
        @staticmethod
        def utcnow():
            moment = _datetime.datetime.utcnow() + _datetime.timedelta(
                hours=3 * (len(moved) + 1)
            )
            moved.append(moment)
            return moment

    monkeypatch.setattr("app.core.security.datetime", _Clock)

    second = test_client.post("/api/guest", json={"device_id": "clockdevice"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert (
        first.json()["access_token"] == second.json()["access_token"]
    ), "the same device was given a different token"
