"""
The shop is worked out from the receipt, and then written down.

The parser used to know a list of shop names, so a receipt from a shop
nobody had thought of came back as "Unknown Merchant" every time.

These tests check that the shop is now read off the receipt, that the
words a machine prints at the end of a receipt are never mistaken for
a shop, and that what is learned can be looked up again next time.

Synthetic receipt text only. No real shop, no real person, no real
money.
"""

import os
import sys

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ),
)

from app.services.catalog_autodiscovery import (
    best_merchant,
    category_hint_tokens,
    clean_company_name,
    find_merchant_candidates,
    guess_merchant_type,
    is_company_name,
    is_status_phrase,
    is_total_phrase,
    merchant_tokens,
)


# ---------------------------------------------------------------------------
# The words a machine prints are not a shop
# ---------------------------------------------------------------------------


def test_terima_kasih_is_not_a_shop():
    assert is_status_phrase("TERIMA KASIH") is True


def test_pembayaran_berhasil_is_not_a_shop():
    assert is_status_phrase("PEMBAYARAN BERHASIL") is True


def test_transaksi_berhasil_is_not_a_shop():
    assert is_status_phrase("TRANSAKSI BERHASIL") is True


def test_struk_pembayaran_is_not_a_shop():
    assert is_status_phrase("STRUK PEMBAYARAN") is True


def test_a_shop_name_with_a_status_word_after_it_is_still_a_status():
    """The receipt says the shop, then says thank you on the same line."""
    assert is_status_phrase("TERIMA KASIH - INDOMARET") is True


def test_a_real_shop_name_is_not_a_status():
    assert is_status_phrase("PT XING FOOD") is False
    assert is_status_phrase("WARUNG MADURA") is False


def test_empty_text_is_not_a_status():
    assert is_status_phrase("") is False
    assert is_status_phrase(None) is False


# ---------------------------------------------------------------------------
# The totals are not a shop either
# ---------------------------------------------------------------------------


def test_total_is_a_total():
    assert is_total_phrase("TOTAL") is True
    assert is_total_phrase("TOTAL BELANJA 33.900") is True
    assert is_total_phrase("TUNAI") is True
    assert is_total_phrase("KEMBALI") is True
    assert is_total_phrase("HARGA JUAL") is True


def test_a_total_with_the_amount_after_it_is_a_total():
    assert is_total_phrase("TOTAL 33.900") is True


def test_a_total_with_the_amount_before_it_is_a_total():
    assert is_total_phrase("33.900 TOTAL") is True


def test_a_shop_name_is_not_a_total():
    assert is_total_phrase("PT XING FOOD") is False


# ---------------------------------------------------------------------------
# The company name
# ---------------------------------------------------------------------------


def test_a_company_is_recognised():
    assert is_company_name("PT XING FOOD") is True
    assert is_company_name("CV MAKMUR JAYA") is True
    assert is_company_name("UD SUMBER REZEKI") is True


def test_a_name_without_a_company_prefix_is_not_a_company():
    assert is_company_name("WARUNG MADURA") is False


def test_the_branch_is_taken_off_the_name():
    assert clean_company_name("PT XING FOOD - JATINANGOR") == "PT XING FOOD"


def test_the_amount_is_taken_off_the_name():
    assert clean_company_name("PT XING FOOD 33.900") == "PT XING FOOD"


def test_a_clean_name_is_left_alone():
    assert clean_company_name("PT XING FOOD") == "PT XING FOOD"


# ---------------------------------------------------------------------------
# The shop is worked out of the receipt
# ---------------------------------------------------------------------------


def test_a_company_at_the_top_is_the_shop():
    receipt = [
        "PT XING FOOD",
        "JL. JATINANGOR NO 12",
        "ROTI 33.900",
        "TOTAL 33.900",
        "TERIMA KASIH",
    ]
    shop = best_merchant(receipt)
    assert shop is not None, "the shop was not found"
    assert shop.name == "PT XING FOOD", f"the shop was read as {shop.name!r}"
    assert shop.source == "company_line"


def test_the_name_after_dibayarkan_ke_is_the_shop():
    receipt = [
        "STRUK PEMBAYARAN",
        "Dibayarkan ke PT XING FOOD",
        "TOTAL 33.900",
    ]
    shop = best_merchant(receipt)
    assert shop is not None, "the shop was not found"
    assert shop.name == "PT XING FOOD", f"the shop was read as {shop.name!r}"
    assert shop.source == "paid_to"


def test_the_end_of_the_receipt_is_never_the_shop():
    """A receipt whose only name is a status word gives no shop."""
    receipt = [
        "33.900",
        "TERIMA KASIH",
        "PEMBAYARAN BERHASIL",
    ]
    assert best_merchant(receipt) is None, "a status word was read as a shop"


def test_a_receipt_with_a_total_and_nothing_else_gives_no_shop():
    receipt = ["TOTAL 33.900", "TUNAI 50.000", "KEMBALI 16.100"]
    assert best_merchant(receipt) is None, "a total was read as a shop"


def test_the_shop_is_the_same_shop_twice_over():
    """The same receipt gives the same shop every time."""
    receipt = ["PT XING FOOD", "ROTI 33.900", "TOTAL 33.900"]
    first = best_merchant(receipt)
    second = best_merchant(receipt)
    assert first is not None and second is not None
    assert first.name == second.name


def test_a_shop_is_only_offered_once():
    receipt = ["PT XING FOOD", "PT XING FOOD", "TOTAL 33.900"]
    candidates = find_merchant_candidates(receipt)
    names = [c.name for c in candidates]
    assert len(names) == len(set(names)), "the same shop was offered twice"


# ---------------------------------------------------------------------------
# What kind of shop it is
# ---------------------------------------------------------------------------


def test_a_minimarket_is_recognised_as_one():
    assert guess_merchant_type("INDOMARET JATINANGOR") == "minimarket"
    assert guess_merchant_type("ALFAMART") == "minimarket"


def test_an_apotek_is_recognised_as_one():
    assert guess_merchant_type("APOTEK SEHAT") == "apotek"


def test_nothing_is_guessed_when_nothing_says_so():
    assert guess_merchant_type("PT XING FOOD") is None


# ---------------------------------------------------------------------------
# The words worth remembering
# ---------------------------------------------------------------------------


def test_the_words_of_the_shop_are_remembered():
    tokens = merchant_tokens("PT XING FOOD")
    assert "xing" in tokens
    assert "food" in tokens


def test_a_single_letter_is_not_a_word():
    """A word of one letter says nothing."""
    assert "x" not in merchant_tokens("X XING FOOD")


def test_numbers_are_not_words():
    assert "123" not in merchant_tokens("PT XING 123 FOOD")


def test_the_items_are_remembered_too():
    from app.services.catalog_autodiscovery import MerchantCandidate

    shop = MerchantCandidate(name="PT XING FOOD", tokens=["pt", "xing", "food"])
    tokens = category_hint_tokens(shop, [{"name": "ROTI SARIWANG"}])
    assert "roti" in tokens
    assert "sariwang" in tokens
    assert "xing" in tokens


def test_the_same_word_twice_is_one_piece_of_information():
    from app.services.catalog_autodiscovery import MerchantCandidate

    shop = MerchantCandidate(name="PT XING FOOD", tokens=["food"])
    tokens = category_hint_tokens(shop, [{"name": "FOOD"}])
    assert tokens.count("food") == 1
