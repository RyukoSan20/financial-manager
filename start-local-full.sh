#!/bin/bash
# Financial Manager - Full Local Setup Script
# Starts: PostgreSQL + Backend + Cloudflare Tunnel

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
TUNNEL_LOG="$SCRIPT_DIR/logs/tunnel.log"
BACKEND_LOG="$SCRIPT_DIR/logs/backend.log"
PID_DIR="$SCRIPT_DIR/.pids"

mkdir -p "$SCRIPT_DIR/logs" "$PID_DIR"

echo "=========================================="
echo "  Financial Manager - Local Setup"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if already running
is_running() {
    local name=$1
    local pidfile="$PID_DIR/$name.pid"
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            rm -f "$pidfile"
        fi
    fi
    return 1
}

# Stop all services
stop_all() {
    log_info "Stopping all services..."
    
    for pidfile in "$PID_DIR"/*.pid; do
        if [ -f "$pidfile" ]; then
            name=$(basename "$pidfile" .pid)
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                log_info "Stopping $name (PID: $pid)..."
                kill "$pid" 2>/dev/null || true
                sleep 1
                kill -9 "$pid" 2>/dev/null || true
            fi
            rm -f "$pidfile"
        fi
    done
    
    # Stop cloudflared
    pkill -f "cloudflared tunnel" 2>/dev/null || true
    
    log_info "All services stopped."
}

# Start PostgreSQL
start_postgres() {
    if is_running "postgres"; then
        log_info "PostgreSQL already running"
        return 0
    fi
    
    log_info "Starting PostgreSQL..."
    
    # Check if PostgreSQL is installed
    if ! command -v pg_ctl &> /dev/null; then
        log_error "PostgreSQL not found. Please install PostgreSQL."
        exit 1
    fi
    
    # Start PostgreSQL
    pg_ctl -D /opt/homebrew/var/postgresql@16 start 2>/dev/null || \
    pg_ctl -D /opt/homebrew/var/postgresql start 2>/dev/null || {
        # Try to connect if already running
        if pg_isready &>/dev/null; then
            log_info "PostgreSQL is already running"
        else
            log_error "Failed to start PostgreSQL"
            exit 1
        fi
    }
    
    # Wait for PostgreSQL
    for i in {1..10}; do
        if pg_isready &>/dev/null; then
            log_info "PostgreSQL started successfully"
            return 0
        fi
        sleep 1
    done
    
    log_error "PostgreSQL failed to start"
    exit 1
}

# Start Backend
start_backend() {
    if is_running "backend"; then
        log_info "Backend already running"
        return 0
    fi
    
    log_info "Starting Backend..."
    
    cd "$BACKEND_DIR"
    
    # Check if venv exists
    if [ ! -d "venv" ]; then
        log_warn "Python venv not found. Creating..."
        python3.12 -m venv venv
    fi
    
    source venv/bin/activate
    
    # Set environment
    export DATABASE_URL="postgresql://rafi:rafi123@localhost:5432/financial_manager"
    export SECRET_KEY="dev-secret-key-change-in-production"
    export ALGORITHM="HS256"
    export ACCESS_TOKEN_EXPIRE_MINUTES="30"
    
    # Start backend
    nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$BACKEND_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/backend.pid"
    
    # Wait for backend
    for i in {1..15}; do
        if curl -s http://localhost:8000/health &>/dev/null; then
            log_info "Backend started successfully (PID: $pid)"
            return 0
        fi
        sleep 1
    done
    
    log_error "Backend failed to start. Check logs: $BACKEND_LOG"
    return 1
}

# Start Cloudflare Tunnel
start_tunnel() {
    if is_running "tunnel"; then
        log_info "Tunnel already running"
        return 0
    fi
    
    log_info "Starting Cloudflare Tunnel..."
    
    # Check if cloudflared is installed
    if ! command -v cloudflared &> /dev/null; then
        log_error "cloudflared not found. Installing..."
        brew install cloudflared
    fi
    
    # Start tunnel
    nohup cloudflared tunnel --url http://localhost:8000 > "$TUNNEL_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/tunnel.pid"
    
    # Wait for tunnel URL
    for i in {1..20}; do
        if grep -q "trycloudflare.com" "$TUNNEL_LOG" 2>/dev/null; then
            local tunnel_url=$(grep "trycloudflare.com" "$TUNNEL_LOG" | grep -o 'https://[^ ]*trycloudflare.com' | head -1)
            log_info "Tunnel started successfully"
            log_info "Public URL: $tunnel_url"
            echo "$tunnel_url" > "$PID_DIR/tunnel_url.txt"
            return 0
        fi
        sleep 1
    done
    
    log_warn "Tunnel may not be ready. Check logs: $TUNNEL_LOG"
    return 0
}

# Get tunnel URL
get_tunnel_url() {
    local url=$(cat "$PID_DIR/tunnel_url.txt" 2>/dev/null)
    if [ -z "$url" ]; then
        url=$(grep -o 'https://[^ ]*trycloudflare.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
    fi
    echo "$url"
}

# Status check
status() {
    echo ""
    echo "=========================================="
    echo "  Service Status"
    echo "=========================================="
    
    if pg_isready &>/dev/null; then
        log_info "PostgreSQL: Running"
    else
        log_error "PostgreSQL: Not Running"
    fi
    
    if curl -s http://localhost:8000/health &>/dev/null; then
        log_info "Backend: Running"
    else
        log_error "Backend: Not Running"
    fi
    
    local tunnel_url=$(get_tunnel_url)
    if [ -n "$tunnel_url" ]; then
        log_info "Tunnel URL: $tunnel_url"
    else
        log_warn "Tunnel: Not Ready"
    fi
    
    echo ""
}

# Main
case "${1:-start}" in
    start)
        stop_all
        start_postgres
        start_backend
        start_tunnel
        echo ""
        echo "=========================================="
        echo "  Setup Complete!"
        echo "=========================================="
        status
        echo ""
        log_info "Vercel Frontend: https://frontend-virid-alpha-24.vercel.app"
        log_info "(Make sure VITE_API_URL points to tunnel URL)"
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        start_postgres
        start_backend
        start_tunnel
        status
        ;;
    status)
        status
        ;;
    logs)
        echo "=== Backend Logs ==="
        tail -50 "$BACKEND_LOG" 2>/dev/null || echo "No logs"
        echo ""
        echo "=== Tunnel Logs ==="
        tail -20 "$TUNNEL_LOG" 2>/dev/null || echo "No logs"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
