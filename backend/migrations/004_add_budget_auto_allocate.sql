-- Migration: Add auto_allocate columns to budgets table
-- Run this to add auto-allocation feature for monthly budget deductions

ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS auto_allocate BOOLEAN DEFAULT FALSE;

ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS allocation_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
