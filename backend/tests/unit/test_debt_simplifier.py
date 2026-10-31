"""
The fewest payments that clear a group.

A bill that settles in three transfers when one would do is a bill
people stop trusting, because the extra transfers are usually paid
in the wrong direction and make the position worse.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from decimal import Decimal

from app.services.debt_simplifier_service import (
    net_positions,
    simplify_debts,
)


def test_a_group_that_is_already_square_needs_no_payment():
    """Everyone paid for exactly what they ate."""
    transfers = simplify_debts(
        {"a": Decimal("50000"), "b": Decimal("50000")},
        {"a": Decimal("50000"), "b": Decimal("50000")},
    )
    assert transfers == []


def test_one_person_owes_one_other():
    """The simple case."""
    transfers = simplify_debts(
        {"a": Decimal("100000"), "b": Decimal("0")},
        {"a": Decimal("40000"), "b": Decimal("60000")},
    )
    assert len(transfers) == 1
    assert transfers[0].from_member == "b"
    assert transfers[0].to_member == "a"
    assert transfers[0].amount == Decimal("60000.00")


def test_a_circular_debt_needs_no_payment_at_all():
    """
    The case in the brief: A owes B Rp50.000, B owes C Rp50.000 and
    C owes A Rp50.000. Netting them out, nobody owes anybody.
    """
    # A owes B fifty thousand, so B paid fifty thousand that A ate.
    # B owes C fifty thousand, so C paid fifty thousand that B ate.
    # C owes A fifty thousand, so A paid fifty thousand that C ate.
    # Everyone paid fifty thousand and everyone ate fifty thousand.
    transfers = simplify_debts(
        {"a": Decimal("50000"), "b": Decimal("50000"), "c": Decimal("50000")},
        {"a": Decimal("50000"), "b": Decimal("50000"), "c": Decimal("50000")},
    )
    assert transfers == [], transfers


def test_a_circle_of_three_with_one_extra_payment():
    """
    A paid 150, B paid 0, C paid 0, and they ate 50 each.

    A covered the whole bill, so A is owed 100. B and C each owe
    50. Two payments clear it.
    """
    transfers = simplify_debts(
        {"a": Decimal("150000"), "b": Decimal("0"), "c": Decimal("0")},
        {"a": Decimal("50000"), "b": Decimal("50000"), "c": Decimal("50000")},
    )
    assert len(transfers) == 2, transfers
    # Everyone ends up in the right place.
    assert sum(t.amount for t in transfers) == Decimal("100000.00")


def test_the_case_from_the_acceptance_criteria():
    """
    A owes B Rp50.000 and B owes C Rp50.000.

    The two instructions A to B and B to C become one instruction:
    A pays C Rp50.000.
    """
    # A owes B fifty thousand, so B paid it and A ate it.
    # B owes C fifty thousand, so C paid it and B ate it.
    transfers = simplify_debts(
        {"a": Decimal("0"), "b": Decimal("50000"), "c": Decimal("50000")},
        {"a": Decimal("50000"), "b": Decimal("50000"), "c": Decimal("0")},
    )
    assert len(transfers) == 1, transfers
    assert transfers[0].from_member == "a"
    assert transfers[0].to_member == "c"
    assert transfers[0].amount == Decimal("50000.00")


def test_the_payments_always_settle_the_group():
    """
    Whatever the group looks like, running the payments through
    leaves every member where they should be.
    """
    paid = {"a": Decimal("200000"), "b": Decimal("50000"), "c": Decimal("0")}
    consumed = {"a": Decimal("60000"), "b": Decimal("90000"), "c": Decimal("100000")}

    transfers = simplify_debts(paid, consumed)

    # What each member ends up with.
    settled = dict(paid)
    for transfer in transfers:
        settled[transfer.from_member] = settled.get(transfer.from_member, Decimal("0")) + transfer.amount
        settled[transfer.to_member] = settled.get(transfer.to_member, Decimal("0")) - transfer.amount

    for member in consumed:
        assert settled[member] == consumed[member], (member, settled)


def test_the_net_position_says_who_owes_what():
    """Paid more than they ate means they are owed."""
    positions = net_positions(
        {"a": Decimal("100000")}, {"a": Decimal("40000"), "b": Decimal("60000")}
    )
    assert positions["a"] == Decimal("60000")
    assert positions["b"] == Decimal("-60000")
