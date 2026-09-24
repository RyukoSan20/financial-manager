"""Category API routes with multi-tenancy."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user_optional, get_current_user
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter()


@router.get("/", response_model=List[CategoryResponse])
def list_categories(
    type: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all categories for current user (plus shared categories)."""
    query = db.query(Category).filter(Category.is_active == True)
    if type:
        query = query.filter(Category.type == type)
    
    # Get shared + user's own categories
    if current_user:
        query = query.filter(
            (Category.user_id == current_user.id) | (Category.user_id == None)
        )
    
    return query.all()


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get category by ID."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("/", response_model=CategoryResponse, status_code=201)
def create_category(
    category: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new category (owned by current user)."""
    category_data = category.model_dump()
    
    # Assign user_id if authenticated
    if current_user:
        category_data["user_id"] = current_user.id
    
    db_category = Category(**category_data)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update category with ownership check."""
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Ownership check - can only edit own categories
    if current_user and db_category.user_id and db_category.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit shared category")
    
    update_data = category.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_category, key, value)
    
    db.commit()
    db.refresh(db_category)
    return db_category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete category with ownership check."""
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Ownership check
    if current_user and db_category.user_id and db_category.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete shared category")
    
    db_category.is_active = False
    db.commit()
    return None


@router.post("/seed-defaults")
def seed_default_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Seed default income/expense categories for user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    default_categories = [
        # Income
        {"name": "Gaji", "type": "income", "icon": "💰", "color": "#4CAF50"},
        {"name": "Freelance", "type": "income", "icon": "💻", "color": "#2196F3"},
        {"name": "Investasi", "type": "income", "icon": "📈", "color": "#9C27B0"},
        {"name": "Bonus", "type": "income", "icon": "🎁", "color": "#FF9800"},
        {"name": "Lainnya (Income)", "type": "income", "icon": "📦", "color": "#607D8B"},
        # Expense
        {"name": "Makanan & Minuman", "type": "expense", "icon": "🍔", "color": "#F44336"},
        {"name": "Transportasi", "type": "expense", "icon": "🚗", "color": "#3F51B5"},
        {"name": "Belanja", "type": "expense", "icon": "🛒", "color": "#E91E63"},
        {"name": "Kesehatan", "type": "expense", "icon": "🏥", "color": "#00BCD4"},
        {"name": "Pendidikan", "type": "expense", "icon": "📚", "color": "#795548"},
        {"name": "Hiburan", "type": "expense", "icon": "🎬", "color": "#FF5722"},
        {"name": "Tagihan & Utilitas", "type": "expense", "icon": "📄", "color": "#9E9E9E"},
        {"name": "Investasi & Tabungan", "type": "expense", "icon": "🏦", "color": "#4CAF50"},
        {"name": "Lainnya (Expense)", "type": "expense", "icon": "📦", "color": "#607D8B"},
    ]
    
    created = []
    for cat_data in default_categories:
        # Check if exists for this user
        existing = db.query(Category).filter(
            Category.name == cat_data["name"],
            Category.user_id == current_user.id
        ).first()
        if not existing:
            cat_data["user_id"] = current_user.id
            db_category = Category(**cat_data)
            db.add(db_category)
            created.append(cat_data["name"])
    
    db.commit()
    return {"message": f"Created {len(created)} categories", "categories": created}
