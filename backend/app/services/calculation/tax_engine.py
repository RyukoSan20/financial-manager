"""
The tax engine of a shop that sells in more than one country.

A sale is not one number. It is a set of lines, a discount that may
belong to the whole sale rather than to any one line, and a set of
taxes that are worked out under the law of the place the sale happened
in. The tax engine is the part that does the arithmetic, and it does
nothing else: it knows no database, no request and no language. That
is deliberate, for the same reason the shared bill arithmetic lives
apart from the shared bill routes — a rounding rule that sits next to
the code that reads the receipt is a rule that gets changed by
accident.

Three things are worked out here.

**The lines.** Each line has a gross amount, a discount of its own, a
share of the discount on the whole sale, and a net amount. The share
of the whole discount is in proportion to the value of the line,
because a discount on a sale is a discount on the price and the price
is what the tax is charged on. The parts are settled by the largest
remainder rule, so the shares always add up to the whole discount
exactly.

**The tax.** Every tax is three numbers kept apart: the rate the rule
names, the base the rate was charged on, and the money that came out.
Indonesian PPN is the case that makes this necessary. The rate is 12%.
On ordinary goods the base is eleven twelfths of the price, so the
money that comes out is 11% of the price. A system that kept only the
rate and the tax would show 12% and 11% side by side with nothing to
say which was which.

**The bill.** The customer pays the net of the lines, plus the taxes
that are added to a bill, plus the shipping, the fees and the
rounding. The merchant keeps that, less the taxes that are withheld
from it: a tax withheld at the till is never the merchant's money, it
is the tax office's, and the merchant holds it for a while before
paying it over. So a withheld tax never makes the customer's bill
bigger, and it never makes the merchant's takings bigger either.

**How the money is rounded.** Every amount is a `Decimal`, never a
float: a float cannot hold a third of a rupiah and would quietly
round it to something else. The arithmetic is carried out at full
precision and rounded once, at the end, to the number of decimal
places the currency keeps. The rounding is half away from zero
(`ROUND_HALF_UP`), which is what the tax offices use, and the method
is written into the rule so that a country that rounds differently
can say so.

The Indonesian sales tax is not worked out from scratch here. The
rates and the tables of `indonesia.py` are used, and this module adds
only what that file does not have: the base of eleven twelfths, the
tax that is already inside a price, and the tax that is withheld
rather than added.
"""

from decimal import Decimal, ROUND_DOWN, ROUND_HALF_EVEN, ROUND_HALF_UP, InvalidOperation
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from app.services.split_engine_service import exponent_for, largest_remainder

# The rate of the Indonesian sales tax, and the part of the price it
# is charged on for goods that are not luxury goods.
#
# Source: UU 7/2021, Pasal 7; PMK 131/2024.
PPN_RATE = Decimal("12")
PPN_OTHER_BASE_NUMERATOR = Decimal("11")
PPN_OTHER_BASE_DENOMINATOR = Decimal("12")

# The rate of the local tax of a region, which the regions set
# themselves. Ten percent is the rate that most regions use.
PBJT_DEFAULT_RATE = Decimal("10")

# The rounding methods that may be named in a rule. Anything else
# falls back to half away from zero, which is the safe answer.
ROUNDING_METHODS = {
    "ROUND_HALF_UP": ROUND_HALF_UP,
    "HALF_UP": ROUND_HALF_UP,
    "ROUND_HALF_EVEN": ROUND_HALF_EVEN,
    "HALF_EVEN": ROUND_HALF_EVEN,
    "ROUND_DOWN": ROUND_DOWN,
    "DOWN": ROUND_DOWN,
}


class TaxEngineError(ValueError):
    """
    Something the engine cannot work out.

    It carries a code as well as a sentence, for the same reason the
    Indonesian calculators do: the sentence is for a developer or a
    log, and the code is for a screen that has to speak the reader's
    language.
    """

    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code = code
        self.detail = detail


# === The small helpers =====================================================


def _decimal(value: Any) -> Decimal:
    """
    Any number as a `Decimal`.

    A float goes through its own text, not through its binary value,
    because 0.1 as a float is 0.1000000000000000055511151231257827
    and a price written as 0.1 must not become that.
    """
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise TaxEngineError("bad_number", f"not a number: {value!r}")


def _round(value: Decimal, currency: Optional[str], method: str = "ROUND_HALF_UP") -> Decimal:
    """
    Round an amount to the number of decimal places the currency keeps.

    Rupiah keeps none, so one rupiah is the smallest amount there is.
    The dollar keeps two. An unknown currency is given two, which is
    the cautious answer: rounding to a whole unit where the currency
    does have cents would lose money.
    """
    exponent = exponent_for(currency)
    rounding = ROUNDING_METHODS.get(str(method or "ROUND_HALF_UP").upper(), ROUND_HALF_UP)
    quantum = Decimal(1).scaleb(-exponent)
    return _decimal(value).quantize(quantum, rounding=rounding)


def _get(source: Any, name: str, default: Any = None) -> Any:
    """
    Read a field from a rule, whether the rule is a row or a dict.

    The rules come out of the database as rows in the application and
    as plain dictionaries in the tests, and the engine should not have
    to care which.
    """
    if source is None:
        return default
    if isinstance(source, Mapping):
        return source.get(name, default)
    return getattr(source, name, default)


def _metadata(rule: Any) -> Dict[str, Any]:
    """
    The flags of a rule, as a dictionary.

    The flags are held as JSON, so they come back as a dictionary
    from the database and as a string when a rule was written by hand.
    Both are read here.
    """
    raw = _get(rule, "metadata_json")
    if raw is None:
        return {}
    if isinstance(raw, Mapping):
        return {str(key): value for key, value in raw.items()}
    if isinstance(raw, str):
        import json

        try:
            loaded = json.loads(raw)
        except (ValueError, TypeError):
            return {}
        if isinstance(loaded, Mapping):
            return {str(key): value for key, value in loaded.items()}
        return {}
    return {}


# === The lines =============================================================


def compute_lines(
    lines: Sequence[Mapping[str, Any]],
    transaction_discount_amount: Any = 0,
    allocation_method: str = "PROPORTIONAL_VALUE",
    currency: str = "IDR",
) -> List[Dict[str, Any]]:
    """
    The gross, the discount and the net of every line.

    INPUT:
        - lines: the lines of the sale. Each one is read for
          `quantity`, `unit_price` and `line_discount_amount`; the
          other fields are carried through untouched.
        - transaction_discount_amount: the discount on the whole
          sale, which is shared out over the lines.
        - allocation_method: `PROPORTIONAL_VALUE` shares the discount
          in proportion to the value of the line, and `EQUAL` shares
          it in equal parts.
        - currency: the currency the money is in.

    OUTPUT: one dictionary per line, with `gross_amount`,
    `line_discount_amount`, `allocated_header_discount`,
    `net_item_amount` and the quantities, all of them rounded to the
    currency.

    The gross of a line is the quantity times the price. The line
    discount is taken off first, because a discount on the line is a
    discount on that line and not on the others. What is left is
    shared out with the discount on the whole sale.

    The shares are settled by the largest remainder rule, so they add
    up to the discount exactly. A discount of 100 among three lines
    of 33.33 is 33.33, 33.33 and 33.34, and the last line gets the
    extra cent because its remainder is the largest. The rule that
    gives the extra unit to the line with the largest value is used
    here, so the same basket always splits the same way.

    When the lines are worth nothing between them, the discount
    cannot be shared in proportion to anything, so it is shared in
    equal parts.
    """
    discount_total = _decimal(transaction_discount_amount)

    prepared: List[Dict[str, Any]] = []
    for index, line in enumerate(lines):
        quantity = _decimal(_get(line, "quantity", 1))
        unit_price = _decimal(_get(line, "unit_price", 0))
        line_discount = _decimal(_get(line, "line_discount_amount", 0))

        gross = quantity * unit_price
        after_line_discount = gross - line_discount

        entry = dict(line)
        entry["quantity"] = quantity
        entry["unit_price"] = unit_price
        entry["line_discount_amount"] = line_discount
        entry["gross_amount"] = _round(gross, currency)
        entry["after_line_discount"] = _round(after_line_discount, currency)
        entry["_index"] = index
        prepared.append(entry)

    total_after = sum((entry["after_line_discount"] for entry in prepared), Decimal("0"))

    if not prepared:
        return []

    if str(allocation_method).upper() == "EQUAL":
        exact = {entry["_index"]: discount_total / Decimal(len(prepared)) for entry in prepared}
    else:
        if total_after <= 0:
            # The lines are worth nothing between them, so there is
            # no proportion to share the discount by.
            exact = {
                entry["_index"]: discount_total / Decimal(len(prepared)) for entry in prepared
            }
        else:
            exact = {
                entry["_index"]: discount_total * entry["after_line_discount"] / total_after
                for entry in prepared
            }

    shares = largest_remainder(exact, discount_total, exponent_for(currency))

    results: List[Dict[str, Any]] = []
    for entry in prepared:
        allocated = _decimal(shares.get(entry["_index"], Decimal("0")))
        net = entry["after_line_discount"] - allocated
        entry["allocated_header_discount"] = _round(allocated, currency)
        entry["net_item_amount"] = _round(net, currency)
        entry.pop("_index", None)
        results.append(entry)

    return results


# === The taxes =============================================================


def compute_ppn(
    net_amount: Decimal,
    luxury: bool = False,
    inclusive: bool = False,
    rate: Decimal = PPN_RATE,
) -> Dict[str, Any]:
    """
    The Indonesian sales tax on a net amount.

    INPUT:
        - net_amount: the amount of the sale the tax is on.
        - luxury: whether the goods are luxury goods.
        - inclusive: whether the amount already has the tax inside it.
        - rate: the rate, which is 12% unless the rule says otherwise.

    OUTPUT: the base, the rate and the tax, as three separate
    numbers.

    When the tax is not inside the price, ordinary goods are taxed on
    eleven twelfths of the price and luxury goods on the whole of it.
    The rate is 12% in both cases, so the tax actually paid on
    ordinary goods is 11% of the price.

    When the tax is already inside the price, the value of the goods
    is taken out first. For luxury goods the tax is 12% of that
    value, and the value is the price divided by 1.12. For ordinary
    goods the tax is 11% of the value, because only eleven twelfths
    of the value is taxed, and the value is the price divided by
    1.11. In both cases the tax is the price minus the value, which
    is the same money either way.

    Source: UU 7/2021, Pasal 7; PMK 131/2024.
    """
    amount = _decimal(net_amount)
    rate = _decimal(rate)

    if inclusive:
        if luxury:
            effective_rate = rate
        else:
            # The effective rate on the price: eleven twelfths of
            # twelve percent is eleven percent.
            effective_rate = rate * PPN_OTHER_BASE_NUMERATOR / PPN_OTHER_BASE_DENOMINATOR

        if effective_rate <= 0:
            value = amount
        else:
            # The rate is a percentage, so it is turned into a
            # fraction before it is used as one. A price of 111 with
            # 11% inside it is a value of 100.
            value = amount / (Decimal("1") + effective_rate / Decimal("100"))

        tax = amount - value

        if luxury:
            taxable = value
            base_method = "FULL_NET"
        else:
            taxable = value * PPN_OTHER_BASE_NUMERATOR / PPN_OTHER_BASE_DENOMINATOR
            base_method = "DPP_NILAI_LAIN_11_12"

        return {
            "taxable_amount": taxable,
            "tax_rate": rate,
            "tax_amount": tax,
            "tax_base_method": base_method,
            "effective_rate": effective_rate,
        }

    if luxury:
        taxable = amount
        base_method = "FULL_NET"
    else:
        taxable = amount * PPN_OTHER_BASE_NUMERATOR / PPN_OTHER_BASE_DENOMINATOR
        base_method = "DPP_NILAI_LAIN_11_12"

    tax = taxable * rate / Decimal("100")

    return {
        "taxable_amount": taxable,
        "tax_rate": rate,
        "tax_amount": tax,
        "tax_base_method": base_method,
        "effective_rate": rate,
    }


def resolve_rule(
    rules: Iterable[Any],
    country_code: Optional[str],
    tax_code: Optional[str],
    on_date: Optional[Any] = None,
    state_code: Optional[str] = None,
    county_code: Optional[str] = None,
    city_code: Optional[str] = None,
) -> Optional[Any]:
    """
    The rule that was in force, on a day, in a place.

    The rules are narrowed down by country and by tax code first. Then
    the place is made finer: a rule that names a city is used in
    preference to one that names a county, which is used in preference
    to one that names a state, which is used in preference to one that
    names none of them. A country with a state tax and a city tax has
    two rules, and the city one is the one that applies to a sale in
    that city.

    A rule is only used if it was in force on the day of the sale. A
    rule with no end date is in force until it is replaced.

    The most specific rule wins, and the order the rules come in
    does not matter: a sale is taxed the same way whichever order the
    rules were written down in.
    """
    if not country_code or not tax_code:
        return None

    country = str(country_code).upper()
    code = str(tax_code).upper()

    candidates = []
    for rule in rules or []:
        if str(_get(rule, "country_code", "")).upper() != country:
            continue
        if str(_get(rule, "tax_code", "")).upper() != code:
            continue

        effective_from = _get(rule, "effective_from")
        effective_to = _get(rule, "effective_to")
        if on_date is not None:
            if effective_from is not None and on_date < effective_from:
                continue
            if effective_to is not None and on_date > effective_to:
                continue

        candidates.append(rule)

    if not candidates:
        return None

    def specificity(rule: Any) -> Tuple[int, int, int, int]:
        """
        How particular a rule is.

        The place the rule names, from the finest to the coarsest.
        A rule that names nothing is the last one to be chosen, and a
        rule that names a city is the first.
        """
        return (
            1 if _get(rule, "city_code") else 0,
            1 if _get(rule, "county_code") else 0,
            1 if _get(rule, "state_code") else 0,
            1 if _get(rule, "effective_from") else 0,
        )

    def matches_place(rule: Any) -> bool:
        """
        Whether the rule names the place the sale was in.

        A rule that names a state but not the state of the sale does
        not apply. A rule that names nothing applies everywhere.
        """
        for field, wanted in (
            ("state_code", state_code),
            ("county_code", county_code),
            ("city_code", city_code),
        ):
            have = _get(rule, field)
            if have and wanted and str(have).upper() != str(wanted).upper():
                return False
        return True

    applicable = [rule for rule in candidates if matches_place(rule)]
    if not applicable:
        applicable = candidates

    return max(applicable, key=specificity)


def _zero_tax(
    reason_code: str,
    reason: str,
    rate: Decimal,
    base: Decimal,
    category: str = "EXEMPT",
) -> Dict[str, Any]:
    """
    A tax of zero, with the reason written down.

    A tax of zero with no reason looks like a gift, and a tax of zero
    with a reason is a rule that was applied. The reason is kept so
    that the reader can tell the two apart.
    """
    return {
        "taxable_amount": base,
        "tax_rate": rate,
        "tax_amount": Decimal("0"),
        "tax_base_method": "FULL_NET",
        "tax_category": category,
        "tax_exemption_code": reason_code,
        "tax_exemption_reason": reason,
    }


def compute_international_tax(
    rule: Any,
    base_amount: Decimal,
    customer_country: Optional[str] = None,
    customs_value: Optional[Decimal] = None,
) -> Dict[str, Any]:
    """
    A tax of a country other than Indonesia, from its rule.

    INPUT:
        - rule: the rule that was resolved for the place and the day.
        - base_amount: the amount of the sale the tax is on.
        - customer_country: where the customer is, which is what
          decides whether a supply crosses a border.
        - customs_value: what the customs office is to be told, which
          is the base of an import tax.

    The four cases are the four the shop actually runs into.

    **The European Union.** A supply from one member state to another
    is not taxed in the state it comes from: the tax is due in the
    state it goes to, and the buyer accounts for it. A supply that
    is intra-EU and is charged in reverse has no tax on the sale at
    all, and the reason is written down. A supply that is intra-EU
    but is not reverse charged is zero rated for the same reason.

    **The United States.** The sales tax is a state tax, a county tax
    and a city tax added together, and the rule carries the combined
    rate. A seller without nexus in the place has no tax to charge
    there, and the reason is written down.

    **Singapore.** The GST is 9%. A supply that is zero rated carries
    no tax, and a supply of imported goods is taxed on what the
    customs office was told the goods are worth.

    **The United Arab Emirates.** The VAT is 5%. A supply from a
    designated zone is zero rated, and a supply that is charged in
    reverse has no tax on the sale.
    """
    metadata = _metadata(rule)
    rate = _decimal(_get(rule, "nominal_rate", 0))
    tax_type = str(_get(rule, "tax_type", "VAT") or "VAT").upper()

    def flag(name: str) -> bool:
        """A flag of the rule that is set."""
        return bool(metadata.get(name))

    def text(name: str) -> Optional[str]:
        """A piece of text from the rule."""
        value = metadata.get(name)
        return None if value is None else str(value)

    if tax_type == "SALES_TAX":
        nexus = (text("nexus_status") or "").upper()
        if nexus in ("NO", "NOT_ESTABLISHED", "NONE", "NOT_REGISTERED"):
            return _zero_tax(
                "NO_NEXUS",
                "the seller has no nexus in this place, so no sales tax is charged",
                rate,
                base_amount,
            )
        return {
            "taxable_amount": base_amount,
            "tax_rate": rate,
            "tax_amount": base_amount * rate / Decimal("100"),
            "tax_base_method": "FULL_NET",
            "tax_category": "STANDARD",
        }

    if tax_type == "GST":
        if flag("zero_rated_supply_flag"):
            return _zero_tax(
                "ZERO_RATED",
                "the supply is zero rated, so no GST is charged",
                rate,
                base_amount,
                category="ZERO_RATED",
            )
        base = base_amount
        if flag("import_gst_flag"):
            if customs_value is not None:
                base = _decimal(customs_value)
        return {
            "taxable_amount": base,
            "tax_rate": rate,
            "tax_amount": base * rate / Decimal("100"),
            "tax_base_method": "FULL_NET",
            "tax_category": "STANDARD",
        }

    # VAT: the European Union, the United Arab Emirates, and anywhere
    # else that charges a value added tax.
    if flag("intra_eu_supply_flag"):
        if flag("reverse_charge_flag"):
            return _zero_tax(
                "REVERSE_CHARGE",
                "the supply is intra-EU and the tax is charged in reverse, so no "
                "tax is added to the sale",
                rate,
                base_amount,
                category="ZERO_RATED",
            )
        return _zero_tax(
            "INTRA_EU_SUPPLY",
            "the supply is intra-EU, so the tax is due in the state it goes to",
            rate,
            base_amount,
            category="ZERO_RATED",
        )

    if flag("reverse_charge_flag"):
        return _zero_tax(
            "REVERSE_CHARGE",
            "the tax is charged in reverse, so no tax is added to the sale",
            rate,
            base_amount,
            category="ZERO_RATED",
        )

    if flag("designated_zone_flag"):
        return _zero_tax(
            "DESIGNATED_ZONE",
            "the supply is from a designated zone, so the VAT is not charged",
            rate,
            base_amount,
            category="ZERO_RATED",
        )

    base = base_amount
    if flag("import_gst_flag") and customs_value is not None:
        base = _decimal(customs_value)

    return {
        "taxable_amount": base,
        "tax_rate": rate,
        "tax_amount": base * rate / Decimal("100"),
        "tax_base_method": "FULL_NET",
        "tax_category": "STANDARD",
    }


def compute_tax(
    request: Mapping[str, Any],
    base_amount: Decimal,
    currency: str = "IDR",
    rules: Optional[Iterable[Any]] = None,
    on_date: Optional[Any] = None,
    customer_country: Optional[str] = None,
    customs_value: Optional[Decimal] = None,
) -> Dict[str, Any]:
    """
    One tax, worked out.

    INPUT:
        - request: what is asked for. The fields that are read are
          `tax_code`, `tax_type`, `tax_behavior`, `tax_inclusion`,
          `tax_category`, `tax_rate`, `tax_base_method`,
          `base_amount`, `country_code`, `state_code`, `county_code`
          and `city_code`.
        - base_amount: the amount of the sale the tax is on, when the
          request does not name one of its own.
        - currency: the currency the money is in.
        - rules: the rules of the world, which are searched when the
          request names a country and a tax code.
        - on_date: the day of the sale, which decides which rule was
          in force.
        - customer_country: where the customer is.
        - customs_value: what the customs office is to be told.

    OUTPUT: the rate, the base and the tax, as three separate
    numbers, together with the behaviour, the category and the reason
    when the tax is zero.

    The behaviour decides what happens to the money afterwards. An
    additive tax is added to the customer's bill. A withholding tax is
    taken out of what the merchant receives and is never added to the
    customer's bill.
    """
    tax_code = str(request.get("tax_code") or "").upper()
    tax_type = str(request.get("tax_type") or tax_code or "").upper()
    category = str(request.get("tax_category") or "STANDARD").upper()
    inclusion = str(request.get("tax_inclusion") or "EXCLUSIVE").upper()
    behavior = str(request.get("tax_behavior") or "").upper()

    own_base = request.get("base_amount")
    base = _decimal(own_base) if own_base is not None else _decimal(base_amount)

    rule = None
    country_code = request.get("country_code")
    if rules is not None and country_code and tax_code:
        rule = resolve_rule(
            rules,
            country_code,
            tax_code,
            on_date=on_date,
            state_code=request.get("state_code"),
            county_code=request.get("county_code"),
            city_code=request.get("city_code"),
        )

    if rule is not None:
        rate = _decimal(request.get("tax_rate") if request.get("tax_rate") is not None
                        else _get(rule, "nominal_rate", 0))
        behaviour_from_rule = str(_get(rule, "tax_behavior", "") or "").upper()
        if behaviour_from_rule and not behavior:
            behavior = behaviour_from_rule
        rule_tax_type = str(_get(rule, "tax_type", "") or "").upper()
        if rule_tax_type:
            tax_type = rule_tax_type
    else:
        rate = _decimal(request.get("tax_rate") or 0)

    if not behavior:
        behavior = "WITHHOLDING" if tax_type == "PH_WITHHOLDING" else "ADDITIVE"

    # An exemption is decided before anything else, because a tax
    # that does not apply is not worked out at all.
    if category in ("EXEMPT", "DTP"):
        return _zero_tax(
            "DIBEBASKAN" if category == "EXEMPT" else "DTP",
            str(request.get("tax_exemption_reason") or "")
            or (
                "the supply is exempt from tax"
                if category == "EXEMPT"
                else "the tax is borne in full by the seller"
            ),
            rate,
            base,
            category=category,
        )

    if category == "ZERO_RATED":
        return _zero_tax(
            "ZERO_RATED",
            str(request.get("tax_exemption_reason") or "") or "the supply is zero rated",
            rate,
            base,
            category="ZERO_RATED",
        )

    if tax_type == "PPN":
        result = compute_ppn(
            base,
            luxury=(category == "LUXURY"),
            inclusive=(inclusion == "INCLUSIVE"),
            rate=rate if rate > 0 else PPN_RATE,
        )
        result["tax_category"] = category
        result["tax_behavior"] = behavior or "ADDITIVE"
        result["tax_inclusion"] = inclusion
        result["tax_code"] = tax_code or "PPN"
        result["tax_type"] = "PPN"
        result["tax_exemption_code"] = None
        result["tax_exemption_reason"] = None
        result["tax_rule_id"] = _get(rule, "id") if rule is not None else None
        return result

    if tax_type == "PPNBM":
        # The tax on certain luxury goods. It is charged on the whole
        # value, on top of the sales tax.
        tax = base * rate / Decimal("100")
        return {
            "taxable_amount": base,
            "tax_rate": rate,
            "tax_amount": tax,
            "tax_base_method": "FULL_NET",
            "tax_category": category,
            "tax_behavior": behavior or "ADDITIVE",
            "tax_inclusion": inclusion,
            "tax_code": tax_code or "PPNBM",
            "tax_type": "PPNBM",
            "tax_exemption_code": None,
            "tax_exemption_reason": None,
            "tax_rule_id": _get(rule, "id") if rule is not None else None,
        }

    if tax_type == "PBJT":
        # The local tax of a region. The regions set the rate
        # themselves, and ten percent is the usual one.
        local_rate = rate if rate > 0 else PBJT_DEFAULT_RATE
        tax = base * local_rate / Decimal("100")
        return {
            "taxable_amount": base,
            "tax_rate": local_rate,
            "tax_amount": tax,
            "tax_base_method": "FULL_NET",
            "tax_category": category,
            "tax_behavior": behavior or "ADDITIVE",
            "tax_inclusion": inclusion,
            "tax_code": tax_code or "PBJT",
            "tax_type": "PBJT",
            "tax_exemption_code": None,
            "tax_exemption_reason": None,
            "tax_rule_id": _get(rule, "id") if rule is not None else None,
        }

    if tax_type == "IMPORT_DUTY":
        # The duty on goods that come in from abroad. It is charged
        # on what the customs office was told the goods are worth.
        duty_base = base
        if customs_value is not None:
            duty_base = _decimal(customs_value)
        tax = duty_base * rate / Decimal("100")
        return {
            "taxable_amount": duty_base,
            "tax_rate": rate,
            "tax_amount": tax,
            "tax_base_method": "CUSTOM_BASE",
            "tax_category": category,
            "tax_behavior": behavior or "ADDITIVE",
            "tax_inclusion": inclusion,
            "tax_code": tax_code or "IMPORT_DUTY",
            "tax_type": "IMPORT_DUTY",
            "tax_exemption_code": None,
            "tax_exemption_reason": None,
            "tax_rule_id": _get(rule, "id") if rule is not None else None,
        }

    if tax_type in ("PH_WITHHOLDING", "WITHHOLDING"):
        # The tax withheld from the sale. It is taken out of what the
        # merchant receives, so it never makes the customer's bill
        # bigger.
        tax = base * rate / Decimal("100")
        return {
            "taxable_amount": base,
            "tax_rate": rate,
            "tax_amount": tax,
            "tax_base_method": "FULL_NET",
            "tax_category": category,
            "tax_behavior": "WITHHOLDING",
            "tax_inclusion": inclusion,
            "tax_code": tax_code or "PH_WITHHOLDING",
            "tax_type": "PH_WITHHOLDING",
            "tax_exemption_code": None,
            "tax_exemption_reason": None,
            "tax_rule_id": _get(rule, "id") if rule is not None else None,
        }

    # A tax of another country. The rule of the place and the day
    # says what it is.
    if rule is not None:
        result = compute_international_tax(
            rule,
            base,
            customer_country=customer_country,
            customs_value=customs_value,
        )
    else:
        result = {
            "taxable_amount": base,
            "tax_rate": rate,
            "tax_amount": base * rate / Decimal("100"),
            "tax_base_method": "FULL_NET",
            "tax_category": category,
        }

    result["tax_behavior"] = behavior or "ADDITIVE"
    result["tax_inclusion"] = inclusion
    result["tax_code"] = tax_code or tax_type
    result["tax_type"] = tax_type or "VAT"
    result.setdefault("tax_exemption_code", None)
    result.setdefault("tax_exemption_reason", None)
    result["tax_rule_id"] = _get(rule, "id") if rule is not None else None
    return result


# === The whole sale ========================================================


def compute_transaction(
    lines: Sequence[Mapping[str, Any]],
    taxes: Optional[Sequence[Mapping[str, Any]]] = None,
    transaction_discount_amount: Any = 0,
    transaction_discount_type: str = "NONE",
    transaction_discount_rate: Any = 0,
    discount_allocation_method: str = "PROPORTIONAL_VALUE",
    shipping_fee: Any = 0,
    transaction_fee: Any = 0,
    processing_fee: Any = 0,
    import_duty_fee: Any = 0,
    rounding_amount: Any = 0,
    currency: str = "IDR",
    rules: Optional[Iterable[Any]] = None,
    on_date: Optional[Any] = None,
    seller_country: Optional[str] = None,
    customer_country: Optional[str] = None,
    customs_value: Optional[Decimal] = None,
) -> Dict[str, Any]:
    """
    The whole sale: the lines, the taxes, and what is owed.

    The discount on the whole sale is worked out from its type when
    the type says so. A percentage discount is a percentage of what
    the lines came to after their own discounts. A fixed amount is
    taken as it is given. Anything else is no discount at all.

    The bill is then:

        the net of the lines
        + the taxes that are added to a bill
        + the shipping, the fees and the rounding

    and what the merchant keeps is that, less the taxes that are
    withheld from it.

    The import duty is a charge on the goods rather than a tax on the
    sale, so it is carried as a fee and not as part of the tax total,
    and it is added to the bill once. When the duty comes in as a tax
    of its own, the two are not counted twice.

    Everything in the result is already rounded to the currency.
    """
    computed_lines = compute_lines(
        lines,
        transaction_discount_amount=transaction_discount_amount,
        allocation_method=discount_allocation_method,
        currency=currency,
    )

    subtotal_gross = sum((line["gross_amount"] for line in computed_lines), Decimal("0"))
    total_line_discount = sum(
        (line["line_discount_amount"] for line in computed_lines), Decimal("0")
    )
    total_net = sum((line["net_item_amount"] for line in computed_lines), Decimal("0"))

    # The discount on the whole sale, worked out from its type.
    discount_type = str(transaction_discount_type or "NONE").upper()
    if discount_type == "PERCENTAGE":
        discount_rate = _decimal(transaction_discount_rate)
        header_discount = total_net * discount_rate / Decimal("100")
    elif discount_type == "FIXED_AMOUNT":
        header_discount = _decimal(transaction_discount_amount)
    else:
        header_discount = _decimal(transaction_discount_amount)

    # The lines are worked out again, because the discount on the
    # whole sale may only now be known.
    if discount_type == "PERCENTAGE":
        computed_lines = compute_lines(
            lines,
            transaction_discount_amount=header_discount,
            allocation_method=discount_allocation_method,
            currency=currency,
        )
        total_net = sum((line["net_item_amount"] for line in computed_lines), Decimal("0"))

    tax_results: List[Dict[str, Any]] = []
    for request in taxes or []:
        scope = str(request.get("scope") or "TRANSACTION").upper()
        item_index = request.get("item_index")

        if scope == "ITEM" and item_index is not None:
            try:
                index = int(item_index)
                base = computed_lines[index]["net_item_amount"]
            except (IndexError, TypeError, ValueError):
                raise TaxEngineError(
                    "bad_item_index",
                    f"the tax names a line that the sale does not have: {item_index!r}",
                )
        else:
            base = total_net

        result = compute_tax(
            request,
            base_amount=base,
            currency=currency,
            rules=rules,
            on_date=on_date,
            customer_country=customer_country,
            customs_value=customs_value,
        )
        result["taxable_amount"] = _round(result["taxable_amount"], currency)
        result["tax_amount"] = _round(result["tax_amount"], currency)
        tax_results.append(result)

    additive_total = Decimal("0")
    withholding_total = Decimal("0")
    import_duty_total = Decimal("0")

    for result in tax_results:
        behaviour = str(result.get("tax_behavior") or "ADDITIVE").upper()
        amount = _decimal(result["tax_amount"])
        if behaviour == "WITHHOLDING":
            withholding_total += amount
        elif str(result.get("tax_type") or "").upper() == "IMPORT_DUTY":
            # The duty is a charge on the goods. It is kept apart so
            # that it is not counted twice: once here and once in the
            # fee column.
            import_duty_total += amount
        else:
            additive_total += amount

    shipping = _decimal(shipping_fee)
    fee = _decimal(transaction_fee)
    processing = _decimal(processing_fee)
    duty_fee = _decimal(import_duty_fee) + import_duty_total
    rounding = _decimal(rounding_amount)

    grand_total = (
        total_net + additive_total + shipping + fee + processing + duty_fee + rounding
    )

    # The tax withheld at the till is never the merchant's money, so
    # it comes off what the merchant receives and it never goes on to
    # the customer's bill.
    net_receivable = grand_total - withholding_total

    taxable_total = sum(
        (_decimal(result["taxable_amount"]) for result in tax_results), Decimal("0")
    )

    return {
        "items": computed_lines,
        "taxes": tax_results,
        "totals": {
            "subtotal_gross": _round(subtotal_gross, currency),
            "total_line_discount": _round(total_line_discount, currency),
            "transaction_discount_amount": _round(header_discount, currency),
            "total_taxable_amount": _round(taxable_total, currency),
            "total_tax_additive": _round(additive_total, currency),
            "total_withholding_tax": _round(withholding_total, currency),
            "shipping_fee": _round(shipping, currency),
            "transaction_fee": _round(fee, currency),
            "processing_fee": _round(processing, currency),
            "import_duty_fee": _round(duty_fee, currency),
            "rounding_amount": _round(rounding, currency),
            "grand_total": _round(grand_total, currency),
            "net_receivable_amount": _round(net_receivable, currency),
        },
        "currency": currency,
    }
