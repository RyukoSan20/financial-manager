-- Migration Script for Financial Manager
-- Phase 1 & 2: Multi-Tenancy + Parser Features
-- Run this on Railway PostgreSQL

-- ============================================
-- PHASE 1: Multi-Tenancy
-- ============================================

-- Add user_id to all tables that need it
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE recurring_rules ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id); -- nullable for shared categories
ALTER TABLE net_worth_snapshots ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1;

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_user_id ON recurring_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_id ON net_worth_snapshots(user_id);

-- ============================================
-- PHASE 2: Parser / OCR Metadata
-- ============================================

-- Add parser metadata columns to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(100);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS raw_source_text TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5, 4);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_address VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS detection_type VARCHAR(20) DEFAULT 'MANUAL';

-- Add index for merchant queries
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_name);

-- ============================================
-- CLEANUP: Set default user_id for existing data
-- ============================================

-- Set user_id = 1 for all existing records that have NULL user_id
UPDATE accounts SET user_id = 1 WHERE user_id IS NULL;
UPDATE transactions SET user_id = 1 WHERE user_id IS NULL;
UPDATE budgets SET user_id = 1 WHERE user_id IS NULL;
UPDATE goals SET user_id = 1 WHERE user_id IS NULL;
UPDATE debts SET user_id = 1 WHERE user_id IS NULL;
UPDATE recurring_rules SET user_id = 1 WHERE user_id IS NULL;
UPDATE transfers SET user_id = 1 WHERE user_id IS NULL;
UPDATE categories SET user_id = NULL WHERE user_id IS NULL; -- Keep shared categories as NULL

-- Make user_id NOT NULL after setting defaults
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE budgets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE goals ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE debts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE recurring_rules ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transfers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE net_worth_snapshots ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check that migrations applied correctly
SELECT 'accounts' as table_name, COUNT(*) as row_count, 
       SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) as with_user_id
FROM accounts
UNION ALL
SELECT 'transactions', COUNT(*),
       SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
FROM transactions
UNION ALL
SELECT 'budgets', COUNT(*),
       SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
FROM budgets
UNION ALL
SELECT 'goals', COUNT(*),
       SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
FROM goals
UNION ALL
SELECT 'debts', COUNT(*),
       SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
FROM debts;

-- Check parser columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name IN ('merchant_name', 'raw_source_text', 'confidence_score', 
                    'latitude', 'longitude', 'merchant_address', 'detection_type');
