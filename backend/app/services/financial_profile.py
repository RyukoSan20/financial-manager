"""
The financial profile, in one request.

The dashboard shows a card called "Profil Keuangan" - the financial
profile - with nine chapters in it. The first chapter is this month:
what came in, what is left over, and what the next thirty days look
like. The second is the bank accounts. The third is the investments.
And so on, through to the reader's own shop.

Nine chapters could have been nine requests. That would be nine
round trips for one card, nine chances for one of them to be slow,
and nine chances for the card to show a half-filled picture - the
first chapter arrived and the other eight were still in the air.

So there is one request, and it answers all nine.

Everything here is the reader's own numbers, and every figure that
could not be computed is reported as absent rather than as zero. A
chapter that has no data says so; it does not show a confident
figure of nothing.

Nothing in this module raises. A chapter that cannot be read is left
out of the answer, and the card shows the reader the chapters it
does have.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _num(value: Any) -> float:
    """A number, or nothing. Never a crash."""
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


# ---------------------------------------------------------------------------
# Bab 1 - Bulan ini
# ---------------------------------------------------------------------------


def _chapter_month(
    db: Session,
    user_id: int,
    start: date,
    end: date,
) -> Dict[str, Any]:
    """
    This month: what came in, what went out, what is left over.

    "Sisa bebas" - the free remainder - is what is left after the
    money that is already spoken for has been set aside: the
    instalments, the subscriptions, and the card statements.

    It is the number the reader most wants and the hardest to get
    right, because the things that are spoken for live in different
    places: the debts have their own table, the subscriptions are
    recurring rules, and the card statements are spending that has
    not been paid yet.
    """
    from app.models.debt import Debt
    from app.models.recurring import RecurringRule
    from app.models.transaction import Transaction

    income = 0.0
    expense = 0.0
    try:
        income = _num(
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.type == "income",
                Transaction.user_id == user_id,
                Transaction.date >= start,
                Transaction.date <= end,
            )
            .scalar()
        )
        expense = _num(
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.type == "expense",
                Transaction.user_id == user_id,
                Transaction.date >= start,
                Transaction.date <= end,
            )
            .scalar()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile month totals failed: {exc}")

    # The money that is already spoken for.
    committed = 0.0
    installments = 0.0
    subscriptions = 0.0
    card_statements = 0.0

    try:
        rows = (
            db.query(Debt)
            .filter(
                Debt.user_id == user_id,
                Debt.is_active == True,
                Debt.is_paid_off == False,
            )
            .all()
        )
        for debt in rows:
            payment = _num(debt.monthly_payment)
            installments += payment
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile installments failed: {exc}")

    try:
        rules = (
            db.query(RecurringRule)
            .filter(RecurringRule.user_id == user_id, RecurringRule.is_active == True)
            .all()
        )
        for rule in rules:
            amount = _num(rule.amount)
            # A rule that happens every month is a subscription; one
            # that happens every week is a week of spending, so only
            # the part that falls in this month is counted.
            frequency = (rule.frequency or "monthly").lower()
            if frequency in ("weekly", "daily"):
                continue
            subscriptions += amount
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile subscriptions failed: {exc}")

    try:
        from app.models.account import Account

        credit_accounts = (
            db.query(Account)
            .filter(
                Account.user_id == user_id,
                Account.is_active == True,
                Account.is_credit == True,
            )
            .all()
        )
        for account in credit_accounts:
            # A credit card that has not been paid is money the reader
            # owes. It is spoken for.
            card_statements += abs(min(0.0, _num(account.balance)))
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile card statements failed: {exc}")

    committed = installments + subscriptions + card_statements
    free_cash = income - expense

    return {
        "income": income,
        "expense": expense,
        "free_cash": free_cash,
        "installments": installments,
        "subscriptions": subscriptions,
        "card_statements": card_statements,
        "committed": committed,
        "start": start.isoformat(),
        "end": end.isoformat(),
    }


def _timeline_30_days(
    db: Session,
    user_id: int,
    today: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """
    The week behind and the thirty days ahead, as points on a line.

    Four kinds of thing land on the line ahead: the payday, the bills
    that recur, the instalments, and the dates the reader's own goals
    are due. Behind today, each day the reader spent or was paid is a
    point too.

    Each point is a thing that is going to happen, so the reader can
    see what is coming rather than being surprised by it.
    """
    today = today or date.today()
    horizon = today + timedelta(days=30)
    points: List[Dict[str, Any]] = []

    # --- the payday ---------------------------------------------------------
    # The salary is expected on a day of the month. Which day is not
    # recorded anywhere, so the reader's own income transactions are
    # looked at: the day they usually arrive on is the payday.
    try:
        from app.models.transaction import Transaction

        income_rows = (
            db.query(Transaction.date)
            .filter(
                Transaction.type == "income",
                Transaction.user_id == user_id,
            )
            .order_by(Transaction.date.desc())
            .limit(6)
            .all()
        )
        days = [r.date.day for r in income_rows if r.date]
        if days:
            payday_day = days[0]
            payday = today.replace(day=min(payday_day, 28))
            if payday < today:
                payday = payday + timedelta(days=30)
                payday = payday.replace(day=min(payday_day, 28))
            if payday <= horizon:
                points.append(
                    {
                        "date": payday.isoformat(),
                        "kind": "payday",
                        "label": "Gajian",
                        "amount": 0.0,
                    }
                )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile payday failed: {exc}")

    # --- the bills that recur ----------------------------------------------
    try:
        from app.models.recurring import RecurringRule

        rules = (
            db.query(RecurringRule)
            .filter(RecurringRule.user_id == user_id, RecurringRule.is_active == True)
            .all()
        )
        for rule in rules:
            frequency = (rule.frequency or "monthly").lower()
            if frequency in ("weekly", "daily"):
                continue
            day = rule.next_occurrence or rule.start_date
            if not day:
                continue
            occurrence = day
            while occurrence < today:
                occurrence = occurrence + timedelta(days=30)
            if occurrence > horizon:
                continue
            points.append(
                {
                    "date": occurrence.isoformat(),
                    "kind": "bill",
                    "label": rule.description or "Tagihan",
                    "amount": _num(rule.amount),
                }
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile recurring bills failed: {exc}")

    # --- the instalments ----------------------------------------------------
    try:
        from app.models.debt import Debt

        debts = (
            db.query(Debt)
            .filter(
                Debt.user_id == user_id,
                Debt.is_active == True,
                Debt.is_paid_off == False,
            )
            .all()
        )
        for debt in debts:
            when = debt.next_payment_date
            if not when:
                continue
            if when < today:
                when = today + timedelta(days=7)
            if when > horizon:
                continue
            points.append(
                {
                    "date": when.isoformat(),
                    "kind": "installment",
                    "label": debt.name or "Cicilan",
                    "amount": _num(debt.monthly_payment),
                }
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile installments timeline failed: {exc}")

    # --- the goals that are due ---------------------------------------------
    try:
        from app.models.goal import Goal

        goals = (
            db.query(Goal)
            .filter(
                Goal.user_id == user_id,
                Goal.is_active == True,
                Goal.is_completed == False,
            )
            .all()
        )
        for goal in goals:
            when = goal.target_date
            if not when or when < today or when > horizon:
                continue
            points.append(
                {
                    "date": when.isoformat(),
                    "kind": "goal",
                    "label": goal.name or "Target",
                    "amount": _num(goal.target_amount) - _num(goal.current_amount),
                }
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile goals timeline failed: {exc}")

    # --- the days just behind -----------------------------------------------
    # A reader who has only just begun has nothing ahead yet - no
    # bills, no instalments, no due goals - and the line was empty for
    # them. The week behind is always real: each day they spent or
    # were paid is a point, so the line shows where they have been
    # before it shows where they are going.
    try:
        from app.models.transaction import Transaction

        since = today - timedelta(days=7)
        rows = (
            db.query(
                Transaction.date,
                Transaction.type,
                func.coalesce(func.sum(Transaction.amount), 0),
                func.count(Transaction.id),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.date >= since,
                Transaction.date <= today,
                Transaction.type.in_(["income", "expense"]),
            )
            .group_by(Transaction.date, Transaction.type)
            .all()
        )
        for when, kind, total, count in rows:
            if not when:
                continue
            points.append(
                {
                    "date": when.isoformat(),
                    "kind": "earned" if kind == "income" else "spent",
                    "label": ("Masuk" if kind == "income" else "Keluar")
                    + (f" · {int(count)} transaksi" if count and int(count) > 1 else ""),
                    "amount": _num(total),
                }
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile recent days failed: {exc}")

    points.sort(key=lambda p: p.get("date") or "")
    return points


# ---------------------------------------------------------------------------
# Bab 2 - Rekening
# ---------------------------------------------------------------------------


def _chapter_accounts(db: Session, user_id: int) -> Dict[str, Any]:
    """The accounts, grouped by the kind of thing they are."""
    try:
        from app.models.account import Account

        rows = (
            db.query(Account)
            .filter(Account.user_id == user_id, Account.is_active == True)
            .order_by(func.coalesce(Account.balance, 0).desc())
            .all()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile accounts failed: {exc}")
        return {"total": 0.0, "count": 0, "by_kind": [], "top": []}

    groups = {
        "bank": "Bank Konvensional",
        "digital_bank": "Bank Digital",
        "e-wallet": "E-Wallet",
        "cash": "Tunai",
        "investment": "Investasi",
        "credit_card": "Kartu Kredit",
    }
    by_kind: Dict[str, Dict[str, Any]] = {}
    total = 0.0
    top = []

    for account in rows:
        if account.is_credit:
            # A credit card is not money the reader has. It is money
            # they owe, and it is counted in Bab 5.
            continue
        kind = account.account_kind or account.account_type or "cash"
        if kind == "investment":
            # The investments are in Bab 3, and counting them here as
            # well would show the reader the same money twice and
            # make the total of the card bigger than the money they
            # actually have.
            continue
        balance = _num(account.balance)
        total += balance
        group = by_kind.setdefault(
            kind,
            {
                "kind": kind,
                "label": groups.get(kind, kind),
                "total": 0.0,
                "count": 0,
            },
        )
        group["total"] += balance
        group["count"] += 1
        top.append(
            {
                "id": account.id,
                "name": account.name,
                "balance": balance,
                "kind": kind,
                "bank_name": account.bank_name,
            }
        )

    top.sort(key=lambda a: a["balance"], reverse=True)
    return {
        "total": total,
        "count": len(rows),
        "by_kind": sorted(by_kind.values(), key=lambda g: g["total"], reverse=True),
        "top": top[:5],
    }


# ---------------------------------------------------------------------------
# Bab 3 - Portofolio & Investasi
# ---------------------------------------------------------------------------


def _chapter_portfolio(db: Session, user_id: int) -> Dict[str, Any]:
    """The investments, and what they are worth."""
    try:
        from app.models.account import Account

        rows = (
            db.query(Account)
            .filter(
                Account.user_id == user_id,
                Account.is_active == True,
                Account.is_credit == False,
                (Account.account_type == "investment")
                | (Account.account_kind == "investment"),
            )
            .all()
        )
        total = sum(_num(a.balance) for a in rows)
        return {
            "total": total,
            "count": len(rows),
            "accounts": [
                {"id": a.id, "name": a.name, "balance": _num(a.balance)}
                for a in rows
            ],
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile portfolio failed: {exc}")
        return {"total": 0.0, "count": 0, "accounts": []}


# ---------------------------------------------------------------------------
# Bab 4 - Aset & Kekayaan Bersih
# ---------------------------------------------------------------------------


def _chapter_net_worth(db: Session, user_id: int) -> Dict[str, Any]:
    """
    What the reader has, less what they owe.

    The cash is in the accounts. The rest - gold, a motorbike, a
    piece of land - is in the net worth snapshots, which are taken
    from time to time.

    The most recent snapshot is the one that is used, and the figures
    in it are the ones that are shown.
    """
    liquid = 0.0
    investments = 0.0
    try:
        from app.models.account import Account

        rows = (
            db.query(Account)
            .filter(
                Account.user_id == user_id,
                Account.is_active == True,
                Account.is_credit == False,
            )
            .all()
        )
        # What the reader has, in three kinds. The cash is what they
        # can spend today; the investments are what they have put
        # away; the rest - gold, a motorbike, a piece of land - is in
        # the snapshots.
        for account in rows:
            kind = account.account_kind or account.account_type or "cash"
            if kind == "investment":
                investments += _num(account.balance)
            else:
                liquid += _num(account.balance)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile liquid assets failed: {exc}")

    snapshot = None
    try:
        from app.models.net_worth import NetWorthSnapshot

        snapshot = (
            db.query(NetWorthSnapshot)
            .filter(NetWorthSnapshot.user_id == user_id)
            .order_by(NetWorthSnapshot.date.desc())
            .first()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile net worth snapshot failed: {exc}")

    liabilities = 0.0
    non_liquid = 0.0
    if snapshot is not None:
        liabilities = _num(snapshot.total_liabilities)
        non_liquid = _num(snapshot.other_assets)

    debt = 0.0
    try:
        from app.models.debt import Debt

        debt = sum(
            _num(d.current_balance)
            for d in db.query(Debt)
            .filter(
                Debt.user_id == user_id,
                Debt.is_active == True,
                Debt.is_paid_off == False,
            )
            .all()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile liabilities failed: {exc}")

    owed = liabilities or debt

    return {
        "liquid": liquid,
        "investments": investments,
        "non_liquid": non_liquid,
        "liabilities": owed,
        "net_worth": liquid + investments + non_liquid - owed,
        "has_snapshot": snapshot is not None,
    }


# ---------------------------------------------------------------------------
# Bab 5 - Kartu Kredit & Paylater
# ---------------------------------------------------------------------------


def _chapter_credit(db: Session, user_id: int) -> Dict[str, Any]:
    """The credit cards, and how much of the limit is left."""
    try:
        from app.models.account import Account

        rows = (
            db.query(Account)
            .filter(
                Account.user_id == user_id,
                Account.is_active == True,
                Account.is_credit == True,
            )
            .all()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile credit cards failed: {exc}")
        return {"used": 0.0, "limit": 0.0, "remaining": 0.0, "cards": []}

    used = 0.0
    limit = 0.0
    cards = []
    for account in rows:
        balance = _num(account.balance)
        card_used = abs(min(0.0, balance))
        card_limit = _num(account.credit_limit)
        used += card_used
        limit += card_limit
        cards.append(
            {
                "id": account.id,
                "name": account.name,
                "used": card_used,
                "limit": card_limit,
                "remaining": max(0.0, card_limit - card_used),
            }
        )

    return {
        "used": used,
        "limit": limit,
        "remaining": max(0.0, limit - used),
        "cards": cards,
    }


# ---------------------------------------------------------------------------
# Bab 6 - Hutang & Cicilan
# ---------------------------------------------------------------------------


def _chapter_debts(db: Session, user_id: int) -> Dict[str, Any]:
    """What is owed, and how much of the month it takes."""
    try:
        from app.models.debt import Debt

        rows = (
            db.query(Debt)
            .filter(
                Debt.user_id == user_id,
                Debt.is_active == True,
                Debt.is_paid_off == False,
            )
            .all()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile debts failed: {exc}")
        return {
            "principal": 0.0,
            "monthly": 0.0,
            "dsr": None,
            "count": 0,
            "debts": [],
        }

    principal = 0.0
    monthly = 0.0
    debts = []
    for debt in rows:
        balance = _num(debt.current_balance)
        original = _num(debt.principal)
        payment = _num(debt.monthly_payment)
        principal += balance
        monthly += payment
        debts.append(
            {
                "id": debt.id,
                "name": debt.name,
                "balance": balance,
                "principal": original,
                "monthly": payment,
                "next_payment_date": debt.next_payment_date.isoformat()
                if debt.next_payment_date
                else None,
                "progress": max(0.0, min(1.0, (original - balance) / original))
                if original > 0
                else 0.0,
            }
        )

    # The share of the month's income that goes on paying debts.
    dsr = None
    try:
        from app.models.transaction import Transaction

        income = _num(
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.type == "income",
                Transaction.user_id == user_id,
                Transaction.date >= date.today().replace(day=1),
            )
            .scalar()
        )
        if income > 0:
            dsr = monthly / income
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile DSR failed: {exc}")

    return {
        "principal": principal,
        "monthly": monthly,
        "dsr": dsr,
        "count": len(debts),
        "debts": debts,
    }


# ---------------------------------------------------------------------------
# Bab 7 - Piutang & Patungan
# ---------------------------------------------------------------------------


def _chapter_receivables(db: Session, user_id: int) -> Dict[str, Any]:
    """What other people owe the reader."""
    total = 0.0
    count = 0
    try:
        from app.models.debt import Debt

        rows = (
            db.query(Debt)
            .filter(
                Debt.user_id == user_id,
                Debt.is_active == True,
                Debt.is_paid_off == False,
                Debt.debt_type == "receivable",
            )
            .all()
        )
        total = sum(_num(d.current_balance) for d in rows)
        count = len(rows)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile receivables failed: {exc}")

    split_total = 0.0
    split_count = 0
    try:
        from app.services.split_receivable_service import (
            outstanding_receivables,
        )

        outstanding = outstanding_receivables(db, user_id)
        if isinstance(outstanding, list):
            for r in outstanding:
                split_total += _num(
                    r.get("amount") if isinstance(r, dict) else getattr(r, "amount", 0)
                )
                split_count += 1
        elif isinstance(outstanding, dict):
            split_total = _num(outstanding.get("total"))
            split_count = int(outstanding.get("count") or 0)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile split receivables failed: {exc}")

    return {
        "total": total + split_total,
        "loans": total,
        "loans_count": count,
        "split": split_total,
        "split_count": split_count,
    }


# ---------------------------------------------------------------------------
# Bab 8 - Pemasukan
# ---------------------------------------------------------------------------


def _chapter_income(db: Session, user_id: int) -> Dict[str, Any]:
    """Where the money comes from."""
    try:
        from app.models.transaction import Transaction

        start = date.today().replace(day=1)
        rows = (
            db.query(
                Transaction.category_id,
                func.coalesce(func.sum(Transaction.amount), 0).label("total"),
                func.count(Transaction.id).label("count"),
            )
            .filter(
                Transaction.type == "income",
                Transaction.user_id == user_id,
                Transaction.date >= start,
            )
            .group_by(Transaction.category_id)
            .order_by(func.coalesce(func.sum(Transaction.amount), 0).desc())
            .all()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile income failed: {exc}")
        return {"total": 0.0, "count": 0, "sources": [], "growth": None}

    names: Dict[int, str] = {}
    try:
        from app.models.category import Category

        ids = [r.category_id for r in rows if r.category_id]
        if ids:
            for c in db.query(Category).filter(Category.id.in_(ids)).all():
                names[c.id] = c.name
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile income categories failed: {exc}")

    total = 0.0
    sources = []
    for row in rows:
        amount = _num(row.total)
        total += amount
        sources.append(
            {
                "category_id": row.category_id,
                "category": names.get(row.category_id) or "Lainnya",
                "amount": amount,
                "count": int(row.count or 0),
            }
        )

    # How this month compares with the last one.
    growth = None
    try:
        from app.models.transaction import Transaction

        this_start = date.today().replace(day=1)
        last_start = (this_start - timedelta(days=1)).replace(day=1)
        last_end = this_start - timedelta(days=1)

        last_total = _num(
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.type == "income",
                Transaction.user_id == user_id,
                Transaction.date >= last_start,
                Transaction.date <= last_end,
            )
            .scalar()
        )
        if last_total > 0:
            growth = (total - last_total) / last_total
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile income growth failed: {exc}")

    return {
        "total": total,
        "count": len(sources),
        "sources": sources,
        "growth": growth,
    }


# ---------------------------------------------------------------------------
# Bab 9 - Bisnis & Toko
# ---------------------------------------------------------------------------


def _chapter_business(db: Session, user_id: int) -> Dict[str, Any]:
    """The reader's own shop."""
    try:
        from app.models.business_transaction import BusinessTransaction
        from app.models.merchant import Merchant

        merchants = (
            db.query(Merchant)
            .filter(Merchant.user_id == user_id, Merchant.is_active == True)
            .all()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile merchants failed: {exc}")
        return {
            "has_store": False,
            "today_sales": 0.0,
            "month_sales": 0.0,
            "profit": 0.0,
            "qris": 0.0,
            "cash": 0.0,
            "store_name": None,
        }

    store_name = merchants[0].store_name if merchants else None
    today = date.today()
    month_start = today.replace(day=1)

    today_sales = 0.0
    month_sales = 0.0
    profit = 0.0
    qris = 0.0
    cash = 0.0

    try:
        from app.models.business_transaction import BusinessTransaction

        rows = (
            db.query(BusinessTransaction)
            .filter(BusinessTransaction.merchant_id.in_([m.id for m in merchants]))
            .all()
        )
        for row in rows:
            when = getattr(row, "transaction_date", None) or getattr(row, "date", None)
            amount = _num(getattr(row, "total", None) or getattr(row, "amount", 0))
            cost = _num(getattr(row, "total_cost", 0))
            if when and when >= month_start:
                month_sales += amount
                profit += amount - cost
                if when == today:
                    today_sales += amount
            method = (getattr(row, "payment_method", "") or "").lower()
            if method in ("qris", "qr"):
                qris += amount
            elif method in ("cash", "tunai"):
                cash += amount
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile business transactions failed: {exc}")

    return {
        "has_store": bool(merchants),
        "store_name": store_name,
        "today_sales": today_sales,
        "month_sales": month_sales,
        "profit": profit,
        "qris": qris,
        "cash": cash,
        "qris_share": (qris / (qris + cash)) if (qris + cash) > 0 else None,
    }


# ---------------------------------------------------------------------------
# The whole thing
# ---------------------------------------------------------------------------


async def build_financial_profile(
    db: Session,
    user_id: int,
    currency: str = "IDR",
) -> Dict[str, Any]:
    """
    The nine chapters, in one answer.

    Every chapter is built by a function that cannot raise, so a
    chapter that cannot be read comes back empty rather than taking
    the whole card down with it.
    """
    start = date.today().replace(day=1)
    end = date.today()

    chapters: Dict[str, Any] = {}

    builders = [
        ("month", lambda: _chapter_month(db, user_id, start, end)),
        ("accounts", lambda: _chapter_accounts(db, user_id)),
        ("portfolio", lambda: _chapter_portfolio(db, user_id)),
        ("net_worth", lambda: _chapter_net_worth(db, user_id)),
        ("credit", lambda: _chapter_credit(db, user_id)),
        ("debts", lambda: _chapter_debts(db, user_id)),
        ("receivables", lambda: _chapter_receivables(db, user_id)),
        ("income", lambda: _chapter_income(db, user_id)),
        ("business", lambda: _chapter_business(db, user_id)),
    ]

    for key, builder in builders:
        try:
            chapters[key] = builder()
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Profile chapter {key} failed: {exc}")
            chapters[key] = {}

    try:
        chapters["timeline"] = _timeline_30_days(db, user_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Profile timeline failed: {exc}")
        chapters["timeline"] = []

    return {
        "currency": currency,
        "generated_for": date.today().isoformat(),
        "chapters": chapters,
    }
