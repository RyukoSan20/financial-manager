"""Activity logs API routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.activity_log import ActivityLog, ActivityLogger

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.get("/")
def get_logs(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    endpoint: Optional[str] = Query(None, description="Filter by endpoint"),
    limit: int = Query(100, ge=1, le=1000, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip first N results"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get activity logs with filters."""
    query = db.query(ActivityLog)
    
    if session_id:
        query = query.filter(ActivityLog.session_id == session_id)
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if action:
        query = query.filter(ActivityLog.action.like(f"%{action}%"))
    if endpoint:
        query = query.filter(ActivityLog.endpoint.like(f"%{endpoint}%"))
    
    query = query.order_by(ActivityLog.created_at.desc())
    total = query.count()
    logs = query.offset(offset).limit(limit).all()
    
    return {
        "logs": [log.to_dict() for log in logs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/session/{session_id}")
def get_session_logs(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all logs for a specific session."""
    logs = db.query(ActivityLog).filter(
        ActivityLog.session_id == session_id
    ).order_by(ActivityLog.created_at.asc()).all()
    
    return {
        "session_id": session_id,
        "logs": [log.to_dict() for log in logs],
        "count": len(logs),
    }


@router.get("/errors")
def get_error_logs(
    hours: int = Query(24, ge=1, le=168, description="Hours to look back"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all error logs."""
    since = datetime.utcnow() - timedelta(hours=hours)
    
    logs = db.query(ActivityLog).filter(
        ActivityLog.created_at >= since,
        ActivityLog.error_message.isnot(None)
    ).order_by(ActivityLog.created_at.desc()).all()
    
    return {
        "errors": [log.to_dict() for log in logs],
        "count": len(logs),
        "since": since.isoformat(),
    }


@router.get("/stats")
def get_log_stats(
    hours: int = Query(24, ge=1, le=168, description="Hours to look back"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get log statistics."""
    since = datetime.utcnow() - timedelta(hours=hours)
    
    # Total requests
    total = db.query(ActivityLog).filter(
        ActivityLog.created_at >= since
    ).count()
    
    # Errors
    errors = db.query(ActivityLog).filter(
        ActivityLog.created_at >= since,
        ActivityLog.error_message.isnot(None)
    ).count()
    
    # By action type
    from sqlalchemy import func
    action_counts = db.query(
        ActivityLog.action,
        func.count(ActivityLog.id).label('count')
    ).filter(
        ActivityLog.created_at >= since
    ).group_by(ActivityLog.action).order_by(
        func.count(ActivityLog.id).desc()
    ).limit(20).all()
    
    # By endpoint
    endpoint_counts = db.query(
        ActivityLog.endpoint,
        func.count(ActivityLog.id).label('count')
    ).filter(
        ActivityLog.created_at >= since
    ).group_by(ActivityLog.endpoint).order_by(
        func.count(ActivityLog.id).desc()
    ).limit(20).all()
    
    # Average response time
    avg_duration = db.query(
        func.avg(ActivityLog.duration_ms)
    ).filter(
        ActivityLog.created_at >= since,
        ActivityLog.duration_ms.isnot(None)
    ).scalar() or 0
    
    return {
        "period_hours": hours,
        "total_requests": total,
        "total_errors": errors,
        "error_rate": round(errors / total * 100, 2) if total > 0 else 0,
        "avg_response_ms": round(avg_duration, 2),
        "top_actions": [{"action": a, "count": c} for a, c in action_counts],
        "top_endpoints": [{"endpoint": e, "count": c} for e, c in endpoint_counts],
    }


@router.delete("/cleanup")
def cleanup_old_logs(
    days: int = Query(30, ge=1, le=90, description="Delete logs older than N days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete logs older than specified days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    deleted = db.query(ActivityLog).filter(
        ActivityLog.created_at < cutoff
    ).delete()
    db.commit()
    
    return {
        "deleted": deleted,
        "older_than_days": days,
    }
