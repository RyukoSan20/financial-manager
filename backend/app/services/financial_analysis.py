"""
The analysis that does not need a language model.

The agent can ask a language model for advice, and the language model
is on someone else's computer, behind a key that runs out, at a rate
that is limited. When it fails, the reader still asked a question
that their own ledger can answer.

So there is a second way to answer, built only from the reader's own
numbers, and it never fails:

    * where the money went, and how much of it,
    * what came in,
    * what is left over,
    * what is owed,
    * how far the savings goal is.

Everything here is computed from the database through
``app.services.metrics``, which already knows how to be careful about
the things that usually go wrong: a division by zero when there is no
income, a currency that cannot be converted, a figure that is None
where a number is expected.

The point of this module is that it is *deterministic*. The same
ledger always gives the same answer, and there is no key to run out
and no rate to hit. It is what the reader is shown when the language
model is not available, and it is the floor that every analysis
rests on.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.services import metrics

logger = logging.getLogger(__name__)


def _rupiah(value: float) -> str:
    """A number, the way Indonesia writes one."""
    return f"Rp{float(value or 0):,.0f}".replace(",", ".")


def _safe_divide(numerator: float, denominator: float) -> Optional[float]:
    """
    A division that does not divide by nothing.

    A reader with no income this month has no savings rate. Saying
    "0%" would be a claim - it would say they saved nothing - and it
    is not true: there was nothing to save. So the answer is "there is
    no rate to speak of", and the caller says so.
    """
    try:
        if not denominator:
            return None
        return float(numerator) / float(denominator)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


async def spending_breakdown(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Where the money went, biggest first.

    The reader asked "di mana uang saya paling banyak keluar" - where
    does my money go the most - and this is the answer, taken from
    the ledger rather than guessed at.
    """
    try:
        from sqlalchemy import func

        from app.models.transaction import Transaction
        from app.services.transaction_filter import personal_expense_filter

        rows = (
            db.query(
                Transaction.category_id,
                func.coalesce(func.sum(Transaction.amount), 0).label("total"),
                func.count(Transaction.id).label("count"),
            )
            .filter(
                Transaction.type == "expense",
                Transaction.user_id == user_id,
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                *personal_expense_filter(),
            )
            .group_by(Transaction.category_id)
            .order_by(func.coalesce(func.sum(Transaction.amount), 0).desc())
            .limit(max(1, int(limit or 5)))
            .all()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Deterministic spending breakdown failed: {exc}")
        return []

    names: Dict[int, str] = {}
    try:
        from app.models.category import Category

        ids = [r.category_id for r in rows if r.category_id]  # noqa: E501
        if ids:
            for c in db.query(Category).filter(Category.id.in_(ids)).all():
                names[c.id] = c.name
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Deterministic category names failed: {exc}")

    breakdown: List[Dict[str, Any]] = []
    for row in rows:
        total = float(row.total or 0)
        if total <= 0:
            continue
        breakdown.append(
            {
                "category_id": row.category_id,
                "category": names.get(row.category_id) or "Lainnya",
                "amount": total,
                "count": int(row.count or 0),
            }
        )
    return breakdown


async def deterministic_analysis(
    db: Session,
    user_id: int,
    display_currency: str = "IDR",
) -> Dict[str, Any]:
    """
    The reader's month, in numbers.

    This never raises. If a part of it cannot be computed, that part is
    reported as absent rather than as zero, so the caller can say "I
    could not read this" instead of saying something false.
    """
    start, end = metrics.month_range()
    result: Dict[str, Any] = {
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "currency": display_currency,
        "income": 0.0,
        "expense": 0.0,
        "free_cash": 0.0,
        "savings_rate": None,
        "savings_rate_measurable": False,
        "balance": 0.0,
        "debt": 0.0,
        "top_categories": [],
        "emergency_months": None,
        "health_score": None,
        "healthy": False,
    }

    # --- the month's totals -------------------------------------------------
    try:
        income, expense = metrics.period_totals(db, user_id, start, end)
        result["income"] = float(income or 0)
        result["expense"] = float(expense or 0)
        result["free_cash"] = float(income or 0) - float(expense or 0)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Deterministic period totals failed: {exc}")

    # --- the savings rate ---------------------------------------------------
    try:
        rate = metrics.savings_rate(db, user_id, start, end)
        result["savings_rate_measurable"] = rate.measurable
        # A rate that could not be measured is reported as absent,
        # not as zero. Zero would be a claim - it would say the
        # reader saved nothing, when what is true is that there was
        # nothing to save. Anything that reads this number has to
        # be able to tell the two apart.
        result["savings_rate"] = rate.rate if rate.measurable else None
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Deterministic savings rate failed: {exc}")

    # --- the balance --------------------------------------------------------
    try:
        balance = await metrics.total_balance(db, user_id, display_currency)
        result["balance"] = float(balance.get("total") or 0)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Deterministic balance failed: {exc}")

    # --- what is owed -------------------------------------------------------
    try:
        result["debt"] = float(metrics.total_debt(db, user_id) or 0)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Deterministic debt failed: {exc}")

    # --- where the money went ----------------------------------------------
    try:
        result["top_categories"] = await spending_breakdown(
            db, user_id, start, end
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Deterministic breakdown failed: {exc}")

    # --- the emergency fund -------------------------------------------------
    try:
        result["emergency_months"] = metrics.emergency_months(
            result["balance"], result["expense"]
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Deterministic emergency months failed: {exc}")

    # --- the health score ---------------------------------------------------
    try:
        score = metrics.health_score(
            db, user_id, start, end, result["balance"]
        )
        result["health_score"] = score.overall_score
        result["healthy"] = bool(score.overall_score >= 70)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Deterministic health score failed: {exc}")

    return result


def render_analysis(analysis: Dict[str, Any]) -> str:
    """
    The numbers, as words.

    The reader asked a question, so the answer is a paragraph and not
    a table of figures. Every figure is one the ledger actually
    holds.
    """
    currency = analysis.get("currency") or "IDR"
    income = float(analysis.get("income") or 0)
    expense = float(analysis.get("expense") or 0)
    free = float(analysis.get("free_cash") or 0)
    balance = float(analysis.get("balance") or 0)
    debt = float(analysis.get("debt") or 0)
    categories = analysis.get("top_categories") or []

    parts: List[str] = []

    if income > 0 or expense > 0:
        parts.append(
            f"Bulan ini masuk {_rupiah(income)}, keluar {_rupiah(expense)}. "
            f"Sisa bebasnya {_rupiah(free)}."
        )
    else:
        parts.append(
            "Belum ada transaksi bulan ini, jadi belum ada yang bisa dianalisis."
        )

    if categories:
        biggest = categories[0]
        share = _safe_divide(biggest.get("amount", 0), expense)
        share_text = (
            f" ({share * 100:.0f}% dari pengeluaran)"
            if share is not None
            else ""
        )
        parts.append(
            f"Uang paling banyak keluar ke {biggest.get('category')}: "
            f"{_rupiah(biggest.get('amount'))}{share_text}."
        )
        others = ", ".join(
            f"{c.get('category')} {_rupiah(c.get('amount'))}" for c in categories[1:4]
        )
        if others:
            parts.append(f"Selanjutnya: {others}.")

    if analysis.get("savings_rate_measurable"):
        rate = float(analysis.get("savings_rate") or 0) * 100
        parts.append(f"Tabungan Anda {rate:.0f}% dari pemasukan.")

    if balance > 0:
        parts.append(f"Saldo di semua akun {_rupiah(balance)}.")
    if debt > 0:
        parts.append(f"Yang masih hutang {_rupiah(debt)}.")

    score = analysis.get("health_score")
    if score is not None:
        parts.append(f"Skor kesehatan keuangan Anda {int(score)} dari 100.")

    parts.append(
        "Satu hal yang paling sebaiknya diperbaiki: "
        + _one_improvement(analysis)
    )

    return " ".join(parts)


def _one_improvement(analysis: Dict[str, Any]) -> str:
    """
    The single thing worth changing.

    Not a list of everything. One thing, chosen by what the numbers
    say is the largest problem, so the reader knows where to start.
    """
    income = float(analysis.get("income") or 0)
    expense = float(analysis.get("expense") or 0)
    balance = float(analysis.get("balance") or 0)
    debt = float(analysis.get("debt") or 0)
    categories = analysis.get("top_categories") or []

    if income <= 0:
        return (
            "catat pemasukan Anda dulu, agar sisa bebasnya bisa dihitung "
            "dengan benar."
        )

    rate = analysis.get("savings_rate")
    if analysis.get("savings_rate_measurable") and rate is not None:
        if rate < 0:
            return (
                "pengeluaran Anda bulan ini lebih besar dari pemasukan. "
                "Kurangi kategori terbesar lebih dulu."
            )
        if rate < 0.1:
            return (
                "sisihkan setidaknya 10% dari pemasukan sebelum spends it "
                "di kategori lain, supaya ada uang yang tersisa."
            )

    months = analysis.get("emergency_months")
    if months is not None and months < 3:
        return (
            "dana darurat Anda belum cukup untuk 3 bulan pengeluaran. "
            "Sisihkan lebih dulu sebelum hal lain."
        )

    if debt > 0 and income > 0:
        share = _safe_divide(debt, income)
        if share is not None and share > 1:
            return (
                "utang Anda lebih besar dari pemasukan satu bulan. "
                "Lunasi yang paling besar lebih dulu."
            )

    if categories:
        biggest = categories[0]
        share = _safe_divide(biggest.get("amount", 0), expense)
        if share is not None and share >= 0.4:
            return (
                f"kurangi {biggest.get('category')} - sudah "
                f"{share * 100:.0f}% dari pengeluaran Anda."
            )

    if balance < 0:
        return "saldo Anda minus. Tutup yang paling besar dulu."

    return "pertahankan pola ini, dan sisihkan sisanya sebagai tabungan."
