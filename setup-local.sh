#!/bin/bash
# Financial Manager - Full Local Development Setup
# This script sets up:
# 1. Local PostgreSQL database
# 2. Local FastAPI backend
# 3. Localtunnel to expose backend
# 4. Instructions for Vercel frontend

set -e

echo "=========================================="
echo "  Financial Manager - Local Setup"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "Please start Docker Desktop first, then run this script again"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Step 2: Start PostgreSQL
echo -e "${YELLOW}Step 2: Starting PostgreSQL...${NC}"

# Check if postgres is already running
if docker ps | grep -q finmanager-db; then
    echo -e "${GREEN}✓ PostgreSQL is already running${NC}"
else
    docker run -d \
        --name finmanager-db \
        -e POSTGRES_USER=finmanager \
        -e POSTGRES_PASSWORD=finmanager_secret_2024 \
        -e POSTGRES_DB=finmanager \
        -p 5432:5432 \
        postgres:15-alpine
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL..."
    for i in {1..30}; do
        if docker exec finmanager-db pg_isready -U finmanager > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
            break
        fi
        sleep 1
    done
fi

# Step 3: Check Backend
echo -e "${YELLOW}Step 3: Checking Backend...${NC}"

cd "$(dirname "$0")/backend"

# Check if backend is already running
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is already running${NC}"
else
    echo "Starting backend..."
    
    # Check if virtualenv exists
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate venv and install dependencies
    source venv/bin/activate
    pip install -q -r requirements.txt 2>/dev/null || pip install -q -r requirements-minimal.txt
    
    # Set environment
    export DATABASE_URL="postgresql://finmanager:finmanager_secret_2024@localhost:5432/finmanager"
    
    # Start backend
    uvicorn app.main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    
    # Wait for backend
    echo "Waiting for backend..."
    for i in {1..30}; do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend is ready${NC}"
            break
        fi
        sleep 1
    done
fi

# Step 4: Start Localtunnel
echo -e "${YELLOW}Step 4: Starting Localtunnel...${NC}"

# Kill existing localtunnel
pkill -f "localtunnel" 2>/dev/null || true
sleep 1

# Start localtunnel
npx --yes localtunnel --port 8000 --subdomain fin-manager-rafi 2>&1 &
LT_PID=$!

# Wait for tunnel
echo "Waiting for tunnel..."
sleep 10

echo ""
echo "=========================================="
echo -e "${GREEN}  ✅ Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Local URLs:"
echo -e "  ${GREEN}Backend API:${NC}     http://localhost:8000"
echo -e "  ${GREEN}API Docs:${NC}        http://localhost:8000/docs"
echo -e "  ${GREEN}Public URL:${NC}      http://fin-manager-rafi.loca.lt"
echo ""
echo "To use with Vercel frontend:"
echo "1. Set VITE_API_URL in Vercel dashboard to: http://fin-manager-rafi.loca.lt"
echo "2. Redeploy frontend"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running
wait
