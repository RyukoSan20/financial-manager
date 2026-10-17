# Financial Manager - VPS Deployment Guide

## Overview
This directory contains all deployment configurations for self-hosting Financial Manager on a VPS.

## Recommended VPS Providers
1. **DigitalOcean** - $4-6/mo, easy setup
2. **Vultr** - $5/mo, fast SSD
3. **Linode** - $5/mo, good performance
4. **Hetzner** - €3.5/mo, best value (EU)

## Quick Start

### 1. Server Requirements
- Ubuntu 22.04 LTS (recommended)
- 1GB RAM minimum (2GB recommended)
- 20GB SSD
- Docker & Docker Compose installed

### 2. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 3. Clone & Setup
```bash
git clone https://github.com/RyukoSan20/financial-manager.git
cd financial-manager
cp docker/.env.example docker/.env
# Edit .env with your settings
```

### 4. Deploy
```bash
cd docker
docker-compose up -d
```

### 5. Setup Nginx + SSL
```bash
# Copy nginx config
cp nginx/nginx.conf.example nginx/nginx.conf
# Edit with your domain

# Setup Let's Encrypt
certbot --nginx -d yourdomain.com
```

## Files in this directory
- `docker-compose.yml` - Main orchestration
- `Dockerfile` - Backend container
- `nginx/` - Nginx reverse proxy config
- `init-scripts/` - Database initialization scripts
- `.env.example` - Environment template

## Production Checklist
- [ ] Change DB_PASSWORD
- [ ] Set strong SECRET_KEY
- [ ] Configure domain & SSL
- [ ] Setup backup strategy
- [ ] Enable firewall (ufw)
- [ ] Setup monitoring
