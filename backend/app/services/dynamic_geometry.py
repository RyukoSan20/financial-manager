# ============================================================
# DYNAMIC GEOMETRY ENGINE
# ============================================================
# Dynamic spatial reconstruction based on actual OCR box dimensions
# ============================================================

from dataclasses import dataclass
from typing import List, Optional, Tuple
import statistics


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
    
    @property
    def center_y(self) -> float:
        return (self.y_min + self.y_max) / 2
    
    def normalized_coords(self, page_width: float, page_height: float) -> 'OCRWord':
        """Return word with normalized coordinates (0.0 - 1.0)."""
        return OCRWord(
            text=self.text,
            x_min=self.x_min / page_width if page_width else 0,
            y_min=self.y_min / page_height if page_height else 0,
            x_max=self.x_max / page_width if page_width else 0,
            y_max=self.y_max / page_height if page_height else 0,
            confidence=self.confidence
        )


@dataclass
class OCRLine:
    """Reconstructed line."""
    text: str
    y_min: float
    y_max: float
    words: List[OCRWord]
    normalized_y_min: float = 0.0
    normalized_y_max: float = 0.0


class DynamicSpatialReconstructor:
    """
    Dynamically calculates spatial tolerances based on actual OCR output.
    
    Algorithm:
    1. Calculate dynamic Y-tolerance from box heights
    2. Use normalized coordinates for device-independent grouping
    3. Adaptive clustering based on document characteristics
    """
    
    def __init__(self, tolerance_multiplier: float = 0.5):
        """
        Args:
            tolerance_multiplier: Multiplier for dynamic tolerance calculation
        """
        self.tolerance_multiplier = tolerance_multiplier
    
    def calculate_dynamic_tolerance(self, words: List[OCRWord]) -> float:
        """
        Calculate Y-tolerance dynamically based on box heights.
        
        Formula: dynamic_y_tolerance = median(box_heights) * multiplier
        
        This adapts to:
        - High-res images (48MP): larger tolerance needed
        - Low-res/compressed images: smaller tolerance needed
        """
        if not words:
            return 10.0  # Default fallback
        
        # Calculate box heights
        box_heights = [word.height for word in words if word.height > 0]
        
        if not box_heights:
            return 10.0
        
        # Use median for robustness against outliers
        median_height = statistics.median(box_heights)
        
        # Dynamic tolerance = 50% of median height
        dynamic_tolerance = median_height * self.tolerance_multiplier
        
        # Clamp to reasonable range (5px - 50px)
        return max(5.0, min(50.0, dynamic_tolerance))
    
    def calculate_page_dimensions(self, words: List[OCRWord]) -> Tuple[float, float]:
        """Calculate page dimensions from word bounding boxes."""
        if not words:
            return 1000.0, 1000.0  # Default fallback
        
        max_x = max(word.x_max for word in words)
        max_y = max(word.y_max for word in words)
        
        return max_x, max_y
    
    def reconstruct_lines(self, words: List[OCRWord]) -> List[str]:
        """
        Reconstruct lines using dynamic tolerance.
        
        Returns:
            List of reconstructed text lines
        """
        if not words:
            return []
        
        # Calculate dynamic tolerance
        dynamic_tolerance = self.calculate_dynamic_tolerance(words)
        
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
            
            # Check if word is on same horizontal line using dynamic tolerance
            y_diff = abs(word.y_min - avg_y)
            
            if y_diff <= dynamic_tolerance:
                current_line.append(word)
                current_y_sum += word.y_min
            else:
                # Finish current line
                line = self._sort_and_join(current_line)
                if line.text.strip():
                    lines.append(line.text)
                
                # Start new line
                current_line = [word]
                current_y_sum = word.y_min
        
        # Don't forget the last line
        if current_line:
            line = self._sort_and_join(current_line)
            if line.text.strip():
                lines.append(line.text)
        
        return lines
    
    def reconstruct_with_metadata(self, words: List[OCRWord]) -> List[OCRLine]:
        """
        Reconstruct lines with Y-coordinate metadata.
        
        Returns:
            List of OCRLine objects with spatial info
        """
        if not words:
            return []
        
        # Calculate dimensions for normalization
        page_width, page_height = self.calculate_page_dimensions(words)
        
        # Calculate dynamic tolerance
        dynamic_tolerance = self.calculate_dynamic_tolerance(words)
        
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
            
            avg_y = current_y_sum / len(current_line)
            y_diff = abs(word.y_min - avg_y)
            
            if y_diff <= dynamic_tolerance:
                current_line.append(word)
                current_y_sum += word.y_min
            else:
                # Finish line
                line = self._create_ocr_line(current_line, page_width, page_height)
                if line.text.strip():
                    lines.append(line)
                
                current_line = [word]
                current_y_sum = word.y_min
        
        # Last line
        if current_line:
            line = self._create_ocr_line(current_line, page_width, page_height)
            if line.text.strip():
                lines.append(line)
        
        return lines
    
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
    
    def _create_ocr_line(self, words: List[OCRWord], page_width: float, page_height: float) -> OCRLine:
        """Create OCRLine with normalized coordinates."""
        sorted_words = sorted(words, key=lambda w: w.x_min)
        text = " ".join(w.text for w in sorted_words)
        
        y_min = min(w.y_min for w in sorted_words)
        y_max = max(w.y_max for w in sorted_words)
        
        # Normalized Y coordinates
        norm_y_min = y_min / page_height if page_height else 0
        norm_y_max = y_max / page_height if page_height else 0
        
        return OCRLine(
            text=text,
            y_min=y_min,
            y_max=y_max,
            words=sorted_words,
            normalized_y_min=norm_y_min,
            normalized_y_max=norm_y_max
        )


def parse_ocr_response(response: dict) -> List[OCRWord]:
    """
    Parse OCR response into OCRWord objects.
    
    Args:
        response: OCR response with word bounding boxes
        
    Returns:
        List of OCRWord objects
    """
    words = []
    
    # RapidOCR format
    if 'words' in response:
        for word_data in response['words']:
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
            except (ValueError, TypeError):
                continue
    
    return words


def reconstruct_from_plain_text(text: str) -> List[str]:
    """
    Fallback: Parse plain text line by line.
    Used when OCR doesn't provide bounding boxes.
    """
    lines = []
    for line in text.split('\n'):
        line = line.strip()
        if line:
            lines.append(line)
    return lines
