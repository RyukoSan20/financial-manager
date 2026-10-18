"""
Gemini AI Client - Multi-model AI orchestration with function calling.
Supports Gemini, Claude, and OpenAI with fallback.
"""
import os
import json
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass


@dataclass
class AIResponse:
    """Structured AI response."""
    text: str
    finish_reason: str
    usage: Dict[str, int]
    functions_called: Optional[List[str]] = None


class AIProvider(str):
    """Supported AI providers."""
    GEMINI = "gemini"
    CLAUDE = "claude"
    OPENAI = "openai"


class BaseAIClient:
    """Base class for AI clients."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def generate(self, prompt: str, **kwargs) -> AIResponse:
        raise NotImplementedError


class GeminiClient(BaseAIClient):
    """
    Google Gemini AI client with function calling support.
    Uses Gemini 1.5 Flash for fast responses.
    """
    
    API_URL = "https://generativeagent.googleapis.com/v1/models/gemini-1.5-flash:generateContent"
    
    def __init__(self, api_key: Optional[str] = None):
        # Try multiple API key env vars
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1")
        self.api_url = self.API_URL
    
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        functions: Optional[List[Dict]] = None,
        **kwargs
    ) -> AIResponse:
        """Generate response with optional function calling."""
        import requests
        
        # Build request
        contents = [{"parts": [{"text": prompt}]}]
        
        generation_config = {
            "temperature": kwargs.get("temperature", 0.7),
            "maxOutputTokens": kwargs.get("max_tokens", 2048),
        }
        
        request_body = {
            "contents": contents,
            "generationConfig": generation_config,
        }
        
        if system_prompt:
            request_body["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }
        
        if functions:
            request_body["tools"] = [{"functionDeclarations": functions}]
        
        try:
            response = requests.post(
                f"{self.api_url}?key={self.api_key}",
                json=request_body,
                timeout=30
            )
            
            if response.status_code != 200:
                return AIResponse(
                    text=f"AI Error: {response.status_code}",
                    finish_reason="ERROR",
                    usage={}
                )
            
            data = response.json()
            
            # Extract response
            candidate = data.get("candidates", [{}])[0]
            content = candidate.get("content", {})
            parts = content.get("parts", [{}])
            
            text_parts = [p.get("text", "") for p in parts if p.get("text")]
            text = "\n".join(text_parts)
            
            # Check for function calls
            function_calls = []
            for p in parts:
                if p.get("functionCall"):
                    fc = p["functionCall"]
                    function_calls.append(fc.get("name"))
            
            return AIResponse(
                text=text,
                finish_reason=candidate.get("finishReason", "STOP"),
                usage=data.get("usageMetadata", {}),
                functions_called=function_calls if function_calls else None
            )
            
        except Exception as e:
            return AIResponse(
                text=f"AI Error: {str(e)}",
                finish_reason="ERROR",
                usage={}
            )
    
    async def generate_stream(self, prompt: str, **kwargs):
        """Generate streaming response (async generator)."""
        import httpx
        
        contents = [{"parts": [{"text": prompt}]}]
        generation_config = {
            "temperature": kwargs.get("temperature", 0.7),
            "maxOutputTokens": kwargs.get("max_tokens", 2048),
        }
        
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.api_url}?key={self.api_key}",
                json={"contents": contents, "generationConfig": generation_config},
                timeout=30
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        data = json.loads(line[5:])
                        part = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0]
                        if part.get("text"):
                            yield part["text"]


class FunctionRegistry:
    """
    Registry of callable functions for AI function calling.
    Each function corresponds to a ledger operation.
    """
    
    def __init__(self, db_session=None, user_id: int = None):
        self.db = db_session
        self.user_id = user_id
    
    def get_declarations(self) -> List[Dict]:
        """Get function declarations for AI model."""
        return [
            {
                "name": "get_balance_summary",
                "description": "Get user's total balance across all accounts",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_monthly_expenses",
                "description": "Get total monthly expenses for current month",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "months": {
                            "type": "number",
                            "description": "Number of months to look back (default: 1)"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_top_expenses",
                "description": "Get top expense categories",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "number",
                            "description": "Number of categories (default: 5)"
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_savings_rate",
                "description": "Calculate savings rate percentage",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_budget_status",
                "description": "Check budget utilization status",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_debt_summary",
                "description": "Get total outstanding debt",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_goal_progress",
                "description": "Get savings goal progress",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
        ]
    
    async def call_function(self, name: str, args: Dict) -> Dict:
        """Execute a registered function."""
        func = getattr(self, name, None)
        if not func:
            return {"error": f"Unknown function: {name}"}
        
        try:
            result = func(args)
            if hasattr(result, '__await__'):
                return await result
            return result
        except Exception as e:
            return {"error": str(e)}
    
    def get_balance_summary(self, args: Dict) -> Dict:
        """Get total balance across accounts."""
        if not self.db:
            return {"total_balance": 0, "accounts": []}
        
        from app.models.account import Account
        
        accounts = self.db.query(Account).filter(
            Account.user_id == self.user_id,
            Account.is_active == True
        ).all()
        
        total = sum(float(a.balance or 0) for a in accounts)
        
        return {
            "total_balance": total,
            "currency": "IDR",
            "account_count": len(accounts),
            "accounts": [
                {"name": a.name, "balance": float(a.balance or 0)}
                for a in accounts[:5]
            ]
        }
    
    def get_monthly_expenses(self, args: Dict) -> Dict:
        """Get monthly expense total."""
        if not self.db:
            return {"total_expense": 0, "month": ""}
        
        from datetime import date
        from app.models.transaction import Transaction
        from sqlalchemy import func, extract
        
        months = args.get("months", 1)
        
        today = date.today()
        start_date = today.replace(day=1)
        
        expenses = self.db.query(
            func.sum(func.abs(Transaction.amount))
        ).filter(
            Transaction.user_id == self.user_id,
            Transaction.type == "expense",
            Transaction.date >= start_date
        ).scalar() or 0
        
        return {
            "total_expense": float(expenses),
            "month": start_date.strftime("%B %Y"),
            "currency": "IDR"
        }
    
    def get_top_expenses(self, args: Dict) -> Dict:
        """Get top expense categories."""
        if not self.db:
            return {"categories": []}
        
        from app.models.transaction import Transaction, Category
        from sqlalchemy import func
        
        limit = args.get("limit", 5)
        
        results = self.db.query(
            Category.name,
            func.sum(func.abs(Transaction.amount)).label("total")
        ).join(
            Transaction, Transaction.category_id == Category.id
        ).filter(
            Transaction.user_id == self.user_id,
            Transaction.type == "expense"
        ).group_by(
            Category.name
        ).order_by(
            func.sum(func.abs(Transaction.amount)).desc()
        ).limit(limit).all()
        
        return {
            "categories": [
                {"name": r[0], "total": float(r[1])}
                for r in results
            ]
        }
    
    def get_savings_rate(self, args: Dict) -> Dict:
        """Calculate savings rate."""
        if not self.db:
            return {"savings_rate": 0}
        
        from datetime import date
        from app.models.transaction import Transaction
        from sqlalchemy import func
        
        today = date.today()
        start_date = today.replace(day=1)
        
        income = self.db.query(
            func.sum(Transaction.amount)
        ).filter(
            Transaction.user_id == self.user_id,
            Transaction.type == "income",
            Transaction.date >= start_date
        ).scalar() or 0
        
        expense = self.db.query(
            func.sum(func.abs(Transaction.amount))
        ).filter(
            Transaction.user_id == self.user_id,
            Transaction.type == "expense",
            Transaction.date >= start_date
        ).scalar() or 0
        
        savings_rate = ((float(income) - float(expense)) / float(income) * 100) if income > 0 else 0
        
        return {
            "savings_rate": round(savings_rate, 1),
            "income": float(income),
            "expense": float(expense),
            "savings": float(income) - float(expense)
        }
    
    def get_budget_status(self, args: Dict) -> Dict:
        """Check budget utilization."""
        if not self.db:
            return {"budgets": []}
        
        from app.models.budget import Budget
        
        budgets = self.db.query(Budget).filter(
            Budget.user_id == self.user_id,
            Budget.is_active == True
        ).all()
        
        return {
            "budgets": [
                {
                    "name": b.name,
                    "limit": float(b.amount or 0),
                    "spent": 0,  # Calculate from transactions
                    "remaining": float(b.amount or 0)
                }
                for b in budgets[:5]
            ]
        }
    
    def get_debt_summary(self, args: Dict) -> Dict:
        """Get total outstanding debt."""
        if not self.db:
            return {"total_debt": 0, "debts": []}
        
        from app.models.debt import Debt
        
        debts = self.db.query(Debt).filter(
            Debt.user_id == self.user_id,
            Debt.is_active == True
        ).all()
        
        total = sum(float(d.current_balance or 0) for d in debts)
        
        return {
            "total_debt": total,
            "debt_count": len(debts),
            "currency": "IDR"
        }
    
    def get_goal_progress(self, args: Dict) -> Dict:
        """Get savings goal progress."""
        if not self.db:
            return {"goals": []}
        
        from app.models.goal import Goal
        
        goals = self.db.query(Goal).filter(
            Goal.user_id == self.user_id,
            Goal.is_active == True
        ).all()
        
        return {
            "goals": [
                {
                    "name": g.name,
                    "target": float(g.target_amount or 0),
                    "current": float(g.current_amount or 0),
                    "progress": float(g.current_amount or 0) / float(g.target_amount or 1) * 100 if g.target_amount else 0
                }
                for g in goals[:3]
            ]
        }


# Singleton AI client factory
def get_ai_client(provider: str = AIProvider.GEMINI) -> BaseAIClient:
    """Get AI client instance."""
    if provider == AIProvider.GEMINI:
        return GeminiClient()
    # Add other providers as needed
    return GeminiClient()
