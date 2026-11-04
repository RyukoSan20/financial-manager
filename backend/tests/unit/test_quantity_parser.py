"""
How many, and at what price each.

The reader who buys two packets of Indomie at three thousand five
hundred each should not have to work the total out in their head.

These tests are about the multiplication being done in the right place,
and about the times it must NOT be done.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.quantity_parser import parse_quantity


class TestTheCountAndThePrice:
    def test_two_packets_at_three_thousand_five_hundred_is_seven_thousand(self):
        found = parse_quantity("2 indomie 3500")
        assert found is not None, "the sentence should have been read"
        assert found.quantity == 2
        assert found.unit_price == 3500
        assert found.total == 7000

    def test_the_same_thing_written_the_other_way_round(self):
        found = parse_quantity("indomie 2x 3500")
        assert found is not None
        assert found.quantity == 2
        assert found.unit_price == 3500
        assert found.total == 7000

    def test_chicken_at_thirty_five_thousand_each(self):
        found = parse_quantity("ayam 4 @ 35rb")
        assert found is not None
        assert found.quantity == 4
        assert found.unit_price == 35000
        assert found.total == 140000

    def test_a_dot_in_the_price_is_a_thousands_separator(self):
        found = parse_quantity("indomie 2x 3.500")
        assert found is not None
        assert found.quantity == 2
        assert found.unit_price == 3500
        assert found.total == 7000

    def test_the_words_for_the_price_are_understood(self):
        found = parse_quantity("2 kopi 15rb")
        assert found is not None
        assert found.quantity == 2
        assert found.unit_price == 15000
        assert found.total == 30000

    def test_when_the_price_is_said_to_be_the_price_of_one(self):
        found = parse_quantity("indomie 2 bungkus harga satuan 3500")
        assert found is not None
        assert found.quantity == 2
        assert found.unit_price == 3500
        assert found.total == 7000

    def test_the_count_written_in_words(self):
        found = parse_quantity("dua indomie 3500")
        assert found is not None
        assert found.quantity == 2
        assert found.total == 7000

    def test_a_count_of_one_is_still_one(self):
        found = parse_quantity("1 indomie 3500")
        assert found is not None
        assert found.quantity == 1
        assert found.total == 3500


class TestWhenItMustNotBeDone:
    def test_one_thing_is_one_thing(self):
        assert parse_quantity("kopi 45rb") is None

    def test_a_count_of_people_is_not_a_multiplication(self):
        """
        "kopi 2 orang 50k" is two coffees for fifty thousand. The fifty
        thousand is the whole thing, not the price of each.
        """
        assert parse_quantity("kopi 2 orang 50k") is None

    def test_a_sentence_with_no_count_is_left_alone(self):
        assert parse_quantity("makan siang") is None

    def test_an_empty_sentence_is_left_alone(self):
        assert parse_quantity("") is None
        assert parse_quantity(None) is None

    def test_a_count_with_no_price_is_not_a_multiplication(self):
        assert parse_quantity("2 indomie") is None

    def test_a_price_with_no_count_is_not_a_multiplication(self):
        assert parse_quantity("indomie 3500") is None

    def test_a_price_before_the_count_is_the_price_of_the_whole(self):
        """
        "3500 indomie 2" is three thousand five hundred for two, so
        multiplying it would double the truth.
        """
        assert parse_quantity("3500 indomie 2") is None

    def test_a_year_is_not_a_count_of_packets(self):
        assert parse_quantity("2026 indomie 3500") is None


class TestWhatIsLeftOfTheSentence:
    def test_the_count_and_the_price_are_taken_out_of_the_words(self):
        found = parse_quantity("2 indomie 3500")
        assert found is not None
        assert found.description == "indomie"

    def test_the_words_in_between_are_kept(self):
        found = parse_quantity("ayam 4 @ 35rb di pasar")
        assert found is not None
        assert found.description == "ayam di pasar"


class TestTheTotal:
    def test_the_total_is_the_count_times_the_price(self):
        found = parse_quantity("2 indomie 3500")
        assert found is not None
        assert found.total == found.quantity * found.unit_price

    def test_the_total_is_a_whole_number_of_rupiah(self):
        found = parse_quantity("3 kopi 4.500")
        assert found is not None
        assert found.total == 13500
        assert isinstance(found.total, int)

    def test_the_total_never_reaches_a_nonsense_amount(self):
        """
        A count of a thousand things at a million each is more than
        the application can hold, so it is refused rather than shown.
        """
        found = parse_quantity("1000 indomie 1000000")
        assert found is None
