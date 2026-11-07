"""
The audit must not tell the reader something untrue.

The page was saying "your spending has eaten almost all of your
income" and "add Rp 0 a month to your savings" to a reader who had
recorded no income at all — but who did have Rp 5,765,000 in the
bank. Both sentences are wrong: there is no income to exhaust, and
there is no way to add nothing to savings.

With no income recorded, the honest thing is to ask the reader to
record where their income comes from, and to suggest a savings
target worked out from the money they actually have.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.modules.ai_advisor.health_coach.audit_generator import AuditGenerator  # noqa: E402


def _audit_with(income, expense, cash=5_765_000, debt=0):
    financial_data = {
        "monthly_income": income,
        "monthly_expense": expense,
        "total_cash": cash,
        "total_debt": debt,
        "monthly_debt_payment": 0,
    }
    user_data = {"city": "Jakarta", "monthly_income": income}
    return AuditGenerator().generate_audit(user_data, financial_data)


def test_no_income_recorded_does_not_claim_spending_exhausted_income():
    report = _audit_with(income=0, expense=25_000)

    spoken = " ".join(
        [f.description for f in report.findings]
        + [f.suggestion for f in report.findings]
        + list(report.immediate_actions)
        + list(report.monthly_plan.values())
    )

    assert "hampir menghabiskan seluruh penghasilan" not in spoken, (
        "the audit says the spending exhausted the income, but no "
        "income was ever recorded"
    )


def test_no_income_recorded_does_not_ask_to_add_zero_to_savings():
    report = _audit_with(income=0, expense=25_000)

    plan = " ".join(report.monthly_plan.values())
    assert "Rp 0/bulan" not in plan, (
        "the plan asks the reader to add Rp 0 a month to their savings"
    )


def test_no_income_recorded_asks_for_the_income_to_be_recorded():
    report = _audit_with(income=0, expense=25_000)

    spoken = " ".join(
        [f.description for f in report.findings]
        + [f.suggestion for f in report.findings]
        + list(report.immediate_actions)
        + list(report.monthly_plan.values())
    )

    assert "catat" in spoken.lower() or "catat" in spoken.lower(), (
        "the audit should ask the reader to record where their income "
        f"comes from, but said only: {spoken!r}"
    )


def test_a_real_savings_target_is_worked_out_from_what_they_have():
    # With no income, but Rp 5,765,000 in the bank, a target of 20%
    # of the balance is a number the reader can act on.
    report = _audit_with(income=0, expense=25_000, cash=5_765_000)

    plan = " ".join(report.monthly_plan.values())
    assert "1.153.000" in plan, (
        f"the savings target should be 20% of the cash on hand "
        f"(Rp 1,153,000), but the plan said: {plan!r}"
    )


def test_a_reader_with_real_income_still_gets_the_old_advice():
    # Nothing about the normal case may change. Here the reader earns
    # Rp 10,000,000 a month and spends Rp 9,000,000 of it, so the
    # savings rate is 10% and the advice is to put 20% away.
    report = _audit_with(income=10_000_000, expense=9_000_000, cash=5_765_000)

    plan = " ".join(report.monthly_plan.values())
    assert "Rp 2.000.000" in plan, (
        f"20% of Rp 10,000,000 income should still be suggested, "
        f"but the plan said: {plan!r}"
    )

def test_the_emergency_fund_advice_is_never_about_zero():
    """
    "Tambahkan Rp 0 ke dana darurat" is not advice.

    A reader who has not recorded what they spend has no three months
    of spending to work from, so the figure came out as zero and was
    shown as if it were a plan.
    """
    from app.modules.ai_advisor.health_coach.audit_generator import (
        AuditGenerator,
    )

    generator = AuditGenerator()

    class _Health:
        class emergency_fund_months:
            value = 0.0
            status = "danger"

        class savings_ratio:
            value = 0.0
            status = "danger"

        class dsr_ratio:
            value = 0.0
            status = "good"

        overall_score = 40

    findings = generator._analyze_findings(
        _Health(),
        {},
        {"monthly_income": 0, "monthly_expense": 0, "total_cash": 0},
    )

    emergency = [f for f in findings if f.category == "emergency_fund"]
    assert emergency, "the reader was not told about the emergency fund at all"

    for finding in emergency:
        assert "Rp 0" not in finding.suggestion, (
            "the advice was about zero rupiah: %r" % finding.suggestion
        )


def test_the_emergency_fund_target_is_never_zero():
    """The plan says what to aim for, and zero is not a target."""
    from app.modules.ai_advisor.health_coach.audit_generator import (
        AuditGenerator,
    )

    generator = AuditGenerator()

    class _Health:
        class emergency_fund_months:
            value = 0.0
            status = "danger"

        class savings_ratio:
            value = 0.0
            status = "danger"

        class dsr_ratio:
            value = 0.0
            status = "good"

        overall_score = 40

    _immediate, plan = generator._generate_recommendations(
        [],
        _Health(),
        {},
        {"monthly_income": 0, "monthly_expense": 0, "total_cash": 0},
    )

    target = plan.get("dana_darurat", "")
    assert target, "there was no emergency fund line in the plan"
    assert "Rp 0" not in target, "the target was zero rupiah: %r" % target


def test_a_reader_with_cash_is_told_a_real_figure():
    """
    There is money in the bank. A fifth of it, or a twentieth, is a
    figure the reader can act on.
    """
    from app.modules.ai_advisor.health_coach.audit_generator import (
        AuditGenerator,
    )

    generator = AuditGenerator()

    class _Health:
        class emergency_fund_months:
            value = 0.0
            status = "danger"

        class savings_ratio:
            value = 0.0
            status = "danger"

        class dsr_ratio:
            value = 0.0
            status = "good"

        overall_score = 40

    findings = generator._analyze_findings(
        _Health(),
        {},
        {"monthly_income": 0, "monthly_expense": 0, "total_cash": 5_975_000},
    )

    emergency = [f for f in findings if f.category == "emergency_fund"]
    assert emergency
    assert "Rp 0" not in emergency[0].suggestion
    assert "5.975.000" in emergency[0].suggestion or "298.750" in emergency[0].suggestion, (
        "the advice did not mention the money in hand: %r" % emergency[0].suggestion
    )
