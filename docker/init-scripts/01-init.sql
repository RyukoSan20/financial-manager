-- Financial Manager Database Initialization
-- This script runs when PostgreSQL container first starts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer_out', 'transfer_in');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_type AS ENUM ('bank', 'cash', 'ewallet', 'investment', 'credit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Insert default categories if not exists
INSERT INTO categories (name, type, icon, color, is_active)
SELECT 'Gaji', 'income', 'briefcase', '#10B981', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Gaji' AND type = 'income');

INSERT INTO categories (name, type, icon, color, is_active)
SELECT 'Freelance', 'income', 'laptop', '#6366F1', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Freelance' AND type = 'income');

INSERT INTO categories (name, type, icon, color, is_active)
SELECT 'Makanan & Minuman', 'expense', 'utensils', '#F59E0B', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Makanan & Minuman' AND type = 'expense');

INSERT INTO categories (name, type, icon, color, is_active)
SELECT 'Transportasi', 'expense', 'car', '#3B82F6', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Transportasi' AND type = 'expense');

INSERT INTO categories (name, type, icon, color, is_active)
SELECT 'Belanja', 'expense', 'shopping-cart', '#EC4899', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Belanja' AND type = 'expense');

INSERT INTO categories (name, type, icon, color, is_active)
SELECT 'Lainnya', 'income', 'circle', '#6B7280', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Lainnya' AND type = 'income');

INSERT INTO categories (name, type, icon, color, is_active)
SELECT 'Lainnya', 'expense', 'circle', '#6B7280', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Lainnya' AND type = 'expense');

\echo 'Database initialized successfully!'
