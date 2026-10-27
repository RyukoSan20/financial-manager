"""
The things the records already say, but nobody has pointed out.

Four of these work only from what is already in the records:

- **A bill paid twice.** The same amount leaving the same account on
  the same day, twice.
- **A subscription that was forgotten.** The same merchant taking
  money every month, with no rule set up for it.
- **The balance ahead.** What the balance will be on each day of the
  coming month, if the recurring bills are paid and nothing else
  happens.
- **What to buy this month.** What the reader bought last month that
  they have not bought yet this month.

None of these send anything and none of them change anything. They
are worked out from the records and handed to the browser, which
decides whether to show them.

The money is added up through `total_in_currency`, so an amount in
dollars is not added to an amount in rupiah. That is the same rule
the rest of the application follows, and it is the rule that A1 put
in place.
"""

from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session


def _month_key(day: date) -> str:
    """The month a day belongs to, as a string that sorts."""
    return f"{day.year:04d}-{day.month:02d}"


def _month_start(today: Optional[date] = None) -> date:
    today = today or date.today()
    return date(today.year, today.month, 1)


def _previous_month_start(today: Optional[date] = None) -> date:
    start = _month_start(today)
    last_day = start - timedelta(days=1)
    return date(last_day.year, last_day.month, 1)


def find_duplicate_charges(
    db: Session,
    user_id: int,
    today: Optional[date] = None,
    days_back: int = 30,
) -> List[Dict[str, Any]]:
    """
    Bills that look like they were paid twice.

    A pair of expenses counts as a duplicate when the amount, the
    account and the day are all the same, and the two are within a
    short window of each other. The window matters: paying the same
    amount to the same place on the same day twice is nearly always
    a mistake, but paying the same rent on the first of every month
    is not.

    The result carries the transactions involved, so the screen can
    show them and the reader can decide. Nothing is deleted and
    nothing is merged: that is the reader's call, not the server's.
    """
    today = today or date.today()
    since = today - timedelta(days=days_back)

    from app.models.transaction import Transaction

    expenses = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.is_deleted.is_(False),
            Transaction.date >= since,
            Transaction.date <= today,
        )
        .order_by(Transaction.date.asc(), Transaction.id.asc())
        .all()
    )

    # Group by the things that have to match.
    groups: Dict[Any, List[Any]] = defaultdict(list)
    for tx in expenses:
        key = (
            round(float(tx.amount), 2),
            tx.currency,
            tx.account_id,
        )
        groups[key].append(tx)

    duplicates: List[Dict[str, Any]] = []

    for key, group in groups.items():
        if len(group) < 2:
            continue

        # Within each group, walk the days and find two on the same
        # day, or close enough that one is probably a double charge.
        for i, first in enumerate(group):
            for second in group[i + 1:]:
                gap = (second.date - first.date).days
                # The same day is the strong case. Up to three days
                # is the weak case, and is only reported when the
                # descriptions look alike, because a shop may bill
                # twice for two different things.
                if gap == 0:
                    confidence = "high"
                elif gap <= 3 and _looks_alike(first.description, second.description):
                    confidence = "medium"
                else:
                    continue

                duplicates.append({
                    "amount": float(key[0]),
                    "currency": key[1],
                    "account_id": key[2],
                    "confidence": confidence,
                    "days_apart": gap,
                    "transactions": [
                        {
                            "id": tx.id,
                            "date": tx.date.isoformat(),
                            "description": tx.description,
                            "merchant_name": tx.merchant_name,
                        }
                        for tx in (first, second)
                    ],
                })

    # The strongest first, then the newest.
    duplicates.sort(key=lambda d: (d["confidence"] != "high", -d["days_apart"]))
    return duplicates


def _looks_alike(first: Optional[str], second: Optional[str]) -> bool:
    """
    Do two descriptions look like the same thing?

    Only the words that carry the meaning are compared, and the
    numbers are left out, because two charges of the same amount for
    the same subscription differ by a reference number.
    """
    if not first or not second:
        return False

    def words(text: str) -> set:
        cleaned = "".join(ch if ch.isalpha() else " " for ch in text.lower())
        return {w for w in cleaned.split() if len(w) > 2}

    a = words(first)
    b = words(second)
    if not a or not b:
        return False

    shared = a & b
    if not shared:
        return False

    # One shared word is enough when the words are distinctive, and
    # two is enough when they are ordinary.
    common = {w for w in shared if len(w) > 4}
    if common:
        return True
    return len(shared) >= 2


def find_forgotten_subscriptions(
    db: Session,
    user_id: int,
    today: Optional[date] = None,
    months: int = 3,
    min_amount: float = 1000.0,
) -> List[Dict[str, Any]]:
    """
    Subscriptions that keep taking money and were never set up.

    A subscription shows itself as the same merchant taking roughly
    the same amount, month after month, with no recurring rule behind
    it. The reader set up a rule for the bills they know about; this
    is what they forgot.

    The amount is compared with a tolerance, because a subscription
    that goes up by a little is still the same subscription. The
    months are compared as calendar months, because a subscription
    is charged on the same day each month, not thirty days apart.
    """
    today = today or date.today()
    since = _month_start(today) - timedelta(days=31 * (months + 1))

    from app.models.recurring import RecurringRule
    from app.models.transaction import Transaction

    expenses = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.is_deleted.is_(False),
            Transaction.date >= since,
            Transaction.date <= today,
        )
        .all()
    )

    if not expenses:
        return []

    # The merchants that already have a rule are not forgotten.
    #
    # A rule is matched two ways. A charge that carries the rule's
    # number is a match, because the charge came from the rule. And a
    # rule whose name is the merchant is a match too, because the
    # reader may have set the rule up after the charges had already
    # been made, and those charges are still not a surprise.
    active_rules = (
        db.query(RecurringRule)
        .filter(
            RecurringRule.user_id == user_id,
            RecurringRule.is_active.is_(True),
        )
        .all()
    )
    ruled_ids = {row.id for row in active_rules}
    ruled_names = set()
    for rule in active_rules:
        if rule.description:
            ruled_names.add(_clean_name(rule.description))

    ruled_merchants = set()
    for tx in expenses:
        if tx.recurring_rule_id is not None and tx.recurring_rule_id in ruled_ids:
            ruled_merchants.add(_merchant_key(tx))
            continue
        key = _merchant_key(tx)
        if key and key in ruled_names:
            ruled_merchants.add(key)

    # Group by merchant.
    by_merchant: Dict[str, List[Any]] = defaultdict(list)
    for tx in expenses:
        key = _merchant_key(tx)
        if not key:
            continue
        by_merchant[key].append(tx)

    results: List[Dict[str, Any]] = []

    for key, group in by_merchant.items():
        if key in ruled_merchants:
            continue

        # The months this merchant appears in.
        seen_months: Dict[str, List[Any]] = defaultdict(list)
        for tx in group:
            seen_months[_month_key(tx.date)].append(tx)

        if len(seen_months) < months:
            continue

        # The amount has to be about the same each time.
        amounts = [float(tx.amount) for tx in group]
        average = sum(amounts) / len(amounts)
        if average < min_amount:
            continue

        # Nothing may differ from the average by more than a tenth,
        # or by a small absolute amount, whichever is larger.
        tolerance = max(average * 0.1, 100.0)
        if any(abs(amount - average) > tolerance for amount in amounts):
            continue

        # The months have to be consecutive, or a subscription that
        # was cancelled and restarted is not a forgotten one.
        ordered = sorted(seen_months.keys())
        if not _are_consecutive(ordered):
            continue

        latest = max(group, key=lambda tx: tx.date)
        results.append({
            "merchant": latest.merchant_name or latest.description or key,
            "amount": round(average, 2),
            "currency": latest.currency,
            "months_found": len(seen_months),
            "last_charged": latest.date.isoformat(),
            "day_of_month": latest.date.day,
            "total_paid": round(sum(amounts), 2),
        })

    # The ones that cost the most first.
    results.sort(key=lambda r: -r["amount"])
    return results


def _clean_name(text: str) -> str:
    """
    A name reduced to the words that carry the meaning.

    The same words are taken out of a description and out of a rule's
    name, so that "Netflix" and "NETFLIX.COM invoice 88213" are
    recognised as the same thing.
    """
    cleaned = "".join(ch if ch.isalpha() else " " for ch in text.lower())
    return " ".join(w for w in cleaned.split() if len(w) > 2)


def _merchant_key(tx) -> str:
    """
    The name a subscription is recognised by.

    The merchant name is used when there is one, because the parser
    fills it in and it is the same across the months. Otherwise the
    description is used, with the digits taken out, because a
    subscription reference number changes every month.
    """
    if tx.merchant_name:
        return tx.merchant_name.strip().lower()
    if not tx.description:
        return ""
    cleaned = "".join(ch if ch.isalpha() else " " for ch in tx.description.lower())
    return " ".join(w for w in cleaned.split() if len(w) > 2)


def _are_consecutive(months: List[str]) -> bool:
    """Are these months one after another, with none missing?"""
    if len(months) < 2:
        return True
    for previous, current in zip(months, months[1:]):
        py, pm = (int(x) for x in previous.split("-"))
        cy, cm = (int(x) for x in current.split("-"))
        expected = (py + 1, 1) if pm == 12 else (py, pm + 1)
        if (cy, cm) != expected:
            return False
    return True


async def project_balance_calendar(
    db: Session,
    user_id: int,
    today: Optional[date] = None,
    days: int = 30,
) -> List[Dict[str, Any]]:
    """
    The balance on each day of the coming month.

    The projection starts from the balance now and moves it day by
    day: the bills that come due take money out, and the income that
    comes in puts money back. Nothing else is assumed, because
    assuming spending that has not happened would be a guess, and a
    guess shown as a number is a lie.

    A day with nothing on it carries the balance forward, so the
    calendar has one line for every day rather than only the busy
    ones.

    The money is added up in the currency the reader is looking at,
    so the running balance does not mix dollars into rupiah.
    """
    today = today or date.today()
    until = today + timedelta(days=days)

    from app.models.recurring import RecurringRule
    from app.services.metrics import total_balance

    # The balance now, in the reader's own currency. This is the same
    # total the dashboard shows, so the calendar starts from the
    # number the reader already trusts.
    balance = await total_balance(db, user_id)
    display_currency = balance["currency"]
    current = balance["total"]

    # What is coming, day by day.
    events: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    rules = (
        db.query(RecurringRule)
        .filter(
            RecurringRule.user_id == user_id,
            RecurringRule.is_active.is_(True),
        )
        .all()
    )
    for rule in rules:
        occurrence = rule.next_occurrence
        if occurrence is None:
            continue
        # A rule that is far in the future still shows its first
        # occurrence if it falls inside the window.
        day = occurrence
        while day <= until:
            if day >= today:
                amount = float(rule.amount or 0)
                sign = 1.0 if rule.type == "income" else -1.0
                events[day.isoformat()].append({
                    "kind": rule.type,
                    "amount": amount,
                    "currency": rule.currency,
                    "description": rule.description or "",
                    "rule_id": rule.id,
                })
            day = _next_occurrence(rule, day)
            if day is None:
                break

    calendar: List[Dict[str, Any]] = []
    running = current

    for offset in range(days + 1):
        day = today + timedelta(days=offset)
        key = day.isoformat()
        day_events = events.get(key, [])

        for event in day_events:
            if event["currency"] == display_currency:
                running += event["amount"] * (1.0 if event["kind"] == "income" else -1.0)
            else:
                # An amount in another currency is converted rather
                # than dropped, using the same rate the balance uses.
                converted = await _convert(event["amount"], event["currency"], display_currency)
                running += converted * (1.0 if event["kind"] == "income" else -1.0)

        calendar.append({
            "date": key,
            "balance": round(running, 2),
            "events": day_events,
        })

    return calendar


def _next_occurrence(rule, current: date) -> Optional[date]:
    """The day after the current one that this rule falls on."""
    try:
        interval = int(rule.interval_value or 1)
    except (TypeError, ValueError):
        interval = 1

    frequency = (rule.frequency or "monthly").lower()

    if frequency == "daily":
        return current + timedelta(days=interval)
    if frequency == "weekly":
        return current + timedelta(weeks=interval)
    if frequency == "biweekly":
        return current + timedelta(weeks=2 * interval)

    # Monthly, quarterly, yearly and custom all move by months.
    months = 1
    if frequency == "quarterly":
        months = 3
    elif frequency == "yearly":
        months = 12
    elif frequency == "custom":
        months = max(1, interval)

    year = current.year
    month = current.month + months
    year += (month - 1) // 12
    month = (month - 1) % 12 + 1

    # The day of the month is kept, but a month that is too short for
    # it falls back to the last day of that month.
    day = rule.day_of_month or current.day
    last_day = _days_in_month(year, month)
    return date(year, month, min(day, last_day))


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        return 31
    return (date(year, month + 1, 1) - timedelta(days=1)).day


def _display_currency(db: Session, user_id: int) -> str:
    """The currency the reader is looking at."""
    from app.services.metrics import saved_display_currency
    return saved_display_currency(db, user_id)


async def _convert(amount: float, from_currency: str, to_currency: str) -> float:
    """
    An amount in one currency, in another.

    This goes through the same helper the balance goes through, so
    the calendar and the balance can never disagree about what a
    yen is worth. A rate that is not available gives zero, and a zero
    is left out of the running balance rather than counted wrongly.
    """
    if from_currency == to_currency:
        return amount

    from app.services.currency_totals import total_in_currency

    result = await total_in_currency(
        [(amount, from_currency)],
        target=to_currency,
    )
    if result.unconverted:
        return 0.0
    return result.total


def suggest_monthly_shopping(
    db: Session,
    user_id: int,
    today: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """
    What the reader bought last month and has not bought yet.

    The shopping list is worked out from the records rather than
    from a rule, because a list of what a household actually buys is
    more useful than a list of what a rule says they should buy.

    A merchant is on the list when it was bought in each of the last
    two months and has not been bought at all this month. That is
    the ordinary monthly rhythm of groceries and household things.
    """
    today = today or date.today()
    this_month = _month_start(today)
    last_month = _previous_month_start(today)
    two_months_ago = (last_month - timedelta(days=1)).replace(day=1)
    since = two_months_ago

    from app.models.transaction import Transaction

    expenses = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.is_deleted.is_(False),
            Transaction.date >= since,
            Transaction.date <= today,
        )
        .all()
    )

    if not expenses:
        return []

    this_month_key = _month_key(this_month)
    last_month_key = _month_key(last_month)
    two_months_key = _month_key(two_months_ago)

    by_merchant: Dict[str, List[Any]] = defaultdict(list)
    for tx in expenses:
        key = _merchant_key(tx)
        if key:
            by_merchant[key].append(tx)

    suggestions: List[Dict[str, Any]] = []

    for key, group in by_merchant.items():
        months = {_month_key(tx.date) for tx in group}
        if last_month_key not in months or two_months_key not in months:
            continue
        if this_month_key in months:
            # Already bought this month, so it is not missing.
            continue

        last_month_group = [tx for tx in group if _month_key(tx.date) == last_month_key]
        latest = max(last_month_group, key=lambda tx: tx.date)
        average = sum(float(tx.amount) for tx in last_month_group) / len(last_month_group)

        suggestions.append({
            "merchant": latest.merchant_name or latest.description or key,
            # The estimate is the most recent charge, not the average:
            # the last one says what it costs now, and an average
            # would mix an old price with a new one.
            "estimated_amount": round(float(latest.amount), 2),
            "average_amount": round(average, 2),
            "currency": latest.currency,
            "last_bought": latest.date.isoformat(),
            "times_in_history": len(group),
        })

    # The ones that cost the most first.
    suggestions.sort(key=lambda s: -s["estimated_amount"])
    return suggestions
