#!/bin/bash
cd /Users/rafi/financial-manager/backend
export DATABASE_URL="postgresql://finmanager:finmanager_secret_2024@localhost:5432/finmanager"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
