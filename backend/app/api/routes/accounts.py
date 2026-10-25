"""Account API routes with multi-tenancy."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_optional
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse
from app.services.currency import converter, SUPPORTED, BASE
from app.services.account_kinds import account_options, default_account_name
from app.services.currency_rules import refuse_currency_change

router = APIRouter()


@router.get("/", response_model=List[AccountResponse])
def list_accounts(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all accounts for current user (or all if not authenticated)."""
    query = db.query(Account)
    if current_user:
        query = query.filter(Account.user_id == current_user.id)
    accounts = query.offset(skip).limit(limit).all()
    return accounts


@router.get("/kinds/{currency}")
async def get_account_kinds(currency: str):
    """The kinds of holding there are for a currency.

    The names and the banks follow the currency, because a rupiah
    savings account and a yen savings account are not the same thing.
    """
    code = (currency or "IDR").upper()
    if code not in SUPPORTED:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {code}")
    return {
        "currency": code,
        "options": account_options(code),
    }


@router.get("/summary/total-balance")
async def get_total_balance(
    current_user: User = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
    display_currency: str = "IDR",
    currency: Optional[str] = None,
):
    """Get the total balance across all active accounts.

    The accounts do not all have to hold the same currency, so the
    raw numbers cannot simply be added up. The balance of each account
    is converted into the currency that is being shown, using a live
    rate, and the result is broken down by the currency it came from.

    When a rate cannot be fetched, the account is left out of the total
    and listed under `unconverted`, so the number on the screen is
    never a mixture of converted and unconverted money.
    """
    query = db.query(Account).filter(Account.is_active == True)
    if current_user:
        query = query.filter(Account.user_id == current_user.id)
    accounts = query.all()

    # The caller may say which currency to show in either name. The
    # one in the query string wins, because that is the one the
    # reader asked for.
    target = (currency or display_currency or "IDR").upper()
    rates = await converter.get_rates("IDR")

    total = 0.0
    by_currency = {}
    unconverted = []
    converted_count = 0

    for account in accounts:
        currency = (account.currency or "IDR").upper()
        balance = float(account.balance or 0)
        by_currency[currency] = round(by_currency.get(currency, 0.0) + balance, 2)

        if currency == target:
            total += balance
            converted_count += 1
            continue

        # The table reads "units of X for one unit of the base", and
        # the base is IDR. So one unit of this currency is worth
        # 1 / rate rupiah. The balance is held in this currency, so
        # the figure in rupiah is balance / rate.
        rate = rates.rates.get(currency)
        if rate is None or rate == 0:
            unconverted.append({
                "account_id": account.id,
                "account_name": account.name,
                "currency": currency,
                "balance": balance,
            })
            continue

        # The target is the currency being shown, so the rate from the
        # base to the target is what turns a rupiah figure into a
        # target figure.
        to_target = await converter.rate(BASE, target)
        if to_target is None:
            unconverted.append({
                "account_id": account.id,
                "account_name": account.name,
                "currency": currency,
                "balance": balance,
            })
            continue

        # balance is in `currency`. Turn it into the base first, then
        # into the target.
        in_base = balance / rate
        total += in_base * to_target
        converted_count += 1

    return {
        "total_balance": round(total, 2),
        "currency": target,
        "account_count": len(accounts),
        "converted_account_count": converted_count,
        "by_currency": by_currency,
        "unconverted": unconverted,
        "rates_as_of": rates.as_of,
        "rates_source": rates.source,
    }


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get account by ID with ownership check."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Ownership check
    if current_user and account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return account


@router.post("/", response_model=AccountResponse, status_code=201)
def create_account(
    account: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new account. Requires authentication.

    The account holds one currency. The kind of holding and the place
    it is held at follow from that currency, so a rupiah savings
    account is not the same thing as a yen savings account.
    """
    account_data = account.model_dump()
    account_data["user_id"] = current_user.id

    currency = (account_data.get("currency") or "IDR").upper()
    account_data["currency"] = currency
    kind = account_data.get("account_type")

    # The name of the holding follows the currency, unless the reader
    # gave a name of their own.
    if not account_data.get("name") or account_data["name"] == kind:
        account_data["name"] = default_account_name(kind, currency)
    if not account_data.get("account_kind"):
        account_data["account_kind"] = kind

    db_account = Account(**account_data)
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    account: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update account with ownership check. Requires authentication."""
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Ownership check
    if db_account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = account.model_dump(exclude_unset=True)

    # The currency of an account cannot be changed while it holds
    # money. The way to move money into another currency is to make an
    # account in that currency and transfer into it, so the rate is on
    # record.
    if "currency" in update_data:
        requested = (update_data["currency"] or "IDR").upper()
        current = (db_account.currency or "IDR").upper()
        if requested != current:
            refuse_currency_change(current, requested)

    for key, value in update_data.items():
        setattr(db_account, key, value)

    db.commit()
    db.refresh(db_account)
    return db_account


@router.delete("/{account_id}", status_code=200)
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete account with ownership check.
    Uses soft delete (is_active=False) to preserve transaction history.
    Requires authentication.
    """
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Ownership check
    if db_account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if account has transactions
    from app.models.transaction import Transaction
    tx_count = db.query(Transaction).filter(Transaction.account_id == account_id).count()
    
    if tx_count > 0:
        # Soft delete - mark as inactive instead of hard delete
        db_account.is_active = False
        db.commit()
        return {
            "status": "success",
            "message": f"Account marked as inactive (has {tx_count} transactions). Hard delete requires reassigning transactions first.",
            "deleted": False,
            "soft_deleted": True
        }
    else:
        # Safe to hard delete - no transactions
        db.delete(db_account)
        db.commit()
        return {
            "status": "success",
            "message": "Account deleted permanently",
            "deleted": True,
            "soft_deleted": False
        }
