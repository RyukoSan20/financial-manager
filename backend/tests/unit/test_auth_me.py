"""
The reader can sign in, and can ask who they are.

This is the test that would have caught the worst thing that happened
to this application.

`GET /api/me` was bound to the wrong function. The decorator had been
left above a helper - `_reader_avatar`, which takes a `user`
argument - so the route was asking for a query parameter named
"user", which the browser never sends. Every call answered 422.

The reader saw the profile fail to load on every screen: the header,
the sidebar, the settings page, all of it. And the console said only
"422 Unprocessable Entity", with nothing to say which request had
failed or why.

A 422 is a bad request. The browser's request was fine. The server
was asking for something nobody was sending, and that was invisible
from the outside.

So three things are held here:

- `GET /api/me` answers 200 and carries the reader's own profile;
- `POST /api/login` answers 200 and hands back a token;
- and `PUT /api/me` answers 200 and keeps the change.

All three are checked against a real database, with a real token, the
way the browser does it.

Nothing here touches the production server or a real database.
"""

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api.routes import auth  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.core.security import get_current_user, get_password_hash  # noqa: E402


@pytest.fixture()
def session():
    """A database with one reader in it."""
    from app.core.database import Base

    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.user_settings  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _add_now(dbapi_connection, _record):
        dbapi_connection.create_function("NOW", 0, lambda: "2026-11-08 00:00:00")

    # Only the tables this test needs. The whole set cannot be made on
    # SQLite, because some of the columns are a PostgreSQL type that
    # SQLite has no way to write.
    wanted = ("users", "accounts", "categories", "user_settings")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            table for name, table in Base.metadata.tables.items()
            if name in wanted
        ],
    )

    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


@pytest.fixture()
def reader(session):
    """The reader, with a password that works."""
    from app.models.user import User

    session.add(User(
        id=1,
        email="reader@example.com",
        username="reader",
        hashed_password=get_password_hash("correct horse battery staple"),
        full_name="Reader",
        avatar_url="avatar-default",
        is_active=True,
        is_guest=False,
    ))
    session.commit()
    return session


@pytest.fixture()
def client(session):
    """The application, with the auth routes mounted.

    The route for the profile is mounted from the same module the
    application uses, so a decorator that has drifted onto the wrong
    function is caught here.
    """
    application = FastAPI()
    application.include_router(auth.router, prefix="/api")

    application.dependency_overrides[get_db] = lambda: session

    return TestClient(application, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# The sign in
# ---------------------------------------------------------------------------

def test_signing_in_answers_200(client, reader):
    """The reader can sign in.

    This is the first thing that has to work. Everything else is a
    feature.
    """
    response = client.post("/api/login", json={
        "email": "reader@example.com",
        "password": "correct horse battery staple",
    })

    assert response.status_code == 200, (
        "signing in answered with %r: %s"
        % (response.status_code, response.text[:400])
    )

    body = response.json()
    assert body.get("access_token"), body
    assert body["user"]["email"] == "reader@example.com", body


def test_signing_in_with_the_wrong_password_does_not_answer_a_token(client, reader):
    """A wrong password is refused, and says so."""
    response = client.post("/api/login", json={
        "email": "reader@example.com",
        "password": "not the password",
    })

    assert response.status_code == 401, response.status_code
    assert not response.json().get("access_token"), response.text


# ---------------------------------------------------------------------------
# The profile
# ---------------------------------------------------------------------------

def test_the_profile_answers_200_and_never_422(client, reader):
    """GET /api/me answers with the reader.

    This is the one that was broken. The route was bound to a helper
    that took a `user` argument, so FastAPI turned it into a required
    query parameter named "user". The browser never sends "?user=",
    so every call answered 422 - on every screen, because the
    profile is asked for everywhere.

    So the answer is checked for its status AND for its content: a 200
    that carries no profile is not a pass either.
    """
    token = _token(client, reader)

    response = client.get(
        "/api/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, (
        "the profile answered with %r: %s"
        % (response.status_code, response.text[:400])
    )
    assert response.status_code != 422, "the profile answered with a 422"

    body = response.json()
    assert body["id"] == 1, body
    assert body["email"] == "reader@example.com", body
    assert body["username"] == "reader", body
    assert body["avatar_url"] == "avatar-default", body
    assert body["is_active"] is True, body


def test_the_profile_does_not_ask_the_reader_for_something(client, reader):
    """The profile does not ask for a query parameter.

    The 422 happened because the route demanded "?user=". A reader
    whose browser does not send it gets an error. So the answer is
    checked for the absence of that demand: the profile is asked for
    with no query string at all, exactly as the browser asks.
    """
    token = _token(client, reader)

    response = client.get(
        "/api/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text[:400]


def test_the_profile_is_served_by_the_profile(client, reader):
    """The route is bound to the function that reads the profile.

    The decorator had drifted onto the helper above it. The path
    still existed and the method was still allowed, so nothing looked
    wrong from the outside - the answer was just always a 422.
    """
    served = [
        route for route in app_routes()
        if getattr(route, "path", "") == "/api/me"
        and "GET" in (getattr(route, "methods", set()) or set())
    ]

    assert served, "there is no GET /api/me"
    assert served[0].endpoint is auth.get_me, (
        "GET /api/me is served by %s, not get_me"
        % served[0].endpoint.__name__
    )


def test_the_update_is_served_by_the_update(client, reader):
    """The route for changing the profile is bound to the change.

    The same drift, in the other direction: a duplicate definition
    would leave one of the two unreachable.
    """
    served = [
        route for route in app_routes()
        if getattr(route, "path", "") == "/api/me"
        and "PUT" in (getattr(route, "methods", set()) or set())
    ]

    assert served, "there is no PUT /api/me"
    assert served[0].endpoint is auth.update_profile, (
        "PUT /api/me is served by %s, not update_profile"
        % served[0].endpoint.__name__
    )


def test_the_helper_is_not_a_route(client, reader):
    """The helper that reads the picture is not a route.

    It is a helper. It takes the reader as an argument and gives back
    the picture. If it ever became a route, it would be asking for a
    "?user=" that nobody sends.
    """
    from app.main import app

    for route in app.routes:
        if getattr(route, "endpoint", None) is auth._reader_avatar:
            pytest.fail(
                "the helper _reader_avatar is bound to the route %s"
                % getattr(route, "path", "?")
            )


# ---------------------------------------------------------------------------
# The change
# ---------------------------------------------------------------------------

def test_changing_the_profile_answers_200(client, reader):
    """PUT /api/me answers 200 and keeps the change.

    The picture is the reader's own now, so it is a value they can
    change, and changing it is part of the same story.
    """
    token = _token(client, reader)

    response = client.put(
        "/api/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"full_name": "Reader Yang Baru", "avatar_url": "avatar-cactus"},
    )

    assert response.status_code == 200, (
        "the change answered with %r: %s"
        % (response.status_code, response.text[:400])
    )

    body = response.json()
    assert body["full_name"] == "Reader Yang Baru", body
    assert body["avatar_url"] == "avatar-cactus", body

    # And the change was kept.
    again = client.get(
        "/api/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert again.json()["full_name"] == "Reader Yang Baru", again.text


# ---------------------------------------------------------------------------
# The helpers
# ---------------------------------------------------------------------------

def _token(client, reader) -> str:
    """A token for the reader, the way the browser gets one."""
    response = client.post("/api/login", json={
        "email": "reader@example.com",
        "password": "correct horse battery staple",
    })

    assert response.status_code == 200, response.text[:400]
    return response.json()["access_token"]


def app_routes():
    """The routes of the whole application."""
    from app.main import app

    return app.routes
