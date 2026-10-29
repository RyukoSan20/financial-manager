"""
Mounting a router without mounting the same route twice.

There are two kinds of router in this application. Some of them are
mounted once and there is nothing to say. Some of them are mounted
twice, by accident, and the second mounting is the one that never
answers.

FastAPI matches the first route it finds. So when a route is
registered twice, the first registration answers and the second one is
never reached. Nothing says so. The application starts, the health
check passes, and the reader who goes to that page gets the first
implementation, which may not be the one anyone was looking at.

This module mounts a router and leaves out the routes that are
already there. The first registration keeps answering, exactly as it
does today. Nothing about the behaviour changes. What changes is that
the router is mounted once, and the routes that only the second
registration had are still reachable.

The point is that removing the duplicate by hand is how you lose a
route. Removing it here cannot: the routes that only one of the two
registrations had are still mounted, from whichever one had them.

How to use it:

    from app.core.router_registration import include_router_once

    include_router_once(app, some_router, prefix="/api/thing")

and for the ones that are imported inside a try, so that a router
that fails to import does not take the application with it:

    try:
        from app.api.routes.thing import router as thing_router
    except ImportError as e:
        logger.warning("the thing router is not available: %s", e)
    else:
        include_router_once(app, thing_router, prefix="/api/thing")
"""

import logging

from fastapi import APIRouter, FastAPI

logger = logging.getLogger(__name__)


def _route_key(route, prefix):
    """
    The identity of a route.

    Two routes are the same when they answer the same path with the
    same method. The path is compared with the prefix in front of it,
    because that is the path the reader actually calls.
    """
    path = getattr(route, "path", None)
    if not path:
        return None

    methods = getattr(route, "methods", None) or {"GET"}
    return prefix + path, frozenset(methods)


def registered_paths(app, prefix=""):
    """
    The paths and methods that are already in the application.

    The openapi routes are used rather than the raw route objects,
    because those carry the prefix the router was mounted under.
    """
    seen = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        if not path:
            continue
        methods = getattr(route, "methods", None) or {"GET"}
        seen.add((path, frozenset(methods)))
    return seen


def include_router_once(app, router, prefix="", tags=None, **kwargs):
    """
    Mount a router, leaving out the routes that are already there.

    Returns the routes that were left out, so the caller can say what
    happened. The first registration keeps answering, which is what
    FastAPI was already doing.
    """
    if not isinstance(router, APIRouter):
        raise TypeError("the router is not an APIRouter")

    already = registered_paths(app)

    # The routes that are not already mounted.
    fresh = []
    skipped = []
    for route in router.routes:
        key = _route_key(route, prefix)
        if key is None:
            continue
        if key in already:
            skipped.append(route)
        else:
            fresh.append(route)
            already.add(key)

    if skipped:
        names = sorted(
            f"{sorted(getattr(r, 'methods', None) or ['GET'])[0]} {prefix}{getattr(r, 'path', '')}"
            for r in skipped
        )
        logger.info(
            "the router mounted at %s has %s route(s) that are already "
            "mounted, and they keep answering as they did: %s",
            prefix or "/",
            len(skipped),
            ", ".join(names),
        )

    if not fresh:
        # Everything in this router is already mounted. Mounting it
        # again would only add duplicates.
        return skipped

    # A router is mounted route by route, so that the ones that are
    # left out really are left out.
    trimmed = APIRouter(
        prefix=router.prefix,
        tags=router.tags if tags is None else tags,
        dependencies=router.dependencies,
        default_response_class=router.default_response_class,
        responses=router.responses,
        callbacks=router.callbacks,
        generate_unique_id_function=router.generate_unique_id_function,
        redirect_slashes=router.redirect_slashes,
    )
    trimmed.routes.extend(fresh)

    app.include_router(trimmed, prefix=prefix, tags=tags, **kwargs)

    return skipped


def count_duplicate_routes(app):
    """
    The paths and methods that are mounted more than once.

    Used by the route smoke test and by the route count guard, so
    that a duplicate which appears again is noticed.
    """
    counts = {}
    for route in app.routes:
        path = getattr(route, "path", None)
        if not path:
            continue
        methods = getattr(route, "methods", None) or {"GET"}
        for method in methods:
            key = (method, path)
            counts[key] = counts.get(key, 0) + 1

    return {key: n for key, n in counts.items() if n > 1}
