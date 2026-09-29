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
            # Extract text with spatial clustering
            lines, confidence = _extract_with_rapidocr(image_bytes)
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
                    address=None
                )
            
            if len(text.strip()) < 10:
                logger.warning(f"OCR returned too little text ({len(text)} chars) - attempting Gemini Vision fallback")
                return self._gemini_vision_fallback(image_bytes)
            
            # Use Deterministic Parser v2 with proper cascade confidence
            try:
                from app.services.parser_engine_v2 import parse_receipt_text, should_use_gemini_fallback
                parsed = parse_receipt_text(lines)
                
                # Check if Gemini fallback is needed
                should_fallback, reason = should_use_gemini_fallback(parsed, len(text))
                if should_fallback:
                    logger.warning(f"Parser v2 failed ({reason}) - attempting Gemini Vision fallback")
                    return self._gemini_vision_fallback(image_bytes)
                
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
                    address=parsed.get('address')
                )
            except Exception as e:
                logger.exception(f"CRITICAL PARSER ERROR: {e}")
            
            # Fallback parsing
            return self._fallback_parse(text, confidence, lines)
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise ValueError(f"OCR processing failed: {str(e)}")

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
        """Fallback parsing when enterprise parser fails."""
        text_lower = text.lower()
        
        # Merchant
        merchant_name = None
        for pattern, (name, _) in self.MERCHANT_PATTERNS.items():
            if re.search(pattern, text_lower):
                merchant_name = name
                break
        
        # Amount
        amount_value = None
        amount_str = None
        amounts = []
        for line in lines:
            matches = re.findall(r'[\d.]+', line)
            for m in matches:
                try:
                    val = float(m.replace('.', ''))
                    if 1000 <= val <= 100000000:
                        amounts.append(val)
                except:
                    pass
        
        if amounts:
            amount_value = max(amounts)
            amount_str = f"Rp {int(amount_value):,}".replace(',', '.')
        
        # Payment method
        payment_method = None
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
        address = None
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
            date=None,
            payment_method=payment_method,
            items=[],
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
