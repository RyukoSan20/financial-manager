"""
The money that is owed back, in the shape the rest of the application
already uses.

Two pages in this application are about money that other people owe
the reader and money the reader owes other people:

- the debts page, which lists what is owed and how it is to be paid
  off,
- the transfers page, which lists money that has moved between
  accounts.

The money that a shared bill leaves on loan belongs on the first, and
the money that comes back belongs on the second. Neither of them is
showing anywhere else, because money on loan is not spending and money
coming back is not income.

So the two pages are given a way to include it, without changing the
shape of what they already return. The rows that come back from here
are shaped like the rows the pages already show, so that adding them
does not change anything for a reader who has no shared bills.

Nothing here writes anything. It only reads.
"""

from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

# The two kinds of row this produces.
#
# "owed_back" is money that has left the reader's account and has not
# come back. "paid_back" is money that has come back.
OWED_BACK = "owed_back"
PAID_BACK = "paid_back"


def _dec(value) -> float:
    if value is None:
        return 0.0
    return float(value)


def _returned_amounts(db: Session, user_id: int) -> Dict[Optional[int], float]:
    """
    How much has come back, for each receipt.
    """
    from app.models.transaction import Transaction

    returned: Dict[Optional[int], float] = {}
    for row in (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.split_tx_type == "SPLIT_REIMBURSEMENT",
        )
        .all()
    ):
        key = row.split_expense_id
        returned[key] = returned.get(key, 0.0) + _dec(row.amount)
    return returned


def outstanding_receivables(
    db: Session,
    user_id: int,
    today: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """
    The money the reader has laid out for other people and not got back.

    Only bills that were actually published are counted. A bill that
    is still being claimed has not left the account, so there is
    nothing owed yet.
    """
    from app.models.split_bill import SplitExpense, SplitGroup
    from app.models.transaction import Transaction

    today = today or date.today()

    lent = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.split_tx_type == "FRONTED_RECEIVABLE",
        )
        .all()
    )
    if not lent:
        return []

    returned = _returned_amounts(db, user_id)

    expenses = {
        expense.id: expense
        for expense in db.query(SplitExpense)
        .filter(SplitExpense.user_id == user_id)
        .all()
    }
    groups = {
        group.id: group
        for group in db.query(SplitGroup)
        .filter(SplitGroup.owner_id == user_id)
        .all()
    }

    rows: List[Dict[str, Any]] = []
    for row in lent:
        expense = expenses.get(row.split_expense_id)
        if expense is None:
            continue
        if expense.status != "PUBLISHED":
            # Nothing has left the account yet.
            continue

        outstanding = _dec(row.amount) - returned.get(row.split_expense_id, 0.0)
        if outstanding <= 0:
            continue

        group = groups.get(expense.group_id)
        when = row.date
        rows.append(
            {
                "kind": OWED_BACK,
                "expense_id": expense.id,
                "group_id": expense.group_id,
                "group_name": (group.name if group else "") or "",
                "name": (group.name if group else "") or expense.name or "Shared bill",
                "description": expense.merchant_name or expense.name or "",
                "amount": round(outstanding, 2),
                "currency": row.currency or "IDR",
                "date": when.isoformat() if when else None,
                "days_outstanding": (today - when).days if when else 0,
            }
        )

    rows.sort(key=lambda r: -r["days_outstanding"])
    return rows


def settled_reimbursements(
    db: Session,
    user_id: int,
) -> List[Dict[str, Any]]:
    """
    The money that has come back from a shared bill.

    These belong on the transfers page, where money that moved between
    accounts is listed, because that is exactly what happened.
    """
    from app.models.split_bill import SplitExpense, SplitGroup
    from app.models.transaction import Transaction

    rows_in = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.split_tx_type == "SPLIT_REIMBURSEMENT",
        )
        .all()
    )
    if not rows_in:
        return []

    expenses = {
        expense.id: expense
        for expense in db.query(SplitExpense)
        .filter(SplitExpense.user_id == user_id)
        .all()
    }
    groups = {
        group.id: group
        for group in db.query(SplitGroup)
        .filter(SplitGroup.owner_id == user_id)
        .all()
    }

    out: List[Dict[str, Any]] = []
    for row in rows_in:
        expense = expenses.get(row.split_expense_id)
        group = groups.get(expense.group_id) if expense else None
        out.append(
            {
                "kind": PAID_BACK,
                "expense_id": row.split_expense_id,
                "group_id": expense.group_id if expense else None,
                "group_name": (group.name if group else "") or "",
                "name": (group.name if group else "") or "Shared bill",
                "description": row.description or "",
                "amount": round(_dec(row.amount), 2),
                "currency": row.currency or "IDR",
                "date": row.date.isoformat() if row.date else None,
                "account_id": row.account_id,
                "transaction_id": row.id,
            }
        )

    out.sort(key=lambda r: r["date"] or "", reverse=True)
    return out
