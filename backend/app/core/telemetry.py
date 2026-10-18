"""
OpenTelemetry Setup - Distributed tracing for FastAPI, SQLAlchemy, and LLM calls.
Enables observability across all system components.
"""
import os
from typing import Optional


def setup_telemetry(service_name: str = "finmanager-api"):
    """
    Initialize OpenTelemetry tracing.
    
    Sets up:
    - FastAPI instrumentation
    - SQLAlchemy instrumentation
    - HTTP client instrumentation
    - Custom spans for business logic
    """
    # Only setup if OTEL is configured
    if not os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
        print("[Telemetry] OTEL not configured, skipping setup")
        return
    
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        
        # Create resource with service name
        resource = Resource(attributes={
            SERVICE_NAME: service_name
        })
        
        # Set up tracer provider
        provider = TracerProvider(resource=resource)
        trace.set_tracer_provider(provider)
        
        # Configure OTLP exporter (if endpoint is set)
        otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
        if otlp_endpoint:
            try:
                from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
                exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
                provider.add_span_processor(BatchSpanProcessor(exporter))
            except ImportError:
                print("[Telemetry] OTLP exporter not available")
        
        print(f"[Telemetry] Initialized for {service_name}")
        
        return provider
        
    except ImportError as e:
        print(f"[Telemetry] OpenTelemetry not available: {e}")
        return None
    except Exception as e:
        print(f"[Telemetry] Setup failed: {e}")
        return None


def get_tracer(name: str = "finmanager"):
    """Get a tracer instance for creating spans."""
    try:
        from opentelemetry import trace
        return trace.get_tracer(name)
    except ImportError:
        # Return a no-op tracer if OTEL not available
        return NoOpTracer()


class NoOpSpan:
    """No-op span for when telemetry is disabled."""
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def set_attribute(self, key, value):
        pass
    def add_event(self, name, attributes=None):
        pass


class NoOpTracer:
    """No-op tracer for when telemetry is disabled."""
    def start_as_current_span(self, name, **kwargs):
        return NoOpSpan()


class TracingContext:
    """
    Context manager for creating traced spans.
    Usage:
        with TracingContext("process_transaction") as span:
            span.set_attribute("transaction_id", tx_id)
            # ... do work
    """
    def __init__(self, name: str, attributes: Optional[dict] = None):
        self.name = name
        self.attributes = attributes or {}
        self.tracer = get_tracer()
    
    def __enter__(self):
        from opentelemetry import trace
        from opentelemetry.trace import Status, StatusCode
        
        self.span = self.tracer.start_span(self.name)
        for key, value in self.attributes.items():
            self.span.set_attribute(key, value)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        from opentelemetry.trace import Status, StatusCode
        
        if exc_val:
            self.span.set_status(Status(StatusCode.ERROR))
            self.span.record_exception(exc_val)
        else:
            self.span.set_status(Status(StatusCode.OK))
        self.span.end()
        return False  # Don't suppress exceptions
    
    def set_attribute(self, key: str, value):
        self.span.set_attribute(key, value)
    
    def add_event(self, name: str, attributes: Optional[dict] = None):
        self.span.add_event(name, attributes or {})


# Convenience decorators
def traced(func):
    """Decorator to trace a function."""
    import functools
    
    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs):
        with TracingContext(func.__name__):
            return await func(*args, **kwargs)
    
    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        with TracingContext(func.__name__):
            return func(*args, **kwargs)
    
    import asyncio
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper


# Metrics collection (Prometheus-compatible)
class MetricsCollector:
    """Collect application metrics for Prometheus."""
    
    def __init__(self):
        self.counters = {}
        self.histograms = {}
        self.gauges = {}
    
    def increment(self, name: str, labels: Optional[dict] = None, value: int = 1):
        """Increment a counter metric."""
        key = (name, tuple(sorted((labels or {}).items())))
        if key not in self.counters:
            self.counters[key] = 0
        self.counters[key] += value
    
    def observe(self, name: str, value: float, labels: Optional[dict] = None):
        """Observe a histogram value."""
        key = (name, tuple(sorted((labels or {}).items())))
        if key not in self.histograms:
            self.histograms[key] = []
        self.histograms[key].append(value)
    
    def set_gauge(self, name: str, value: float, labels: Optional[dict] = None):
        """Set a gauge value."""
        key = (name, tuple(sorted((labels or {}).items())))
        self.gauges[key] = value


# Singleton instance
metrics = MetricsCollector()
