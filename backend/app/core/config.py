"""Application configuration."""

from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    APP_NAME: str = "Financial Manager API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    
    # Database - use environment variable or default to local SQLite
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./financial_manager.db"
    )
    
    # For production, you can use PostgreSQL:
    # DATABASE_URL: str = os.getenv(
    #     "DATABASE_URL",
    #     "postgresql://user:***@localhost:5432/finmanager"
    # )
    
    # CORS - configure for production
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://*.ngrok-free.dev",
        "https://*.ngrok.io",
        "https://fin-manager-production.up.railway.app",
        "https://*.trycloudflare.com",
        "https://my-financial-manager.online",
    ]
    
    # Currency
    DEFAULT_CURRENCY: str = "IDR"
    CURRENCY_SYMBOL: dict[str, str] = {"IDR": "Rp", "USD": "$"}
    
    # Gemini API for Vision OCR fallback
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_VISION_MODEL: str = "gemini-1.5-flash"
    
    # Google OAuth (for Supabase auth)
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "https://my-financial-manager.online/api/auth/google/callback")
    
    # Google Maps API Keys
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    GOOGLE_PLACES_API_KEY: str = os.getenv("GOOGLE_PLACES_API_KEY", "")
    
    # Gmail Integration
    GMAIL_REDIRECT_URI: str = os.getenv("GMAIL_REDIRECT_URI", "https://my-financial-manager.online/api/integrations/gmail/callback")
    
    # Calculation defaults
    DAYS_IN_MONTH: int = 30
    MONTHS_IN_YEAR: int = 12
    WEEKS_IN_YEAR: int = 52
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra fields from .env


@lru_cache()
def get_settings() -> Settings:
    return Settings()
