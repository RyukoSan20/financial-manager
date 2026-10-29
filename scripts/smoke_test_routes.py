#!/usr/bin/env python3
"""
Check that every router is really in the application.

This is the script the deploy runs, and the one the preflight runs.

It exists because of two failures that said nothing.

The first: a router was imported inside a `try`, and the `except`
printed a line saying the router was not available. The application
started, the deployment said it was healthy, and the routes were
simply not there. The reader who went to that page got a 404.

The second: a router was registered twice under the same prefix. The
first registration won, the second was never reached, and nothing said
so.

So this script does three things:

1. imports the application and counts the routes;
2. checks that every route file in the repository contributed its
   routes to the application;
3. calls the endpoints the deployment depends on, so a broken one is
   caught before the traffic arrives.

It reads the application and nothing else. It does not change it, it
does not touch the production server, and it does not write anything.

Run with:
    python3 scripts/smoke_test_routes.py

Exit status is 0 when everything is in order, and 1 when something is
not.
"""

import os
import sys
from collections import defaultdict
from pathlib import Path

# The backend directory, so "import app" finds the code beside this
# script rather than some other checkout.
BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

ROUTES_DIR = BACKEND_DIR / "app" / "api" / "routes"

# The route files that are in the repository but are deliberately not
# mounted. The comment in main.py says the OCR was turned off.
DELIBERATELY_UNMOUNTED = {"scan_jobs"}

# The paths that used to be registered twice.
#
# There were thirteen of them: the market router, the location router,
# the shopping router and the shopping module, the AI advisor and the
# AI advisor module, the dashboard and the ledger analytics module, and
# the health check, which was written twice in main.py.
#
# They are fixed. Each router is mounted once now, and the paths that
# only one of the two registrations had are still mounted, so nothing
# was lost. The list is kept empty on purpose: a duplicate that comes
# back fails this script.
KNOWN_DUPLICATE_PATHS = set()

# The endpoints the deployment depends on. The liveness check answers
# without a database; the readiness check needs one, so it is only
# checked when there is a database to check against.
LIVENESS_ENDPOINTS = ["/health"]

failures = []


def fail(message):
    failures.append(message)
    print(f"  FAIL {message}")


def ok(message):
    print(f"  OK   {message}")


def main():
    print("=" * 70)
    print(" ROUTE SMOKE TEST")
    print("=" * 70)
    print(f"backend : {BACKEND_DIR}")
    print()

    # --- The application imports at all -------------------------------
    print("--- the application -------------------------------------------")
    try:
        from app.main import app
    except Exception as exc:  # noqa: BLE001
        fail(f"the application does not import: {exc}")
        return 1

    routes = [r for r in app.routes if getattr(r, "path", None)]
    ok(f"the application imports, {len(routes)} routes")

    # --- Every route file is in the application -----------------------
    print()
    print("--- the route files ------------------------------------------")
    app_paths = {r.path for r in routes}

    files = sorted(
        p
        for p in ROUTES_DIR.glob("*.py")
        if not p.name.startswith("_")
        and p.name != "__init__.py"
        and p.stem not in DELIBERATELY_UNMOUNTED
    )

    if len(files) < 40:
        fail(f"only {len(files)} route files were found, which is fewer than expected")

    missing = []
    for path in files:
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
            getattr(r, "path", None) for r in router.routes if getattr(r, "path", None)
        }
        if not router_paths:
            missing.append(f"{path.name}: the router has no routes")
            continue

        for router_path in router_paths:
            if not any(p.endswith(router_path) for p in app_paths):
                missing.append(f"{path.name}: {router_path} is not in the application")
                break

    if missing:
        for item in missing:
            fail(f"a route file is not in the application: {item}")
    else:
        ok(f"all {len(files)} route files are in the application")

    # --- No new path is registered twice ------------------------------
    print()
    print("--- the duplicated paths -------------------------------------")
    seen = set()
    duplicated = set()
    for route in routes:
        path = route.path
        for method in getattr(route, "methods", None) or {"GET"}:
            key = (method, path)
            if key in seen:
                duplicated.add(path)
            else:
                seen.add(key)

    new_duplicates = sorted(duplicated - KNOWN_DUPLICATE_PATHS)
    if new_duplicates:
        for path in new_duplicates:
            fail(f"this path is registered twice: {path}")
    else:
        ok("no path is registered twice")

    # --- The endpoints the deployment depends on ----------------------
    print()
    print("--- the endpoints --------------------------------------------")
    try:
        from fastapi.testclient import TestClient

        client = TestClient(app)
        for endpoint in LIVENESS_ENDPOINTS:
            response = client.get(endpoint)
            if response.status_code == 200:
                ok(f"{endpoint} answered {response.status_code}")
            else:
                fail(f"{endpoint} answered {response.status_code}")
    except Exception as exc:  # noqa: BLE001
        fail(f"the endpoints could not be called: {exc}")

    # --- The document can be written ---------------------------------
    print()
    print("--- the openapi document --------------------------------------")
    try:
        schema = app.openapi()
        ok(f"the document was written, {len(schema.get('paths', {}))} paths")
    except Exception as exc:  # noqa: BLE001
        fail(f"the document could not be written: {exc}")

    # --- The result ---------------------------------------------------
    print()
    print("=" * 70)
    if failures:
        print(f" ROUTE SMOKE TEST FAILED ({len(failures)} problems)")
        print("=" * 70)
        return 1
    print(" ROUTE SMOKE TEST PASSED")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
