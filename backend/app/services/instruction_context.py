"""
Gathering the context an instruction needs.

A prompt is only as good as what it knows. The model does not know what
the user buys, which shops they use, or what they usually spend, so
those are collected here and handed over with the instruction.

The point is that the context is user specific. One user's trip to
Japan involves the airline they have flown with before; another's
involves a different set of costs. A breakdown that ignores this is a
guess dressed up as an answer.
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _average_spend(db: Session, user_id: int, merchant: Optional[str]) -> Optional[float]:
    """
    What the user usually spends on a purchase like this one.

    When the shop is known, the average is for that shop. When it is
    not, the average is for all of the user's expenses.
    """
    from app.models.transaction import Transaction

    try:
        query = select(
            func.avg(Transaction.amount)
        ).where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.is_deleted == False,
        )
        if merchant:
            query = query.where(Transaction.merchant_name == merchant)

        average = db.execute(query).scalar()
        if average is None:
            return None
        value = float(average)
        return value if value > 0 else None
    except Exception as exc:  # noqa: BLE001 - the context is optional
        logger.debug("Could not work out the average spend: %s", exc)
        return None


def _catalog_products(db: Session, user_id: int, merchant: Optional[str]) -> List[str]:
    """
    The products this shop is known to sell.

    This comes from the receipts the user has scanned. It is the most
    reliable thing there is, because it is not a guess at all: the
    receipt said so.
    """
    if not merchant:
        return []

    try:
        from app.services.catalog_learning import get_learning_service

        service = get_learning_service(db, user_id)
        match = service.find_merchant_match(merchant)
        if not match:
            return []

        merchant_id = match.get("id")
        if not merchant_id:
            return []

        from app.models.merchant_catalog import UserProduct

        products = (
            db.query(UserProduct)
            .filter(UserProduct.user_id == user_id)
            .order_by(UserProduct.purchase_count.desc())
            .all()
        )

        names: List[str] = []
        for product in products:
            catalog_merchant = getattr(product, "merchant_catalog_id", None)
            if catalog_merchant and merchant_id and catalog_merchant != merchant_id:
                continue
            name = getattr(product, "name", None)
            if name and name not in names:
                names.append(name)

        return names[:12]
    except Exception as exc:  # noqa: BLE001 - the context is optional
        logger.debug("Could not read the merchant catalog: %s", exc)
        return []


def _known_merchants(db: Session, user_id: int) -> List[str]:
    """The shops this user has spent money at."""
    try:
        from app.models.merchant_catalog import MerchantCatalog

        merchants = (
            db.query(MerchantCatalog)
            .filter(MerchantCatalog.user_id == user_id)
            .order_by(MerchantCatalog.scan_count.desc())
            .limit(8)
            .all()
        )
        return [m.name for m in merchants if m.name]
    except Exception as exc:  # noqa: BLE001 - the context is optional
        logger.debug("Could not read the merchant list: %s", exc)
        return []


def _known_products(db: Session, user_id: int) -> List[str]:
    """The products this user has bought."""
    try:
        from app.models.merchant_catalog import UserProduct

        products = (
            db.query(UserProduct)
            .filter(UserProduct.user_id == user_id)
            .order_by(UserProduct.purchase_count.desc())
            .limit(12)
            .all()
        )
        return [p.name for p in products if p.name]
    except Exception as exc:  # noqa: BLE001 - the context is optional
        logger.debug("Could not read the product list: %s", exc)
        return []


def goal_context(
    db: Optional[Session],
    user_id: Optional[int],
    merchant: Optional[str] = None,
) -> Dict[str, Any]:
    """The context a goal breakdown needs."""
    if db is None or user_id is None:
        return {}

    return {
        "known_merchants": _known_merchants(db, user_id),
        "known_products": _known_products(db, user_id),
        "average_amount": _average_spend(db, user_id, merchant),
    }


def transaction_context(
    db: Optional[Session],
    user_id: Optional[int],
    merchant: Optional[str] = None,
) -> Dict[str, Any]:
    """The context a purchase breakdown needs."""
    if db is None or user_id is None:
        return {}

    context: Dict[str, Any] = {
        "average_amount": _average_spend(db, user_id, merchant),
    }

    catalog_products = _catalog_products(db, user_id, merchant)
    if catalog_products:
        context["catalog_products"] = catalog_products

    merchant_type = None
    if merchant:
        try:
            from app.services.catalog_learning import get_learning_service

            service = get_learning_service(db, user_id)
            match = service.find_merchant_match(merchant)
            if match and match.get("merchant_type"):
                merchant_type = match["merchant_type"]
        except Exception as exc:  # noqa: BLE001 - the context is optional
            logger.debug("Could not read the merchant type: %s", exc)

    if merchant_type:
        context["merchant_type"] = merchant_type

    return context
