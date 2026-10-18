#!/bin/bash
cd /Users/rafi/financial-manager/backend
source venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
