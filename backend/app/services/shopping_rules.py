"""
Aturan pipeline belanja — Python murni (tanpa DB, tanpa framework).

Dipisah dari shopping_pipeline.py supaya state machine, batas tanggal, dan
agregasi bisa diuji tanpa database.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable

WIB = timezone(timedelta(hours=7))  # WIB tidak mengenal DST, jadi offset tetap aman

STAGE_ORDER = ("wishlist", "to_buy", "ordered", "shipped", "received", "cancelled")
PAID_STAGES = ("ordered", "shipped", "received")

# Peta perpindahan yang diizinkan. Ini satu-satunya sumber kebenaran:
# frontend membaca hasilnya lewat field `allowed_next` pada tiap item.
# Catatan: "ordered" hanya bisa dicapai lewat purchase (ada uang yang keluar).
TRANSITIONS: dict[str, frozenset[str]] = {
    "wishlist": frozenset({"to_buy", "ordered", "cancelled"}),
    "to_buy": frozenset({"wishlist", "ordered", "cancelled"}),
    "ordered": frozenset({"shipped", "received", "cancelled"}),
    "shipped": frozenset({"received", "cancelled"}),
    "received": frozenset(),  # final; retur dicatat manual sebagai transaksi
    "cancelled": frozenset({"wishlist", "to_buy"}),
}


def allowed_next(stage: str) -> list[str]:
    return [s for s in STAGE_ORDER if s in TRANSITIONS[stage]]


def can_move(src: str, dst: str) -> bool:
    return dst in TRANSITIONS[src]


def now_wib() -> datetime:
    return datetime.now(WIB)


def today_wib() -> date:
    return now_wib().date()


def month_bounds(month: str) -> tuple[datetime, datetime]:
    """'2026-10' -> [1 Okt 00:00 WIB, 1 Nov 00:00 WIB). Melempar ValueError bila format salah."""
    year_s, mon_s = month.split("-")
    year, mon = int(year_s), int(mon_s)
    start = datetime(year, mon, 1, tzinfo=WIB)  # ValueError bila bulan di luar 1..12
    end = datetime(year + 1, 1, 1, tzinfo=WIB) if mon == 12 else datetime(year, mon + 1, 1, tzinfo=WIB)
    return start, end


def day_range_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """Rentang tanggal inklusif -> interval setengah-terbuka [start 00:00, end+1 00:00) WIB."""
    lo = datetime.combine(start, time.min, tzinfo=WIB)
    hi = datetime.combine(end + timedelta(days=1), time.min, tzinfo=WIB)
    return lo, hi


def rollup(pairs: Iterable[tuple[str, int]]) -> list[dict]:
    """[(label, nominal)] -> [{label, count, total}] terurut dari total terbesar."""
    count: dict[str, int] = defaultdict(int)
    total: dict[str, int] = defaultdict(int)
    for label, amount in pairs:
        count[label] += 1
        total[label] += int(amount)
    rows = [{"label": k, "count": count[k], "total": total[k]} for k in total]
    rows.sort(key=lambda r: (-r["total"], r["label"]))
    return rows
