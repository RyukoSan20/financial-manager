# ============================================================
# CONFIDENCE ENGINE - Weighted Scoring System
# ============================================================
#
# Calculates mathematical confidence score (0.00 - 1.00) based on
# weighted validation of receipt components.
#
# Formula:
#   Score = (0.20 × S_m) + (0.15 × S_d) + (0.45 × S_t) + (0.20 × S_i)
#
# Where:
#   S_m = Merchant Score (0 or 1)
#   S_d = Date Score (0 or 1)
#   S_t = Math Check Score (0-1, weighted 45%)
#   S_i = Items Integrity Score (0 or 1)
# ============================================================

from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


# Weights for each component
WEIGHT_MERCHANT = 0.20   # Merchant name valid
WEIGHT_DATE = 0.15       # Date valid
WEIGHT_MATH = 0.45       # Math validation (most important)
WEIGHT_ITEMS = 0.20      # Items integrity

# Threshold for auto-commit
COMMIT_THRESHOLD = 0.85


def calculate_confidence(data: Dict[str, Any]) -> float:
    """
    Calculate weighted confidence score for parsed receipt.
    
    Args:
        data: Dict with keys:
            - merchant_name: str
            - date: str (YYYY-MM-DD)
            - items: list of dicts with 'price_per_unit', 'total_price', 'quantity'
            - subtotal: float
            - discount: float
            - total_amount: float
            
    Returns:
        float: Confidence score between 0.0 and 1.0
    """
    score = 0.0
    details = {}
    
    # 1. Merchant Score (20%)
    merchant_score = _calculate_merchant_score(data.get('merchant_name'))
    score += WEIGHT_MERCHANT * merchant_score
    details['merchant_score'] = merchant_score
    
    # 2. Date Score (15%)
    date_score = _calculate_date_score(data.get('date'))
    score += WEIGHT_DATE * date_score
    details['date_score'] = date_score
    
    # 3. Items Integrity Score (20%)
    items_score = _calculate_items_score(data.get('items', []))
    score += WEIGHT_ITEMS * items_score
    details['items_score'] = items_score
    details['items_count'] = len(data.get('items', []))
    
    # 4. Math Check Score (45%) - Most Important
    math_score = _calculate_math_score(
        items=data.get('items', []),
        subtotal=data.get('subtotal', 0),
        discount=data.get('discount', 0),
        total_amount=data.get('total_amount', 0)
    )
    score += WEIGHT_MATH * math_score
    details['math_score'] = math_score
    
    # Round to 2 decimal places
    final_score = round(score, 2)
    details['final_score'] = final_score
    details['weights'] = {
        'merchant': WEIGHT_MERCHANT,
        'date': WEIGHT_DATE,
        'math': WEIGHT_MATH,
        'items': WEIGHT_ITEMS
    }
    
    logger.info(f"Confidence calculation: {details}")
    
    return final_score


def _calculate_merchant_score(merchant_name: Optional[str]) -> float:
    """Score 1.0 if merchant name is valid, else 0.0."""
    if not merchant_name:
        return 0.0
    
    name = str(merchant_name).strip()
    
    # Must have at least 2 alphabetic characters
    alpha_count = sum(1 for c in name if c.isalpha())
    if alpha_count < 2:
        return 0.0
    
    # Check for garbage patterns
    garbage = ['download', '口品', '★', '●', 'http', 'www.', 'receipt']
    name_upper = name.upper()
    if any(g in name_upper for g in garbage):
        return 0.0
    
    return 1.0


def _calculate_date_score(date_str: Optional[str]) -> float:
    """
    Score 1.0 if date is valid and reasonable, else 0.0.
    """
    if not date_str:
        return 0.0
    
    try:
        # Try various date formats
        formats = ['%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d']
        
        parsed_date = None
        for fmt in formats:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                continue
        
        if not parsed_date:
            return 0.0
        
        # Date should not be in the future
        now = datetime.now()
        if parsed_date > now:
            return 0.0
        
        # Date should not be more than 1 year old
        one_year_ago = now - timedelta(days=365)
        if parsed_date < one_year_ago:
            return 0.0
        
        return 1.0
        
    except Exception as e:
        logger.warning(f"Date parsing error: {e}")
        return 0.0


def _calculate_items_score(items: list) -> float:
    """
    Score 1.0 if all items have valid structure, else 0.0.
    """
    if not items:
        return 0.0
    
    # Check each item has valid price
    valid_items = 0
    for item in items:
        price = item.get('total_price', 0)
        qty = item.get('quantity', 0)
        
        if price > 0 and qty > 0:
            valid_items += 1
    
    # All items must be valid
    if valid_items == len(items):
        return 1.0
    
    return 0.0


def _calculate_math_score(
    items: list,
    subtotal: float,
    discount: float,
    total_amount: float
) -> float:
    """
    Calculate math validation score (0.0 - 1.0).
    
    Perfect match: 1.0
    Acceptable variance (< 1%): 0.8
    Moderate variance (< 5%): 0.5
    High variance (>= 5%): 0.0
    """
    if not items and total_amount > 0:
        # E-wallet transfer, etc. - has total but no items
        return 0.3
    
    if not items:
        return 0.0
    
    # Calculate items sum
    items_sum = sum(item.get('total_price', 0) for item in items)
    
    if total_amount <= 0:
        return 0.0
    
    # Check: items_sum - discount ≈ total_amount
    net_total = items_sum - discount
    
    diff = abs(net_total - total_amount)
    diff_pct = diff / total_amount if total_amount > 0 else 1.0
    
    if diff_pct < 0.001:  # < 0.1% difference
        return 1.0
    elif diff_pct < 0.01:  # < 1% difference
        return 0.8
    elif diff_pct < 0.05:  # < 5% difference (accept for discounts)
        return 0.5
    else:
        return 0.0


def should_commit(score: float) -> tuple:
    """
    Determine if transaction should be committed to DB.
    
    Returns:
        tuple: (should_commit: bool, reason: str)
    """
    if score >= COMMIT_THRESHOLD:
        return True, f"Score {score} >= threshold {COMMIT_THRESHOLD}"
    
    # Check if we have enough data to save anyway
    if score >= 0.5:
        return True, f"Acceptable score {score} (>= 0.5), will save with warning"
    
    return False, f"Score {score} < 0.5, requires manual review"


def get_confidence_breakdown(data: Dict[str, Any]) -> Dict[str, float]:
    """
    Get detailed breakdown of confidence scoring.
    """
    return {
        'merchant': WEIGHT_MERCHANT * _calculate_merchant_score(data.get('merchant_name')),
        'date': WEIGHT_DATE * _calculate_date_score(data.get('date')),
        'items': WEIGHT_ITEMS * _calculate_items_score(data.get('items', [])),
        'math': WEIGHT_MATH * _calculate_math_score(
            items=data.get('items', []),
            subtotal=data.get('subtotal', 0),
            discount=data.get('discount', 0),
            total_amount=data.get('total_amount', 0)
        ),
        'total': calculate_confidence(data)
    }
