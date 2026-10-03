"""FastAPI main application."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.database import init_db, seed_categories
from app.core.config import get_settings
from app.api.routes import (
    accounts, categories, transactions, budgets,
    dashboard, calculators,
    transfers, recurring, goals, debts, analytics,
    auth, data, parser, ai_advisor
)

# Import models to register with SQLAlchemy
from app.models import *  # noqa: F401, F403

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="Personal finance management API with calculation engine, budgeting, goals, and analytics",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS - configured from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://financial-manager-inky.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database and seed data on startup
@app.on_event("startup")
def startup():
    init_db()
    seed_categories()
    
    # Auto-migrate database schema
    _run_schema_migrations()

def _run_schema_migrations():
    """Run database schema migrations for new columns."""
    from sqlalchemy import text
    from app.core.database import engine
    
    migrations = [
        ("is_discount", "ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS is_discount BOOLEAN DEFAULT FALSE"),
    ]
    
    try:
        with engine.connect() as conn:
            for col_name, sql in migrations:
                # Check if column exists
                result = conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'receipt_items' AND column_name = '{col_name}'
                """))
                if not result.fetchone():
                    conn.execute(text(sql))
                    conn.commit()
                    print(f"[MIGRATION] Added column: {col_name}")
                else:
                    print(f"[MIGRATION] Column exists: {col_name}")
    except Exception as e:
        print(f"[MIGRATION] Warning: {e}")

# Include routers
app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(transfers.router, prefix="/api/transfers", tags=["Transfers"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["Budgets"])
app.include_router(recurring.router, prefix="/api/recurring", tags=["Recurring"])
app.include_router(goals.router, prefix="/api/goals", tags=["Goals"])
app.include_router(debts.router, prefix="/api/debts", tags=["Debts"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(calculators.router, prefix="/api/calculators", tags=["Calculators"])
app.include_router(data.router, prefix="/api/data", tags=["Data"])
app.include_router(parser.router, prefix="/api/parser", tags=["Parser"])
app.include_router(ai_advisor.router, prefix="/api/ai", tags=["AI Advisor"])


# Recurring auto-generator cron endpoint (for Railway cron)
from app.services.recurring_generator import process_due_recurring_rules

@app.api_route("/api/cron/process-recurring", methods=["GET", "POST"], tags=["Cron"])
def cron_process_recurring(request: Request):
    """
    Process all due recurring rules and auto-generate transactions.
    Call this endpoint daily via Railway Cron.
    """
    results = process_due_recurring_rules()
    return {"status": "completed", **results}


# Root endpoint
@app.get("/", tags=["Root"])
def root():
    return {
        "message": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


# Health check endpoint
@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy", "version": settings.APP_VERSION}


# API info endpoint
@app.get("/api/info", tags=["Info"])
def api_info():
    """Get API information and available endpoints."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "modules": [
            "accounts - Wallet/bank account management",
            "categories - Income/expense categorization",
            "transactions - Income/expense records",
            "transfers - Account-to-account transfers",
            "budgets - Budget limits and tracking",
            "recurring - Recurring transaction rules",
            "goals - Financial goals and savings targets",
            "debts - Loan and debt management",
            "analytics - Financial insights and trends",
            "dashboard - Summary and quick stats",
            "calculators - Financial calculators",
        ],
        "docs": "/docs",
        "redoc": "/redoc",
    }


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": str(exc) if settings.DEBUG else "An unexpected error occurred",
            "path": str(request.url),
        }
    )
# trigger redeploy
