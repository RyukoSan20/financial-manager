"""Data export routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.debt import Debt
from app.models.recurring import RecurringRule
from app.models.transfer import Transfer

router = APIRouter(tags=["Data"])

# The words that confirm that everything is really to be deleted.
#
# The settings screen asks the reader to type a word in their own
# language, so each language has its own word here. They are all
# accepted, because the server cannot know which one the reader was
# shown, and the reader must not have to switch language to delete
# their data.
DELETE_CONFIRMATION_WORDS = {"HAPUS", "DELETE", "削除"}


@router.get("/export")
def export_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export all user data as JSON."""
    user_id = current_user.id
    
    # Get all user data
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    categories = db.query(Category).filter(Category.user_id == user_id).all()
    transactions = db.query(Transaction).filter(Transaction.user_id == user_id).all()
    budgets = db.query(Budget).filter(Budget.user_id == user_id).all()
    goals = db.query(Goal).filter(Goal.user_id == user_id).all()
    debts = db.query(Debt).filter(Debt.user_id == user_id).all()
    
    # Format export data
    export = {
        "exported_at": datetime.utcnow().isoformat(),
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "default_currency": current_user.default_currency,
        },
        "accounts": [
            {
                "id": a.id,
                "name": a.name,
                "type": a.account_type,
                "balance": float(a.balance),
                "currency": a.currency,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in accounts
        ],
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "icon": c.icon,
                "color": c.color,
                "is_active": c.is_active,
            }
            for c in categories
        ],
        "transactions": [
            {
                "id": t.id,
                "type": t.type,
                "amount": float(t.amount),
                "currency": t.currency,
                "description": t.description,
                "date": t.date.isoformat() if t.date else None,
                "account_id": t.account_id,
                "category_id": t.category_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transactions
        ],
        "budgets": [
            {
                "id": b.id,
                "name": b.name,
                "amount": float(b.amount),
                "period": b.period,
                "start_date": b.start_date.isoformat() if b.start_date else None,
                "end_date": b.end_date.isoformat() if b.end_date else None,
                "is_active": b.is_active,
            }
            for b in budgets
        ],
        "goals": [
            {
                "id": g.id,
                "name": g.name,
                "target_amount": float(g.target_amount),
                "current_amount": float(g.current_amount),
                "target_date": g.target_date.isoformat() if g.target_date else None,
                "goal_type": g.goal_type,
                "is_completed": g.is_completed,
            }
            for g in goals
        ],
        "debts": [
            {
                "id": d.id,
                "name": d.name,
                "principal": float(d.principal),
                "current_balance": float(d.current_balance),
                "interest_rate": float(d.interest_rate),
                "tenor_months": d.tenor_months,
                "monthly_payment": float(d.monthly_payment) if d.monthly_payment else None,
                "is_paid_off": d.is_paid_off,
            }
            for d in debts
        ],
        "summary": {
            "total_accounts": len(accounts),
            "total_transactions": len(transactions),
            "total_budgets": len(budgets),
            "total_goals": len(goals),
            "total_debts": len(debts),
        }
    }
    
    return export


@router.get("/export/csv")
def export_transactions_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export transactions as CSV format."""
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(Transaction.date.desc()).all()
    
    # Generate CSV
    csv_lines = ["Date,Type,Amount,Currency,Description,Account,Category"]
    
    for t in transactions:
        account = db.query(Account).filter(Account.id == t.account_id).first()
        category = db.query(Category).filter(Category.id == t.category_id).first()
        
        line = f"{t.date},{t.type},{t.amount},{t.currency},{t.description or ''},{account.name if account else ''},{category.name if category else ''}"
        csv_lines.append(line)
    
    csv_content = "\n".join(csv_lines)
    
    return {
        "filename": f"finmanager_transactions_{datetime.utcnow().strftime('%Y%m%d')}.csv",
        "content": csv_content,
    }


@router.get("/export/studio")
def export_studio_preview(
    start_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    types: Optional[str] = Query(default=None, description="Comma separated"),
    account_id: Optional[int] = Query(default=None),
    category_id: Optional[int] = Query(default=None),
    columns: Optional[str] = Query(default=None, description="Comma separated"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    What the export would be, before the reader downloads it.

    The preview and the download are made by the same code, so the
    reader sees the file they are about to get - not an idea of it.
    The answer says how many transactions match and what they add up
    to, and shows the first few rows.
    """
    from app.services.export_service import export_payload

    start = _read_date(start_date)
    end = _read_date(end_date)

    payload = export_payload(
        db,
        current_user.id,
        start_date=start,
        end_date=end,
        types=_read_list(types),
        account_id=account_id,
        category_id=category_id,
        columns=_read_list(columns),
    )

    # The transactions themselves are not part of the answer - the
    # rows are, and they are what the preview shows.
    payload.pop("transactions", None)

    return {
        "count": payload["count"],
        "total": payload["total"],
        "total_income": payload["total_income"],
        "columns": payload["columns"],
        "column_labels": payload["column_labels"],
        "preview": payload["rows"][:3],
    }


@router.get("/export/studio/csv")
def export_studio_csv(
    start_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    types: Optional[str] = Query(default=None, description="Comma separated"),
    account_id: Optional[int] = Query(default=None),
    category_id: Optional[int] = Query(default=None),
    columns: Optional[str] = Query(default=None, description="Comma separated"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    The export, as a CSV file.

    The bytes start with a byte order mark, so that Excel on Windows
    reads the accented letters as letters and not as question marks.
    """
    from app.services.export_service import csv_with_bom, export_payload, filename_for

    start = _read_date(start_date)
    end = _read_date(end_date)

    payload = export_payload(
        db,
        current_user.id,
        start_date=start,
        end_date=end,
        types=_read_list(types),
        account_id=account_id,
        category_id=category_id,
        columns=_read_list(columns),
    )

    content = csv_with_bom(payload["columns"], payload["rows"])

    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename_for("transaksi", start, end)}"'
            )
        },
    )


@router.get("/export/studio/json")
def export_studio_json(
    start_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    types: Optional[str] = Query(default=None, description="Comma separated"),
    account_id: Optional[int] = Query(default=None),
    category_id: Optional[int] = Query(default=None),
    columns: Optional[str] = Query(default=None, description="Comma separated"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    The export, as JSON.

    The full backup of the reader's own transactions: every field they
    chose, in the order they chose it, and nothing that belongs to
    anybody else.
    """
    from app.services.export_service import export_payload

    start = _read_date(start_date)
    end = _read_date(end_date)

    payload = export_payload(
        db,
        current_user.id,
        start_date=start,
        end_date=end,
        types=_read_list(types),
        account_id=account_id,
        category_id=category_id,
        columns=_read_list(columns),
    )

    payload.pop("transactions", None)

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "period": {
            "start": start.isoformat() if start else None,
            "end": end.isoformat() if end else None,
        },
        "count": payload["count"],
        "total": payload["total"],
        "total_income": payload["total_income"],
        "columns": payload["columns"],
        "transactions": payload["rows"],
    }


def _read_date(value: Optional[str]):
    """A date the reader gave, if it is one."""
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _read_list(value: Optional[str]):
    """A list the reader gave, if it is one."""
    if not value:
        return None
    items = [part.strip() for part in str(value).split(",") if part.strip()]
    return items or None


@router.delete("/delete-all")
def delete_all_user_data(
    confirm: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete ALL user data. This action is irreversible.

    The browser asks for confirmation before it calls this, but the
    browser is not the thing that has to be protected: a request that
    arrives without the right confirmation is refused here as well.
    Without that, a stray call, a retry, or a link that was followed
    by accident would wipe everything with no way back.

    The word to confirm with is the one the screen already asks for.
    It is compared without regard to case and without regard to the
    spaces around it, because the reader types it by hand.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "confirmation_required",
                "message": "This request needs the confirmation word.",
            },
        )

    if confirm.strip().upper() not in DELETE_CONFIRMATION_WORDS:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "confirmation_wrong",
                "message": "That is not the confirmation word.",
            },
        )

    try:
        user_id = current_user.id
        
        # Delete in order (respecting foreign keys)
        # 1. Delete transactions first (they reference accounts)
        db.query(Transaction).filter(Transaction.user_id == user_id).delete(synchronize_session=False)
        
        # 2. Delete recurring rules
        db.query(RecurringRule).filter(RecurringRule.user_id == user_id).delete(synchronize_session=False)
        
        # 3. Delete transfers
        db.query(Transfer).filter(Transfer.user_id == user_id).delete(synchronize_session=False)
        
        # 4. Delete debts
        db.query(Debt).filter(Debt.user_id == user_id).delete(synchronize_session=False)
        
        # 5. Delete goals
        db.query(Goal).filter(Goal.user_id == user_id).delete(synchronize_session=False)
        
        # 6. Delete budgets
        db.query(Budget).filter(Budget.user_id == user_id).delete(synchronize_session=False)
        
        # 7. Delete accounts (balances will be lost)
        db.query(Account).filter(Account.user_id == user_id).delete(synchronize_session=False)
        
        # 8. Delete user-created categories
        db.query(Category).filter(Category.user_id == user_id).delete(synchronize_session=False)
        
        db.commit()
        
        return {"message": "All user data has been deleted successfully", "success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete data: {str(e)}")
