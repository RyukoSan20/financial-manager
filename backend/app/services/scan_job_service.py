"""
Background scan job service.
Handles async OCR processing with multi-engine ensemble and chunking.
"""

import uuid
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from io import BytesIO
from PIL import Image
import numpy as np

from sqlalchemy.orm import Session
from app.models.scan_job import ScanJob, ScanChunk, JobStatus
from app.models.receipt import ReceiptScan, ReceiptItem
from app.core.database import get_db
from app.core.config import settings


class ImageChunker:
    """Split receipt image into regions for parallel OCR."""

    def __init__(self, image: Image.Image):
        self.image = image
        self.width, self.height = image.size

    def get_regions(self) -> List[Dict[str, Any]]:
        """
        Define receipt regions based on typical layout.
        Adjusts based on actual image dimensions.
        """
        regions = []

        # Header region (top 15%) - store name, date, address
        header_height = int(self.height * 0.15)
        regions.append({
            "region_type": "header",
            "bbox": (0, 0, self.width, header_height),
            "description": "Store name, date, address"
        })

        # Items region (middle 55%) - item list with prices
        items_top = header_height
        items_bottom = int(self.height * 0.70)
        regions.append({
            "region_type": "items",
            "bbox": (0, items_top, self.width, items_bottom),
            "description": "Item list with prices"
        })

        # Subtotal/Total region (bottom 20%) - totals, payment
        total_top = items_bottom
        total_bottom = int(self.height * 0.90)
        regions.append({
            "region_type": "total",
            "bbox": (0, total_top, self.width, total_bottom),
            "description": "Subtotal, tax, total, payment method"
        })

        # Footer region (last 10%) - any remaining text
        footer_top = total_bottom
        regions.append({
            "region_type": "footer",
            "bbox": (0, footer_top, self.width, self.height),
            "description": "Footer text, barcode"
        })

        return regions

    def crop_region(self, bbox: Tuple[int, int, int, int]) -> Image.Image:
        """Crop image to region."""
        return self.image.crop(bbox)


class EnsembleOCR:
    """
    Ensemble OCR processor using multiple engines.
    Combines results with confidence-based voting.
    """

    def __init__(self):
        self.tesseract_available = False
        self.easyocr_available = False
        self.rapidocr_available = False
        self._init_engines()

    def _init_engines(self):
        """Initialize available OCR engines."""
        # Tesseract
        try:
            import pytesseract
            self.tesseract_available = True
        except ImportError:
            pass

        # EasyOCR
        try:
            import easyocr
            self.easyocr_reader = easyocr.Reader(['en', 'id'], gpu=False)
            self.easyocr_available = True
        except ImportError:
            pass

        # RapidOCR
        try:
            from rapidocr_onnxruntime import RapidOCR
            self.rapidocr_engine = RapidOCR()
            self.rapidocr_available = True
        except ImportError:
            pass

    async def process_image(self, image: Image.Image) -> Dict[str, Any]:
        """Process image with all available OCR engines."""
        results = {}
        confidences = {}

        # Convert PIL to numpy for processing
        img_array = np.array(image)

        # Process with each engine (in parallel)
        tasks = []
        if self.tesseract_available:
            tasks.append(self._process_tesseract(img_array))
        if self.easyocr_available:
            tasks.append(self._process_easyocr(img_array))
        if self.rapidocr_available:
            tasks.append(self._process_rapidocr(img_array))

        if tasks:
            task_results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, result in enumerate(task_results):
                if isinstance(result, Exception):
                    continue
                engine_name, text, confidence = result
                results[engine_name] = text
                confidences[engine_name] = confidence

        return {
            "results": results,
            "confidences": confidences
        }

    async def _process_tesseract(self, img_array) -> Tuple[str, str, float]:
        """Process with Tesseract OCR."""
        import pytesseract

        # Preprocess for better Tesseract accuracy
        gray = self._to_grayscale(img_array)
        enhanced = self._enhance_contrast(gray)

        text = pytesseract.image_to_string(enhanced, lang='eng+ind')
        # Tesseract doesn't give confidence, estimate based on text length
        confidence = min(len(text.split()) / 10, 100) if text.strip() else 0

        return ("tesseract", text, confidence)

    async def _process_easyocr(self, img_array) -> Tuple[str, str, float]:
        """Process with EasyOCR."""
        import easyocr

        if not hasattr(self, 'easyocr_reader'):
            return ("easyocr", "", 0)

        try:
            results = self.easyocr_reader.readtext(img_array)
            text_parts = []
            confidences = []

            for (bbox, text, conf) in results:
                text_parts.append(text)
                confidences.append(conf)

            text = "\n".join(text_parts)
            avg_confidence = sum(confidences) / len(confidences) * 100 if confidences else 0

            return ("easyocr", text, avg_confidence)
        except Exception:
            return ("easyocr", "", 0)

    async def _process_rapidocr(self, img_array) -> Tuple[str, str, float]:
        """Process with RapidOCR."""
        if not hasattr(self, 'rapidocr_engine'):
            return ("rapidocr", "", 0)

        try:
            result, elapse = self.rapidocr_engine(img_array)
            if result is None:
                return ("rapidocr", "", 0)

            text_parts = []
            confidences = []

            for line in result:
                # RapidOCR format: [box, text, score]
                text_parts.append(line[1])
                confidences.append(line[2] * 100)

            text = "\n".join(text_parts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0

            return ("rapidocr", text, avg_confidence)
        except Exception:
            return ("rapidocr", "", 0)

    def _to_grayscale(self, img_array) -> Image.Image:
        """Convert to grayscale."""
        return Image.fromarray(img_array).convert('L')

    def _enhance_contrast(self, gray_img: Image.Image) -> Image.Image:
        """Enhance contrast for better OCR."""
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(gray_img)
        return enhancer.enhance(1.5)


class ScanJobService:
    """
    Service for managing background scan jobs.
    """

    def __init__(self, db: Session):
        self.db = db
        self.ocr_engine = EnsembleOCR()
        self.chunker = None

    def create_job(self, user_id: int, image_filename: str, image_path: str,
                   image_size: int, image: Image.Image) -> ScanJob:
        """Create a new scan job."""
        job_id = str(uuid.uuid4())

        # Initialize chunker for this image
        self.chunker = ImageChunker(image)

        # Create job
        job = ScanJob(
            job_id=job_id,
            user_id=user_id,
            image_filename=image_filename,
            image_path=image_path,
            image_size=image_size,
            image_width=image.width,
            image_height=image.height,
            chunks_total=len(self.chunker.get_regions()),
            status=JobStatus.PENDING
        )

        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        # Create chunks
        regions = self.chunker.get_regions()
        for i, region in enumerate(regions):
            chunk = ScanChunk(
                scan_job_id=job.id,
                chunk_index=i,
                region_type=region["region_type"],
                bbox_x=region["bbox"][0],
                bbox_y=region["bbox"][1],
                bbox_width=region["bbox"][2],
                bbox_height=region["bbox"][3]
            )
            self.db.add(chunk)

        self.db.commit()

        return job

    async def process_job(self, job_id: str) -> ScanJob:
        """Process a scan job with ensemble OCR."""
        job = self.db.query(ScanJob).filter(ScanJob.job_id == job_id).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        try:
            # Update status
            job.status = JobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            self.db.commit()

            # Load image
            from app.core.storage import StorageService
            storage = StorageService()
            image_data = await storage.download_file(job.image_path)
            image = Image.open(BytesIO(image_data))

            # Process each chunk with ensemble OCR
            chunks = self.db.query(ScanChunk).filter(
                ScanChunk.scan_job_id == job.id
            ).order_by(ScanChunk.chunk_index).all()

            chunk_results = []
            for chunk in chunks:
                # Crop region
                bbox = (chunk.bbox_x, chunk.bbox_y,
                       chunk.bbox_x + chunk.bbox_width,
                       chunk.bbox_y + chunk.bbox_height)
                region_img = image.crop(bbox)

                # Process with ensemble OCR
                ocr_result = await self.ocr_engine.process_image(region_img)

                # Update chunk with results
                chunk.tesseract_text = ocr_result["results"].get("tesseract", "")
                chunk.easyocr_text = ocr_result["results"].get("easyocr", "")
                chunk.rapidocr_text = ocr_result["results"].get("rapidocr", "")

                chunk.tesseract_confidence = ocr_result["confidences"].get("tesseract", 0)
                chunk.easyocr_confidence = ocr_result["confidences"].get("easyocr", 0)
                chunk.rapidocr_confidence = ocr_result["confidences"].get("rapidocr", 0)

                # Ensemble voting - pick best result
                best_engine, best_text, best_conf = self._ensemble_vote(ocr_result)
                chunk.best_engine = best_engine
                chunk.best_text = best_text
                chunk.is_processed = True

                chunk_results.append({
                    "chunk_index": chunk.chunk_index,
                    "region_type": chunk.region_type,
                    "best_engine": best_engine,
                    "best_text": best_text[:200],  # Truncate for storage
                    "confidence": best_conf
                })

                job.chunks_completed += 1

            self.db.commit()

            # Combine all chunk texts
            all_texts = [c.best_text for c in chunks]
            combined_text = "\n\n".join(all_texts)
            job.combined_text = combined_text

            # Calculate overall confidence
            confidences = [c.tesseract_confidence or 0 for c in chunks]
            if confidences:
                job.combined_confidence = sum(confidences) / len(confidences)

            job.chunk_results = chunk_results

            # Now process with Gemini AI
            await self._process_with_gemini(job, combined_text)

            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()

        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()

        self.db.commit()
        return job

    def _ensemble_vote(self, ocr_result: Dict) -> Tuple[str, str, float]:
        """Vote on best OCR result using confidence weighting."""
        results = ocr_result["results"]
        confidences = ocr_result["confidences"]

        best_engine = None
        best_score = -1
        best_text = ""

        for engine, text in results.items():
            if not text or not text.strip():
                continue

            conf = confidences.get(engine, 50)

            # Score based on text quality
            word_count = len(text.split())
            has_numbers = any(c.isdigit() for c in text)
            has_currency = any(c in text for c in ['Rp', 'rp', 'IDR', '$', '.', ','])

            # Boost score for relevant receipt content
            score = conf
            if word_count > 5:
                score += 10
            if has_numbers:
                score += 15
            if has_currency:
                score += 20

            if score > best_score:
                best_score = score
                best_engine = engine
                best_text = text

        return (best_engine, best_text, best_score)

    async def _process_with_gemini(self, job: ScanJob, combined_text: str):
        """Use Gemini AI to structure the OCR text."""
        from app.services.gemini_vision import GeminiVisionService

        try:
            gemini = GeminiVisionService()

            prompt = f"""Parse this receipt text and extract structured data.

Receipt Text:
{combined_text}

Return JSON with:
- merchant_name: Store name
- receipt_date: Date (YYYY-MM-DD or null)
- payment_method: Payment method or null
- items: Array of {{name, quantity, price_per_unit, total_price}}
- subtotal: Subtotal amount or null
- discount_total: Discount amount or 0
- total_amount: Total amount
- confidence: Confidence score 0-100

Only include items where you have reasonable confidence.
Use null for unknown values."""

            result = await gemini.analyze_text(prompt, combined_text)

            if result and isinstance(result, dict):
                job.gemini_parsed = result

                # Create ReceiptScan from Gemini result
                self._create_receipt_scan(job, result)

        except Exception as e:
            # Gemini failed, try basic parsing
            job.gemini_parsed = {"error": str(e)}

    def _create_receipt_scan(self, job: ScanJob, gemini_result: Dict):
        """Create ReceiptScan from Gemini result."""
        receipt = ReceiptScan(
            user_id=job.user_id,
            merchant_name=gemini_result.get("merchant_name"),
            total_amount=gemini_result.get("total_amount"),
            subtotal=gemini_result.get("subtotal"),
            discount_total=gemini_result.get("discount_total", 0),
            payment_method=gemini_result.get("payment_method"),
            receipt_date=gemini_result.get("receipt_date"),
            raw_text=job.combined_text,
            raw_lines=job.chunk_results,
            detection_type="ENSEMBLE_OCR_GEMINI",
            image_filename=job.image_filename,
            image_size=job.image_size,
            is_processed=True
        )

        self.db.add(receipt)
        self.db.commit()
        self.db.refresh(receipt)

        # Create ReceiptItems
        items = gemini_result.get("items", [])
        for item_data in items:
            item = ReceiptItem(
                receipt_scan_id=receipt.id,
                raw_name=item_data.get("name"),
                canonical_name=item_data.get("name"),
                quantity=item_data.get("quantity", 1),
                price_per_unit=item_data.get("price_per_unit"),
                total_price=item_data.get("total_price"),
                is_discount=item_data.get("is_discount", False)
            )
            self.db.add(item)

        self.db.commit()

        # Link job to receipt
        job.receipt_scan_id = receipt.id


# Background task runner
async def run_scan_job_background(job_id: str):
    """Run scan job in background."""
    db = next(get_db())
    try:
        service = ScanJobService(db)
        await service.process_job(job_id)
    finally:
        db.close()
