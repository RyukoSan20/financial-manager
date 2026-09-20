# FinManager Deployment Guide

## Architecture

```
User → Vercel (Frontend) → Railway (Backend API) → PostgreSQL (Database)
```

## Prerequisites

1. GitHub account
2. Vercel account (https://vercel.com)
3. Railway account (https://railway.app)

## Step 1: Push to GitHub

```bash
cd financial-manager

# Initialize git if not already
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Financial Manager v2.0"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/financial-manager.git

# Push
git push -u origin main
```

## Step 2: Deploy Backend to Railway

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect Python
5. **Configure:**
   - Root directory: `backend` (or keep default and use start command)
   - Start command: `cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. **Add Environment Variables:**
   - `DEBUG` = `false`
   - `DATABASE_URL` = (Railway will create PostgreSQL, copy the URL from Variables tab)
7. Click "Deploy"
8. Wait for deployment → Get your URL (e.g., `https://financial-manager.up.railway.app`)

### Railway PostgreSQL Setup

1. In Railway project dashboard, click "Add Redis/Database"
2. Select "PostgreSQL"
3. Railway will create and attach it automatically
4. Copy the `DATABASE_URL` from the Variables tab
5. The app will auto-create tables on first startup

## Step 3: Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. **Configure:**
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Add Environment Variables:**
   - `VITE_API_URL` = `https://YOUR-RAILWAY-APP.railway.app/api`
     (Replace YOUR-RAILWAY-APP with your actual Railway URL)
6. Click "Deploy"
7. Wait for deployment → Get your URL (e.g., `https://financial-manager.vercel.app`)

## Step 4: Update CORS

After getting Railway URL, update the backend CORS:

1. Go to Railway project → Variables
2. Add/Update:
   - `CORS_ORIGINS` = `["https://financial-manager.vercel.app"]`

Or update `app/core/config.py` in your repo:

```python
CORS_ORIGINS: list[str] = [
    "https://financial-manager.vercel.app",
]
```

Then redeploy.

## Step 5: Verify Deployment

### Backend Health Check
```
https://YOUR-RAILWAY-APP.railway.app/health
```

Should return:
```json
{"status": "healthy", "version": "2.0.0"}
```

### API Info
```
https://YOUR-RAILWAY-APP.railway.app/api/info
```

### Frontend
```
https://YOUR-VERCEL-APP.vercel.app
```

## Common Issues

### CORS Error
- Add your Vercel URL to `CORS_ORIGINS` in backend config
- Redeploy backend

### 500 Internal Server Error
- Check Railway logs for error details
- Verify DATABASE_URL is set correctly
- Ensure PostgreSQL is attached

### Empty Dashboard
- Backend needs categories before transactions
- Call `POST /api/categories/seed-defaults` to seed default categories

### Build Failed (Vercel)
- Check build logs
- Ensure node version is 18+
- Verify environment variables are set

## Redeploy

### Vercel
- Just push to main branch → auto-deploy
- Or click "Redeploy" in Vercel dashboard

### Railway
- Push to main branch → auto-deploy
- Or click "Redeploy" in Railway dashboard

## Local Development with Production DB

To test with production database locally:

1. Copy DATABASE_URL from Railway
2. Create `.env` in backend folder:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   DEBUG=true
   ```
3. Run backend normally

## Database Migration

SQLAlchemy will auto-create tables on startup. For production changes:

1. Use Alembic (add to project if needed)
2. Or manually adjust models and redeploy

## Cost

- Vercel: Free tier sufficient for personal use
- Railway: Free tier includes 500 hours/month, $5 credit on signup
