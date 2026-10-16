#!/bin/bash
# Financial Manager - Local Development Startup Script

set -e

echo "🚀 Starting Financial Manager Local Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Copy .env if not exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local and add your Supabase keys!"
fi

# Start services
echo "📦 Starting Docker services..."
docker compose up -d

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
for i in {1..30}; do
    if docker exec finmanager-db pg_isready -U finmanager > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "   Waiting... ($i/30)"
    sleep 1
done

# Wait for Backend
echo "⏳ Waiting for Backend..."
for i in {1..30}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend is ready!"
        break
    fi
    echo "   Waiting... ($i/30)"
    sleep 1
done

echo ""
echo "🎉 Financial Manager is running!"
echo ""
echo "   Backend API:  http://localhost:8000"
echo "   API Docs:     http://localhost:8000/docs"
echo "   Database:     localhost:5432"
echo ""
echo "📝 To view logs: docker compose logs -f"
echo "📝 To stop:      docker compose down"
echo ""

# Open browser
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:8000/docs
elif command -v open > /dev/null; then
    open http://localhost:8000/docs
fi
