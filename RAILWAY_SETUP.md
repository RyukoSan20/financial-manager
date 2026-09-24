# Railway Deployment Guide

## Step 1: Delete existing Railway PostgreSQL
# Railway Dashboard → PostgreSQL → Settings → Delete

## Step 2: Create new PostgreSQL via CLI
railway add postgres

## Step 3: Verify connection
railway run psql -c "SELECT 1"

## Step 4: Get DATABASE_URL
railway variables | grep DATABASE

## Step 5: If auto-linked, just redeploy
cd /Users/rafi/financial-manager/backend
railway up

## If not auto-linked, manually add variable:
railway variables set DATABASE_URL="postgresql://postgres:xxx@host:port/db"
railway up
