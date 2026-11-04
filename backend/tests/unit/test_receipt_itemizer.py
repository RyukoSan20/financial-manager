"""
The itemised receipt, and the money that goes with it.

A receipt is a list of lines and three numbers. The lines have to be
able to say what each of them really was, so that the food and the
drink on the same piece of paper can go to different places. And the
discount and the tax on the receipt have to be shared over the lines
without a single rupiah going missing.

These are the tests for that arithmetic. Nothing here touches a
database.
"""

import os
import sys
from decimal import Decimal
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import receipt_itemizer_service as itemizer  # noqa: E402


def _sum(values):
    return sum((Decimal(str(value)) for value in values), Decimal("0"))


# -----------------------------------------------------------------------
# The discount and the tax are shared out
# -----------------------------------------------------------------------


def test_the_discount_is_shared_out_and_adds_up_to_the_whole():
    """
    The parts of the discount add up to the discount.

    This is the property that matters: a discount of a hundred
    rupiah shared over three lines comes to 33.33, 33.33 and 33.34,
    and not 33.33, 33.33 and 33.33, which would lose a rupiah.
    """
    items = [
        {"name": "Ayam Panggang", "quantity": 1, "price_per_unit": 10000, "total_price": 10000},
        {"name": "Nasi Goreng", "quantity": 1, "price_per_unit": 20000, "total_price": 20000},
        {"name": "Es Teh", "quantity": 1, "price_per_unit": 30000, "total_price": 30000},
    ]

    allocated = itemizer.allocate_totals(items, 60000, 100, 0)

    assert _sum(line["allocated_discount"] for line in allocated) == Decimal("100.00")
    assert _sum(line["allocated_tax"] for line in allocated) == Decimal("0.00")


def test_the_tax_is_shared_out_and_adds_up_to_the_whole():
    """
    The parts of the tax add up to the tax.

    The same property, for the tax. A tax of eleven percent on a
    thousand rupiah is a hundred and ten, and the parts of that have to
    add up to a hundred and ten.
    """
    items = [
        {"name": "Ayam Panggang", "quantity": 2, "price_per_unit": 15000, "total_price": 30000},
        {"name": "Nasi Goreng", "quantity": 1, "price_per_unit": 30000, "total_price": 30000},
    ]

    allocated = itemizer.allocate_totals(items, 60000, 0, 110)

    assert _sum(line["allocated_tax"] for line in allocated) == Decimal("110.00")


def test_the_discount_and_the_tax_are_shared_out_over_a_receipt_that_does_not_divide():
    """
    A receipt whose lines do not divide evenly still adds up.

    Three lines of one, two and two rupiah, with a discount of one
    rupiah: the line that is worth the most gets the extra cent.
    """
    items = [
        {"name": "Satu", "quantity": 1, "price_per_unit": 1, "total_price": 1},
        {"name": "Dua", "quantity": 1, "price_per_unit": 2, "total_price": 2},
        {"name": "Tiga", "quantity": 1, "price_per_unit": 2, "total_price": 2},
    ]

    allocated = itemizer.allocate_totals(items, 5, 1, 1)

    assert _sum(line["allocated_discount"] for line in allocated) == Decimal("1.00")
    assert _sum(line["allocated_tax"] for line in allocated) == Decimal("1.00")


def test_a_line_takes_the_share_that_belongs_to_it():
    """
    The discount follows the size of the line.

    A line worth twice as much as another takes twice the share of
    the discount.
    """
    items = [
        {"name": "Kecil", "quantity": 1, "price_per_unit": 10000, "total_price": 10000},
        {"name": "Besar", "quantity": 1, "price_per_unit": 30000, "total_price": 30000},
    ]

    allocated = itemizer.allocate_totals(items, 40000, 4000, 0)

    assert allocated[0]["allocated_discount"] == Decimal("1000.00")
    assert allocated[1]["allocated_discount"] == Decimal("3000.00")


# -----------------------------------------------------------------------
# The net total
# -----------------------------------------------------------------------


def test_the_net_total_is_the_subtotal_less_the_discount_plus_the_tax():
    """
    What the customer pays is the subtotal, less the discount, plus
    the tax.
    """
    items = [
        {"name": "Ayam Panggang", "quantity": 1, "price_per_unit": 25000, "total_price": 25000},
        {"name": "Nasi Goreng", "quantity": 1, "price_per_unit": 15000, "total_price": 15000},
    ]

    net = itemizer.compute_net_total(items, 5000, 4400, subtotal=40000)

    assert net == Decimal("39400.00")


def test_the_net_total_is_worked_out_from_the_lines_when_there_is_no_subtotal():
    """
    The subtotal can be worked out from the lines.
    """
    items = [
        {"name": "Ayam Panggang", "quantity": 2, "price_per_unit": 25000, "total_price": 50000},
        {"name": "Nasi Goreng", "quantity": 1, "price_per_unit": 15000, "total_price": 15000},
    ]

    net = itemizer.compute_net_total(items, 5000, 4400)

    assert net == Decimal("64400.00")


def test_the_net_total_with_no_discount_and_no_tax_is_the_subtotal():
    """
    A receipt with nothing off it and no tax on it is the subtotal.
    """
    items = [{"name": "Kopi", "quantity": 1, "price_per_unit": 18000, "total_price": 18000}]

    assert itemizer.compute_net_total(items, 0, 0) == Decimal("18000.00")


# -----------------------------------------------------------------------
# One line only
# -----------------------------------------------------------------------


def test_a_single_line_takes_the_whole_discount_and_the_whole_tax():
    """
    With one line there is nothing to share.

    The whole discount and the whole tax belong to that line, and the
    net is the line less the discount plus the tax.
    """
    items = [{"name": "Kopi Susu", "quantity": 1, "price_per_unit": 20000, "total_price": 20000}]

    allocated = itemizer.allocate_totals(items, 20000, 2000, 2200)

    assert len(allocated) == 1
    assert allocated[0]["allocated_discount"] == Decimal("2000.00")
    assert allocated[0]["allocated_tax"] == Decimal("2200.00")
    assert allocated[0]["net_total"] == Decimal("20200.00")

    net = itemizer.compute_net_total(items, 2000, 2200, subtotal=20000)
    assert net == Decimal("20200.00")


# -----------------------------------------------------------------------
# Nothing at all
# -----------------------------------------------------------------------


def test_an_empty_list_does_not_crash():
    """
    A receipt with no lines is a receipt the reader has not filled in
    yet. It must not throw.
    """
    allocated = itemizer.allocate_totals([], 0, 1000, 100)

    assert allocated == []

    net = itemizer.compute_net_total([], 1000, 100)
    assert net == Decimal("-900.00")


def test_categorizing_nothing_does_not_crash():
    """The same, for the categorizing."""
    assert itemizer.categorize_items([], []) == []


# -----------------------------------------------------------------------
# The category
# -----------------------------------------------------------------------


class _FakeMatcher:
    """A matcher that answers what it is told to answer."""

    def __init__(self, answers):
        self.answers = answers
        self.asked = []

    def match(self, name):
        self.asked.append(name)
        return self.answers.get(name, {"category": "Lain-lain", "confidence": 0.0})


@pytest.fixture
def with_matcher(monkeypatch):
    """A matcher that can be told what to answer."""

    def _install(answers):
        matcher = _FakeMatcher(answers)
        monkeypatch.setattr(itemizer, "_matcher", lambda: matcher)
        return matcher

    return _install


def _category(name, name_en=None, name_ja=None):
    return {"name": name, "name_en": name_en, "name_ja": name_ja}


def test_a_line_is_given_the_category_the_matcher_found(with_matcher):
    """
    The matcher is asked about the name of the line, and the line is
    given the category it recognised.
    """
    with_matcher({
        "AYAM PANGGANG": {"category": "Makanan & Minuman", "confidence": 0.91},
    })
    categories = [_category("Makanan & Minuman", "Food & Drink", "飲食")]

    result = itemizer.categorize_items([{"name": "AYAM PANGGANG"}], categories)

    assert len(result) == 1
    assert result[0]["category"] == categories[0]
    assert result[0]["confidence"] == pytest.approx(0.91)


def test_a_line_with_no_category_gets_no_category(with_matcher):
    """
    A line the matcher recognises nothing stays without a category.

    A wrong category is worse than none: it puts the money in a place
    it does not belong, and the reader has to find it and move it
    back. So nothing is guessed.
    """
    with_matcher({
        "AYAM PANGGANG": {"category": "Lain-lain", "confidence": 0.1},
    })
    categories = [_category("Makanan & Minuman", "Food & Drink", "飲食")]

    result = itemizer.categorize_items([{"name": "AYAM PANGGANG"}], categories)

    assert result[0]["category"] is None
    assert result[0]["confidence"] == pytest.approx(0.0)


def test_a_line_the_reader_has_no_category_for_gets_no_category(with_matcher):
    """
    The catalog speaks in its own names. When the reader has no
    category that means the same thing, the line stays without one.
    """
    with_matcher({
        "AYAM PANGGANG": {"category": "Makanan & Minuman", "confidence": 0.9},
    })
    categories = [_category("Belanja", "Shopping", "買い物")]

    result = itemizer.categorize_items([{"name": "AYAM PANGGANG"}], categories)

    assert result[0]["category"] is None


def test_a_category_is_found_by_its_name_in_any_language(with_matcher):
    """
    The category is found by the name in any of the three languages.
    """
    with_matcher({
        "RED VELVET LATTE": {"category": "Minuman & Teh", "confidence": 0.8},
    })
    categories = [_category("Minuman & Teh", "Minuman & Teh", "Minuman & Teh")]

    result = itemizer.categorize_items([{"name": "RED VELVET LATTE"}], categories)

    assert result[0]["category"] == categories[0]


def test_the_lines_are_not_changed_by_the_categorizing(with_matcher):
    """
    The lines that were given in are not changed.
    """
    with_matcher({
        "AYAM PANGGANG": {"category": "Makanan & Minuman", "confidence": 0.9},
    })
    categories = [_category("Makanan & Minuman")]
    items = [{"name": "AYAM PANGGANG", "quantity": 2}]

    itemizer.categorize_items(items, categories)

    assert items == [{"name": "AYAM PANGGANG", "quantity": 2}]


def test_the_matcher_is_not_asked_about_a_line_with_no_name(with_matcher):
    """A line with no name is not worth asking about."""
    matcher = with_matcher({})

    itemizer.categorize_items([{"name": ""}], [])

    assert matcher.asked == []


def test_a_matcher_that_breaks_does_not_break_the_categorizing(monkeypatch):
    """
    A matcher that raises is a matcher that is broken. The lines still
    come back, without a category.
    """

    class _Broken:
        def match(self, name):
            raise RuntimeError("the model is not there")

    monkeypatch.setattr(itemizer, "_matcher", lambda: _Broken())

    result = itemizer.categorize_items([{"name": "AYAM PANGGANG"}], [])

    assert result[0]["category"] is None


def test_the_categorizing_uses_the_real_catalog_matcher_when_it_is_there():
    """
    The service asks the catalog matcher that the application already
    has, rather than a matcher of its own.
    """
    from app.services import catalog_service

    matcher = itemizer._matcher()

    assert matcher is catalog_service.catalog_matcher
