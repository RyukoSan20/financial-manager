"""
The address has to be able to say how exact it is.

The map draws a pin, and under it the address. The address comes from
the geocoder, and the geocoder answers at whatever depth it can:

- sometimes it names the road and the building,
- sometimes it only knows the district.

The service was marking every reverse geocode as "street" precision
regardless of what came back. So a pin over a village in Bangka -
where the geocoder gave no road at all - was labelled as a street
answer, and the reader was told a level of exactness the answer did
not have.

The rule is simple. The precision is what the answer actually holds:

- a road was found, the answer is a street,
- no road but a district or a village was found, the answer is a
  district,
- nothing more than a city, the answer is a city.

The precision may never claim more than the answer carries.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services.geocoding_service import GeocodingService  # noqa: E402


def _reverse_payload(address, namedetails=None):
    """What the geocoder sends back."""
    return {
        "lat": "-6.2606",
        "lon": "106.8136",
        "display_name": "RW 05, Bangka, Mampang Prapatan, Jakarta Selatan",
        "address": address,
        "namedetails": namedetails or [],
    }


@pytest.fixture
def service():
    return GeocodingService()


def _reverse(service, payload):
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    with patch.object(service.session, "get", return_value=response):
        return service.reverse_geocode(-6.2606, 106.8136)


def test_a_road_makes_the_answer_a_street(service):
    answer = _reverse(service, _reverse_payload({
        "road": "Jalan Kemang Raya",
        "house_number": "12",
        "city": "Jakarta Selatan",
        "country": "Indonesia",
    }))

    assert answer is not None
    assert answer.precision == "street"
    assert answer.street == "Jalan Kemang Raya No. 12"


def test_a_place_without_a_road_is_not_called_a_street(service):
    """The village case, and the reason this test exists."""
    answer = _reverse(service, _reverse_payload({
        "village": "Bangka",
        "suburb": "Mampang Prapatan",
        "city": "Jakarta Selatan",
        "country": "Indonesia",
    }))

    assert answer is not None
    assert answer.street is None
    assert answer.precision != "street", (
        "an answer with no road in it must not claim to be a street"
    )


def test_the_precision_is_never_better_than_the_answer(service):
    """Whatever comes back, the label has to be honest about it."""
    cases = [
        ({"road": "Jalan Kemang Raya", "city": "Jakarta Selatan"}, "street"),
        ({"village": "Bangka", "city": "Jakarta Selatan"}, "district"),
        ({"suburb": "Kemang"}, "district"),
        ({"city": "Jakarta Selatan"}, "city"),
        ({"country": "Indonesia"}, "city"),
    ]

    for address, floor in cases:
        answer = _reverse(service, _reverse_payload(dict(address)))
        assert answer is not None
        order = ["city", "district", "street"]
        assert order.index(answer.precision) >= order.index(floor), (
            f"{address} came back as {answer.precision}, which is more "
            f"exact than the answer holds"
        )


def test_the_place_next_door_is_kept(service):
    """The shop next door is what turns a pin into an address."""
    answer = _reverse(service, _reverse_payload({
        "road": "Jalan Kemang Raya",
        "city": "Jakarta Selatan",
        "amenity": "Bakery",
    }))

    assert answer is not None
    assert answer.nearest_place == "Bakery"


def test_a_named_place_is_kept_when_the_address_is_bare(service):
    answer = _reverse(service, _reverse_payload(
        {"village": "Bangka", "city": "Jakarta Selatan"},
        namedetails=[{"name": "Warung Pak JJ"}],
    ))

    assert answer is not None
    assert answer.nearest_place == "Warung Pak JJ"
