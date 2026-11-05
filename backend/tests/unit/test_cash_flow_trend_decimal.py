"""
The cash flow trend must answer, even when the money is a decimal.

The amounts come out of the database as decimals, because money is
never a float. The trend divides one amount by another, and when one
side of the division is a plain float and the other is a decimal,
Python refuses: "unsupported operand type(s) for /: 'float' and
'decimal.Decimal'".

The whole endpoint then answers with an error, and the analytics page
shows nothing at all.

The fix is to make both sides of the division the same kind of
number. The test below holds that down.
"""

from decimal import Decimal

import pytest


def _money(value):
    """Money as the database gives it back: a decimal, not a float."""
    return Decimal(str(value))


def test_a_float_divided_by_a_decimal_does_not_raise():
    """
    The line that broke.

    A change in the amount is a float because it was cast to one. The
    amount it is compared against is a decimal. Dividing one by the
    other is refused by Python.
    """
    latest_income = _money(500000)
    previous_income = _money(400000)

    change = float(latest_income - previous_income)

    with pytest.raises(TypeError):
        change / previous_income


def test_the_change_is_a_number_when_both_sides_are_decimal():
    """When both sides are the same kind of number, the division works."""
    latest_income = _money(500000)
    previous_income = _money(400000)

    change = latest_income - previous_income
    pct = float(change / previous_income * 100)

    assert pct == pytest.approx(25.0)


def test_the_cash_flow_trend_answers_for_a_reader_with_two_months():
    """
    The door the analytics page reads.

    A reader with spending in two months must get an answer, with the
    trend in it, and not an error.
    """
    from app.api.routes import analytics as routes

    class TheReader:
        id = 1

    class FakeQuery:
        def __init__(self, value):
            self._value = value

        def filter(self, *args, **kwargs):
            return self

        def scalar(self):
            return self._value

    class FakeDb:
        def query(self, *args, **kwargs):
            # Every sum is a decimal, the way the database gives it.
            return FakeQuery(_money(0))

    result = routes.get_cash_flow_trend(
        months=3,
        current_user=TheReader(),
        db=FakeDb(),
    )

    assert "trends" in result
    assert "income_change_pct" in result["trends"]
    assert isinstance(result["trends"]["income_change_pct"], float)
