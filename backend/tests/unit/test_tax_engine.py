"""
The tax engine, tested on its own.

The engine is arithmetic and nothing else, so it is tested without a
database and without a request. That is the reason it was written
apart from the routes: a rounding rule that sits next to the code
that reads the receipt is a rule that gets changed by accident.

The cases are the ones that have actually been got wrong somewhere in
the world:

- the arithmetic of a line, and the sharing of a discount that
  belongs to the whole sale;
- the Indonesian sales tax, where the rate is 12% but ordinary goods
  are taxed on eleven twelfths of the price and luxury goods on the
  whole of it;
- a price that already has the tax inside it;
- a tax that is withheld rather than added, which must not make the
  customer's bill bigger;
- a sale in another country, under the rule of that country.

Everything is a `Decimal` and every expected answer is written out
in full, because "about eleven percent" is not an answer a till can
be reconciled with.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.services.calculation.tax_engine import (
    compute_international_tax,
    compute_lines,
    compute_ppn,
    compute_tax,
    compute_transaction,
    resolve_rule,
)


# === The lines =============================================================


def test_the_gross_of_a_line_is_the_quantity_times_the_price():
    """Two eggs at 5.000 each are 10.000."""
    lines = compute_lines(
        [{"item_name": "Telur", "quantity": Decimal("2"), "unit_price": Decimal("5000")}],
        currency="IDR",
    )

    assert lines[0]["gross_amount"] == Decimal("10000")


def test_the_discount_of_a_line_comes_off_before_the_tax():
    """A line discount is taken off the gross, and the rest is the net."""
    lines = compute_lines(
        [
            {
                "item_name": "Telur",
                "quantity": Decimal("2"),
                "unit_price": Decimal("5000"),
                "line_discount_amount": Decimal("1000"),
            }
        ],
        currency="IDR",
    )

    assert lines[0]["gross_amount"] == Decimal("10000")
    assert lines[0]["line_discount_amount"] == Decimal("1000")
    assert lines[0]["net_item_amount"] == Decimal("9000")


def test_a_discount_on_the_whole_sale_is_shared_in_proportion_to_the_value():
    """
    A discount of 1000 over lines of 6000 and 4000 is shared 600 and
    400, because a discount on a sale is a discount on the price and
    the price is what the tax is charged on.
    """
    lines = compute_lines(
        [
            {"item_name": "A", "quantity": Decimal("1"), "unit_price": Decimal("6000")},
            {"item_name": "B", "quantity": Decimal("1"), "unit_price": Decimal("4000")},
        ],
        transaction_discount_amount=Decimal("1000"),
        allocation_method="PROPORTIONAL_VALUE",
        currency="IDR",
    )

    assert lines[0]["allocated_header_discount"] == Decimal("600")
    assert lines[1]["allocated_header_discount"] == Decimal("400")
    assert lines[0]["net_item_amount"] == Decimal("5400")
    assert lines[1]["net_item_amount"] == Decimal("3600")


def test_the_shares_of_a_discount_add_up_to_the_whole_discount():
    """
    Three equal lines and a discount of 100 cannot each take 33.33.
    The parts add up to 100 exactly, so the bill is not a rupiah out.
    """
    lines = compute_lines(
        [
            {"item_name": "A", "quantity": Decimal("1"), "unit_price": Decimal("100")},
            {"item_name": "B", "quantity": Decimal("1"), "unit_price": Decimal("100")},
            {"item_name": "C", "quantity": Decimal("1"), "unit_price": Decimal("100")},
        ],
        transaction_discount_amount=Decimal("100"),
        currency="IDR",
    )

    shared = sum(line["allocated_header_discount"] for line in lines)
    assert shared == Decimal("100")


def test_a_discount_can_be_shared_in_equal_parts_instead():
    """
    Two lines of 6000 and 4000 with a discount of 1000, shared in
    equal parts, is 500 each.
    """
    lines = compute_lines(
        [
            {"item_name": "A", "quantity": Decimal("1"), "unit_price": Decimal("6000")},
            {"item_name": "B", "quantity": Decimal("1"), "unit_price": Decimal("4000")},
        ],
        transaction_discount_amount=Decimal("1000"),
        allocation_method="EQUAL",
        currency="IDR",
    )

    assert lines[0]["allocated_header_discount"] == Decimal("500")
    assert lines[1]["allocated_header_discount"] == Decimal("500")


def test_money_is_never_a_float():
    """A price written as a float still comes out as an exact decimal."""
    lines = compute_lines(
        [{"item_name": "A", "quantity": 3, "unit_price": 0.1}],
        currency="USD",
    )

    assert isinstance(lines[0]["gross_amount"], Decimal)
    assert lines[0]["gross_amount"] == Decimal("0.30")


# === The Indonesian sales tax =============================================


def test_ordinary_goods_are_taxed_on_eleven_twelfths_of_the_price():
    """
    PPN on ordinary goods: the rate is 12%, the base is eleven
    twelfths of the price, and the tax that comes out is 11% of it.

    Source: UU 7/2021 Pasal 7; PMK 131/2024.
    """
    result = compute_ppn(Decimal("1200000"))

    assert result["tax_rate"] == Decimal("12")
    assert result["taxable_amount"] == Decimal("1100000")
    assert result["tax_amount"] == Decimal("132000")
    assert result["tax_base_method"] == "DPP_NILAI_LAIN_11_12"


def test_luxury_goods_are_taxed_on_the_whole_of_the_price():
    """Luxury goods pay the full 12% on the whole price."""
    result = compute_ppn(Decimal("1200000"), luxury=True)

    assert result["tax_rate"] == Decimal("12")
    assert result["taxable_amount"] == Decimal("1200000")
    assert result["tax_amount"] == Decimal("144000")
    assert result["tax_base_method"] == "FULL_NET"


def test_a_price_that_already_has_the_tax_in_it():
    """
    A price of 1.110.000 that says it includes 11% of tax has a value
    of 1.000.000 in it and 110.000 of tax. The tax is not added again,
    because it is already in the bill.
    """
    result = compute_ppn(Decimal("1110000"), inclusive=True)

    assert result["tax_amount"] == Decimal("110000")
    # The base is eleven twelfths of the value, because ordinary
    # goods are not taxed on the whole of them.
    assert result["taxable_amount"].quantize(Decimal("0.01")) == Decimal("916666.67")


def test_the_tax_is_the_same_whether_it_is_inclusive_or_not():
    """
    The money that comes out is the same money either way. The
    difference is only in the base it was worked out from.
    """
    exclusive = compute_ppn(Decimal("1000000"))
    inclusive = compute_ppn(Decimal("1110000"), inclusive=True)

    assert inclusive["tax_amount"] == exclusive["tax_amount"]


def test_a_tax_that_is_exempt_is_zero_and_says_why():
    """A tax of zero with no reason looks like a gift."""
    result = compute_tax(
        {
            "tax_code": "PPN",
            "tax_type": "PPN",
            "tax_category": "EXEMPT",
            "tax_exemption_reason": "the seller is a small trader",
        },
        base_amount=Decimal("1000000"),
        currency="IDR",
    )

    assert result["tax_amount"] == Decimal("0")
    assert result["tax_exemption_code"] == "DIBEBASKAN"
    assert result["tax_exemption_reason"] == "the seller is a small trader"


def test_a_tax_borne_by_the_seller_is_zero_and_says_why():
    """A tax the seller bears in full is a tax of zero on the sale."""
    result = compute_tax(
        {
            "tax_code": "PPN",
            "tax_type": "PPN",
            "tax_category": "DTP",
            "tax_exemption_reason": "the goods are for the shop's own use",
        },
        base_amount=Decimal("1000000"),
        currency="IDR",
    )

    assert result["tax_amount"] == Decimal("0")
    assert result["tax_exemption_code"] == "DTP"


def test_the_local_tax_of_a_region_is_charged_on_the_whole_price():
    """PBJT is 10% on the whole price."""
    result = compute_tax(
        {"tax_code": "PBJT", "tax_type": "PBJT", "tax_rate": Decimal("10")},
        base_amount=Decimal("1000000"),
        currency="IDR",
    )

    assert result["tax_rate"] == Decimal("10")
    assert result["taxable_amount"] == Decimal("1000000")
    assert result["tax_amount"] == Decimal("100000")


def test_the_duty_on_imported_goods_is_charged_on_the_customs_value():
    """
    The duty is charged on what the customs office was told the goods
    are worth, not on what the customer paid.
    """
    result = compute_tax(
        {"tax_code": "BM", "tax_type": "IMPORT_DUTY", "tax_rate": Decimal("5")},
        base_amount=Decimal("2000000"),
        currency="IDR",
        customs_value=Decimal("1000000"),
    )

    assert result["taxable_amount"] == Decimal("1000000")
    assert result["tax_amount"] == Decimal("50000")


# === The tax that is withheld =============================================


def test_a_withheld_tax_does_not_make_the_bill_bigger():
    """
    A tax that is withheld is taken out of what the merchant receives.
    It never goes on to the customer's bill.
    """
    worked_out = compute_transaction(
        [{"item_name": "A", "quantity": Decimal("1"), "unit_price": Decimal("1000000")}],
        taxes=[
            {
                "tax_code": "PPh23",
                "tax_type": "PH_WITHHOLDING",
                "tax_behavior": "WITHHOLDING",
                "tax_rate": Decimal("2"),
            }
        ],
        currency="IDR",
    )

    totals = worked_out["totals"]
    assert totals["total_withholding_tax"] == Decimal("20000")
    assert totals["total_tax_additive"] == Decimal("0")
    assert totals["grand_total"] == Decimal("1000000")
    assert totals["net_receivable_amount"] == Decimal("980000")


def test_the_customer_pays_the_lines_plus_the_taxes_that_are_added():
    """
    The bill is the net of the lines, plus the taxes that are added,
    plus the shipping and the fees and the rounding.
    """
    worked_out = compute_transaction(
        [{"item_name": "A", "quantity": Decimal("1"), "unit_price": Decimal("1200000")}],
        taxes=[{"tax_code": "PPN", "tax_type": "PPN"}],
        shipping_fee=Decimal("20000"),
        currency="IDR",
    )

    totals = worked_out["totals"]
    assert totals["total_tax_additive"] == Decimal("132000")
    assert totals["grand_total"] == Decimal("1352000")


def test_every_tax_shows_its_rate_its_base_and_its_amount_apart():
    """
    The three numbers are kept apart, because they answer three
    different questions. The rate is 12%, the base is eleven twelfths
    of the price, and the tax is 11% of the price.
    """
    worked_out = compute_transaction(
        [{"item_name": "A", "quantity": Decimal("1"), "unit_price": Decimal("1200000")}],
        taxes=[{"tax_code": "PPN", "tax_type": "PPN"}],
        currency="IDR",
    )

    tax = worked_out["taxes"][0]
    assert tax["tax_rate"] == Decimal("12")
    assert tax["taxable_amount"] == Decimal("1100000")
    assert tax["tax_amount"] == Decimal("132000")


# === The taxes of other countries =========================================


def _rule(**kwargs):
    """A rule, written as a dictionary."""
    rule = {
        "id": 1,
        "country_code": "DE",
        "tax_code": "VAT",
        "tax_type": "VAT",
        "nominal_rate": Decimal("19"),
        "effective_from": date(2020, 1, 1),
        "effective_to": None,
        "metadata_json": {},
    }
    rule.update(kwargs)
    return rule


def test_a_supply_inside_the_european_union_is_charged_in_reverse():
    """
    A supply from one member state to another is not taxed in the
    state it comes from. The tax is due in the state it goes to, and
    the buyer accounts for it, so there is no tax on the sale.
    """
    result = compute_tax(
        {"tax_code": "VAT", "tax_type": "VAT", "country_code": "DE"},
        base_amount=Decimal("1000"),
        currency="EUR",
        rules=[
            _rule(
                metadata_json={
                    "intra_eu_supply_flag": True,
                    "reverse_charge_flag": True,
                }
            )
        ],
        on_date=date(2026, 1, 15),
        customer_country="FR",
    )

    assert result["tax_amount"] == Decimal("0")
    assert result["tax_exemption_code"] == "REVERSE_CHARGE"
    assert result["tax_exemption_reason"]


def test_a_supply_inside_the_european_union_that_is_not_reverse_charged():
    """
    The tax is still due in the state it goes to, so the sale itself
    carries no tax, but the reason is a different one.
    """
    result = compute_tax(
        {"tax_code": "VAT", "tax_type": "VAT", "country_code": "DE"},
        base_amount=Decimal("1000"),
        currency="EUR",
        rules=[_rule(metadata_json={"intra_eu_supply_flag": True})],
        on_date=date(2026, 1, 15),
        customer_country="FR",
    )

    assert result["tax_amount"] == Decimal("0")
    assert result["tax_exemption_code"] == "INTRA_EU_SUPPLY"


def test_a_supply_in_a_united_state_is_taxed_at_the_combined_rate():
    """
    The sales tax of a state, a county and a city is one rate, and
    the rule carries it.
    """
    result = compute_tax(
        {
            "tax_code": "SALES_TAX",
            "tax_type": "SALES_TAX",
            "country_code": "US",
            "state_code": "CA",
        },
        base_amount=Decimal("1000"),
        currency="USD",
        rules=[
            _rule(
                country_code="US",
                tax_code="SALES_TAX",
                tax_type="SALES_TAX",
                state_code="CA",
                nominal_rate=Decimal("8.75"),
                metadata_json={"nexus_status": "YES"},
            )
        ],
        on_date=date(2026, 1, 15),
    )

    assert result["tax_rate"] == Decimal("8.75")
    assert result["tax_amount"] == Decimal("87.50")


def test_a_seller_without_nexus_charges_no_sales_tax():
    """A seller who has no nexus in the place has no tax to charge there."""
    result = compute_tax(
        {
            "tax_code": "SALES_TAX",
            "tax_type": "SALES_TAX",
            "country_code": "US",
            "state_code": "CA",
        },
        base_amount=Decimal("1000"),
        currency="USD",
        rules=[
            _rule(
                country_code="US",
                tax_code="SALES_TAX",
                tax_type="SALES_TAX",
                state_code="CA",
                nominal_rate=Decimal("8.75"),
                metadata_json={"nexus_status": "NO"},
            )
        ],
        on_date=date(2026, 1, 15),
    )

    assert result["tax_amount"] == Decimal("0")
    assert result["tax_exemption_code"] == "NO_NEXUS"


def test_the_goods_tax_of_singapore_is_nine_percent():
    """GST is 9%."""
    result = compute_tax(
        {"tax_code": "GST", "tax_type": "GST", "country_code": "SG"},
        base_amount=Decimal("1000"),
        currency="SGD",
        rules=[
            _rule(
                country_code="SG",
                tax_code="GST",
                tax_type="GST",
                nominal_rate=Decimal("9"),
                metadata_json={"gst_registration_status": "REGISTERED"},
            )
        ],
        on_date=date(2026, 1, 15),
    )

    assert result["tax_rate"] == Decimal("9")
    assert result["tax_amount"] == Decimal("90")


def test_a_supply_from_a_designated_zone_in_the_emirates_is_not_charged():
    """UAE VAT is 5%, and a designated zone is not charged."""
    result = compute_tax(
        {"tax_code": "VAT", "tax_type": "VAT", "country_code": "AE"},
        base_amount=Decimal("1000"),
        currency="AED",
        rules=[
            _rule(
                country_code="AE",
                tax_code="VAT",
                tax_type="VAT",
                nominal_rate=Decimal("5"),
                metadata_json={"designated_zone_flag": True},
            )
        ],
        on_date=date(2026, 1, 15),
    )

    assert result["tax_amount"] == Decimal("0")
    assert result["tax_exemption_code"] == "DESIGNATED_ZONE"


def test_the_rule_of_the_day_is_the_one_that_is_used():
    """
    Two rules for the same tax, one before a date and one after it.
    The sale of the day is taxed under the rule of the day.
    """
    rules = [
        _rule(
            id=1,
            nominal_rate=Decimal("16"),
            effective_from=date(2010, 1, 1),
            effective_to=date(2015, 12, 31),
        ),
        _rule(
            id=2,
            nominal_rate=Decimal("19"),
            effective_from=date(2016, 1, 1),
            effective_to=None,
        ),
    ]

    found = resolve_rule(rules, "DE", "VAT", on_date=date(2026, 1, 15))
    assert found["nominal_rate"] == Decimal("19")

    found = resolve_rule(rules, "DE", "VAT", on_date=date(2012, 6, 1))
    assert found["nominal_rate"] == Decimal("16")


def test_the_rule_of_the_city_is_used_in_preference_to_the_rule_of_the_state():
    """
    A country with a state tax and a city tax has two rules, and the
    city one is the one that applies to a sale in that city.
    """
    rules = [
        _rule(id=1, country_code="US", tax_code="SALES_TAX", state_code="CA", nominal_rate=Decimal("7.25")),
        _rule(id=2, country_code="US", tax_code="SALES_TAX", state_code="CA", city_code="LA", nominal_rate=Decimal("9.75")),
    ]

    found = resolve_rule(
        rules,
        "US",
        "SALES_TAX",
        on_date=date(2026, 1, 15),
        state_code="CA",
        city_code="LA",
    )
    assert found["id"] == 2


def test_an_international_tax_does_not_make_the_bill_bigger_when_it_is_zero():
    """
    A reverse charged supply is taxed under the rule, and the sale
    carries no tax at all.
    """
    worked_out = compute_transaction(
        [{"item_name": "A", "quantity": Decimal("1"), "unit_price": Decimal("1000")}],
        taxes=[
            {
                "tax_code": "VAT",
                "tax_type": "VAT",
                "country_code": "DE",
            }
        ],
        currency="EUR",
        rules=[
            _rule(
                metadata_json={
                    "intra_eu_supply_flag": True,
                    "reverse_charge_flag": True,
                }
            )
        ],
        on_date=date(2026, 1, 15),
        customer_country="FR",
    )

    totals = worked_out["totals"]
    assert totals["total_tax_additive"] == Decimal("0")
    assert totals["grand_total"] == Decimal("1000")
