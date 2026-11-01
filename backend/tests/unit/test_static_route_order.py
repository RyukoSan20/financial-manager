"""
A route that has a name in it has to be found before the route that
takes any name.

The debts router has a route for one debt, `/debts/{debt_id}`, and it
also has routes with names in them, `/debts/split-receivables` and
`/debts/summary/all`. FastAPI matches routes in the order they were
registered, so a route for one debt that was registered first will
swallow the named ones. The reader then gets "Input should be a valid
integer" for a request that had no number in it at all.

Same thing on the transfers router: `/transfers/{transfer_id}` versus
`/transfers/split-reimbursements`, and `/transfers/summary/total`.

These tests look at the order the routes were registered in. They do
not need a database, because the order is decided when the module is
read, not when a request comes in.
"""

import re

import pytest
from fastapi.routing import APIRoute


def _routes_of(router):
    return [r for r in router.routes if isinstance(r, APIRoute)]


def _position_of(routes, path):
    """Where the route with this path sits in the order."""
    for index, route in enumerate(routes):
        if route.path == path:
            return index
    return None


@pytest.mark.parametrize(
    "module_name,named_path,path_that_takes_a_name",
    [
        ("app.api.routes.debts", "/split-receivables", "/{debt_id}"),
        ("app.api.routes.debts", "/summary/all", "/{debt_id}"),
        ("app.api.routes.transfers", "/split-reimbursements", "/{transfer_id}"),
        ("app.api.routes.transfers", "/summary/total", "/{transfer_id}"),
        ("app.api.routes.goals", "/summary", "/{goal_id}"),
    ],
)
def test_named_route_comes_before_the_one_that_takes_a_name(
    module_name, named_path, path_that_takes_a_name
):
    """The named route has to be registered first."""
    module = __import__(module_name, fromlist=["router"])
    routes = _routes_of(module.router)

    named_at = _position_of(routes, named_path)
    assert named_at is not None, f"{named_path} is not registered at all"

    takes_a_name_at = _position_of(routes, path_that_takes_a_name)
    assert takes_a_name_at is not None

    assert named_at < takes_a_name_at, (
        f"{named_path} is registered after {path_that_takes_a_name}, "
        f"so the request never reaches it"
    )


def test_the_debt_id_route_is_not_able_to_swallow_the_named_ones():
    """
    The request that broke, spelled out.

    A reader asks for the money a friend owes them. The router must
    not try to read "split-receivables" as a number.
    """
    from app.api.routes.debts import router

    routes = _routes_of(router)
    split_at = _position_of(routes, "/split-receivables")
    debt_id_at = _position_of(routes, "/{debt_id}")

    assert split_at is not None and debt_id_at is not None
    assert split_at < debt_id_at


def test_no_named_route_is_shadowed_anywhere_in_the_app():
    """
    The whole app, checked at once.

    A route with a name in it, registered after a route that takes
    any name, is a route the reader cannot reach. It answers "Input
    should be a valid integer" instead of doing its job. This is the
    kind of thing that only shows up when a screen quietly never
    loads, so it is checked for every router, not only the ones that
    were reported broken.
    """
    from app.main import app

    routes = [r for r in app.routes if isinstance(r, APIRoute)]
    shadowed = []

    for index, route in enumerate(routes):
        if "{" in route.path:
            continue
        for earlier in routes[:index]:
            if "{" not in earlier.path:
                continue
            # A route that only answers POST does not get in the way
            # of a GET. The router tries the next route when the
            # method does not fit.
            if not (earlier.methods or set()) & (route.methods or set()):
                continue
            pattern = re.sub(r"\{[^}]+\}", r"[^/]+", earlier.path)
            if re.fullmatch(pattern, route.path):
                shadowed.append(f"{route.path} is taken by {earlier.path}")
                break

    assert not shadowed, "Routes that cannot be reached: " + "; ".join(shadowed)
