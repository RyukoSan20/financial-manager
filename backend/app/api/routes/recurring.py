"""Recurring Rule API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.models.recurring import RecurringRule
from app.models.transaction import Transaction
from app.models.account import Account
from app.schemas.recurring import (
    RecurringRuleCreate, RecurringRuleUpdate, RecurringRuleResponse, RecurringRuleWithStats
)

router = APIRouter()


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
        # Add months
        month = from_date.month + interval
        year = from_date.year
        while month > 12:
            month -= 12
            year += 1
        # Handle day overflow (e.g., 31st in shorter months)
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
        return from_date + timedelta(days=30)  # Default to monthly


@router.get("/", response_model=List[RecurringRuleResponse])
def list_recurring_rules(
    active_only: bool = True,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all recurring rules."""
    query = db.query(RecurringRule)
    if active_only:
        query = query.filter(RecurringRule.is_active == True)
    if type:
        query = query.filter(RecurringRule.type == type)
    return query.order_by(RecurringRule.next_occurrence).all()





@router.get("/upcoming")
def get_upcoming_recurring(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db)
):
    """Get upcoming recurring transactions within N days."""
    today = date.today()
    end_date = today + timedelta(days=days)
    
    rules = db.query(RecurringRule).filter(
        RecurringRule.is_active == True,
        RecurringRule.next_occurrence <= end_date
    ).all()
    
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
def get_recurring_rule(rule_id: int, db: Session = Depends(get_db)):
    """Get a single recurring rule."""
    rule = db.query(RecurringRule).filter(RecurringRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    return rule


@router.post("/", response_model=RecurringRuleResponse, status_code=201)
def create_recurring_rule(rule: RecurringRuleCreate, db: Session = Depends(get_db)):
    """Create a new recurring rule."""
    # Validate account
    account = db.query(Account).filter(Account.id == rule.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Calculate next occurrence
    next_occ = calculate_next_occurrence(
        RecurringRule(
            frequency=rule.frequency,
            interval_value=rule.interval_value,
            day_of_month=rule.day_of_month
        ),
        rule.start_date
    )
    
    db_rule = RecurringRule(
        **rule.model_dump(),
        next_occurrence=next_occ
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.put("/{rule_id}", response_model=RecurringRuleResponse)
def update_recurring_rule(
    rule_id: int,
    rule: RecurringRuleUpdate,
    db: Session = Depends(get_db)
):
    """Update a recurring rule."""
    db_rule = db.query(RecurringRule).filter(RecurringRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    
    update_data = rule.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rule, key, value)
    
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
    
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.delete("/{rule_id}", status_code=204)
def delete_recurring_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) a recurring rule."""
    db_rule = db.query(RecurringRule).filter(RecurringRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    
    db_rule.is_active = False
    db.commit()
    return None


@router.post("/{rule_id}/generate")
def generate_transaction_from_rule(rule_id: int, db: Session = Depends(get_db)):
    """Generate a transaction from a recurring rule."""
    db_rule = db.query(RecurringRule).filter(RecurringRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    
    if not db_rule.is_active:
        raise HTTPException(status_code=400, detail="Recurring rule is inactive")
    
    if db_rule.next_occurrence > date.today():
        raise HTTPException(status_code=400, detail="Next occurrence date has not arrived yet")
    
    # Check if end_date has passed
    if db_rule.end_date and db_rule.end_date < date.today():
        db_rule.is_active = False
        db.commit()
        raise HTTPException(status_code=400, detail="Recurring rule has ended")
    
    # Create transaction based on type
    if db_rule.type == "transfer":
        # Create transfer (would need separate logic)
        raise HTTPException(status_code=501, detail="Transfer recurring rules not yet implemented")
    else:
        # Create income or expense transaction
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
def generate_all_due_transactions(db: Session = Depends(get_db)):
    """Generate transactions for all rules with due occurrences."""
    today = date.today()
    
    rules = db.query(RecurringRule).filter(
        RecurringRule.is_active == True,
        RecurringRule.next_occurrence <= today
    ).all()
    
    generated = []
    for rule in rules:
        if rule.end_date and rule.end_date < today:
            rule.is_active = False
            continue
        
        try:
            if rule.type == "transfer":
                continue  # Skip transfers for now
            
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



