"""Auto-generate transactions from recurring rules."""

from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.recurring import RecurringRule
from app.models.transaction import Transaction
from app.models.account import Account
from app.core.database import SessionLocal


def calculate_next_occurrence(rule: RecurringRule, from_date: date = None) -> date:
    """Calculate next occurrence date based on frequency."""
    from datetime import timedelta
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


def process_due_recurring_rules():
    """
    Process all due recurring rules and auto-generate transactions.
    This should be called by a cron job (e.g., every hour or daily).
    Returns: dict with processed count and results
    """
    db = SessionLocal()
    results = {
        "processed": 0,
        "created": 0,
        "errors": 0,
        "details": []
    }
    
    try:
        today = date.today()
        
        # Get all active recurring rules that are due (next_occurrence <= today)
        due_rules = db.query(RecurringRule).filter(
            RecurringRule.is_active == True,
            RecurringRule.next_occurrence <= today
        ).all()
        
        results["processed"] = len(due_rules)
        
        for rule in due_rules:
            try:
                # Check if account exists and belongs to user
                if not rule.account_id:
                    results["details"].append(f"Rule {rule.id}: No account assigned, skipping")
                    continue
                    
                account = db.query(Account).filter(
                    Account.id == rule.account_id,
                    Account.user_id == rule.user_id
                ).first()
                
                if not account:
                    results["details"].append(f"Rule {rule.id}: Account not found, skipping")
                    continue
                
                # Check if transaction already exists for this rule + date
                # Use a marker in notes to identify auto-generated transactions
                existing = db.query(Transaction).filter(
                    Transaction.user_id == rule.user_id,
                    Transaction.notes.like(f"%[Recurring:{rule.id}]%"),
                    Transaction.date == today
                ).first()
                
                if existing:
                    results["details"].append(f"Rule {rule.id}: Transaction already exists for today")
                else:
                    # Determine transaction type and adjust amount
                    amount = Decimal(str(rule.amount))
                    
                    if rule.type == "expense":
                        # Expense decreases account balance
                        account.balance -= amount
                        transaction_type = "expense"
                    elif rule.type == "income":
                        # Income increases account balance
                        account.balance += amount
                        transaction_type = "income"
                    elif rule.type == "transfer":
                        # Transfer: expense from source, income to destination
                        account.balance -= amount
                        transaction_type = "expense"
                        
                        # Handle destination account
                        if rule.to_account_id:
                            to_account = db.query(Account).filter(
                                Account.id == rule.to_account_id,
                                Account.user_id == rule.user_id
                            ).first()
                            if to_account:
                                to_account.balance += amount
                    else:
                        transaction_type = "expense"
                    
                    # Create transaction
                    transaction = Transaction(
                        user_id=rule.user_id,
                        account_id=rule.account_id,
                        category_id=rule.category_id,
                        amount=amount,
                        type=transaction_type,
                        description=rule.description or "Recurring transaction",
                        notes=f"{rule.notes or ''} [Recurring:{rule.id}]".strip(),
                        date=today,
                        auto_generated=True
                    )
                    db.add(transaction)
                    
                    # For transfers, also create the income transaction
                    if rule.type == "transfer" and rule.to_account_id:
                        income_transaction = Transaction(
                            user_id=rule.user_id,
                            account_id=rule.to_account_id,
                            category_id=rule.category_id,
                            amount=amount,
                            type="income",
                            description=f"Transfer from {account.name}",
                            notes=f"{rule.notes or ''} [Recurring:{rule.id}]".strip(),
                            date=today,
                            auto_generated=True
                        )
                        db.add(income_transaction)
                    
                    # Update next_occurrence
                    rule.next_occurrence = calculate_next_occurrence(rule, today)
                    
                    db.commit()
                    results["created"] += 1
                    results["details"].append(
                        f"Rule {rule.id}: Created transaction {amount} {rule.type} - next: {rule.next_occurrence}"
                    )
                    
            except Exception as e:
                results["errors"] += 1
                results["details"].append(f"Rule {rule.id}: Error - {str(e)}")
                db.rollback()
        
    except Exception as e:
        results["error"] = str(e)
    finally:
        db.close()
    
    return results


def generate_single_rule(rule_id: int):
    """Process a single recurring rule (for manual trigger)."""
    db = SessionLocal()
    try:
        rule = db.query(RecurringRule).filter(RecurringRule.id == rule_id).first()
        if not rule:
            return {"error": "Rule not found"}
        
        # Temporarily set next_occurrence to today to trigger processing
        original_next = rule.next_occurrence
        rule.next_occurrence = date.today()
        db.commit()
        
        # Process
        result = process_due_recurring_rules()
        
        # Restore if not processed
        if rule.next_occurrence == date.today():
            rule.next_occurrence = original_next
            db.commit()
            
        return result
        
    finally:
        db.close()
