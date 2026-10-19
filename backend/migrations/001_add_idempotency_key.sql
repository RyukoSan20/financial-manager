-- Migration: Add idempotency key to transactions
-- Prevents duplicate transactions from double-tap or network retry

-- 1. Add client_request_id column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(64);

-- 2. Create index for idempotency lookups
CREATE INDEX IF NOT EXISTS idx_transactions_client_request_id 
ON transactions(user_id, client_request_id);

-- 3. Create unique constraint (only if column is empty or you want to allow multiple nulls)
-- Note: SQLite doesn't support partial unique indexes, so we use a workaround
-- For PostgreSQL, we can use a unique index that ignores NULLs:
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_client_unique
ON transactions(user_id, client_request_id) 
WHERE client_request_id IS NOT NULL;

-- 4. Add composite indexes for common queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
ON transactions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_category
ON transactions(user_id, category_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_account
ON transactions(user_id, account_id);

-- 5. Add indexes to category_hints for better performance
CREATE INDEX IF NOT EXISTS idx_category_hints_composite
ON category_hints(user_id, token, category_id);

-- Make sure the unique index exists for category_hints
-- This prevents duplicate entries from race conditions
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_hints_user_token_category
ON category_hints(user_id, token, category_id);

COMMENT ON COLUMN transactions.client_request_id IS 
'Client-generated UUID for idempotency. Same ID returns existing transaction instead of creating duplicate.';
