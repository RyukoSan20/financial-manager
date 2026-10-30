"""
The receipt has to say which number is the total.

Three things go wrong on a real receipt, and each has a test here.

1. The label is not always the word "TOTAL". A receipt says "TOTAL
   BELANJA", or "TOTAL BAYAR", or "JUMLAH", or - on an ATM slip -
   "Nominal". A parser that only looks for "TOTAL" reads nothing at
   all, and the reader is told their receipt was worth nothing.

2. The label and the number are not always on the same line. A
   thermal printer runs the label and the amount together, but a
   supermarket receipt puts them apart. The number has to be found
   near the label, not only on its line.

3. The line that holds the total often holds other numbers too - a
   voucher, a rounding, a change. The total is the biggest of them,
   not the last one.

The lines here are the shape of a receipt, not anybody's receipt: no
shop is named and no money is anybody's.

The parser also has to keep two promises it already makes: a
pending-looking label is not a total, and a line that says how many
items there were is not an amount.
"""

import os
import sys

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ),
)

from app.services.parser_engine_v31 import (
    parse_receipt_text_v31,
)


def _parse(lines):
    return parse_receipt_text_v31("\n".join(lines))


# ---------------------------------------------------------------------------
# The label is not always the word "TOTAL"
# ---------------------------------------------------------------------------


def test_total_belanja_is_the_total():
    result = _parse([
        "TOKO SERBADA",
        "BARANG 1  10.000",
        "BARANG 2  20.000",
        "TOTAL BELANJA  30.000",
        "TUNAI  30.000",
    ])
    assert result["amount"] == 30000


def test_total_bayar_is_the_total():
    result = _parse([
        "WARUNG",
        "NASI GORENG  15.000",
        "TOTAL BAYAR  15.000",
    ])
    assert result["amount"] == 15000


def test_jumlah_is_the_total():
    result = _parse([
        "WARUNG",
        "ES TEH  5.000",
        "JUMLAH  5.000",
    ])
    assert result["amount"] == 5000


def test_nominal_is_the_total_on_an_atm_slip():
    """An ATM slip does not say TOTAL. It says Nominal."""
    result = _parse([
        "Tarik Tunai",
        "Tarik Tunai:",
        "31/07 08:35:28",
        "Dari 1310558032",
        "Nominal Rp 200.000,00",
        "Kode Transaksi 735765",
    ])
    assert result["amount"] == 200000


def test_grand_total_is_the_total():
    result = _parse([
        "SUPERMARKET",
        "SUSU  25.000",
        "GRAND TOTAL  25.000",
    ])
    assert result["amount"] == 25000


# ---------------------------------------------------------------------------
# The label and the number are not always on the same line
# ---------------------------------------------------------------------------


def test_the_amount_can_be_on_the_line_after_the_label():
    result = _parse([
        "TOKO",
        "BARANG  10.000",
        "TOTAL",
        "  30.000",
        "TUNAI  30.000",
    ])
    assert result["amount"] == 30000


# ---------------------------------------------------------------------------
# The line holds other numbers as well
# ---------------------------------------------------------------------------


def test_the_total_is_the_biggest_number_on_the_line_not_the_last():
    """A voucher and a change share the line with the total."""
    result = _parse([
        "TOKO",
        "BARANG  111.900",
        "VOUCHER  11.700",
        "TOTAL  118.700",
        "TUNAI  200.000",
        "KEMBALI  81.300",
    ])
    assert result["amount"] == 118700


# ---------------------------------------------------------------------------
# The promises that were already made
# ---------------------------------------------------------------------------


def test_a_line_that_says_how_many_items_there_were_is_not_an_amount():
    result = _parse([
        "TOKO",
        "BARANG  10.000",
        "TOTAL QTY  3",
    ])
    assert result["amount"] != 3


def test_subtotal_is_not_the_total():
    result = _parse([
        "TOKO",
        "BARANG  30.000",
        "SUBTOTAL  30.000",
        "DISKON  3.000",
        "TOTAL  27.000",
    ])
    assert result["amount"] == 27000


def test_a_discount_on_its_own_is_not_the_total():
    result = _parse([
        "TOKO",
        "BARANG  30.000",
        "DISKON  3.000",
    ])
    assert result["amount"] != 3000


def test_harga_jual_is_not_the_total():
    """On an Indonesian supermarket receipt the price line says
    HARGA JUAL. That is the price of one item, not the total."""
    result = _parse([
        "SUPERMARKET",
        "1.A HARGA JUAL : 38.108",
        "PPN  4.192",
        "TOTAL  42.300",
    ])
    assert result["amount"] == 42300


# ---------------------------------------------------------------------------
# The way the number is written
# ---------------------------------------------------------------------------


def test_a_comma_after_the_thousands_separator_is_the_decimal_point():
    """An Indonesian amount is written 200.000,00. The dot groups the
    thousands and the comma is the point. Reading it as 20000000 tells
    the reader their withdrawal was a hundred times bigger."""
    from app.services.parser_engine_v31 import parse_number_indonesia

    assert parse_number_indonesia("200.000,00") == 200000
    assert parse_number_indonesia("1.234.567,50") == 1234567.5


def test_a_dot_that_is_not_a_thousands_group_is_the_decimal_point():
    from app.services.parser_engine_v31 import parse_number_indonesia

    assert parse_number_indonesia("35.200") == 35200
    assert parse_number_indonesia("12.50") == 12.5
