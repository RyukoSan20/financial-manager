# Railway Backup Configuration
# Created: 2024-10-10

## Project Info
Project ID: fd63e98d-3804-4672-9b60-71c5915512fe
Railway Project ID: 853c1fc8-4339-4a19-abc3-17a4dbff2cfd

## Backend Service
- Name: financial-manager (or similar)
- Region: Singapore (sin1)
- Build: Dockerfile
- Docker Path: backend/Dockerfile

## Dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
ENV PORT=8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

## Health Check
Path: /health

## Environment Variables (DARI RAILWAY DASHBOARD - PASTE VALUES KAMU)
# DATABASE_URL - postgresql dari Railway PostgreSQL atau Supabase
# GEMINI_API_KEY - untuk AI features
# SUPABASE_URL - https://slrtkzgnwaovzvkjmfwz.supabase.co
# SUPABASE_ANON_KEY - untuk Supabase auth
# SUPABASE_SERVICE_ROLE_KEY - untuk Supabase admin
# GEMINI_MODEL - gemini-3.8-flash
# FINNHUB_API_KEY - untuk stock market data
# API_NINJAS_KEY - untuk currency exchange

## Notes
- EasyOCR disabled (too heavy for Railway memory)
- FastEmbed disabled (optional)
- scan_jobs route disabled (OCR feature)
- Parser route still active (text parsing, no OCR)
