# ============================================================
# TEMPLATE RULE ENGINE
# ============================================================
# Config-driven parser - NO hardcoded vendor logic
# ============================================================

import os
import yaml
import logging
from typing import Optional, Dict, Any, List, Callable
from functools import lru_cache

logger = logging.getLogger(__name__)


class TemplateRuleEngine:
    """
    Config-driven rule engine for receipt parsing.
    Reads rules from YAML config instead of hardcoding.
    """
    
    _instance = None
    
    def __new__(cls):
        """Singleton pattern for config caching."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self.config = self._load_config()
        self.email_templates = self.config.get('email_templates', {})
        self.receipt_anchors = self.config.get('receipt_anchors', {})
        self.math_config = self.config.get('math_validation', {})
        self.weights = self.config.get('confidence_weights', {})
    
    def _load_config(self) -> dict:
        """Load config from YAML file."""
        config_path = os.path.join(
            os.path.dirname(__file__),
            'config',
            'vendor_templates.yaml'
        )
        
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    return yaml.safe_load(f) or {}
            except Exception as e:
                logger.warning(f"Failed to load config: {e}")
        
        # Return default config
        return self._default_config()
    
    def _default_config(self) -> dict:
        """Default configuration fallback."""
        return {
            'email_templates': {},
            'receipt_anchors': {
                'item_end': {
                    'fuzzy_keywords': ['TOTAL', 'SUBTOTAL', 'HARGA JUAL'],
                    'fuzzy_threshold': 0.75
                },
                'merchant': {
                    'skip_patterns': ['^[0-9]+$', '^download'],
                    'min_length': 2,
                    'max_length': 50
                }
            },
            'math_validation': {
                'absolute_tolerance': 500,
                'allow_discount': True
            },
            'confidence_weights': {
                'merchant': 0.20,
                'date': 0.15,
                'math': 0.45,
                'items': 0.20,
                'commit_threshold': 0.85
            }
        }
    
    def detect_email_vendor(self, html_content: str) -> Optional[str]:
        """
        Detect email vendor from HTML content using config patterns.
        
        Returns:
            Vendor name or None if not detected
        """
        html_upper = html_content.upper()
        
        for vendor, template in self.email_templates.items():
            patterns = template.get('patterns', [])
            for pattern in patterns:
                if pattern.upper() in html_upper:
                    return vendor
        
        return None
    
    def get_email_template(self, vendor: str) -> Optional[dict]:
        """Get template for specific vendor."""
        return self.email_templates.get(vendor.lower())
    
    def get_item_end_anchors(self) -> tuple:
        """Get item end anchor keywords and threshold."""
        anchors = self.receipt_anchors.get('item_end', {})
        keywords = anchors.get('fuzzy_keywords', ['TOTAL'])
        threshold = anchors.get('fuzzy_threshold', 0.75)
        return keywords, threshold
    
    def get_item_start_separators(self) -> List[str]:
        """Get separator lines that mark item start."""
        return self.receipt_anchors.get('item_start', {}).get('separator_lines', ['---'])
    
    def get_merchant_validation(self) -> dict:
        """Get merchant validation rules."""
        return self.receipt_anchors.get('merchant', {})
    
    def get_math_config(self) -> dict:
        """Get math validation config."""
        return {
            'absolute_tolerance': self.math_config.get('absolute_tolerance', 500),
            'allow_discount': self.math_config.get('allow_discount', True),
            'rounding_threshold': self.math_config.get('rounding_threshold', 0.01)
        }
    
    def get_confidence_weights(self) -> dict:
        """Get confidence scoring weights."""
        return self.weights
    
    def get_commit_threshold(self) -> float:
        """Get commit threshold for DB save."""
        return self.weights.get('commit_threshold', 0.85)
    
    def reload_config(self):
        """Reload configuration from file."""
        self.config = self._load_config()
        self.email_templates = self.config.get('email_templates', {})
        self.receipt_anchors = self.config.get('receipt_anchors', {})
        self.math_config = self.config.get('math_validation', {})
        self.weights = self.config.get('confidence_weights', {})


# Global instance
_rule_engine: Optional[TemplateRuleEngine] = None


def get_rule_engine() -> TemplateRuleEngine:
    """Get global rule engine instance."""
    global _rule_engine
    if _rule_engine is None:
        _rule_engine = TemplateRuleEngine()
    return _rule_engine


def extract_from_email_selector(
    html_content: str,
    vendor: str
) -> Dict[str, Any]:
    """
    Extract data from email using config-driven selectors.
    """
    engine = get_rule_engine()
    template = engine.get_email_template(vendor)
    
    if not template:
        return {}
    
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html_content, 'html.parser')
    
    result = {}
    selectors = template.get('selectors', {})
    
    # Extract total
    total_selectors = selectors.get('total', [])
    for selector in total_selectors:
        if selector.get('type') == 'regex':
            import re
            pattern = selector.get('pattern', '')
            match = re.search(pattern, html_content)
            if match:
                num_str = match.group(1).replace(',', '').replace('.', '')
                try:
                    result['total_amount'] = float(num_str)
                    break
                except ValueError:
                    continue
        
        elif selector.get('type') == 'contains':
            text = selector.get('text', '')
            if text in html_content:
                # Find next sibling
                for elem in soup.find_all(string=lambda t: t and text in str(t)):
                    next_text = elem.find_next().get_text() if elem.find_next() else ""
                    import re
                    numbers = re.findall(r'[\d,\.]+', next_text)
                    if numbers:
                        try:
                            result['total_amount'] = float(numbers[0].replace(',', '').replace('.', ''))
                            break
                        except ValueError:
                            continue
    
    # Merchant name
    merchant_selectors = selectors.get('merchant', [])
    for selector in merchant_selectors:
        if selector.get('type') == 'text':
            result['merchant_name'] = selector.get('value', vendor.capitalize())
        elif selector.get('type') == 'contains':
            result['merchant_name'] = vendor.capitalize()
    
    return result
