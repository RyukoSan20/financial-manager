#!/bin/bash
set -e

echo "=== Financial Manager Local Development (Python) ==="
echo ""

cd "$(dirname "$0")/backend"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python3 is not installed"
    exit 1
fi

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv and install dependencies
echo "Installing dependencies..."
source venv/bin/activate
pip install -q -r requirements-minimal.txt

# Set environment variables
export DATABASE_URL="postgresql://postgres:JbErSpjqBGNEsqLGlLVaOjbHbWbrxTuO@postgres.railway.internal:5432/railway"
export SECRET_KEY="dev-secret-key-change-in-production"
export ALGORITHM="HS256"
export ACCESS_TOKEN_EXPIRE_MINUTES="30"

# Run migrations
echo "Running migrations..."
cd /Users/rafi/financial-manager/backend
alembic upgrade head 2>/dev/null || echo "Note: Migrations may fail if database is not accessible"

# Start backend
echo ""
echo "Starting backend on http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
