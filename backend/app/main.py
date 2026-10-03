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
async def startup():
    init_db()
    seed_categories()
    # Run schema migrations in background thread
    import threading
    t = threading.Thread(target=_run_schema_migrations, daemon=True)
    t.start()

def _run_schema_migrations():
    """Run database schema migrations for new columns (called from background)."""
    import time
    time.sleep(3)  # Wait for app to fully start
    
    from sqlalchemy import text, inspect
    try:
        from app.core.database import engine
        
        with engine.connect() as conn:
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns('receipt_items')]
            
            if 'is_discount' not in columns:
                conn.execute(text("""
                    ALTER TABLE receipt_items ADD COLUMN is_discount BOOLEAN DEFAULT FALSE
                """))
                conn.commit()
                print("[MIGRATION] Added is_discount column")
            else:
                print("[MIGRATION] is_discount column exists")
            
            print("[MIGRATION] Starting migrations...")
            
            # Migration: Add supabase_id to users table
            user_columns = [col['name'] for col in inspector.get_columns('users')]
            print(f"[MIGRATION] Current user columns: {user_columns}")
            if 'supabase_id' not in user_columns:
                try:
                    # Add column without UNIQUE first (simpler migration)
                    conn.execute(text("""
                        ALTER TABLE users ADD COLUMN supabase_id VARCHAR(255)
                    """))
                    conn.commit()
                    print("[MIGRATION] Added supabase_id column to users")
                except Exception as e:
                    print(f"[MIGRATION] Failed to add supabase_id: {e}")
            else:
                print("[MIGRATION] supabase_id column already exists")
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
