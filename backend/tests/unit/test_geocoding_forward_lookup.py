"""
The forward lookup has to find the place it was asked about.

The geocoder has two directions. It can be given a name and asked
where that is - the forward lookup - and it can be given a point and
asked what is there - the reverse lookup.

The forward lookup was broken. It built the answer with the street
and the nearest place, and it had never assigned either of them in
that branch, so every forward lookup raised a NameError. The error
was caught and printed, and the method returned nothing, so the place
was never found.

The map coped with it - it fell back to an estimated pin - but the
reader was told the map was approximate when it did not have to be.
A shop whose name could be looked up was drawn as a guess.

These checks hold that a forward lookup finds the place, names the
street it is on, and says how exact it is.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services.geocoding_service import GeocodingService  # noqa: E402


def _forward_payload(address, display_name="Jalan Kemang Raya, Jakarta"):
    """What the geocoder sends back for a forward lookup."""
    return [
        {
            "lat": "-6.2606",
            "lon": "106.8136",
            "display_name": display_name,
            "address": address,
        }
    ]


@pytest.fixture
def service():
    return GeocodingService()


def _forward(service, payload):
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    with patch.object(service.session, "get", return_value=response):
        return service.geocode("Jalan Kemang Raya 12, Jakarta")


def test_a_place_with_a_street_is_found(service):
    """The lookup answers with the place it found."""
    answer = _forward(
        service,
        _forward_payload(
            {
                "road": "Jalan Kemang Raya",
                "house_number": "12",
                "city": "Jakarta Selatan",
                "country": "Indonesia",
            }
        ),
    )

    assert answer is not None, "the forward lookup found nothing"
    assert answer.latitude == pytest.approx(-6.2606)
    assert answer.longitude == pytest.approx(106.8136)


def test_the_street_is_named(service):
    """The street is read out of the answer.

    The street is what turns a point on a map into a door the reader
    can find. It was the thing the broken branch never assigned.
    """
    answer = _forward(
        service,
        _forward_payload(
            {
                "road": "Jalan Kemang Raya",
                "house_number": "12",
                "city": "Jakarta Selatan",
            }
        ),
    )

    assert answer is not None, "the forward lookup found nothing"
    assert answer.street is not None, "the street is not named"
    assert "Kemang Raya" in answer.street
    # The house number is kept with it, because "Jalan Kemang Raya"
    # without the number is half an address.
    assert "12" in answer.street


def test_the_precision_says_what_the_answer_holds(service):
    """A road was found, so the answer is a street."""
    answer = _forward(
        service,
        _forward_payload(
            {
                "road": "Jalan Kemang Raya",
                "house_number": "12",
                "city": "Jakarta Selatan",
            }
        ),
    )

    assert answer is not None, "the forward lookup found nothing"
    assert answer.precision == "street"


def test_a_village_is_not_called_a_street(service):
    """No road, but a village: the answer is a district."""
    answer = _forward(
        service,
        _forward_payload(
            {
                "village": "Mampang Prapatan",
                "city": "Jakarta Selatan",
            }
        ),
    )

    assert answer is not None, "the forward lookup found nothing"
    assert answer.precision == "district"
    assert answer.street is None


def test_the_nearest_place_is_found(service):
    """The place next to the point is read out of the answer."""
    answer = _forward(
        service,
        _forward_payload(
            {
                "road": "Jalan Kemang Raya",
                "building": "Bakery",
                "city": "Jakarta Selatan",
            }
        ),
    )

    assert answer is not None, "the forward lookup found nothing"
    assert answer.nearest_place == "Bakery"


def test_a_lookup_that_raises_does_not_take_the_map_down(service):
    """A broken answer is no answer, and the map carries on.

    The reader is shown a pin either way. What matters is that one
    bad answer from the geocoder does not take the whole page with
    it.
    """
    response = MagicMock()
    response.status_code = 500
    response.raise_for_status.side_effect = RuntimeError("the geocoder is down")
    with patch.object(service.session, "get", return_value=response):
        answer = service.geocode("Jalan Kemang Raya 12, Jakarta")

    assert answer is None
