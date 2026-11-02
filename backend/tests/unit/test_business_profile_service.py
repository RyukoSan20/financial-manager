"""
What each kind of shop is allowed to ask for.

A warung sells over the counter and takes the money there and then.
It should never be shown a customs value, and never be asked to fill
one in.

A studio sells on credit and has tax taken out before the money
arrives. It needs an invoice number and a payment term, and it needs
to be able to say that some of what it received was withheld.

A company that sells across borders has three currencies and a rule
that depends on where the customer is.

These are the tests that say so.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.business_profile_service import (  # noqa: E402
    PROFILE_B2B,
    PROFILE_CROSS_BORDER,
    PROFILE_UMKM,
    apply_profile_to_transaction_payload,
    describe_profiles,
    get_profile,
    is_withholding,
    normalise_profile,
)


class TestWhichModeIsThis:
    def test_a_shop_with_no_mode_is_a_warung(self):
        """
        The warung is the mode that asks for the least. If we do not
        know what this shop is, we have asked for too little rather
        than too much.
        """
        assert normalise_profile(None) == PROFILE_UMKM
        assert normalise_profile("") == PROFILE_UMKM
        assert normalise_profile("nonsense") == PROFILE_UMKM

    def test_the_name_is_read_the_way_a_person_would_write_it(self):
        assert normalise_profile("umkm") == PROFILE_UMKM
        assert normalise_profile("  B2B ") == PROFILE_B2B
        assert normalise_profile("cross-border") == PROFILE_CROSS_BORDER
        assert normalise_profile("cross border") == PROFILE_CROSS_BORDER

    def test_the_older_spellings_are_understood(self):
        assert normalise_profile("lite_pos") == PROFILE_UMKM
        assert normalise_profile("invoicing") == PROFILE_B2B
        assert normalise_profile("enterprise") == PROFILE_CROSS_BORDER


class TestTheWarung:
    def test_the_warung_is_not_asked_about_customs(self):
        p = get_profile(PROFILE_UMKM)
        assert p.show_customs_fields is False
        assert p.show_incoterms is False
        assert p.show_multi_currency is False

    def test_the_warung_is_asked_for_an_invoice_number(self):
        """
        Even a warung gives a receipt. That is the one field it must
        always have.
        """
        p = get_profile(PROFILE_UMKM)
        assert p.show_invoice_number is True
        assert p.field("invoice_number").required is True

    def test_the_warung_sells_over_the_counter(self):
        p = get_profile(PROFILE_UMKM)
        assert p.default_invoice_type == "POS_RECEIPT"
        assert p.tax_codes == ("PPN", "PPNBM", "PBJT")

    def test_the_warung_is_not_asked_to_enter_a_customs_value(self):
        payload = {
            "invoice_number": "INV-1",
            "customs_value": 0,
            "incoterms": "FOB",
            "transaction_currency": "EUR",
            "exchange_rate": 0,
            "invoice_type": "TAX_INVOICE",
        }
        cleaned = apply_profile_to_transaction_payload(payload, PROFILE_UMKM)

        assert "customs_value" not in cleaned
        assert "incoterms" not in cleaned
        assert "transaction_currency" not in cleaned
        assert "exchange_rate" not in cleaned
        # The receipt is still a receipt.
        assert cleaned["invoice_type"] == "POS_RECEIPT"
        assert cleaned["invoice_number"] == "INV-1"


class TestTheStudio:
    def test_the_studio_is_asked_about_payment_terms(self):
        p = get_profile(PROFILE_B2B)
        assert p.show_payment_terms is True
        assert p.field("payment_terms").required is True

    def test_the_studio_can_say_that_tax_was_withheld(self):
        p = get_profile(PROFILE_B2B)
        assert p.show_withholding_tax is True
        assert "PPH_23" in p.tax_codes

    def test_the_studio_is_not_asked_about_customs(self):
        p = get_profile(PROFILE_B2B)
        assert p.show_customs_fields is False
        assert p.show_multi_currency is False

    def test_the_studio_sends_a_tax_invoice_not_a_receipt(self):
        payload = {"invoice_type": "POS_RECEIPT"}
        cleaned = apply_profile_to_transaction_payload(payload, PROFILE_B2B)
        assert cleaned["invoice_type"] == "TAX_INVOICE"


class TestTheCompanyAcrossBorders:
    def test_it_has_three_currencies(self):
        p = get_profile(PROFILE_CROSS_BORDER)
        assert p.show_multi_currency is True
        assert p.show_customs_fields is True
        assert p.show_incoterms is True

    def test_it_knows_the_rules_of_more_than_one_country(self):
        p = get_profile(PROFILE_CROSS_BORDER)
        for code in ("EU_VAT", "US_SALES_TAX", "SG_GST", "AE_VAT"):
            assert code in p.tax_codes, f"{code} is missing"

    def test_where_the_three_currencies_are_not_told_they_are_the_same(self):
        """
        A rate of zero would be a claim that the currency is
        worthless. Where nothing was told, the rate is one and the
        source says so.
        """
        cleaned = apply_profile_to_transaction_payload({}, PROFILE_CROSS_BORDER)
        assert cleaned["exchange_rate"] == 1
        assert cleaned["exchange_rate_source"] == "identity"
        assert cleaned["transaction_currency"] == "IDR"
        assert cleaned["functional_currency"] == "IDR"

    def test_a_rate_that_was_told_is_kept(self):
        cleaned = apply_profile_to_transaction_payload(
            {"exchange_rate": 16250.5, "exchange_rate_source": "bi"}, PROFILE_CROSS_BORDER
        )
        assert cleaned["exchange_rate"] == 16250.5
        assert cleaned["exchange_rate_source"] == "bi"


class TestTheDifferenceBetweenAddingAndWithholding:
    def test_the_income_tax_is_withheld_and_the_rest_is_added(self):
        """
        A tax that is added to the bill is the customer's money being
        passed on. A tax that is withheld is the seller's own money
        being taken.
        """
        assert is_withholding("PPH_23") is True
        assert is_withholding("PPH_21") is True
        assert is_withholding("PPH_26") is True
        assert is_withholding("PPH_22") is True
        assert is_withholding("WITHHOLDING") is True

        assert is_withholding("PPN") is False
        assert is_withholding("PPNBM") is False
        assert is_withholding("PBJT") is False
        assert is_withholding("EU_VAT") is False
        assert is_withholding("SG_GST") is False
        assert is_withholding(None) is False


class TestWhatTheBrowserIsTold:
    def test_all_three_modes_are_described(self):
        described = describe_profiles()
        assert len(described) == 3
        assert {d["profile"] for d in described} == {
            PROFILE_UMKM,
            PROFILE_B2B,
            PROFILE_CROSS_BORDER,
        }

    def test_the_description_carries_the_field_visibility(self):
        """
        The browser should not keep its own copy of the rules, because
        a copy drifts.
        """
        described = {d["profile"]: d for d in describe_profiles()}
        assert described[PROFILE_UMKM]["fields"]["customs_fields"]["shown"] is False
        assert described[PROFILE_B2B]["fields"]["payment_terms"]["required"] is True
        assert described[PROFILE_CROSS_BORDER]["fields"]["multi_currency"]["shown"] is True

    def test_the_description_lists_the_tax_codes_of_the_mode(self):
        described = {d["profile"]: d for d in describe_profiles()}
        assert "PPN" in described[PROFILE_UMKM]["tax_codes"]
        assert "PPH_23" not in described[PROFILE_UMKM]["tax_codes"]
