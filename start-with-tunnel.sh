#!/bin/bash
set -e

echo "=== Financial Manager with Cloudflare Tunnel ==="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    # macOS
    if command -v brew &> /dev/null; then
        brew install cloudflare/cloudflare/cloudflared
    else
        # Linux/other
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
        chmod +x /usr/local/bin/cloudflared
    fi
fi

# Start tunnel
echo "Starting Cloudflare Tunnel to localhost:8000..."
cloudflared tunnel --url http://localhost:8000

