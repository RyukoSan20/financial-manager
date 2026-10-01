# ============================================================
# INTEGRITY GATEKEEPER - Mathematical Validation
# NO hardcoded values, pure mathematical rules
# ============================================================

from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class ValidationStatus(Enum):
    PASS = "pass"
    FAIL = "fail"
    PARTIAL = "partial"


@dataclass
class ValidationResult:
    status: ValidationStatus
    confidence: float
    issues: List[str]
    discount: float = 0.0
    
    @property
    def is_valid(self) -> bool:
        return self.status == ValidationStatus.PASS


class IntegrityGatekeeper:
    """
    Mathematical integrity validation for receipt data.
    
    Validation Rules:
    1. Total > 0
    2. Merchant is not generic placeholder
    3. Items sum matches total (with tolerance for discounts)
    
    If validation FAILS: trigger Gemini Fallback.
    """
    
    # Tolerance for math check (absolute value in currency units)
    MATH_TOLERANCE = 500
    
    # Minimum confidence for auto-commit
    COMMIT_THRESHOLD = 0.80
    
    def __init__(self, tolerance: float = None, threshold: float = None):
        self.math_tolerance = tolerance or self.MATH_TOLERANCE
        self.commit_threshold = threshold or self.COMMIT_THRESHOLD
    
    def validate(
        self,
        merchant_name: str,
        total_amount: float,
        items: List[Dict[str, Any]]
    ) -> ValidationResult:
        """
        Validate receipt data mathematically.
        
        Returns:
            ValidationResult with status, confidence, and issues
        """
        issues = []
        confidence = 0.0
        
        # Rule 1: Total must be > 0
        if total_amount <= 0:
            issues.append("Total amount is zero or negative")
            return ValidationResult(
                status=ValidationStatus.FAIL,
                confidence=0.0,
                issues=issues
            )
        
        confidence += 0.25
        
        # Rule 2: Merchant must not be generic placeholder
        if self._is_generic_merchant(merchant_name):
            issues.append("Merchant name is generic placeholder")
            # Don't fail, but reduce confidence
            confidence += 0.10
        else:
            confidence += 0.20
        
        # Rule 3: Math validation
        math_valid, discount = self._validate_math(total_amount, items)
        if math_valid:
            confidence += 0.55
        else:
            issues.append(f"Math mismatch: items sum != total")
            confidence += 0.15
        
        # Clamp confidence
        confidence = min(1.0, confidence)
        
        # Determine status
        if confidence >= self.commit_threshold:
            status = ValidationStatus.PASS
        elif confidence >= 0.50:
            status = ValidationStatus.PARTIAL
        else:
            status = ValidationStatus.FAIL
        
        return ValidationResult(
            status=status,
            confidence=confidence,
            issues=issues,
            discount=discount
        )
    
    def _is_generic_merchant(self, name: str) -> bool:
        """Check if merchant name is a generic placeholder."""
        if not name:
            return True
        
        name_upper = name.upper().strip()
        
        generic_names = [
            'MERCHANT', 'TOKO', 'STORE', 'SHOP',
            'UNKNOWN', 'N/A', 'NULL', '-',
            'PURCHASE', 'BELANJA'
        ]
        
        if name_upper in generic_names:
            return True
        
        # Too short
        if len(name.strip()) < 2:
            return True
        
        return False
    
    def _validate_math(
        self, 
        total_amount: float, 
        items: List[Dict[str, Any]]
    ) -> Tuple[bool, float]:
        """
        Validate mathematical integrity.
        
        Returns:
            (is_valid, discount_amount)
        """
        if not items:
            # No items - check if this is acceptable
            # Some receipts (transfers) don't have items
            return total_amount > 0, 0.0
        
        # Calculate items sum
        items_sum = sum(
            float(item.get('total_price', 0)) 
            for item in items 
            if item.get('total_price', 0) > 0
        )
        
        # Check if items sum matches total
        diff = abs(items_sum - total_amount)
        
        if diff <= self.math_tolerance:
            # Perfect or within tolerance
            return True, 0.0
        
        # Check for discount scenario
        # Items sum > total = discount
        if items_sum > total_amount:
            discount = items_sum - total_amount
            # Discount is acceptable
            return True, discount
        
        # Items sum < total = possibly missing items
        # This could be legitimate or could indicate parsing failure
        # Allow it with reduced confidence
        return False, 0.0
    
    def should_commit(self, result: ValidationResult) -> Tuple[bool, str]:
        """
        Determine if data should be committed to DB.
        
        Returns:
            (should_commit, reason)
        """
        if result.status == ValidationStatus.PASS:
            return True, f"Validation passed (confidence={result.confidence:.2f})"
        
        if result.status == ValidationStatus.PARTIAL:
            if result.confidence >= 0.60:
                return True, f"Acceptable partial data (confidence={result.confidence:.2f})"
            return False, f"Confidence too low for commit ({result.confidence:.2f})"
        
        return False, f"Validation failed: {', '.join(result.issues)}"
    
    def needs_gemini_fallback(self, result: ValidationResult) -> bool:
        """Check if Gemini fallback should be triggered."""
        # Trigger if validation failed
        if result.status == ValidationStatus.FAIL:
            return True
        
        # Trigger if confidence is too low
        if result.confidence < self.commit_threshold:
            return True
        
        return False


def validate_receipt_data(
    merchant_name: str,
    total_amount: float,
    items: List[Dict[str, Any]]
) -> ValidationResult:
    """
    Convenience function for validation.
    """
    gatekeeper = IntegrityGatekeeper()
    return gatekeeper.validate(merchant_name, total_amount, items)
