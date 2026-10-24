"""
The catalogue API: the shops the user buys at, and the products in them.

This is where the user arranges the things the system learned by itself.
A merchant the receipt scanner named on its own has a category and an
icon that the system guessed. The user can change both, and the change
has to stick: the next receipt from that shop should be filed the way
the user said.

The icons themselves come from `icon_catalog`, which holds the whole
list with the keywords that let the system suggest one for a shop it
has never seen.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.catalog_icon import CatalogIcon
from app.models.merchant_catalog import MerchantCatalog, UserProduct
from app.models.user import User
from app.services.icon_catalog import (
    ALL_ICONS,
    ICON_GROUPS,
    is_valid_icon,
    suggest_icon,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Catalog"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class IconEntry(BaseModel):
    value: str
    label: str
    group: str
    group_label: str
    keywords: List[str] = Field(default_factory=list)


class IconGroup(BaseModel):
    id: str
    label: str
    icons: List[IconEntry]


class CatalogMerchant(BaseModel):
    id: int
    name: str
    merchant_type: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    address: Optional[str] = None
    scan_count: int = 0
    total_spent: float = 0
    product_count: int = 0
    last_seen_at: Optional[str] = None
    created_at: Optional[str] = None


class CatalogMerchantUpdate(BaseModel):
    name: Optional[str] = None
    merchant_type: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    address: Optional[str] = None


class CatalogProduct(BaseModel):
    id: int
    name: str
    canonical_name: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    typical_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    purchase_count: int = 0
    last_seen_at: Optional[str] = None


class CatalogProductUpdate(BaseModel):
    name: Optional[str] = None
    canonical_name: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class IconSuggestRequest(BaseModel):
    text: str = Field(min_length=1, max_length=255)


class IconSuggestResponse(BaseModel):
    suggestions: List[IconEntry]
    chosen: str


# ---------------------------------------------------------------------------
# The icon list
# ---------------------------------------------------------------------------


@router.get("/icons", response_model=List[IconGroup])
def list_icons(current_user: User = Depends(get_current_user)):
    """
    Every icon the user can pick, grouped by kind.

    The frontend renders this as a picker. It is served from the
    backend so the web app, the scanner and anything else describe
    categories the same way.
    """
    # The groups carry the raw entries. The flat list carries the same
    # entries with the group they belong to already filled in, so the
    # response is built from that one.
    by_group: Dict[str, List[Dict[str, Any]]] = {}
    for icon in ALL_ICONS:
        by_group.setdefault(icon["group"], []).append(icon)

    return [
        {
            "id": group["id"],
            "label": group["label"],
            "icons": by_group.get(group["id"], []),
        }
        for group in ICON_GROUPS
    ]


@router.post("/icons/suggest", response_model=IconSuggestResponse)
def suggest_icons(
    payload: IconSuggestRequest,
    current_user: User = Depends(get_current_user),
):
    """
    The icons that fit this text.

    Used while the user types, to offer the right one first. Also used
    by the scanner when it names a shop it has never seen.
    """
    matches = suggest_icon(payload.text, limit=8)
    return {
        "suggestions": matches,
        "chosen": matches[0]["value"] if matches else "🏷️",
    }


# ---------------------------------------------------------------------------
# The merchants
# ---------------------------------------------------------------------------


def _merchant_to_dict(
    merchant: MerchantCatalog,
    product_count: int = 0,
    icon: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    icon = icon or {}
    return {
        "id": merchant.id,
        "name": merchant.name,
        "merchant_type": merchant.merchant_type,
        # What the user picked wins. When they have not chosen, the
        # icon the system picked when it learned the shop is used.
        "icon": icon.get("icon") or merchant.icon,
        "color": icon.get("color"),
        "address": merchant.address,
        "scan_count": merchant.scan_count or 0,
        "total_spent": float(merchant.total_spent or 0),
        "product_count": product_count,
        "last_seen_at": (
            merchant.last_seen_at.isoformat() if merchant.last_seen_at else None
        ),
        "created_at": (
            merchant.created_at.isoformat() if merchant.created_at else None
        ),
    }


@router.get("/merchants", response_model=List[CatalogMerchant])
def list_catalog_merchants(
    search: Optional[str] = Query(default=None),
    merchant_type: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The shops this user buys at."""
    query = db.query(MerchantCatalog).filter(
        MerchantCatalog.user_id == current_user.id,
        MerchantCatalog.is_active == True,
    )

    if search:
        needle = f"%{search.lower()}%"
        query = query.filter(
            func.lower(MerchantCatalog.name).like(needle)
            | func.lower(func.coalesce(MerchantCatalog.merchant_type, "")).like(
                needle
            )
        )

    if merchant_type:
        query = query.filter(MerchantCatalog.merchant_type == merchant_type)

    merchants = (
        query.order_by(MerchantCatalog.scan_count.desc(), MerchantCatalog.name)
        .all()
    )

    # How many products each shop has, in one query rather than one per
    # shop.
    counts = dict(
        db.query(UserProduct.merchant_catalog_id, func.count(UserProduct.id))
        .filter(
            UserProduct.user_id == current_user.id,
            UserProduct.merchant_catalog_id.isnot(None),
        )
        .group_by(UserProduct.merchant_catalog_id)
        .all()
    )

    icons = _icons_for(db, current_user.id, "merchant")
    return [
        _merchant_to_dict(
            merchant, counts.get(merchant.id, 0), icons.get(merchant.id)
        )
        for merchant in merchants
    ]


@router.put("/merchants/{merchant_id}", response_model=CatalogMerchant)
def update_catalog_merchant(
    merchant_id: int,
    payload: CatalogMerchantUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Change what the system learned about a shop.

    The icon and the category are the two the user is most likely to
    want to change, because the system guessed them.
    """
    merchant = (
        db.query(MerchantCatalog)
        .filter(
            MerchantCatalog.id == merchant_id,
            MerchantCatalog.user_id == current_user.id,
        )
        .first()
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Toko tidak ditemukan")

    changes = payload.model_dump(exclude_unset=True)

    icon = changes.get("icon")
    if icon is not None:
        if not is_valid_icon(icon):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Ikon tidak dikenal. Ambil dari daftar di "
                    "/api/catalog/icons."
                ),
            )
        _set_icon(db, current_user.id, "merchant", merchant.id, icon)
        # The column on the model is kept in step, so a read that does
        # not join the icon table still shows the right thing.
        merchant.icon = icon

    for key in ("name", "merchant_type", "color", "address"):
        value = changes.get(key)
        if value is not None:
            setattr(merchant, key, value)

    db.commit()
    db.refresh(merchant)

    count = (
        db.query(func.count(UserProduct.id))
        .filter(
            UserProduct.user_id == current_user.id,
            UserProduct.merchant_catalog_id == merchant.id,
        )
        .scalar()
        or 0
    )
    return _merchant_to_dict(
        merchant, count, _icon_for(db, current_user.id, "merchant", merchant.id)
    )


@router.delete("/merchants/{merchant_id}", status_code=204)
def delete_catalog_merchant(
    merchant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Take a shop out of the catalogue."""
    merchant = (
        db.query(MerchantCatalog)
        .filter(
            MerchantCatalog.id == merchant_id,
            MerchantCatalog.user_id == current_user.id,
        )
        .first()
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Toko tidak ditemukan")

    merchant.is_active = False
    db.commit()
    return None


# ---------------------------------------------------------------------------
# The products
# ---------------------------------------------------------------------------


@router.get("/products", response_model=List[CatalogProduct])
def list_catalog_products(
    search: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The products this user has bought."""
    query = db.query(UserProduct).filter(
        UserProduct.user_id == current_user.id,
        UserProduct.is_active == True,
    )

    if search:
        needle = f"%{search.lower()}%"
        query = query.filter(
            func.lower(UserProduct.name).like(needle)
            | func.lower(func.coalesce(UserProduct.canonical_name, "")).like(
                needle
            )
        )

    if category:
        query = query.filter(UserProduct.category == category)

    products = (
        query.order_by(UserProduct.purchase_count.desc(), UserProduct.name).all()
    )

    icons = _icons_for(db, current_user.id, "product")
    return [
        _product_to_dict(product, icons.get(product.id))
        for product in products
    ]


def _product_to_dict(
    product: UserProduct, icon: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    icon = icon or {}
    return {
        "id": product.id,
        "name": product.name,
        "canonical_name": product.canonical_name,
        "category": product.category,
        # What the user picked wins. When they have not chosen, the
        # icon the system picked when it learned the product is used.
        "icon": icon.get("icon") or product.icon,
        "color": icon.get("color"),
        "typical_price": (
            float(product.typical_price) if product.typical_price else None
        ),
        "min_price": float(product.min_price) if product.min_price else None,
        "max_price": float(product.max_price) if product.max_price else None,
        "purchase_count": product.purchase_count or 0,
        "last_seen_at": (
            product.last_seen_at.isoformat() if product.last_seen_at else None
        ),
    }


@router.put("/products/{product_id}", response_model=CatalogProduct)
def update_catalog_product(
    product_id: int,
    payload: CatalogProductUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the name, the category or the icon of a product."""
    product = (
        db.query(UserProduct)
        .filter(
            UserProduct.id == product_id,
            UserProduct.user_id == current_user.id,
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")

    changes = payload.model_dump(exclude_unset=True)

    icon = changes.get("icon")
    if icon is not None:
        if not is_valid_icon(icon):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Ikon tidak dikenal. Ambil dari daftar di "
                    "/api/catalog/icons."
                ),
            )
        _set_icon(db, current_user.id, "product", product.id, icon)
        # The column on the model is kept in step, so a read that does
        # not join the icon table still shows the right thing.
        product.icon = icon

    for key in ("name", "canonical_name", "category"):
        value = changes.get(key)
        if value is not None:
            setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return _product_to_dict(
        product, _icon_for(db, current_user.id, "product", product.id)
    )


@router.delete("/products/{product_id}", status_code=204)
def delete_catalog_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Take a product out of the catalogue."""
    product = (
        db.query(UserProduct)
        .filter(
            UserProduct.id == product_id,
            UserProduct.user_id == current_user.id,
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")

    product.is_active = False
    db.commit()
    return None


# ---------------------------------------------------------------------------
# The icon the user picked
# ---------------------------------------------------------------------------


def _icons_for(db: Session, user_id: int, target_type: str) -> Dict[int, Dict[str, Any]]:
    """The icons the user picked, keyed by the id they belong to."""
    rows = (
        db.query(CatalogIcon)
        .filter(
            CatalogIcon.user_id == user_id,
            CatalogIcon.target_type == target_type,
        )
        .all()
    )
    return {
        row.target_id: {"icon": row.icon, "color": row.color}
        for row in rows
    }


def _set_icon(
    db: Session,
    user_id: int,
    target_type: str,
    target_id: int,
    icon: Optional[str],
    color: Optional[str] = None,
) -> None:
    """Save the icon the user picked."""
    row = (
        db.query(CatalogIcon)
        .filter(
            CatalogIcon.user_id == user_id,
            CatalogIcon.target_type == target_type,
            CatalogIcon.target_id == target_id,
        )
        .first()
    )
    if row is None:
        row = CatalogIcon(
            user_id=user_id,
            target_type=target_type,
            target_id=target_id,
        )
        db.add(row)

    if icon is not None:
        row.icon = icon
    if color is not None:
        row.color = color


def _icon_for(
    db: Session, user_id: int, target_type: str, target_id: int
) -> Dict[str, Any]:
    """The icon of one entry, if the user picked one."""
    row = (
        db.query(CatalogIcon)
        .filter(
            CatalogIcon.user_id == user_id,
            CatalogIcon.target_type == target_type,
            CatalogIcon.target_id == target_id,
        )
        .first()
    )
    if row is None:
        return {"icon": None, "color": None}
    return {"icon": row.icon, "color": row.color}
