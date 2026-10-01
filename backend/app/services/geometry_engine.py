# ============================================================
# GEOMETRY ENGINE - Spatial OCR Reconstruction
# ============================================================
# 
# Reconstructs receipt lines from OCR bounding boxes using Y-axis
# clustering and X-axis sorting. Ensures prices align with items.
# ============================================================

from dataclasses import dataclass
from typing import List, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class OCRWord:
    """Single word with bounding box coordinates."""
    text: str
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    confidence: float = 1.0
    
    @property
    def width(self) -> float:
        return self.x_max - self.x_min
    
    @property
    def height(self) -> float:
        return self.y_max - self.y_min


@dataclass
class OCRLine:
    """Reconstructed line with words."""
    text: str
    y_min: float
    y_max: float
    words: List[OCRWord]


class SpatialLineReconstructor:
    """
    Reconstructs document structure from OCR bounding boxes.
    
    Algorithm:
    1. Sort words by Y-top coordinate
    2. Cluster words into lines using Y-tolerance
    3. Sort words within each line by X-min (left to right)
    4. Join words to form lines
    """
    
    def __init__(self, y_tolerance: float = 8.0):
        """
        Args:
            y_tolerance: Vertical tolerance for same-line grouping (pixels)
        """
        self.y_tolerance = y_tolerance
    
    def reconstruct_lines(self, words: List[OCRWord]) -> List[str]:
        """
        Reconstruct lines from OCR words.
        
        Args:
            words: List of OCRWord objects with coordinates
            
        Returns:
            List of reconstructed text lines
        """
        if not words:
            return []
        
        # Sort by Y-top
        sorted_words = sorted(words, key=lambda w: w.y_min)
        
        lines = []
        current_line: List[OCRWord] = []
        current_y_sum = 0.0
        
        for word in sorted_words:
            if not current_line:
                current_line.append(word)
                current_y_sum = word.y_min
                continue
            
            # Calculate average Y of current line
            avg_y = current_y_sum / len(current_line)
            
            # Check if word is on same horizontal line
            if abs(word.y_min - avg_y) <= self.y_tolerance:
                current_line.append(word)
                current_y_sum += word.y_min
            else:
                # Finish current line
                line = self._sort_and_join(current_line)
                if line.text.strip():
                    lines.append(line)
                
                # Start new line
                current_line = [word]
                current_y_sum = word.y_min
        
        # Don't forget the last line
        if current_line:
            line = self._sort_and_join(current_line)
            if line.text.strip():
                lines.append(line)
        
        return [l.text for l in lines]
    
    def _sort_and_join(self, words: List[OCRWord]) -> OCRLine:
        """Sort words left-to-right and join."""
        sorted_words = sorted(words, key=lambda w: w.x_min)
        text = " ".join(w.text for w in sorted_words)
        
        if not sorted_words:
            return OCRLine(text="", y_min=0, y_max=0, words=[])
        
        return OCRLine(
            text=text,
            y_min=min(w.y_min for w in sorted_words),
            y_max=max(w.y_max for w in sorted_words),
            words=sorted_words
        )


class ReceiptSpatialParser:
    """
    Parses receipt structure using spatial layout analysis.
    """
    
    def __init__(self, y_tolerance: float = 8.0, x_price_min: float = 0.6):
        """
        Args:
            y_tolerance: Vertical tolerance for line grouping
            x_price_min: Minimum X position ratio for price columns (0.0-1.0)
        """
        self.reconstructor = SpatialLineReconstructor(y_tolerance)
        self.x_price_min = x_price_min
    
    def parse_from_ocr_response(self, ocr_result: dict) -> List[str]:
        """
        Parse OCR result with bounding boxes into lines.
        
        Args:
            ocr_result: Dict with 'words' containing list of word dicts:
                [{'text': 'word', 'x_min': 10, 'y_min': 20, 'x_max': 50, 'y_max': 30}, ...]
                
        Returns:
            List of reconstructed text lines
        """
        words = []
        
        for word_data in ocr_result.get('words', []):
            try:
                word = OCRWord(
                    text=str(word_data.get('text', '')),
                    x_min=float(word_data.get('x_min', 0)),
                    y_min=float(word_data.get('y_min', 0)),
                    x_max=float(word_data.get('x_max', 0)),
                    y_max=float(word_data.get('y_max', 0)),
                    confidence=float(word_data.get('confidence', 1.0))
                )
                words.append(word)
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid word data: {word_data}, error: {e}")
        
        return self.reconstructor.reconstruct_lines(words)
    
    def extract_columns(self, line: str, image_width: float = 1000.0) -> dict:
        """
        Extract columns from a line based on X positions.
        Returns name on left, prices on right.
        """
        # This is a placeholder - actual implementation depends on OCR output format
        return {"text": line, "name": line, "prices": []}


def parse_raw_ocr_text(raw_text: str) -> List[str]:
    """
    Fallback: Parse plain text line by line.
    Used when OCR doesn't provide bounding boxes.
    """
    lines = []
    for line in raw_text.split('\n'):
        line = line.strip()
        if line:
            lines.append(line)
    return lines
