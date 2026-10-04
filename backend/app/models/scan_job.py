"""Background scan job models for async OCR processing."""

from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
from app.core.database import Base


class JobStatus(str, Enum):
    """Job processing status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ScanJob(Base):
    """
    Background job for async receipt scanning.
    Returns job_id immediately, user polls for status.
    """
    __tablename__ = "scan_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(36), unique=True, nullable=False, index=True)  # UUID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Status
    status = Column(SQLEnum(JobStatus), default=JobStatus.PENDING, nullable=False)

    # Image info
    image_filename = Column(String(255), nullable=False)
    image_path = Column(String(512), nullable=False)
    image_size = Column(Integer, nullable=True)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)

    # Processing chunks
    chunks_total = Column(Integer, default=0)
    chunks_completed = Column(Integer, default=0)
    chunk_results = Column(JSON, nullable=True)  # Array of chunk OCR results

    # OCR results from each engine
    tesseract_text = Column(Text, nullable=True)
    easyocr_text = Column(Text, nullable=True)
    rapidocr_text = Column(Text, nullable=True)

    # Ensemble confidence scores
    tesseract_confidence = Column(Numeric(5, 2), nullable=True)
    easyocr_confidence = Column(Numeric(5, 2), nullable=True)
    rapidocr_confidence = Column(Numeric(5, 2), nullable=True)

    # Combined result
    combined_text = Column(Text, nullable=True)
    combined_confidence = Column(Numeric(5, 2), nullable=True)

    # Gemini AI structured output
    gemini_parsed = Column(JSON, nullable=True)  # Structured dict from Gemini

    # Final result (linked to receipt_scan)
    receipt_scan_id = Column(Integer, ForeignKey("receipt_scans.id"), nullable=True)

    # Error info
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", backref="scan_jobs")
    receipt_scan = relationship("ReceiptScan", backref="scan_job")


class ScanChunk(Base):
    """
    Individual chunk of a receipt image for parallel OCR.
    """
    __tablename__ = "scan_chunks"

    id = Column(Integer, primary_key=True, index=True)
    scan_job_id = Column(Integer, ForeignKey("scan_jobs.id"), nullable=False, index=True)

    # Chunk info
    chunk_index = Column(Integer, nullable=False)  # 0, 1, 2, ...
    region_type = Column(String(50), nullable=False)  # "header", "items", "footer", "total"
    bbox_x = Column(Integer, nullable=True)
    bbox_y = Column(Integer, nullable=True)
    bbox_width = Column(Integer, nullable=True)
    bbox_height = Column(Integer, nullable=True)

    # OCR results per engine
    tesseract_text = Column(Text, nullable=True)
    easyocr_text = Column(Text, nullable=True)
    rapidocr_text = Column(Text, nullable=True)

    # Confidence scores
    tesseract_confidence = Column(Numeric(5, 2), nullable=True)
    easyocr_confidence = Column(Numeric(5, 2), nullable=True)
    rapidocr_confidence = Column(Numeric(5, 2), nullable=True)

    # Best result (ensemble voting)
    best_text = Column(Text, nullable=True)
    best_engine = Column(String(20), nullable=True)

    # Gemini interpretation
    gemini_interpretation = Column(JSON, nullable=True)

    # Processing status
    is_processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    scan_job = relationship("ScanJob", backref="chunks")
