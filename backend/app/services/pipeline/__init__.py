# ============================================================
# PIPELINE ORCHESTRATOR
# ============================================================

from .base import BaseHandler, PipelineContext, HandlerType
from .handlers import EmailDOMHandler, QRISBarcodeHandler, SpatialRegexHandler, GeminiFallbackHandler
from typing import Optional, Dict, Any


def create_pipeline() -> BaseHandler:
    """
    Create the handler chain:
    EmailDOM -> QRIS -> SpatialRegex -> Gemini
    """
    # Create handlers
    email_handler = EmailDOMHandler()
    qris_handler = QRISBarcodeHandler()
    regex_handler = SpatialRegexHandler()
    gemini_handler = GeminiFallbackHandler()
    
    # Chain them
    email_handler.next_handler = qris_handler
    qris_handler.next_handler = regex_handler
    regex_handler.next_handler = gemini_handler
    
    return email_handler


async def execute_pipeline(
    raw_input: Dict[str, Any],
    image_bytes: bytes = None
) -> PipelineContext:
    """
    Execute the full parsing pipeline.
    
    Args:
        raw_input: Dict with keys like 'html_content', 'qr_payload', 'ocr_lines', etc.
        image_bytes: Optional image bytes for Gemini fallback
        
    Returns:
        PipelineContext with parsed data and confidence score
    """
    # Create initial context
    ctx = PipelineContext(
        raw_input=raw_input,
        image_bytes=image_bytes
    )
    
    # Get pipeline chain
    pipeline = create_pipeline()
    
    # Execute
    ctx = await pipeline.handle(ctx)
    
    return ctx


def get_pipeline_summary(ctx: PipelineContext) -> Dict[str, Any]:
    """
    Get summary of pipeline execution.
    """
    return {
        "success": ctx.is_success,
        "confidence": ctx.confidence_score,
        "layer": ctx.handler_name,
        "trace": ctx.execution_trace,
        "data": ctx.parsed_data.to_dict()
    }
