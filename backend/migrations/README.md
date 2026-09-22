# Railway PostgreSQL Migration Guide

## Option 1: Run via Railway Dashboard (Recommended)

1. Go to [Railway Dashboard](https://railway.app/project)
2. Select your project → PostgreSQL database
3. Click "Query" tab
4. Copy and paste contents from `migrations/001_phase1_phase2.sql`
5. Click "Run"

## Option 2: Run via psql CLI

```bash
# Get PostgreSQL connection string from Railway
# (Settings → Variables → DATABASE_URL)

# Connect to Railway PostgreSQL
psql "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST.railway.app:5432/railway"

# Run the migration
\i migrations/001_phase1_phase2.sql
```

## Option 3: Run via Python script

```bash
cd backend
python3 -c "
import psycopg2
import os

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

with open('migrations/001_phase1_phase2.sql', 'r') as f:
    sql = f.read()

cur.execute(sql)
conn.commit()
cur.close()
conn.close()

print('Migration completed!')
"
```

## Verification

After running, verify with:

```sql
-- Check user_id columns
SELECT table_name, COUNT(*) FROM information_schema.columns 
WHERE column_name = 'user_id' 
GROUP BY table_name;

-- Check parser columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name LIKE '%merchant%';
```

## Rollback (if needed)

```sql
-- These are NOT reversible - backup first!
-- Contact Railway support if you need database restoration
```
