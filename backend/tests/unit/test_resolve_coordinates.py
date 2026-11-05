"""
A pin that stands on real coordinates should be able to say where it is.

Two kinds of pin end up on the map:

- a merchant the reader knows by name, which is looked up,
- a point the reader's own phone recorded, which has coordinates.

The pins from coordinates used to be marked as street-precise without
ever being looked up. They were exact in the sense that the
coordinates were real, but nobody had asked what was at those
coordinates, so the popup could not name the street or the shop next
door.

A point that has coordinates can be asked. These checks are about that
ask happening, and about the answer being used honestly:

- the street is looked up,
- the place next door is looked up,
- the precision reflects what came back, not what was hoped for,
- a lookup that fails leaves the pin alone rather than breaking it.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services.place_resolution_service import (  # noqa: E402
    ResolvedPlace,
    resolve_coordinates,
)


@pytest.fixture
def located():
    """A geocoder that found a street."""
    from app.services.geocoding_service import GeoLocation

    location = GeoLocation(
        latitude=-6.2610,
        longitude=106.8145,
        formatted_address="Jalan Kemang Raya, Jakarta Selatan",
        city="Jakarta Selatan",
        country="Indonesia",
        confidence=0.8,
        precision="street",
        street="Jalan Kemang Raya",
        nearest_place="Bakery",
    )
    return location


def test_a_point_with_coordinates_is_looked_up(located):
    with patch(
        "app.services.place_resolution_service.GeocodingService"
    ) as service:
        instance = MagicMock()
        instance.reverse_geocode.return_value = located
        service.return_value = instance

        place = resolve_coordinates(-6.2610, 106.8145)

    assert place is not None
    assert instance.reverse_geocode.called, "the point was asked about"
    assert place.street == "Jalan Kemang Raya"
    assert place.nearest_place == "Bakery"
    assert place.precision == "street"


def test_the_precision_follows_the_answer(located):
    """A village is not a street, and the pin has to say so."""
    located.precision = "district"
    located.street = None
    located.nearest_place = None

    with patch(
        "app.services.place_resolution_service.GeocodingService"
    ) as service:
        instance = MagicMock()
        instance.reverse_geocode.return_value = located
        service.return_value = instance

        place = resolve_coordinates(-6.2606, 106.8136)

    assert place is not None
    assert place.precision == "district"
    assert place.is_exact is False


def test_a_lookup_that_finds_nothing_leaves_the_pin_alone():
    with patch(
        "app.services.place_resolution_service.GeocodingService"
    ) as service:
        instance = MagicMock()
        instance.reverse_geocode.return_value = None
        service.return_value = instance

        place = resolve_coordinates(-6.2606, 106.8136)

    assert place is None


def test_a_lookup_that_breaks_leaves_the_pin_alone():
    """The map must not break because a geocoder is unwell."""
    with patch(
        "app.services.place_resolution_service.GeocodingService"
    ) as service:
        instance = MagicMock()
        instance.reverse_geocode.side_effect = RuntimeError("the geocoder fell over")
        service.return_value = instance

        place = resolve_coordinates(-6.2606, 106.8136)

    assert place is None


def test_the_kind_is_worked_out_from_what_was_found():
    """A pin over a shop is shaped like a shop."""
    with patch(
        "app.services.place_resolution_service.GeocodingService"
    ) as service:
        instance = MagicMock()
        instance.reverse_geocode.return_value = MagicMock(
            latitude=-6.2610,
            longitude=106.8145,
            formatted_address="Jalan Kemang Raya, Jakarta Selatan",
            city="Jakarta Selatan",
            country="Indonesia",
            confidence=0.8,
            precision="street",
            street="Jalan Kemang Raya",
            nearest_place="Bakery",
        )
        service.return_value = instance

        place = resolve_coordinates(-6.2610, 106.8145)

    assert place is not None
    assert place.kind, "the pin is given a shape"
    assert place.latitude == -6.2610
    assert place.longitude == 106.8145


def test_a_place_built_by_hand_is_still_a_place():
    """The shape of the answer is the shape of the other answers."""
    place = ResolvedPlace(
        latitude=-6.2610,
        longitude=106.8145,
        name="Jl. Kemang Raya No. 12",
        address="Jakarta Selatan",
        precision="street",
        street="Jalan Kemang Raya",
        nearest_place="Bakery",
    )
    assert place.is_exact is True
