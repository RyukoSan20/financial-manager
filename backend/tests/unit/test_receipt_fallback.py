"""
A receipt is read even when nothing else can read it.

The receipt scanner had three readers: the local engine, the vision
model, and the browser's own OCR. Each of them fails in its own way -
a blurred photograph, a reader without a key for the vision model, a
deployment where the model is unreachable - and when all three failed
the reader was shown an error and the purchase was lost.

The fallback needs no key, no model and no network. It works on the
plain text of a receipt, and it always answers with something the
reader can correct.
"""

import pytest

from app.services.receipt_fallback import (
    ensure_receipt_shape,
    find_date,
    find_merchant,
    find_total,
    parse_amount,
    parse_line_items,
    read_receipt_text,
)
from app.services.receipt_fallback_service import (
    merge_receipt_readings,
    structured_fallback,
)


RECEIPT = """Kopi Jago
Jl. Kemayoran No. 12
Jakarta Selatan
12/10/2024 14:30

Kopi Jago vanila      2 x 15.000   30.000
Roti Bakar                   22.000   22.000
Air mineral                  5.000    5.000

SUBTOTAL                       57.000
DISKON                         2.000
TOTAL                         55.000
TUNAI                         60.000
KEMBALI                        5.000
"""


# === The money ===

@pytest.mark.parametrize(
    "text,expected",
    [
        ("15000", 15000.0),
        ("15.000", 15000.0),
        ("15,000", 15000.0),
        ("1.250.000", 1250000.0),
        ("8,5", 8.5),
        ("", None),
        ("not a number", None),
    ],
)
def test_the_money_is_read_in_the_way_it_is_written(text, expected):
    assert parse_amount(text) == expected


def test_the_total_is_the_total_and_not_the_subtotal():
    """
    "SUBTOTAL 57.000" comes before "TOTAL 55.000". Reading the first
    one as the total makes the receipt look more expensive than it
    was, and the reader is charged the wrong number.
    """
    lines = RECEIPT.splitlines()
    total, stated = find_total(lines)
    assert total == 55000
    assert stated is True


def test_a_receipt_without_a_total_uses_the_biggest_number():
    """
    Some receipts do not print the word "total". On a receipt, the
    biggest number is nearly always the total.
    """
    lines = ["WARUNG KOPI", "Kopi susu  2 x 10.000   20.000"]
    total, stated = find_total(lines)
    assert total == 20000
    assert stated is False


# === The shop ===

def test_the_shop_is_the_first_line_that_looks_like_a_name():
    lines = RECEIPT.splitlines()
    assert find_merchant(lines) == "Kopi Jago"


def test_the_word_receipt_is_never_the_shop():
    lines = ["STRUK PEMBELIAN", "Kopi Jago", "TOTAL 30.000"]
    assert find_merchant(lines) == "Kopi Jago"


# === The day ===

def test_the_day_is_read():
    assert find_date(RECEIPT.splitlines()) == "2024-10-12"


def test_a_receipt_without_a_date_has_none():
    assert find_date(["WARUNG KOPI", "TOTAL 30.000"]) is None


# === The lines of the bill ===

def test_the_lines_of_the_bill_are_read():
    items = parse_line_items(RECEIPT.splitlines())
    names = [item["name"] for item in items]

    assert "Kopi Jago vanila" in names
    assert "Roti Bakar" in names
    assert "Air mineral" in names


def test_a_count_on_a_line_is_the_count():
    items = parse_line_items(RECEIPT.splitlines())
    kopi = next(item for item in items if "Kopi" in item["name"])
    assert kopi["quantity"] == 2
    assert kopi["unit_price"] == 15000
    assert kopi["total_price"] == 30000


def test_the_address_is_not_something_that_was_bought():
    """
    "Jl. Kemayoran No. 12" has a number in it, so it looks like a
    line of the bill. A reader would end up buying "Jl. Kemayoran No"
    for twelve thousand rupiah.
    """
    items = parse_line_items(RECEIPT.splitlines())
    for item in items:
        assert "Kemayoran No" not in item["name"]
        assert not item["name"].lower().startswith("jl")


def test_the_payment_is_not_a_line_of_the_bill():
    """
    "TUNAI 60.000" is what was handed over, not what was bought.
    """
    items = parse_line_items(RECEIPT.splitlines())
    for item in items:
        assert item["name"].lower() not in ("tunai", "cash")


def test_the_discount_is_not_a_line_of_the_bill():
    items = parse_line_items(RECEIPT.splitlines())
    for item in items:
        assert "diskon" not in item["name"].lower()


# === The whole receipt ===

def test_a_receipt_is_read_completely():
    reading = read_receipt_text(RECEIPT)

    assert reading["merchant_name"] == "Kopi Jago"
    assert reading["total_amount"] == 55000
    assert reading["date"] == "2024-10-12"
    assert len(reading["items"]) == 3
    assert reading["parse_method"] == "structured_fallback"


def test_a_receipt_with_nothing_in_it_still_answers():
    """
    The worst case. A picture of nothing at all. The reading is
    empty, but it is empty in the right shape, so the screen can show
    a form the reader fills in.
    """
    reading = read_receipt_text("")
    assert reading["merchant_name"] is None
    assert reading["total_amount"] == 0
    assert reading["items"] == []


# === The shape of the answer ===

def test_the_answer_has_every_field():
    """
    Every field is there, whether or not it was found. A screen that
    has to check whether a key is there is a screen that will
    eventually show nothing at all.
    """
    shaped = ensure_receipt_shape({"merchant_name": "Kopi Jago"})

    for field in (
        "merchant_name",
        "date",
        "total_amount",
        "items",
        "payment_method",
        "location",
        "parse_method",
        "confidence",
    ):
        assert field in shaped


def test_the_lines_are_all_in_the_same_shape():
    shaped = ensure_receipt_shape(
        {
            "items": [
                {"name": "Kopi", "quantity": 2, "unit_price": 15000},
                {"name": "Roti", "quantity": 1, "price_per_unit": 22000, "total": 22000},
            ]
        }
    )

    for item in shaped["items"]:
        assert set(["name", "quantity", "unit_price", "total_price"]).issubset(item.keys())
    assert shaped["items"][0]["total_price"] == 30000
    assert shaped["items"][1]["total_price"] == 22000


def test_a_line_with_no_name_is_dropped():
    shaped = ensure_receipt_shape({"items": [{"quantity": 1, "unit_price": 100}, {"name": "Kopi"}]})
    assert len(shaped["items"]) == 1


def test_the_total_is_worked_out_when_it_was_not_given():
    shaped = ensure_receipt_shape(
        {"items": [{"name": "Kopi", "quantity": 2, "unit_price": 15000}]}
    )
    assert shaped["total_amount"] == 30000


# === The merging ===

def test_a_good_reading_is_left_alone():
    """
    When the vision model has read the receipt properly, the fallback
    does not get a say.
    """
    merged = merge_receipt_readings(
        {
            "merchant_name": "Kopi Jago",
            "total_amount": 55000,
            "items": [{"name": "Kopi Jago vanila", "quantity": 2, "unit_price": 15000, "total_price": 30000}],
        },
        raw_text=RECEIPT,
    )
    assert merged["merchant_name"] == "Kopi Jago"
    assert merged["total_amount"] == 55000
    assert merged["fallback_used"] is False


def test_a_reading_with_nothing_in_it_is_replaced():
    """
    The case that used to lose the purchase: the readers all failed
    and the answer was empty. The fallback reads the text and the
    reader gets a complete receipt.
    """
    merged = merge_receipt_readings({}, raw_text=RECEIPT)

    assert merged["merchant_name"] == "Kopi Jago"
    assert merged["total_amount"] == 55000
    assert len(merged["items"]) == 3
    assert merged["fallback_used"] is True


def test_a_reading_with_a_shop_but_no_total_is_filled_in():
    merged = merge_receipt_readings(
        {"merchant_name": "Kopi Jago", "total_amount": 0, "items": []},
        raw_text=RECEIPT,
    )
    assert merged["merchant_name"] == "Kopi Jago"
    assert merged["total_amount"] == 55000


def test_the_fallback_never_fails():
    """
    Even on input it cannot make sense of. The reader still gets a
    form, with every field there and every line in the same shape.
    """
    result = structured_fallback(raw_text="\x00\x01 garbage \n\n")

    assert result["items"] == []
    assert result["total_amount"] == 0
    assert result["parse_method"]

    for field in (
        "merchant_name",
        "date",
        "total_amount",
        "items",
        "payment_method",
        "location",
    ):
        assert field in result
