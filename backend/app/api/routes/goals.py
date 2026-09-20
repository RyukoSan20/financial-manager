"""Goal API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from decimal import Decimal

from app.core.database import get_db
from app.models.goal import Goal, GoalContribution
from app.schemas.goal import (
    GoalCreate, GoalUpdate, GoalResponse, GoalWithProgress,
    GoalContributionCreate, GoalContributionResponse
)
from app.services.calculation.formulas import (
    calculate_goal_progress,
    calculate_goal_remaining,
    calculate_required_saving_for_goal,
    calculate_goal_on_track
)

router = APIRouter()


@router.get("/", response_model=List[GoalWithProgress])
def list_goals(active_only: bool = True, db: Session = Depends(get_db)):
    """List all goals with calculated progress."""
    query = db.query(Goal)
    if active_only:
        query = query.filter(Goal.is_active == True)
    
    goals = query.order_by(Goal.target_date).all()
    result = []
    
    for goal in goals:
        progress = calculate_goal_progress(goal.current_amount, goal.target_amount)
        remaining = calculate_goal_remaining(goal.target_amount, goal.current_amount)
        
        days_remaining = max(0, (goal.target_date - date.today()).days)
        required = calculate_required_saving_for_goal(goal.target_amount, goal.current_amount, days_remaining)
        on_track = calculate_goal_on_track(goal.current_amount, goal.target_amount, goal.target_date)
        
        status = "completed" if goal.is_completed else on_track["status"]
        
        result.append(GoalWithProgress(
            id=goal.id,
            name=goal.name,
            description=goal.description,
            target_amount=goal.target_amount,
            current_amount=goal.current_amount,
            currency=goal.currency,
            target_date=goal.target_date,
            goal_type=goal.goal_type,
            account_id=goal.account_id,
            icon=goal.icon,
            color=goal.color,
            is_completed=goal.is_completed,
            completed_at=goal.completed_at,
            is_active=goal.is_active,
            created_at=goal.created_at,
            updated_at=goal.updated_at,
            progress_percent=float(progress.value),
            remaining_amount=remaining.value,
            days_remaining=days_remaining,
            required_monthly=required["required_monthly"],
            required_weekly=required["required_weekly"],
            required_daily=required["required_daily"],
            on_track=on_track["on_track"],
            estimated_completion=None,
            status=status,
        ))
    
    return result


@router.get("/{goal_id}", response_model=GoalWithProgress)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    """Get a single goal with progress."""
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    progress = calculate_goal_progress(goal.current_amount, goal.target_amount)
    remaining = calculate_goal_remaining(goal.target_amount, goal.current_amount)
    
    days_remaining = max(0, (goal.target_date - date.today()).days)
    required = calculate_required_saving_for_goal(goal.target_amount, goal.current_amount, days_remaining)
    on_track = calculate_goal_on_track(goal.current_amount, goal.target_amount, goal.target_date)
    
    status = "completed" if goal.is_completed else on_track["status"]
    
    return GoalWithProgress(
        id=goal.id,
        name=goal.name,
        description=goal.description,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        currency=goal.currency,
        target_date=goal.target_date,
        goal_type=goal.goal_type,
        account_id=goal.account_id,
        icon=goal.icon,
        color=goal.color,
        is_completed=goal.is_completed,
        completed_at=goal.completed_at,
        is_active=goal.is_active,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        progress_percent=float(progress.value),
        remaining_amount=remaining.value,
        days_remaining=days_remaining,
        required_monthly=required["required_monthly"],
        required_weekly=required["required_weekly"],
        required_daily=required["required_daily"],
        on_track=on_track["on_track"],
        estimated_completion=None,
        status=status,
    )


@router.post("/", response_model=GoalResponse, status_code=201)
def create_goal(goal: GoalCreate, db: Session = Depends(get_db)):
    """Create a new goal."""
    db_goal = Goal(**goal.model_dump())
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal


@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(goal_id: int, goal: GoalUpdate, db: Session = Depends(get_db)):
    """Update a goal."""
    db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    update_data = goal.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_goal, key, value)
    
    db.commit()
    db.refresh(db_goal)
    return db_goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) a goal."""
    db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    db_goal.is_active = False
    db.commit()
    return None


# === Goal Contributions ===

@router.post("/{goal_id}/contribute", response_model=GoalContributionResponse)
def add_contribution(goal_id: int, contribution: GoalContributionCreate, db: Session = Depends(get_db)):
    """Add a contribution to a goal."""
    db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Create contribution
    db_contribution = GoalContribution(
        goal_id=goal_id,
        amount=contribution.amount,
        currency=contribution.currency,
        date=contribution.date,
        notes=contribution.notes,
        transaction_id=contribution.transaction_id,
    )
    db.add(db_contribution)
    
    # Update goal current amount
    db_goal.current_amount += contribution.amount
    
    # Check if goal is completed
    if db_goal.current_amount >= db_goal.target_amount:
        db_goal.is_completed = True
        from datetime import datetime
        db_goal.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_contribution)
    return db_contribution


@router.get("/{goal_id}/contributions", response_model=List[GoalContributionResponse])
def list_contributions(goal_id: int, db: Session = Depends(get_db)):
    """List all contributions for a goal."""
    contributions = db.query(GoalContribution).filter(
        GoalContribution.goal_id == goal_id
    ).order_by(GoalContribution.date.desc()).all()
    return contributions


@router.get("/summary")
def get_goals_summary(db: Session = Depends(get_db)):
    """Get overall goals summary."""
    goals = db.query(Goal).filter(Goal.is_active == True).all()
    
    total_target = sum(g.target_amount for g in goals)
    total_current = sum(g.current_amount for g in goals)
    completed = len([g for g in goals if g.is_completed])
    active = len([g for g in goals if not g.is_completed])
    
    # Count on-track
    on_track_count = 0
    for goal in goals:
        if not goal.is_completed:
            on_track = calculate_goal_on_track(goal.current_amount, goal.target_amount, goal.target_date)
            if on_track["on_track"]:
                on_track_count += 1
    
    return {
        "total_goals": len(goals),
        "active_goals": active,
        "completed_goals": completed,
        "on_track_goals": on_track_count,
        "total_target_amount": total_target,
        "total_current_amount": total_current,
        "total_remaining": total_target - total_current,
        "overall_progress": float(total_current / total_target * 100) if total_target > 0 else 0,
    }
