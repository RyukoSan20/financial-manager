#!/bin/bash
# Financial Manager - VPS Deployment Script
# Run this on your VPS to deploy the application

set -e

# Configuration
APP_DIR="/opt/financial-manager"
DOMAIN="${DOMAIN:-api.yourdomain.com}"
EMAIL="${EMAIL:-admin@yourdomain.com}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 24)}"
SECRET_KEY="${SECRET_KEY:-$(openssl rand -base64 32)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo "=========================================="
echo "  Financial Manager - VPS Deployment"
echo "=========================================="

# Check root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root or with sudo"
fi

# Update system
log "Updating system packages..."
apt update && apt upgrade -y

# Install Docker
log "Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Install Docker Compose
log "Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create app directory
log "Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or pull latest code
if [ -d ".git" ]; then
    log "Pulling latest code..."
    git pull
else
    log "Cloning repository..."
    git clone https://github.com/RyukoSan20/financial-manager.git .
fi

# Create environment file
log "Creating environment configuration..."
cat > .env << EOF
# Database
DB_PASSWORD=$DB_PASSWORD

# Supabase (keep your existing keys)
SUPABASE_URL=https://slrtkzgnwaovzvkjmfwz.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Security
SECRET_KEY=$SECRET_KEY

# Production Mode
DEBUG=false
EOF

# Create systemd service
log "Creating systemd service..."
cat > /etc/systemd/system/finmanager.service << EOF
[Unit]
Description=Financial Manager Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Start services
log "Starting services..."
docker-compose up -d --build

# Setup firewall
log "Setting up firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Enable service
log "Enabling service..."
systemctl daemon-reload
systemctl enable finmanager

# Setup SSL (if domain is configured)
if [ "$DOMAIN" != "api.yourdomain.com" ]; then
    log "Setting up SSL with Let's Encrypt..."
    apt install -y certbot python3-certbot-nginx
    certbot --nginx -d $DOMAIN --noninteractive --agree-tos -m $EMAIL
fi

echo ""
echo "=========================================="
echo "  ✓ Deployment Complete!"
echo "=========================================="
echo ""
echo "  API URL: http://localhost:8000"
if [ "$DOMAIN" != "api.yourdomain.com" ]; then
    echo "  Domain: https://$DOMAIN"
fi
echo "  Docs:   http://localhost:8000/docs"
echo ""
