"""
The arithmetic of a shared bill.

These are the checks that keep a bill from being one rupiah out.
They are written as plain questions, because that is how a person
would ask them.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from decimal import Decimal

from app.services.split_engine_service import (
    BillLine,
    allocate_proportionally,
    equal_split,
    exact_split,
    largest_remainder,
    percentage_split,
)


def test_three_people_sharing_a_hundred_thousand_add_up_to_a_hundred_thousand():
    """
    The case in the brief: Rp100.000 among three people.

    Ordinary rounding gives Rp33.333 three times, which is Rp99.999.
    The parts must add up to the whole.
    """
    shares = equal_split(Decimal("100000"), ["a", "b", "c"], exponent=0)
    assert sum(shares.values()) == Decimal("100000"), shares
    assert shares["a"] == Decimal("33334")
    assert shares["b"] == Decimal("33333")
    assert shares["c"] == Decimal("33333")


def test_the_same_holds_for_cents():
    """Ten dollars among three people is not nine dollars and ninety-nine cents."""
    shares = equal_split(Decimal("10.00"), ["a", "b", "c"], exponent=2)
    assert sum(shares.values()) == Decimal("10.00"), shares
    assert shares["a"] == Decimal("3.34")
    assert shares["b"] == Decimal("3.33")
    assert shares["c"] == Decimal("3.33")


def test_yen_has_no_cents():
    """Yen is a whole unit, so a thousand yen among three is a third of a yen short."""
    shares = equal_split(Decimal("1000"), ["a", "b", "c"], exponent=0)
    assert sum(shares.values()) == Decimal("1000"), shares


def test_the_extra_unit_goes_to_the_largest_remainder():
    """
    Two parts of a third and one of a third: the third has the largest
    remainder, so it gets the extra unit.
    """
    shares = largest_remainder(
        {"a": Decimal("33.5"), "b": Decimal("33.5"), "c": Decimal("33.0")},
        Decimal("100"),
        exponent=0,
    )
    assert sum(shares.values()) == Decimal("100")
    # a and b have the larger remainder, so one of them gets it.
    assert shares["a"] + shares["b"] == Decimal("67")


def test_the_split_is_the_same_every_time():
    """
    A bill that splits differently each time it is opened is a bill
    people argue about. The same input gives the same answer.
    """
    first = equal_split(Decimal("100000"), ["z", "a", "m"], exponent=0)
    second = equal_split(Decimal("100000"), ["z", "a", "m"], exponent=0)
    assert first == second


def test_percentages_add_up_to_the_whole():
    """Ten percent and ninety percent of a hundred thousand."""
    shares = percentage_split(
        Decimal("100000"), {"a": Decimal("10"), "b": Decimal("90")}, exponent=0
    )
    assert shares["a"] == Decimal("10000")
    assert shares["b"] == Decimal("90000")


def test_percentages_that_do_not_add_up_to_a_hundred_still_add_up_to_the_bill():
    """
    The percentages are weights, not instructions. Three and three
    is fifty-fifty, not a refusal.
    """
    shares = percentage_split(
        Decimal("100000"), {"a": Decimal("3"), "b": Decimal("3")}, exponent=0
    )
    assert sum(shares.values()) == Decimal("100000")


def test_amounts_given_by_hand_add_up_to_the_bill():
    """Three people give amounts that do not reach the total. The gap is shared."""
    shares = exact_split(
        Decimal("100000"),
        {"a": Decimal("20000"), "b": Decimal("20000"), "c": Decimal("20000")},
        exponent=0,
    )
    assert sum(shares.values()) == Decimal("100000")


def test_tax_and_discount_are_shared_in_the_same_proportion_as_the_food():
    """
    The case in the brief: Andi ordered Rp40.000 of coffee and Budi
    ordered Rp160.000 of steak, the subtotal was Rp200.000, service
    was Rp10.000, tax was Rp21.000 and the discount was Rp31.000.

    Andi's share is a fifth of the bill and Budi's is four fifths.
    """
    lines = [
        BillLine("l1", "Kopi", quantity=Decimal("1"), total_price=Decimal("40000")),
        BillLine("l2", "Steak", quantity=Decimal("1"), total_price=Decimal("160000")),
    ]
    allocation = allocate_proportionally(
        lines,
        {"l1": {"andi": Decimal("1")}, "l2": {"budi": Decimal("1")}},
        grand_total=Decimal("200000"),
        tax=Decimal("21000"),
        service=Decimal("10000"),
        discount=Decimal("31000"),
        exponent=0,
    )
    assert allocation.shares["andi"] == Decimal("40000"), allocation.shares
    assert allocation.shares["budi"] == Decimal("160000"), allocation.shares
    assert allocation.allocated_total == Decimal("200000")


def test_the_case_from_the_acceptance_criteria():
    """
    Subtotal Rp200.000, tax Rp20.000, discount Rp40.000, grand total
    Rp180.000. A ordered Rp50.000 and B ordered Rp150.000.

    A owes Rp45.000 and B owes Rp135.000.
    """
    lines = [
        BillLine("l1", "A", quantity=Decimal("1"), total_price=Decimal("50000")),
        BillLine("l2", "B", quantity=Decimal("1"), total_price=Decimal("150000")),
    ]
    allocation = allocate_proportionally(
        lines,
        {"l1": {"a": Decimal("1")}, "l2": {"b": Decimal("1")}},
        grand_total=Decimal("180000"),
        tax=Decimal("20000"),
        discount=Decimal("40000"),
        exponent=0,
    )
    assert allocation.shares["a"] == Decimal("45000"), allocation.shares
    assert allocation.shares["b"] == Decimal("135000"), allocation.shares


def test_two_of_the_same_coffee_can_be_claimed_by_two_people():
    """
    "2x IC KOP SUSU G.AREN" is two coffees. Two people may claim one
    each, and each is charged for one coffee, not for half the line.
    """
    lines = [
        BillLine("l1", "IC KOP SUSU G.AREN", quantity=Decimal("2"), total_price=Decimal("30000")),
    ]
    allocation = allocate_proportionally(
        lines,
        {"l1": {"andi": Decimal("1"), "budi": Decimal("1")}},
        grand_total=Decimal("30000"),
        exponent=0,
    )
    assert allocation.shares["andi"] == Decimal("15000")
    assert allocation.shares["budi"] == Decimal("15000")


def test_a_line_that_does_not_add_up_to_the_subtotal_is_reported():
    """
    The lines say Rp140.000 and the subtotal says Rp150.000. The
    reader has to be told, because one of the two was read wrong.
    """
    lines = [
        BillLine("l1", "Item", quantity=Decimal("1"), total_price=Decimal("140000")),
    ]
    allocation = allocate_proportionally(
        lines,
        {"l1": {"andi": Decimal("1")}},
        grand_total=Decimal("150000"),
        exponent=0,
    )
    assert allocation.discrepancy == Decimal("10000"), allocation.discrepancy


def test_an_empty_bill_shares_nothing():
    """Nothing ordered, nothing owed, and no error."""
    allocation = allocate_proportionally([], {}, grand_total=Decimal("0"), exponent=0)
    assert allocation.shares == {}
    assert allocation.allocated_total == Decimal("0")
