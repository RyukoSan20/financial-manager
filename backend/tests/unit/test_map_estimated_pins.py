"""
The map must account for the spending it is given.

The map page was showing "0 Lokasi" and "Rp 0" for a reader with
transactions. Not because the reader had spent nothing, but because
the map dropped every transaction whose shop it could not find on the
map.

That was a decision made in the right direction for the wrong reason.
A pin in the wrong place is worse than no pin - but a pin that is
obviously approximate, and says so, is not a pin in the wrong place.
It is a pin that says "I know this was spent around here, and you can
tell me exactly where".

So: a transaction whose shop cannot be placed is put on the map at a
deterministic district or city coordinate, marked as estimated, and
the reader is told that the pin is approximate and can be refined.

The spending must be accounted for. `Total Lokasi` and
`Total Pengeluaran` must reflect the transactions the reader actually
has.
"""

import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.services.place_resolution_service import resolve_place  # noqa: E402


def test_the_placeholder_pin_is_marked_as_estimated():
    """
    A pin that is an estimate must say it is one.

    The reader has to be able to tell the difference between "this is
    where you spent it" and "this is roughly where you spent it".
    """
    from app.api.routes.analytics import _estimated_marker

    marker = _estimated_marker(
        merchant_name="Warung Bu Tuti",
        merchant_address="",
        category="Makanan & Minuman",
        total_spent=25000.0,
        visit_count=1,
        avg_spent=25000.0,
    )

    assert marker is not None, "the spending was dropped again"
    assert marker["is_estimated"] is True, (
        "the pin does not say it is an estimate"
    )
    assert marker["precision"] == "district", (
        f"the pin claims to be {marker['precision']!r} precise, but it "
        "is only known to be in the area"
    )
    assert isinstance(marker["latitude"], float)
    assert isinstance(marker["longitude"], float)
    # Jakarta, because that is where the reader is.
    assert marker["latitude"] < 0 and marker["longitude"] > 100


def test_the_placeholder_is_the_same_every_time():
    """
    A pin that moves is a pin that cannot be found.

    The coordinate is worked out from the name of the shop, so the
    same shop is always in the same place.
    """
    from app.api.routes.analytics import _estimated_marker

    first = _estimated_marker(
        merchant_name="Warung Bu Tuti",
        merchant_address="",
        category="Makanan & Minuman",
        total_spent=25000.0,
        visit_count=1,
        avg_spent=25000.0,
    )
    second = _estimated_marker(
        merchant_name="Warung Bu Tuti",
        merchant_address="",
        category="Makanan & Minuman",
        total_spent=25000.0,
        visit_count=1,
        avg_spent=25000.0,
    )

    assert first["latitude"] == second["latitude"]
    assert first["longitude"] == second["longitude"]


def test_a_different_shop_gets_a_different_placeholder():
    """Two shops are not the same place."""
    from app.api.routes.analytics import _estimated_marker

    first = _estimated_marker(
        merchant_name="Warung Bu Tuti",
        merchant_address="",
        category="Makanan & Minuman",
        total_spent=25000.0,
        visit_count=1,
        avg_spent=25000.0,
    )
    second = _estimated_marker(
        merchant_name="Kopi Starbucks",
        merchant_address="",
        category="Makanan & Minuman",
        total_spent=25000.0,
        visit_count=1,
        avg_spent=25000.0,
    )

    assert (first["latitude"], first["longitude"]) != (
        second["latitude"],
        second["longitude"],
    ), "two different shops were put in the same place"


def test_a_city_in_the_address_is_used():
    """When the reader wrote the city down, that is where the pin goes."""
    from app.api.routes.analytics import _estimated_marker

    marker = _estimated_marker(
        merchant_name="Warung Sederhana",
        merchant_address="Jl. Malioboro, Yogyakarta",
        category="Makanan & Minuman",
        total_spent=25000.0,
        visit_count=1,
        avg_spent=25000.0,
    )

    # Yogyakarta, not Jakarta.
    assert marker["latitude"] == pytest.approx(-7.7956, abs=0.01), (
        f"the pin was put at {marker['latitude']}, but the address "
        "says Yogyakarta"
    )


def test_the_resolver_still_says_no_when_it_finds_nothing():
    """
    The resolver itself still refuses to invent a place.

    The placeholder is the caller's business, not the resolver's.
    """
    with patch(
        "app.services.geocoding_service.GeocodingService.geocode",
        return_value=None,
    ):
        place = resolve_place("Warung Bu Tuti Yang Tidak Ada Di Mana Pun", None)

    assert place is None, (
        "the resolver invented a place instead of saying it found none"
    )
