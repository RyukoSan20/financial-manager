"""
Where a place is, and what kind of place it is.

The map used to say "Area Jakarta" for every merchant it could not
place. That is not an address. A reader who sees "Area Jakarta" on a
map learns nothing they did not already know, and the pin sits in the
middle of the city because the city was all the application knew.

What the application actually knows about a place is more than that:

    - the name of the shop ("Indomaret Kemang");
    - the street it is on ("Jl. Kemang Raya No. 12");
    - what kind of place it is, so that the pin can be the right
      shape: a minimarket is not a supermarket, and a supermarket is
      not a restaurant.

So a place is resolved from the name and the address together, and
the answer says how exact it is. A place found by its street is
"street" precise. A place that is only a brand, with no street to be
found on, is "brand" precise: the pin is in the middle of the city
the brand trades in, and the reader is told that it is, because a pin
that lies about being a shop is worse than no pin at all.

The kinds of place are the ones the generated pins are drawn for, so
that a minimarket and a supermarket do not look the same on the map.
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from app.services.geocoding_service import GeocodingService

from app.services.geocoding_service import GeoLocation, geocoding_service


# The kinds of place the pins are drawn for.
#
# The order matters: the first kind that is found is the kind that is
# used, so the more specific ones come first. A "supermarket" that
# also says "fresh" is a supermarket, because the shopfront is what
# the reader recognises.
KIND_MINIMARKET = "minimarket"
KIND_SUPERMARKET = "supermarket"
KIND_RESTAURANT = "restaurant"
KIND_FRESH_PRODUCE = "fresh_produce"
KIND_OTHER = "other"

# The words that mean each kind, and the words that must not be read
# as a place of that kind.
#
# "mart" alone would read a supermarket as a minimarket, so the
# supermarket words are checked first.
MINIMARKET_WORDS = (
    "indomaret",
    "alfamart",
    "alfamidi",
    "warung",
    "mini market",
    "minimarket",
    "convenience",
    "kelontong",
    "sari roti",
    "kopi kenzo",
    "lawson",
    "circle k",
    "alfamart",
    "alfamidi",
)

SUPERMARKET_WORDS = (
    "supermarket",
    "super market",
    "superindo",
    "carrefour",
    "hypermart",
    "grand indonesia",
    "trans retail",
    "lottemart",
    "lotte mart",
    "rfd",
)

RESTAURANT_WORDS = (
    "restaurant",
    "restoran",
    "cafe",
    "kafe",
    "kedai kopi",
    "warung makan",
    "bakso",
    "sate",
    "pecel",
    "rumah makan",
    "food court",
    "pizza",
    "burger",
    "sushi",
    "ramen",
)

FRESH_PRODUCE_WORDS = (
    "fresh",
    "sayur",
    "buah",
    "pangan",
    "organic",
    "veggie",
    "vegetable",
    "fruit",
    "market segar",
    "tani",
    "pertanian",
)

# The words that say a place is not what it looks like. A "cafe" in
# the name of a "cafe supplies" shop is not a cafe.
NOT_A_PLACE_WORDS = (
    "supplies",
    "equipment",
    "parts",
    "services",
    "consultant",
    "digital",
    "online",
    "system",
    "software",
)


@dataclass
class ResolvedPlace:
    """
    A place, and how well it was found.

    `latitude` and `longitude` are the point on the map. `address`
    is the street the place is on, or the city when the street was
    not found. `precision` says which of the two it is: "street",
    "brand", or "city".
    """

    name: str
    latitude: float
    longitude: float
    address: str
    kind: str = KIND_OTHER
    precision: str = "city"
    confidence: float = 0.5
    # The store name that was found, when it is not the same as the
    # name that was asked about. A map of "Indomaret" should say
    # "Indomaret Kemang" when that is the shop it found.
    store_name: Optional[str] = None
    # The street the place is on, and the place nearest to it.
    #
    # The address is a single line, and a line that has to hold a
    # street, a district, a city and a country stops being readable
    # part way through. These two are the parts a reader can act on:
    # the street to look for, and the name of the shop next door that
    # tells them they have arrived.
    street: Optional[str] = None
    nearest_place: Optional[str] = None

    @property
    def is_exact(self) -> bool:
        """Whether the coordinates point at the shop itself."""
        return self.precision == "street"


def _clean(text: Optional[str]) -> str:
    """A piece of text, tidied."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()


def kind_of(name: str, address: str = "") -> str:
    """
    What kind of place this is.

    The kind decides which pin is drawn, so that a minimarket and a
    supermarket do not look the same on the map.
    """
    haystack = f"{_clean(name)} {_clean(address)}".lower()

    if any(word in haystack for word in NOT_A_PLACE_WORDS):
        return KIND_OTHER

    if any(word in haystack for word in SUPERMARKET_WORDS):
        return KIND_SUPERMARKET

    if any(word in haystack for word in FRESH_PRODUCE_WORDS):
        return KIND_FRESH_PRODUCE

    if any(word in haystack for word in RESTAURANT_WORDS):
        return KIND_RESTAURANT

    if any(word in haystack for word in MINIMARKET_WORDS):
        return KIND_MINIMARKET

    return KIND_OTHER


def _street_of(address: str) -> str:
    """
    The street part of an address.

    An address is a street, then a sub-area, then a city, then a
    country, separated by commas. The street is the first part, and
    it is the part a reader can use to find the place.
    """
    cleaned = _clean(address)
    if not cleaned:
        return ""
    return cleaned.split(",")[0].strip()


def _city_of(location: GeoLocation, address: str = "") -> str:
    """The city of a place, from the answer or from the address."""
    if location and location.city:
        return location.city
    parts = [part.strip() for part in _clean(address).split(",") if part.strip()]
    if len(parts) >= 2:
        return parts[1]
    if parts:
        return parts[0]
    return ""


def resolve_place(
    merchant_name: Optional[str],
    merchant_address: Optional[str] = None,
    city: Optional[str] = None,
) -> Optional[ResolvedPlace]:
    """
    Where a merchant is, and what kind of place it is.

    The name and the address are looked for together first, because a
    shop with a street is found by its street. The name on its own is
    looked for second, for the shops whose address the reader never
    wrote down.

    Nothing is invented. When neither can be found, there is no
    answer, and the caller is told so rather than being given the
    middle of Jakarta.
    """
    the_name = _clean(merchant_name)
    the_address = _clean(merchant_address)

    if not the_name and not the_address:
        return None

    # The name and the address together. This is the one that finds
    # the shop rather than the brand.
    attempts = []
    if the_name and the_address:
        attempts.append(f"{the_name}, {the_address}")
    if the_address:
        attempts.append(the_address)
    if the_name:
        attempts.append(the_name)

    for attempt in attempts:
        location = geocoding_service.geocode(attempt, city)
        if location is None:
            continue

        # An answer that is only the city is not an answer about the
        # shop. It is kept, but it is kept as what it is.
        precision = location.precision if hasattr(location, "precision") else "street"
        street = _street_of(location.formatted_address or "")

        if precision == "street" and street:
            return ResolvedPlace(
                name=the_name or street,
                latitude=location.latitude,
                longitude=location.longitude,
                address=location.formatted_address,
                kind=kind_of(the_name, the_address or location.formatted_address),
                precision="street",
                confidence=location.confidence,
                store_name=the_name or None,
                street=getattr(location, "street", None) or street,
                nearest_place=getattr(location, "nearest_place", None),
            )

        # A brand that is known, but with no street behind it. The
        # pin goes in the middle of the city and the reader is told
        # that is what it is.
        if location.precision == "city" or precision == "city":
            return ResolvedPlace(
                name=the_name or location.formatted_address,
                latitude=location.latitude,
                longitude=location.longitude,
                address=location.formatted_address or _city_of(location, the_address),
                kind=kind_of(the_name, the_address),
                precision="brand",
                confidence=location.confidence,
                store_name=None,
                street=getattr(location, "street", None),
                nearest_place=getattr(location, "nearest_place", None),
            )

    return None


def resolve_coordinates(latitude: float, longitude: float) -> Optional[ResolvedPlace]:
    """
    Ask what is at a point.

    A pin that stands on real coordinates is exact in one sense: the
    coordinates are where the reader's own phone said they were. But
    nobody had asked what was there, so the popup could not name the
    street or the shop next door.

    This asks the geocoder, and answers with the same shape as
    everything else on the map. When the geocoder finds nothing, or
    falls over, the answer is nothing, and the caller leaves the pin
    as it was.
    """
    try:
        location = GeocodingService().reverse_geocode(latitude, longitude)
    except Exception:  # noqa: BLE001 - the map must not break
        return None

    if location is None:
        return None

    street = getattr(location, "street", None)
    nearest_place = getattr(location, "nearest_place", None)
    precision = getattr(location, "precision", "city") or "city"

    # The name of the place is what the reader sees first, so the
    # street is preferred over the bare address.
    name = (
        street
        or nearest_place
        or getattr(location, "formatted_address", "")
        or f"({latitude:.4f}, {longitude:.4f})"
    )

    # The kind decides the shape of the pin, and it is worked out from
    # what was found rather than from the coordinates.
    kind = kind_of(name, street or "")

    return ResolvedPlace(
        name=name,
        latitude=float(getattr(location, "latitude", latitude)),
        longitude=float(getattr(location, "longitude", longitude)),
        address=getattr(location, "formatted_address", "") or "",
        kind=kind,
        precision=precision,
        confidence=float(getattr(location, "confidence", 0.5) or 0.5),
        street=street,
        nearest_place=nearest_place,
    )


def pin_for(kind: str) -> str:
    """
    The pin that is drawn for a kind of place.

    The pins are the ones the generator made, so that the shape of a
    pin on the map is the shape of the thing it stands for.
    """
    known = {
        KIND_MINIMARKET: "pin-minimarket",
        KIND_SUPERMARKET: "pin-supermarket",
        KIND_RESTAURANT: "pin-restaurant",
        KIND_FRESH_PRODUCE: "pin-fresh-produce",
    }
    return known.get(kind, "pin-minimarket")


# The categories that mean the money went on vegetables rather than
# on food that was cooked.
#
# A shop that is a minimarket is a minimarket, whichever aisle the
# reader was standing in. But a shop that sells only produce is a
# different kind of shop from one that has a bakery in it, and the
# pin says so.
FRESH_CATEGORY_WORDS = (
    "sayur",
    "buah",
    "vegetable",
    "fresh",
    "pangan",
    "organik",
    "organic",
    "segar",
    "tani",
    "horta",
)


def kind_for(
    name: str,
    address: str = "",
    category: Optional[str] = None,
) -> str:
    """
    The kind of place, taking the spending category into account.

    The name and the address say what kind of shop it is. The
    category says what the reader was actually buying there. Both are
    needed, because "Alfamart" under "Makanan & Minuman" and
    "Alfamart" under "Buah & Sayur" are the same shop but not the
    same story, and the pin is what tells the reader which one it is
    looking at.

    A place that is plainly a shop of one kind keeps that kind: a
    restaurant stays a restaurant, whatever was ordered there. The
    category only decides the kind when the name does not say.
    """
    kind = kind_of(name, address)

    if kind != KIND_OTHER:
        return kind

    lowered = _clean(category).lower()
    if lowered and any(word in lowered for word in FRESH_CATEGORY_WORDS):
        return KIND_FRESH_PRODUCE

    if lowered and any(word in lowered for word in ("makanan", "food", "restoran", "minuman")):
        return KIND_RESTAURANT

    return kind
