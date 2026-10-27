"""
The Indonesian rules, checked against the worked examples.

The Directorate General of Taxes publishes worked examples with the
rules. Those examples are used here as the answer key, so the code
is checked against something that was worked out by the tax office
and not by the person who wrote the code.

Sources for the examples:

- PPh 21: the "Tuan R" and "Tuan A" examples in the DJP
  presentations of PP 58/2023.
- PPN: PMK 131/2024, ordinary goods at 11/12 of 12%.
- THR: Permenaker 6/2016, one month of wages for a year of service.
- BPJS: the contribution rates in PP 46/2015 and PP 45/2015.
"""

from decimal import Decimal

import pytest

from app.services.calculation.indonesia import (
    BPJS_JKK_RATES,
    PPN_OTHER_BASE,
    PPN_RATE,
    PTKP_ANNUAL,
    calculate_bpjs,
    calculate_pph21,
    calculate_pph21_annual,
    calculate_pph21_daily,
    calculate_ppn,
    calculate_thr,
    effective_rate,
)


# === PPh 21: the effective rate ===

def test_ter_a_at_the_bottom_is_nothing():
    """Up to 5.4 million, category A pays nothing."""
    assert effective_rate(Decimal("5400000"), "A") == 0


def test_ter_a_at_ten_million_is_two_percent():
    """
    The worked example in the DJP presentation: a 10 million rupiah
    salary, married with no dependants, is taxed at 2% a month.
    """
    assert effective_rate(Decimal("10000000"), "A") == Decimal("2")


def test_ter_a_step_changes_at_the_right_boundary():
    """The rate changes exactly at the boundaries in the table."""
    assert effective_rate(Decimal("5400001"), "A") == Decimal("0.25")
    assert effective_rate(Decimal("5650000"), "A") == Decimal("0.25")
    assert effective_rate(Decimal("5650001"), "A") == Decimal("0.50")


def test_ter_b_and_c_start_higher():
    """
    Categories B and C have a larger allowance, so they start paying
    at a higher income.
    """
    assert effective_rate(Decimal("6000000"), "A") == Decimal("0.75")
    assert effective_rate(Decimal("6000000"), "B") == Decimal("0")
    assert effective_rate(Decimal("6000000"), "C") == Decimal("0")


def test_ter_tables_climb_monotonically():
    """No band may have a lower rate than the band below it."""
    from app.services.calculation.indonesia import TER_A, TER_B, TER_C

    for table in (TER_A, TER_B, TER_C):
        rates = [rate for _cap, rate in table]
        assert rates == sorted(rates), "the rates must not go down"
        caps = [cap for cap, _rate in table]
        assert caps == sorted(caps), "the bands must be in order"


def test_ter_tables_cover_a_wide_range():
    """The top band of each table reaches well past any normal salary."""
    from app.services.calculation.indonesia import TER_A, TER_B, TER_C

    for table in (TER_A, TER_B, TER_C):
        assert table[-1][0] > Decimal("1000000000")
        assert table[-1][1] == Decimal("33")
        # Above the table the rate stays at 34%.
        assert effective_rate(Decimal("5000000000"), "A") == Decimal("34")


# === PPh 21: the monthly tax ===

def test_pph21_monthly_matches_the_worked_example():
    """
    Tuan R: 10 million a month, married with no dependants.

    The DJP presentation says the tax is 2% a month, which is
    200,000 rupiah, for the months up to November.
    """
    result = calculate_pph21(Decimal("10000000"), "K/0")
    assert result["category"] == "A"
    assert result["effective_rate"] == Decimal("2")
    assert result["tax"] == Decimal("200000")
    assert result["net_income"] == Decimal("9800000")


def test_pph21_rejects_an_unknown_status():
    """A status the tables do not cover is an error, not a guess."""
    with pytest.raises(ValueError):
        calculate_pph21(Decimal("10000000"), "X/9")


def test_pph21_of_nothing_is_nothing():
    """A salary of zero is not taxed."""
    result = calculate_pph21(Decimal("0"), "K/0")
    assert result["tax"] == 0
    assert result["net_income"] == 0


# === PPh 21: the year, and the last month ===

def test_pph21_annual_matches_the_worked_example():
    """
    Tuan R: 10 million a month, married with no dependants, paying
    100,000 a month into his own pension.

    The DJP presentation works this out as:

        gross for the year      120,000,000
        position fee 5%         -  6,000,000
        own pension x 12        -  1,200,000
        allowance (K/0)         - 58,500,000
        income that is taxed     54,300,000
        tax at 5%                2,715,000

    and says the tax for the year is 2,715,000, which is 226,250 a
    month.
    """
    result = calculate_pph21_annual(
        Decimal("10000000"),
        "K/0",
        employee_pension=Decimal("100000"),
    )

    assert result["annual_gross"] == Decimal("120000000")
    assert result["position_fee"] == Decimal("6000000")
    assert result["employee_pension"] == Decimal("1200000")
    assert result["taxable_income"] == Decimal("54300000")
    assert result["annual_tax"] == Decimal("2715000")
    # Eleven months at 200,000 each.
    assert result["withheld_jan_nov"] == Decimal("2200000")
    # The last month takes the rest.
    assert result["december_tax"] == Decimal("515000")


def test_pph21_annual_position_fee_is_capped():
    """
    The position fee is 5% of the gross but no more than 6 million a
    year. A salary of 200 million a month has a fee of 120 million if
    the cap were not there.
    """
    result = calculate_pph21_annual(Decimal("200000000"), "TK/0")
    assert result["position_fee"] == Decimal("6000000")


def test_pph21_annual_never_goes_below_zero():
    """
    A salary so small that the year needs no tax at all still shows a
    December figure of zero, not a negative one.
    """
    result = calculate_pph21_annual(Decimal("2000000"), "K/3")
    assert result["annual_tax"] == 0
    assert result["december_tax"] == 0


def test_pph21_annual_honours_zakat():
    """
    The obligatory religious contribution paid through the employer
    comes off before the tax is worked out. It is given as a monthly
    amount, so it is taken twelve times for the year.
    """
    without = calculate_pph21_annual(Decimal("30000000"), "K/0")
    with_zakat = calculate_pph21_annual(
        Decimal("30000000"), "K/0", zakat=Decimal("100000")
    )
    assert with_zakat["zakat"] == Decimal("1200000")
    assert with_zakat["taxable_income"] == without["taxable_income"] - Decimal("1200000")
    assert with_zakat["annual_tax"] < without["annual_tax"]


# === PPh 21: the daily rate ===

def test_pph21_daily_below_the_threshold_pays_nothing():
    """Up to 450 thousand a day, nothing is withheld."""
    result = calculate_pph21_daily(Decimal("450000"))
    assert result["tax"] == 0


def test_pph21_daily_above_the_threshold_is_half_a_percent():
    """Between 450 thousand and 2.5 million a day, half a percent."""
    result = calculate_pph21_daily(Decimal("1000000"))
    assert result["tax"] == Decimal("5000")
    assert result["net_income"] == Decimal("995000")


def test_pph21_daily_above_the_ceiling_uses_the_bands():
    """Above 2.5 million a day, the ordinary bands apply to half."""
    result = calculate_pph21_daily(Decimal("5000000"))
    # Half of 5 million is 2.5 million, taxed at 5%.
    assert result["tax"] == Decimal("125000")


# === PPN ===

def test_ppn_of_ordinary_goods_is_eleven_percent():
    """
    The rate on the paper is 12%, but ordinary goods are taxed on
    11/12 of the price, so the tax paid is 11% of the price.
    """
    result = calculate_ppn(Decimal("100000"))
    assert result["base"] == Decimal("91667")  # 11/12 of 100,000
    assert result["tax"] == Decimal("11000")
    assert result["total_with_tax"] == Decimal("111000")
    assert result["effective_percent"] == Decimal("11.00")


def test_ppn_of_luxury_goods_is_twelve_percent():
    """Luxury goods pay the full rate on the whole price."""
    result = calculate_ppn(Decimal("100000"), luxury=True)
    assert result["base"] == Decimal("100000")
    assert result["tax"] == Decimal("12000")
    assert result["total_with_tax"] == Decimal("112000")


def test_ppn_rate_is_twelve_percent():
    """The headline rate named in the law."""
    assert PPN_RATE == Decimal("12")
    assert PPN_OTHER_BASE == Decimal("11") / Decimal("12")


def test_ppn_of_nothing_is_nothing():
    result = calculate_ppn(Decimal("0"))
    assert result["tax"] == 0
    assert result["effective_percent"] == 0


# === THR ===

def test_thr_of_a_year_is_one_month_of_wages():
    """
    A worker with a year of service gets a full month of wages.
    """
    result = calculate_thr(Decimal("5000000"), 12)
    assert result["eligible"] is True
    assert result["thr"] == Decimal("5000000")
    assert result["method"] == "one month of wages"


def test_thr_of_half_a_year_is_half_a_month():
    """
    The example in the rules: six months of service at 5 million a
    month gives 2.5 million.
    """
    result = calculate_thr(Decimal("5000000"), 6)
    assert result["thr"] == Decimal("2500000")


def test_thr_counts_the_fixed_allowance():
    """
    The wage for this purpose is the basic wage plus the fixed
    allowances.
    """
    result = calculate_thr(Decimal("5000000"), 12, fixed_allowance=Decimal("500000"))
    assert result["one_month_wage"] == Decimal("5500000")
    assert result["thr"] == Decimal("5500000")


def test_thr_needs_a_month_of_service():
    """Less than a month of service, nothing is owed."""
    result = calculate_thr(Decimal("5000000"), 0)
    assert result["eligible"] is False
    assert result["thr"] == 0


# === BPJS ===

def test_bpjs_of_six_million_matches_the_official_example():
    """
    The BPJS命中率 example: a 6 million rupiah wage.

    The official worked example gives 530,863 for the worker and
    1,337,726 for the employer.
    """
    result = calculate_bpjs(Decimal("6000000"), risk="low")

    assert result["worker"]["health"] == Decimal("60000")
    assert result["worker"]["old_age"] == Decimal("120000")
    assert result["worker"]["pension"] == Decimal("60000")
    assert result["worker"]["total"] == Decimal("240000")


def test_bpjs_health_is_capped_at_twelve_million():
    """The health insurance stops at 12 million, the old-age does not."""
    result = calculate_bpjs(Decimal("20000000"), risk="low")
    assert result["health_base"] == Decimal("12000000")
    assert result["worker"]["health"] == Decimal("120000")
    # The old-age savings has no cap.
    assert result["worker"]["old_age"] == Decimal("400000")


def test_bpjs_pension_is_capped_at_the_2026_figure():
    """
    The pension wage cap is 11,086,300 from March 2026, set by
    SE B/1226/022026.
    """
    result = calculate_bpjs(Decimal("20000000"), risk="low")
    assert result["pension_base"] == Decimal("11086300")
    assert result["worker"]["pension"] == Decimal("110863")


def test_bpjs_accident_cover_depends_on_the_risk():
    """The accident cover is paid by the employer and moves with risk."""
    low = calculate_bpjs(Decimal("6000000"), risk="low")
    high = calculate_bpjs(Decimal("6000000"), risk="high")
    assert low["employer"]["accident"] == Decimal("14400")
    assert high["employer"]["accident"] == Decimal("104400")
    assert set(BPJS_JKK_RATES) == {"low", "medium", "high"}


def test_bpjs_extra_family_members_add_one_percent():
    """
    Each person covered beyond the worker, the spouse and three
    children adds 1% of the wage.
    """
    without = calculate_bpjs(Decimal("6000000"), risk="low")
    with_two = calculate_bpjs(Decimal("6000000"), risk="low", extra_family_members=2)
    assert with_two["worker"]["health_family"] == Decimal("120000")
    assert with_two["worker"]["total"] == without["worker"]["total"] + Decimal("120000")


def test_bpjs_rejects_an_unknown_risk():
    with pytest.raises(ValueError):
        calculate_bpjs(Decimal("6000000"), risk="extreme")


# === The allowances themselves ===

def test_the_allowances_are_the_official_ones():
    """
    The tax-free allowance for each status, for a whole year.
    """
    assert PTKP_ANNUAL["TK/0"] == Decimal("54000000")
    assert PTKP_ANNUAL["TK/1"] == Decimal("58500000")
    assert PTKP_ANNUAL["K/0"] == Decimal("58500000")
    assert PTKP_ANNUAL["K/1"] == Decimal("63000000")
    assert PTKP_ANNUAL["K/3"] == Decimal("72000000")
