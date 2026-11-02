"""
The three ways of running a shop.

A warung, a freelance studio, and a company that sells across borders
are three different jobs that happen to share the same tables. The
difference is not in the tables. It is in which questions the person
at the counter actually has to answer.

The warung owner has one question: how much did I take today, and can
the customer pay by QRIS. The fields of customs value, incoterms and
reverse-charge VAT are noise to them, and every field on screen is a
field they have to look past.

The freelance studio has a different question: I am owed money, and
some of it is not mine because the tax office took it. So they need an
invoice number, a payment term, and a line that says what was withheld
before the money arrives.

The company that sells across borders has a third question: which
currency is this in, which currency is the book in, and which currency
will it settle in, and what is the rate between them today. And which
country's rule applies, because the answer depends on where the
customer is and not on where the seller is.

So this is one place where the three are written down, and everything
else in the application asks it rather than deciding for itself.

A profile is chosen per merchant and can change. It is stored on the
merchant, so a reader may run a warung in the morning and a studio in
the evening.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

# The three modes, and what each one is for.
PROFILE_UMKM = "UMKM"
PROFILE_B2B = "B2B"
PROFILE_CROSS_BORDER = "CROSS_BORDER"

PROFILE_KEYS = (PROFILE_UMKM, PROFILE_B2B, PROFILE_CROSS_BORDER)


@dataclass(frozen=True)
class FieldVisibility:
    """
    Which fields the person at the counter should be shown.

    A field that is not shown is not merely hidden, it is not asked
    for and not saved. A person should never have to fill in a field
    that does not apply to them.
    """

    shown: bool = False
    required: bool = False


@dataclass(frozen=True)
class ProfileCapabilities:
    """What this mode is able to do, in one place."""

    profile: str
    label_key: str
    description_key: str

    # The till. A warung sells over the counter and takes the money
    # there and then.
    show_invoice_number: bool = False
    show_payment_terms: bool = False
    show_customer_fields: bool = False
    show_customs_fields: bool = False
    show_incoterms: bool = False
    show_multi_currency: bool = False
    show_tax_settings: bool = False
    show_journal: bool = False
    show_withholding_tax: bool = False
    show_reverse_charge: bool = False

    # What the tax rules of this mode are drawn from.
    default_country: str = "ID"
    default_currency: str = "IDR"
    functional_currency: str = "IDR"
    allowed_invoice_types: tuple = ("POS_RECEIPT",)
    default_invoice_type: str = "POS_RECEIPT"

    # The tax rules offered in the till, by code.
    tax_codes: tuple = ("PPN",)

    def field(self, name: str) -> FieldVisibility:
        """Whether a named field is shown, and whether it is required."""
        required = name in self.required_fields
        shown = bool(getattr(self, f"show_{name}", False))
        return FieldVisibility(shown=shown, required=required and shown)

    required_fields: tuple = ()


# The definitions of the three modes.
_UMKM = ProfileCapabilities(
    profile=PROFILE_UMKM,
    label_key="merchant.profile.umkm",
    description_key="merchant.profile.umkm_desc",
    show_invoice_number=True,
    show_payment_terms=False,
    show_customer_fields=False,
    show_customs_fields=False,
    show_incoterms=False,
    show_multi_currency=False,
    show_tax_settings=True,
    show_journal=False,
    show_withholding_tax=False,
    show_reverse_charge=False,
    default_country="ID",
    default_currency="IDR",
    functional_currency="IDR",
    allowed_invoice_types=("POS_RECEIPT",),
    default_invoice_type="POS_RECEIPT",
    tax_codes=("PPN", "PPNBM", "PBJT"),
    required_fields=("invoice_number",),
)

_B2B = ProfileCapabilities(
    profile=PROFILE_B2B,
    label_key="merchant.profile.b2b",
    description_key="merchant.profile.b2b_desc",
    show_invoice_number=True,
    show_payment_terms=True,
    show_customer_fields=True,
    show_customs_fields=False,
    show_incoterms=False,
    show_multi_currency=False,
    show_tax_settings=True,
    show_journal=True,
    show_withholding_tax=True,
    show_reverse_charge=False,
    default_country="ID",
    default_currency="IDR",
    functional_currency="IDR",
    allowed_invoice_types=("TAX_INVOICE", "PROFORMA", "CREDIT_NOTE"),
    default_invoice_type="TAX_INVOICE",
    tax_codes=("PPN", "PPNBM", "PBJT", "PPH_23", "PPH_21", "PPH_26", "PPH_22"),
    required_fields=("invoice_number", "payment_terms"),
)

_CROSS_BORDER = ProfileCapabilities(
    profile=PROFILE_CROSS_BORDER,
    label_key="merchant.profile.cross_border",
    description_key="merchant.profile.cross_border_desc",
    show_invoice_number=True,
    show_payment_terms=True,
    show_customer_fields=True,
    show_customs_fields=True,
    show_incoterms=True,
    show_multi_currency=True,
    show_tax_settings=True,
    show_journal=True,
    show_withholding_tax=True,
    show_reverse_charge=True,
    default_country="ID",
    default_currency="IDR",
    functional_currency="IDR",
    allowed_invoice_types=("TAX_INVOICE", "PROFORMA", "CREDIT_NOTE", "POS_RECEIPT"),
    default_invoice_type="TAX_INVOICE",
    tax_codes=(
        "PPN",
        "PPNBM",
        "PBJT",
        "PPH_23",
        "PPH_21",
        "PPH_26",
        "PPH_22",
        "EU_VAT",
        "US_SALES_TAX",
        "SG_GST",
        "AE_VAT",
        "IMPORT_DUTY",
    ),
    required_fields=("invoice_number", "multi_currency"),
)

PROFILES: Dict[str, ProfileCapabilities] = {
    PROFILE_UMKM: _UMKM,
    PROFILE_B2B: _B2B,
    PROFILE_CROSS_BORDER: _CROSS_BORDER,
}


def normalise_profile(profile: Optional[str]) -> str:
    """
    Which mode is this?

    An unknown mode, or no mode at all, is treated as the warung. The
    warung is the mode where the fewest things are asked for, so if
    we are wrong about which mode this is, we have asked for too
    little rather than too much.
    """
    if not profile:
        return PROFILE_UMKM
    key = str(profile).strip().upper().replace("-", "_").replace(" ", "_")
    if key in PROFILES:
        return key
    # Some older spellings of the same idea.
    aliases = {
        "UMKM_MODE": PROFILE_UMKM,
        "LITE_POS": PROFILE_UMKM,
        "POS": PROFILE_UMKM,
        "RETAIL": PROFILE_UMKM,
        "INVOICING": PROFILE_B2B,
        "TAX_MODE": PROFILE_B2B,
        "B2B_INVOICING": PROFILE_B2B,
        "FREELANCER": PROFILE_B2B,
        "GLOBAL": PROFILE_CROSS_BORDER,
        "CROSS_BORDER_MODE": PROFILE_CROSS_BORDER,
        "ENTERPRISE": PROFILE_CROSS_BORDER,
        "MULTI_CURRENCY": PROFILE_CROSS_BORDER,
    }
    return aliases.get(key, PROFILE_UMKM)


def get_profile(profile: Optional[str]) -> ProfileCapabilities:
    """The capabilities of one mode."""
    return PROFILES[normalise_profile(profile)]


def is_withholding(code: Optional[str]) -> bool:
    """
    Is this tax one that is withheld from what the seller receives?

    A tax that is added to the bill is the customer's money being
    passed on. A tax that is withheld is the seller's own money being
    taken. The customer is not charged for it, and it never appears
    on the invoice as an extra line, but it does come out of the
    money the seller banks.
    """
    if not code:
        return False
    return str(code).strip().upper().startswith("PPH_") or str(code).strip().upper() in (
        "PH_WITHHOLDING",
        "WITHHOLDING",
    )


def describe_profiles() -> List[Dict]:
    """
    The three modes, in a form that can be handed to the browser.

    Every field the browser needs to know is here, so the browser
    does not have to keep its own copy of the rules and drift from
    them.
    """
    out = []
    for key in PROFILE_KEYS:
        p = PROFILES[key]
        out.append(
            {
                "profile": p.profile,
                "label_key": p.label_key,
                "description_key": p.description_key,
                "default_country": p.default_country,
                "default_currency": p.default_currency,
                "functional_currency": p.functional_currency,
                "default_invoice_type": p.default_invoice_type,
                "allowed_invoice_types": list(p.allowed_invoice_types),
                "tax_codes": list(p.tax_codes),
                "fields": {
                    name: {
                        "shown": bool(getattr(p, f"show_{name}", False)),
                        "required": name in p.required_fields,
                    }
                    for name in (
                        "invoice_number",
                        "payment_terms",
                        "customer_fields",
                        "customs_fields",
                        "incoterms",
                        "multi_currency",
                        "tax_settings",
                        "journal",
                        "withholding_tax",
                        "reverse_charge",
                    )
                },
            }
        )
    return out


def apply_profile_to_transaction_payload(
    payload: Dict, profile: Optional[str]
) -> Dict:
    """
    Clean a transaction of the fields that do not belong to this mode.

    This is called before the transaction is saved, so that a warung
    does not end up with an empty incoterms field or a customs value
    of zero lying in the table, which would look like a fact.
    """
    p = get_profile(profile)
    out = dict(payload)

    if not p.show_invoice_number:
        out.pop("invoice_number", None)
    if not p.show_payment_terms:
        out.pop("payment_terms_days", None)
        out.pop("due_date", None)
    if not p.show_customer_fields:
        for key in ("customer_name", "customer_email", "customer_vat_id", "customer_id"):
            out.pop(key, None)
    if not p.show_customs_fields:
        for key in ("customs_value", "import_duty_fee", "cross_border_flag"):
            out.pop(key, None)
    if not p.show_incoterms:
        out.pop("incoterms", None)
    if not p.show_multi_currency:
        for key in (
            "transaction_currency",
            "functional_currency",
            "settlement_currency",
            "exchange_rate",
            "exchange_rate_date",
            "exchange_rate_source",
        ):
            out.pop(key, None)
    else:
        # Where the three currencies are not told, they are the same
        # and the rate is one. An unset rate of zero would be a claim
        # that the currency is worthless.
        out["transaction_currency"] = out.get("transaction_currency") or p.default_currency
        out["functional_currency"] = out.get("functional_currency") or p.functional_currency
        out["settlement_currency"] = out.get("settlement_currency") or p.default_currency
        if not out.get("exchange_rate"):
            out["exchange_rate"] = 1
            out["exchange_rate_date"] = None
            out["exchange_rate_source"] = "identity"

    if out.get("invoice_type") not in p.allowed_invoice_types:
        out["invoice_type"] = p.default_invoice_type

    return out
