# ============================================================
# ANCHOR ENGINE - Fuzzy Search + Bottom-Up Scanning
# NO hardcoded vendor names, uses configurable keyword sets
# ============================================================

import re
from typing import Optional, List, Tuple, Dict
from dataclasses import dataclass


@dataclass
class AnchorResult:
    found: bool
    keyword: str
    score: float
    value: Optional[str] = None


class FuzzyMatcher:
    """
    Fuzzy string matching using Levenshtein distance.
    Threshold: >= 80% similarity
    """
    
    @staticmethod
    def levenshtein_distance(s1: str, s2: str) -> int:
        """Calculate Levenshtein distance."""
        if len(s1) < len(s2):
            return FuzzyMatcher.levenshtein_distance(s2, s1)
        if len(s2) == 0:
            return len(s1)
        
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    @staticmethod
    def similarity_ratio(s1: str, s2: str) -> float:
        """Calculate similarity ratio (0.0 - 1.0)."""
        if not s1 and not s2:
            return 1.0
        
        s1_upper = s1.upper().strip()
        s2_upper = s2.upper().strip()
        
        distance = FuzzyMatcher.levenshtein_distance(s1_upper, s2_upper)
        max_len = max(len(s1_upper), len(s2_upper))
        
        if max_len == 0:
            return 1.0
        
        return 1.0 - (distance / max_len)
    
    @classmethod
    def match(cls, text: str, keywords: List[str], threshold: float = 0.80) -> Tuple[bool, str, float]:
        """
        Check if text matches any keyword with fuzzy matching.
        
        Returns:
            (matched, best_keyword, score)
        """
        text_upper = text.upper().strip()
        
        for keyword in keywords:
            keyword_upper = keyword.upper()
            
            # Exact substring match
            if keyword_upper in text_upper:
                return True, keyword, 1.0
            
            # Fuzzy match
            score = cls.similarity_ratio(text_upper, keyword_upper)
            if score >= threshold:
                return True, keyword, score
        
        return False, "", 0.0


class AnchorEngine:
    """
    Configurable anchor detection using fuzzy matching.
    Supports Bottom-Up and Top-Down scanning.
    """
    
    def __init__(self, config: Dict = None):
        """
        Initialize with config.
        
        Config structure:
        {
            'total_keywords': [...],
            'date_keywords': [...],
            'merchant_skip_patterns': [...],
            'fuzzy_threshold': 0.80
        }
        """
        self.config = config or self._default_config()
        self.fuzzy_threshold = self.config.get('fuzzy_threshold', 0.80)
    
    def _default_config(self) -> Dict:
        """Default configuration - NO hardcoded vendor names."""
        return {
            'total_keywords': [
                'TOTAL', 'GRAND TOTAL', 'HARGA JUAL', 'SUBTOTAL',
                'JUMLAH', 'BAYAR', 'HARUS DIBAYAR', 'TOTAL BAYAR'
            ],
            'discard_keywords': [
                'TUNAI', 'CASH', 'KEMBALI', 'DISKON', 
                'ANDA HEMAT', 'VOUCHER', 'BONUS'
            ],
            'date_keywords': [
                'TGL', 'TANGGAL', 'DATE', 'TIME', 'WAKTU'
            ],
            'merchant_skip_patterns': [
                r'^[0-9]+$',  # Pure numbers
                r'^[\d\s\.\-\:\/]+$',  # Date/time patterns
            ],
            'fuzzy_threshold': 0.80
        }
    
    def find_total_bottom_up(self, lines: List[str]) -> AnchorResult:
        """
        Find TOTAL anchor by scanning from BOTTOM-UP.
        
        Algorithm:
        1. Scan lines from bottom to top
        2. For each line, check fuzzy match against TOTAL_KEYWORDS
        3. Extract first large number from matching line
        
        Returns:
            AnchorResult with found status, keyword, and extracted value
        """
        total_keywords = self.config.get('total_keywords', [])
        
        # Bottom-up scan
        for i in range(len(lines) - 1, -1, -1):
            line = lines[i].strip()
            if not line:
                continue
            
            matched, keyword, score = FuzzyMatcher.match(line, total_keywords, self.fuzzy_threshold)
            
            if matched:
                # Extract number from this line
                value = self._extract_first_large_number(line)
                return AnchorResult(found=True, keyword=keyword, score=score, value=value)
        
        return AnchorResult(found=False, keyword="", score=0.0)
    
    def find_merchant_top(self, lines: List[str]) -> AnchorResult:
        """
        Find merchant name by scanning from TOP-DOWN.
        
        Algorithm:
        1. Scan first 5-10 lines
        2. Skip lines matching skip patterns (dates, numbers)
        3. Return first line with sufficient alphabetic content
        
        Returns:
            AnchorResult with merchant name
        """
        merchant_skip = self.config.get('merchant_skip_patterns', [])
        
        for line in lines[:10]:
            line_clean = line.strip()
            if not line_clean:
                continue
            
            # Skip empty
            if not line_clean:
                continue
            
            # Skip patterns
            should_skip = False
            for pattern in merchant_skip:
                if re.match(pattern, line_clean):
                    should_skip = True
                    break
            
            if should_skip:
                continue
            
            # Skip lines with garbage
            garbage = ['DOWNLOAD', 'HTTP', 'WWW', '口品', '★']
            if any(g in line_clean.upper() for g in garbage):
                continue
            
            # Must have alphabetic characters
            alpha_count = sum(1 for c in line_clean if c.isalpha())
            if alpha_count >= 2:
                return AnchorResult(found=True, keyword="merchant", score=1.0, value=line_clean)
        
        return AnchorResult(found=False, keyword="", score=0.0)
    
    def find_date(self, lines: List[str]) -> AnchorResult:
        """
        Find date using generic date pattern.
        
        Returns:
            AnchorResult with found date string
        """
        date_patterns = [
            r'(\d{1,2})[\.\-](\d{1,2})[\.\-](\d{2,4})',  # DD-MM-YY or DD-MM-YYYY
            r'(\d{4})[\.\-](\d{1,2})[\.\-](\d{1,2})',  # YYYY-MM-DD
        ]
        
        for line in lines[:15]:
            for pattern in date_patterns:
                match = re.search(pattern, line)
                if match:
                    return AnchorResult(found=True, keyword="date", score=1.0, value=match.group(0))
        
        return AnchorResult(found=False, keyword="", score=0.0)
    
    def find_item_region(self, lines: List[str]) -> Tuple[int, int]:
        """
        Find item region boundaries.
        
        Returns:
            (start_index, end_index)
        """
        # Find start (after separator or first item line)
        index_start = 0
        for i, line in enumerate(lines[:15]):
            if '---' in line or '===' in line:
                index_start = i + 1
                break
        
        # Find end (first anchor line from bottom)
        index_end = len(lines)
        total_keywords = self.config.get('total_keywords', [])
        discard_keywords = self.config.get('discard_keywords', [])
        all_anchors = total_keywords + discard_keywords
        
        for i, line in enumerate(lines):
            matched, _, _ = FuzzyMatcher.match(line, all_anchors, self.fuzzy_threshold)
            if matched:
                index_end = i
                break
        
        return index_start, index_end
    
    def _extract_first_large_number(self, line: str) -> Optional[str]:
        """Extract first large number (likely total) from line."""
        # Pattern for Indonesian currency: digits with thousand separators
        pattern = r'([\d]{1,3}(?:[.,][\d]{3})+)'
        
        matches = re.findall(pattern, line)
        if matches:
            # Return largest number
            numbers = []
            for m in matches:
                clean = m.replace('.', '').replace(',', '')
                try:
                    numbers.append(int(clean))
                except ValueError:
                    continue
            
            if numbers:
                return str(max(numbers))
        
        # Fallback: any number > 1000
        pattern = r'(\d{4,})'
        matches = re.findall(pattern, line)
        if matches:
            return max(matches, key=lambda x: int(x))
        
        return None
