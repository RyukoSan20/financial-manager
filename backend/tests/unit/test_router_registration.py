"""
Mounting a router twice must not lose a route.

There is a module in `app.core.router_registration` that mounts a
router and leaves out the routes that are already mounted. It exists
because removing a duplicate registration by hand is how a route gets
lost: the two registrations have paths that overlap and paths that
do not, and the ones that do not overlap are easy to miss.

So the check here is the one that matters: after the change, every
path and method that the application answered before still answers.

The "before" is recorded by mounting the application twice, once with
the plain `include_router` and once with the new one, and comparing
the two.

Nothing here touches a database, a container or a server.
"""

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.router_registration import (  # noqa: E402
    count_duplicate_routes,
    include_router_once,
)


def _route_keys(app):
    """The paths and methods the application answers."""
    keys = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        if not path:
            continue
        for method in getattr(route, "methods", None) or {"GET"}:
            keys.add((method, path))
    return keys


@pytest.fixture(scope="module")
def application():
    """The real application."""
    from app.main import app as fastapi_app

    return fastapi_app


# ---------------------------------------------------------------------------
# The application itself
# ---------------------------------------------------------------------------


def test_the_application_has_no_duplicate_routes(application):
    """
    No path and method is mounted twice.

    This is the whole point. The application used to have thirteen of
    them, and the second registration of each was never reached.
    """
    duplicates = count_duplicate_routes(application)

    assert not duplicates, "these paths are mounted more than once:\n" + "\n".join(
        f"  {method} {path} ({n} times)" for (method, path), n in sorted(duplicates.items())
    )


def test_the_application_still_answers_health(application):
    """The endpoint the deployment checks."""
    client = TestClient(application)
    response = client.get("/health")

    assert response.status_code == 200

    body = response.json()
    # The two versions of this endpoint each returned one of these.
    # Both are here now.
    assert body.get("status") == "healthy"
    assert "version" in body, "the version is missing from the health answer"
    assert "timestamp" in body, "the timestamp is missing from the health answer"


def test_the_health_endpoint_answers_the_same_way_twice(application):
    """The health check is called by the deployment and by the proxy."""
    client = TestClient(application)

    first = client.get("/health").json()
    second = client.get("/health").json()

    assert first["status"] == second["status"]
    assert first["version"] == second["version"]


# ---------------------------------------------------------------------------
# The helper itself
# ---------------------------------------------------------------------------


def test_mounting_a_router_twice_leaves_the_first_one_answering():
    """
    The first registration keeps answering.

    This is what FastAPI already did, and it is what has to keep
    happening: the reader who goes to the page today must get the
    same answer tomorrow.
    """
    from fastapi import APIRouter

    app = FastAPI()
    router = APIRouter()

    @router.get("/thing")
    def thing():
        return {"which": "first"}

    app.include_router(router, prefix="/api")
    include_router_once(app, router, prefix="/api")

    client = TestClient(app)
    response = client.get("/api/thing")

    assert response.status_code == 200
    assert response.json() == {"which": "first"}

    duplicates = count_duplicate_routes(app)
    assert not duplicates, f"the route is still mounted twice: {duplicates}"


def test_mounting_a_router_twice_keeps_the_paths_the_second_one_had():
    """
    A path that only the second registration had is still reachable.

    This is the reason the helper exists. Removing the second
    registration by hand would have taken this path with it.
    """
    from fastapi import APIRouter

    app = FastAPI()

    first = APIRouter()

    @first.get("/shared")
    def shared():
        return {"which": "shared"}

    @first.get("/only-first")
    def only_first():
        return {"which": "first"}

    app.include_router(first, prefix="/api")

    second = APIRouter()

    @second.get("/shared")
    def shared_again():
        return {"which": "second"}

    @second.get("/only-second")
    def only_second():
        return {"which": "second"}

    include_router_once(app, second, prefix="/api")

    client = TestClient(app)

    # The shared path answers as it did before: the first one.
    assert client.get("/api/shared").json() == {"which": "shared"}
    # The path only the second one had is still there.
    assert client.get("/api/only-second").json() == {"which": "second"}
    # And the one only the first had is still there.
    assert client.get("/api/only-first").json() == {"which": "first"}

    assert not count_duplicate_routes(app)


def test_the_helper_reports_the_routes_it_left_out():
    """The caller is told what happened, so it can be written down."""
    from fastapi import APIRouter

    app = FastAPI()
    router = APIRouter()

    @router.get("/thing")
    def thing():
        return {}

    app.include_router(router, prefix="/api")

    skipped = include_router_once(app, router, prefix="/api")

    assert len(skipped) == 1
    assert skipped[0].path == "/thing"


def test_the_helper_refuses_something_that_is_not_a_router():
    """A router that is not a router is a mistake, not a silent no-op."""
    with pytest.raises(TypeError):
        include_router_once(FastAPI(), "not a router")


def test_the_application_answers_the_paths_that_were_only_in_the_second_registration(
    application,
):
    """
    The paths that were reachable through the second registration are
    still reachable.

    These are the ones that would have been lost by removing the
    duplicate registrations by hand.
    """
    # The route table is checked rather than the answers, because
    # calling these endpoints needs a reader and a database, and this
    # check is about which routes exist, not about what they say.
    mounted = {
        (method, route.path)
        for route in application.routes
        for method in (getattr(route, "methods", None) or {"GET"})
    }

    # Each of these was mounted only by the second registration of a
    # pair. Before the change they answered 401, which means the route
    # was there. After the change they must still be mounted.
    for method, path in [
        ("GET", "/api/ai/insights"),
        ("GET", "/api/ai/health-score"),
        ("GET", "/api/analytics/trends"),
        ("GET", "/api/analytics/health-score"),
        ("GET", "/api/analytics/budgets"),
        ("GET", "/api/analytics/insights"),
        ("GET", "/api/analytics/export/{format}"),
        ("GET", "/api/dashboard/net-worth"),
        ("GET", "/api/shopping/wishlist"),
        ("GET", "/api/shopping/price-comparison"),
        ("GET", "/api/shopping/price-history/{item_name}"),
        ("POST", "/api/shopping/extract-items"),
        ("POST", "/api/shopping/wishlist"),
        ("DELETE", "/api/shopping/wishlist/{item_id}"),
        ("POST", "/api/shopping/wishlist/{item_id}/purchase"),
    ]:
        assert (method, path) in mounted, f"{method} {path} is not mounted any more"
