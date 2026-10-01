# ============================================================
# FUZZY MATCHING ENGINE
# ============================================================
# Uses Levenshtein Distance for fuzzy keyword matching
# ============================================================

from typing import List, Tuple, Optional
import re


def levenshtein_distance(s1: str, s2: str) -> int:
    """
    Calculate Levenshtein distance between two strings.
    """
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
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


def similarity_ratio(s1: str, s2: str) -> float:
    """
    Calculate similarity ratio between two strings (0.0 - 1.0).
    """
    if not s1 and not s2:
        return 1.0
    
    distance = levenshtein_distance(s1.upper(), s2.upper())
    max_len = max(len(s1), len(s2))
    
    if max_len == 0:
        return 1.0
    
    return 1.0 - (distance / max_len)


def fuzzy_match(text: str, keywords: List[str], threshold: float = 0.75) -> Tuple[bool, str, float]:
    """
    Check if text matches any keyword with fuzzy matching.
    
    Args:
        text: Input text to check
        keywords: List of keywords to match against
        threshold: Minimum similarity ratio (0.0 - 1.0)
        
    Returns:
        Tuple of (matched, best_match, score)
    """
    text_upper = text.upper().strip()
    
    best_match = ""
    best_score = 0.0
    
    for keyword in keywords:
        # Exact match
        if keyword.upper() in text_upper:
            return True, keyword, 1.0
        
        # Substring match with partial similarity
        if len(keyword) >= 3:
            # Check if keyword is in text
            score = similarity_ratio(text_upper, keyword.upper())
            if score > best_score:
                best_score = score
                best_match = keyword
    
    if best_score >= threshold:
        return True, best_match, best_score
    
    return False, best_match, best_score


def fuzzy_match_any(text: str, keywords: List[str], threshold: float = 0.75) -> Tuple[bool, Optional[str], float]:
    """
    Check if text matches ANY keyword in the list.
    
    Returns:
        (matched, matched_keyword, score)
    """
    text_upper = text.upper().strip()
    
    for keyword in keywords:
        # Exact substring match
        if keyword.upper() in text_upper:
            return True, keyword, 1.0
        
        # Fuzzy match
        score = similarity_ratio(text_upper, keyword.upper())
        if score >= threshold:
            return True, keyword, score
    
    return False, None, 0.0


def fuzzy_contains_any(text: str, keywords: List[str], threshold: float = 0.80) -> Tuple[bool, List[Tuple[str, float]]]:
    """
    Check if text CONTAINS any fuzzy-matched keyword.
    Useful for checking if a line contains anchor keywords.
    
    Returns:
        (has_match, [(keyword, score), ...])
    """
    text_upper = text.upper()
    matches = []
    
    for keyword in keywords:
        # Check each word in text against keyword
        words = text_upper.split()
        for word in words:
            score = similarity_ratio(word, keyword.upper())
            if score >= threshold:
                matches.append((keyword, score))
                break
        
        # Also check keyword substring in text
        if keyword.upper() in text_upper:
            matches.append((keyword, 1.0))
    
    return len(matches) > 0, matches


def extract_fuzzy_number(text: str) -> Optional[float]:
    """
    Extract number from text with fuzzy tolerance.
    """
    # Try to find numbers with various separators
    patterns = [
        r'([\d]+)',           # Plain digits
        r'([\d]+)\.([\d]+)',  # Dot separator
        r'([\d]+),([\d]+)',   # Comma separator
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            num_str = ''.join(match.groups())
            try:
                return float(num_str)
            except ValueError:
                continue
    
    return None


class FuzzyAnchorMatcher:
    """
    Configurable fuzzy anchor matcher for receipt parsing.
    """
    
    def __init__(self, config: dict = None):
        self.config = config or {}
        self.anchors = self.config.get('receipt_anchors', {})
        self.threshold = self.anchors.get('item_end', {}).get('fuzzy_threshold', 0.75)
    
    def find_item_end_index(self, lines: List[str]) -> int:
        """
        Find the index where item section ends using fuzzy matching.
        Returns index of first anchor line (exclusive boundary).
        """
        anchor_keywords = self.anchors.get('item_end', {}).get('fuzzy_keywords', [
            'TOTAL', 'SUBTOTAL', 'HARGA JUAL', 'BAYAR', 'CASH', 'TUNAI'
        ])
        
        for i, line in enumerate(lines):
            matched, _, score = fuzzy_match_any(line, anchor_keywords, self.threshold)
            if matched:
                return i
        
        return len(lines)
    
    def find_item_start_index(self, lines: List[str]) -> int:
        """
        Find the index where item section starts.
        """
        separator_lines = self.anchors.get('item_start', {}).get('separator_lines', [
            '---', '===', '___'
        ])
        
        # Look for separator
        for i, line in enumerate(lines):
            if any(sep in line for sep in separator_lines):
                return i + 1
        
        # No separator found, look for first non-metadata line
        for i, line in enumerate(lines):
            line_clean = line.strip()
            if not line_clean:
                continue
            # Skip pure date/time lines
            if re.match(r'^[\d\.\-\:\s]+$', line_clean) and len(line_clean) < 25:
                continue
            return i
        
        return 0
    
    def is_valid_merchant_line(self, line: str) -> bool:
        """
        Check if line is a valid merchant name.
        """
        skip_patterns = self.anchors.get('merchant', {}).get('skip_patterns', [])
        
        line_upper = line.upper()
        
        # Check skip patterns
        for pattern in skip_patterns:
            if re.match(pattern, line_upper):
                return False
        
        # Must have alphabetic characters
        alpha_count = sum(1 for c in line if c.isalpha())
        if alpha_count < 2:
            return False
        
        # Length check
        merchant_config = self.anchors.get('merchant', {})
        min_len = merchant_config.get('min_length', 2)
        max_len = merchant_config.get('max_length', 50)
        
        if not (min_len <= len(line.strip()) <= max_len):
            return False
        
        return True
