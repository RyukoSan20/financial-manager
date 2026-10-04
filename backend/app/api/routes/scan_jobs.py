"""
Background scan job API routes.
Returns job_id immediately, processes in background.
"""

import asyncio
import os
from datetime import datetime
from typing import Optional
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.storage import StorageService
from app.models.user import User
from app.models.scan_job import ScanJob, JobStatus
from app.services.scan_job_service import run_scan_job_background

router = APIRouter(prefix="/scan-jobs", tags=["scan-jobs"])


@router.post("/upload")
async def upload_receipt(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload receipt image for background processing.
    Returns job_id immediately - poll /jobs/{job_id} for status.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {allowed_types}"
        )

    # Read image
    image_data = await file.read()

    # Check file size (max 10MB)
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File too large. Max 10MB"
        )

    # Save to storage
    storage = StorageService()
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"receipts/{current_user.id}/{timestamp}_{file.filename}"
    image_path = await storage.upload_file(image_data, filename)

    # Create scan job
    from PIL import Image
    from app.services.scan_job_service import ScanJobService, ImageChunker

    image = Image.open(BytesIO(image_data))
    chunker = ImageChunker(image)

    job = ScanJob(
        job_id=f"scan_{datetime.utcnow().timestamp()}",
        user_id=current_user.id,
        image_filename=file.filename,
        image_path=image_path,
        image_size=len(image_data),
        image_width=image.width,
        image_height=image.height,
        chunks_total=len(chunker.get_regions()),
        status=JobStatus.PENDING
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    # Create chunks
    regions = chunker.get_regions()
    from app.models.scan_job import ScanChunk
    for i, region in enumerate(regions):
        bbox = region["bbox"]
        chunk = ScanChunk(
            scan_job_id=job.id,
            chunk_index=i,
            region_type=region["region_type"],
            bbox_x=bbox[0],
            bbox_y=bbox[1],
            bbox_width=bbox[2],
            bbox_height=bbox[3]
        )
        db.add(chunk)

    db.commit()

    # Queue background task
    background_tasks.add_task(run_scan_job_background, job.job_id)

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "message": "Receipt uploaded. Processing in background.",
        "chunks_total": job.chunks_total,
        "check_status_url": f"/api/scan-jobs/{job.job_id}"
    }


@router.get("/{job_id}")
async def get_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get job status and results.
    Poll this endpoint until status is 'completed' or 'failed'.
    """
    job = db.query(ScanJob).filter(
        ScanJob.job_id == job_id,
        ScanJob.user_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "job_id": job.job_id,
        "status": job.status.value,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "chunks_total": job.chunks_total,
        "chunks_completed": job.chunks_completed,
        "combined_confidence": float(job.combined_confidence) if job.combined_confidence else None,
        "error_message": job.error_message
    }

    # Include results if completed
    if job.status == JobStatus.COMPLETED:
        response["results"] = {
            "receipt_scan_id": job.receipt_scan_id,
            "gemini_parsed": job.gemini_parsed,
            "combined_text": job.combined_text[:1000] if job.combined_text else None,
            "chunk_results": job.chunk_results
        }

    return response


@router.get("/{job_id}/chunks")
async def get_job_chunks(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed chunk results."""
    job = db.query(ScanJob).filter(
        ScanJob.job_id == job_id,
        ScanJob.user_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    from app.models.scan_job import ScanChunk
    chunks = db.query(ScanChunk).filter(
        ScanChunk.scan_job_id == job.id
    ).order_by(ScanChunk.chunk_index).all()

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "chunks": [
            {
                "chunk_index": c.chunk_index,
                "region_type": c.region_type,
                "best_engine": c.best_engine,
                "best_text": c.best_text,
                "tesseract_text": c.tesseract_text,
                "easyocr_text": c.easyocr_text,
                "rapidocr_text": c.rapidocr_text,
                "confidence": {
                    "tesseract": float(c.tesseract_confidence) if c.tesseract_confidence else None,
                    "easyocr": float(c.easyocr_confidence) if c.easyocr_confidence else None,
                    "rapidocr": float(c.rapidocr_confidence) if c.rapidocr_confidence else None,
                },
                "gemini_interpretation": c.gemini_interpretation,
                "is_processed": c.is_processed
            }
            for c in chunks
        ]
    }


@router.delete("/{job_id}")
async def cancel_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel a pending/processing job."""
    job = db.query(ScanJob).filter(
        ScanJob.job_id == job_id,
        ScanJob.user_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel completed job"
        )

    job.status = JobStatus.FAILED
    job.error_message = "Cancelled by user"
    job.completed_at = datetime.utcnow()
    db.commit()

    return {"message": "Job cancelled"}


@router.get("/")
async def list_jobs(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List user's scan jobs."""
    query = db.query(ScanJob).filter(ScanJob.user_id == current_user.id)

    if status:
        try:
            status_enum = JobStatus(status)
            query = query.filter(ScanJob.status == status_enum)
        except ValueError:
            pass

    total = query.count()
    jobs = query.order_by(ScanJob.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "jobs": [
            {
                "job_id": j.job_id,
                "status": j.status.value,
                "filename": j.image_filename,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
                "receipt_scan_id": j.receipt_scan_id,
                "confidence": float(j.combined_confidence) if j.combined_confidence else None
            }
            for j in jobs
        ]
    }
