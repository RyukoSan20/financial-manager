"""
The executor half of the AI agent.

`ai_agent.py` decides *what* to do. This module does it: it writes the
transactions, creates the budgets, splits the money and saves the goals.

Every action follows the same rules:

* It never invents a number. The amount comes from the parsed message or
  is calculated from the user's real balance.
* It is idempotent where it can be, so a retried request does not create
  two transactions.
* It reports exactly what it changed, so the reply can state it.
"""

import logging
import re
from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.goal import Goal
from app.models.transaction import Transaction
from app.models.recurring import RecurringRule

from app.services.direction_classifier import classify_direction
from app.services.ai_agent import (
    AgentAction,
    AgentPlan,
    extract_amount,
    extract_date,
    extract_description,
    extract_percentages,
    detect_intent,
    guess_category,
)
from app.services.intent_classifier import (
    INSTRUCTION,
    QUESTION,
    STATEMENT,
    SUGGESTION,
    analyze,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_decimal(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _default_account(db: Session, user_id: int) -> Optional[Account]:
    """
    The account an agent-created transaction goes to.

    A user who has just registered has no account at all, and the agent
    would then refuse every request with "create an account first". The
    agent creates the default cash account itself, so the first instruction
    the user gives actually works.
    """
    account = db.execute(
        select(Account).where(
            Account.user_id == user_id,
            Account.is_active.is_(True),
            Account.is_credit.is_(False),
        ).order_by(Account.id)
    ).scalars().first()
    if account:
        return account
    account = db.execute(
        select(Account).where(
            Account.user_id == user_id, Account.is_active.is_(True)
        ).order_by(Account.id)
    ).scalars().first()
    if account:
        return account
    return _create_default_account(db, user_id)


def _create_default_account(db: Session, user_id: int) -> Optional[Account]:
    """Create the default cash account for a user who has none."""
    try:
        account = Account(
            user_id=user_id,
            name="Kas Utama",
            account_type="cash",
            balance=Decimal("0"),
            currency="IDR",
            is_active=True,
            is_credit=False,
            icon="wallet",
            color="#3B82F6",
        )
        db.add(account)
        db.flush()
        return account
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Could not create the default account: {exc}")
        db.rollback()
        return None


def _total_balance(db: Session, user_id: int) -> Decimal:
    """What the user actually has, across the non-credit accounts."""
    total = db.execute(
        select(func.coalesce(func.sum(Account.balance), 0)).where(
            Account.user_id == user_id,
            Account.is_active.is_(True),
            Account.is_credit.is_(False),
        )
    ).scalar()
    return _to_decimal(total)


def _find_category(db: Session, user_id: int, name: str) -> Optional[Category]:
    """
    Find a category by name, case insensitively.

    The default categories are SHARED - they have `user_id IS NULL` - so a
    lookup that only looks at the user's own rows never finds them and every
    transaction ends up uncategorised. The user's own categories win over
    the shared ones when both match.
    """
    if not name:
        return None
    rows = db.execute(
        select(Category).where(
            or_(
                Category.user_id == user_id,
                Category.user_id.is_(None),
            ),
            Category.is_active.is_(True),
        )
    ).scalars().all()

    def rank(row: Category) -> int:
        return 0 if row.user_id == user_id else 1

    target = re.sub(r"\s+", " ", name).strip().lower()
    exact = [r for r in rows if r.name.strip().lower() == target]
    if exact:
        return sorted(exact, key=rank)[0]
    # A partial match, so "makan" finds "Makanan & Minuman".
    partial = [r for r in rows if target in r.name.strip().lower()]
    if partial:
        return sorted(partial, key=rank)[0]
    return None


def _find_category_by_hint(
    db: Session, user_id: int, text: str
) -> Optional[Category]:
    """
    Find a category from a free text description.

    The category hints the user (or the learning pass) recorded are
    consulted first, then the built-in word list.
    """
    if not text:
        return None

    try:
        from app.models.category_hint import CategoryHint

        # A SAVEPOINT, so a missing table or a bad row cannot abort the
        # enclosing transaction. Without it the session stays in the
        # "aborted transaction" state and every later query in the same
        # request fails with InFailedSqlTransaction.
        with db.begin_nested():
            rows = db.execute(
                select(CategoryHint).where(
                    CategoryHint.user_id == user_id
                )
            ).scalars().all()
            lowered = text.lower()
            best = None
            best_len = 0
            for hint in rows:
                keyword = (hint.token or "").strip().lower()
                if not keyword:
                    continue
                if keyword in lowered and len(keyword) > best_len:
                    best = hint
                    best_len = len(keyword)
            if best:
                category = db.get(Category, best.category_id)
                if category:
                    return category
    except Exception as exc:  # noqa: BLE001
        logger.debug(f"Category hints unavailable: {exc}")

    guessed = guess_category(text)
    if guessed:
        return _find_category(db, user_id, guessed)
    return None


def _period_bounds(period: str) -> Tuple[date, date]:
    """The first and last day of the current period."""
    today = date.today()
    if period == "daily":
        return today, today
    if period == "weekly":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)
    if period == "yearly":
        return date(today.year, 1, 1), date(today.year, 12, 31)
    # monthly
    last_day = monthrange(today.year, today.month)[1]
    return date(today.year, today.month, 1), date(today.year, today.month, last_day)


def _detect_period(message: str) -> str:
    """daily, weekly, monthly, yearly - from the wording of the message."""
    text = (message or "").lower()
    if "harian" in text or "per hari" in text or "setiap hari" in text:
        return "daily"
    if "mingguan" in text or "per minggu" in text or "setiap minggu" in text:
        return "weekly"
    if "tahunan" in text or "per tahun" in text or "setiap tahun" in text:
        return "yearly"
    return "monthly"


# ---------------------------------------------------------------------------
# The executor
# ---------------------------------------------------------------------------

class AgentExecutor:
    """Turns an AgentPlan into changes in the database."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    # -- transaction ------------------------------------------------------

    def add_transaction(self, message: str) -> AgentAction:
        """
        Add one transaction.

        "tambah 15000 kopi" becomes an expense of 15000 for "kopi".
        """
        amount, rest = extract_amount(message)
        if amount is None or amount <= 0:
            return AgentAction(
                kind="add_transaction",
                description="Jumlah transaksi tidak ditemukan",
                requires_confirmation=False,
                success=False,
                error="Tidak menemukan nominal dalam pesan. Sebutkan jumlahnya, "
                      "misal: tambah 15000 kopi",
            )

        description = extract_description(message, rest) or "Transaksi"
        tx_date = extract_date(message)

        account = _default_account(self.db, self.user_id)
        if account is None:
            return AgentAction(
                kind="add_transaction",
                description="Tidak ada akun yang tersedia",
                requires_confirmation=False,
                success=False,
                error="Buat akun terlebih dahulu sebelum menambah transaksi",
            )

        category = _find_category_by_hint(self.db, self.user_id, description)

        # A merchant named in the message is learned too, so the next
        # receipt from that shop is recognised.
        merchant_name = self._extract_merchant(message, description)

        # The wording that decides the direction is the description on
        # its own. The message carries the instruction ("tambah") and
        # the amount, and neither of those says which way the money
        # went. Using the description alone also means the correction
        # the user made for that wording is found.
        direction = classify_direction(
            description,
            db=self.db,
            user_id=self.user_id,
            merchant=merchant_name,
        )
        tx_type = direction.direction

        tx = Transaction(
            user_id=self.user_id,
            type=tx_type,
            amount=_to_decimal(amount),
            currency="IDR",
            date=tx_date,
            description=description[:255],
            account_id=account.id,
            category_id=category.id if category else None,
            merchant_name=merchant_name,
            status="approved",
            source="ai_agent",
            detection_type="AI_AGENT",
            confidence_score=Decimal("0.9"),
        )
        self.db.add(tx)
        self.db.flush()

        # Move the balance, the same way the transaction endpoint does.
        delta = _to_decimal(amount) if tx_type == "income" else -_to_decimal(amount)
        account.balance = _to_decimal(account.balance) + delta

        self.db.flush()

        # A purchase at a shop is more than one line in the ledger. The
        # things it paid for are worked out and stored with it, so the
        # transaction can be opened and read line by line.
        breakdown_lines: List[Dict[str, Any]] = []
        breakdown_source = "none"
        if tx_type == "expense" and float(amount) > 0:
            try:
                from app.services.transaction_breakdown import expand_transaction

                expansion = expand_transaction(
                    message=message,
                    amount=float(amount),
                    merchant=merchant_name,
                    db=self.db,
                    user_id=self.user_id,
                )
                breakdown_lines = expansion.get("lines") or []
                breakdown_source = expansion.get("source", "none")
            except Exception as exc:  # noqa: BLE001 - the transaction still stands
                logger.warning("Could not work out the transaction breakdown: %s", exc)

        if breakdown_lines:
            from app.services.breakdown_service import set_breakdown

            set_breakdown(
                self.db,
                self.user_id,
                "transaction",
                tx.id,
                [
                    {
                        "name": line.get("name"),
                        "quantity": 1,
                        "unit_price": line.get("amount", 0),
                        "total_price": line.get("amount", 0),
                        "category": line.get("category"),
                        "kind": "expense",
                        "source": breakdown_source,
                        "is_estimated": True,
                    }
                    for line in breakdown_lines
                ],
                replace=True,
            )

        breakdown_preview = ", ".join(
            f"{line.get('name')} Rp{float(line.get('amount', 0)):,.0f}"
            for line in breakdown_lines[:3]
        )

        return AgentAction(
            kind="add_transaction",
            params={
                "amount": float(amount),
                "type": tx_type,
                "description": description,
                "date": tx_date.isoformat(),
                "category": category.name if category else None,
                "account": account.name,
                "merchant": merchant_name,
                "breakdown": breakdown_lines,
                "breakdown_source": breakdown_source,
            },
            description=(
                f"Menambah transaksi {tx_type} {description} "
                f"sebesar Rp{amount:,.0f}"
                + (f" - rincian: {breakdown_preview}" if breakdown_preview else "")
            ),
            success=True,
            result={
                "transaction_id": tx.id,
                "amount": float(amount),
                "type": tx_type,
                "description": description,
                "new_balance": float(account.balance),
                "breakdown": breakdown_lines,
                "breakdown_source": breakdown_source,
            },
        )

    def _extract_merchant(self, message: str, description: str) -> Optional[str]:
        """
        Find the shop in the message.

        "tambah 15000 kopi di warungspaces" -> "Warung Spaces". The
        pattern is a location word followed by a name.
        """
        pattern = re.compile(
            r"\b(?:di|ke|dari|at)\s+([A-Za-z][A-Za-z0-9&'.\-]*(?:\s+[A-Za-z0-9&'.\-]+){0,3})",
            re.IGNORECASE,
        )
        match = pattern.search(message or "")
        if match:
            candidate = match.group(1).strip()
            # Drop trailing noise words.
            candidate = re.sub(
                r"\s+(dan|untuk|dengan|soal|about|tapi|tapi)$", "", candidate, flags=re.IGNORECASE
            )
            if len(candidate) >= 3:
                return candidate[:100]

        # A known merchant from the catalogue mentioned in the message.
        try:
            from app.models.merchant_catalog import MerchantCatalog

            lowered = (message or "").lower()
            rows = self.db.execute(
                select(MerchantCatalog).where(
                    MerchantCatalog.user_id == self.user_id,
                    MerchantCatalog.is_active.is_(True),
                )
            ).scalars().all()
            for row in rows:
                if row.name.lower() in lowered:
                    return row.name
        except Exception as exc:  # noqa: BLE001
            logger.debug(f"Merchant catalogue lookup failed: {exc}")

        return None

    def delete_transaction(self, message: str) -> AgentAction:
        """
        Delete a transaction the user names.

        The most recent matching transaction is used, so "hapus transaksi
        kopi 15000" removes the one the user can see.
        """
        amount, rest = extract_amount(message)
        description = extract_description(message, rest)

        query = select(Transaction).where(
            Transaction.user_id == self.user_id,
            Transaction.is_deleted.is_(False),
        )
        if description:
            query = query.where(
                Transaction.description.ilike(f"%{description}%")
            )
        if amount:
            query = query.where(Transaction.amount == _to_decimal(amount))

        tx = self.db.execute(
            query.order_by(Transaction.date.desc(), Transaction.id.desc())
        ).scalars().first()

        if tx is None:
            return AgentAction(
                kind="delete_transaction",
                description="Transaksi tidak ditemukan",
                requires_confirmation=False,
                success=False,
                error="Tidak menemukan transaksi yang cocok. Sebutkan lebih spesifik.",
            )

        # Soft delete, and reverse the balance only if it was counted.
        tx.is_deleted = True
        if tx.status == "approved":
            account = self.db.get(Account, tx.account_id)
            if account:
                delta = _to_decimal(tx.amount) if tx.type == "income" else -_to_decimal(tx.amount)
                account.balance = _to_decimal(account.balance) - delta
        self.db.flush()

        return AgentAction(
            kind="delete_transaction",
            params={"transaction_id": tx.id, "description": tx.description},
            description=f"Menghapus transaksi {tx.description} (Rp{float(tx.amount):,.0f})",
            success=True,
            result={"transaction_id": tx.id, "deleted": True},
        )

    # -- budget -----------------------------------------------------------

    def set_budget(self, message: str) -> AgentAction:
        """
        Create or update a budget.

        "set budget makan 500000 per bulan" sets a monthly budget of
        500000 for the food category.
        """
        amount, rest = extract_amount(message)
        if amount is None or amount <= 0:
            return AgentAction(
                kind="set_budget",
                description="Jumlah anggaran tidak ditemukan",
                requires_confirmation=False,
                success=False,
                error="Sebutkan nominal anggaran, misal: set budget makan 500000 per bulan",
            )

        period = _detect_period(message)
        category = _find_category_by_hint(self.db, self.user_id, rest)
        if category is None:
            # A budget for everything, named after what is left in the
            # message.
            label = re.sub(
                r"\b(set|atur|bikin|buat|buatkan|budget|anggaran|untuk|per|hari|minggu|bulan|tahun)\b",
                " ",
                rest,
                flags=re.IGNORECASE,
            )
            label = re.sub(r"\s+", " ", label).strip(" ,.-") or "Anggaran Umum"
        else:
            label = category.name

        start, end = _period_bounds(period)

        # An existing active budget for the same category and period is
        # updated instead of a second one being created.
        existing = self.db.execute(
            select(Budget).where(
                Budget.user_id == self.user_id,
                Budget.name == label,
                Budget.period == period,
                Budget.is_active.is_(True),
            )
        ).scalars().first()

        if existing:
            old_amount = float(existing.amount)
            existing.amount = _to_decimal(amount)
            existing.start_date = start
            existing.end_date = end
            self.db.flush()
            return AgentAction(
                kind="set_budget",
                params={"budget_id": existing.id, "name": label, "amount": float(amount),
                        "period": period, "updated": True},
                description=(
                    f"Memperbarui anggaran {label} {period} dari "
                    f"Rp{old_amount:,.0f} menjadi Rp{amount:,.0f}"
                ),
                success=True,
                result={"budget_id": existing.id, "amount": float(amount), "period": period},
            )

        budget = Budget(
            user_id=self.user_id,
            name=label[:100],
            amount=_to_decimal(amount),
            currency="IDR",
            period=period,
            start_date=start,
            end_date=end,
            category_id=category.id if category else None,
            is_active=True,
        )
        self.db.add(budget)
        self.db.flush()

        return AgentAction(
            kind="set_budget",
            params={"budget_id": budget.id, "name": label, "amount": float(amount),
                    "period": period},
            description=f"Membuat anggaran {label} {period} sebesar Rp{amount:,.0f}",
            success=True,
            result={"budget_id": budget.id, "amount": float(amount), "period": period},
        )

    # -- allocation -------------------------------------------------------

    def allocate(self, message: str) -> AgentAction:
        """
        Split the money into budgets by percentage.

        "bagi saldo jadi 50% belanja, 30% tabungan, 20% darurat" creates
        three budgets. The percentages have to add up to 100; if they do
        not, the remainder is reported instead of being invented.
        """
        percentages = extract_percentages(message)
        if not percentages:
            return AgentAction(
                kind="allocate",
                description="Persentase alokasi tidak ditemukan",
                requires_confirmation=False,
                success=False,
                error="Sebutkan persentasenya, misal: bagi saldo 50% belanja, 30% tabungan",
            )

        total_percent = sum(p for _, p in percentages)
        balance = _total_balance(self.db, self.user_id)

        created: List[Dict[str, Any]] = []
        for purpose, percent in percentages:
            if percent <= 0:
                continue
            amount = (balance * Decimal(str(percent)) / Decimal("100")).quantize(
                Decimal("0.01")
            )
            label = purpose.title() if purpose else "Alokasi"
            period = _detect_period(message)
            start, end = _period_bounds(period)

            existing = self.db.execute(
                select(Budget).where(
                    Budget.user_id == self.user_id,
                    Budget.name == label,
                    Budget.period == period,
                    Budget.is_active.is_(True),
                )
            ).scalars().first()

            if existing:
                existing.amount = amount
                existing.start_date = start
                existing.end_date = end
                budget = existing
            else:
                budget = Budget(
                    user_id=self.user_id,
                    name=label[:100],
                    amount=amount,
                    currency="IDR",
                    period=period,
                    start_date=start,
                    end_date=end,
                    is_active=True,
                )
                self.db.add(budget)
                self.db.flush()

            created.append({
                "name": label,
                "percent": percent,
                "amount": float(amount),
                "budget_id": budget.id,
            })

        note = ""
        if abs(total_percent - 100) > 0.5:
            note = (
                f" Total persentase yang disebutkan {total_percent:.0f}%, "
                f"bukan 100%."
            )

        return AgentAction(
            kind="allocate",
            params={"allocations": created, "balance": float(balance),
                    "total_percent": total_percent},
            description=(
                f"Membagi saldo Rp{float(balance):,.0f} menjadi {len(created)} "
                f"alokasi: "
                + ", ".join(f"{c['name']} {c['percent']:.0f}% (Rp{c['amount']:,.0f})" for c in created)
                + "."
                + note
            ),
            success=True,
            result={"allocations": created, "balance": float(balance)},
        )

    # -- goal -------------------------------------------------------------

    def set_savings_goal(self, message: str) -> AgentAction:
        """Create a savings goal: name, amount and target date."""
        amount, rest = extract_amount(message)
        if amount is None or amount <= 0:
            return AgentAction(
                kind="set_savings_goal",
                description="Target tabungan tidak ditemukan",
                requires_confirmation=False,
                success=False,
                error="Sebutkan targetnya, misal: target tabungan vpn 2000000 6 bulan",
            )

        # A goal of a few rupiah is never what the user meant. "Rp1" in
        # "target rumah Rp1 miliar" lost the scale word, and creating a
        # one rupiah goal would be silently wrong. The agent asks
        # instead of guessing.
        if amount < 10000:
            return AgentAction(
                kind="set_savings_goal",
                description="Nominal target terlalu kecil untuk disimpan",
                requires_confirmation=False,
                success=False,
                error=(
                    f"Nominal yang terbaca Rp{amount:,.0f} - kemungkinan "
                    "scaling-nya belum ikut terbaca. Tuliskan nominal lengkap, "
                    "misal: target rumah 300000000 2 tahun"
                ),
            )

        # A period in the message becomes the target date.
        target_date = date.today() + timedelta(days=365)
        months = re.search(r"(\d+)\s*(bulan|month)", (message or "").lower())
        years = re.search(r"(\d+)\s*(tahun|year)", (message or "").lower())

        # An explicit date wins over a period: "target rumah 500000000
        # 23 Oktober 2027" means that day, not one year from now.
        explicit = extract_date(message)
        if explicit != date.today():
            target_date = explicit
        elif months:
            m = int(months.group(1))
            today = date.today()
            target_date = today + timedelta(days=monthrange(
                today.year + (today.month - 1 + m) // 12,
                (today.month - 1 + m) % 12 + 1,
            )[1])
        elif years:
            target_date = date.today() + timedelta(days=365 * int(years.group(1)))

        # The duration is part of the timing, not the name, so it is
        # removed first - otherwise "target tabungan 2000000 6 bulan"
        # produces a goal called "6".
        rest = re.sub(
            r"\d+\s*(bulan|month|tahun|year|hari|day|minggu|week)s?\b",
            " ",
            rest,
            flags=re.IGNORECASE,
        )
        # The date is not part of the name either.
        rest = re.sub(
            r"\b\d{1,2}\s+"
            r"(januari|februari|maret|april|mei|juni|juli|agustus|september|"
            r"oktober|november|desember|january|february|march|april|may|june|"
            r"july|august|september|october|november|december)"
            r"\s+\d{4}\b",
            " ",
            rest,
            flags=re.IGNORECASE,
        )
        # The name is the words between the command and the amount. The
        # command words and the filler are removed, and what is left has
        # to look like a name and not like a whole sentence.
        label = re.sub(
            r"\b(set|atur|aturkan|bikin|bikinlah|buat|buatkan|buatlah|"
            r"membuat|membikin|menyusun|membagi|bagi|target|tujuan|goal|"
            r"tabungan|untuk|per|plan|rencana|dan|atau|tolong|bisa|tolong|"
            r"bisaakah|anda|saya|help|bantu|boleh|silakan|"
            r"bulan|tahun|month|year|hari|day|minggu|week)\b",
            " ",
            rest,
            flags=re.IGNORECASE,
        )
        label = re.sub(r"\s+", " ", label).strip(" ,.-")

        # A name that reads like a sentence is not a name. The subject is
        # almost always in the first two or three words: "primer sek" or
        # "rumah". The rest of the sentence is the user talking, not the
        # name of the goal.
        words = [w for w in label.split(" ") if w]
        if len(words) > 3:
            label = " ".join(words[:3])
        label = label.strip(" ,.-") or "Tabungan"

        goal = Goal(
            user_id=self.user_id,
            name=label[:100],
            target_amount=_to_decimal(amount),
            current_amount=0,
            currency="IDR",
            target_date=target_date,
            goal_type="savings",
            is_active=True,
        )
        self.db.add(goal)
        self.db.flush()

        # A goal with one number in it tells the user nothing. Before it
        # is saved, the parts that number has to cover are worked out, so
        # the goal shows the flight, the stay, the food and the rest.
        breakdown_lines: List[Dict[str, Any]] = []
        breakdown_source = "none"
        try:
            from app.services.goal_breakdown import expand_goal

            expansion = expand_goal(
                message=message,
                target_amount=float(amount),
                target_date=target_date,
            )
            breakdown_lines = expansion.get("lines") or []
            breakdown_source = expansion.get("source", "none")
        except Exception as exc:  # noqa: BLE001 - the goal still gets saved
            logger.warning("Could not work out the goal breakdown: %s", exc)

        if breakdown_lines:
            from app.services.breakdown_service import set_breakdown

            set_breakdown(
                self.db,
                self.user_id,
                "goal",
                goal.id,
                [
                    {
                        "name": line.get("name"),
                        "quantity": 1,
                        "unit_price": line.get("amount", 0),
                        "total_price": line.get("amount", 0),
                        "category": line.get("category"),
                        "kind": "expense",
                        "notes": line.get("note"),
                        "source": breakdown_source,
                        "is_estimated": True,
                    }
                    for line in breakdown_lines
                ],
                replace=True,
            )

        breakdown_preview = ", ".join(
            f"{line.get('name')} Rp{float(line.get('amount', 0)):,.0f}"
            for line in breakdown_lines[:4]
        )

        return AgentAction(
            kind="set_savings_goal",
            params={
                "goal_id": goal.id,
                "name": goal.name,
                "amount": float(amount),
                "target_date": target_date.isoformat(),
                "breakdown": breakdown_lines,
                "breakdown_source": breakdown_source,
            },
            description=(
                f"Membuat target {goal.name} sebesar Rp{amount:,.0f} "
                f"target {target_date.strftime('%d %B %Y')}"
                + (f" - rincian: {breakdown_preview}" if breakdown_preview else "")
            ),
            success=True,
            result={
                "goal_id": goal.id,
                "amount": float(amount),
                "breakdown": breakdown_lines,
                "breakdown_source": breakdown_source,
            },
        )

    # -- plan ------------------------------------------------------------

    def build_plan(self, message: str) -> AgentAction:
        """
        Build a yearly budget plan with goals.

        The details live in their own module, because the plan is a
        bigger piece of work than a single action.
        """
        from app.services.ai_plan_builder import build_plan_action

        return build_plan_action(self.db, self.user_id, message)

    # -- recurring --------------------------------------------------------

    def set_recurring(self, message: str) -> AgentAction:
        """Create a recurring rule: "langsung bayar kos 1500000 tiap bulan"."""
        amount, rest = extract_amount(message)
        if amount is None or amount <= 0:
            return AgentAction(
                kind="set_recurring",
                description="Nominal rutinitas tidak ditemukan",
                requires_confirmation=False,
                success=False,
                error="Sebutkan nominalnya, misal: rutin bayar kos 1500000 tiap bulan",
            )

        lowered = (message or "").lower()
        if any(w in lowered for w in ("tiap bulan", "per bulan", "bulanan", "monthly", "setiap bulan")):
            frequency = "monthly"
        elif any(w in lowered for w in ("tiap minggu", "per minggu", "mingguan", "weekly", "setiap minggu")):
            frequency = "weekly"
        elif any(w in lowered for w in ("tiap hari", "per hari", "harian", "daily", "setiap hari")):
            frequency = "daily"
        elif any(w in lowered for w in ("tiap tahun", "per tahun", "tahunan", "yearly")):
            frequency = "yearly"
        else:
            frequency = "monthly"

        account = _default_account(self.db, self.user_id)
        if account is None:
            return AgentAction(
                kind="set_recurring",
                description="Tidak ada akun yang tersedia",
                requires_confirmation=False,
                success=False,
                error="Buat akun terlebih dahulu",
            )

        description = extract_description(message, rest) or "Transaksi rutin"
        category = _find_category_by_hint(self.db, self.user_id, description)

        rule = RecurringRule(
            user_id=self.user_id,
            type="expense",
            amount=_to_decimal(amount),
            currency="IDR",
            description=description[:255],
            account_id=account.id,
            category_id=category.id if category else None,
            frequency=frequency,
            interval_value=1,
            start_date=date.today(),
            next_occurrence=date.today(),
            is_active=True,
            auto_generate=True,
        )
        self.db.add(rule)
        self.db.flush()

        return AgentAction(
            kind="set_recurring",
            params={"rule_id": rule.id, "amount": float(amount), "frequency": frequency,
                    "description": description},
            description=(
                f"Membuat transaksi rutin {description} Rp{amount:,.0f} "
                f"({frequency})"
            ),
            success=True,
            result={"rule_id": rule.id, "amount": float(amount), "frequency": frequency},
        )


    # -- query ------------------------------------------------------------

    def query_advice(
        self,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> AgentAction:
        """
        Answer a request for advice.

        The tables cannot answer this, so the advisor is asked. A
        failure here is not fatal: the user still gets whatever the
        other actions found.
        """
        try:
            from app.services.ai_advisor_service import (
                ai_advisor,
                get_financial_summary,
            )

            summary = get_financial_summary(self.db, self.user_id)
            result = ai_advisor.chat(message, summary, history=history or [])
            reply = result.get("response") or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Advisor advice failed: {exc}")
            reply = ""

        return AgentAction(
            kind="query_advice",
            description=reply or "Maaf, saya belum bisa memberi saran untuk itu.",
            success=bool(reply),
            result={"advice": reply} if reply else None,
            error=None if reply else "advisor tidak mengembalikan saran",
        )

    def query_budgets(self, message: str) -> AgentAction:
        """
        Report the user's budgets.

        "berapa budget saya" must answer from the real rows, not from the
        advisor's imagination.
        """
        rows = self.db.execute(
            select(Budget).where(
                Budget.user_id == self.user_id,
                Budget.is_active.is_(True),
            )
        ).scalars().all()

        if not rows:
            return AgentAction(
                kind="query_budgets",
                description="Belum ada anggaran",
                success=True,
                result={"budgets": []},
            )

        lines = []
        for row in rows:
            spent = self._spent_for_budget(row)
            lines.append(
                f"{row.name} ({row.period}): Rp{float(row.amount):,.0f}"
                + (f" - terpakai Rp{spent:,.0f}" if spent else "")
            )

        return AgentAction(
            kind="query_budgets",
            params={"budgets": [{"id": r.id, "name": r.name, "amount": float(r.amount),
                                 "period": r.period} for r in rows]},
            description="; ".join(lines),
            success=True,
            result={"budgets": [{"id": r.id, "name": r.name, "amount": float(r.amount),
                                 "period": r.period, "spent": self._spent_for_budget(r)}
                                for r in rows]},
        )

    def query_balance(self, message: str) -> AgentAction:
        """Report the balance across the user's own accounts."""
        accounts = self.db.execute(
            select(Account).where(
                Account.user_id == self.user_id,
                Account.is_active.is_(True),
            )
        ).scalars().all()

        total = sum(float(a.balance or 0) for a in accounts)
        lines = [
            f"{a.name}: Rp{float(a.balance or 0):,.0f}" for a in accounts
        ]

        return AgentAction(
            kind="query_balance",
            description=f"Total saldo Anda Rp{total:,.0f}"
            + (f" ({'; '.join(lines)})" if lines else ""),
            success=True,
            result={
                "total_balance": total,
                "accounts": [
                    {"id": a.id, "name": a.name, "balance": float(a.balance or 0)}
                    for a in accounts
                ],
            },
        )

    def query_expenses(self, message: str) -> AgentAction:
        """Report this month's spending, split by category."""
        today = date.today()
        start = date(today.year, today.month, 1)

        rows = self.db.execute(
            select(Transaction.category_id, func.sum(Transaction.amount))
            .where(
                Transaction.user_id == self.user_id,
                Transaction.type == "expense",
                Transaction.status.in_(("approved", None, "")),
                Transaction.is_deleted.is_(False),
                Transaction.date >= start,
            )
            .group_by(Transaction.category_id)
        ).all()

        total = sum(float(amount or 0) for _, amount in rows)
        parts = []
        for category_id, amount in rows:
            name = "Lainnya"
            if category_id is not None:
                category = self.db.get(Category, category_id)
                if category is not None:
                    name = category.name
            parts.append(f"{name}: Rp{float(amount or 0):,.0f}")
        parts.sort(key=lambda part: part, reverse=True)

        return AgentAction(
            kind="query_expenses",
            description=f"Pengeluaran bulan ini Rp{total:,.0f}"
            + (f" ({'; '.join(parts)})" if parts else ""),
            success=True,
            result={"total": total, "period": "month", "categories": parts},
        )

    def query_goals(self, message: str) -> AgentAction:
        """Report the user's savings goals."""
        rows = self.db.execute(
            select(Goal).where(
                Goal.user_id == self.user_id,
                Goal.is_active.is_(True),
                Goal.is_completed.is_(False),
            )
        ).scalars().all()

        if not rows:
            return AgentAction(
                kind="query_goals",
                description="Belum ada target tabungan aktif",
                success=True,
                result={"goals": []},
            )

        lines = []
        for row in rows:
            target = float(row.target_amount or 0)
            saved = float(row.current_amount or 0)
            percent = (saved / target * 100) if target > 0 else 0
            lines.append(
                f"{row.name}: Rp{saved:,.0f} dari Rp{target:,.0f} ({percent:.0f}%)"
            )

        return AgentAction(
            kind="query_goals",
            description="; ".join(lines),
            success=True,
            result={
                "goals": [
                    {
                        "id": r.id,
                        "name": r.name,
                        "target_amount": float(r.target_amount or 0),
                        "current_amount": float(r.current_amount or 0),
                    }
                    for r in rows
                ],
            },
        )

    def query_transactions(self, message: str) -> AgentAction:
        """Report the most recent transactions."""
        rows = self.db.execute(
            select(Transaction)
            .where(
                Transaction.user_id == self.user_id,
                Transaction.is_deleted.is_(False),
            )
            .order_by(Transaction.date.desc(), Transaction.id.desc())
            .limit(5)
        ).scalars().all()

        if not rows:
            return AgentAction(
                kind="query_transactions",
                description="Belum ada transaksi",
                success=True,
                result={"transactions": []},
            )

        lines = [
            f"{r.description or 'Tanpa nama'}: Rp{float(r.amount or 0):,.0f}"
            for r in rows
        ]

        return AgentAction(
            kind="query_transactions",
            description="; ".join(lines),
            success=True,
            result={
                "transactions": [
                    {
                        "id": r.id,
                        "description": r.description,
                        "amount": float(r.amount or 0),
                        "type": r.type,
                        "date": r.date.isoformat() if r.date else None,
                    }
                    for r in rows
                ],
            },
        )

    def _spent_for_budget(self, budget: Budget) -> float:
        """How much of a budget has already been used."""
        try:
            if budget.category_id is None:
                return 0.0
            total = self.db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.user_id == self.user_id,
                    Transaction.category_id == budget.category_id,
                    Transaction.type == "expense",
                    Transaction.status.in_(("approved", None, "")),
                    Transaction.is_deleted.is_(False),
                )
            ).scalar()
            return float(total or 0)
        except Exception as exc:  # noqa: BLE001
            logger.debug(f"Budget spend lookup failed: {exc}")
            return 0.0


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Query routing
# ---------------------------------------------------------------------------

# Which read answers a question. The order matters: the first subject
# whose words appear in the message wins.
_QUERY_SUBJECTS = (
    ("query_budgets", ("budget", "anggaran", "batas", "limit")),
    ("query_balance", ("saldo", "balance", "duit", "uang", "sisa")),
    ("query_expenses", ("pengeluaran", "expense", "belanja", "biaya", "habis")),
    ("query_goals", ("target", "goal", "tujuan", "cita")),
    ("query_transactions", ("transaksi", "transaction", "riwayat", "history")),
)

_QUERY_DESCRIPTIONS = {
    "query_budgets": "Menampilkan informasi anggaran",
    "query_balance": "Menampilkan saldo saat ini",
    "query_expenses": "Menampilkan ringkasan pengeluaran",
    "query_goals": "Menampilkan target tabungan",
    "query_transactions": "Menampilkan transaksi terbaru",
}


def _query_subject(message: str) -> str:
    """Pick the read that answers the question.

    Falls back to the budgets, which is the most common thing a user
    asks the agent about.
    """
    text = (message or "").lower()
    for kind, words in _QUERY_SUBJECTS:
        if any(word in text for word in words):
            return kind
    return "query_budgets"

# How each action is described to the user.
_ACTION_DESCRIPTIONS = {
    "add_transaction": "Menambah satu transaksi",
    "delete_transaction": "Menghapus satu transaksi",
    "set_budget": "Membuat atau memperbarui anggaran",
    "allocate": "Membagi saldo menjadi beberapa anggaran",
    "set_savings_goal": "Membuat target tabungan",
    "set_recurring": "Membuat transaksi rutin",
    "build_plan": "Menyusun rencana anggaran dan target",
}

# The actions that only read. They can run together with the ones that
# write, because a read cannot break anything.
_READ_ACTIONS = {
    "query_budgets", "query_balance", "query_expenses", "query_goals",
    "query_transactions", "query_advice",
}


def _build_multi_clause_plan(analysis) -> Optional[AgentPlan]:
    """
    Build a plan out of a message that holds several requests.

    The old plan builder could only describe one action, so a message
    that asked for two things only did one of them. Here every clause
    is turned into its own action, and the action keeps the text of its
    clause so the executor can read the amount from the right place.

    Nothing is returned when the message is a single request, because
    the old builder already handles that case well.
    """
    actionable = [
        c for c in analysis.clauses
        if c.kind in (INSTRUCTION, QUESTION) and c.intent != "unknown"
    ]
    suggestions = [c for c in analysis.clauses if c.kind == SUGGESTION]

    if not actionable:
        return None

    # A single request is left to the old builder. The new path only
    # earns its keep when there is more than one thing to do.
    if len(actionable) == 1 and not suggestions:
        return None

    writes = [c for c in actionable if c.intent not in _READ_ACTIONS]
    reads = [c for c in actionable if c.intent in _READ_ACTIONS]

    # A suggestion is not an action. It is answered by the advisor.
    if not writes and not reads:
        return None

    plan = AgentPlan(
        intent=actionable[0].intent,
        confidence=min(c.confidence for c in actionable),
    )
    plan.is_multi = True

    for clause in writes + reads:
        plan.actions.append(AgentAction(
            kind=clause.intent,
            description=_ACTION_DESCRIPTIONS.get(
                clause.intent, _QUERY_DESCRIPTIONS.get(clause.intent, "")
            ),
            params={"clause": clause.text},
        ))

    # The reply has to mention what was found, not just what was done.
    if suggestions:
        plan.suggestions = [c.text for c in suggestions]

    return plan


def build_plan(db: Session, user_id: int, message: str) -> AgentPlan:
    """
    Work out what the user wants and what should happen.

    The plan is built without touching the database. The executor runs
    it afterwards, and only when the user confirms.

    A message can hold several requests. "berapa saldo saya, tambah
    50000 kopi, dan budget makan 500000 sebulan" is one question and
    two instructions, and all three have to happen. Each action keeps
    the text of the clause it came from, so the executor reads the
    amount from that clause and not from the whole message.
    """
    analysis = analyze(message)

    plan = _build_multi_clause_plan(analysis)
    if plan is not None:
        return plan

    # A single request for advice. The tables cannot answer it, so it
    # goes to the advisor.
    if len(analysis.suggestions) == 1 and not analysis.instructions:
        clause = analysis.suggestions[0]
        return AgentPlan(
            intent="query_advice",
            confidence=clause.confidence,
            actions=[AgentAction(
                kind="query_advice",
                description="Memberikan saran",
                params={"clause": clause.text},
            )],
        )

    # A single request. The classifier is trusted when it is sure,
    # because it knows about negations and wishes that the old chain
    # of rules did not. The old chain is the fallback for anything the
    # classifier does not recognise.
    if len(analysis.clauses) == 1:
        clause = analysis.clauses[0]
        if clause.kind == STATEMENT and clause.confidence >= 0.5:
            # "jangan hapus ..." is not an order to delete anything.
            return AgentPlan(intent="unknown", confidence=clause.confidence)
        if clause.kind == INSTRUCTION and clause.intent != "unknown":
            intent, confidence = clause.intent, clause.confidence
        elif clause.kind == QUESTION and clause.intent != "query_budgets":
            intent, confidence = "query", clause.confidence
        else:
            intent, confidence = detect_intent(message)
    else:
        intent, confidence = detect_intent(message)

    plan = AgentPlan(intent=intent, confidence=confidence)

    if intent == "add_transaction":
        plan.actions.append(AgentAction(
            kind="add_transaction",
            description="Menambah satu transaksi",
        ))
    elif intent == "delete_transaction":
        plan.actions.append(AgentAction(
            kind="delete_transaction",
            description="Menghapus satu transaksi",
        ))
    elif intent == "set_budget":
        plan.actions.append(AgentAction(
            kind="set_budget",
            description="Membuat atau memperbarui anggaran",
        ))
    elif intent == "allocate":
        plan.actions.append(AgentAction(
            kind="allocate",
            description="Membagi saldo menjadi beberapa anggaran",
        ))
    elif intent == "set_savings_goal":
        plan.actions.append(AgentAction(
            kind="set_savings_goal",
            description="Membuat target tabungan",
        ))
    elif intent == "build_plan":
        plan.actions.append(AgentAction(
            kind="build_plan",
            description="Menyusun rencana anggaran dan target",
        ))
    elif intent == "set_recurring":
        plan.actions.append(AgentAction(
            kind="set_recurring",
            description="Membuat transaksi rutin",
        ))
    elif intent == "query":
        # A question can be about several things. Picking the wrong one
        # made "berapa saldo saya" answer with the budget table, so the
        # subject decides which read runs.
        subject = _query_subject(message)
        plan.actions.append(AgentAction(
            kind=subject,
            description=_QUERY_DESCRIPTIONS[subject],
        ))

    return plan


def execute_plan(
    db: Session,
    user_id: int,
    plan: AgentPlan,
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> AgentPlan:
    """Run the actions of a plan against the database."""
    executor = AgentExecutor(db, user_id)

    for action in plan.actions:
        try:
            # Each action reads its own clause. Without this, a message
            # that mentions two amounts would give both actions the
            # first amount.
            text = action.params.get("clause") or message

            if action.kind == "add_transaction":
                result = executor.add_transaction(text)
            elif action.kind == "delete_transaction":
                result = executor.delete_transaction(text)
            elif action.kind == "set_budget":
                result = executor.set_budget(text)
            elif action.kind == "allocate":
                result = executor.allocate(text)
            elif action.kind == "set_savings_goal":
                result = executor.set_savings_goal(text)
            elif action.kind == "set_recurring":
                result = executor.set_recurring(text)
            elif action.kind == "build_plan":
                result = executor.build_plan(text)
            elif action.kind == "query_budgets":
                result = executor.query_budgets(text)
            elif action.kind == "query_balance":
                result = executor.query_balance(text)
            elif action.kind == "query_expenses":
                result = executor.query_expenses(text)
            elif action.kind == "query_goals":
                result = executor.query_goals(text)
            elif action.kind == "query_transactions":
                result = executor.query_transactions(text)
            elif action.kind == "query_advice":
                result = executor.query_advice(text, history)
            else:
                result = AgentAction(
                    kind=action.kind,
                    success=False,
                    error=f"Aksi tidak dikenal: {action.kind}",
                )

            action.description = result.description or action.description
            action.params = result.params or action.params
            action.result = result.result
            action.success = result.success
            action.error = result.error
        except Exception as exc:  # noqa: BLE001
            logger.exception(f"Agent action {action.kind} failed")
            action.success = False
            action.error = str(exc)
            db.rollback()

    return plan
