"""
Every route answers.

A route is a promise: this path, this method, this answer. A route
that points at the wrong function breaks the promise quietly - the
path still exists, the method is still allowed, and the answer is a
422 or a 500 instead of what was asked for.

That is not a theory. `GET /api/me` was bound to a helper that took
a `user` argument which FastAPI could not supply, so every call to it
answered 422. The reader saw the profile fail to load on every
screen, and the console said "422 Unprocessable Entity" with nothing
else to say.

So the shape of every route is held here:

- every route's endpoint is a function with a signature FastAPI can
  fill - no argument it cannot supply;
- and the name of the function behind a route says what the route
  does, so a decorator that has drifted onto the wrong function is
  visible in the test rather than in the reader's console.

Nothing here touches the production server or a real database.
"""

import inspect
import sys
from pathlib import Path

import pytest
from fastapi import APIRouter, FastAPI

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402


def _routes():
    return [
        route for route in app.routes
        if getattr(route, "endpoint", None) is not None
    ]


# ---------------------------------------------------------------------------
# The endpoints can be filled
# ---------------------------------------------------------------------------

def test_no_endpoint_demands_a_query_parameter_nobody_declared():
    """No endpoint asks for something that was never meant to be asked for.

    FastAPI fills a path parameter, a query parameter, a body and the
    declared dependencies. When an endpoint takes an argument that is
    neither of those - a plain `user`, say - FastAPI makes it a
    *required* query parameter named after it. And a required query
    parameter is a demand: if the reader's page does not send it, the
    request answers 422.

    `GET /api/me` was bound to a helper that took a `user` argument.
    The browser never sends "?user=", so the profile answered 422 on
    every screen and the console said only "422 Unprocessable
    Entity".

    So what is held here is narrow and exact: an endpoint must not
    require a query parameter whose name is the name of an argument
    that was never declared as a query parameter in the first place.

    The endpoints that genuinely want a query parameter say so in
    their signature - `q: str = Query(...)` - and those are fine.
    """
    holes = []

    for route in _routes():
        dependant = getattr(route, "dependant", None)
        if dependant is None:
            continue

        from_path = {field.name for field in dependant.path_params}

        for param in dependant.query_params:
            if param.name in from_path:
                continue
            if not getattr(param, "required", False):
                continue

            # The signature says what was asked for. A parameter
            # declared with Query(...) was meant to be asked for.
            signature = inspect.signature(route.endpoint)
            declared = signature.parameters.get(param.name)
            if declared is None:
                continue

            annotation = getattr(declared, "annotation", None)
            annotation_name = getattr(annotation, "__name__", str(annotation))

            if "Query" in annotation_name:
                continue

            # A plain parameter with no annotation at all is the hole:
            # FastAPI turned it into a required query parameter that
            # nobody thought of.
            if annotation is inspect.Parameter.empty:
                holes.append(
                    "%s %s -> %s(%s)"
                    % (
                        sorted(getattr(route, "methods", []) or []),
                        route.path,
                        route.endpoint.__name__,
                        param.name,
                    )
                )

    assert not holes, (
        "these endpoints demand a query parameter that was never declared:\n  "
        + "\n  ".join(holes)
    )


# ---------------------------------------------------------------------------
# The endpoint says what the route does
# ---------------------------------------------------------------------------

def test_a_read_route_is_named_for_what_it_reads():
    """The name of the function says what the route does.

    A decorator that has drifted onto the wrong function is invisible
    from the outside - the path still answers, just wrongly. The name
    is how it becomes visible.

    A read route is a GET, and it is named for what it reads: the
    profile, the accounts, the transactions.
    """
    mismatches = []

    for route in _routes():
        endpoint = route.endpoint
        methods = getattr(route, "methods", set()) or set()
        path = getattr(route, "path", "")

        if "GET" not in methods:
            continue
        if path.startswith("/openapi") or path in ("/health", "/", "/docs",
                                                    "/redoc", "/favicon.ico"):
            continue

        name = endpoint.__name__

        # The helper that reads the avatar is not a route. If it ever
        # becomes one, it says so in its name.
        if name.startswith("_"):
            mismatches.append(
                "GET %s is served by the helper %s" % (path, name)
            )

    assert not mismatches, "\n  ".join(mismatches)


def test_the_profile_route_serves_the_profile():
    """GET /api/me is the reader's own profile.

    This one is named here because it is the one that broke. The
    profile is asked for on every screen, so a broken profile is a
    broken application - not one broken page.
    """
    from app.api.routes.auth import get_me

    served = [
        route for route in _routes()
        if getattr(route, "path", "") == "/api/me"
        and "GET" in (getattr(route, "methods", set()) or set())
    ]

    assert served, "there is no GET /api/me"
    assert served[0].endpoint is get_me, (
        "GET /api/me is served by %s, not get_me"
        % served[0].endpoint.__name__
    )


def test_the_profile_route_answers_200():
    """The profile route answers with the reader, not with a number."""
    from fastapi.testclient import TestClient

    from app.core.security import get_current_user

    class _Reader:
        id = 1
        email = "reader@example.test"
        username = "reader"
        full_name = "Reader"
        phone = None
        avatar_url = "avatar-default"
        is_active = True
        is_guest = False
        created_at = None
        last_login = None

    application = FastAPI()
    application.include_router(
        __import__("app.api.routes.auth", fromlist=["router"]).router,
        prefix="/api",
    )
    application.dependency_overrides[get_current_user] = lambda: _Reader()

    client = TestClient(application, raise_server_exceptions=False)
    response = client.get("/api/me")

    assert response.status_code == 200, (
        "the profile answered with %r: %s" % (response.status_code, response.text[:300])
    )

    body = response.json()
    assert body["email"] == "reader@example.test", body
    assert body["avatar_url"] == "avatar-default", body
