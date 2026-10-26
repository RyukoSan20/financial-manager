"""
How ready the account is.

A new account with nothing in it cannot show a useful budget, a useful
chart or a useful health score. Saying so plainly, and saying what to
do next, is more useful than an empty page.

Every item is a thing the reader can actually do inside the app. Each
one carries a key so the frontend can say it in the language of the
reader, and a link so the button goes to the right place.

The score is the share of items that are done. It is a guide, not a
judgement: a reader with one account and everything else empty still
has a working app.
"""

from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session


@dataclass
class ReadinessItem:
    """One thing to do, and whether it is done."""
    key: str
    # What the reader is asked to do.
    title_key: str
    description_key: str
    # The icon the frontend draws.
    icon: str
    # Where the button goes.
    href: str
    # The order the items are shown in.
    order: int
    done: bool = False
    # The number behind the item, e.g. how many accounts there are.
    value: Optional[int] = None
    # Why it cannot be counted, when it is a web-only limitation.
    web_only_note: bool = False


@dataclass
class ReadinessReport:
    """The whole picture: what is done, what is next."""
    items: List[ReadinessItem] = field(default_factory=list)
    score: int = 0
    done_count: int = 0
    total_count: int = 0
    # The item to do next. The first one that is not done.
    next_key: Optional[str] = None

    def as_dict(self) -> dict:
        return {
            "score": self.score,
            "done_count": self.done_count,
            "total_count": self.total_count,
            "next_key": self.next_key,
            "items": [
                {
                    "key": i.key,
                    "title_key": i.title_key,
                    "description_key": i.description_key,
                    "icon": i.icon,
                    "href": i.href,
                    "order": i.order,
                    "done": i.done,
                    "value": i.value,
                    "web_only_note": i.web_only_note,
                }
                for i in sorted(self.items, key=lambda x: x.order)
            ],
        }


def build_readiness(db: Session, user_id: int) -> ReadinessReport:
    """Work out what the reader has set up and what is still missing."""
    from app.models.account import Account
    from app.models.transaction import Transaction
    from app.models.budget import Budget
    from app.models.goal import Goal
    from app.models.user import User
    from app.models.user_settings import UserSettings

    items: List[ReadinessItem] = []

    def count(model, **filters):
        q = db.query(func.count(model.id)).filter(model.user_id == user_id)
        for k, v in filters.items():
            q = q.filter(getattr(model, k) == v)
        return q.scalar() or 0

    # 1. A profile to put a name on the account.
    user = db.query(User).filter(User.id == user_id).first()
    has_profile = bool(user and (user.full_name or user.username))
    items.append(ReadinessItem(
        key="profile",
        title_key="readiness.profile_title",
        description_key="readiness.profile_desc",
        icon="user",
        href="/settings/profile",
        order=10,
        done=has_profile,
    ))

    # 2. An account. Everything else is built on top of it.
    account_count = count(Account, is_active=True)
    items.append(ReadinessItem(
        key="account",
        title_key="readiness.account_title",
        description_key="readiness.account_desc",
        icon="wallet",
        href="/accounts",
        order=20,
        done=account_count > 0,
        value=account_count,
    ))

    # 3. Some transactions, so the charts and the health score have
    #    something to work with.
    tx_count = count(Transaction, is_deleted=False)
    items.append(ReadinessItem(
        key="transactions",
        title_key="readiness.transactions_title",
        description_key="readiness.transactions_desc",
        icon="receipt",
        href="/transactions",
        order=30,
        done=tx_count >= 3,
        value=tx_count,
    ))

    # 4. A budget, so the spending has a limit to live inside.
    budget_count = count(Budget)
    items.append(ReadinessItem(
        key="budget",
        title_key="readiness.budget_title",
        description_key="readiness.budget_desc",
        icon="target",
        href="/budgets",
        order=40,
        done=budget_count > 0,
        value=budget_count,
    ))

    # 5. A goal, so the savings have a reason.
    goal_count = count(Goal, is_active=True)
    items.append(ReadinessItem(
        key="goals",
        title_key="readiness.goals_title",
        description_key="readiness.goals_desc",
        icon="flag",
        href="/goals",
        order=50,
        done=goal_count > 0,
        value=goal_count,
    ))

    # 6. A currency chosen for display. The account opens in the
    #    reader's own currency, so this is done from the start unless
    #    they changed it.
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    display_currency = None
    if settings:
        display_currency = getattr(settings, "currency", None)
        if not display_currency:
            # The choice may live in the free-form preferences blob.
            prefs = getattr(settings, "preferences", None)
            if prefs:
                try:
                    import json
                    parsed = json.loads(prefs) if isinstance(prefs, str) else prefs
                    if isinstance(parsed, dict):
                        display_currency = parsed.get("displayCurrency")
                except Exception:
                    display_currency = None
    has_currency = bool(display_currency)
    items.append(ReadinessItem(
        key="currency",
        title_key="readiness.currency_title",
        description_key="readiness.currency_desc",
        icon="coins",
        href="/settings/app",
        order=60,
        done=has_currency,
    ))

    # 7. The reminders. A reader who forgets to record does not get
    #    the benefit of the app.
    reminder_frequency = None
    if settings:
        reminder_frequency = getattr(settings, "reminder_frequency", None)
    items.append(ReadinessItem(
        key="reminders",
        title_key="readiness.reminders_title",
        description_key="readiness.reminders_desc",
        icon="bell",
        href="/settings/notifications",
        order=70,
        done=bool(reminder_frequency and reminder_frequency != "never"),
    ))

    done = [i for i in items if i.done]
    report = ReadinessReport(
        items=items,
        done_count=len(done),
        total_count=len(items),
    )
    report.score = int(len(done) / len(items) * 100) if items else 0
    pending = sorted([i for i in items if not i.done], key=lambda x: x.order)
    report.next_key = pending[0].key if pending else None
    return report
