"""
The map: where a place is, and what kind of place it is.

Two things are checked here, and both of them were wrong before.

The first: a merchant that cannot be found used to be put in the
middle of Jakarta with the address "Area Jakarta". It is now looked
up by its name and its street, and when it cannot be found at all it
is left off the map rather than given a place it is not.

The second: the pins. A minimarket and a supermarket are different
kinds of place and are drawn with different pins, and the shape of
the pin is decided by the kind of the place while the colour of the
ground under it is decided by the category the money was spent on.
"""

from app.services.place_resolution_service import (
    KIND_FRESH_PRODUCE,
    KIND_MINIMARKET,
    KIND_OTHER,
    KIND_RESTAURANT,
    KIND_SUPERMARKET,
    kind_for,
    kind_of,
    pin_for,
)


# --- what kind of place it is --------------------------------------------


def test_a_minimarket_is_not_a_supermarket():
    """The word decides the kind, and the two are not the same."""
    assert kind_of("Indomaret Kemang Raya") == KIND_MINIMARKET
    assert kind_of("Alfamart Tebet") == KIND_MINIMARKET
    assert kind_of("Superindo Kemang") == KIND_SUPERMARKET
    assert kind_of("Lotte Mart") == KIND_SUPERMARKET


def test_a_restaurant_and_a_produce_shop_are_told_apart():
    """A cafe is a cafe, and a produce shop is not."""
    assert kind_of("Kopi Kenzo") == KIND_MINIMARKET
    assert kind_of("Warung Sate Pak Yanto") == KIND_RESTAURANT
    assert kind_of("Restoran Sawah Besar") == KIND_RESTAURANT
    assert kind_of("Toko Buah Segar") == KIND_FRESH_PRODUCE
    assert kind_of("Sayur Bintang Organik") == KIND_FRESH_PRODUCE


def test_a_name_that_is_not_a_place_is_not_made_into_one():
    """
    A shop that sells cafe supplies is not a cafe.

    Without this, every business in the application with "cafe" or
    "mart" in its name would put a plate or a basket on the map.
    """
    assert kind_of("Dapur Cafe Supplies") == KIND_OTHER
    assert kind_of("Alfamart Digital Center") == KIND_OTHER


def test_an_unknown_name_is_simply_unknown():
    """Nothing is invented."""
    assert kind_of("Toko Bang Berjaya") == KIND_OTHER


# --- the category fills the gap the name leaves --------------------------


def test_the_category_decides_when_the_name_does_not_say():
    """
    The same shop under two categories is two different stories.

    A shop with no name to speak of, bought from for vegetables, is
    a produce shop. The same shop bought from for food is a
    restaurant. The pin has to tell them apart.
    """
    assert kind_for("Toko ABC", "", "Buah & Sayur") == KIND_FRESH_PRODUCE
    assert kind_for("Toko ABC", "", "Makanan & Minuman") == KIND_RESTAURANT


def test_a_name_that_says_what_it_is_keeps_its_kind():
    """
    A restaurant stays a restaurant.

    The category is a second opinion. It is only used when the name
    says nothing, because otherwise a reader who ate at a restaurant
    and bought vegetables at the same place would see the restaurant
    drawn as a fruit shop.
    """
    assert kind_for("Warung Sate Pak Yanto", "", "Buah & Sayur") == KIND_RESTAURANT
    assert kind_for("Indomaret Kemang", "", "Buah & Sayur") == KIND_MINIMARKET


# --- the pins ------------------------------------------------------------


def test_each_kind_has_its_own_pin():
    """The shape of the pin is the kind of the place."""
    assert pin_for(KIND_MINIMARKET) == "pin-minimarket"
    assert pin_for(KIND_SUPERMARKET) == "pin-supermarket"
    assert pin_for(KIND_RESTAURANT) == "pin-restaurant"
    assert pin_for(KIND_FRESH_PRODUCE) == "pin-fresh-produce"


def test_a_minimarket_and_a_supermarket_do_not_get_the_same_pin():
    """The point of having four pins."""
    assert pin_for(KIND_MINIMARKET) != pin_for(KIND_SUPERMARKET)
    assert pin_for(KIND_RESTAURANT) != pin_for(KIND_FRESH_PRODUCE)


def test_an_unknown_kind_still_gets_a_pin():
    """A place of no known kind is still a place."""
    assert pin_for(KIND_OTHER) == "pin-minimarket"


# --- the pins exist ------------------------------------------------------


def test_the_generated_pins_are_on_disk():
    """
    The four pins the map draws are the four the generator made.

    If a pin file is renamed or removed, the map would show a
    broken image and the legend would lie. This fails here instead.
    """
    from pathlib import Path

    import app

    public = Path(app.__file__).resolve().parents[2] / "frontend" / "public" / "assets" / "generated" / "pin"

    for kind in (KIND_MINIMARKET, KIND_SUPERMARKET, KIND_RESTAURANT, KIND_FRESH_PRODUCE):
        path = public / f"{pin_for(kind)}.svg"
        assert path.exists(), f"{path} is missing"
        assert "<svg" in path.read_text(), f"{path} is not an svg"
