"""Debt API routes with multi-tenancy."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta
from decimal import Decimal

from datetime import date as date_type

from app.core.database import get_db
from app.services.currency_rules import assert_record_currency
from app.core.security import get_current_user_optional, get_current_user
from app.models.debt import Debt, DebtPayment
from app.models.user import User
from app.models.account import Account
from app.schemas.debt import (
    DebtCreate, DebtUpdate, DebtResponse, DebtWithProgress,
    DebtPaymentCreate, DebtPaymentResponse, DebtAmortizationEntry, DebtAmortizationSchedule
)
from app.services.calculation.formulas import (
    calculate_loan_payment,
    generate_amortization_schedule,
    calculate_debt_progress,
    calculate_total_debt_summary
)
from app.services.calculation.formulas import AmortizationResult

router = APIRouter()
logger = logging.getLogger(__name__)

# Fix redirect to HTTPS
@router.get("", include_in_schema=False)
def redirect_to_slash():
    return RedirectResponse(url="/api/debts/", status_code=308)

# Fix redirect to HTTPS
@router.get("/summary", include_in_schema=False)
def redirect_summary_to_slash():
    return RedirectResponse(url="/api/debts/summary/", status_code=308)

@router.get("/", response_model=List[DebtWithProgress])
def list_debts(
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all debts with calculated progress."""
    query = db.query(Debt)
    if active_only:
        query = query.filter(Debt.is_active == True, Debt.is_paid_off == False)
    
    if current_user:
        query = query.filter(Debt.user_id == current_user.id)
    
    debts = query.order_by(Debt.next_payment_date).all()
    result = []
    
    for debt in debts:
        progress = calculate_debt_progress(debt.principal, debt.current_balance)
        
        # Get total paid
        payments = db.query(DebtPayment).filter(
            DebtPayment.debt_id == debt.id
        ).all()
        total_paid = sum(p.amount for p in payments)
        total_interest = sum(p.interest_portion for p in payments)
        total_principal_paid = sum(p.principal_portion for p in payments)
        
        status = "active"
        if debt.is_paid_off:
            status = "paid_off"
        elif debt.next_payment_date and debt.next_payment_date <= date.today():
            status = "upcoming"
        
        result.append(DebtWithProgress(
            id=debt.id,
            name=debt.name,
            description=debt.description,
            debt_type=debt.debt_type,
            principal=debt.principal,
            current_balance=debt.current_balance,
            interest_rate=debt.interest_rate,
            currency=debt.currency,
            tenor_months=debt.tenor_months,
            remaining_months=debt.remaining_months,
            monthly_payment=debt.monthly_payment,
            start_date=debt.start_date,
            end_date=debt.end_date,
            next_payment_date=debt.next_payment_date,
            account_id=debt.account_id,
            lender_name=debt.lender_name,
            lender_contact=debt.lender_contact,
            is_paid_off=debt.is_paid_off,
            is_active=debt.is_active,
            created_at=debt.created_at,
            updated_at=debt.updated_at,
            progress_percent=float(progress.value),
            total_paid=total_paid,
            total_interest_paid=total_interest,
            total_principal_paid=total_principal_paid,
            original_principal=debt.principal,
            upcoming_payment_date=debt.next_payment_date,
            upcoming_payment_amount=debt.monthly_payment if debt.next_payment_date else None,
            status=status,
        ))
    
    return result


@router.get("/{debt_id}", response_model=DebtWithProgress)
def get_debt(
    debt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single debt with progress."""
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Ownership check
    if debt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    progress = calculate_debt_progress(debt.principal, debt.current_balance)
    
    payments = db.query(DebtPayment).filter(
        DebtPayment.debt_id == debt.id
    ).all()
    total_paid = sum(p.amount for p in payments)
    total_interest = sum(p.interest_portion for p in payments)
    total_principal = sum(p.principal_portion for p in payments)
    
    status = "active"
    if debt.is_paid_off:
        status = "paid_off"
    elif debt.next_payment_date and debt.next_payment_date <= date.today():
        status = "upcoming"
    
    return DebtWithProgress(
        id=debt.id,
        name=debt.name,
        description=debt.description,
        debt_type=debt.debt_type,
        principal=debt.principal,
        current_balance=debt.current_balance,
        interest_rate=debt.interest_rate,
        currency=debt.currency,
        tenor_months=debt.tenor_months,
        remaining_months=debt.remaining_months,
        monthly_payment=debt.monthly_payment,
        start_date=debt.start_date,
        end_date=debt.end_date,
        next_payment_date=debt.next_payment_date,
        account_id=debt.account_id,
        lender_name=debt.lender_name,
        lender_contact=debt.lender_contact,
        is_paid_off=debt.is_paid_off,
        is_active=debt.is_active,
        created_at=debt.created_at,
        updated_at=debt.updated_at,
        progress_percent=float(progress.value),
        total_paid=total_paid,
        total_interest_paid=total_interest,
        total_principal_paid=total_principal,
        original_principal=debt.principal,
        upcoming_payment_date=debt.next_payment_date,
        upcoming_payment_amount=debt.monthly_payment if debt.next_payment_date else None,
        status=status,
    )


def _add_months(start, months):
    """
    The date that is `months` after `start`.

    The day of the month is clamped to the last day of the target month,
    so 31 January plus one month is the end of February, not the 3rd of
    March.
    """
    from calendar import monthrange

    total = start.month - 1 + months
    year = start.year + total // 12
    month = total % 12 + 1
    day = min(start.day, monthrange(year, month)[1])
    return date_type(year, month, day)


@router.post("/", response_model=DebtResponse, status_code=201)
def create_debt(
    debt: DebtCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new debt."""
    debt_data = debt.model_dump()
    debt_data["user_id"] = current_user.id

    from datetime import date as date_type

    # The start date defaults to today.
    if not debt_data.get("start_date"):
        debt_data["start_date"] = date_type.today()

    # The final payment date is required by the database. It is worked
    # out from the term when the caller did not give one, so a debt can
    # be created with only a principal.
    term = debt_data.get("tenor_months") or 12
    if not debt_data.get("end_date"):
        start = debt_data["start_date"]
        if isinstance(start, str):
            start = date_type.fromisoformat(start)
        debt_data["end_date"] = _add_months(start, term)

    # Calculate remaining_months if not provided
    if not debt_data.get("remaining_months"):
        start = debt_data["start_date"]
        if isinstance(start, str):
            start = date_type.fromisoformat(start)
        months_diff = (date_type.today().year - start.year) * 12 + (
            date_type.today().month - start.month
        )
        debt_data["remaining_months"] = max(0, term - months_diff)

    # Set default current_balance to principal if not provided
    if not debt_data.get("current_balance"):
        debt_data["current_balance"] = debt_data["principal"]

    # The next payment date defaults to the start date.
    if not debt_data.get("next_payment_date"):
        debt_data["next_payment_date"] = debt_data["start_date"]

    # The monthly instalment is required by the database. When the caller
    # did not work it out, it is derived from the principal, the annual
    # interest rate and the term, using the standard amortised payment
    # formula. A zero interest loan is simply the principal spread over
    # the term.
    if not debt_data.get("monthly_payment"):
        principal = float(debt_data["principal"])
        rate = float(debt_data.get("interest_rate") or 0)
        months = term or 1
        if rate > 0:
            monthly_rate = rate / 12
            factor = (1 + monthly_rate) ** months
            payment = principal * monthly_rate * factor / (factor - 1)
        else:
            payment = principal / months
        debt_data["monthly_payment"] = round(payment, 2)

    # items steers the breakdown, it is not a column.
    debt_items = debt_data.pop("items", None)


    # A record lives in the currency of the account it belongs to. A
    # record that names a different currency is refused, so a goal in
    # dollars can never be counted against a rupiah account.
    if debt_data.get("account_id"):
        _account = db.query(Account).filter(Account.id == debt_data["account_id"]).first()
        if _account and _account.user_id == current_user.id:
            debt_data["currency"] = assert_record_currency(debt_data.get("currency"), _account)
    db_debt = Debt(**debt_data)
    db.add(db_debt)
    try:
        db.flush()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Data hutang tidak valid: {exc}")

    # A debt is not one number. It is the part that comes back to the
    # lender and the part that is the cost of borrowing. The split is
    # worked out from the principal, the term and the interest rate.
    try:
        from app.services.breakdown_service import set_breakdown

        if debt_items:
            set_breakdown(
                db, current_user.id, "debt", db_debt.id, debt_items, replace=True
            )
        else:
            principal = float(debt_data.get("principal") or 0)
            rate = float(debt_data.get("interest_rate") or 0)
            months = int(debt_data.get("tenor_months") or 1)
            if principal > 0 and months > 0:
                payment = float(debt_data.get("monthly_payment") or 0)
                total_paid = payment * months if payment else principal
                interest_total = max(0.0, total_paid - principal)
                lines = [
                    {
                        "name": "Pokok pinjaman",
                        "quantity": 1,
                        "unit_price": principal,
                        "total_price": principal,
                        "category": "other",
                        "kind": "expense",
                        "source": "rule",
                        "is_estimated": False,
                    }
                ]
                if interest_total > 0:
                    lines.append(
                        {
                            "name": "Bunga pinjaman",
                            "quantity": 1,
                            "unit_price": round(interest_total, 2),
                            "total_price": round(interest_total, 2),
                            "category": "other",
                            "kind": "expense",
                            "source": "rule",
                            "is_estimated": False,
                        }
                    )
                set_breakdown(
                    db, current_user.id, "debt", db_debt.id, lines, replace=True
                )
    except Exception as exc:  # noqa: BLE001 - the debt still gets saved
        logger.warning("Could not attach the debt breakdown: %s", exc)

    try:
        db.commit()
    except Exception as exc:
        # Without the rollback the session stays broken and the next
        # request on the same connection fails with a reset.
        db.rollback()
        logger.error(f"Could not create the debt: {exc}")
        raise HTTPException(
            status_code=400,
            detail=f"Data utang tidak valid: {exc}",
        )
    db.refresh(db_debt)
    return db_debt


@router.put("/{debt_id}", response_model=DebtResponse)
def update_debt(
    debt_id: int,
    debt: DebtUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a debt."""
    db_debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not db_debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Ownership check
    if db_debt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = debt.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_debt, key, value)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"Could not update the debt: {exc}")
        raise HTTPException(
            status_code=400,
            detail=f"Data utang tidak valid: {exc}",
        )
    db.refresh(db_debt)
    return db_debt


@router.delete("/{debt_id}", status_code=204)
def delete_debt(
    debt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete (deactivate) a debt."""
    db_debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not db_debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Ownership check
    if db_debt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db_debt.is_active = False
    db.commit()
    return None


# === Debt Payments ===

@router.post("/{debt_id}/payment", response_model=DebtPaymentResponse)
def add_payment(
    debt_id: int,
    payment: DebtPaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a debt payment."""
    from decimal import Decimal
    from datetime import date, timedelta
    
    db_debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not db_debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Ownership check
    if db_debt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Use defaults for None values
    amount = Decimal(str(payment.amount)) if payment.amount else Decimal("0")
    currency = payment.currency or "IDR"
    payment_date = payment.payment_date
    if isinstance(payment_date, str) and payment_date:
        try:
            payment_date = date.fromisoformat(payment_date)
        except:
            payment_date = date.today()
    elif not payment_date:
        payment_date = date.today()
    
    # Create payment record with defaults for nullable fields
    db_payment = DebtPayment(
        debt_id=debt_id,
        amount=amount,
        currency=currency,
        payment_date=payment_date,
        principal_portion=payment.principal_portion if payment.principal_portion else amount,
        interest_portion=payment.interest_portion if payment.interest_portion else Decimal("0"),
        remaining_balance_after=payment.remaining_balance_after if payment.remaining_balance_after else (db_debt.current_balance - amount),
        payment_method=payment.payment_method or "cash",
        notes=payment.notes,
        transaction_id=payment.transaction_id,
    )
    db.add(db_payment)
    
    # Update debt balance
    if payment.remaining_balance_after is not None:
        try:
            db_debt.current_balance = Decimal(str(payment.remaining_balance_after))
        except:
            db_debt.current_balance -= amount
    else:
        db_debt.current_balance -= amount
    
    # Calculate remaining months
    remaining_months = db_debt.remaining_months or 0
    if remaining_months > 0:
        db_debt.remaining_months = remaining_months - 1
    
    # Calculate next payment date
    if db_debt.remaining_months and db_debt.remaining_months > 0:
        db_debt.next_payment_date = payment_date + timedelta(days=30)
    else:
        db_debt.next_payment_date = None
        db_debt.is_paid_off = True
    
    db.commit()
    db.refresh(db_payment)
    return db_payment


@router.get("/{debt_id}/payments", response_model=List[DebtPaymentResponse])
def list_payments(
    debt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all payments for a debt."""
    db_debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not db_debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Ownership check
    if db_debt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    payments = db.query(DebtPayment).filter(
        DebtPayment.debt_id == debt_id
    ).order_by(DebtPayment.payment_date.desc()).all()
    return payments


@router.get("/{debt_id}/schedule", response_model=DebtAmortizationSchedule)
def get_amortization_schedule(
    debt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get amortization schedule for a debt."""
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Ownership check
    if debt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Generate schedule
    schedule_entries = generate_amortization_schedule(
        debt.current_balance,
        debt.interest_rate,
        debt.remaining_months
    )
    
    # Calculate payment dates
    current_date = debt.next_payment_date or date.today()
    
    schedule = []
    for entry in schedule_entries:
        payment_date = current_date + timedelta(days=30 * (entry.month - 1))
        schedule.append(DebtAmortizationEntry(
            month=entry.month,
            payment_date=payment_date,
            payment=entry.payment,
            principal=entry.principal,
            interest=entry.interest,
            balance=entry.balance
        ))
    
    total_interest = sum(s.interest for s in schedule)
    total_payment = sum(s.payment for s in schedule)
    
    return DebtAmortizationSchedule(
        debt_id=debt.id,
        debt_name=debt.name,
        principal=debt.current_balance,
        interest_rate=debt.interest_rate,
        tenor_months=debt.remaining_months,
        monthly_payment=debt.monthly_payment,
        total_interest=total_interest,
        total_payment=total_payment,
        schedule=schedule
    )


# === Summary ===

@router.get("/summary/all")
def get_debts_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get overall debts summary."""
    query = db.query(Debt).filter(Debt.is_active == True, Debt.is_paid_off == False)
    
    if current_user:
        query = query.filter(Debt.user_id == current_user.id)
    
    debts = query.all()
    
    if not debts:
        return {
            "total_debts": 0,
            "total_outstanding": Decimal("0"),
            "total_monthly_payment": Decimal("0"),
            "total_remaining_months": 0,
        }
    
    debts_list = [
        {
            "name": d.name,
            "balance": d.current_balance,
            "monthly_payment": d.monthly_payment,
            "remaining_months": d.remaining_months,
            "interest_rate": d.interest_rate,
        }
        for d in debts
    ]
    
    summary = calculate_total_debt_summary(debts_list)
    
    # Get upcoming payments
    upcoming = []
    for debt in debts:
        if debt.next_payment_date:
            upcoming.append({
                "debt_id": debt.id,
                "debt_name": debt.name,
                "amount": debt.monthly_payment,
                "due_date": debt.next_payment_date,
            })
    
    upcoming.sort(key=lambda x: x["due_date"])
    
    return {
        **summary,
        "upcoming_payments": upcoming[:5],
        "next_payment_date": upcoming[0]["due_date"] if upcoming else None,
    }
