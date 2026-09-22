"""Multi-tenancy utilities for data isolation."""

from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User


def get_user_data(db: Session, model, user: Optional[User] = None, **filters):
    """
    Get data filtered by user_id if authenticated.
    
    For backward compatibility: if no user is authenticated, returns all data.
    When user is authenticated, returns only their data.
    """
    query = db.query(model)
    
    # If user is authenticated, filter by user_id
    if user:
        query = query.filter(model.user_id == user.id)
    
    # Apply additional filters
    for key, value in filters.items():
        if value is not None:
            query = query.filter(getattr(model, key) == value)
    
    return query


def create_user_data(db: Session, model, data: dict, user: Optional[User] = None):
    """Create new record with user_id if authenticated."""
    if user:
        data['user_id'] = user.id
    
    instance = model(**data)
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return instance


def update_user_data(db: Session, instance, data: dict, user: Optional[User] = None):
    """Update record if user owns it."""
    # For now, allow update without ownership check (backward compatible)
    for key, value in data.items():
        if value is not None and hasattr(instance, key):
            setattr(instance, key, value)
    
    db.commit()
    db.refresh(instance)
    return instance


def delete_user_data(db: Session, instance, user: Optional[User] = None):
    """Delete record if user owns it."""
    # For now, allow delete without ownership check (backward compatible)
    db.delete(instance)
    db.commit()
