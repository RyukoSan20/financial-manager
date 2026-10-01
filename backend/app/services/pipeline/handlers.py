# ============================================================
# PIPELINE HANDLERS
# ============================================================

from .base import BaseHandler, PipelineContext, ParsedItem, HandlerType
from app.services.confidence_engine import calculate_confidence, COMMIT_THRESHOLD
import logging

logger = logging.getLogger(__name__)


class EmailDOMHandler(BaseHandler):
    """
    Layer 1: Email DOM Parser
    For email receipts from Gojek, Grab, Tokopedia, etc.
    """
    
    def __init__(self, next_handler=None):
        super().__init__(next_handler)
        self.handler_type = HandlerType.EMAIL_DOM
    
    async def process(self, ctx: PipelineContext) -> PipelineContext:
        """Parse email receipts using HTML structure."""
        ctx.add_trace("EmailDOMHandler started")
        
        html_content = ctx.raw_input.get('html_content')
        if not html_content:
            ctx.add_trace("No HTML content, skipping Email DOM")
            return ctx
        
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            ctx.add_trace("BeautifulSoup not available")
            return ctx
        
        html_upper = html_content.upper()
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Detect vendor and parse
        if "GOJEK" in html_upper or "PT APLIKASI KARYA ANAK BANGSA" in html_upper:
            ctx = self._parse_gojek(soup, ctx)
        elif "GRAB" in html_upper:
            ctx = self._parse_grab(soup, ctx)
        elif "TOKOPEDIA" in html_upper:
            ctx = self._parse_tokopedia(soup, ctx)
        elif "SHOPEE" in html_upper:
            ctx = self._parse_shopee(soup, ctx)
        
        # Calculate confidence
        if ctx.parsed_data.merchant_name:
            ctx.confidence_score = calculate_confidence(ctx.parsed_data.to_dict())
            
            if ctx.confidence_score >= 0.95:
                ctx.stop(f"Email DOM parsed successfully (confidence={ctx.confidence_score})", success=True)
            else:
                ctx.add_trace(f"Low confidence {ctx.confidence_score}, continuing pipeline")
        
        return ctx
    
    def _parse_gojek(self, soup, ctx: PipelineContext) -> PipelineContext:
        """Parse Gojek email receipt."""
        try:
            # Find total
            for elem in soup.find_all(string=lambda t: t and "Total Pembayaran" in str(t)):
                text = elem.strip()
                import re
                numbers = re.findall(r'[\d\,\.]+', text)
                if numbers:
                    total = float(numbers[-1].replace(',', '').replace('.', ''))
                    ctx.parsed_data.total_amount = total
                    break
            
            ctx.parsed_data.merchant_name = "Gojek"
            ctx.parsed_data.merchant_type = "Service"
            ctx.add_trace("Parsed Gojek receipt")
        except Exception as e:
            ctx.add_trace(f"Gojek parse error: {e}")
        
        return ctx
    
    def _parse_grab(self, soup, ctx: PipelineContext) -> PipelineContext:
        """Parse Grab email receipt."""
        ctx.parsed_data.merchant_name = "Grab"
        ctx.parsed_data.merchant_type = "Service"
        return ctx
    
    def _parse_tokopedia(self, soup, ctx: PipelineContext) -> PipelineContext:
        """Parse Tokopedia email receipt."""
        ctx.parsed_data.merchant_name = "Tokopedia"
        ctx.parsed_data.merchant_type = "E-Commerce"
        return ctx
    
    def _parse_shopee(self, soup, ctx: PipelineContext) -> PipelineContext:
        """Parse Shopee email receipt."""
        ctx.parsed_data.merchant_name = "Shopee"
        ctx.parsed_data.merchant_type = "E-Commerce"
        return ctx


class QRISBarcodeHandler(BaseHandler):
    """
    Layer 2: QRIS/Barcode Handler
    For QR code and barcode scanned receipts.
    """
    
    def __init__(self, next_handler=None):
        super().__init__(next_handler)
        self.handler_type = HandlerType.QR_BARCODE
    
    async def process(self, ctx: PipelineContext) -> PipelineContext:
        """Parse QR/Barcode payloads."""
        ctx.add_trace("QRISBarcodeHandler started")
        
        qr_payload = ctx.raw_input.get('qr_payload')
        barcode_payload = ctx.raw_input.get('barcode_payload')
        
        if qr_payload:
            ctx = self._parse_qr(qr_payload, ctx)
        elif barcode_payload:
            ctx = self._parse_barcode(barcode_payload, ctx)
        else:
            ctx.add_trace("No QR/Barcode payload")
        
        return ctx
    
    def _parse_qr(self, payload: str, ctx: PipelineContext) -> PipelineContext:
        """Parse QRIS payload."""
        import re
        
        # QRIS format: various bank formats
        # Example: https://qr.bri.co.id/...
        try:
            ctx.parsed_data.merchant_name = "QRIS Payment"
            ctx.parsed_data.payment_method = "QRIS"
            
            # Extract amount if present
            amount_match = re.search(r'rc=([\d]+)', payload)
            if amount_match:
                ctx.parsed_data.total_amount = float(amount_match.group(1))
            
            ctx.confidence_score = 0.8
            ctx.add_trace(f"Parsed QR payload: {ctx.parsed_data.total_amount}")
        except Exception as e:
            ctx.add_trace(f"QR parse error: {e}")
        
        return ctx
    
    def _parse_barcode(self, payload: str, ctx: PipelineContext) -> PipelineContext:
        """Parse barcode payload."""
        ctx.add_trace("Barcode parsing not implemented")
        return ctx


class SpatialRegexHandler(BaseHandler):
    """
    Layer 3: Spatial Regex Handler
    For physical receipts using bounded region parsing.
    """
    
    def __init__(self, next_handler=None):
        super().__init__(next_handler)
        self.handler_type = HandlerType.SPATIAL_REGEX
    
    async def process(self, ctx: PipelineContext) -> PipelineContext:
        """Parse physical receipts with strict math validation."""
        ctx.add_trace("SpatialRegexHandler started")
        
        lines = ctx.raw_input.get('ocr_lines') or ctx.raw_input.get('lines')
        
        if not lines:
            ctx.add_trace("No OCR lines provided")
            return ctx
        
        ctx.parsed_data.raw_lines = lines
        ctx = self._parse_bounded_regex(lines, ctx)
        
        # Calculate confidence
        if ctx.parsed_data.items or ctx.parsed_data.total_amount > 0:
            ctx.confidence_score = calculate_confidence(ctx.parsed_data.to_dict())
            
            if ctx.confidence_score >= COMMIT_THRESHOLD:
                ctx.stop(f"Regex parsed successfully (confidence={ctx.confidence_score})", success=True)
            else:
                ctx.add_trace(f"Low confidence {ctx.confidence_score}, will try Gemini")
        
        return ctx
    
    def _parse_bounded_regex(self, lines: list, ctx: PipelineContext) -> PipelineContext:
        """Parse using bounded region + RTL parsing."""
        import re
        
        # Summary anchors - end of item region
        summary_anchors = [
            'HARGA JUAL', 'SUBTOTAL', 'DISKON', 'TOTAL', 
            'ANDA HEMAT', 'TUNAI', 'CASH', 'BAYAR'
        ]
        
        # Find INDEX_END
        index_end = len(lines)
        for i, line in enumerate(lines):
            if any(kw in line.upper() for kw in summary_anchors):
                index_end = i
                break
        
        # Find INDEX_START
        index_start = 0
        for i, line in enumerate(lines[:15]):
            line_clean = line.strip()
            if '---' in line_clean:
                index_start = i + 1
                break
            if re.match(r'^[\d\.\-\:\s]+$', line_clean):
                continue
            if not line_clean:
                continue
            if self._is_valid_merchant(line_clean):
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
            if 'TOTAL' in line.upper():
                numbers = re.findall(r'[\d\,\.]+', line)
                for num in reversed(numbers):
                    val = float(num.replace(',', '').replace('.', ''))
                    if val > 1000:
                        ctx.parsed_data.total_amount = val
                        break
        
        # Calculate discount
        if ctx.parsed_data.subtotal > ctx.parsed_data.total_amount > 0:
            ctx.parsed_data.discount = ctx.parsed_data.subtotal - ctx.parsed_data.total_amount
        
        ctx.add_trace(f"Parsed {len(parsed_items)} items, total={ctx.parsed_data.total_amount}")
        
        return ctx
    
    def _is_valid_merchant(self, name: str) -> bool:
        """Check if merchant name is valid."""
        if not name or len(name) < 2:
            return False
        garbage = ['download', '口品', '★', 'http', 'www.']
        name_upper = name.upper()
        if any(g in name_upper for g in garbage):
            return False
        alpha_count = sum(1 for c in name if c.isalpha())
        return alpha_count >= 2
    
    def _parse_item_rtl(self, line: str) -> ParsedItem:
        """Parse item using RTL approach."""
        import re
        
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
    """
    Layer 4: Gemini Fallback Handler
    For complex receipts that fail previous layers.
    """
    
    def __init__(self, next_handler=None):
        super().__init__(next_handler)
        self.handler_type = HandlerType.GEMINI_FALLBACK
    
    async def process(self, ctx: PipelineContext) -> PipelineContext:
        """Call Gemini AI for complex receipts."""
        ctx.add_trace("GeminiFallbackHandler started")
        
        image_bytes = ctx.image_bytes
        if not image_bytes:
            ctx.add_trace("No image bytes for Gemini")
            ctx.stop("No image for Gemini processing", success=False)
            return ctx
        
        try:
            import os
            api_key = os.environ.get('GEMINI_API_KEY')
            
            if not api_key:
                ctx.add_trace("No Gemini API key")
                ctx.stop("Gemini API key not configured", success=False)
                return ctx
            
            # Call Gemini
            from app.services.gemini_vision import extract_receipt_with_gemini
            result = extract_receipt_with_gemini(image_bytes, api_key)
            
            if result:
                # Update context with Gemini result
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
                
                # Recalculate confidence
                ctx.confidence_score = calculate_confidence(ctx.parsed_data.to_dict())
                
                ctx.stop(f"Gemini parsed successfully (confidence={ctx.confidence_score})", success=True)
            else:
                ctx.stop("Gemini returned no result", success=False)
                
        except Exception as e:
            ctx.add_trace(f"Gemini error: {e}")
            ctx.stop(f"Gemini processing failed: {e}", success=False)
        
        return ctx
