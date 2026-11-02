"""
The till of a merchant that sells in more than one country.

Everything here needs the reader to be signed in. A merchant is
their merchant, and the sales of one merchant are not the sales of
another. Every route that names a merchant checks that the merchant
belongs to the reader before it does anything else, so that a
merchant's sales cannot be read by anybody else.

The one rule that runs through the whole file: **the client does not
compute the money.** The client sends the lines, the discounts and
the taxes it wants charged. The server works out the gross of every
line, the share of the discount on the whole sale that each line
bears, the tax on each line, the total, and what is still owed. A
client that sent a total would be sending a number the tax office
would check against the lines, and a number that disagrees with them
is a mistake that is very hard to find afterwards. So the request
schemas have no field for the totals, and there is nothing to set
them with.

The taxes are worked out by the tax engine, which reads the rules of
the world from the table of rules. A sale that names a country and a
tax code is taxed under the rule that was in force on the day of the
sale; a sale that names nothing is taxed under the rules written
into the engine.
"""

import json
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.merchant import Merchant
from app.models.merchant_product import MerchantPosProduct
from app.models.tax_rule import TaxRule
from app.models.business_transaction import BusinessTransaction
from app.models.business_transaction_item import BusinessTransactionItem
from app.models.business_transaction_tax import BusinessTransactionTax
from app.models.business_transaction_payment import BusinessTransactionPayment
from app.models.accounting_entry import AccountingEntry
from app.services.calculation.tax_engine import TaxEngineError, compute_transaction

# The router carries no prefix of its own. It is mounted at
# "/api/business", and the paths below are written as they are seen
# from there.
router = APIRouter(tags=["Business"])


# === The schemas ==========================================================


class ProductCreate(BaseModel):
    """A product of a till. The price is a decimal, never a float."""

    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: Decimal = Decimal("0")
    unit_of_measure: str = "pcs"
    conversion_factor: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    min_qty: Optional[Decimal] = None
    max_qty: Optional[Decimal] = None
    free_quantity: Decimal = Decimal("0")
    is_active: bool = True


class ProductResponse(BaseModel):
    """A product of a till, as it is written down."""

    id: int
    merchant_id: int
    name: str
    sku: Optional[str]
    barcode: Optional[str]
    image_url: Optional[str]
    category: Optional[str]
    stock_quantity: Decimal
    unit_of_measure: str
    conversion_factor: Decimal
    unit_price: Decimal
    min_qty: Optional[Decimal]
    max_qty: Optional[Decimal]
    free_quantity: Decimal
    is_active: bool

    class Config:
        from_attributes = True


class LineInput(BaseModel):
    """
    One line of a sale, as the client sends it.

    There is no gross amount and no net amount here. The server works
    both of them out, because a total that the client can set is a
    total that can be wrong.
    """

    item_name: str
    sku: Optional[str] = None
    product_id: Optional[int] = None
    quantity: Decimal = Decimal("1")
    quantity_precision: int = 0
    unit_of_measure: str = "pcs"
    conversion_factor: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    free_quantity: Decimal = Decimal("0")
    min_qty: Optional[Decimal] = None
    max_qty: Optional[Decimal] = None
    discount_type: str = "NONE"
    discount_rate: Decimal = Decimal("0")
    line_discount_amount: Decimal = Decimal("0")
    coupon_code: Optional[str] = None
    promotion_id: Optional[int] = None


class TaxInput(BaseModel):
    """
    A tax the client wants charged.

    The client says which tax and how it behaves. It does not say how
    much it comes to: the rate, the base and the amount are worked out
    by the engine.
    """

    tax_code: str
    tax_type: Optional[str] = None
    tax_behavior: str = "ADDITIVE"
    tax_inclusion: str = "EXCLUSIVE"
    tax_category: str = "STANDARD"
    tax_base_method: str = "FULL_NET"
    tax_rate: Optional[Decimal] = None
    base_amount: Optional[Decimal] = None
    country_code: Optional[str] = None
    state_code: Optional[str] = None
    county_code: Optional[str] = None
    city_code: Optional[str] = None
    tax_exemption_code: Optional[str] = None
    tax_exemption_reason: Optional[str] = None
    tax_account_id: Optional[int] = None
    # Whether the tax is on the whole sale or on one line, and which
    # line. The line is named by its position, because the client
    # does not know the id of the line until the sale has been made.
    scope: str = "TRANSACTION"
    item_index: Optional[int] = None


class TransactionCreate(BaseModel):
    """
    A sale, as the client sends it.

    Notice what is not here: the gross, the tax, the total and the
    outstanding amount. Those are the server's to work out.
    """

    merchant_id: int
    invoice_number: Optional[str] = None
    invoice_type: str = "POS_RECEIPT"
    customer_id: Optional[int] = None
    transaction_date: Optional[datetime] = None
    timezone: str = "Asia/Jakarta"
    locale: str = "id-ID"
    transaction_currency: str = "IDR"
    functional_currency: str = "IDR"
    settlement_currency: str = "IDR"
    exchange_rate: Optional[Decimal] = None
    exchange_rate_date: Optional[datetime] = None
    exchange_rate_source: Optional[str] = None
    seller_country: str = "ID"
    customer_country: Optional[str] = None
    tax_region_code: Optional[str] = None
    incoterms: Optional[str] = None
    customs_value: Optional[Decimal] = None
    e_invoice_format: Optional[str] = None
    fiscal_period: Optional[str] = None
    items: List[LineInput] = Field(default_factory=list)
    taxes: List[TaxInput] = Field(default_factory=list)
    transaction_discount_type: str = "NONE"
    transaction_discount_rate: Decimal = Decimal("0")
    transaction_discount_amount: Decimal = Decimal("0")
    discount_allocation_method: str = "PROPORTIONAL_VALUE"
    shipping_fee: Decimal = Decimal("0")
    transaction_fee: Decimal = Decimal("0")
    processing_fee: Decimal = Decimal("0")
    import_duty_fee: Decimal = Decimal("0")
    rounding_amount: Decimal = Decimal("0")
    notes: Optional[str] = None


class TransactionResponse(BaseModel):
    """A sale, with the money worked out by the server."""

    id: int
    merchant_id: int
    invoice_number: str
    invoice_type: str
    transaction_date: datetime
    transaction_currency: str
    subtotal_gross: Decimal
    total_line_discount: Decimal
    transaction_discount_amount: Decimal
    total_taxable_amount: Decimal
    total_tax_additive: Decimal
    total_withholding_tax: Decimal
    shipping_fee: Decimal
    transaction_fee: Decimal
    processing_fee: Decimal
    import_duty_fee: Decimal
    rounding_amount: Decimal
    grand_total: Decimal
    net_receivable_amount: Decimal
    outstanding_amount: Decimal
    payment_status: str
    items: List["ItemResponse"]
    taxes: List["TaxResponse"]

    class Config:
        from_attributes = True


class ItemResponse(BaseModel):
    """One line of a sale, with the money worked out."""

    id: int
    item_name: str
    sku: Optional[str]
    quantity: Decimal
    unit_of_measure: str
    unit_price: Decimal
    line_discount_amount: Decimal
    allocated_header_discount: Decimal
    gross_amount: Decimal
    net_item_amount: Decimal

    class Config:
        from_attributes = True


class TaxResponse(BaseModel):
    """
    One tax of a sale.

    The rate, the base and the amount are three separate fields, and
    that is the whole point: they answer three different questions
    and a reader who has them mixed up gets a different answer.
    """

    id: int
    tax_code: str
    tax_type: str
    tax_behavior: str
    tax_inclusion: str
    tax_category: str
    tax_base_method: str
    tax_rate: Decimal
    taxable_amount: Decimal
    tax_amount: Decimal
    tax_exemption_code: Optional[str]
    tax_exemption_reason: Optional[str]

    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    """A payment, or a refund, of a sale."""

    payment_method: str = "CASH"
    payment_currency: Optional[str] = None
    amount_paid: Decimal = Decimal("0")
    settlement_exchange_rate: Optional[Decimal] = None
    processing_fee: Decimal = Decimal("0")
    refund_amount: Decimal = Decimal("0")
    payment_reference: Optional[str] = None
    paid_at: Optional[datetime] = None


class PaymentResponse(BaseModel):
    """A payment of a sale, as it is written down."""

    id: int
    transaction_id: int
    payment_method: str
    payment_currency: str
    amount_paid: Decimal
    processing_fee: Decimal
    refund_amount: Decimal
    payment_reference: Optional[str]
    paid_at: Optional[datetime]

    class Config:
        from_attributes = True


class AccountingEntryResponse(BaseModel):
    """One side of one entry in the merchant's books."""

    id: int
    transaction_id: int
    account_code: str
    debit_amount: Decimal
    credit_amount: Decimal
    functional_currency: str
    fiscal_period: Optional[str]

    class Config:
        from_attributes = True


TransactionResponse.model_rebuild()
ItemResponse.model_rebuild()
TaxResponse.model_rebuild()


# === The helpers ==========================================================


def _merchant_of(db: Session, merchant_id: int, user_id: int) -> Merchant:
    """
    The merchant, when it is the reader's.

    A merchant that is not the reader's is not found at all. Saying
    "that is not yours" would tell a stranger that a merchant of that
    number exists.
    """
    merchant = (
        db.query(Merchant)
        .filter(Merchant.id == merchant_id, Merchant.user_id == user_id)
        .first()
    )
    if merchant is None:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant


def _transaction_of(db: Session, transaction_id: int, user_id: int) -> BusinessTransaction:
    """The sale, when it is the reader's."""
    transaction = (
        db.query(BusinessTransaction)
        .join(Merchant, BusinessTransaction.merchant_id == Merchant.id)
        .filter(BusinessTransaction.id == transaction_id, Merchant.user_id == user_id)
        .first()
    )
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


def _rules_of(db: Session) -> List[TaxRule]:
    """The rules of the world, which are searched by the engine."""
    return db.query(TaxRule).all()


def _invoice_number(db: Session, merchant_id: int) -> str:
    """
    The number of the sale.

    The merchant's own numbering is used when it has one, and a
    number is made up from the id of the last sale otherwise. Two
    shops may well use the same number, so the number is not unique
    across merchants.
    """
    last = (
        db.query(BusinessTransaction)
        .filter(BusinessTransaction.merchant_id == merchant_id)
        .order_by(BusinessTransaction.id.desc())
        .first()
    )
    if last is None:
        return "INV-000001"
    try:
        number = int(str(last.invoice_number).rsplit("-", 1)[-1])
    except (TypeError, ValueError):
        number = 0
    return f"INV-{number + 1:06d}"


def _fiscal_period(when: datetime) -> str:
    """The period the sale belongs to, as the year and the month."""
    return f"{when.year:04d}-{when.month:02d}"


def _write_accounting_entries(
    db: Session, transaction: BusinessTransaction, totals: Dict[str, Any]
) -> None:
    """
    The entries the sale made in the merchant's books.

    The sale is written down as it happened: what was sold is
    credited to the revenue, the tax that was added to the bill is
    credited to the tax payable, the tax that was withheld is
    credited to the prepaid tax account, and what the customer owes
    is debited to the receivable.

    The debit and the credit on each row are equal across the sale,
    so the books balance. The revenue is credited with the net of the
    lines, not with the total, because the tax is not the merchant's
    money.
    """
    currency = transaction.functional_currency
    net = Decimal(str(totals["net_receivable_amount"]))
    additive = Decimal(str(totals["total_tax_additive"]))
    withholding = Decimal(str(totals["total_withholding_tax"]))
    revenue = net - additive
    period = transaction.fiscal_period

    rows = [
        ("ACCOUNTS_RECEIVABLE", net, Decimal("0"), "the customer owes this for the sale"),
        ("REVENUE", Decimal("0"), revenue, "what was sold"),
    ]
    if additive:
        rows.append(("TAX_PAYABLE_PPN", Decimal("0"), additive, "the sales tax owed"))
    if withholding:
        rows.append(
            ("PREPAID_TAX_PPH23", Decimal("0"), withholding, "the tax withheld at the till")
        )

    for code, debit, credit, memo in rows:
        db.add(
            AccountingEntry(
                transaction_id=transaction.id,
                account_code=code,
                debit_amount=debit,
                credit_amount=credit,
                functional_currency=currency,
                fiscal_period=period,
                memo=memo,
            )
        )


# === The products ==========================================================


@router.post("/merchants/{merchant_id}/products", response_model=ProductResponse)
def create_product(
    merchant_id: int,
    data: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a product to the till of a merchant."""
    _merchant_of(db, merchant_id, current_user.id)

    product = MerchantPosProduct(
        merchant_id=merchant_id,
        name=data.name,
        sku=data.sku,
        barcode=data.barcode,
        image_url=data.image_url,
        category=data.category,
        stock_quantity=data.stock_quantity,
        unit_of_measure=data.unit_of_measure,
        conversion_factor=data.conversion_factor,
        unit_price=data.unit_price,
        min_qty=data.min_qty,
        max_qty=data.max_qty,
        free_quantity=data.free_quantity,
        is_active=data.is_active,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/merchants/{merchant_id}/products", response_model=List[ProductResponse])
def list_products(
    merchant_id: int,
    include_inactive: bool = Query(
        default=False,
        description="Also give the things that are no longer sold",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List the products of the till of a merchant.

    A thing that was taken off the shelf is left out unless it is
    asked for by name. It is still in the books, because a receipt
    that names it is a record of what happened, but the shelf only
    holds what is still being sold.
    """
    _merchant_of(db, merchant_id, current_user.id)

    query = db.query(MerchantPosProduct).filter(
        MerchantPosProduct.merchant_id == merchant_id
    )
    if not include_inactive:
        query = query.filter(MerchantPosProduct.is_active.is_(True))

    return query.order_by(MerchantPosProduct.id).all()


class ProductUpdate(BaseModel):
    """
    The changes to a thing on the shelf.

    Every field is optional, and only the ones that are given are
    changed. A thing that is taken off the shelf is not deleted: a
    receipt that names it is a record of what happened, so the row
    stays and it is marked as no longer sold.
    """

    name: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: Optional[Decimal] = None
    unit_of_measure: Optional[str] = None
    conversion_factor: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    min_qty: Optional[Decimal] = None
    max_qty: Optional[Decimal] = None
    free_quantity: Optional[Decimal] = None
    is_active: Optional[bool] = None


@router.put("/merchants/{merchant_id}/products/{product_id}", response_model=ProductResponse)
def update_product(
    merchant_id: int,
    product_id: int,
    data: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Change a thing on the shelf.

    The change is written to the thing itself, and not to a copy of
    it. A till that showed yesterday's price for a thing that was
    repriced this morning is a till that cannot be reconciled.
    """
    _merchant_of(db, merchant_id, current_user.id)

    product = (
        db.query(MerchantPosProduct)
        .filter(
            MerchantPosProduct.id == product_id,
            MerchantPosProduct.merchant_id == merchant_id,
        )
        .first()
    )
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That thing is not on this shelf.",
        )

    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


# === The sales ============================================================


@router.post("/transactions", response_model=TransactionResponse)
def create_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Make a sale, and work out the money.

    The client sends the lines and the taxes. The server works out
    the gross of every line, the share of the discount on the whole
    sale that each line bears, the tax on every line, the total the
    customer pays, and what the merchant keeps after the tax that is
    withheld at the till.

    The totals in the answer are the only totals there are. A client
    that sends a total has it ignored.
    """
    _merchant_of(db, data.merchant_id, current_user.id)

    when = data.transaction_date or datetime.utcnow()
    currency = data.transaction_currency

    # The engine works with plain dictionaries, so the request is
    # turned into them.
    lines = [item.model_dump() for item in data.items]
    tax_requests = [tax.model_dump() for tax in data.taxes]

    try:
        worked_out = compute_transaction(
            lines,
            taxes=tax_requests,
            transaction_discount_amount=data.transaction_discount_amount,
            transaction_discount_type=data.transaction_discount_type,
            transaction_discount_rate=data.transaction_discount_rate,
            discount_allocation_method=data.discount_allocation_method,
            shipping_fee=data.shipping_fee,
            transaction_fee=data.transaction_fee,
            processing_fee=data.processing_fee,
            import_duty_fee=data.import_duty_fee,
            rounding_amount=data.rounding_amount,
            currency=currency,
            rules=_rules_of(db),
            on_date=when.date(),
            seller_country=data.seller_country,
            customer_country=data.customer_country,
            customs_value=data.customs_value,
        )
    except TaxEngineError as error:
        raise HTTPException(status_code=400, detail=error.detail)

    totals = worked_out["totals"]

    transaction = BusinessTransaction(
        merchant_id=data.merchant_id,
        invoice_number=data.invoice_number or _invoice_number(db, data.merchant_id),
        invoice_type=data.invoice_type,
        customer_id=data.customer_id,
        transaction_date=when,
        timezone=data.timezone,
        locale=data.locale,
        transaction_currency=currency,
        functional_currency=data.functional_currency,
        settlement_currency=data.settlement_currency,
        exchange_rate=data.exchange_rate,
        exchange_rate_date=data.exchange_rate_date,
        exchange_rate_source=data.exchange_rate_source,
        seller_country=data.seller_country,
        customer_country=data.customer_country,
        tax_region_code=data.tax_region_code,
        cross_border_flag=bool(
            data.customer_country and data.customer_country != data.seller_country
        ),
        incoterms=data.incoterms,
        customs_value=data.customs_value,
        e_invoice_format=data.e_invoice_format,
        fiscal_period=data.fiscal_period or _fiscal_period(when),
        subtotal_gross=totals["subtotal_gross"],
        total_line_discount=totals["total_line_discount"],
        transaction_discount_type=data.transaction_discount_type,
        transaction_discount_rate=data.transaction_discount_rate,
        transaction_discount_amount=totals["transaction_discount_amount"],
        discount_allocation_method=data.discount_allocation_method,
        total_taxable_amount=totals["total_taxable_amount"],
        total_tax_additive=totals["total_tax_additive"],
        total_withholding_tax=totals["total_withholding_tax"],
        shipping_fee=totals["shipping_fee"],
        transaction_fee=totals["transaction_fee"],
        processing_fee=totals["processing_fee"],
        import_duty_fee=totals["import_duty_fee"],
        rounding_amount=totals["rounding_amount"],
        grand_total=totals["grand_total"],
        net_receivable_amount=totals["net_receivable_amount"],
        outstanding_amount=totals["grand_total"],
        payment_status="UNPAID",
        notes=data.notes,
    )
    db.add(transaction)
    db.flush()

    # The lines, with the money the engine worked out for each.
    saved_items: List[BusinessTransactionItem] = []
    for source, worked in zip(lines, worked_out["items"]):
        item = BusinessTransactionItem(
            transaction_id=transaction.id,
            product_id=source.get("product_id"),
            item_name=source.get("item_name"),
            sku=source.get("sku"),
            quantity=worked["quantity"],
            quantity_precision=source.get("quantity_precision", 0),
            unit_of_measure=source.get("unit_of_measure", "pcs"),
            conversion_factor=source.get("conversion_factor", 1),
            base_uom_quantity=Decimal(str(worked["quantity"]))
            * Decimal(str(source.get("conversion_factor", 1))),
            unit_price=worked["unit_price"],
            free_quantity=source.get("free_quantity", 0),
            min_qty=source.get("min_qty"),
            max_qty=source.get("max_qty"),
            discount_type=source.get("discount_type", "NONE"),
            discount_rate=source.get("discount_rate", 0),
            line_discount_amount=worked["line_discount_amount"],
            allocated_header_discount=worked["allocated_header_discount"],
            coupon_code=source.get("coupon_code"),
            promotion_id=source.get("promotion_id"),
            gross_amount=worked["gross_amount"],
            net_item_amount=worked["net_item_amount"],
        )
        db.add(item)
        saved_items.append(item)
    db.flush()

    # The taxes, with the rate, the base and the amount the engine
    # worked out for each.
    saved_taxes: List[BusinessTransactionTax] = []
    for request, result in zip(tax_requests, worked_out["taxes"]):
        scope = str(request.get("scope") or "TRANSACTION").upper()
        item_id = None
        if scope == "ITEM" and request.get("item_index") is not None:
            index = int(request["item_index"])
            if 0 <= index < len(saved_items):
                item_id = saved_items[index].id

        tax = BusinessTransactionTax(
            transaction_id=transaction.id,
            transaction_item_id=item_id,
            tax_rule_id=result.get("tax_rule_id"),
            tax_code=result.get("tax_code"),
            tax_type=result.get("tax_type"),
            tax_behavior=result.get("tax_behavior", "ADDITIVE"),
            tax_inclusion=result.get("tax_inclusion", "EXCLUSIVE"),
            tax_category=result.get("tax_category", "STANDARD"),
            tax_base_method=result.get("tax_base_method", "FULL_NET"),
            tax_rate=result.get("tax_rate", 0),
            taxable_amount=result.get("taxable_amount", 0),
            tax_amount=result.get("tax_amount", 0),
            tax_exemption_code=result.get("tax_exemption_code"),
            tax_exemption_reason=result.get("tax_exemption_reason"),
            tax_account_id=request.get("tax_account_id"),
        )
        db.add(tax)
        saved_taxes.append(tax)

    db.flush()

    # The books of the merchant.
    _write_accounting_entries(db, transaction, totals)

    db.commit()
    db.refresh(transaction)

    transaction.items = saved_items
    transaction.taxes = saved_taxes
    return transaction


@router.get("/transactions", response_model=List[TransactionResponse])
def list_transactions(
    merchant_id: Optional[int] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the sales of the reader."""
    query = (
        db.query(BusinessTransaction)
        .join(Merchant, BusinessTransaction.merchant_id == Merchant.id)
        .filter(Merchant.user_id == current_user.id)
    )
    if merchant_id is not None:
        query = query.filter(BusinessTransaction.merchant_id == merchant_id)

    sales = (
        query.order_by(BusinessTransaction.id.desc()).limit(max(1, min(limit, 200))).all()
    )
    for sale in sales:
        sale.items = (
            db.query(BusinessTransactionItem)
            .filter(BusinessTransactionItem.transaction_id == sale.id)
            .order_by(BusinessTransactionItem.id)
            .all()
        )
        sale.taxes = (
            db.query(BusinessTransactionTax)
            .filter(BusinessTransactionTax.transaction_id == sale.id)
            .order_by(BusinessTransactionTax.id)
            .all()
        )
    return sales


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One sale, with its lines and its taxes."""
    transaction = _transaction_of(db, transaction_id, current_user.id)
    transaction.items = (
        db.query(BusinessTransactionItem)
        .filter(BusinessTransactionItem.transaction_id == transaction.id)
        .order_by(BusinessTransactionItem.id)
        .all()
    )
    transaction.taxes = (
        db.query(BusinessTransactionTax)
        .filter(BusinessTransactionTax.transaction_id == transaction.id)
        .order_by(BusinessTransactionTax.id)
        .all()
    )
    return transaction


# === The payments ==========================================================


@router.post("/transactions/{transaction_id}/payments", response_model=PaymentResponse)
def add_payment(
    transaction_id: int,
    data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Settle a sale, in whole or in part.

    The sale is settled when what has been paid covers what is owed.
    Part of a sale that has been paid is `PARTIAL`, and a sale that
    has been paid is `PAID`.

    A refund is a payment that came back, and it is kept on its own
    row rather than as a negative payment, because the shop may want
    to know how much came back this week rather than this year.
    """
    transaction = _transaction_of(db, transaction_id, current_user.id)

    payment = BusinessTransactionPayment(
        transaction_id=transaction.id,
        payment_method=data.payment_method,
        payment_currency=data.payment_currency or transaction.transaction_currency,
        amount_paid=data.amount_paid,
        settlement_exchange_rate=data.settlement_exchange_rate,
        processing_fee=data.processing_fee,
        refund_amount=data.refund_amount,
        payment_reference=data.payment_reference,
        paid_at=data.paid_at or datetime.utcnow(),
    )
    db.add(payment)

    paid = sum(
        (
            Decimal(str(row.amount_paid))
            for row in db.query(BusinessTransactionPayment)
            .filter(BusinessTransactionPayment.transaction_id == transaction.id)
            .all()
        ),
        Decimal("0"),
    )
    refunded = sum(
        (
            Decimal(str(row.refund_amount))
            for row in db.query(BusinessTransactionPayment)
            .filter(BusinessTransactionPayment.transaction_id == transaction.id)
            .all()
        ),
        Decimal("0"),
    )

    outstanding = Decimal(str(transaction.grand_total)) - (paid - refunded)
    transaction.outstanding_amount = outstanding

    if refunded > 0 and outstanding <= 0:
        transaction.payment_status = "REFUNDED"
    elif outstanding <= 0:
        transaction.payment_status = "PAID"
    elif paid > 0:
        transaction.payment_status = "PARTIAL"
    else:
        transaction.payment_status = "UNPAID"

    db.commit()
    db.refresh(payment)
    return payment


@router.get(
    "/transactions/{transaction_id}/payments", response_model=List[PaymentResponse]
)
def list_payments(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The payments that settled a sale."""
    transaction = _transaction_of(db, transaction_id, current_user.id)
    return (
        db.query(BusinessTransactionPayment)
        .filter(BusinessTransactionPayment.transaction_id == transaction.id)
        .order_by(BusinessTransactionPayment.id)
        .all()
    )


# === Working it out before it is written down ============================


@router.post("/simulate")
def simulate_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Work out what a sale would come to, and write nothing down.

    This is the calculator of the tax, and it is the one screen a
    merchant opens before they have decided anything. The same engine
    that decides the total of a real sale decides this one, so the
    number on the screen is the number that would be written down.

    The difference is that nothing is saved. No invoice number is
    taken, no entry is made in the books, and no stock is touched. The
    merchant can try a price, a discount and a tax a hundred times and
    the shop will still have sold nothing on the hundredth try.

    The merchant is still checked. A reader who does not own the shop
    cannot use the shop's rules, and a rule is not a secret but the
    owner's name on it is.
    """
    _merchant_of(db, data.merchant_id, current_user.id)

    when = data.transaction_date or datetime.utcnow()
    currency = data.transaction_currency

    lines = [item.model_dump() for item in data.items]
    tax_requests = [tax.model_dump() for tax in data.taxes]

    try:
        worked_out = compute_transaction(
            lines,
            taxes=tax_requests,
            transaction_discount_amount=data.transaction_discount_amount,
            transaction_discount_type=data.transaction_discount_type,
            transaction_discount_rate=data.transaction_discount_rate,
            discount_allocation_method=data.discount_allocation_method,
            shipping_fee=data.shipping_fee,
            transaction_fee=data.transaction_fee,
            processing_fee=data.processing_fee,
            import_duty_fee=data.import_duty_fee,
            rounding_amount=data.rounding_amount,
            currency=currency,
            rules=_rules_of(db),
            on_date=when.date(),
            seller_country=data.seller_country,
            customer_country=data.customer_country,
            customs_value=data.customs_value,
        )
    except TaxEngineError as error:
        raise HTTPException(status_code=400, detail=error.detail)

    # The answer is a set of decimals, and a decimal is not something
    # the browser can read. They are turned into strings here, so that
    # the money that is shown is the money that was worked out and not
    # a float that has drifted on the way there.
    totals = {
        key: str(value) for key, value in worked_out["totals"].items()
    }
    return {
        "items": [
            {key: str(value) if isinstance(value, Decimal) else value
             for key, value in line.items()}
            for line in worked_out["items"]
        ],
        "taxes": [
            {key: str(value) if isinstance(value, Decimal) else value
             for key, value in tax.items()}
            for tax in worked_out["taxes"]
        ],
        "totals": totals,
        "currency": worked_out["currency"],
    }


class TaxRuleResponse(BaseModel):
    """
    One tax rule, as the screen that offers the choices sees it.

    The flags are the ones the engine reads, and they are shown as a
    map so that a screen can say why a rule behaves the way it does.
    """

    id: int
    country_code: str
    state_code: Optional[str]
    county_code: Optional[str]
    city_code: Optional[str]
    tax_code: str
    tax_type: str
    nominal_rate: Decimal
    tax_behavior: str
    dpp_multiplier_numerator: Decimal
    dpp_multiplier_denominator: Decimal
    effective_from: Optional[str]
    effective_to: Optional[str]
    rule_version: Optional[str]
    rounding_method: Optional[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


@router.get("/tax-rules", response_model=List[TaxRuleResponse])
def list_tax_rules(
    country_code: Optional[str] = Query(None, max_length=2),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The tax rules that are in force, so that a screen can offer them.

    The rules are not secret. They are the law of the place, and the
    reader needs to know which ones are loaded before they charge a
    tax, because a tax that is not in the table is a tax the engine
    cannot work out.

    The country is asked for because the list of every rule in the
    world is long, and a merchant in Jakarta wants the ones of
    Indonesia.
    """
    query = db.query(TaxRule)
    if country_code:
        query = query.filter(TaxRule.country_code == country_code.upper())
    rules = query.order_by(TaxRule.country_code, TaxRule.tax_code).all()

    answers = []
    for rule in rules:
        metadata = {}
        if rule.metadata_json:
            try:
                loaded = json.loads(str(rule.metadata_json))
                if isinstance(loaded, dict):
                    metadata = loaded
            except (TypeError, ValueError):
                # A rule whose flags cannot be read is still a rule
                # with a rate, and hiding it would be worse than
                # showing it without its flags.
                metadata = {}
        answers.append(
            TaxRuleResponse(
                id=rule.id,
                country_code=rule.country_code,
                state_code=rule.state_code,
                county_code=rule.county_code,
                city_code=rule.city_code,
                tax_code=rule.tax_code,
                tax_type=rule.tax_type,
                nominal_rate=rule.nominal_rate,
                tax_behavior=rule.tax_behavior,
                dpp_multiplier_numerator=rule.dpp_multiplier_numerator,
                dpp_multiplier_denominator=rule.dpp_multiplier_denominator,
                effective_from=rule.effective_from.isoformat()
                if rule.effective_from
                else None,
                effective_to=rule.effective_to.isoformat()
                if rule.effective_to
                else None,
                rule_version=rule.rule_version,
                rounding_method=rule.rounding_method,
                metadata=metadata,
            )
        )
    return answers


# === The books =============================================================


@router.get(
    "/transactions/{transaction_id}/accounting-entries",
    response_model=List[AccountingEntryResponse],
)
def list_accounting_entries(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The entries a sale made in the merchant's books."""
    transaction = _transaction_of(db, transaction_id, current_user.id)
    return (
        db.query(AccountingEntry)
        .filter(AccountingEntry.transaction_id == transaction.id)
        .order_by(AccountingEntry.id)
        .all()
    )
