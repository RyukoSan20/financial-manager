> **This document is out of date.**
>
> It describes a deployment that is no longer used: the frontend on
> Vercel and the backend on Railway. The application is now served from
> one server, by Docker, behind nginx. The backend runs on the server
> and the frontend is served as static files by the same nginx.
>
> The current setup is described in **[docs/DEPLOYMENT_MAP.md](docs/DEPLOYMENT_MAP.md)**,
> and the pipeline that puts it there is
> **[.github/workflows/deploy.yml](.github/workflows/deploy.yml)**.
>
> This file is kept for the record. Do not follow it.

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
