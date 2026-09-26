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
    #     "postgresql://user:password@localhost:5432/finmanager"
    # )
    
    # CORS - configure for production
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://financial-manager-flax.vercel.app",
        "https://financial-manager-nu.vercel.app",
        "https://financial-manager-inky.vercel.app",
        "https://financial-manager-kwi4rf5e7-fin-pro2.vercel.app",
        "https://financial-manager-b5zc5d9ic-fin-pro2.vercel.app",
        "https://financial-manager-production-a042.up.railway.app",
    ]
    
    # Currency
    DEFAULT_CURRENCY: str = "IDR"
    CURRENCY_SYMBOL: dict[str, str] = {"IDR": "Rp", "USD": "$"}
    
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
