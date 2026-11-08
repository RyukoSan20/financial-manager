"""
The table of Indonesian payment institutions.

An Indonesian reader's money is in a conventional bank, a digital
bank, an e-wallet, a tap card, a credit card, and sometimes in their
own shop. Each has a code from Bank Indonesia, a number length, and a
phone number.

That knowledge was scattered through the application, so it was wrong
in several places at once, and the reader was asked to remember a
bank code they should not have to remember.

So there is one table of it, and these checks hold that it is right:

- the institutions that matter are all there, with the codes and the
  lengths that Indonesia actually uses;
- a line of Indonesian names the right institution - "livin" is
  Mandiri, "tsel" is Telkomsel, "mybca" is BCA;
- a phone number names the operator that owns it, however it is
  written;
- the number is checked against the length that institution uses, and
  is written the way it is written on the card;
- and a transfer costs what that rail costs, with the e-wallet's own
  fee for a top-up.

Nothing here touches the production server or a real database.
"""

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core import indonesia_payments as ip  # noqa: E402


# ---------------------------------------------------------------------------
# The table
# ---------------------------------------------------------------------------

def test_the_families_are_all_there():
    """Every family of institution is in the table.

    A reader's money can be in any of them, and a reader who has a
    SeaBank account must be able to say so.
    """
    kinds = {i["kind"] for i in ip.INSTITUTIONS}
    for kind in (
        ip.BANK_CONVENTIONAL,
        ip.BANK_DIGITAL,
        ip.BANK_SYARIAH,
        ip.BANK_BPD,
        ip.EWALLET,
        ip.EMONEY_CARD,
        ip.PULSA_TELCO,
        ip.PAYLATER_CREDIT,
        ip.CASH,
    ):
        assert kind in kinds, f"the family {kind} is missing"


def test_the_well_known_banks_are_there_with_their_codes():
    """The codes are the ones Bank Indonesia gives them.

    These are the codes the reader sees on their own bank card, so
    getting one wrong means the reader cannot check their own bank
    against us.
    """
    expected = {
        "bca": "014",
        "mandiri": "008",
        "bri": "002",
        "bni": "009",
        "btn": "200",
        "bsi": "451",
        "jago": "542",
        "seabank": "535",
        "blu": "501",
    }
    for provider_id, code in expected.items():
        institution = ip.find_institution(provider_id)
        assert institution is not None, f"{provider_id} is missing"
        assert institution["code"] == code, (
            f"{provider_id} has the code {institution['code']}, not {code}"
        )


def test_the_account_number_lengths_are_the_ones_used():
    """The lengths are the ones the banks actually use."""
    expected = {
        "bca": 10,
        "mandiri": 13,
        "bri": 15,
        "bni": 10,
        "btn": 16,
        "jago": 12,
        "seabank": 12,
        "blu": 12,
    }
    for provider_id, digits in expected.items():
        institution = ip.find_institution(provider_id)
        assert institution["digits"] == digits, (
            f"{provider_id} has {institution['digits']} digits, not {digits}"
        )


def test_every_institution_has_an_id_a_name_and_a_kind():
    """Nothing in the table is half finished."""
    for institution in ip.INSTITUTIONS:
        assert institution["id"], "an institution has no id"
        assert institution["name"], f"{institution['id']} has no name"
        assert institution["kind"], f"{institution['id']} has no kind"
        assert institution["color"], f"{institution['id']} has no colour"


def test_the_ids_are_unique():
    """Two institutions cannot share an id."""
    ids = [i["id"] for i in ip.INSTITUTIONS]
    assert len(ids) == len(set(ids))


# ---------------------------------------------------------------------------
# Reading a line of Indonesian
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("text,expected", [
    ("livin", "mandiri"),
    ("gopay", "gopay"),
    ("seabank", "seabank"),
    ("spaylater", "spaylater"),
    ("tsel", "telkomsel"),
    ("mybca", "bca"),
    ("klikbca", "bca"),
    ("brimo", "bri"),
    ("gojek", "gopay"),
    ("kartu 3", "indosat"),
    ("bca digital", "blu"),
    ("shopee paylater", "spaylater"),
    ("kopi jago 10rb gopay", "gopay"),
    ("makan siang 35rb qris mybca", "bca"),
    ("paket data tsel 50rb", "telkomsel"),
])
def test_a_line_names_the_institution(text, expected):
    """The words a reader uses are the words we look for.

    "livin" is how a reader says Mandiri. "tsel" is how they say
    Telkomsel. "mybca" is how they say BCA.
    """
    found = ip.detect_provider_from_text(text)
    assert found is not None, f"nothing was found in {text!r}"
    assert found["id"] == expected, f"{text!r} found {found['id']}, not {expected}"


def test_the_longest_alias_wins():
    """"BCA digital" is blu, not BCA.

    The two are different banks, and a reader who has a blu account
    must not have it filed under BCA.
    """
    found = ip.detect_provider_from_text("transfer ke bca digital 500rb")
    assert found["id"] == "blu", found

    found = ip.detect_provider_from_text("transfer ke bca 500rb")
    assert found["id"] == "bca", found


def test_a_line_that_names_nothing_names_nothing():
    """Most lines name no institution at all."""
    assert ip.detect_provider_from_text("makan siang 35rb") is None
    assert ip.detect_provider_from_text("") is None
    assert ip.detect_provider_from_text(None) is None


def test_a_word_that_only_looks_like_one_is_not_one():
    """The match is on whole words.

    "bca" is a bank. "bcar" is not, and a line that happens to
    contain the letters is not a bank transfer.
    """
    assert ip.detect_provider_from_text("bcar 10rb") is None


def test_qris_is_a_rail_and_not_an_institution():
    """QRIS is how the money went, not whose account it went from.

    A reader who types "qris" is saying how they paid. The account
    is a different thing, named separately.
    """
    assert ip.detect_provider_from_text("qris 50rb") is None

    rail = ip.detect_transfer_method_from_text("qris 50rb")
    assert rail is not None
    assert rail["id"] == ip.QRIS


def test_the_rails_are_named_too():
    """BI-FAST and RTOL are named in a line too."""
    assert ip.detect_transfer_method_from_text("bifast 100rb")["id"] == ip.BI_FAST
    assert ip.detect_transfer_method_from_text("rtol 100rb")["id"] == ip.RTOL_ONLINE
    assert ip.detect_transfer_method_from_text("100rb") is None


# ---------------------------------------------------------------------------
# The phone number
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("number,expected", [
    ("081234567890", "telkomsel"),
    ("081312345678", "telkomsel"),
    ("082312345678", "telkomsel"),
    ("085112345678", "telkomsel"),
    ("081412345678", "indosat"),
    ("081512345678", "indosat"),
    ("089512345678", "indosat"),
    ("081712345678", "xl"),
    ("087712345678", "xl"),
    ("083112345678", "xl"),
    ("088112345678", "smartfren"),
    ("088912345678", "smartfren"),
])
def test_the_number_names_the_operator(number, expected):
    """The first four digits say who the operator is.

    This is how Indonesia itself works, and it is the only thing the
    reader has to go on when they are typing a phone number into a
    pulsa form.
    """
    found = ip.detect_telco_by_phone_prefix(number)
    assert found is not None, f"nothing was found for {number!r}"
    assert found["id"] == expected, f"{number!r} found {found['id']}"


def test_the_number_is_the_same_however_it_is_written():
    """+62812 is 0812.

    A reader copies a number from a contact, and the contact has it
    written the international way.
    """
    local = ip.detect_telco_by_phone_prefix("081234567890")
    international = ip.detect_telco_by_phone_prefix("+6281234567890")
    spacy = ip.detect_telco_by_phone_prefix("0812 3456 7890")

    assert local["id"] == international["id"] == spacy["id"] == "telkomsel"


def test_a_number_that_is_not_a_phone_number_names_nothing():
    """An account number is not a phone number."""
    assert ip.detect_telco_by_phone_prefix("1234567890") is None
    assert ip.detect_telco_by_phone_prefix("") is None
    assert ip.detect_telco_by_phone_prefix(None) is None


def test_an_unknown_prefix_names_nothing():
    """The four digits have to be one the operators use."""
    assert ip.detect_telco_by_phone_prefix("089012345678") is None


# ---------------------------------------------------------------------------
# The number
# ---------------------------------------------------------------------------

def test_a_bank_number_is_written_the_way_it_is_on_the_card():
    """BCA is 123-456-7890."""
    result = ip.validate_account_number("bca", "1234567890")
    assert result["valid"] is True, result
    assert result["formatted"] == "123-456-7890", result


def test_a_phone_number_is_written_the_way_it_is_dialled():
    """GoPay is 0812-3456-7890."""
    result = ip.validate_account_number("gopay", "081234567890")
    assert result["valid"] is True, result
    assert result["formatted"] == "0812-3456-7890", result


def test_a_number_of_the_wrong_length_is_refused():
    """A bank account number is a certain length.

    A number that is the wrong length is not the reader's account, and
    saying so is better than accepting it and failing later.
    """
    result = ip.validate_account_number("bca", "12345")
    assert result["valid"] is False, result
    assert result["error"] == "wrong_length", result
    assert "10" in result["expected"], result


def test_an_empty_number_is_refused():
    result = ip.validate_account_number("bca", "")
    assert result["valid"] is False, result
    assert result["error"] == "empty", result


def test_a_number_that_is_not_a_phone_number_is_refused():
    """A wallet is reached at a phone number."""
    result = ip.validate_account_number("gopay", "12345")
    assert result["valid"] is False, result
    assert result["error"] == "not_a_phone_number", result


def test_an_institution_nobody_hears_of_is_refused():
    result = ip.validate_account_number("not_a_bank", "1234567890")
    assert result["valid"] is False, result
    assert result["error"] == "unknown_provider", result


def test_cash_takes_no_number():
    """Cash has no number, and that is not a fault."""
    result = ip.validate_account_number("cash", "")
    assert result["valid"] is True, result


# ---------------------------------------------------------------------------
# The fee
# ---------------------------------------------------------------------------

def test_the_rails_cost_what_they_cost():
    """Same bank is free, BI-FAST is 2.500, RTOL is 6.500."""
    assert ip.transfer_fee(ip.SESAMA_BANK) == 0
    assert ip.transfer_fee(ip.BI_FAST) == 2500
    assert ip.transfer_fee(ip.RTOL_ONLINE) == 6500
    assert ip.transfer_fee(ip.QRIS) == 0


def test_a_top_up_costs_what_the_wallet_charges():
    """DANA is five hundred. GoPay is a thousand.

    The wallet decides, so the fee is the wallet's own and not one
    number we made up.
    """
    assert ip.transfer_fee(ip.TOPUP_EWALLET, "dana") == 500
    assert ip.transfer_fee(ip.TOPUP_EWALLET, "gopay") == 1000
    assert ip.transfer_fee(ip.TOPUP_EWALLET, "ovo") == 1000
    assert ip.transfer_fee(ip.TOPUP_EWALLET, "shopeepay") == 1000


def test_a_shop_pays_the_qris_share():
    """The seven tenths of a percent is the shop's cost, not the
    reader's."""
    assert ip.merchant_mdr(ip.QRIS) == 0.007
    assert ip.transfer_fee(ip.QRIS) == 0


def test_a_rail_nobody_hears_of_costs_nothing():
    assert ip.transfer_fee("NOT_A_RAIL") == 0
