"""Shopping Kanban Board API Routes"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import asc

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.shopping_item import ShoppingItem
from app.schemas.shopping import (
    ShoppingItemCreate, ShoppingItemUpdate, ShoppingItemResponse,
    ShoppingItemMove, ShoppingBoardResponse, StageSummary
)

router = APIRouter()

# Pipeline stages
PIPELINE_STAGES = ['wishlist', 'to_buy', 'ordered', 'shipped', 'received', 'cancelled']

STAGE_LABELS = {
    'wishlist': 'Wishlist',
    'to_buy': 'Mau Beli',
    'ordered': 'Dipesan',
    'shipped': 'Dikirim',
    'received': 'Diterima',
    'cancelled': 'Dibatalkan',
}

STAGE_ICONS = {
    'wishlist': '💭',
    'to_buy': '🛒',
    'ordered': '📦',
    'shipped': '🚚',
    'received': '✅',
    'cancelled': '❌',
}


@router.get("/board", response_model=ShoppingBoardResponse)
def get_shopping_board(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get full shopping board with items grouped by stage."""
    # Get all items for user
    items = db.query(ShoppingItem).filter(
        ShoppingItem.user_id == current_user.id
    ).order_by(ShoppingItem.stage, ShoppingItem.position).all()
    
    # Group by stage
    stages = {}
    for stage in PIPELINE_STAGES:
        stages[stage] = []
    
    total_budget = 0
    total_spent = 0
    
    for item in items:
        item_dict = ShoppingItemResponse.model_validate(item).model_dump()
        stages[item.stage].append(item_dict)
        
        if item.price:
            if item.stage in ['ordered', 'shipped', 'received']:
                total_spent += item.price * item.quantity
            elif item.stage not in ['cancelled']:
                total_budget += item.price * item.quantity
    
    # Build stage summaries
    stage_summaries = []
    for stage in PIPELINE_STAGES:
        stage_items = stages[stage]
        stage_count = len(stage_items)
        stage_total = sum((item.price or 0) * item.quantity for item in items if item.stage == stage)
        
        stage_summaries.append(StageSummary(
            stage=stage,
            label=STAGE_LABELS.get(stage, stage),
            icon=STAGE_ICONS.get(stage, '📋'),
            count=stage_count,
            total=stage_total,
        ))
    
    return ShoppingBoardResponse(
        stages=stage_summaries,
        items_by_stage=stages,
        total_budget=total_budget,
        total_spent=total_spent,
        remaining_budget=total_budget - total_spent,
    )


@router.get("/items", response_model=List[ShoppingItemResponse])
def list_shopping_items(
    stage: Optional[str] = Query(default=None, description="Filter by stage"),
    category_id: Optional[int] = Query(default=None),
    search: Optional[str] = Query(default=None, description="Search in name"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List shopping items with filters."""
    query = db.query(ShoppingItem).filter(ShoppingItem.user_id == current_user.id)
    
    if stage:
        if stage not in PIPELINE_STAGES:
            raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {PIPELINE_STAGES}")
        query = query.filter(ShoppingItem.stage == stage)
    
    if category_id:
        query = query.filter(ShoppingItem.category_id == category_id)
    
    if search:
        query = query.filter(ShoppingItem.name.ilike(f"%{search}%"))
    
    items = query.order_by(ShoppingItem.position, ShoppingItem.created_at.desc()).offset(skip).limit(limit).all()
    
    return [ShoppingItemResponse.model_validate(item) for item in items]


@router.post("/items", response_model=ShoppingItemResponse, status_code=201)
def create_shopping_item(
    item: ShoppingItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new shopping item."""
    # Get max position for the stage
    max_pos = db.query(ShoppingItem).filter(
        ShoppingItem.user_id == current_user.id,
        ShoppingItem.stage == item.stage
    ).count()
    
    db_item = ShoppingItem(
        user_id=current_user.id,
        name=item.name,
        quantity=item.quantity,
        price=item.price,
        stage=item.stage,
        position=max_pos,
        marketplace=item.marketplace,
        product_url=item.product_url,
        category_id=item.category_id,
        notes=item.notes,
    )
    
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    return ShoppingItemResponse.model_validate(db_item)


@router.get("/items/{item_id}", response_model=ShoppingItemResponse)
def get_shopping_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single shopping item."""
    item = db.query(ShoppingItem).filter(
        ShoppingItem.id == item_id,
        ShoppingItem.user_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return ShoppingItemResponse.model_validate(item)


@router.put("/items/{item_id}", response_model=ShoppingItemResponse)
def update_shopping_item(
    item_id: int,
    item_update: ShoppingItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a shopping item."""
    item = db.query(ShoppingItem).filter(
        ShoppingItem.id == item_id,
        ShoppingItem.user_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Update fields
    update_data = item_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    
    db.commit()
    db.refresh(item)
    
    return ShoppingItemResponse.model_validate(item)


@router.delete("/items/{item_id}", status_code=204)
def delete_shopping_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a shopping item."""
    item = db.query(ShoppingItem).filter(
        ShoppingItem.id == item_id,
        ShoppingItem.user_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    db.delete(item)
    db.commit()
    
    return None


@router.post("/items/{item_id}/move", response_model=ShoppingItemResponse)
def move_shopping_item(
    item_id: int,
    move: ShoppingItemMove,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Move item to a different stage and/or reorder within stage."""
    item = db.query(ShoppingItem).filter(
        ShoppingItem.id == item_id,
        ShoppingItem.user_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if move.stage not in PIPELINE_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {PIPELINE_STAGES}")
    
    old_stage = item.stage
    new_stage = move.stage
    
    # If moving to different stage
    if old_stage != new_stage:
        # Update timestamps based on stage
        now = datetime.utcnow()
        if new_stage == 'ordered':
            item.purchased_at = now
        elif new_stage == 'received':
            item.received_at = now
        elif new_stage == 'cancelled':
            pass  # Keep existing timestamps
    
    # Reorder items in the target stage
    # Shift items at and after the new position
    if move.position is not None:
        # Get items in target stage (excluding current item if same stage)
        query = db.query(ShoppingItem).filter(
            ShoppingItem.user_id == current_user.id,
            ShoppingItem.stage == new_stage,
            ShoppingItem.position >= move.position,
        )
        if old_stage == new_stage:
            query = query.filter(ShoppingItem.id != item_id)
        
        for other in query.all():
            other.position = other.position + 1
        
        item.position = move.position
    else:
        # Append to end of target stage
        max_pos = db.query(ShoppingItem).filter(
            ShoppingItem.user_id == current_user.id,
            ShoppingItem.stage == new_stage,
        )
        if old_stage == new_stage:
            max_pos = max_pos.filter(ShoppingItem.id != item_id)
        max_pos = max_pos.count()
        item.position = max_pos
    
    item.stage = new_stage
    db.commit()
    db.refresh(item)
    
    return ShoppingItemResponse.model_validate(item)


@router.post("/items/reorder", response_model=List[ShoppingItemResponse])
def reorder_shopping_items(
    order: dict,  # {item_id: new_position}
    stage: str = Query(..., description="Stage to reorder"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reorder items within a stage. Body: {item_id: position}"""
    if stage not in PIPELINE_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage")
    
    updated_items = []
    for item_id, new_pos in order.items():
        item = db.query(ShoppingItem).filter(
            ShoppingItem.id == item_id,
            ShoppingItem.user_id == current_user.id,
            ShoppingItem.stage == stage
        ).first()
        
        if item:
            item.position = new_pos
            updated_items.append(item)
    
    db.commit()
    
    return [ShoppingItemResponse.model_validate(item) for item in updated_items]


@router.post("/items/{item_id}/convert-to-transaction")
def convert_to_transaction(
    item_id: int,
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Convert a received shopping item to an expense transaction."""
    from app.models.account import Account
    from app.models.transaction import Transaction
    from sqlalchemy import text
    
    item = db.query(ShoppingItem).filter(
        ShoppingItem.id == item_id,
        ShoppingItem.user_id == current_user.id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.stage != 'received':
        raise HTTPException(status_code=400, detail="Only received items can be converted to transactions")
    
    if item.transaction_id:
        raise HTTPException(status_code=400, detail="Item already converted to transaction")
    
    # Verify account
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Create transaction
    amount = (item.price or 0) * item.quantity
    
    transaction = Transaction(
        user_id=current_user.id,
        type='expense',
        amount=amount,
        currency='IDR',
        date=item.received_at or datetime.utcnow(),
        description=f"Bought: {item.name}",
        account_id=account_id,
        category_id=item.category_id,
        merchant_name=item.marketplace,
        status='approved',
        source='kanban_shopping',
        detection_type='MANUAL',
    )
    
    db.add(transaction)
    db.flush()  # Get transaction ID
    
    # Update account balance
    db.execute(
        text("""
            UPDATE accounts 
            SET balance = balance - :delta,
                updated_at = NOW()
            WHERE id = :account_id
        """),
        {"delta": amount, "account_id": account_id}
    )
    
    # Link item to transaction
    item.transaction_id = transaction.id
    
    db.commit()
    db.refresh(transaction)
    
    return {
        "status": "success",
        "message": "Item converted to transaction",
        "transaction_id": transaction.id,
        "amount": amount,
    }


@router.get("/stats")
def get_shopping_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get shopping statistics."""
    items = db.query(ShoppingItem).filter(
        ShoppingItem.user_id == current_user.id
    ).all()
    
    stats = {
        "total_items": len(items),
        "by_stage": {},
        "total_planned": 0,
        "total_spent": 0,
        "top_marketplaces": {},
    }
    
    for stage in PIPELINE_STAGES:
        stage_items = [i for i in items if i.stage == stage]
        stats["by_stage"][stage] = len(stage_items)
    
    for item in items:
        if item.price:
            if item.stage in ['ordered', 'shipped', 'received']:
                stats["total_spent"] += item.price * item.quantity
            elif item.stage not in ['cancelled']:
                stats["total_planned"] += item.price * item.quantity
            
            if item.marketplace:
                if item.marketplace not in stats["top_marketplaces"]:
                    stats["top_marketplaces"][item.marketplace] = 0
                stats["top_marketplaces"][item.marketplace] += 1
    
    return stats
