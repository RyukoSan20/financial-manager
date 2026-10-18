"""
Client Error Router - Endpoint for receiving frontend error reports.
Stores client errors for centralized monitoring.
"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.core.security import get_current_user
from app.core.logger import get_logger, audit_log
from app.modules.ai_monitor.publisher import error_publisher

router = APIRouter(prefix="/api/errors", tags=["Error Monitoring"])


class ClientErrorReport(BaseModel):
    """Structured client-side error report."""
    error_id: Optional[str] = None
    error_type: str = Field(..., description="Error name (e.g., TypeError)")
    error_message: str = Field(..., description="Error message")
    stack: Optional[str] = Field(None, description="Error stack trace")
    component_stack: Optional[str] = Field(None, description="React component stack")
    url: str = Field(..., description="Page URL where error occurred")
    user_agent: Optional[str] = None
    timestamp: str = Field(..., description="ISO timestamp")
    viewport: Optional[Dict[str, int]] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None


class ErrorStats(BaseModel):
    """Error statistics response."""
    total_errors: int
    errors_by_type: Dict[str, int]
    errors_by_severity: Dict[str, int]
    recent_errors: List[Dict[str, Any]]


@router.post("/client", status_code=201)
async def report_client_error(
    report: ClientErrorReport,
    current_user = Depends(get_current_user)
):
    """
    Receive and process client-side error reports.
    Errors are stored and published for AI analysis.
    """
    user_id = current_user.id if hasattr(current_user, 'id') else None
    
    # Log the error
    logger = get_logger("client_error")
    logger.error(
        "client_error",
        error_id=report.error_id,
        error_type=report.error_type,
        error_message=report.error_message,
        url=report.url,
        user_id=user_id
    )
    
    # Publish to Redis for AI analysis
    await error_publisher.publish({
        "error_type": "client_error",
        "error_class": report.error_type,
        "error_message": report.error_message,
        "stack": report.stack,
        "component_stack": report.component_stack,
        "path": report.url,
        "user_id": user_id,
        "session_id": report.session_id,
        "source": "frontend"
    })
    
    # Audit log
    audit_log.log(
        action="client_error.report",
        user_id=user_id,
        resource_type="client_error",
        resource_id=report.error_id,
        metadata={
            "error_type": report.error_type,
            "url": report.url
        }
    )
    
    return {
        "status": "received",
        "error_id": report.error_id,
        "message": "Error report received"
    }


@router.get("/", response_model=ErrorStats)
async def get_error_stats(
    current_user = Depends(get_current_user)
):
    """
    Get error statistics for the current user.
    Shows error counts by type and severity.
    """
    # This would query from a database in production
    # For now, return placeholder
    return ErrorStats(
        total_errors=0,
        errors_by_type={},
        errors_by_severity={},
        recent_errors=[]
    )


@router.get("/recent")
async def get_recent_errors(
    limit: int = 10,
    current_user = Depends(get_current_user)
):
    """
    Get recent errors for the current user.
    """
    # This would query from a database in production
    return {
        "errors": [],
        "total": 0
    }
