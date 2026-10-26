"""
Profile Summary API.

Powers the interactive "User Profile" section and the "Profile Summary"
page it links to. Everything returned here is derived from the database -
there are no placeholder or hardcoded values.

The response has three parts:
  - identity:   who the user is (email, name, member since, ...)
  - history:    recent activity, aggregated per day
  - stats:      lifetime counters and balances
"""

from fastapi import APIRouter, Depends
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import func, case, and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.services.currency_totals import total_in_currency
from app.models.user import User
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.receipt import ReceiptScan
from app.models.activity_log import ActivityLog

router = APIRouter(tags=["Profile"])


def _month_name(month: int) -> str:
    names = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ]
    return names[month - 1]


@router.get("/summary")
async def get_profile_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full profile summary: identity, activity history and lifetime stats."""
    user_id = current_user.id

    # ---- Identity -------------------------------------------------------
    display_name = (
        current_user.full_name
        or current_user.username
        or (current_user.email.split("@")[0] if current_user.email else "Pengguna")
    )
    initials = "".join(
        part[0].upper() for part in display_name.split()[:2] if part
    ) or "U"

    created_at = current_user.created_at
    member_since = None
    if created_at:
        member_since = {
            "iso": created_at.isoformat(),
            "date": created_at.strftime("%Y-%m-%d"),
            "display": f"{created_at.day} {_month_name(created_at.month)} {created_at.year}",
        }

    last_login = current_user.last_login.isoformat() if current_user.last_login else None

    # ---- Lifetime stats -------------------------------------------------
    total_income = db.query(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(
        Transaction.user_id == user_id,
        Transaction.type == "income",
    ).scalar()

    total_expense = db.query(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(
        Transaction.user_id == user_id,
        Transaction.type == "expense",
    ).scalar()

    tx_count = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == user_id
    ).scalar() or 0

    account_count = db.query(func.count(Account.id)).filter(
        Account.user_id == user_id
    ).scalar() or 0

    scan_count = db.query(func.count(ReceiptScan.id)).filter(
        ReceiptScan.user_id == user_id
    ).scalar() or 0

    # Account balance is the stored running balance, not a recomputation.
    # Accounts can be in different currencies, so they are converted
    # before they are added. Adding them raw would report rupiah and
    # yen as if they were the same money.
    balances = db.query(Account).filter(Account.user_id == user_id).all()
    display_currency = (
        getattr(current_user, "default_currency", None)
        or getattr(current_user_settings, "currency", None)
        or "IDR"
    )
    balance_total = await total_in_currency(
        [(float(getattr(a, "balance", 0) or 0), getattr(a, "currency", None) or "IDR")
         for a in balances],
        target=display_currency,
    )
    total_balance = balance_total.total

    # ---- Activity history (last 30 days, grouped per day) ---------------
    since = datetime.utcnow() - timedelta(days=30)

    rows = (
        db.query(
            func.date(Transaction.date).label("day"),
            func.count(Transaction.id).label("income_count"),
            func.coalesce(
                func.sum(case((Transaction.type == "income", Transaction.amount), else_=0)), 0
            ).label("income_sum"),
            func.count(case((Transaction.type == "expense", 1))).label("expense_count"),
            func.coalesce(
                func.sum(case((Transaction.type == "expense", Transaction.amount), else_=0)), 0
            ).label("expense_sum"),
        )
        .filter(Transaction.user_id == user_id, Transaction.date >= since.date())
        .group_by(func.date(Transaction.date))
        .order_by(func.date(Transaction.date).desc())
        .all()
    )

    history: List[Dict[str, Any]] = []
    for row in rows:
        day = row.day
        if isinstance(day, str):
            try:
                day_date = datetime.strptime(day, "%Y-%m-%d").date()
            except ValueError:
                continue
        else:
            day_date = day

        history.append({
            "date": day_date.isoformat(),
            "display": f"{day_date.day} {_month_name(day_date.month)} {day_date.year}",
            "income_count": int(row.income_count or 0),
            "expense_count": int(row.expense_count or 0),
            "income": float(row.income_sum or 0),
            "expense": float(row.expense_sum or 0),
            "net": float((row.income_sum or 0) - (row.expense_sum or 0)),
            "total_count": int(row.income_count or 0) + int(row.expense_count or 0),
        })

    # ---- Recent transactions (feed for the history section) -------------
    recent = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(10)
        .all()
    )

    recent_items = [
        {
            "id": t.id,
            "type": t.type,
            "amount": float(t.amount or 0),
            "date": t.date.isoformat() if t.date else None,
            "description": t.description,
            "merchant_name": getattr(t, "merchant_name", None),
            "category_id": getattr(t, "category_id", None),
            "detection_type": getattr(t, "detection_type", None),
        }
        for t in recent
    ]

    # ---- Login history from the activity log ----------------------------
    login_events = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == user_id,
            ActivityLog.action.ilike("%login%"),
        )
        .order_by(ActivityLog.created_at.desc())
        .limit(5)
        .all()
    )

    logins = [
        {
            "at": e.created_at.isoformat() if e.created_at else None,
            "action": e.action,
            "ip_address": e.ip_address,
        }
        for e in login_events
    ]

    # ---- Streak: consecutive days with at least one transaction ---------
    active_days = sorted({h["date"] for h in history}, reverse=True)
    streak = 0
    if active_days:
        cursor = datetime.utcnow().date()
        # A streak survives if the user was active today or yesterday.
        if cursor - timedelta(days=1) in set(active_days):
            cursor = cursor - timedelta(days=1)
        for day in active_days:
            if day == cursor.isoformat():
                streak += 1
                cursor = cursor - timedelta(days=1)
            elif day < cursor.isoformat():
                break

    return {
        "identity": {
            "id": user_id,
            "email": current_user.email,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "phone": getattr(current_user, "phone", None),
            "avatar_url": (
                getattr(current_user, "avatar_url", None)
                or getattr(current_user, "google_picture", None)
            ),
            "display_name": display_name,
            "initials": initials,
            "is_verified": getattr(current_user, "is_verified", False),
            "is_guest": getattr(current_user, "is_guest", False),
            "default_currency": getattr(current_user, "default_currency", "IDR"),
            "timezone": getattr(current_user, "timezone", "Asia/Jakarta"),
            "member_since": member_since,
            "last_login": last_login,
        },
        "stats": {
            "total_income": float(total_income or 0),
            "total_expense": float(total_expense or 0),
            "net_balance": float((total_income or 0) - (total_expense or 0)),
            "account_balance": total_balance,
            "account_balance_currency": display_currency,
            "account_balance_by_currency": balance_total.by_currency,
            "account_balance_unconverted": balance_total.unconverted,
            "transaction_count": int(tx_count),
            "account_count": int(account_count),
            "receipt_scan_count": int(scan_count),
            "active_days": len(active_days),
            "current_streak": streak,
        },
        "history": history,
        "recent_transactions": recent_items,
        "login_history": logins,
    }
