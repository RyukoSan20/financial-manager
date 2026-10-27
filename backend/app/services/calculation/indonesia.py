"""
The Indonesian rules.

The calculators that were already in the application are the ones any
country would want: discount, tip, loan, compound interest, savings,
income conversion, budget split. This file holds the ones that only
make sense here, because they follow Indonesian law and Indonesian
institutions.

Four of them:

- **PPh 21** — the income tax an employer withholds. The rate is the
  *tarif efektif* (effective rate) table in Lampiran PP 58/2023,
  which is what the Directorate General of Taxes publishes.
- **PPN** — the sales tax. The headline rate is 12%, but ordinary
  goods are taxed on 11/12 of the price, so the tax actually paid is
  11% of the price. Luxury goods pay the full 12%.
- **THR** — the religious holiday allowance every worker with a month
  of service gets, under Permenaker 6/2016.
- **BPJS** — the health and employment insurance contributions that
  come out of a salary, with the wage caps that apply to each one.

Every number here is taken from the rule itself rather than from
memory, and the source is named beside it. The rules change, so the
year they were read is recorded as well.

The calculations return plain dictionaries rather than the
`CalculationResult` of the older formulas, because these have several
parts that all need to be shown, not one number.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple

# The rupiah is not divided into anything smaller in practice, so
# every result is a whole rupiah.
RUPIAH = Decimal("1")


def _rupiah(value) -> Decimal:
    """Round to a whole rupiah."""
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(RUPIAH, rounding=ROUND_HALF_UP)


# === PPh 21: the effective rate tables ===

# The three tables from Lampiran PP 58/2023.
#
# Each row is (upper bound of gross monthly income, effective rate as
# a percentage). The lower bound of a row is one rupiah more than the
# upper bound of the row above it, so only the upper bounds are
# written down. The first row of each table starts at zero.
#
# The rate is not the tax on the whole salary. It is the average rate
# that applies to the whole salary, given how much the person is
# allowed to earn before paying tax at all. That is why a 10 million
# rupiah salary is taxed at 2%: the person keeps a large allowance
# first, and the effective rate is what is left over.
#
# Source: PP 58/2023, Lampiran, huruf A, B and C.

TER_A: List[Tuple[Decimal, Decimal]] = [
    (Decimal("5400000"), Decimal("0")),
    (Decimal("5650000"), Decimal("0.25")),
    (Decimal("5950000"), Decimal("0.50")),
    (Decimal("6300000"), Decimal("0.75")),
    (Decimal("6750000"), Decimal("1.00")),
    (Decimal("7500000"), Decimal("1.25")),
    (Decimal("8550000"), Decimal("1.50")),
    (Decimal("9650000"), Decimal("1.75")),
    (Decimal("10050000"), Decimal("2.00")),
    (Decimal("10350000"), Decimal("2.25")),
    (Decimal("10700000"), Decimal("2.50")),
    (Decimal("11050000"), Decimal("3.00")),
    (Decimal("11600000"), Decimal("3.50")),
    (Decimal("12500000"), Decimal("4.00")),
    (Decimal("13750000"), Decimal("5.00")),
    (Decimal("15100000"), Decimal("6.00")),
    (Decimal("16950000"), Decimal("7.00")),
    (Decimal("19750000"), Decimal("8.00")),
    (Decimal("24150000"), Decimal("9.00")),
    (Decimal("26450000"), Decimal("10.00")),
    (Decimal("28000000"), Decimal("11.00")),
    (Decimal("30050000"), Decimal("12.00")),
    (Decimal("32400000"), Decimal("13.00")),
    (Decimal("35400000"), Decimal("14.00")),
    (Decimal("39100000"), Decimal("15.00")),
    (Decimal("43850000"), Decimal("16.00")),
    (Decimal("47800000"), Decimal("17.00")),
    (Decimal("51400000"), Decimal("18.00")),
    (Decimal("56300000"), Decimal("19.00")),
    (Decimal("62200000"), Decimal("20.00")),
    (Decimal("68600000"), Decimal("21.00")),
    (Decimal("77500000"), Decimal("22.00")),
    (Decimal("89000000"), Decimal("23.00")),
    (Decimal("103000000"), Decimal("24.00")),
    (Decimal("125000000"), Decimal("25.00")),
    (Decimal("157000000"), Decimal("26.00")),
    (Decimal("206000000"), Decimal("27.00")),
    (Decimal("337000000"), Decimal("28.00")),
    (Decimal("454000000"), Decimal("29.00")),
    (Decimal("550000000"), Decimal("30.00")),
    (Decimal("695000000"), Decimal("31.00")),
    (Decimal("910000000"), Decimal("32.00")),
    (Decimal("1400000000"), Decimal("33.00")),
]

TER_B: List[Tuple[Decimal, Decimal]] = [
    (Decimal("6200000"), Decimal("0")),
    (Decimal("6500000"), Decimal("0.25")),
    (Decimal("6850000"), Decimal("0.50")),
    (Decimal("7300000"), Decimal("0.75")),
    (Decimal("9200000"), Decimal("1.00")),
    (Decimal("10750000"), Decimal("1.50")),
    (Decimal("11250000"), Decimal("2.00")),
    (Decimal("11600000"), Decimal("2.50")),
    (Decimal("12600000"), Decimal("3.00")),
    (Decimal("13600000"), Decimal("4.00")),
    (Decimal("14950000"), Decimal("5.00")),
    (Decimal("16400000"), Decimal("6.00")),
    (Decimal("18450000"), Decimal("7.00")),
    (Decimal("21850000"), Decimal("8.00")),
    (Decimal("26000000"), Decimal("9.00")),
    (Decimal("27700000"), Decimal("10.00")),
    (Decimal("29350000"), Decimal("11.00")),
    (Decimal("31450000"), Decimal("12.00")),
    (Decimal("33950000"), Decimal("13.00")),
    (Decimal("37100000"), Decimal("14.00")),
    (Decimal("41100000"), Decimal("15.00")),
    (Decimal("45800000"), Decimal("16.00")),
    (Decimal("49500000"), Decimal("17.00")),
    (Decimal("53800000"), Decimal("18.00")),
    (Decimal("58500000"), Decimal("19.00")),
    (Decimal("64000000"), Decimal("20.00")),
    (Decimal("71000000"), Decimal("21.00")),
    (Decimal("80000000"), Decimal("22.00")),
    (Decimal("93000000"), Decimal("23.00")),
    (Decimal("109000000"), Decimal("24.00")),
    (Decimal("129000000"), Decimal("25.00")),
    (Decimal("163000000"), Decimal("26.00")),
    (Decimal("211000000"), Decimal("27.00")),
    (Decimal("374000000"), Decimal("28.00")),
    (Decimal("459000000"), Decimal("29.00")),
    (Decimal("555000000"), Decimal("30.00")),
    (Decimal("704000000"), Decimal("31.00")),
    (Decimal("957000000"), Decimal("32.00")),
    (Decimal("1405000000"), Decimal("33.00")),
]

TER_C: List[Tuple[Decimal, Decimal]] = [
    (Decimal("6600000"), Decimal("0")),
    (Decimal("6950000"), Decimal("0.25")),
    (Decimal("7350000"), Decimal("0.50")),
    (Decimal("7800000"), Decimal("0.75")),
    (Decimal("8850000"), Decimal("1.00")),
    (Decimal("9800000"), Decimal("1.25")),
    (Decimal("10950000"), Decimal("1.50")),
    (Decimal("11200000"), Decimal("1.75")),
    (Decimal("12050000"), Decimal("2.00")),
    (Decimal("12950000"), Decimal("3.00")),
    (Decimal("14150000"), Decimal("4.00")),
    (Decimal("15550000"), Decimal("5.00")),
    (Decimal("17050000"), Decimal("6.00")),
    (Decimal("19500000"), Decimal("7.00")),
    (Decimal("22700000"), Decimal("8.00")),
    (Decimal("26600000"), Decimal("9.00")),
    (Decimal("28100000"), Decimal("10.00")),
    (Decimal("30100000"), Decimal("11.00")),
    (Decimal("32600000"), Decimal("12.00")),
    (Decimal("35400000"), Decimal("13.00")),
    (Decimal("38900000"), Decimal("14.00")),
    (Decimal("43000000"), Decimal("15.00")),
    (Decimal("47400000"), Decimal("16.00")),
    (Decimal("51200000"), Decimal("17.00")),
    (Decimal("55800000"), Decimal("18.00")),
    (Decimal("60400000"), Decimal("19.00")),
    (Decimal("66700000"), Decimal("20.00")),
    (Decimal("74500000"), Decimal("21.00")),
    (Decimal("83200000"), Decimal("22.00")),
    (Decimal("95600000"), Decimal("23.00")),
    (Decimal("110000000"), Decimal("24.00")),
    (Decimal("134000000"), Decimal("25.00")),
    (Decimal("169000000"), Decimal("26.00")),
    (Decimal("221000000"), Decimal("27.00")),
    (Decimal("390000000"), Decimal("28.00")),
    (Decimal("463000000"), Decimal("29.00")),
    (Decimal("561000000"), Decimal("30.00")),
    (Decimal("709000000"), Decimal("31.00")),
    (Decimal("965000000"), Decimal("32.00")),
    (Decimal("1419000000"), Decimal("33.00")),
]

# The tax-free allowance each category gets, for a whole year.
#
# The category is chosen by the marital status and the number of
# dependants, written the way the tax office writes it: K is married
# and TK is not, and the number is the number of dependants.
#
# Source: PP 58/2023, Pasal 2 ayat (4), and the DJP table of PTKP.
PTKP_ANNUAL: Dict[str, Decimal] = {
    "TK/0": Decimal("54000000"),
    "TK/1": Decimal("58500000"),
    "K/0": Decimal("58500000"),
    "TK/2": Decimal("63000000"),
    "TK/3": Decimal("67500000"),
    "K/1": Decimal("63000000"),
    "K/2": Decimal("67500000"),
    "K/3": Decimal("72000000"),
}

# Which table each status uses.
#
# Source: PP 58/2023, Pasal 2 ayat (4).
CATEGORY_OF_STATUS: Dict[str, str] = {
    "TK/0": "A",
    "TK/1": "A",
    "K/0": "A",
    "TK/2": "B",
    "TK/3": "B",
    "K/1": "B",
    "K/2": "B",
    "K/3": "C",
}

TER_TABLE_OF_CATEGORY: Dict[str, List[Tuple[Decimal, Decimal]]] = {
    "A": TER_A,
    "B": TER_B,
    "C": TER_C,
}

# The tax rate bands of Pasal 17 ayat (1) huruf a of the Income Tax
# Law, used for the last tax period of the year and for people who
# are not on a monthly salary.
#
# Source: UU 7/2021, Pasal 17 ayat (1) huruf a.
PASAL_17: List[Tuple[Optional[Decimal], Decimal]] = [
    (Decimal("60000000"), Decimal("5")),
    (Decimal("250000000"), Decimal("15")),
    (Decimal("500000000"), Decimal("25")),
    (Decimal("5000000000"), Decimal("30")),
    (None, Decimal("35")),
]

# The daily effective rate, for people paid by the day, the week or
# the piece. Up to 450 thousand a day nothing is withheld. Above that
# and up to 2.5 million, half a percent. Above that the ordinary
# income tax bands apply to half the income.
#
# Source: PP 58/2023, Lampiran, huruf D.
TER_HARIAN_BAWAH = Decimal("450000")
TER_HARIAN_ATAS = Decimal("2500000")
TER_HARIAN_RATE = Decimal("0.5")


def _pasal_17_tax(taxable_income: Decimal) -> Decimal:
    """
    The tax of Pasal 17 ayat (1) huruf a on an amount of income.

    Progressive: the first 60 million is taxed at 5%, the next 190
    million at 15%, and so on.
    """
    if taxable_income <= 0:
        return Decimal("0")
    total = Decimal("0")
    previous_cap = Decimal("0")
    for cap, rate in PASAL_17:
        if cap is None:
            total += (taxable_income - previous_cap) * rate / Decimal("100")
            break
        if taxable_income <= cap:
            total += (taxable_income - previous_cap) * rate / Decimal("100")
            break
        total += (cap - previous_cap) * rate / Decimal("100")
        previous_cap = cap
    return _rupiah(total)


# The rate above the top of the table. Each of the three tables ends
# with a band that reaches 33%, and above that the rate is 34%.
TER_TOP_RATE = Decimal("34")


def effective_rate(monthly_gross: Decimal, category: str) -> Decimal:
    """
    The effective rate for a monthly gross income, as a percentage.

    The rate comes from the table of the category. Above the top of
    the table the rate is 34%, which is the last row of every table
    in PP 58/2023.
    """
    table = TER_TABLE_OF_CATEGORY.get(category)
    if table is None:
        raise ValueError(f"unknown category: {category}")

    for cap, rate in table:
        if monthly_gross <= cap:
            return rate
    return TER_TOP_RATE


def _ter_band(monthly_gross: Decimal, category: str) -> Tuple[Decimal, Optional[Decimal]]:
    """
    The lower and upper bound of the band the income falls in.

    The upper bound is None above the top of the table, where the
    rate stays at the highest one.
    """
    table = TER_TABLE_OF_CATEGORY[category]
    lower = Decimal("0")
    for cap, rate in table:
        if monthly_gross <= cap:
            return lower, cap
        lower = cap + 1
    return lower, None


def calculate_pph21(
    monthly_gross: Decimal,
    status: str = "K/0",
    months_withheld: int = 11,
) -> Dict:
    """
    The income tax an employer withholds from a monthly salary.

    INPUT:
        - monthly_gross: the gross monthly income
        - status: the marital status and number of dependants, written
          the way the tax office writes it: K/0, TK/1, K/3 and so on
        - months_withheld: how many months have already been taxed in
          this year. Eleven is the usual case, because the twelfth
          month is worked out differently.

    OUTPUT: a dictionary with the rate, the tax, the category, and
    the numbers behind them.

    The rule this follows: for every month except the last one of the
    tax year, the tax is the gross income multiplied by the effective
    rate of the category. The last month is different, and is worked
    out by `calculate_pph21_annual`.

    Source: PP 58/2023, Pasal 2; PMK 168/2023.
    """
    monthly_gross = _rupiah(monthly_gross)
    status = (status or "K/0").strip()

    if status not in PTKP_ANNUAL:
        raise ValueError(
            f"unknown status: {status}; expected one of {', '.join(sorted(PTKP_ANNUAL))}"
        )

    category = CATEGORY_OF_STATUS[status]
    rate = effective_rate(monthly_gross, category)
    tax = _rupiah(monthly_gross * rate / Decimal("100"))
    lower, upper = _ter_band(monthly_gross, category)

    return {
        "status": status,
        "category": category,
        "monthly_gross": monthly_gross,
        "effective_rate": rate,
        "tax": tax,
        "net_income": _rupiah(monthly_gross - tax),
        "band_lower": lower,
        "band_upper": upper,
        "ptkp_annual": PTKP_ANNUAL[status],
        "months_withheld": months_withheld,
        "rule": "PP 58/2023",
    }


def calculate_pph21_daily(daily_gross: Decimal) -> Dict:
    """
    The tax withheld from a daily wage.

    Up to 450 thousand rupiah a day nothing is withheld. Above that
    and up to 2.5 million, half a percent of the daily income. Above
    2.5 million, the ordinary income tax bands are applied to half
    the daily income.

    Source: PP 58/2023, Lampiran, huruf D.
    """
    daily_gross = _rupiah(daily_gross)

    if daily_gross <= TER_HARIAN_BAWAH:
        rate = Decimal("0")
        tax = Decimal("0")
        basis = daily_gross
    elif daily_gross <= TER_HARIAN_ATAS:
        rate = TER_HARIAN_RATE
        basis = daily_gross
        tax = _rupiah(daily_gross * rate / Decimal("100"))
    else:
        rate = None
        basis = daily_gross / Decimal("2")
        tax = _pasal_17_tax(basis)

    return {
        "daily_gross": daily_gross,
        "rate": rate,
        "tax": tax,
        "net_income": _rupiah(daily_gross - tax),
        "rule": "PP 58/2023, Lampiran D",
    }


def calculate_pph21_annual(
    monthly_gross: Decimal,
    status: str = "K/0",
    employee_pension: Decimal = Decimal("0"),
    zakat: Decimal = Decimal("0"),
) -> Dict:
    """
    The tax for a whole year, and the tax for the last month.

    The last month of the tax year is not worked out with the
    effective rate. It is the tax for the whole year, according to the
    ordinary bands, minus what has already been withheld in the
    months before.

    The tax for the year is worked out like this:

        gross for the year
        - the position fee, 5% of the gross, up to 6 million a year
        - the employee's own pension contribution for the year
        - the obligatory religious contribution paid through the
          employer, for the year
        - the tax-free allowance for the category
        = the income that is taxed

    The pension contribution and the religious contribution are both
    given as amounts per month, because that is how they are paid.
    Each one is taken twelve times for the year.

    and that amount is taxed at the bands of Pasal 17 ayat (1) huruf a.

    Sources: PP 58/2023; PMK 168/2023, Pasal 10 and Pasal 13.
    """
    monthly_gross = _rupiah(monthly_gross)
    status = (status or "K/0").strip()

    if status not in PTKP_ANNUAL:
        raise ValueError(f"unknown status: {status}")

    category = CATEGORY_OF_STATUS[status]
    annual_gross = monthly_gross * Decimal("12")

    # The position fee: 5% of the gross, up to 6 million a year.
    position_fee = min(
        annual_gross * Decimal("5") / Decimal("100"),
        Decimal("6000000"),
    )

    # Both of these are paid monthly, so each one is taken twelve
    # times for the year.
    employee_pension_year = _rupiah(employee_pension) * Decimal("12")
    zakat_year = _rupiah(zakat) * Decimal("12")

    taxable_income = (
        annual_gross
        - position_fee
        - employee_pension_year
        - zakat_year
        - PTKP_ANNUAL[status]
    )
    if taxable_income < 0:
        taxable_income = Decimal("0")

    annual_tax = _pasal_17_tax(taxable_income)

    # What the first eleven months already took.
    monthly = calculate_pph21(monthly_gross, status)
    withheld = monthly["tax"] * Decimal("11")

    # The last month takes the rest. It is never below zero, because
    # the tax of a year is never less than what the other months took.
    december = annual_tax - withheld
    if december < 0:
        december = Decimal("0")

    return {
        "status": status,
        "category": category,
        "monthly_gross": monthly_gross,
        "annual_gross": annual_gross,
        "position_fee": _rupiah(position_fee),
        "employee_pension": employee_pension_year,
        "zakat": zakat_year,
        "ptkp_annual": PTKP_ANNUAL[status],
        "taxable_income": _rupiah(taxable_income),
        "annual_tax": annual_tax,
        "withheld_jan_nov": withheld,
        "december_tax": _rupiah(december),
        "rule": "PP 58/2023; PMK 168/2023",
    }


# === PPN: the sales tax ===

# The headline rate of the sales tax, and the part of the price it is
# charged on for ordinary goods.
#
# The rate is 12%, but for goods that are not luxury goods the tax is
# charged on 11/12 of the selling price, so the tax paid is 11% of
# the price. Luxury goods pay the full 12% on the whole price.
#
# Source: UU 7/2021, Pasal 7; PMK 131/2024.
PPN_RATE = Decimal("12")
PPN_OTHER_BASE = Decimal("11") / Decimal("12")


def calculate_ppn(
    price: Decimal,
    luxury: bool = False,
    rate_percent: Optional[Decimal] = None,
) -> Dict:
    """
    The sales tax on a price.

    INPUT:
        - price: the selling price, tax not included
        - luxury: whether the goods are luxury goods, which pay the
          full rate on the whole price
        - rate_percent: an override for the rate, for goods that have
          a rate of their own

    OUTPUT: a dictionary with the base, the rate and the tax.
    """
    price = _rupiah(price)

    if rate_percent is not None:
        rate = Decimal(str(rate_percent))
        base = price
    elif luxury:
        rate = PPN_RATE
        base = price
    else:
        rate = PPN_RATE
        base = price * PPN_OTHER_BASE

    tax = _rupiah(base * rate / Decimal("100"))

    return {
        "price": price,
        "base": _rupiah(base),
        "rate": rate,
        "tax": tax,
        "total_with_tax": _rupiah(price + tax),
        "effective_percent": (
            (tax / price * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if price > 0 else Decimal("0")
        ),
        "luxury": luxury,
        "rule": "UU 7/2021 Pasal 7; PMK 131/2024",
    }


# === THR: the religious holiday allowance ===

# A worker with a month of continuous service gets the allowance. A
# worker with a year or more gets a full month of wages. A worker
# with less than a year gets a share of it, in proportion to the time
# served.
#
# Source: Permenaker 6/2016; PP 36/2021.
THR_MINIMUM_SERVICE_MONTHS = 1
THR_FULL_SERVICE_MONTHS = 12


def calculate_thr(
    monthly_salary: Decimal,
    service_months: int,
    fixed_allowance: Decimal = Decimal("0"),
) -> Dict:
    """
    The religious holiday allowance.

    INPUT:
        - monthly_salary: the basic monthly wage
        - service_months: how many months the worker has been with the
          employer, counted without a break
        - fixed_allowance: the fixed allowances, which are part of the
          wage for this purpose

    OUTPUT: a dictionary with the allowance and what it was worked
    out from.

    A worker with a year or more gets one month of wages. A worker
    with less than a year gets the months served divided by twelve, of
    one month of wages. A worker with less than a month of service
    gets nothing.
    """
    monthly_salary = _rupiah(monthly_salary)
    fixed_allowance = _rupiah(fixed_allowance)
    one_month_wage = monthly_salary + fixed_allowance

    if service_months < THR_MINIMUM_SERVICE_MONTHS:
        return {
            "eligible": False,
            "service_months": service_months,
            "one_month_wage": one_month_wage,
            "thr": Decimal("0"),
            "method": "not eligible",
            "rule": "Permenaker 6/2016",
        }

    if service_months >= THR_FULL_SERVICE_MONTHS:
        thr = one_month_wage
        method = "one month of wages"
    else:
        thr = _rupiah(
            one_month_wage * Decimal(service_months) / Decimal(THR_FULL_SERVICE_MONTHS)
        )
        method = f"{service_months}/12 of one month of wages"

    return {
        "eligible": True,
        "service_months": service_months,
        "one_month_wage": one_month_wage,
        "thr": thr,
        "method": method,
        "rule": "Permenaker 6/2016",
    }


# === BPJS: the insurance contributions ===

# The contributions that come out of a salary, and those that the
# employer adds.
#
# - BPJS Kesehatan, the health insurance: 1% from the worker, 4% from
#   the employer, on a wage capped at 12 million.
# - JHT, the old-age savings: 2% from the worker, 3.7% from the
#   employer, with no cap.
# - JP, the pension: 1% from the worker, 2% from the employer, on a
#   wage capped at 11,086,300 from March 2026.
# - JKK, the accident cover, and JKM, the death benefit: paid by the
#   employer alone, at a rate that depends on the kind of work.
#
# Source: Perpres 64/2020; PP 46/2015; PP 45/2015; SE B/1226/022026
# (the pension wage cap, from March 2026); BPJS Ketenagakerjaan.

BPJS_KESEHATAN_CAP = Decimal("12000000")
BPJS_PENSIUN_CAP = Decimal("11086300")
BPJS_KESEHATAN_WORKER = Decimal("1")
BPJS_KESEHATAN_EMPLOYER = Decimal("4")
BPJS_JHT_WORKER = Decimal("2")
BPJS_JHT_EMPLOYER = Decimal("3.7")
BPJS_PENSIUN_WORKER = Decimal("1")
BPJS_PENSIUN_EMPLOYER = Decimal("2")
BPJS_JKM_EMPLOYER = Decimal("0.3")

# The accident cover, by the risk of the work. The lowest risk is
# office work and the highest is heavy industry.
BPJS_JKK_RATES: Dict[str, Decimal] = {
    "low": Decimal("0.24"),
    "medium": Decimal("0.74"),
    "high": Decimal("1.74"),
}


def calculate_bpjs(
    monthly_wage: Decimal,
    risk: str = "low",
    extra_family_members: int = 0,
) -> Dict:
    """
    The insurance contributions on a monthly wage.

    INPUT:
        - monthly_wage: the wage the contributions are worked out on
        - risk: the risk of the work, which sets the accident cover
        - extra_family_members: how many people beyond the worker,
          the spouse and three children are covered by the health
          insurance. Each one adds 1% of the wage.

    OUTPUT: a dictionary with what the worker pays, what the employer
    adds, and the lines behind both.
    """
    monthly_wage = _rupiah(monthly_wage)
    risk = (risk or "low").strip()

    if risk not in BPJS_JKK_RATES:
        raise ValueError(
            f"unknown risk: {risk}; expected one of {', '.join(sorted(BPJS_JKK_RATES))}"
        )

    if extra_family_members < 0:
        extra_family_members = 0

    health_base = min(monthly_wage, BPJS_KESEHATAN_CAP)
    pension_base = min(monthly_wage, BPJS_PENSIUN_CAP)

    # JHT has no cap: it is charged on the whole wage.
    jht_base = monthly_wage

    health_worker = health_base * BPJS_KESEHATAN_WORKER / Decimal("100")
    health_employer = health_base * BPJS_KESEHATAN_EMPLOYER / Decimal("100")
    health_family = (
        health_base * Decimal(extra_family_members) / Decimal("100")
    )

    jht_worker = jht_base * BPJS_JHT_WORKER / Decimal("100")
    jht_employer = jht_base * BPJS_JHT_EMPLOYER / Decimal("100")

    pension_worker = pension_base * BPJS_PENSIUN_WORKER / Decimal("100")
    pension_employer = pension_base * BPJS_PENSIUN_EMPLOYER / Decimal("100")

    jkk_employer = monthly_wage * BPJS_JKK_RATES[risk] / Decimal("100")
    jkm_employer = monthly_wage * BPJS_JKM_EMPLOYER / Decimal("100")

    worker_total = health_worker + health_family + jht_worker + pension_worker
    employer_total = health_employer + jht_employer + pension_employer + jkk_employer + jkm_employer

    return {
        "monthly_wage": monthly_wage,
        "risk": risk,
        "health_base": health_base,
        "pension_base": pension_base,
        "worker": {
            "health": _rupiah(health_worker),
            "health_family": _rupiah(health_family),
            "old_age": _rupiah(jht_worker),
            "pension": _rupiah(pension_worker),
            "total": _rupiah(worker_total),
        },
        "employer": {
            "health": _rupiah(health_employer),
            "old_age": _rupiah(jht_employer),
            "pension": _rupiah(pension_employer),
            "accident": _rupiah(jkk_employer),
            "death": _rupiah(jkm_employer),
            "total": _rupiah(employer_total),
        },
        "take_home": _rupiah(monthly_wage - worker_total),
        "rule": "Perpres 64/2020; PP 46/2015; PP 45/2015; SE B/1226/022026",
    }
