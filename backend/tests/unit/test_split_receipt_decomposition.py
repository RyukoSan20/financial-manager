"""
A receipt that is written the way receipts are written.

Restaurant receipts are not tidy. A line says "2x IC KOP SUSU G.AREN",
which is two coffees, either of which may be claimed by a different
person. The tax is called PB1, or GST, or something else. The
service charge is written as a percentage, and the discount is at the
bottom, after the total.

The reading of such a receipt has to do two things at once: understand
the line, and separate the quantity from the price, so that the two
coffees can be claimed separately.

These are the checks for the part of that which can be decided
without a model. The model is good at reading "IC KOP SUSU G.AREN" is
a coffee. It is not good at arithmetic, and it is not good at
deciding what a receipt adds up to. Those parts are worked out here,
from the lines, so that a receipt read wrong is a receipt the reader
can see is read wrong.
"""

from decimal import Decimal

import pytest


def test_two_coffees_are_two_coffees():
    """
    "2x IC KOP SUSU G.AREN" is two coffees at Rp28.000, which is
    Rp56.000 in all. Either of them may be claimed by somebody else.
    """
    from app.services.split_receipt_decomposition import read_quantity

    assert read_quantity("2x IC KOP SUSU G.AREN") == Decimal("2")
    assert read_quantity("2 x Es Teh Manis") == Decimal("2")
    assert read_quantity("3X Nasi Goreng") == Decimal("3")
    assert read_quantity("IC KOP SUSU G.AREN") == Decimal("1")
    assert read_quantity("4 Es Teh") == Decimal("4")


def test_a_line_without_a_quantity_is_one_of_it():
    from app.services.split_receipt_decomposition import read_quantity

    assert read_quantity("Steak") == Decimal("1")


def test_the_price_of_a_line_is_the_price_of_one_of_it():
    """
    The line says Rp56.000 for two coffees, so one coffee is
    Rp28.000. The unit price is what a person is charged for the one
    they claimed.
    """
    from app.services.split_receipt_decomposition import split_line

    line = split_line(
        raw_name="2x IC KOP SUSU G.AREN",
        total_price=Decimal("56000"),
        quantity=Decimal("2"),
    )

    assert line.quantity == Decimal("2")
    assert line.unit_price == Decimal("28000")
    assert line.total_price == Decimal("56000")


def test_a_line_that_says_two_of_something_costs_more_than_one():
    """
    The receipt sometimes writes the total of the line, sometimes the
    price of one of them. When it writes one of them, the total of the
    line is worked out.
    """
    from app.services.split_receipt_decomposition import split_line

    line = split_line(
        raw_name="2x Es Teh",
        unit_price=Decimal("8000"),
        quantity=Decimal("2"),
    )

    assert line.total_price == Decimal("16000")


def test_the_shorthands_are_understood():
    """
    The abbreviations people actually use on a receipt.
    """
    from app.services.split_receipt_decomposition import expand_shorthand

    assert "Kopi" in expand_shorthand("IC KOP SUSU G.AREN")
    assert "Susu" in expand_shorthand("IC KOP SUSU G.AREN")
    assert "Gula Aren" in expand_shorthand("IC KOP SUSU G.AREN")


def test_a_line_that_is_not_a_shorthand_is_left_alone():
    from app.services.split_receipt_decomposition import expand_shorthand

    assert expand_shorthand("Nasi Goreng Spesial") == "Nasi Goreng Spesial"


def test_the_tax_line_is_found():
    """
    The tax on an Indonesian restaurant receipt is called PB1. On a
    receipt elsewhere it is GST, or VAT, or TAX.
    """
    from app.services.split_receipt_decomposition import classify_line

    assert classify_line("PB1 10%") == "tax"
    assert classify_line("PPN 11%") == "tax"
    assert classify_line("GST 6%") == "tax"
    assert classify_line("VAT 20%") == "tax"
    assert classify_line("TAX") == "tax"


def test_the_service_charge_is_found():
    from app.services.split_receipt_decomposition import classify_line

    assert classify_line("SERVICE CHARGE 5%") == "service"
    assert classify_line("Service Charge") == "service"


def test_the_discount_is_found():
    from app.services.split_receipt_decomposition import classify_line

    assert classify_line("VOUCHER ABC 10.000") == "discount"
    assert classify_line("DISKON") == "discount"
    assert classify_line("PROMO") == "discount"


def test_the_subtotal_is_found():
    from app.services.split_receipt_decomposition import classify_line

    assert classify_line("SUBTOTAL") == "subtotal"
    assert classify_line("Sub Total") == "subtotal"
    assert classify_line("Total Belanja") == "subtotal"


def test_the_total_is_found():
    from app.services.split_receipt_decomposition import classify_line

    assert classify_line("TOTAL") == "total"
    assert classify_line("GRAND TOTAL") == "total"
    assert classify_line("JUMLAH") == "total"


def test_a_line_of_food_is_a_food_line():
    from app.services.split_receipt_decomposition import classify_line

    assert classify_line("Nasi Goreng Spesial") == "item"
    assert classify_line("Es Teh Manis") == "item"


def test_a_combo_discount_at_the_bottom_is_a_discount():
    """
    "Potongan Harga Paket 15.000" at the bottom of the receipt is a
    discount, not a dish. A receipt that adds it up as a dish is a
    receipt that is fifteen thousand too high.
    """
    from app.services.split_receipt_decomposition import classify_line

    assert classify_line("Potongan Harga Paket") == "discount"
    assert classify_line("Potongan Harga") == "discount"


def test_the_amount_is_read_from_the_end_of_the_line():
    """
    A line of a receipt ends with its price, and the price may have a
    thousands mark.
    """
    from app.services.split_receipt_decomposition import read_amount

    assert read_amount("Nasi Goreng Spesial 35.000") == Decimal("35000")
    assert read_amount("2x Es Teh 16.000") == Decimal("16000")
    assert read_amount("Es Teh 8.000") == Decimal("8000")


def test_a_line_with_no_price_has_no_amount():
    from app.services.split_receipt_decomposition import read_amount

    assert read_amount("SUBTOTAL") is None
    assert read_amount("") is None


def test_the_lines_of_a_receipt_are_read_without_a_model():
    """
    The whole receipt, read the plain way. This is the reading that
    is always available, and it is the one the model is compared with.
    """
    from app.services.split_receipt_decomposition import read_receipt

    receipt = read_receipt(
        [
            "2x IC KOP SUSU G.AREN 56.000",
            "Nasi Goreng Spesial 35.000",
            "PB1 10% 9.100",
            "SERVICE CHARGE 5% 5.500",
            "Potongan Harga Paket 15.000",
            "TOTAL 90.600",
        ]
    )

    assert receipt.subtotal == Decimal("91000")
    assert receipt.tax == Decimal("9100")
    assert receipt.service_charge == Decimal("5500")
    assert receipt.discount == Decimal("15000")
    assert receipt.grand_total == Decimal("90600")
    assert len(receipt.items) == 2
    assert receipt.items[0].quantity == Decimal("2")
    assert receipt.items[0].unit_price == Decimal("28000")


def test_a_receipt_that_does_not_add_up_is_reported():
    """
    The lines say Rp140.000 and the subtotal says Rp150.000. The
    reader has to be told, because a bill that is published with a
    gap in it is a bill where somebody pays for the wrong thing.
    """
    from app.services.split_receipt_decomposition import read_receipt

    receipt = read_receipt(
        [
            "Nasi Goreng Spesial 140.000",
            "SUBTOTAL 150.000",
            "TOTAL 150.000",
        ]
    )

    assert receipt.discrepancy == Decimal("-10000")


def test_the_reading_of_a_receipt_never_lies_about_the_total():
    """
    The total on the paper is the number that is certainly right, and
    it is what the receipt says the total is. The lines are what
    might be wrong.
    """
    from app.services.split_receipt_decomposition import read_receipt

    receipt = read_receipt(
        [
            "Nasi Goreng Spesial 140.000",
            "TOTAL 150.000",
        ]
    )

    assert receipt.grand_total == Decimal("150000")
    assert receipt.subtotal == Decimal("140000")


def test_a_receipt_with_nothing_on_it_is_not_a_crash():
    from app.services.split_receipt_decomposition import read_receipt

    receipt = read_receipt([])

    assert receipt.items == []
    assert receipt.grand_total == Decimal("0")
    assert receipt.discrepancy is None
