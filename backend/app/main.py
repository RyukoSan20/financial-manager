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
    auth, data, parser, ai_advisor, feed,
    # scan_jobs disabled (OCR)
    exchange, market, finnhub, ninjas, market_intel, zap_ink,
    realtime_market, logs, merchant, webhooks
)

# Import models to register with SQLAlchemy
from app.models import *  # noqa: F401, F403

# Import middleware
from app.middleware import LoggingMiddleware

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="Personal finance management API with calculation engine, budgeting, goals, and analytics",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add logging middleware
app.add_middleware(LoggingMiddleware)

# CORS - configured from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://my-financial-manager.online",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.trycloudflare\.com|financial-manager\.id",
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

            # Migration: scan_jobs table
            existing_tables = inspector.get_table_names()
            if 'scan_jobs' not in existing_tables:
                conn.execute(text("""
                    CREATE TABLE scan_jobs (
                        id SERIAL PRIMARY KEY,
                        job_id VARCHAR(36) UNIQUE NOT NULL,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        status VARCHAR(20) DEFAULT 'pending',
                        image_filename VARCHAR(255) NOT NULL,
                        image_path VARCHAR(512) NOT NULL,
                        image_size INTEGER,
                        image_width INTEGER,
                        image_height INTEGER,
                        chunks_total INTEGER DEFAULT 0,
                        chunks_completed INTEGER DEFAULT 0,
                        chunk_results JSONB,
                        tesseract_text TEXT,
                        easyocr_text TEXT,
                        rapidocr_text TEXT,
                        tesseract_confidence NUMERIC(5,2),
                        easyocr_confidence NUMERIC(5,2),
                        rapidocr_confidence NUMERIC(5,2),
                        combined_text TEXT,
                        combined_confidence NUMERIC(5,2),
                        gemini_parsed JSONB,
                        receipt_scan_id INTEGER REFERENCES receipt_scans(id),
                        error_message TEXT,
                        retry_count INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        started_at TIMESTAMP,
                        completed_at TIMESTAMP
                    )
                """))
                conn.commit()
                print("[MIGRATION] Created scan_jobs table")

            # Migration: scan_chunks table
            if 'scan_chunks' not in existing_tables:
                conn.execute(text("""
                    CREATE TABLE scan_chunks (
                        id SERIAL PRIMARY KEY,
                        scan_job_id INTEGER NOT NULL REFERENCES scan_jobs(id),
                        chunk_index INTEGER NOT NULL,
                        region_type VARCHAR(50) NOT NULL,
                        bbox_x INTEGER,
                        bbox_y INTEGER,
                        bbox_width INTEGER,
                        bbox_height INTEGER,
                        tesseract_text TEXT,
                        easyocr_text TEXT,
                        rapidocr_text TEXT,
                        tesseract_confidence NUMERIC(5,2),
                        easyocr_confidence NUMERIC(5,2),
                        rapidocr_confidence NUMERIC(5,2),
                        best_text TEXT,
                        best_engine VARCHAR(20),
                        gemini_interpretation JSONB,
                        is_processed BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.commit()
                print("[MIGRATION] Created scan_chunks table")

            # Existing receipt_items migration
            columns = [col['name'] for col in inspector.get_columns('receipt_items')]

            if 'is_discount' not in columns:
                conn.execute(text("""
                    ALTER TABLE receipt_items ADD COLUMN is_discount BOOLEAN DEFAULT FALSE
                """))
                conn.commit()
                print("[MIGRATION] Added is_discount column")

            # Migration: Add supabase_id to users table
            user_columns = [col['name'] for col in inspector.get_columns('users')]
            if 'supabase_id' not in user_columns:
                try:
                    conn.execute(text("""
                        ALTER TABLE users ADD COLUMN supabase_id VARCHAR(255)
                    """))
                    conn.commit()
                    print("[MIGRATION] Added supabase_id column to users")
                except Exception as e:
                    print(f"[MIGRATION] Failed to add supabase_id: {e}")

            # Migration: Add period_type to budgets if missing
            try:
                budgets_columns = [col['name'] for col in inspector.get_columns('budgets')]
                if 'period_type' not in budgets_columns:
                    conn.execute(text("ALTER TABLE budgets ADD COLUMN period_type VARCHAR(20) DEFAULT 'monthly'"))
                    conn.commit()
                    print("[MIGRATION] Added period_type column to budgets")
            except Exception as e:
                print(f"[MIGRATION] budgets period_type: {e}")

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
# app.include_router(scan_jobs.router, prefix="/api/scan-jobs", tags=["Scan Jobs"])  # OCR DISABLED
app.include_router(ai_advisor.router, prefix="/api/ai", tags=["AI Advisor"])
app.include_router(feed.router, prefix="/api/feed", tags=["Feed & Review"])
app.include_router(exchange.router, prefix="/api/exchange")
app.include_router(market.router, prefix="/api/market")
app.include_router(finnhub.router, prefix="/api/finnhub")
app.include_router(ninjas.router, prefix="")
app.include_router(market_intel.router, prefix="")
app.include_router(zap_ink.router, prefix="")
app.include_router(realtime_market.router, prefix="", tags=["realtime-market"])
app.include_router(logs.router, prefix="/api", tags=["Logs"])
app.include_router(merchant.router, prefix="/api", tags=["Merchant"])
app.include_router(webhooks.router, prefix="/api", tags=["Webhooks"])

# Enterprise modules
try:
    from app.modules.ledger.analytics_router import router as analytics_router
    app.include_router(analytics_router, prefix="/api", tags=["Analytics"])
except ImportError:
    print("[WARN] Analytics router not available")

try:
    from app.modules.ai_advisor.router import router as ai_advisor_router
    app.include_router(ai_advisor_router, tags=["AI Advisor"])
except ImportError:
    print("[WARN] AI Advisor router not available")

# Error monitoring module
try:
    from app.modules.ai_monitor.client_error_router import router as error_router
    app.include_router(error_router, tags=["Error Monitoring"])
except ImportError:
    print("[WARN] Error monitoring router not available")

# Email Parser module
try:
    from app.modules.integrations.email_parser.gmail_router import router as gmail_router
    app.include_router(gmail_router, tags=["Gmail Integration"])
except ImportError as e:
    print(f"[WARN] Gmail router not available: {e}")

# Health Coach module
try:
    from app.modules.ai_advisor.health_coach.router import router as health_coach_router
    app.include_router(health_coach_router, tags=["AI Health Coach"])
except ImportError as e:
    print(f"[WARN] Health Coach router not available: {e}")

# Location Analytics module
try:
    from app.modules.ledger.location.router import router as location_router
    app.include_router(location_router, tags=["Location Analytics"])
except ImportError as e:
    print(f"[WARN] Location router not available: {e}")

# Shopping Tracker module
try:
    from app.modules.ledger.shopping.router import router as shopping_router
    app.include_router(shopping_router, tags=["Shopping Tracker"])
except ImportError as e:
    print(f"[WARN] Shopping router not available: {e}")


# Recurring auto-generator cron endpoint (for Railway cron)
from app.services.recurring_generator import process_due_recurring_rules

@app.api_route("/api/cron/process-recurring", methods=["GET", "POST"], tags=["Cron"])
def cron_process_recurring(request: Request):
    """
    Process all due recurring rules and auto-generate transactions.
    GET = automatic cron (only process due rules)
    POST = manual trigger (force process all active rules including future)
    """
    is_manual = request.method == "POST"
    results = process_due_recurring_rules(force_today=is_manual)
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
