"""
One purchase, one row.

A receipt is read by more than one reader, and each of them can find
the same purchase. The receipt of a coffee and a piece of bread says
the coffee twice:

    KOPI JAGO VANILA 2 X          30000
    KOPI Jago vanila
    ROTI BAKAR                    22000
    TOTAL                         52000

The first line carries the price, the second carries the name. They
are the same two coffees. Put together, the reader was charged sixty
thousand for forty thousand rupiah of coffee.

So the lines are compared after the quantity that was written next to
the name is taken away, and the reader of the app sees one row per
product.
"""

import pytest

from app.services.receipt_line_items import (
    items_add_up,
    normalize_item_name,
    reconcile_line_items,
    split_count_from_name,
)


class TestTheNameIsReadApartFromTheQuantity:
    """The quantity and the name are written together on a receipt."""

    @pytest.mark.parametrize(
        "written,expected_name,expected_quantity",
        [
            ("Kopi Jago vanila 2 x", "Kopi Jago vanila", 2),
            ("Kopi Jago vanila 2x", "Kopi Jago vanila", 2),
            ("Kopi Jago vanila x2", "Kopi Jago vanila", 2),
            ("2x Kopi Jago", "Kopi Jago", 2),
            ("Kopi Jago vanila 2", "Kopi Jago vanila", 2),
            ("Roti Bakar 1 pcs", "Roti Bakar", 1),
            ("Roti Bakar 2 BUAH", "Roti Bakar", 2),
            ("Kopi  Jago,  vanila", "Kopi Jago vanila", None),
        ],
    )
    def test_the_quantity_is_taken_off_the_name(
        self, written, expected_name, expected_quantity
    ):
        name, quantity = split_count_from_name(written)
        assert name == expected_name
        assert quantity == expected_quantity

    def test_a_number_that_is_part_of_the_name_is_left_alone(self):
        """A size is not a quantity."""
        name, quantity = split_count_from_name("Coca Cola 400ml")
        assert quantity is None
        assert "400" in name

    def test_two_names_of_the_same_product_have_the_same_key(self):
        assert normalize_item_name("Kopi Jago vanila 2 x") == normalize_item_name(
            "Kopi Jago vanila"
        )
        assert normalize_item_name("KOPI JAGO VANILA 2X") == normalize_item_name(
            "kopi  jago   vanila"
        )

    def test_two_different_products_have_different_keys(self):
        assert normalize_item_name("Kopi Jago vanila") != normalize_item_name(
            "Roti Bakar"
        )


class TestTheDuplicateIsRemoved:
    """The case that was seen on the live server."""

    def test_the_same_coffee_is_one_row(self):
        lines = [
            {
                "name": "Kopi Jago vanila 2 x",
                "quantity": 2.0,
                "price_per_unit": 15000.0,
                "total_price": 30000.0,
            },
            {
                "name": "Roti Bakar",
                "quantity": 1.0,
                "price_per_unit": 22000.0,
                "total_price": 22000.0,
            },
            {
                "name": "Kopi Jago vanila",
                "quantity": 2.0,
                "price_per_unit": 15000.0,
                "total_price": 30000.0,
            },
        ]

        kept = reconcile_line_items(lines, total_amount=52000.0)

        assert len(kept) == 2, "the coffee was counted twice"

        coffee = next(line for line in kept if "Kopi" in (line.get("name") or ""))
        assert coffee["quantity"] == 2
        assert float(coffee["price_per_unit"]) == 15000.0
        assert float(coffee["total_price"]) == 30000.0

        bread = next(line for line in kept if "Roti" in (line.get("name") or ""))
        assert bread["quantity"] == 1
        assert float(bread["total_price"]) == 22000.0

    def test_the_lines_still_add_up_to_the_receipt(self):
        lines = [
            {
                "name": "Kopi Jago vanila 2 x",
                "quantity": 2.0,
                "price_per_unit": 15000.0,
                "total_price": 30000.0,
            },
            {
                "name": "Roti Bakar",
                "quantity": 1.0,
                "price_per_unit": 22000.0,
                "total_price": 22000.0,
            },
            {
                "name": "Kopi Jago vanila",
                "quantity": 2.0,
                "price_per_unit": 15000.0,
                "total_price": 30000.0,
            },
        ]
        kept = reconcile_line_items(lines, total_amount=52000.0)
        total = sum(float(line.get("total_price") or 0) for line in kept)
        assert total == 52000.0

    def test_the_quantity_is_not_added_up(self):
        """
        Two readings of "2 x kopi" both say two.

        Adding them would say four coffees, which is a purchase that
        was never made.
        """
        lines = [
            {
                "name": "Kopi 2 x",
                "quantity": 2.0,
                "price_per_unit": 15000.0,
                "total_price": 30000.0,
            },
            {
                "name": "Kopi",
                "quantity": 2.0,
                "price_per_unit": 15000.0,
                "total_price": 30000.0,
            },
        ]
        kept = reconcile_line_items(lines, total_amount=30000.0)
        assert len(kept) == 1
        assert kept[0]["quantity"] == 2

    def test_a_receipt_that_is_already_right_is_left_alone(self):
        """Nothing is removed from a receipt that was read well."""
        lines = [
            {
                "name": "Kopi Jago vanila",
                "quantity": 2.0,
                "price_per_unit": 15000.0,
                "total_price": 30000.0,
            },
            {
                "name": "Roti Bakar",
                "quantity": 1.0,
                "price_per_unit": 22000.0,
                "total_price": 22000.0,
            },
        ]
        kept = reconcile_line_items(lines, total_amount=52000.0)
        assert len(kept) == 2
        assert kept[0]["name"] == "Kopi Jago vanila"
        assert kept[1]["name"] == "Roti Bakar"

    def test_a_line_without_a_name_is_kept(self):
        """A line that cannot be told apart is not thrown away."""
        lines = [
            {"name": "", "quantity": 1, "price_per_unit": 5000, "total_price": 5000},
            {
                "name": "Kopi",
                "quantity": 1,
                "price_per_unit": 15000,
                "total_price": 15000,
            },
        ]
        kept = reconcile_line_items(lines, total_amount=20000.0)
        assert len(kept) == 2

    def test_a_discount_keeps_its_own_row(self):
        """A discount is a line of its own, not a second product."""
        lines = [
            {
                "name": "Kopi",
                "quantity": 1,
                "price_per_unit": 15000,
                "total_price": 15000,
                "is_discount": False,
            },
            {
                "name": "Kopi",
                "quantity": 1,
                "price_per_unit": -1500,
                "total_price": -1500,
                "is_discount": True,
            },
        ]
        kept = reconcile_line_items(lines, total_amount=13500.0)
        assert len(kept) == 2
        assert any(line.get("is_discount") for line in kept)

    def test_the_category_of_the_second_reading_is_kept(self):
        """The second reading often knows the category and the first does not."""
        lines = [
            {
                "name": "Kopi Jago vanila 2 x",
                "quantity": 2.0,
                "price_per_unit": 15000.0,
                "total_price": 30000.0,
                "category": None,
            },
            {
                "name": "Kopi Jago vanila",
                "quantity": 2.0,
                "price_per_unit": 15000.0,
                "total_price": 30000.0,
                "category": "Makanan",
            },
        ]
        kept = reconcile_line_items(lines, total_amount=30000.0)
        assert len(kept) == 1
        assert kept[0].get("category") == "Makanan"

    def test_an_empty_reading_is_left_empty(self):
        assert reconcile_line_items([], total_amount=0) == []
        assert reconcile_line_items(None, total_amount=None) == []


class TestKnowingWhenTheLinesAreTheWholeReceipt:
    """The lines that add up to the total are the whole receipt."""

    def test_the_lines_add_up(self):
        lines = [
            {"name": "Kopi", "quantity": 2, "price_per_unit": 15000, "total_price": 30000},
            {"name": "Roti", "quantity": 1, "price_per_unit": 22000, "total_price": 22000},
        ]
        assert items_add_up(lines, 52000) is True

    def test_the_lines_do_not_add_up(self):
        lines = [
            {"name": "Kopi", "quantity": 2, "price_per_unit": 15000, "total_price": 30000}
        ]
        assert items_add_up(lines, 52000) is False

    def test_there_are_no_lines(self):
        assert items_add_up([], 52000) is False
