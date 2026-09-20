"""Category API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter()


@router.get("/", response_model=List[CategoryResponse])
def list_categories(type: str = None, db: Session = Depends(get_db)):
    query = db.query(Category).filter(Category.is_active == True)
    if type:
        query = query.filter(Category.type == type)
    return query.all()


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("/", response_model=CategoryResponse, status_code=201)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    db_category = Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, category: CategoryUpdate, db: Session = Depends(get_db)):
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = category.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_category, key, value)
    
    db.commit()
    db.refresh(db_category)
    return db_category


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db_category.is_active = False
    db.commit()
    return None


@router.post("/seed-defaults")
def seed_default_categories(db: Session = Depends(get_db)):
    """Seed default income/expense categories."""
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
        existing = db.query(Category).filter(Category.name == cat_data["name"]).first()
        if not existing:
            db_category = Category(**cat_data)
            db.add(db_category)
            created.append(cat_data["name"])
    
    db.commit()
    return {"message": f"Created {len(created)} categories", "categories": created}
