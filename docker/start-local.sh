#!/bin/bash
# Financial Manager - Local Development Startup Script
# Usage: ./start-local.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Financial Manager - Local Development Environment     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Docker
log_info "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi
log_success "Docker is running"

# Create .env if not exists
if [ ! -f .env ]; then
    log_info "Creating .env from template..."
    cat > .env << 'EOF'
# Database
DB_PASSWORD=finmanager_secret_2024

# Supabase (keep from Railway)
SUPABASE_URL=https://slrtkzgnwaovzvkjmfwz.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here

# Security
SECRET_KEY=your-super-secret-key-minimum-32-characters-long

# App Settings
DEBUG=true
EOF
    log_warn "Please edit .env and add your Supabase keys!"
fi

# Load env vars
source .env 2>/dev/null || true

# Check for existing containers
if docker ps | grep -q finmanager-db; then
    log_info "PostgreSQL container already running"
else
    log_info "Starting PostgreSQL..."
    docker run -d \
        --name finmanager-db \
        -e POSTGRES_USER=finmanager \
        -e POSTGRES_PASSWORD=${DB_PASSWORD:-finmanager_secret_2024} \
        -e POSTGRES_DB=finmanager \
        -p 5432:5432 \
        -v "$SCRIPT_DIR/volumes/postgres:/var/lib/postgresql/data" \
        postgres:15-alpine
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker exec finmanager-db pg_isready -U finmanager > /dev/null 2>&1; then
            log_success "PostgreSQL is ready"
            break
        fi
        sleep 1
    done
fi

# Check for existing backend
log_info "Checking backend status..."
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    log_success "Backend is already running"
else
    log_info "Starting backend..."
    cd "$SCRIPT_DIR/../backend"
    
    # Check if venv exists
    if [ ! -d "venv" ]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate venv and install deps
    source venv/bin/activate
    pip install -q -r requirements-minimal.txt 2>/dev/null || pip install -q -r requirements.txt
    
    # Start backend
    export DATABASE_URL="postgresql://finmanager:${DB_PASSWORD:-finmanager_secret_2024}@localhost:5432/finmanager"
    export SUPABASE_URL="$SUPABASE_URL"
    export SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
    export SECRET_KEY="${SECRET_KEY:-your-super-secret-key-change-this}"
    
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    
    # Wait for backend
    log_info "Waiting for backend to be ready..."
    for i in {1..30}; do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            log_success "Backend is ready"
            break
        fi
        sleep 1
    done
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ✓ All Services Ready!                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Local URLs:${NC}"
echo -e "    ${BLUE}Backend API:${NC}    http://localhost:8000"
echo -e "    ${BLUE}API Docs:${NC}       http://localhost:8000/docs"
echo -e "    ${BLUE}Database:${NC}        postgresql://localhost:5432/finmanager"
echo ""
echo -e "  ${YELLOW}To use with Vercel Frontend:${NC}"
echo -e "    Set VITE_API_URL to Railway URL in Vercel dashboard"
echo -e "    Or use Cloudflare Tunnel (see docs/TUNNEL_SETUP.md)"
echo ""
echo -e "  ${YELLOW}Useful Commands:${NC}"
echo -e "    docker logs -f finmanager-db  # View database logs"
echo -e "    docker stop finmanager-db       # Stop database"
echo -e "    ./start-local.sh                # Restart this script"
echo ""

# Keep script running to maintain services
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for interrupt
wait
