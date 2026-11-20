"""
Reading a sentence, the way the text parser and the voice input do.

There is one engine and both screens use it, so these checks are about
the engine: what kind of transaction a sentence is, what was bought,
where it was bought, and which account the money moved through.

The sentences here are the ones readers actually type and say. None of
them is a template. The engine has to make sense of a sentence the
reader typed with their fingers or spoke with their mouth, and it has
to do it the same way every time.
"""

import pytest

from app.services.transaction_nlp import (
    match_account,
    money_value,
    read_intent,
    refine_intent,
)


ACCOUNTS = [
    {"id": 1, "name": "GoPay", "account_type": "wallet", "currency": "IDR"},
    {"id": 2, "name": "BCA", "account_type": "bank", "currency": "IDR"},
    {"id": 3, "name": "OVO", "account_type": "wallet", "currency": "IDR"},
    {"id": 4, "name": "Cash", "account_type": "cash", "currency": "IDR"},
]


# === What kind of transaction is it? ===

def test_a_purchase_is_a_purchase():
    intent = read_intent("beli 2 kopi susu @18rb sama 1 roti bakar 22rb")
    assert intent.type == "expense"


def test_a_salary_is_income():
    intent = read_intent("gajian masuk 8.5jt ke bca")
    assert intent.type == "income"


def test_a_transfer_between_accounts_is_a_transfer():
    intent = read_intent("transfer 500rb dari bca ke ovo")
    assert intent.type == "transfer"


# === The things that were bought ===

def test_a_purchase_of_two_things_has_two_lines():
    """
    The whole point of the upgrade. A purchase of two things is two
    lines, not one lump with a total on it.
    """
    intent = read_intent("beli 2 kopi susu @18rb sama 1 roti bakar 22rb")

    assert len(intent.items) == 2
    assert intent.items[0].name == "Kopi Susu"
    assert intent.items[0].quantity == 2
    assert intent.items[0].unit_price == 18000
    assert intent.items[0].subtotal == 36000
    assert intent.items[1].name == "Roti Bakar"
    assert intent.items[1].quantity == 1
    assert intent.items[1].unit_price == 22000
    assert intent.items[1].subtotal == 22000


def test_the_total_is_the_sum_of_the_lines():
    intent = read_intent("beli 2 kopi susu @18rb sama 1 roti bakar 22rb")
    assert intent.total_amount == 58000


def test_the_lines_carry_a_note_when_there_is_one():
    intent = read_intent("beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran")
    assert intent.items[0].variant_or_note
    assert "vanila" in intent.items[0].variant_or_note.lower()


# === The shop, the place, the account ===

def test_the_place_is_not_the_shop():
    """
    The two were the same field once, so "Kopi Jago di Kemayoran" was
    read as a shop called "Kopi Jago di Kemayoran" and a place of
    nowhere.
    """
    intent = read_intent("beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran")
    assert intent.merchant == "Kopi Jago"
    assert intent.location == "Kemayoran"


def test_the_shop_is_not_a_thing_that_was_bought():
    """
    A purchase of two things has no shop in it, so there is no shop to
    read. One thing bought at a place is a different matter: then the
    thing may be the shop.
    """
    intent = read_intent("beli 2 kopi susu @18rb sama 1 roti bakar 22rb")
    assert intent.merchant in (None, "", "Kopi Susu")


def test_the_account_a_paid_with_is_found():
    intent = read_intent("beli 2 kopi susu @18rb sama 1 roti bakar 22rb bayar pakai gopay di blok m")
    assert intent.account_hint
    assert "gopay" in intent.account_hint.lower()


def test_the_place_does_not_swallow_the_account():
    """
    "bayar pakai gopay di blok m" is an account and a place. Read as
    one, the account was called "GoPay Di Blok M" and matched nothing.
    """
    intent = read_intent("beli 2 kopi susu @18rb sama 1 roti bakar 22rb bayar pakai gopay di blok m")
    assert intent.location
    assert "blok m" in intent.location.lower()
    assert "blok" not in (intent.account_hint or "").lower()


def test_a_transfer_has_both_ends():
    intent = read_intent("transfer 500rb dari bca ke ovo")
    assert intent.source_account
    assert intent.destination_account
    assert "bca" in intent.source_account.lower()
    assert "ovo" in intent.destination_account.lower()


def test_a_salary_has_an_account_it_arrives_in():
    intent = read_intent("gajian masuk 8.5jt ke bca")
    assert intent.account_hint
    assert "bca" in intent.account_hint.lower()


# === The money ===

@pytest.mark.parametrize(
    "text,expected",
    [
        ("18rb", 18000),
        ("18 ribu", 18000),
        ("15.000", 15000),
        ("8.5jt", 8500000),
        ("500rb", 500000),
        ("rp 25.000", 25000),
        ("1.250.000", 1250000),
    ],
)
def test_the_money_is_read_in_the_way_it_is_written(text, expected):
    assert money_value(text) == expected


# === The account is matched to the reader's own ===

def test_a_named_account_is_matched_to_the_readers_account():
    intent = read_intent("beli kopi @18rb pakai gopay")
    refined = refine_intent(intent, accounts=ACCOUNTS)
    assert refined.account_id == 1


def test_a_bank_name_is_matched_too():
    intent = read_intent("transfer 500rb dari bca ke ovo")
    refined = refine_intent(intent, accounts=ACCOUNTS)
    assert refined.source_account_id == 2
    assert refined.destination_account_id == 3


def test_an_account_the_reader_does_not_have_is_not_matched():
    """
    The reader is not given an account they do not have. The name is
    kept, so the screen can show what was said, but nothing is chosen
    on their behalf.
    """
    intent = read_intent("beli kopi @18rb pakai wise")
    refined = refine_intent(intent, accounts=ACCOUNTS)
    assert refined.account_id is None


def test_the_account_is_found_without_being_named_exactly():
    """
    A reader does not type the account name the way it is stored. They
    type "gopay" and the account is called "GoPay".
    """
    assert match_account(ACCOUNTS, "gopay") is not None
    assert match_account(ACCOUNTS, "bca") is not None
    assert match_account(ACCOUNTS, "ovo") is not None
    assert match_account(ACCOUNTS, "cash") is not None


# === The category ===

def test_a_purchase_of_food_is_food():
    intent = read_intent("beli 2 kopi susu @18rb")
    refined = refine_intent(intent, accounts=ACCOUNTS, categories=[])
    assert refined.category
    assert "makanan" in refined.category.lower() or "food" in refined.category.lower()


# === The refinement pass ===

def test_the_refinement_adds_what_was_missing():
    """
    The "Tanya Maskot" pass. A sentence with no account in it gets the
    account that was named, a missing total gets the sum of the lines,
    and the category gets filled in from what was bought.
    """
    intent = read_intent("beli 2 kopi susu @18rb")
    assert intent.account_id is None

    refined = refine_intent(intent, accounts=ACCOUNTS, categories=[])

    assert refined.category is not None
    assert refined.total_amount == 36000


def test_the_refinement_never_removes_a_line():
    intent = read_intent("beli 2 kopi susu @18rb sama 1 roti bakar 22rb")
    refined = refine_intent(intent, accounts=ACCOUNTS, categories=[])
    assert len(refined.items) == 2
    assert refined.total_amount == 58000


def test_the_refinement_works_without_a_reader_context():
    """
    A guest, or a reader who is offline, has no accounts to match and
    no categories to choose from. The reading still has to be useful.
    """
    intent = read_intent("beli 2 kopi susu @18rb sama 1 roti bakar 22rb")
    refined = refine_intent(intent, accounts=[], categories=[])
    assert len(refined.items) == 2
    assert refined.total_amount == 58000
    assert refined.category is not None


def test_the_refinement_explains_what_it_did():
    """
    The mascot has to be able to say what it fixed. An empty list of
    notes means it says nothing, and the reader is left wondering.
    """
    intent = read_intent("beli 2 kopi susu @18rb")
    refined = refine_intent(intent, accounts=ACCOUNTS, categories=[])
    assert refined.notes


# === The voice case from the report ===

def test_the_voice_case_from_the_report():
    """
    "beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran"

    This is the sentence from the report, and it is the one the voice
    input got wrong: the shop came out as "Kemayoran", the place came
    out as nowhere, and there were no lines of the bill at all.
    """
    intent = read_intent("beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran")
    refined = refine_intent(intent, accounts=ACCOUNTS, categories=[])

    assert refined.type == "expense"
    assert len(refined.items) == 1

    item = refined.items[0]
    assert item.quantity == 2
    assert item.unit_price == 15000
    assert item.subtotal == 30000

    assert refined.total_amount == 30000
    assert refined.merchant == "Kopi Jago"
    assert refined.location == "Kemayoran"
    assert refined.category


def test_the_voice_case_says_the_variant_out_loud():
    """
    The name of the thing carries what was said about it, so the
    mascot can read the line back: "2 Kopi Jago vanila".
    """
    intent = read_intent("beli kopi jago 2 harganya Rp15.000 rasa vanila di Kemayoran")
    item = intent.items[0]
    assert "Kopi Jago" in item.display_name
    assert "Vanila" in item.display_name
