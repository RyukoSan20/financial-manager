"""
The numbers on a printed receipt are one number, not two.

A receipt from a thermal printer lays the characters out in a fixed
width grid. The amount 33.900 comes out of the optical reader as
"33, 900" or "33 900", and the parser then reads "33" as the amount
and misses the 900. The reader is told their shopping cost 33 rupiah.

These tests use synthetic receipt text only.

The rules are about the printing, not about any particular shop, so
there is nothing here about a shop name.
"""

import os
import sys

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ),
)

from app.services.receipt_text import (
    normalize_printed_amounts,
    normalize_spaced_amounts,
    split_receipt_lines,
)


# ---------------------------------------------------------------------------
# The number that was in two pieces
# ---------------------------------------------------------------------------


def test_a_comma_and_a_space_is_one_number():
    assert normalize_spaced_amounts("33, 900") == "33.900"


def test_a_space_is_one_number():
    assert normalize_spaced_amounts("33 900") == "33.900"


def test_a_dot_and_a_space_is_one_number():
    assert normalize_spaced_amounts("33. 900") == "33.900"


def test_several_groups_are_one_number():
    assert normalize_spaced_amounts("1 234 567") == "1.234.567"


def test_the_amount_in_the_middle_of_a_line_is_put_back():
    text = "ROTI 35, 200"
    assert normalize_spaced_amounts(text) == "ROTI 35.200"


def test_two_amounts_on_one_line_are_both_put_back():
    text = "33 900 35 200"
    assert normalize_spaced_amounts(text) == "33.900 35.200"


def test_the_amount_with_a_currency_mark_is_put_back():
    assert normalize_spaced_amounts("TOTAL Rp 33, 900") == "TOTAL Rp 33.900"


# ---------------------------------------------------------------------------
# What must not be touched
# ---------------------------------------------------------------------------


def test_two_short_numbers_are_left_alone():
    """12 34 is two numbers, not one."""
    assert normalize_spaced_amounts("12 34") == "12 34"


def test_a_number_already_written_the_right_way_is_left_alone():
    assert normalize_spaced_amounts("33.900") == "33.900"


def test_words_are_left_alone():
    assert normalize_spaced_amounts("TERIMA KASIH") == "TERIMA KASIH"


def test_empty_text_is_empty():
    assert normalize_spaced_amounts("") == ""
    assert normalize_spaced_amounts(None) == ""


def test_a_date_is_left_alone():
    """A date has groups of two and four, not of three."""
    assert normalize_spaced_amounts("28/10/2026") == "28/10/2026"


# ---------------------------------------------------------------------------
# The lines of a receipt
# ---------------------------------------------------------------------------


def test_a_block_of_text_becomes_lines():
    lines = split_receipt_lines("INDOMARET\nTOTAL 33, 900")
    assert lines == ["INDOMARET", "TOTAL 33.900"]


def test_a_list_becomes_lines():
    lines = split_receipt_lines(["INDOMARET", "TOTAL 33, 900"])
    assert lines == ["INDOMARET", "TOTAL 33.900"]


def test_the_output_of_the_optical_reader_becomes_lines():
    """The reader gives a list of dictionaries with the text in them."""
    raw = [
        {"text": "INDOMARET", "confidence": 0.95},
        {"text": "TOTAL 33, 900", "confidence": 0.88},
    ]
    lines = split_receipt_lines(raw)
    assert lines == ["INDOMARET", "TOTAL 33.900"]


def test_empty_lines_are_dropped():
    lines = split_receipt_lines(["INDOMARET", "", "   ", "TOTAL 33, 900"])
    assert lines == ["INDOMARET", "TOTAL 33.900"]


def test_nothing_gives_nothing():
    assert split_receipt_lines(None) == []
    assert split_receipt_lines("") == []
    assert split_receipt_lines([]) == []


# ---------------------------------------------------------------------------
# The same thing, through the name the parsers call
# ---------------------------------------------------------------------------


def test_the_function_the_parsers_call_does_the_same_thing():
    assert normalize_printed_amounts("33, 900") == "33.900"
