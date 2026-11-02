"""
The tax rules that are in force, written down once.

The rules of a place change now and then, and the way they change is
that a new row is added and the old one is given an end date. So the
rules are kept in a table and not in the code, and the code asks the
table.

This file is what puts the first rows into that table. It is run once,
by the deployment, and it is safe to run again: a rule that is already
there is left alone, so a second run does not duplicate anything and
does not change the history of a sale that was already taxed under it.

The rules that are here are the ones a merchant outside Indonesia is
most likely to meet, plus the Indonesian ones the engine knows by
heart. They are the law as it was published, and each one names the
document it came from in `rule_version`, because a rule that is later
corrected has to be told apart from the one that was in force at the
time.

The flags in `metadata_json` are the parts that have no common shape
between countries: whether the supply is inside the European Union and
the tax is charged in reverse, whether the seller has a nexus in that
county, whether the goods were imported, whether the seller is in a
designated zone.
"""

import json
from typing import Any, Dict, List

from app.models.tax_rule import TaxRule

# The rules, one per place and one per tax.

RULES: List[Dict[str, Any]] = [
    # --- Indonesia ------------------------------------------------------
    {
        "country_code": "ID",
        "tax_code": "PPN",
        "tax_type": "PPN",
        "nominal_rate": 12,
        # The base of the ordinary PPN is eleven twelfths of the
        # price, because the price already carries a tenth of the
        # value as the supplier's own margin. The luxury PPN is
        # charged on the whole price, so it is a second rule.
        "dpp_multiplier_numerator": 11,
        "dpp_multiplier_denominator": 12,
        "tax_behavior": "ADDITIVE",
        "rule_version": "PMK 131/2024",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps({"luxury_goods": False}),
    },
    {
        "country_code": "ID",
        "tax_code": "PPN",
        "tax_type": "PPN",
        "nominal_rate": 12,
        "dpp_multiplier_numerator": 1,
        "dpp_multiplier_denominator": 1,
        "tax_behavior": "ADDITIVE",
        "rule_version": "PMK 131/2024 (luxury)",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps({"luxury_goods": True}),
    },
    {
        "country_code": "ID",
        "tax_code": "PPNBM",
        "tax_type": "PPNBM",
        "nominal_rate": 20,
        "dpp_multiplier_numerator": 1,
        "dpp_multiplier_denominator": 1,
        "tax_behavior": "ADDITIVE",
        "rule_version": "PMK 96/2023",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps({}),
    },
    {
        "country_code": "ID",
        "tax_code": "PBJT",
        "tax_type": "PBJT",
        "nominal_rate": 10,
        "dpp_multiplier_numerator": 1,
        "dpp_multiplier_denominator": 1,
        "tax_behavior": "ADDITIVE",
        "rule_version": "UU 1/2022",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps({}),
    },
    # --- The European Union ---------------------------------------------
    {
        "country_code": "DE",
        "tax_code": "VAT",
        "tax_type": "VAT",
        "nominal_rate": 19,
        "dpp_multiplier_numerator": 1,
        "dpp_multiplier_denominator": 1,
        "tax_behavior": "ADDITIVE",
        "rule_version": "UStG 2024 §12",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps(
            {
                "intra_eu_supply_flag": False,
                "reverse_charge_flag": False,
            }
        ),
    },
    {
        "country_code": "FR",
        "tax_code": "VAT",
        "tax_type": "VAT",
        "nominal_rate": 20,
        "dpp_multiplier_numerator": 1,
        "dpp_multiplier_denominator": 1,
        "tax_behavior": "ADDITIVE",
        "rule_version": "Code général des impôts §261",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps(
            {
                "intra_eu_supply_flag": False,
                "reverse_charge_flag": False,
            }
        ),
    },
    {
        "country_code": "NL",
        "tax_code": "VAT",
        "tax_type": "VAT",
        "nominal_rate": 21,
        "dpp_multiplier_numerator": 1,
        "dpp_multiplier_denominator": 1,
        "tax_behavior": "ADDITIVE",
        "rule_version": "Wet BTW 2024",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps(
            {
                "intra_eu_supply_flag": False,
                "reverse_charge_flag": False,
            }
        ),
    },
    # --- Singapore --------------------------------------------------------
    {
        "country_code": "SG",
        "tax_code": "GST",
        "tax_type": "GST",
        "nominal_rate": 9,
        "dpp_multiplier_numerator": 1,
        "dpp_multiplier_denominator": 1,
        "tax_behavior": "ADDITIVE",
        "rule_version": "GST Act 2024",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps(
            {
                "gst_registration_status": "REGISTERED",
                "zero_rated_supply_flag": False,
                "import_gst_flag": False,
            }
        ),
    },
    # --- The United Arab Emirates ---------------------------------------
    {
        "country_code": "AE",
        "tax_code": "VAT",
        "tax_type": "VAT",
        "nominal_rate": 5,
        "dpp_multiplier_numerator": 1,
        "dpp_multiplier_denominator": 1,
        "tax_behavior": "ADDITIVE",
        "rule_version": "Federal Decree-Law 47/2022",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps(
            {
                "designated_zone_flag": False,
                "reverse_charge_flag": False,
            }
        ),
    },
    # --- The United States -----------------------------------------------
    {
        "country_code": "US",
        "tax_code": "SALES_TAX",
        "tax_type": "SALES_TAX",
        "nominal_rate": 8.5,
        "dpp_multiplier_numerator": 1,
        "dpp_multiplier_denominator": 1,
        "tax_behavior": "ADDITIVE",
        "rule_version": "state and local combined rate",
        "rounding_method": "ROUND_HALF_UP",
        "metadata_json": json.dumps({"nexus_status": "YES"}),
    },
]


def seed_tax_rules(db) -> int:
    """
    Put the rules into the table, and say how many were written down.

    A rule that is already there is not written again. The test is the
    country, the tax code, the place and the version, because two
    rules of the same country and the same tax can differ by the state
    they apply to, and two versions of the same rule must both be
    kept.
    """
    written = 0
    for rule in RULES:
        already = (
            db.query(TaxRule)
            .filter(
                TaxRule.country_code == rule["country_code"],
                TaxRule.tax_code == rule["tax_code"],
                TaxRule.state_code.is_(None),
                TaxRule.county_code.is_(None),
                TaxRule.city_code.is_(None),
                TaxRule.rule_version == rule["rule_version"],
            )
            .first()
        )
        if already is not None:
            continue

        db.add(TaxRule(**rule))
        written += 1

    if written:
        db.commit()
    return written
