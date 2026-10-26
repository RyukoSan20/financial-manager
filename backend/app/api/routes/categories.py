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


@router.get("/by-type/{type}", response_model=List[CategoryResponse])
def list_categories_by_type(
    type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    The categories of one type.

    This is a separate route because `/{category_id}` would otherwise
    swallow "expense" and answer with a confusing path parse error.
    """
    query = db.query(Category).filter(
        Category.is_active == True,
        Category.type == type,
    )
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
    
    # The name in three languages, plus a key that names the category
    # without depending on any language. The key is what the frontend
    # reads, so a change of wording never has to touch the database.
    default_categories = [
        # Income
        {"name": "Gaji", "name_en": "Salary", "name_ja": "給与", "system_key": "salary",
         "type": "income", "icon": "💰", "color": "#4CAF50"},
        {"name": "Freelance", "name_en": "Freelance", "name_ja": "フリーランス", "system_key": "freelance",
         "type": "income", "icon": "💻", "color": "#2196F3"},
        {"name": "Investasi", "name_en": "Investment", "name_ja": "投資収入", "system_key": "investment_income",
         "type": "income", "icon": "📈", "color": "#9C27B0"},
        {"name": "Bonus", "name_en": "Bonus", "name_ja": "ボーナス", "system_key": "bonus",
         "type": "income", "icon": "🎁", "color": "#FF9800"},
        {"name": "Lainnya (Income)", "name_en": "Other (Income)", "name_ja": "その他（収入）", "system_key": "other_income",
         "type": "income", "icon": "📦", "color": "#607D8B"},
        # Expense
        {"name": "Makanan & Minuman", "name_en": "Food & Drink", "name_ja": "飲食", "system_key": "food_drink",
         "type": "expense", "icon": "🍔", "color": "#F44336"},
        {"name": "Transportasi", "name_en": "Transportation", "name_ja": "交通", "system_key": "transportation",
         "type": "expense", "icon": "🚗", "color": "#3F51B5"},
        {"name": "Belanja", "name_en": "Shopping", "name_ja": "買い物", "system_key": "shopping",
         "type": "expense", "icon": "🛒", "color": "#E91E63"},
        {"name": "Kesehatan", "name_en": "Health", "name_ja": "健康", "system_key": "health",
         "type": "expense", "icon": "🏥", "color": "#00BCD4"},
        {"name": "Pendidikan", "name_en": "Education", "name_ja": "教育", "system_key": "education",
         "type": "expense", "icon": "📚", "color": "#795548"},
        {"name": "Hiburan", "name_en": "Entertainment", "name_ja": "娯楽", "system_key": "entertainment",
         "type": "expense", "icon": "🎬", "color": "#FF5722"},
        {"name": "Tagihan & Utilitas", "name_en": "Bills & Utilities", "name_ja": "公共料金", "system_key": "bills_utilities",
         "type": "expense", "icon": "📄", "color": "#9E9E9E"},
        {"name": "Investasi & Tabungan", "name_en": "Investment & Savings", "name_ja": "投資・貯蓄", "system_key": "savings_investment",
         "type": "expense", "icon": "🏦", "color": "#4CAF50"},
        {"name": "Lainnya (Expense)", "name_en": "Other (Expense)", "name_ja": "その他（支出）", "system_key": "other_expense",
         "type": "expense", "icon": "📦", "color": "#607D8B"},
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
        elif existing.system_key is None:
            # The category is already there from an older version. Give
            # it the key and the other names so it reads in every
            # language from now on.
            existing.system_key = cat_data["system_key"]
            existing.name_en = cat_data["name_en"]
            existing.name_ja = cat_data["name_ja"]
    
    db.commit()
    return {"message": f"Created {len(created)} categories", "categories": created}
