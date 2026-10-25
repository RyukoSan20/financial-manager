"""Recurring Rule API routes with multi-tenancy."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.services.currency_rules import assert_record_currency
from app.core.security import get_current_user_optional, get_current_user
from app.models.recurring import RecurringRule
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.user import User
from app.schemas.recurring import (
    RecurringRuleCreate, RecurringRuleUpdate, RecurringRuleResponse, RecurringRuleWithStats
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Fix redirect to HTTPS
@router.get("", include_in_schema=False)
def redirect_to_slash():
    return RedirectResponse(url="/api/recurring/", status_code=308)

def calculate_next_occurrence(rule: RecurringRule, from_date: date = None) -> date:
    """Calculate next occurrence date based on frequency."""
    if from_date is None:
        from_date = date.today()
    
    freq = rule.frequency
    interval = rule.interval_value
    
    if freq == "daily":
        return from_date + timedelta(days=interval)
    elif freq == "weekly":
        return from_date + timedelta(weeks=interval)
    elif freq == "biweekly":
        return from_date + timedelta(weeks=2 * interval)
    elif freq == "monthly":
        month = from_date.month + interval
        year = from_date.year
        while month > 12:
            month -= 12
            year += 1
        day = min(from_date.day, [31, 29 if year % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
        return date(year, month, day)
    elif freq == "quarterly":
        return calculate_next_occurrence(
            RecurringRule(frequency="monthly", interval_value=3 * interval, day_of_month=rule.day_of_month),
            from_date
        )
    elif freq == "yearly":
        return date(from_date.year + interval, from_date.month, from_date.day)
    else:
        return from_date + timedelta(days=30)


@router.get("/", response_model=List[RecurringRuleResponse])
def list_recurring_rules(
    active_only: bool = True,
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all recurring rules for current user."""
    query = db.query(RecurringRule)
    if active_only:
        query = query.filter(RecurringRule.is_active == True)
    if type:
        query = query.filter(RecurringRule.type == type)
    
    if current_user:
        query = query.filter(RecurringRule.user_id == current_user.id)
    
    return query.order_by(RecurringRule.next_occurrence).all()


@router.get("/upcoming")
def get_upcoming_recurring(
    days: int = Query(default=7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get upcoming recurring transactions within N days."""
    today = date.today()
    end_date = today + timedelta(days=days)
    
    query = db.query(RecurringRule).filter(
        RecurringRule.is_active == True,
        RecurringRule.next_occurrence <= end_date
    )
    
    if current_user:
        query = query.filter(RecurringRule.user_id == current_user.id)
    
    rules = query.all()
    
    upcoming = []
    for rule in rules:
        upcoming.append({
            "rule_id": rule.id,
            "description": rule.description,
            "amount": rule.amount,
            "type": rule.type,
            "frequency": rule.frequency,
            "next_date": rule.next_occurrence,
            "account_id": rule.account_id,
        })
    
    upcoming.sort(key=lambda x: x["next_date"])
    return {"upcoming": upcoming, "count": len(upcoming)}


@router.get("/{rule_id}", response_model=RecurringRuleResponse)
def get_recurring_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single recurring rule."""
    rule = db.query(RecurringRule).filter(RecurringRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    
    # Ownership check
    if rule.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return rule


@router.post("/", response_model=RecurringRuleResponse, status_code=201)
def create_recurring_rule(
    rule: RecurringRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new recurring rule."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Validate account
    account = db.query(Account).filter(Account.id == rule.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Account ownership check
    if account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot create rule for another user's account")
    
    # Calculate next occurrence
    from datetime import date as date_type
    start = rule.start_date or date_type.today()
    next_occ = calculate_next_occurrence(
        RecurringRule(
            frequency=rule.frequency,
            interval_value=rule.interval_value,
            day_of_month=rule.day_of_month
        ),
        start
    )
    
    rule_data = rule.model_dump(exclude={'next_occurrence'})
    rule_data["user_id"] = current_user.id
    # Ensure start_date has a value
    if not rule_data.get("start_date"):
        rule_data["start_date"] = start
    
    # items steers the breakdown, it is not a column.
    rule_items = rule_data.pop("items", None)

    # A record lives in the currency of the account it belongs to. A
    # record that names a different currency is refused, so a recurring
    # rule in dollars can never run against a rupiah account.
    if rule_data.get("account_id"):
        _account = db.query(Account).filter(Account.id == rule_data["account_id"]).first()
        if _account and _account.user_id == current_user.id:
            rule_data["currency"] = assert_record_currency(rule_data.get("currency"), _account)

    db_rule = RecurringRule(
        **rule_data,
        next_occurrence=next_occ
    )
    db.add(db_rule)
    try:
        db.flush()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Data aturan berulang tidak valid: {exc}")

    # A recurring rule is one payment that happens again and again.
    # When the rule covers more than the headline number - the rent plus
    # the electricity, the subscription plus the insurance - the parts are
    # worked out so the rule can be read line by line.
    try:
        from app.services.breakdown_service import set_breakdown
        from app.services.transaction_breakdown import expand_transaction

        amount = float(rule_data.get("amount") or 0)
        if rule_items:
            set_breakdown(
                db, current_user.id, "recurring", db_rule.id, rule_items, replace=True
            )
        elif amount > 0 and rule_data.get("type") == "expense":
            expansion = expand_transaction(
                message=rule_data.get("name") or "Recurring",
                amount=amount,
                merchant=rule_data.get("merchant_name"),
            )
            lines = expansion.get("lines") or []
            if lines:
                set_breakdown(
                    db,
                    current_user.id,
                    "recurring",
                    db_rule.id,
                    [
                        {
                            "name": line.get("name"),
                            "quantity": 1,
                            "unit_price": line.get("amount", 0),
                            "total_price": line.get("amount", 0),
                            "category": line.get("category"),
                            "kind": "expense",
                            "source": expansion.get("source", "template"),
                            "is_estimated": True,
                        }
                        for line in lines
                    ],
                    replace=True,
                )
    except Exception as exc:  # noqa: BLE001 - the rule still gets saved
        logger.warning("Could not attach the recurring breakdown: %s", exc)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"Could not create the recurring rule: {exc}")
        raise HTTPException(
            status_code=400, detail=f"Data transaksi rutin tidak valid: {exc}"
        )
    db.refresh(db_rule)
    return db_rule


@router.put("/{rule_id}", response_model=RecurringRuleResponse)
def update_recurring_rule(
    rule_id: int,
    rule: RecurringRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a recurring rule."""
    db_rule = db.query(RecurringRule).filter(RecurringRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    
    # Ownership check
    if db_rule.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = rule.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rule, key, value)

    # The start date is required by the database, so a rule that somehow
    # lost it gets today's date rather than failing the request.
    if not db_rule.start_date:
        db_rule.start_date = date.today()

    # Recalculate next occurrence if frequency changed
    if "frequency" in update_data or "interval_value" in update_data:
        db_rule.next_occurrence = calculate_next_occurrence(
            RecurringRule(
                frequency=db_rule.frequency,
                interval_value=db_rule.interval_value,
                day_of_month=db_rule.day_of_month
            ),
            date.today()
        )

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"Could not update the recurring rule: {exc}")
        raise HTTPException(
            status_code=400, detail=f"Data transaksi rutin tidak valid: {exc}"
        )
    db.refresh(db_rule)
    return db_rule


@router.delete("/{rule_id}", status_code=204)
def delete_recurring_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete (deactivate) a recurring rule."""
    db_rule = db.query(RecurringRule).filter(RecurringRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    
    # Ownership check
    if db_rule.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db_rule.is_active = False
    db.commit()
    return None


@router.post("/{rule_id}/generate")
def generate_transaction_from_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a transaction from a recurring rule."""
    db_rule = db.query(RecurringRule).filter(RecurringRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    
    # Ownership check
    if db_rule.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not db_rule.is_active:
        raise HTTPException(status_code=400, detail="Recurring rule is inactive")
    
    if db_rule.next_occurrence > date.today():
        raise HTTPException(status_code=400, detail="Next occurrence date has not arrived yet")
    
    if db_rule.end_date and db_rule.end_date < date.today():
        db_rule.is_active = False
        db.commit()
        raise HTTPException(status_code=400, detail="Recurring rule has ended")
    
    # Create transaction based on type
    if db_rule.type == "transfer":
        raise HTTPException(status_code=501, detail="Transfer recurring rules not yet implemented")
    else:
        tx_type = "income" if db_rule.type == "income" else "expense"
        
        tx = Transaction(
            type=tx_type,
            amount=db_rule.amount,
            currency=db_rule.currency,
            date=db_rule.next_occurrence,
            description=db_rule.description,
            notes=f"Auto-generated from recurring rule #{db_rule.id}",
            account_id=db_rule.account_id,
            category_id=db_rule.category_id,
            recurring_rule_id=db_rule.id,
            is_recurring=True,
            user_id=db_rule.user_id,
        )
        db.add(tx)
        
        # Update account balance
        account = db.query(Account).filter(Account.id == db_rule.account_id).first()
        if account:
            if tx_type == "income":
                account.balance += db_rule.amount
            else:
                account.balance -= db_rule.amount
        
        # Update next occurrence
        db_rule.next_occurrence = calculate_next_occurrence(
            RecurringRule(
                frequency=db_rule.frequency,
                interval_value=db_rule.interval_value,
                day_of_month=db_rule.day_of_month
            ),
            db_rule.next_occurrence
        )
        
        db.commit()
        db.refresh(tx)
        
        return {
            "message": "Transaction generated successfully",
            "transaction_id": tx.id,
            "next_occurrence": db_rule.next_occurrence
        }


@router.post("/generate-all")
def generate_all_due_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate transactions for all rules with due occurrences."""
    today = date.today()
    
    query = db.query(RecurringRule).filter(
        RecurringRule.is_active == True,
        RecurringRule.next_occurrence <= today
    )
    
    if current_user:
        query = query.filter(RecurringRule.user_id == current_user.id)
    
    rules = query.all()
    
    generated = []
    for rule in rules:
        if rule.end_date and rule.end_date < today:
            rule.is_active = False
            continue
        
        try:
            if rule.type == "transfer":
                continue
            
            tx_type = "income" if rule.type == "income" else "expense"
            
            tx = Transaction(
                type=tx_type,
                amount=rule.amount,
                currency=rule.currency,
                date=rule.next_occurrence,
                description=rule.description,
                notes=f"Auto-generated from recurring rule #{rule.id}",
                account_id=rule.account_id,
                category_id=rule.category_id,
                recurring_rule_id=rule.id,
                is_recurring=True,
                user_id=rule.user_id,
            )
            db.add(tx)
            
            # Update balance
            account = db.query(Account).filter(Account.id == rule.account_id).first()
            if account:
                if tx_type == "income":
                    account.balance += rule.amount
                else:
                    account.balance -= rule.amount
            
            # Update next occurrence
            rule.next_occurrence = calculate_next_occurrence(
                RecurringRule(
                    frequency=rule.frequency,
                    interval_value=rule.interval_value,
                    day_of_month=rule.day_of_month
                ),
                rule.next_occurrence
            )
            
            generated.append({
                "rule_id": rule.id,
                "description": rule.description,
                "amount": rule.amount,
                "date": rule.next_occurrence
            })
        except Exception as e:
            generated.append({
                "rule_id": rule.id,
                "error": str(e)
            })
    
    db.commit()
    
    return {
        "generated_count": len([g for g in generated if "transaction_id" not in g]),
        "results": generated
    }
