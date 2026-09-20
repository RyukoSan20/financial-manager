"""Debt and debt payment models for loan management."""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Debt(Base):
    __tablename__ = "debts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Loan details
    debt_type = Column(String(50), nullable=False)  # personal_loan, mortgage, car_loan, credit_card, student_loan, other
    principal = Column(Numeric(20, 2), nullable=False)  # Original loan amount
    current_balance = Column(Numeric(20, 2), nullable=False)  # Remaining balance
    interest_rate = Column(Numeric(10, 4), nullable=False)  # Annual interest rate (as decimal, e.g., 0.12 for 12%)
    currency = Column(String(10), default="IDR", nullable=False)
    
    # Loan terms
    tenor_months = Column(Integer, nullable=False)  # Total loan term
    remaining_months = Column(Integer, nullable=False)  # Remaining installments
    monthly_payment = Column(Numeric(20, 2), nullable=False)  # Fixed monthly payment
    
    # Dates
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)  # Final payment date
    next_payment_date = Column(Date, nullable=True)
    
    # Account linkage
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)  # Account where payments are made from
    
    # Status
    is_paid_off = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Lender info
    lender_name = Column(String(100), nullable=True)
    lender_contact = Column(String(255), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="debts")
    payments = relationship("DebtPayment", back_populates="debt", order_by="desc(DebtPayment.payment_date)")


class DebtPayment(Base):
    __tablename__ = "debt_payments"

    id = Column(Integer, primary_key=True, index=True)
    debt_id = Column(Integer, ForeignKey("debts.id"), nullable=False)
    
    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(10), default="IDR", nullable=False)
    payment_date = Column(Date, nullable=False)
    
    # Breakdown
    principal_portion = Column(Numeric(20, 2), nullable=False)
    interest_portion = Column(Numeric(20, 2), nullable=False)
    remaining_balance_after = Column(Numeric(20, 2), nullable=False)  # Balance after this payment
    
    # Payment method
    payment_method = Column(String(50), nullable=True)  # auto_debit, manual, etc.
    notes = Column(Text, nullable=True)
    
    # Link to transaction
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    debt = relationship("Debt", back_populates="payments")
    transaction = relationship("Transaction")
