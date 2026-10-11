#!/bin/bash
set -e

echo "=== Financial Manager Local Development ==="
echo ""

cd "$(dirname "$0")"

# Start PostgreSQL
echo "Starting PostgreSQL..."
docker run -d \
  --name financial-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=localpassword \
  -e POSTGRES_DB=financial_manager \
  -p 5433:5432 \
  -v financial_postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine

# Wait for PostgreSQL
echo "Waiting for PostgreSQL to start..."
sleep 5

# Build backend image
echo "Building backend image..."
docker build -t financial-backend -f backend/Dockerfile.local backend/

# Start backend
echo "Starting backend..."
docker run -d \
  --name financial-backend \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql://postgres:localpassword@host.docker.internal:5433/financial_manager \
  -e SECRET_KEY=dev-secret-key-change-in-production \
  -e ALGORITHM=HS256 \
  -e ACCESS_TOKEN_EXPIRE_MINUTES=30 \
  -v "$(pwd)/backend:/app" \
  -v financial_uploads:/app/uploads \
  financial-backend

echo ""
echo "=== Services started ==="
echo ""
echo "PostgreSQL: localhost:5433"
echo "Backend:    http://localhost:8000"
echo "API Docs:   http://localhost:8000/docs"
echo ""
echo "To stop:"
echo "  docker stop financial-backend financial-postgres"
echo "  docker rm financial-backend financial-postgres"
