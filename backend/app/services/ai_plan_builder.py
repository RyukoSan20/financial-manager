"""
The financial plan builder.

The user asked for something the plain budget command cannot do: "bagi
tabungan saya ke dalam plan 1 tahun, primer sekunder tersier, gaji 6
juta per bulan, pengeluaran 1 juta per bulan, besides investasi, make
targets such as a house".

That is not one budget and not one goal. It is a plan: a set of budgets
that follow the money every month, and a set of goals that say where the
money is going. The plan runs for a year.

The numbers the user gives are the starting point. Everything that is not
stated is derived from them, and nothing is invented out of thin air: the
primary needs come out of the monthly income minus the stated expenses,
and the rest is split by a fixed, documented rule.

The split:

    Primer    needs: food, transport, bills, daily life. 50% of income
    Sekunder  wants: entertainment, shopping, eating out. 20% of income
    Tersier   future: savings and the goals. The rest

The percentages are the default. When the message carries its own
percentages, or its own list of categories, those are used instead.
"""

import logging
import re
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.goal import Goal

from app.services.ai_agent import (
    AgentAction,
    extract_amount,
    extract_date,
    extract_percentages,
)

logger = logging.getLogger(__name__)


def _to_decimal(value: Any) -> Any:
    """The money columns are Decimal, so the numbers are converted once."""
    from decimal import Decimal

    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# The default shape of a plan
# ---------------------------------------------------------------------------

# Each tier is a list of (budget name, category keyword). The keyword is
# used to find a matching category so the budget lands in the right place
# in the reports.
PRIMARY_CATEGORIES = [
    ("Kebutuhan Pokok", "primer"),
    ("Transportasi & Transport", "transportasi"),
    ("Tagihan & Utilitas", "tagihan"),
    ("Kesehatan", "kesehatan"),
]

SECONDARY_CATEGORIES = [
    ("Belanja & Hiburan", "belanja"),
    ("Makan di Luar", "makan"),
    ("Hiburan & Rekreasi", "hiburan"),
]

# The tiers get a share of the monthly income. The rest goes to the goals.
DEFAULT_SPLIT = {
    "Primer": 0.50,
    "Sekunder": 0.20,
    "Tersier": 0.30,
}

TIER_DESCRIPTIONS = {
    "Primer": "kebutuhan sehari-hari: makan, transport, tagihan",
    "Sekunder": "keinginan: belanja, makan di luar, hiburan",
    "Tersier": "masa depan: tabungan dan target",
}

# Words that mark a message as a request for a whole plan. The list
# lives in the agent module, which owns the intent vocabulary.
from app.services.ai_agent import PLAN_CUES  # noqa: E402

# Words that mark a tier.
TIER_WORDS = {
    "Primer": ("primer", "pokok", "primer"),
    "Sekunder": ("sekunder", "secondary", "sekunder"),
    "Tersier": ("tersier", "tertiary", "tersier"),
}


# ---------------------------------------------------------------------------
# Reading the numbers out of the message
# ---------------------------------------------------------------------------

def _find_amounts_near(
    text: str,
    anchor_words: Tuple[str, ...],
    anchors_after_number: bool = True,
) -> Optional[float]:
    """
    The amount that belongs to the anchor word.

    "gaji 6 juta" puts the number after the word, "6 juta gaji" puts it
    before. Both are read, but a number that belongs to a different
    anchor is left alone: in "gaji 10 juta, pengeluaran 3 juta" the 3
    juta is not the salary.

    The anchor word must sit close to the number, and the number must not
    have another anchor between it and its own.
    """
    lower = text.lower()

    # The span of every anchor word. Both the start and the end matter:
    # the gap to a number that follows is measured from the end, the gap
    # to a number that comes before is measured from the start.
    anchors: List[Tuple[int, int, str]] = []
    for word in anchor_words:
        for match in re.finditer(r"\b" + re.escape(word) + r"\b", lower):
            anchors.append((match.start(), match.end(), word))
    if not anchors:
        return None
    anchors.sort()

    numbers = [
        (match.start(), match.end(), _scale_value(match.group("amount"), match.group("scale")))
        for match in re.finditer(
            r"(?P<amount>\d[\d.,]*)\s*(?P<scale>ribu|rb|juta|jt|miliar|milyar)?",
            lower,
        )
    ]
    numbers = [(s, e, v) for s, e, v in numbers if v is not None and v > 0]

    best: Optional[float] = None
    for start, end, _word in anchors:
        # The number that follows the anchor belongs to it. In "gaji
        # 6000000 per bulan pengeluaran 1000000" the 6000000 is the salary
        # and the 1000000 is the spending, and each anchor claims the
        # number right after it.
        following = [
            (s, e, v) for s, e, v in numbers if s >= end and s - end <= 25
        ]
        if following:
            chosen = min(following, key=lambda item: item[0])[2]
        else:
            # Otherwise the number right before the anchor: "6 juta gaji".
            preceding = [
                (s, e, v) for s, e, v in numbers if e <= start and start - e <= 25
            ]
            if not preceding:
                continue
            chosen = max(preceding, key=lambda item: item[1])[2]

        if best is None or chosen > best:
            best = chosen

    return best


def _scale_value(raw: str, scale: Optional[str]) -> Optional[float]:
    """Turn "6" plus "juta" into 6000000."""
    cleaned = (raw or "").replace(".", "").replace(",", ".")
    try:
        value = float(cleaned)
    except ValueError:
        return None

    if scale in ("ribu", "rb"):
        value *= 1_000
    elif scale in ("juta", "jt"):
        value *= 1_000_000
    elif scale in ("miliar", "milyar"):
        value *= 1_000_000_000

    return value


def _read_income(message: str) -> Optional[float]:
    """
    The monthly income the user stated.

    "gaji 6 juta per bulan" and "gaji 6000000 per bulan" both give 6
    million. The largest income the user mentioned wins; a plan is built
    on the main salary, not on a side note.
    """
    return _find_amounts_near(
        message,
        (
            "gaji", "salary", "income", "penghasilan", "pendapatan",
            "pemasukan", "bonus", "uang masuk", "dibayar", "diterima",
        ),
    )


def _read_expenses(message: str) -> Optional[float]:
    """
    The monthly spending the user stated.

    "pengeluaran sekitar 1 jt" or "biaya 1000000 per bulan".
    """
    return _find_amounts_near(
        message,
        (
            "pengeluaran", "expense", "biaya", "belanja", "outgoing",
            "pengeluaran bulanan", "biaya bulanan", "per bulan keluar",
        ),
    )


def _read_duration_months(message: str) -> int:
    """
    How long the plan runs. "plan 1 tahun" means twelve months.
    """
    text = (message or "").lower()

    years = re.search(r"(\d+)\s*(tahun|year)", text)
    if years:
        return max(1, int(years.group(1)) * 12)

    months = re.search(r"(\d+)\s*(bulan|month)", text)
    if months:
        return max(1, int(months.group(1)))

    return 12


def _read_tiers(message: str) -> Dict[str, Optional[float]]:
    """
    The share each tier gets, when the user stated them.

    "primer 50% sekunder 30% tersier 20%" gives all three. A tier that
    is not mentioned keeps its default.
    """
    lower = (message or "").lower()
    shares: Dict[str, Optional[float]] = {}

    for tier, words in TIER_WORDS.items():
        for word in words:
            match = re.search(
                word + r"[^%]{0,20}?(\d+(?:[.,]\d+)?)\s*(?:%|persen)",
                lower,
            )
            if match:
                try:
                    value = float(match.group(1).replace(",", "."))
                except ValueError:
                    continue
                if 0 < value <= 100:
                    shares[tier] = value
                    break

    return shares


def _read_goal_amounts(message: str) -> List[Tuple[str, float]]:
    """
    The goals the user named, with the amount for each.

    "target rumah 300 juta" gives ("rumah", 300000000). The name is the
    word right after "target" and the amount is the number after it.
    """
    text = message or ""
    lower = text.lower()

    results: List[Tuple[str, float]] = []
    for match in re.finditer(
        r"\b(target|tujuan|goal|rencana)\b\s+"
        r"(?P<name>[a-zA-Z][a-zA-Z\s\-]{2,30}?)\s+"
        r"(?P<amount>\d[\d.,]*)\s*"
        r"(?P<scale>ribu|rb|juta|jt|miliar|milyar)?",
        lower,
    ):
        name = re.sub(
            r"\s+", " ", match.group("name")
        ).strip(" ,.-")
        # The name stops at a word that belongs to the plan wording.
        name = re.split(
            r"\b(?:per|selama|dengan|target|tahun|bulan|dan|untuk)\b", name
        )[0].strip()
        if not name or len(name) < 3:
            continue

        raw = match.group("amount")
        cleaned = raw.replace(".", "").replace(",", ".")
        try:
            value = float(cleaned)
        except ValueError:
            continue

        scale = match.group("scale")
        if scale in ("ribu", "rb"):
            value *= 1_000
        elif scale in ("juta", "jt"):
            value *= 1_000_000
        elif scale in ("miliar", "milyar"):
            value *= 1_000_000_000

        if value > 0:
            results.append((name, value))

    return results


# ---------------------------------------------------------------------------
# Building the plan
# ---------------------------------------------------------------------------

def _tier_categories(
    tier: str,
    share: float,
    monthly_amount: float,
) -> List[Tuple[str, float, str]]:
    """
    Split a tier's share over its categories.

    The categories in a tier are not equal: food is not the same size as
    transport. The weights below are the default; they add up to 1 for
    each tier so the tier's share is fully used.
    """
    if tier == "Primer":
        catalogue = [
            ("Kebutuhan Pokok", 0.50, "primer"),
            ("Transportasi & Transport", 0.20, "transportasi"),
            ("Tagihan & Utilitas", 0.20, "tagihan"),
            ("Kesehatan", 0.10, "kesehatan"),
        ]
    elif tier == "Sekunder":
        catalogue = [
            ("Belanja & Hiburan", 0.50, "belanja"),
            ("Makan di Luar", 0.30, "makan"),
            ("Hiburan & Rekreasi", 0.20, "hiburan"),
        ]
    else:
        return []

    return [
        (name, monthly_amount * share * weight, keyword)
        for name, weight, keyword in catalogue
    ]


def _find_or_create_budget(
    db: Session,
    user_id: int,
    name: str,
    amount: float,
    period: str,
    start: date,
    end: date,
) -> Budget:
    """
    The budget with this name and period, created or updated.

    Re-running the same plan changes the amounts instead of piling up
    duplicates.
    """
    existing = db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.name == name,
            Budget.period == period,
            Budget.is_active.is_(True),
        )
    ).scalars().first()

    if existing:
        existing.amount = _to_decimal(amount)
        existing.start_date = start
        existing.end_date = end
        return existing

    budget = Budget(
        user_id=user_id,
        name=name[:100],
        amount=_to_decimal(amount),
        currency="IDR",
        period=period,
        start_date=start,
        end_date=end,
        is_active=True,
    )
    db.add(budget)
    db.flush()
    return budget


def build_plan_action(
    db: Session,
    user_id: int,
    message: str,
) -> AgentAction:
    """
    Build the yearly plan the user asked for.

    Everything the plan contains is derived from the numbers in the
    message or from the database. If the user did not say what they earn,
    the plan is refused with a question rather than a guess.
    """
    income = _read_income(message)
    expenses = _read_expenses(message)

    months = _read_duration_months(message)

    if income is None or income <= 0:
        # The plan is built on what the user earns, so without an
        # income there is nothing to plan. The question names the
        # figure that is missing, so the user can answer in one go.
        return AgentAction(
            kind="build_plan",
            description="Rencana butuh jumlah penghasilan bulanan",
            requires_confirmation=False,
            success=False,
            error=(
                f"Berapa penghasilan bulanan Anda? Rencana {months} bulan "
                "dibangun dari penghasilan itu, misal: "
                "'buatkan budgeting untuk 2 tahun ke depan, gaji 6 juta "
                "per bulan'"
            ),
        )
    stated = _read_tiers(message)

    # The stated expenses come out of the income before the tiers are
    # split, otherwise the plan spends more than the user earns.
    if expenses is None or expenses <= 0:
        # A sensible default: a tenth of the income is spending when the
        # user did not say. It is stated in the reply so it is visible.
        expenses = round(income * 0.10, -2)
        expense_note = (
            f" Pengeluaran tidak disebutkan, jadi diperkirakan "
            f"Rp{expenses:,.0f} per bulan."
        )
    else:
        expense_note = ""

    # The money that is not spent goes into the tiers.
    available = max(income - expenses, 0)

    # The percentages apply to the income, not to what is left over, so
    # the plan reads the same way every month.
    splits = dict(DEFAULT_SPLIT)
    for tier, percent in stated.items():
        splits[tier] = percent / 100.0

    # The tiers must not use more than what is left after the expenses.
    total_share = sum(splits.values())
    if total_share > 1:
        scale = 1.0 / total_share
        splits = {tier: share * scale for tier, share in splits.items()}
        note = " Persentase yang-mentioned melebihi 100%, jadi dinormalkan."
    else:
        note = ""

    # A plan of one year or more is a yearly budget; a shorter one is
    # a monthly one. "2 tahun ke depan" has to produce budgets that
    # last two years, not budgets that expire at the end of this
    # month.
    today = date.today()
    if months >= 12:
        period = "yearly"
        start = date(today.year, 1, 1)
        end = date(today.year + (months // 12) - 1, 12, 31)
    else:
        period = "monthly"
        start = date(today.year, today.month, 1)
        last_day = _last_day_of_month(start)
        end = date(last_day.year, last_day.month, last_day.day)

    created_budgets: List[Dict[str, Any]] = []
    tier_totals: Dict[str, float] = {}

    for tier in ("Primer", "Sekunder", "Tersier"):
        share = splits.get(tier, 0.0)
        if share <= 0:
            continue
        tier_amount = income * share
        tier_totals[tier] = tier_amount

        for name, amount, _keyword in _tier_categories(tier, share, income):
            if amount <= 0:
                continue
            budget = _find_or_create_budget(
                db, user_id, name, round(amount, -2), period, start, end
            )
            created_budgets.append({
                "name": budget.name,
                "amount": float(amount),
                "tier": tier,
                "budget_id": budget.id,
            })

    # The goals. The user named them, or the tiers get a default set.
    goals_created: List[Dict[str, Any]] = []
    # The goal is reached at the end of the plan, not a year after
    # today whatever the plan is.
    target_date = today + timedelta(days=30 * months)

    named_goals: List[Tuple[str, float]] = list(_read_goal_amounts(message))
    if not named_goals:
        # A plan without named goals still needs somewhere for the
        # tertiary share to go, so the default goal is the emergency
        # fund, which is the one thing everybody needs first.
        savings = tier_totals.get("Tersier", 0.0)
        named_goals = [("Dana Darurat", savings * months)] if savings > 0 else []

    for name, amount in named_goals:
        goal = Goal(
            user_id=user_id,
            name=name[:100],
            target_amount=amount,
            current_amount=0,
            currency="IDR",
            target_date=target_date,
            goal_type="savings",
            is_active=True,
        )
        db.add(goal)
        db.flush()
        goals_created.append({
            "name": goal.name,
            "amount": float(amount),
            "target_date": target_date.isoformat(),
            "goal_id": goal.id,
        })

    db.flush()

    lines = [
        f"Primer (kebutuhan): Rp{tier_totals.get('Primer', 0):,.0f}/bulan",
        f"Sekunder (keinginan): Rp{tier_totals.get('Sekunder', 0):,.0f}/bulan",
        f"Tersier (masa depan): Rp{tier_totals.get('Tersier', 0):,.0f}/bulan",
    ]

    return AgentAction(
        kind="build_plan",
        params={
            "months": months,
            "period": period,
            "income": income,
            "expenses": expenses,
            "tiers": tier_totals,
            "budgets": created_budgets,
            "goals": goals_created,
        },
        description=(
            f"Rencana {months} bulan dari gaji Rp{income:,.0f}/bulan. "
            + "; ".join(lines)
            + (f" Target dibuat: {', '.join(g['name'] for g in goals_created)}."
               if goals_created else "")
        ),
        success=True,
        result={
            "months": months,
            "period": period,
            "income": income,
            "expenses": expenses,
            "tiers": tier_totals,
            "budgets": created_budgets,
            "goals": goals_created,
            "note": (expense_note + note).strip(),
        },
    )


def _last_day_of_month(day: date) -> date:
    from calendar import monthrange

    return date(day.year, day.month, monthrange(day.year, day.month)[1])
