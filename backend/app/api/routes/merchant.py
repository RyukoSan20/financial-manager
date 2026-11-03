"""Merchant API routes for store/POS management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.merchant import Merchant, MerchantProduct, DailySettlement, BusinessType, SettlementStatus
from app.models.merchant_business_profile import MerchantBusinessProfile
from app.services.business_profile_service import (
    describe_profiles,
    get_profile,
    normalise_profile,
)
from app.models.transaction import Transaction
from app.models.account import Account

router = APIRouter(prefix="/merchant", tags=["Merchant"])


# === Pydantic Schemas ===

class MerchantCreate(BaseModel):
    store_name: str
    business_type: str = BusinessType.OTHER.value
    store_phone: Optional[str] = None
    store_address: Optional[str] = None
    qris_merchant_id: Optional[str] = None
    qris_enabled: bool = False
    # Which kind of shop this is. A warung if not told.
    business_profile: str = "UMKM"


class BusinessProfileSettings(BaseModel):
    """The settings of one shop, for the mode it runs in."""

    invoice_prefix: Optional[str] = None
    payment_terms_days: Optional[int] = None
    default_invoice_type: Optional[str] = None
    transaction_currency: Optional[str] = None
    functional_currency: Optional[str] = None
    settlement_currency: Optional[str] = None
    default_exchange_rate: Optional[float] = None
    exchange_rate_source: Optional[str] = None
    seller_country: Optional[str] = None
    default_tax_region: Optional[str] = None
    revenue_account_code: Optional[str] = None
    cogs_account_code: Optional[str] = None
    tax_payable_account_code: Optional[str] = None
    withholding_account_code: Optional[str] = None
    receivable_account_code: Optional[str] = None
    auto_post_journal: bool = False


class BusinessProfileResponse(BaseModel):
    """What the browser needs to draw this shop's screens."""

    merchant_id: int
    profile: str
    capabilities: dict
    settings: BusinessProfileSettings = BusinessProfileSettings()

class MerchantUpdate(BaseModel):
    store_name: Optional[str] = None
    business_type: Optional[str] = None
    # Which kind of shop this is. A shop may change its mode, and the
    # name is read the way a person would write it.
    business_profile: Optional[str] = None
    store_phone: Optional[str] = None
    store_address: Optional[str] = None
    qris_merchant_id: Optional[str] = None
    qris_enabled: Optional[bool] = None
    auto_settlement: Optional[bool] = None
    settlement_time: Optional[str] = None

class MerchantResponse(BaseModel):
    id: int
    store_name: str
    business_type: str
    store_phone: Optional[str]
    store_address: Optional[str]
    qris_enabled: bool
    is_active: bool
    created_at: datetime
    # Which kind of shop this is, so the browser does not have to
    # remember it in a place of its own.
    business_profile: str = "UMKM"

    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    price: float
    cost_price: Optional[float] = None
    stock: int = 0
    unit: str = "pcs"
    # The photograph of the thing. It is never asked for.
    image_url: Optional[str] = None

class ProductResponse(BaseModel):
    id: int
    name: str
    sku: Optional[str]
    price: float
    cost_price: Optional[float]
    stock: int
    unit: str
    image_url: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class QuickSaleRequest(BaseModel):
    merchant_id: int
    amount: float
    payment_method: str  # QRIS, CASH, EDC, TRANSFER
    description: Optional[str] = None
    reference_number: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD

class MerchantSummaryResponse(BaseModel):
    merchant_id: int
    store_name: str
    today_sales: float
    today_transactions: int
    total_qris: float
    total_cash: float
    gross_profit: float
    pending_settlement: Optional[dict] = None


# === Merchant CRUD ===

@router.post("/", response_model=MerchantResponse)
def create_merchant(
    data: MerchantCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Register a new merchant/store."""
    merchant = Merchant(
        user_id=current_user.id,
        store_name=data.store_name,
        business_type=data.business_type,
        store_phone=data.store_phone,
        store_address=data.store_address,
        qris_merchant_id=data.qris_merchant_id,
        qris_enabled=data.qris_enabled,
        business_profile=normalise_profile(data.business_profile)
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    return merchant


@router.get("/", response_model=List[MerchantResponse])
def list_merchants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all merchants for current user."""
    merchants = db.query(Merchant).filter(
        Merchant.user_id == current_user.id,
        Merchant.is_active == True
    ).all()
    return merchants


# The three kinds of shop are listed before the route that reads one
# shop by its number, because a route that takes a name and a route
# that takes a number would otherwise be confused for each other.
@router.get("/profiles")
def list_business_profiles(
    current_user: User = Depends(get_current_user),
):
    """
    The three kinds of shop, and what each of them is asked for.

    This is held here in one place, so that the browser does not keep
    a copy of the rules and drift from them.
    """
    return {"profiles": describe_profiles()}


@router.get("/{merchant_id}", response_model=MerchantResponse)
def get_merchant(
    merchant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get merchant details."""
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant


@router.put("/{merchant_id}", response_model=MerchantResponse)
def update_merchant(
    merchant_id: int,
    data: MerchantUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update merchant details."""
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "business_profile":
            # A shop may change its mode. The name is read the way a
            # person would write it, so an unknown one is a warung
            # rather than an error that stops the shop working.
            value = normalise_profile(value)
        setattr(merchant, key, value)
    
    db.commit()
    db.refresh(merchant)
    return merchant


@router.delete("/{merchant_id}")
def delete_merchant(
    merchant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete merchant."""
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    merchant.is_active = False
    db.commit()
    return {"message": "Merchant deleted"}


# === The kind of shop this is ===

def _get_own_merchant(merchant_id: int, current_user: User, db: Session) -> Merchant:
    """The shop, if it is this reader's shop."""
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant


@router.get("/{merchant_id}/profile", response_model=BusinessProfileResponse)
def get_business_profile(
    merchant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    What this shop is, and what it is therefore asked for.
    """
    merchant = _get_own_merchant(merchant_id, current_user, db)
    profile_key = normalise_profile(merchant.business_profile)
    capabilities = get_profile(profile_key)

    settings_row = db.query(MerchantBusinessProfile).filter(
        MerchantBusinessProfile.merchant_id == merchant_id
    ).first()

    settings = BusinessProfileSettings()
    if settings_row:
        for field in BusinessProfileSettings.model_fields:
            setattr(settings, field, getattr(settings_row, field))

    return BusinessProfileResponse(
        merchant_id=merchant_id,
        profile=profile_key,
        capabilities={
            "profile": capabilities.profile,
            "label_key": capabilities.label_key,
            "description_key": capabilities.description_key,
            "default_country": capabilities.default_country,
            "default_currency": capabilities.default_currency,
            "functional_currency": capabilities.functional_currency,
            "default_invoice_type": capabilities.default_invoice_type,
            "allowed_invoice_types": list(capabilities.allowed_invoice_types),
            "tax_codes": list(capabilities.tax_codes),
            "fields": {
                name: {
                    "shown": bool(getattr(capabilities, f"show_{name}", False)),
                    "required": name in capabilities.required_fields,
                }
                for name in (
                    "invoice_number",
                    "payment_terms",
                    "customer_fields",
                    "customs_fields",
                    "incoterms",
                    "multi_currency",
                    "tax_settings",
                    "journal",
                    "withholding_tax",
                    "reverse_charge",
                )
            },
        },
        settings=settings,
    )


@router.put("/{merchant_id}/profile", response_model=BusinessProfileResponse)
def update_business_profile(
    merchant_id: int,
    data: BusinessProfileSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    The settings of this shop, for the mode it runs in.

    A warung does not need to have a row here. If it has one, it is
    kept; if it does not, one is made the first time a setting is
    saved.
    """
    merchant = _get_own_merchant(merchant_id, current_user, db)

    settings_row = db.query(MerchantBusinessProfile).filter(
        MerchantBusinessProfile.merchant_id == merchant_id
    ).first()
    if not settings_row:
        settings_row = MerchantBusinessProfile(merchant_id=merchant_id)
        db.add(settings_row)

    for field, value in data.model_dump().items():
        setattr(settings_row, field, value)
    settings_row.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(settings_row)

    capabilities = get_profile(normalise_profile(merchant.business_profile))
    return BusinessProfileResponse(
        merchant_id=merchant_id,
        profile=normalise_profile(merchant.business_profile),
        capabilities={
            "profile": capabilities.profile,
            "label_key": capabilities.label_key,
            "description_key": capabilities.description_key,
            "default_country": capabilities.default_country,
            "default_currency": capabilities.default_currency,
            "functional_currency": capabilities.functional_currency,
            "default_invoice_type": capabilities.default_invoice_type,
            "allowed_invoice_types": list(capabilities.allowed_invoice_types),
            "tax_codes": list(capabilities.tax_codes),
            "fields": {
                name: {
                    "shown": bool(getattr(capabilities, f"show_{name}", False)),
                    "required": name in capabilities.required_fields,
                }
                for name in (
                    "invoice_number",
                    "payment_terms",
                    "customer_fields",
                    "customs_fields",
                    "incoterms",
                    "multi_currency",
                    "tax_settings",
                    "journal",
                    "withholding_tax",
                    "reverse_charge",
                )
            },
        },
        settings=data,
    )


# === Merchant Summary ===

@router.get("/{merchant_id}/summary", response_model=MerchantSummaryResponse)
def get_merchant_summary(
    merchant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get daily summary for merchant."""
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    today = date.today().isoformat()

    # --- the sales made through the till ---------------------------------
    #
    # The till writes its sales into `business_transactions`, which is
    # where the lines of a sale and the tax on them live. The older
    # table of the reader's own money is read as well, because a
    # reader who wrote a sale down by hand has still made a sale.
    #
    # Before this, only the older table was read, so a shop could sell
    # all morning and the dashboard would say it had made nothing.
    from app.models.business_transaction import BusinessTransaction
    from app.models.business_transaction_payment import BusinessTransactionPayment

    till_sales = (
        db.query(BusinessTransaction)
        .filter(BusinessTransaction.merchant_id == merchant_id)
        .all()
    )
    today_till_sales = [
        sale
        for sale in till_sales
        if (sale.transaction_date.date().isoformat() if sale.transaction_date else "") == today
    ]

    # The money that was actually handed over, and how it was handed
    # over. A sale with no payment against it has been made but not
    # yet paid, so its total counts towards the sales and not towards
    # the cash or the QRIS.
    payments = (
        db.query(BusinessTransactionPayment)
        .join(
            BusinessTransaction,
            BusinessTransactionPayment.transaction_id == BusinessTransaction.id,
        )
        .filter(BusinessTransaction.merchant_id == merchant_id)
        .all()
    )
    today_sale_ids = {sale.id for sale in today_till_sales}
    today_payments = [
        payment for payment in payments if payment.transaction_id in today_sale_ids
    ]

    # Get today's transactions
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.merchant_id == merchant_id,
        Transaction.is_merchant == True,
        Transaction.is_deleted == False,
        Transaction.type == "income"
    ).all()
    
    # Filter today's
    today_txns = [t for t in transactions if str(t.date) == today]
    
    till_total = sum((sale.net_receivable_amount or sale.grand_total or 0) for sale in today_till_sales)
    hand_total = sum(t.amount for t in today_txns)

    today_sales = till_total + hand_total
    today_transactions = len(today_till_sales) + len(today_txns)

    total_qris = sum(
        (payment.amount_paid or 0)
        for payment in today_payments
        if payment.payment_method == "QRIS"
    ) + sum(t.amount for t in today_txns if t.payment_method == "QRIS")
    total_cash = sum(
        (payment.amount_paid or 0)
        for payment in today_payments
        if payment.payment_method == "CASH"
    ) + sum(t.amount for t in today_txns if t.payment_method == "CASH")
    
    # Calculate gross profit (need cost data)
    gross_profit = today_sales  # Simplified
    
    # Check pending settlement
    settlement = db.query(DailySettlement).filter(
        DailySettlement.merchant_id == merchant_id,
        DailySettlement.date == today,
        DailySettlement.status == SettlementStatus.PENDING.value
    ).first()
    
    pending = None
    if settlement:
        pending = {
            "total_sales": settlement.total_sales,
            "net_profit": settlement.net_profit
        }
    
    return MerchantSummaryResponse(
        merchant_id=merchant_id,
        store_name=merchant.store_name,
        today_sales=today_sales,
        today_transactions=today_transactions,
        total_qris=total_qris,
        total_cash=total_cash,
        gross_profit=gross_profit,
        pending_settlement=pending
    )


# === Quick Sale (POS) ===

@router.post("/quick-sale")
def quick_sale(
    data: QuickSaleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Quick sale entry - like POS cashier."""
    # Verify merchant belongs to user
    merchant = db.query(Merchant).filter(
        Merchant.id == data.merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Get default sales account for this merchant
    account_id = merchant.default_sales_account_id
    if not account_id:
        # Fallback to first active account
        account = db.query(Account).filter(
            Account.user_id == current_user.id,
            Account.is_active == True
        ).first()
        if not account:
            raise HTTPException(status_code=400, detail="No account found")
        account_id = account.id
    
    # Get default sales category
    from app.models.category import Category
    category = db.query(Category).filter(
        Category.user_id == current_user.id,
        Category.type == "income",
        Category.is_active == True
    ).first()
    
    if not category:
        # Try default system category
        category = db.query(Category).filter(
            Category.user_id == None,
            Category.type == "income",
            Category.is_active == True
        ).first()
    
    # Create transaction
    trans_date = datetime.strptime(data.date, "%Y-%m-%d").date() if data.date else date.today()
    
    transaction = Transaction(
        user_id=current_user.id,
        account_id=account_id,
        category_id=category.id if category else None,
        type="income",
        amount=data.amount,
        description=data.description or f"Penjualan {merchant.store_name}",
        date=trans_date,
        is_merchant=True,
        merchant_id=merchant.id,
        payment_method=data.payment_method,
        reference_number=data.reference_number,
        source="pos_quick"
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return {
        "success": True,
        "transaction_id": transaction.id,
        "amount": float(transaction.amount),
        "payment_method": transaction.payment_method,
        "message": f"Penjualan Rp {data.amount:,.0f} tercatat"
    }


# === Products ===

@router.post("/{merchant_id}/products", response_model=ProductResponse)
def add_product(
    merchant_id: int,
    data: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add product to merchant catalog."""
    # Verify merchant
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    product = MerchantProduct(
        merchant_id=merchant_id,
        name=data.name,
        sku=data.sku,
        price=data.price,
        cost_price=data.cost_price,
        stock=data.stock,
        unit=data.unit,
        image_url=data.image_url
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/{merchant_id}/products", response_model=List[ProductResponse])
def list_products(
    merchant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List products for merchant."""
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    products = db.query(MerchantProduct).filter(
        MerchantProduct.merchant_id == merchant_id,
        MerchantProduct.is_active == True
    ).all()
    return products


# === Daily Settlement ===

@router.post("/{merchant_id}/daily-settlement")
def create_daily_settlement(
    merchant_id: int,
    transfer_amount: float = 0,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create daily settlement record."""
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    today = date.today().isoformat()
    
    # Check if settlement already exists
    existing = db.query(DailySettlement).filter(
        DailySettlement.merchant_id == merchant_id,
        DailySettlement.date == today
    ).first()
    
    if existing:
        return {"message": "Settlement already exists for today", "settlement_id": existing.id}
    
    # Get today's transactions
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.merchant_id == merchant_id,
        Transaction.is_merchant == True,
        Transaction.is_deleted == False,
        Transaction.type == "income"
    ).all()
    
    today_txns = [t for t in transactions if str(t.date) == today]
    
    total_sales = sum(float(t.amount) for t in today_txns)
    total_qris = sum(float(t.amount) for t in today_txns if t.payment_method == "QRIS")
    total_cash = sum(float(t.amount) for t in today_txns if t.payment_method == "CASH")
    total_edc = sum(float(t.amount) for t in today_txns if t.payment_method == "EDC")
    
    # Create settlement
    settlement = DailySettlement(
        merchant_id=merchant_id,
        date=today,
        total_sales=total_sales,
        total_qris_sales=total_qris,
        total_cash_sales=total_cash,
        total_edc_sales=total_edc,
        net_profit=total_sales,  # Simplified
        transfer_to_personal=transfer_amount,
        status=SettlementStatus.PENDING.value,
        notes=notes
    )
    
    db.add(settlement)
    db.commit()
    db.refresh(settlement)
    
    return {
        "success": True,
        "settlement_id": settlement.id,
        "total_sales": total_sales,
        "total_qris": total_qris,
        "total_cash": total_cash,
        "total_transactions": len(today_txns),
        "message": f"Rekap harian {merchant.store_name} selesai"
    }


@router.get("/{merchant_id}/settlements")
def list_settlements(
    merchant_id: int,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List daily settlements."""
    merchant = db.query(Merchant).filter(
        Merchant.id == merchant_id,
        Merchant.user_id == current_user.id
    ).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    settlements = db.query(DailySettlement).filter(
        DailySettlement.merchant_id == merchant_id
    ).order_by(DailySettlement.date.desc()).limit(limit).all()
    
    return settlements
