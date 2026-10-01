# ============================================================
# PIPELINE HANDLERS (REFACTORED - NO HARDCODED LOGIC)
# ============================================================

from .base import BaseHandler, PipelineContext, ParsedItem, HandlerType
from app.services.fuzzy_matcher import FuzzyAnchorMatcher, fuzzy_match_any
from app.services.dynamic_geometry import DynamicSpatialReconstructor, OCRWord
from app.services.template_engine import get_rule_engine, extract_from_email_selector
from app.services.confidence_engine import calculate_confidence, COMMIT_THRESHOLD
import re
import logging

logger = logging.getLogger(__name__)


class ConfigDrivenEmailHandler(BaseHandler):
    """
    Layer 1: Config-Driven Email DOM Parser
    Uses YAML templates - no hardcoded vendor logic
    """
    
    def __init__(self, next_handler=None):
        super().__init__(next_handler)
        self.handler_type = HandlerType.EMAIL_DOM
    
    async def process(self, ctx: PipelineContext) -> PipelineContext:
        """Parse email using config-driven template engine."""
        ctx.add_trace("EmailDOMHandler started")
        
        html_content = ctx.raw_input.get('html_content')
        if not html_content:
            ctx.add_trace("No HTML content, skipping")
            return ctx
        
        # Get rule engine
        engine = get_rule_engine()
        
        # Detect vendor from config patterns
        vendor = engine.detect_email_vendor(html_content)
        
        if not vendor:
            ctx.add_trace("No known vendor detected")
            return ctx
        
        ctx.add_trace(f"Detected vendor: {vendor}")
        
        # Extract using config-driven selectors
        try:
            data = extract_from_email_selector(html_content, vendor)
            
            if data.get('merchant_name'):
                ctx.parsed_data.merchant_name = data['merchant_name']
            else:
                ctx.parsed_data.merchant_name = vendor.capitalize()
            
            if data.get('total_amount'):
                ctx.parsed_data.total_amount = data['total_amount']
            
            ctx.parsed_data.merchant_type = "E-Commerce" if vendor.lower() in ['tokopedia', 'shopee', 'lazada'] else "Service"
            
        except Exception as e:
            ctx.add_trace(f"Email extraction error: {e}")
        
        # Calculate confidence
        if ctx.parsed_data.merchant_name:
            ctx.confidence_score = calculate_confidence(ctx.parsed_data.to_dict())
            
            if ctx.confidence_score >= 0.95:
                ctx.stop(f"Email parsed (confidence={ctx.confidence_score})", success=True)
            else:
                ctx.add_trace(f"Low confidence, continuing pipeline")
        
        return ctx


class QRISBarcodeHandler(BaseHandler):
    """Layer 2: QRIS/Barcode Handler"""
    
    def __init__(self, next_handler=None):
        super().__init__(next_handler)
        self.handler_type = HandlerType.QR_BARCODE
    
    async def process(self, ctx: PipelineContext) -> PipelineContext:
        """Parse QR/Barcode payloads."""
        ctx.add_trace("QRISBarcodeHandler started")
        
        qr_payload = ctx.raw_input.get('qr_payload')
        
        if qr_payload:
            # QRIS parsing
            ctx.parsed_data.payment_method = "QRIS"
            ctx.parsed_data.merchant_name = "QRIS Payment"
            
            # Extract amount from QR payload
            amount_match = re.search(r'rc=([0-9]+)', qr_payload)
            if amount_match:
                ctx.parsed_data.total_amount = float(amount_match.group(1))
            
            ctx.confidence_score = 0.8
            ctx.stop("QR payload parsed", success=True)
        
        return ctx


class SpatialRegexHandler(BaseHandler):
    """
    Layer 3: Config-Driven Spatial Regex Handler
    Uses fuzzy matching and dynamic tolerance - no hardcoded logic
    """
    
    def __init__(self, next_handler=None):
        super().__init__(next_handler)
        self.handler_type = HandlerType.SPATIAL_REGEX
        self.fuzzy_matcher = FuzzyAnchorMatcher()
        self.spatial_engine = DynamicSpatialReconstructor()
    
    async def process(self, ctx: PipelineContext) -> PipelineContext:
        """Parse using config-driven fuzzy anchors and dynamic spatial."""
        ctx.add_trace("SpatialRegexHandler started")
        
        # Get OCR lines or reconstruct from geometry
        lines = self._get_lines(ctx)
        
        if not lines:
            ctx.add_trace("No lines to parse")
            return ctx
        
        ctx.parsed_data.raw_lines = lines
        ctx = self._parse_with_config(lines, ctx)
        
        # Calculate confidence
        if ctx.parsed_data.items or ctx.parsed_data.total_amount > 0:
            ctx.confidence_score = calculate_confidence(ctx.parsed_data.to_dict())
            
            engine = get_rule_engine()
            threshold = engine.get_commit_threshold()
            
            if ctx.confidence_score >= threshold:
                ctx.stop(f"Regex parsed (confidence={ctx.confidence_score})", success=True)
            else:
                ctx.add_trace(f"Confidence {ctx.confidence_score} < {threshold}")
        
        return ctx
    
    def _get_lines(self, ctx: PipelineContext) -> list:
        """Get lines - either plain text or reconstruct from geometry."""
        # Plain OCR lines
        lines = ctx.raw_input.get('ocr_lines') or ctx.raw_input.get('lines')
        if lines:
            return lines
        
        # Reconstruct from OCR geometry
        ocr_result = ctx.raw_input.get('ocr_result')
        if ocr_result:
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
                except (ValueError, TypeError):
                    continue
            
            if words:
                return self.spatial_engine.reconstruct_lines(words)
        
        return []
    
    def _parse_with_config(self, lines: list, ctx: PipelineContext) -> PipelineContext:
        """Parse using config-driven rules."""
        engine = get_rule_engine()
        
        # Get config-driven anchors
        end_anchors, threshold = engine.get_item_end_anchors()
        separators = engine.get_item_start_separators()
        merchant_config = engine.get_merchant_validation()
        
        # Find item region using fuzzy matching
        index_end = len(lines)
        for i, line in enumerate(lines):
            matched, _, score = fuzzy_match_any(line, end_anchors, threshold)
            if matched:
                ctx.add_trace(f"Found end anchor '{line}' at {i} (score={score:.2f})")
                index_end = i
                break
        
        # Find item start
        index_start = 0
        for i, line in enumerate(lines[:15]):
            if any(sep in line for sep in separators):
                index_start = i + 1
                break
            line_clean = line.strip()
            if not line_clean:
                continue
            if re.match(r'^[\d\.\-\:\s]+$', line_clean) and len(line_clean) < 25:
                continue
            # Check merchant validity
            skip_patterns = merchant_config.get('skip_patterns', [])
            is_valid = True
            for pattern in skip_patterns:
                if re.match(pattern, line_clean.upper()):
                    is_valid = False
                    break
            if is_valid and len(line_clean) >= merchant_config.get('min_length', 2):
                ctx.parsed_data.merchant_name = line_clean
                index_start = i + 1
                break
        
        # Parse items
        item_lines = lines[index_start:index_end]
        parsed_items = []
        
        for line in item_lines:
            item = self._parse_item_rtl(line)
            if item:
                parsed_items.append(item)
        
        ctx.parsed_data.items = parsed_items
        ctx.parsed_data.subtotal = sum(i.total_price for i in parsed_items)
        
        # Extract total
        for line in lines:
            matched, _, _ = fuzzy_match_any(line, end_anchors, threshold)
            if matched:
                numbers = re.findall(r'[\d,\.]+', line)
                for num in reversed(numbers):
                    val = float(num.replace(',', '').replace('.', ''))
                    if val > 1000:
                        ctx.parsed_data.total_amount = val
                        break
        
        # Calculate discount
        math_config = engine.get_math_config()
        if math_config.get('allow_discount', True):
            if ctx.parsed_data.subtotal > ctx.parsed_data.total_amount > 0:
                ctx.parsed_data.discount = ctx.parsed_data.subtotal - ctx.parsed_data.total_amount
        
        ctx.add_trace(f"Parsed {len(parsed_items)} items, total={ctx.parsed_data.total_amount}")
        
        return ctx
    
    def _parse_item_rtl(self, line: str) -> ParsedItem:
        """Parse item using RTL approach."""
        line = line.strip()
        if not line or '(' in line or line.startswith('-'):
            return None
        
        tokens = line.split()
        if len(tokens) < 2:
            return None
        
        # Find numbers
        numbers = []
        for token in tokens:
            clean = token.replace('.', '').replace(',', '')
            if clean.isdigit():
                numbers.append(int(clean))
        
        if not numbers:
            return None
        
        # Rightmost = total
        total_price = float(numbers[-1])
        if total_price > 10000000:
            return None
        
        # Quantity
        quantity = 1
        price_per_unit = total_price
        
        if len(numbers) >= 2 and numbers[-2] <= 20:
            quantity = numbers[-2]
            price_per_unit = total_price / quantity
        
        # Name
        first_num_idx = 0
        for i, token in enumerate(tokens):
            clean = token.replace('.', '').replace(',', '')
            if clean.isdigit():
                first_num_idx = i
                break
        
        name = ' '.join(tokens[:first_num_idx]).strip()
        if not name:
            return None
        
        return ParsedItem(
            name=name,
            quantity=quantity,
            price_per_unit=price_per_unit,
            total_price=total_price
        )


class GeminiFallbackHandler(BaseHandler):
    """Layer 4: Gemini AI Fallback"""
    
    def __init__(self, next_handler=None):
        super().__init__(next_handler)
        self.handler_type = HandlerType.GEMINI_FALLBACK
    
    async def process(self, ctx: PipelineContext) -> PipelineContext:
        """Call Gemini for complex receipts."""
        ctx.add_trace("GeminiFallbackHandler started")
        
        image_bytes = ctx.image_bytes
        if not image_bytes:
            ctx.add_trace("No image bytes")
            ctx.stop("No image for Gemini", success=False)
            return ctx
        
        try:
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                ctx.add_trace("No Gemini API key")
                ctx.stop("API key not configured", success=False)
                return ctx
            
            from app.services.gemini_vision import extract_receipt_with_gemini
            result = extract_receipt_with_gemini(image_bytes, api_key)
            
            if result:
                if result.get('merchant'):
                    ctx.parsed_data.merchant_name = result['merchant'].get('name')
                    ctx.parsed_data.merchant_type = result['merchant'].get('type')
                
                if result.get('items'):
                    ctx.parsed_data.items = []
                    for item_data in result['items']:
                        ctx.parsed_data.items.append(ParsedItem(
                            name=item_data.get('name', 'Unknown'),
                            quantity=int(item_data.get('quantity', 1)),
                            price_per_unit=float(item_data.get('price_per_unit', 0)),
                            total_price=float(item_data.get('total_price', 0))
                        ))
                
                if result.get('total_amount'):
                    ctx.parsed_data.total_amount = float(result['total_amount'])
                
                ctx.confidence_score = calculate_confidence(ctx.parsed_data.to_dict())
                ctx.stop(f"Gemini parsed (confidence={ctx.confidence_score})", success=True)
            else:
                ctx.stop("Gemini returned no result", success=False)
                
        except Exception as e:
            ctx.add_trace(f"Gemini error: {e}")
            ctx.stop(f"Gemini failed: {e}", success=False)
        
        return ctx


import os
