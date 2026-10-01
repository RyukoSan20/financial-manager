# ============================================================
# PIPELINE BASE - Chain of Responsibility Pattern
# ============================================================

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum


class HandlerType(Enum):
    EMAIL_DOM = "email_dom"
    QR_BARCODE = "qr_barcode"
    SPATIAL_REGEX = "spatial_regex"
    GEMINI_FALLBACK = "gemini_fallback"


@dataclass
class ParsedItem:
    """Represents a single parsed receipt item."""
    name: str = ""
    quantity: int = 1
    price_per_unit: float = 0.0
    total_price: float = 0.0
    category: Optional[str] = None


@dataclass
class TransactionPayload:
    """
    Immutable transaction data container.
    All fields optional - accumulates data through pipeline.
    """
    merchant_name: Optional[str] = None
    merchant_type: Optional[str] = None
    merchant_location: Optional[str] = None
    date: Optional[str] = None
    items: List[ParsedItem] = field(default_factory=list)
    subtotal: float = 0.0
    discount: float = 0.0
    total_amount: float = 0.0
    payment_method: Optional[str] = None
    raw_lines: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "merchant_name": self.merchant_name,
            "merchant_type": self.merchant_type,
            "merchant_location": self.merchant_location,
            "date": self.date,
            "items": [
                {
                    "name": i.name,
                    "quantity": i.quantity,
                    "price_per_unit": i.price_per_unit,
                    "total_price": i.total_price,
                    "category": i.category
                } for i in self.items
            ],
            "subtotal": self.subtotal,
            "discount": self.discount,
            "total_amount": self.total_amount,
            "payment_method": self.payment_method
        }


@dataclass
class PipelineContext:
    """
    Immutable context passed through handler chain.
    Contains all raw input and accumulated parsed data.
    """
    raw_input: Dict[str, Any] = field(default_factory=dict)
    image_bytes: Optional[bytes] = None
    parsed_data: TransactionPayload = field(default_factory=TransactionPayload)
    confidence_score: float = 0.0
    is_final: bool = False
    is_success: bool = False
    execution_trace: List[str] = field(default_factory=list)
    handler_name: Optional[str] = None
    
    def add_trace(self, message: str):
        self.execution_trace.append(f"[{self.handler_name or 'START'}] {message}")
    
    def stop(self, reason: str, success: bool = False):
        self.is_final = True
        self.is_success = success
        self.add_trace(f"STOP: {reason}")
    
    def with_confidence(self, score: float) -> 'PipelineContext':
        """Return new context with updated confidence."""
        self.confidence_score = score
        return self


class BaseHandler(ABC):
    """
    Abstract base handler for Chain of Responsibility pattern.
    Each handler processes independently and passes context to next.
    """
    
    def __init__(self, next_handler: Optional['BaseHandler'] = None):
        self.next_handler = next_handler
        self.handler_type = HandlerType.SPATIAL_REGEX
    
    async def handle(self, ctx: PipelineContext) -> PipelineContext:
        """Main entry point - handles context through chain."""
        if ctx.is_final:
            return ctx
        
        ctx.handler_name = self.__class__.__name__
        
        # Process this handler
        ctx = await self.process(ctx)
        
        # Continue to next handler if not final
        if not ctx.is_final and self.next_handler:
            ctx = await self.next_handler.handle(ctx)
        
        return ctx
    
    @abstractmethod
    async def process(self, ctx: PipelineContext) -> PipelineContext:
        """
        Process the context. Override in subclasses.
        Must set ctx.is_final = True when processing complete.
        """
        pass
