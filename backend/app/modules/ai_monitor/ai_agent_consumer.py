"""
AI Agent Consumer - Background worker for AI-powered error analysis.
Listens to Redis Pub/Sub and analyzes errors using Gemini LLM.
"""
import json
import asyncio
import signal
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class ErrorAnalysis:
    """Structured error analysis result."""
    error_id: str
    root_cause: str
    severity: str  # "low", "medium", "high", "critical"
    category: str
    suggested_fix: str
    related_errors: list
    confidence: float


class AIConsumer:
    """
    Redis Pub/Sub consumer that analyzes errors using AI.
    Runs as a background worker process.
    """
    
    CHANNEL = "error:stream"
    
    def __init__(self, redis_client=None):
        self.redis = redis_client
        self.running = False
        self.processed_count = 0
        self.analysis_cache: Dict[str, ErrorAnalysis] = {}
    
    async def start(self):
        """Start consuming error events."""
        self.running = True
        print(f"[AIConsumer] Starting error stream consumer...")
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        
        if not self.redis:
            print("[AIConsumer] No Redis client, running in demo mode")
            await self._demo_mode()
            return
        
        try:
            pubsub = self.redis.pubsub()
            pubsub.subscribe(self.CHANNEL)
            print(f"[AIConsumer] Subscribed to channel: {self.CHANNEL}")
            
            while self.running:
                message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                
                if message and message.get("type") == "message":
                    data = json.loads(message["data"])
                    await self._process_error(data)
                
                # Small delay to prevent CPU spinning
                await asyncio.sleep(0.1)
                
        except Exception as e:
            print(f"[AIConsumer] Error: {e}")
        finally:
            if self.redis:
                pubsub.unsubscribe()
                pubsub.close()
    
    async def _process_error(self, error_data: Dict[str, Any]):
        """Process a single error event."""
        error_id = error_data.get("id", "unknown")
        error_type = error_data.get("error_type", "unknown")
        
        print(f"[AIConsumer] Processing error: {error_id} ({error_type})")
        
        try:
            # Analyze error with AI
            analysis = await self._analyze_error(error_data)
            
            # Store analysis
            self.analysis_cache[error_id] = analysis
            
            # Take action based on severity
            await self._handle_analysis(analysis, error_data)
            
            self.processed_count += 1
            
            print(f"[AIConsumer] ✓ Analyzed error {error_id}: {analysis.category} ({analysis.severity})")
            
        except Exception as e:
            print(f"[AIConsumer] Failed to process error {error_id}: {e}")
    
    async def _analyze_error(self, error_data: Dict[str, Any]) -> ErrorAnalysis:
        """
        Analyze error using AI to determine root cause and suggested fix.
        Uses rule-based analysis as fallback when AI is unavailable.
        """
        error_type = error_data.get("error_type", "unknown")
        error_message = error_data.get("error_message", "")
        error_class = error_data.get("error_class", "")
        path = error_data.get("path", "")
        traceback = error_data.get("traceback", "")
        
        # Try AI analysis
        ai_result = await self._ai_analyze(error_data)
        if ai_result:
            return ai_result
        
        # Fallback to rule-based analysis
        return self._rule_based_analysis(error_data)
    
    async def _ai_analyze(self, error_data: Dict[str, Any]) -> Optional[ErrorAnalysis]:
        """
        Use Gemini AI to analyze error.
        Returns None if AI is unavailable.
        """
        import os
        
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1")
        if not api_key:
            print("[AIConsumer] No Gemini API key, using rule-based analysis")
            return None
        
        try:
            import requests
            
            prompt = f"""Analyze this error and provide:
1. root_cause: Short explanation of what caused the error
2. severity: One of [low, medium, high, critical]
3. category: One of [database, authentication, validation, network, code, external]
4. suggested_fix: Actionable fix in Indonesian
5. related_errors: List of similar error patterns

Error Data:
- Type: {error_data.get('error_type')}
- Class: {error_data.get('error_class')}
- Message: {error_data.get('error_message')}
- Path: {error_data.get('path')}
- Method: {error_data.get('method')}

Traceback:
{error_data.get('traceback', 'N/A')[:500]}

Respond in JSON format:
{{"root_cause": "...", "severity": "...", "category": "...", "suggested_fix": "...", "confidence": 0.0-1.0}}
"""
            
            response = requests.post(
                f"https://generativeagent.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.3, "maxOutputTokens": 500}
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                
                # Parse JSON from response
                import re
                json_match = re.search(r'\{.*\}', text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                    return ErrorAnalysis(
                        error_id=error_data.get("id", ""),
                        root_cause=result.get("root_cause", "Unknown"),
                        severity=result.get("severity", "medium"),
                        category=result.get("category", "code"),
                        suggested_fix=result.get("suggested_fix", "No suggestion"),
                        related_errors=[],
                        confidence=result.get("confidence", 0.5)
                    )
                    
        except Exception as e:
            print(f"[AIConsumer] AI analysis failed: {e}")
        
        return None
    
    def _rule_based_analysis(self, error_data: Dict[str, Any]) -> ErrorAnalysis:
        """
        Rule-based error analysis (fallback when AI unavailable).
        Uses pattern matching on error messages.
        """
        error_message = error_data.get("error_message", "").lower()
        error_class = error_data.get("error_class", "").lower()
        path = error_data.get("path", "").lower()
        
        # Database errors
        if any(x in error_message for x in ["sql", "database", "connection", "postgresql", "psycopg"]):
            return ErrorAnalysis(
                error_id=error_data.get("id", ""),
                root_cause="Database connection or query error",
                severity="high",
                category="database",
                suggested_fix="Periksa koneksi database dan query SQL",
                related_errors=[],
                confidence=0.8
            )
        
        # Authentication errors
        if any(x in error_message for x in ["auth", "token", "jwt", "credential", "unauthorized"]):
            return ErrorAnalysis(
                error_id=error_data.get("id", ""),
                root_cause="Authentication or authorization failure",
                severity="medium",
                category="authentication",
                suggested_fix="Periksa token JWT dan kredensial pengguna",
                related_errors=[],
                confidence=0.85
            )
        
        # Validation errors
        if any(x in error_message for x in ["validation", "invalid", "required", "schema"]):
            return ErrorAnalysis(
                error_id=error_data.get("id", ""),
                root_cause="Request validation failed",
                severity="low",
                category="validation",
                suggested_fix="Periksa format dan isi request body",
                related_errors=[],
                confidence=0.9
            )
        
        # Network errors
        if any(x in error_message for x in ["connection", "timeout", "network", "socket"]):
            return ErrorAnalysis(
                error_id=error_data.get("id", ""),
                root_cause="Network connectivity issue",
                severity="medium",
                category="network",
                suggested_fix="Periksa konektivitas jaringan dan layanan eksternal",
                related_errors=[],
                confidence=0.75
            )
        
        # External API errors
        if any(x in path for x in ["google", "supabase", "gemini", "finnhub"]):
            return ErrorAnalysis(
                error_id=error_data.get("id", ""),
                root_cause="External API service error",
                severity="medium",
                category="external",
                suggested_fix="Periksa status layanan API eksternal",
                related_errors=[],
                confidence=0.7
            )
        
        # Default - unknown error
        return ErrorAnalysis(
            error_id=error_data.get("id", ""),
            root_cause=f"Unexpected error: {error_class}",
            severity="medium",
            category="code",
            suggested_fix="Investigasi error lebih lanjut dengan melihat traceback",
            related_errors=[],
            confidence=0.5
        )
    
    async def _handle_analysis(self, analysis: ErrorAnalysis, error_data: Dict[str, Any]):
        """Handle analysis result - log, alert, or auto-fix."""
        # Log analysis
        print(f"[AIConsumer] Analysis: {analysis.root_cause}")
        print(f"[AIConsumer] Suggested fix: {analysis.suggested_fix}")
        
        # Critical errors - could trigger alert
        if analysis.severity == "critical":
            print(f"[AIConsumer] ⚠️ CRITICAL ERROR DETECTED - {analysis.root_cause}")
            # TODO: Send alert notification
        
        # High severity errors
        elif analysis.severity == "high":
            print(f"[AIConsumer] 🔴 High severity - {analysis.root_cause}")
    
    async def _demo_mode(self):
        """Demo mode when Redis is not available."""
        print("[AIConsumer] Running in demo mode - simulating error analysis...")
        
        demo_errors = [
            {
                "id": "demo-001",
                "error_type": "exception",
                "error_class": "DatabaseError",
                "error_message": "connection refused to postgres:5432",
                "path": "/api/transactions/",
                "method": "POST"
            },
            {
                "id": "demo-002",
                "error_type": "auth_error",
                "error_message": "Invalid JWT token",
                "path": "/api/accounts/",
                "method": "GET"
            }
        ]
        
        for error in demo_errors:
            await self._process_error(error)
            await asyncio.sleep(2)
        
        print(f"[AIConsumer] Demo complete. Processed {self.processed_count} errors.")
    
    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signals."""
        print(f"\n[AIConsumer] Shutting down... (processed {self.processed_count} errors)")
        self.running = False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get consumer statistics."""
        return {
            "running": self.running,
            "processed_count": self.processed_count,
            "cached_analyses": len(self.analysis_cache)
        }


async def run_consumer(redis_url: str = None):
    """Run the AI consumer worker."""
    import os
    
    # Try to connect to Redis
    redis_client = None
    if redis_url or os.getenv("REDIS_URL"):
        try:
            import redis
            redis_client = redis.Redis.from_url(redis_url or os.getenv("REDIS_URL"))
            redis_client.ping()
            print(f"[AIConsumer] Connected to Redis")
        except Exception as e:
            print(f"[AIConsumer] Redis connection failed: {e}")
    
    consumer = AIConsumer(redis_client)
    await consumer.start()
    
    return consumer


if __name__ == "__main__":
    asyncio.run(run_consumer())
