"""Debt API routes with multi-tenancy."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.models.debt import Debt, DebtPayment
from app.models.user import User
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


@router.post("/", response_model=DebtResponse, status_code=201)
def create_debt(
    debt: DebtCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new debt."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    debt_data = debt.model_dump()
    debt_data["user_id"] = current_user.id
    
    db_debt = Debt(**debt_data)
    db.add(db_debt)
    db.commit()
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
    
    db.commit()
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
    db_debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not db_debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    # Ownership check
    if db_debt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create payment record
    db_payment = DebtPayment(
        debt_id=debt_id,
        amount=payment.amount,
        currency=payment.currency,
        payment_date=payment.payment_date,
        principal_portion=payment.principal_portion,
        interest_portion=payment.interest_portion,
        remaining_balance_after=payment.remaining_balance_after,
        payment_method=payment.payment_method,
        notes=payment.notes,
        transaction_id=payment.transaction_id,
    )
    db.add(db_payment)
    
    # Update debt balance
    db_debt.current_balance = payment.remaining_balance_after
    db_debt.remaining_months = max(0, db_debt.remaining_months - 1)
    
    # Calculate next payment date
    if db_debt.remaining_months > 0:
        db_debt.next_payment_date = payment.payment_date + timedelta(days=30)
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
