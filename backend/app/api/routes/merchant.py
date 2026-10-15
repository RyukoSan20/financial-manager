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

class MerchantUpdate(BaseModel):
    store_name: Optional[str] = None
    business_type: Optional[str] = None
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

    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    price: float
    cost_price: Optional[float] = None
    stock: int = 0
    unit: str = "pcs"

class ProductResponse(BaseModel):
    id: int
    name: str
    sku: Optional[str]
    price: float
    cost_price: Optional[float]
    stock: int
    unit: str
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
        qris_enabled=data.qris_enabled
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
    
    today_sales = sum(t.amount for t in today_txns)
    today_transactions = len(today_txns)
    total_qris = sum(t.amount for t in today_txns if t.payment_method == "QRIS")
    total_cash = sum(t.amount for t in today_txns if t.payment_method == "CASH")
    
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
        unit=data.unit
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
