"""
OCR Service with RapidOCR (ONNX) + Dynamic Y-Threshold + Image Resizing + Auto-Deskew
No PyTorch dependency - Pure ONNX Runtime for better performance
"""

import io
import re
import logging
from typing import Optional, Tuple, List, Dict, Any
from dataclasses import dataclass
from PIL import Image, ImageEnhance

logger = logging.getLogger(__name__)

# ============================================================
# OpenCV Image Processing Utilities
# ============================================================

def _deskew_image(binary_img) -> any:
    """
    Auto-straighten skewed receipt images for accurate Y-axis clustering.
    Tolerates skew up to 45 degrees.
    """
    try:
        import cv2
        import numpy as np
        
        # Find non-white pixels
        coords = np.column_stack(np.where(binary_img == 0))
        if len(coords) < 10:
            return binary_img
        
        # Calculate rotation angle from minAreaRect
        angle = cv2.minAreaRect(coords)[-1]
        
        # Normalize angle
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        else:
            angle = -angle
        
        # Only rotate if skew > 0.8 degrees
        if abs(angle) > 0.8:
            h, w = binary_img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            return cv2.warpAffine(binary_img, M, (w, h), flags=cv2.INTER_CUBIC, borderValue=255)
        
        return binary_img
        
    except Exception as e:
        logger.warning(f"Deskew failed: {e}")
        return binary_img


def _calculate_robust_y_threshold(box_heights: List[float]) -> float:
    """
    Calculate Y-Threshold free from outlier noise (micro text / logos).
    Uses IQR filtering: removes 10% top and bottom extremes before median.
    """
    import numpy as np
    
    if not box_heights:
        return 12.0
    
    # Filter extreme values using percentile (10% - 90%)
    q10 = np.percentile(box_heights, 10)
    q90 = np.percentile(box_heights, 90)
    filtered_heights = [h for h in box_heights if q10 <= h <= q90]
    
    # Use filtered median, fallback to original median
    median_h = np.median(filtered_heights) if filtered_heights else np.median(box_heights)
    
    return float(max(6.0, median_h * 0.45))


# ============================================================
# OCR Engine - RapidOCR ONNX (No system dependency)
# ============================================================

def _get_ocr_engine():
    """Lazy load RapidOCR engine."""
    if not hasattr(_get_ocr_engine, '_engine'):
        try:
            from rapidocr_onnxruntime import RapidOCR
            _get_ocr_engine._engine = RapidOCR()
            logger.info("RapidOCR engine loaded successfully")
        except ImportError:
            logger.warning("RapidOCR not available, using Tesseract fallback")
            _get_ocr_engine._engine = None
    return _get_ocr_engine._engine


def _preprocess_image_pil(image_bytes: bytes) -> bytes:
    """Preprocess image with PIL before OCR."""
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Resize if too large (max 1600px)
    width, height = image.size
    max_dim = 1600
    if max(width, height) > max_dim:
        scale = max_dim / max(width, height)
        new_size = (int(width * scale), int(height * scale))
        image = image.resize(new_size, Image.LANCZOS)
    
    # Enhance contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.3)
    
    # Sharpen
    enhancer = ImageEnhance.Sharpness(image)
    image = enhancer.enhance(1.2)
    
    # Convert to bytes
    output = io.BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()


def _extract_with_rapidocr(image_bytes: bytes) -> Tuple[List[str], float]:
    """
    Extract text using RapidOCR with Y-axis spatial clustering.
    Returns lines and average confidence score.
    """
    ocr_engine = _get_ocr_engine()
    
    if ocr_engine is None:
        # Fallback to Tesseract
        return _extract_with_tesseract_fallback(image_bytes)
    
    try:
        # Preprocess image
        preprocessed_bytes = _preprocess_image_pil(image_bytes)
        
        # Run RapidOCR
        result, elapse = ocr_engine(preprocessed_bytes)
        

        if not result:
            return [], 0.0
        
        # Collect elements with coordinates
        elements = []
        box_heights = []
        confidences = []
        
        # result format: [[box, text, score], ...]
        for line in result:
            box = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            text = line[1]
            score = line[2]
            
            if score < 0.25 or not text.strip():
                continue
            
            # Calculate bounding box metrics
            y_coords = [p[1] for p in box]
            x_coords = [p[0] for p in box]
            
            y_min, y_max = min(y_coords), max(y_coords)
            x_min = min(x_coords)
            
            height = y_max - y_min
            y_center = (y_min + y_max) / 2.0
            
            box_heights.append(height)
            elements.append({
                'text': text.strip(),
                'y_center': y_center,
                'x_min': x_min,
                'height': height
            })
            confidences.append(score)
        
        if not elements:
            return [], 0.0
        
        # Robust Dynamic Y-Threshold with outlier filtering (IQR percentile 10-90)
        dynamic_y_threshold = _calculate_robust_y_threshold(box_heights)
        
        # Sort by Y coordinate and group into lines
        elements.sort(key=lambda item: item['y_center'])
        lines = []
        current_line = []
        
        for elem in elements:
            if not current_line:
                current_line.append(elem)
            else:
                avg_y = sum(e['y_center'] for e in current_line) / len(current_line)
                if abs(elem['y_center'] - avg_y) <= dynamic_y_threshold:
                    current_line.append(elem)
                else:
                    # Sort by X coordinate (left to right)
                    current_line.sort(key=lambda e: e['x_min'])
                    lines.append(" ".join([e['text'] for e in current_line]))
                    current_line = [elem]
        
        # Last line
        if current_line:
            current_line.sort(key=lambda e: e['x_min'])
            lines.append(" ".join([e['text'] for e in current_line]))
        
        avg_conf = sum(confidences) / len(confidences) if confidences else 0
        return lines, avg_conf * 100
        
    except Exception as e:
        logger.error(f"RapidOCR extraction failed: {e}")
        return _extract_with_tesseract_fallback(image_bytes)


def _extract_with_multivariant_ocr(image_bytes: bytes) -> Tuple[List[str], float, Dict[str, Any]]:
    """
    Run the OCR engine over several restored versions of the same receipt and
    keep the best result.

    This is what makes crumpled / torn / folded / blurred receipts work.
    A single OCR pass over the original photo reliably misses half the text
    when the paper is damaged; running the engine over an illumination-
    flattened, deskewed, contrast-enhanced and binarised set of variants and
    picking the highest-scoring extraction recovers most of it.

    Returns (lines, confidence, diagnostics).
    """
    diagnostics: Dict[str, Any] = {
        "variants_tried": [],
        "quality": None,
        "restoration": [],
    }

    try:
        from app.services.image_preprocessor import image_preprocessor
    except Exception as e:
        logger.warning(f"Image preprocessor unavailable: {e}")
        lines, conf = _extract_with_rapidocr(image_bytes)
        return lines, conf, diagnostics

    try:
        variants, report = image_preprocessor.process(image_bytes)
        diagnostics["quality"] = {
            "severity": report.severity,
            "issues": report.issues,
            "brightness": round(report.brightness, 1),
            "contrast": round(report.contrast, 1),
            "sharpness": round(report.sharpness, 1),
            "skew_deg": round(report.estimated_skew_deg, 2),
            "is_blurry": report.is_blurry,
            "has_shadows": report.has_shadows,
            "width": report.width,
            "height": report.height,
        }
        if variants and variants[0].notes:
            diagnostics["restoration"] = list(variants[0].notes)
    except Exception as e:
        logger.warning(f"Preprocessing failed, using original image: {e}")
        lines, conf = _extract_with_rapidocr(image_bytes)
        return lines, conf, diagnostics

    best_lines: List[str] = []
    best_score = -1.0
    best_conf = 0.0
    best_variant = None

    for variant in variants:
        try:
            if variant.image is None:
                continue
            import cv2
            ok, encoded = cv2.imencode(".png", variant.image)
            if not ok:
                continue
            variant_bytes = encoded.tobytes()

            lines, conf = _extract_with_rapidocr(variant_bytes)
            diagnostics["variants_tried"].append({
                "name": variant.name,
                "lines": len(lines),
                "confidence": round(conf, 1),
            })

            # Score by how much text we recovered, weighted by the OCR's own
            # confidence. More characters at a similar confidence is better.
            char_count = sum(len(line) for line in lines)
            score = char_count * (conf / 100.0)
            if score > best_score:
                best_score = score
                best_lines = lines
                best_conf = conf
                best_variant = variant.name
        except Exception as e:
            logger.warning(f"OCR variant {variant.name} failed: {e}")
            continue
    if not best_lines:
        diagnostics["variants_tried"].append({
            "name": "tesseract_fallback",
            "lines": 0,
            "confidence": 0,
        })
        lines, conf = _extract_with_tesseract_fallback(image_bytes)
        diagnostics["best_variant"] = "tesseract_fallback"
        return lines, conf, diagnostics

    diagnostics["best_variant"] = best_variant
    logger.info(
        "Multi-variant OCR picked %s (score %.1f, %d lines)",
        best_variant, best_score, len(best_lines),
    )
    return best_lines, best_conf, diagnostics


def _extract_with_tesseract_fallback(image_bytes: bytes) -> Tuple[List[str], float]:
    """Fallback to Tesseract OCR with spatial clustering."""
    try:
        import pytesseract
        import numpy as np
        
        # Preprocess image
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too large
        width, height = image.size
        if width > 1600:
            scale = 1600 / width
            image = image.resize((1600, int(height * scale)), Image.LANCZOS)
        
        # Convert to grayscale
        gray = image.convert('L')
        
        # Enhance
        enhancer = ImageEnhance.Contrast(gray)
        gray = enhancer.enhance(1.3)
        
        # Get OCR data with bounding boxes
        data = pytesseract.image_to_data(gray, lang='eng+ind', output_type=pytesseract.Output.DICT)
        
        elements = []
        box_heights = []
        confidences = []
        n_boxes = len(data['text'])
        
        for i in range(n_boxes):
            text = data['text'][i].strip()
            conf = int(data['conf'][i])
            
            if conf > 20 and text:
                x = data['left'][i]
                y = data['top'][i]
                w = data['width'][i]
                h = data['height'][i]
                
                y_center = y + (h / 2.0)
                box_heights.append(h)
                
                elements.append({
                    'text': text,
                    'y_center': y_center,
                    'x_min': x,
                    'height': h
                })
                confidences.append(conf)
        
        if not elements:
            return [], 0.0
        
        # Dynamic Y-Threshold
        median_h = np.median(box_heights) if box_heights else 15
        dynamic_y_threshold = max(6.0, median_h * 0.4)
        
        # Sort and group
        elements.sort(key=lambda item: item['y_center'])
        lines = []
        current_line = []
        
        for elem in elements:
            if not current_line:
                current_line.append(elem)
            else:
                avg_y = sum(e['y_center'] for e in current_line) / len(current_line)
                if abs(elem['y_center'] - avg_y) <= dynamic_y_threshold:
                    current_line.append(elem)
                else:
                    current_line.sort(key=lambda e: e['x_min'])
                    lines.append(" ".join([e['text'] for e in current_line]))
                    current_line = [elem]
        
        if current_line:
            current_line.sort(key=lambda e: e['x_min'])
            lines.append(" ".join([e['text'] for e in current_line]))
        
        avg_conf = sum(confidences) / len(confidences) if confidences else 0
        return lines, min(avg_conf, 100)
        
    except Exception as e:
        logger.error(f"Tesseract fallback failed: {e}")
        return [], 0.0


# ============================================================
# OCR Result Dataclass
# ============================================================

@dataclass
class OCRResult:
    """Result from OCR processing."""
    text: str
    confidence: float
    raw_lines: List[str] = None  # Store raw lines for audit trail
    engine_confidence: float = 70.0  # Confidence from parser engine (math validation)
    merchant_name: Optional[str] = None
    amount: Optional[str] = None
    amount_value: Optional[float] = None
    date: Optional[str] = None
    payment_method: Optional[str] = None
    items: Optional[List[Dict]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    receipt_scan_id: Optional[int] = None  # ID of saved receipt scan
    # Diagnostics about how the image was restored and which OCR variant won.
    # Surfaced to the UI so a poor scan can be explained instead of silently
    # returning a wrong total.
    ocr_diagnostics: Optional[Dict[str, Any]] = None
    # The dynamic (LLM / statistical) parse of the raw OCR lines, used when
    # the rule-based parser cannot resolve the receipt.
    dynamic_parse: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.raw_lines is None:
            self.raw_lines = []


# ============================================================
# OCR Service Class (Legacy compatibility)
# ============================================================

class OCRService:
    """OCR Service using RapidOCR + Tesseract fallback."""
    
    # Indonesian merchant patterns
    MERCHANT_PATTERNS = {
        r'alfamart|alfamat': ('Alfamart', 'shopping'),
        r'indomaret': ('Indomaret', 'shopping'),
        r'family mart|familymart': ('Family Mart', 'shopping'),
        r'lawson': ('Lawson', 'shopping'),
        r"mcd|macdonald|mcdonald": ('McDonald\'s', 'food'),
        r'kfc': ('KFC', 'food'),
        r'subway': ('Subway', 'food'),
        r'pizza hut': ('Pizza Hut', 'food'),
        r'hokben|hokki': ('HokBen', 'food'),
        r'burger king': ('Burger King', 'food'),
        r'starbucks': ('Starbucks', 'food'),
        r'shopee': ('Shopee', 'shopping'),
        r'tokopedia': ('Tokopedia', 'shopping'),
        r'grab': ('Grab', 'transport'),
        r'gojek': ('Gojek', 'transport'),
        r'gopay': ('GoPay', 'payment'),
        r'dana': ('DANA', 'payment'),
        r'ovo': ('OVO', 'payment'),
        r'shopee pay|shopeepay': ('ShopeePay', 'payment'),
        r'linkaja|link aja': ('LinkAja', 'payment'),
    }

    def process_image(self, image_bytes: bytes) -> OCRResult:
        """Process receipt image and extract structured data."""
        try:
            # Extract text with spatial clustering.
            # Multi-variant mode restores damaged receipts (torn, folded,
            # crumpled, blurred) before OCR and keeps the best extraction.
            lines, confidence, ocr_diagnostics = _extract_with_multivariant_ocr(image_bytes)
            text = '\n'.join(lines)
            
            # Log raw OCR output for debugging
            logger.info(f"--- RAW OCR OUTPUT ---\n{text}\n--- LINES: {len(lines)} ---\n----------------------")
            
            # Validate OCR result - explicitly check for empty/poor extraction
            if not text or not text.strip():
                logger.warning("OCR Engine returned empty text - possible image quality issue")
                return OCRResult(
                    text="",
                    confidence=0.0,
                    raw_lines=[],
                    merchant_name=None,
                    amount="Rp 0",
                    amount_value=0.0,
                    items=[],
                    address=None,
                    ocr_diagnostics=ocr_diagnostics,
                )
            
            if len(text.strip()) < 10:
                logger.warning("OCR returned too little text (%d chars) - attempting Gemini Vision fallback", len(text))
                result = self._gemini_vision_fallback(image_bytes)
                result.ocr_diagnostics = ocr_diagnostics
                return result

            # Use Parser v3.1 with single-line item support
            try:
                from app.services.parser_engine_v31 import parse_receipt_text_v31, should_use_gemini_fallback_v31
                parsed = parse_receipt_text_v31(lines)
                
                logger.info(f"Parser v3.1 result: items={len(parsed.get('items', []))}, amount={parsed.get('amount')}, conf={parsed.get('confidence_score')}")
                
                # Check if Gemini fallback is needed (tightened triggers)
                should_fallback, reason = should_use_gemini_fallback_v31(parsed, len(text))
                if should_fallback:
                    logger.warning(f"Parser v3.1 failed ({reason}) - attempting dynamic parse")
                    dynamic = self._dynamic_parse_fallback(lines, ocr_diagnostics, confidence)
                    if dynamic is not None:
                        return dynamic
                    logger.warning("Dynamic parse produced nothing - attempting Gemini Vision fallback")
                    result = self._gemini_vision_fallback(image_bytes)
                    result.ocr_diagnostics = ocr_diagnostics
                    return result
                
                items = []
                for item in parsed.get('items', []):
                    items.append({
                        'name': item.get('name', ''),
                        'price': item.get('total_price', 0),
                        'quantity': item.get('quantity', 1)
                    })
                
                # Safely format amount
                amount_val = parsed.get('amount', 0)
                if isinstance(amount_val, str):
                    amount_val = float(amount_val.replace('Rp ', '').replace('.', '').replace(',', '.')) if amount_val else 0
                amount_val = int(float(amount_val))
                
                return OCRResult(
                    text=text[:500] if text else "",
                    confidence=confidence,
                    raw_lines=lines,
                    engine_confidence=parsed.get('confidence_score', 70.0),
                    merchant_name=parsed.get('merchant_name'),
                    amount=f"Rp {amount_val:,}".replace(',', '.'),
                    amount_value=float(amount_val),
                    date=parsed.get('date'),
                    payment_method=parsed.get('payment_method'),
                    items=items,
                    latitude=None,
                    longitude=None,
                    address=parsed.get('address'),
                    ocr_diagnostics=ocr_diagnostics,
                )
            except Exception as e:
                logger.exception(f"CRITICAL PARSER ERROR: {e}")
            
            # Dynamic parse before the generic fallback
            dynamic = self._dynamic_parse_fallback(lines, ocr_diagnostics, confidence)
            if dynamic is not None:
                return dynamic
            
            # Fallback parsing
            result = self._fallback_parse(text, confidence, lines)
            result.ocr_diagnostics = ocr_diagnostics
            return result
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise ValueError(f"OCR processing failed: {str(e)}")

    def _dynamic_parse_fallback(
        self,
        lines: List[str],
        ocr_diagnostics: Optional[Dict[str, Any]] = None,
        confidence: float = 0.0,
    ) -> Optional[OCRResult]:
        """Parse the OCR lines with the LLM / statistical dynamic parser.

        This is the path that handles product names we have never seen
        before. The LLM repairs words broken by torn paper using the
        surrounding context; without an LLM the statistical classifier
        groups unseen words by shape similarity instead.

        Returns None when the dynamic parser cannot produce a usable result,
        so the caller can escalate to Gemini Vision.
        """
        try:
            from app.services.dynamic_text_parser import dynamic_text_parser
        except Exception as e:
            logger.warning(f"Dynamic parser unavailable: {e}")
            return None

        try:
            parsed = dynamic_text_parser.parse(lines)
        except Exception as e:
            logger.warning(f"Dynamic parse failed: {e}")
            return None

        if not parsed or not parsed.items:
            logger.info("Dynamic parser found no items")
            return None

        amount = parsed.total
        if amount is None:
            # Derive the total from the items when the receipt did not state it.
            derived = sum((i.qty or 1) * (i.price or 0) for i in parsed.items)
            amount = derived if derived > 0 else None

        if amount is None or amount <= 0:
            logger.info("Dynamic parser found no usable total")
            return None

        items = [
            {
                'name': item.item_name,
                'price': float(item.price or 0),
                'quantity': float(item.qty or 1),
                'total_price': float((item.qty or 1) * (item.price or 0)),
            }
            for item in parsed.items
        ]

        payload = {
            "engine": parsed.engine,
            "store_name": parsed.store_name,
            "total": amount,
            "subtotal": parsed.subtotal,
            "tax": parsed.tax,
            "discount": parsed.discount,
            "date": parsed.transaction_date,
            "time": parsed.transaction_time,
            "confidence": parsed.confidence,
            "notes": parsed.notes,
        }

        logger.info(
            "Dynamic parse succeeded via %s: %d items, total %.0f",
            parsed.engine, len(items), amount,
        )

        amount_val = int(float(amount))
        return OCRResult(
            text="\n".join(lines)[:500],
            confidence=confidence,
            raw_lines=lines,
            engine_confidence=parsed.confidence * 100,
            merchant_name=parsed.store_name,
            amount=f"Rp {amount_val:,}".replace(',', '.'),
            amount_value=float(amount_val),
            date=parsed.transaction_date,
            payment_method=parsed.payment_method,
            items=items,
            address=parsed.store_address,
            ocr_diagnostics=ocr_diagnostics,
            dynamic_parse=payload,
        )

    def _gemini_vision_fallback(self, image_bytes: bytes) -> OCRResult:
        """Use Gemini Vision AI when local OCR fails."""
        from app.core.config import get_settings
        from app.services.gemini_vision import extract_receipt_with_gemini, format_gemini_result
        
        settings = get_settings()
        
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not set - cannot use Vision fallback")
            return OCRResult(
                text="",
                confidence=0.0,
                raw_lines=[],
                merchant_name=None,
                amount="Rp 0",
                amount_value=0.0,
                items=[],
                address=None
            )
        
        logger.info("Attempting Gemini Vision AI fallback...")
        result = extract_receipt_with_gemini(image_bytes, settings.GEMINI_API_KEY)
        
        if result:
            return format_gemini_result(result)
        
        return OCRResult(
            text="",
            confidence=0.0,
            raw_lines=[],
            merchant_name=None,
            amount="Rp 0",
            amount_value=0.0,
            items=[],
            address=None
        )

    def _fallback_parse(self, text: str, confidence: float, lines: List[str]) -> OCRResult:
        """Fallback parsing using Parser v3.1 for full item extraction."""
        from app.services.parser_engine_v31 import parse_receipt_text_v31
        
        # Use v3.1 parser for full extraction
        parsed = parse_receipt_text_v31(lines)
        
        # Extract items from v3.1 result
        items = []
        for item in parsed.get('items', []):
            items.append({
                'name': item.get('name', ''),
                'quantity': item.get('quantity', 1),
                'price_per_unit': item.get('price_per_unit', 0),
                'total_price': item.get('total_price', 0)
            })
        
        # Amount
        amount_value = parsed.get('amount', 0)
        amount_str = f"Rp {int(amount_value):,}".replace(',', '.') if amount_value else None
        
        # Merchant
        merchant_name = parsed.get('merchant_name')
        if not merchant_name:
            text_lower = text.lower()
            for pattern, (name, _) in self.MERCHANT_PATTERNS.items():
                if re.search(pattern, text_lower):
                    merchant_name = name
                    break
        
        # Payment method
        payment_method = parsed.get('payment_method')
        if not payment_method:
            text_lower = text.lower()
            payment_patterns = {
                r'gopay': 'GoPay',
                r'dana': 'DANA',
                r'ovo': 'OVO',
                r'cash|tunai': 'Cash',
                r'debit': 'Debit',
                r'qris': 'QRIS',
            }
            for pattern, method in payment_patterns.items():
                if re.search(pattern, text_lower):
                    payment_method = method
                    break
        
        # Address
        address = parsed.get('address')
        if not address:
            for line in lines[:5]:
                if re.search(r'jl\.?\s|jalan|jl\s', line, re.I):
                    address = line.strip()
                    break
        
        return OCRResult(
            text=text[:500],
            confidence=confidence,
            raw_lines=lines,
            merchant_name=merchant_name,
            amount=amount_str,
            amount_value=amount_value,
            date=parsed.get('date'),
            payment_method=payment_method,
            items=items,
            latitude=None,
            longitude=None,
            address=address
        )

    def get_status(self) -> Dict[str, Any]:
        """Get OCR status."""
        ocr = _get_ocr_engine()
        return {
            "status": "ready",
            "engine": "RapidOCR" if ocr else "Tesseract",
            "message": "OCR ready"
        }


# Singleton instance
ocr_service = OCRService()
