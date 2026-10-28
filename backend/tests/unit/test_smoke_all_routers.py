"""
Every router is really there, and no router is registered twice.

Two things went wrong before, and both were quiet.

The first: a router was imported inside a `try`, and the `except`
printed a line saying the router was not available. The application
started, the deployment said it was healthy, and the routes were
simply not there. A reader who went to that page got a 404, and
nothing said why.

The second: a router was registered twice under the same prefix. The
first registration won, and the second one was never reached. It was
not an error, so nothing said anything about it, and the routes of the
second registration were gone.

So the application is checked here, by importing it and looking at
what is actually in it:

- every route file must contribute its routes to the application;
- no path and method may be registered twice, apart from the ones
  that are known and deliberate;
- the endpoints the deployment smoke test relies on must answer.

Nothing here touches the production server, a container, or a real
database.
"""

import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

ROUTES_DIR = BACKEND_DIR / "app" / "api" / "routes"


@pytest.fixture(scope="module")
def app():
    """The application, imported once."""
    from app.main import app as fastapi_app

    return fastapi_app


# The route files that are in the repository but are deliberately not
# mounted. The comment in main.py says the OCR was turned off.
DELIBERATELY_UNMOUNTED = {"scan_jobs"}


def _route_files():
    """The route files in the repository."""
    return sorted(
        p
        for p in ROUTES_DIR.glob("*.py")
        if not p.name.startswith("_")
        and p.name != "__init__.py"
        and p.stem not in DELIBERATELY_UNMOUNTED
    )


# ---------------------------------------------------------------------------
# Every route file is in the application
# ---------------------------------------------------------------------------


def test_the_route_directory_is_not_empty():
    """There are route files to check in the first place."""
    files = _route_files()
    assert len(files) >= 40, f"only {len(files)} route files were found"


def test_every_route_file_has_its_router_in_the_application(app):
    """
    Every route file must contribute its routes to the application.

    A file that is in the repository but not in the application is a
    router that failed to import, or one that was never registered.
    Either way the reader gets a 404 and nothing says why.

    The router's own paths are compared against the end of the
    application's paths, because the router is mounted under a prefix.
    "/export" mounted at "/api/data" is "/api/data/export" in the
    application.
    """
    missing = []
    app_paths = {route.path for route in app.routes if getattr(route, "path", None)}

    for path in _route_files():
        module_name = f"app.api.routes.{path.stem}"

        try:
            module = __import__(module_name, fromlist=["router"])
        except Exception as exc:  # noqa: BLE001
            missing.append(f"{path.name}: the module does not import ({exc})")
            continue

        router = getattr(module, "router", None)
        if router is None:
            missing.append(f"{path.name}: the module has no `router`")
            continue

        router_paths = {
            getattr(route, "path", None)
            for route in router.routes
            if getattr(route, "path", None)
        }
        if not router_paths:
            missing.append(f"{path.name}: the router has no routes")
            continue

        # Every route of the router has to be somewhere in the
        # application, under some prefix.
        for router_path in router_paths:
            if not any(app_path.endswith(router_path) for app_path in app_paths):
                missing.append(
                    f"{path.name}: {router_path} is not in the application"
                )
                break

    assert not missing, (
        "these route files are not in the application:\n  "
        + "\n  ".join(missing)
    )


# ---------------------------------------------------------------------------
# No path and method is registered twice
# ---------------------------------------------------------------------------

# The duplicates that are there on purpose.
#
# The market router is registered twice because the real-time one has
# to be first: FastAPI matches the first registration, and the older
# one returns 429 from a datacenter address. The comment in main.py
# says so. The location router is registered twice by accident, and
# the second registration is the one that is reached, because the
# first one is inside a try that swallows the import.
#
# This list is what the check below compares against. A duplicate that
# is not on this list is a new one, and it fails the test.
KNOWN_DUPLICATE_PATHS = {
    # The market router, deliberately mounted twice. The comment in
    # main.py says so: the real-time one has to be first, because
    # FastAPI matches the first registration and the older one returns
    # 429 from a datacenter address.
    "/api/market/summary",
    "/api/market/crypto",
    "/api/market/commodities",
    # The location router, mounted twice by accident. Both copies are
    # the same file, so the first one is simply never reached.
    "/api/location/search-places",
    "/api/location/reverse-geocode",
    "/api/location/static-map",
    # The shopping router and the shopping module, both mounted. The
    # route file is registered first, so the module's handlers are
    # the ones that are never reached.
    "/api/shopping/items",
    "/api/shopping/items/{item_id}",
    # The AI advisor, as a route file and as a module. The route file
    # is registered first.
    "/api/ai/chat",
    "/api/ai/chat/stream",
    # The dashboard summary and cash flow, as a route file and as the
    # ledger analytics module. The route file is registered first.
    "/api/dashboard/summary",
    "/api/dashboard/cash-flow",
    # The health check, written twice in main.py.
    "/health",
}


def test_no_new_path_is_registered_twice(app):
    """
    A path and method that is registered twice is a bug that says
    nothing.

    The first registration wins and the second is never reached, so
    the routes of the second one are gone. There is no error and no
    warning.

    The duplicates that are known and deliberate are on the list
    above. Anything else is new, and it fails here.
    """
    seen = {}
    duplicated = set()

    for route in app.routes:
        path = getattr(route, "path", None)
        if not path:
            continue
        methods = getattr(route, "methods", None) or {"GET"}
        for method in methods:
            key = (method, path)
            if key in seen:
                duplicated.add(path)
            else:
                seen[key] = path

    new_duplicates = sorted(duplicated - KNOWN_DUPLICATE_PATHS)

    assert not new_duplicates, (
        "these paths are registered more than once and are not on the "
        "known list:\n  "
        + "\n  ".join(new_duplicates)
        + "\n\nEither fix the registration, or add the path to "
        "KNOWN_DUPLICATE_PATHS with a note saying why it is there."
    )


def test_the_known_duplicates_are_still_the_known_ones(app):
    """
    The list of known duplicates is not allowed to grow by accident.

    If a duplicate is fixed, it is taken off the list, so the list
    keeps saying what is actually true. A path that is on the list but
    is no longer duplicated means the fix was made and the list was
    not updated, which is the same kind of quiet wrongness.
    """
    seen = set()
    duplicated = set()

    for route in app.routes:
        path = getattr(route, "path", None)
        if not path:
            continue
        methods = getattr(route, "methods", None) or {"GET"}
        for method in methods:
            key = (method, path)
            if key in seen:
                duplicated.add(path)
            else:
                seen.add(key)

    gone = sorted(KNOWN_DUPLICATE_PATHS - duplicated)
    assert not gone, (
        "these paths are on the known-duplicates list but are no longer "
        "duplicated, so the list should be updated:\n  "
        + "\n  ".join(gone)
    )


# ---------------------------------------------------------------------------
# The application answers
# ---------------------------------------------------------------------------


def _client():
    """
    A test client that does not start the application.

    The startup does the database work, and the models carry types
    SQLite does not know, so the startup is not run. The endpoints
    checked here answer without it.
    """
    from fastapi.testclient import TestClient

    from app.main import app as fastapi_app

    return TestClient(fastapi_app)


def test_the_health_endpoint_answers():
    """The deployment checks this one, so it has to answer."""
    # The client is not used as a context manager, because that runs
    # the startup, and the startup builds the database. The health
    # check does not need it.
    client = _client()
    response = client.get("/health")

    assert response.status_code == 200, f"/health answered {response.status_code}"


def test_the_ready_endpoint_is_registered():
    """
    The deployment checks this one too.

    The readiness check asks the database whether it is there, so it
    cannot be called without one. What is checked here is that it is
    registered and that it is the kind of endpoint that answers.
    Calling it is the deploy's job, and the deploy has a real
    database.
    """
    ready = [
        route
        for route in app_routes()
        if getattr(route, "path", None) == "/ready"
    ]

    assert ready, "/ready is not registered"
    assert "GET" in (getattr(ready[0], "methods", None) or set()), (
        "/ready does not answer GET"
    )


def app_routes():
    """The routes of the application, imported once."""
    from app.main import app as fastapi_app

    return fastapi_app.routes


def test_the_openapi_document_can_be_written(app):
    """
    The document lists every route.

    If a route cannot be described, it is malformed, and the
    application would answer 500 to it. This is the cheapest way to
    find that out without calling every endpoint.
    """
    schema = app.openapi()

    assert "paths" in schema, "the openapi document has no paths"
    assert len(schema["paths"]) > 50, (
        f"only {len(schema['paths'])} paths in the document"
    )


def test_the_documented_paths_match_the_registered_ones(app):
    """
    What the document says and what is registered are the same.

    A route that is registered but not documented is a route nobody
    knows about, and a route that is documented but not registered is
    a promise the application does not keep.
    """
    schema = app.openapi()
    documented = set(schema["paths"].keys())

    registered = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        if path:
            registered.add(path)

    # A route that is hidden from the document on purpose is not a
    # route nobody knows about. The application decides which ones are
    # hidden, and that decision is respected here.
    hidden = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        if path and getattr(route, "include_in_schema", True) is False:
            hidden.add(path)

    api_registered = {
        p for p in registered if p.startswith("/api") and p not in hidden
    }
    api_documented = {p for p in documented if p.startswith("/api")}

    undocumented = api_registered - api_documented
    assert not undocumented, (
        "these routes are registered but not in the openapi document:\n  "
        + "\n  ".join(sorted(undocumented))
    )
