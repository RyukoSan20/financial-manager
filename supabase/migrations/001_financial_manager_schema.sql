-- Financial Manager Schema for Supabase PostgreSQL
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    default_currency TEXT DEFAULT 'IDR',
    timezone TEXT DEFAULT 'Asia/Jakarta',
    language TEXT DEFAULT 'id',
    theme TEXT DEFAULT 'light',
    is_guest BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'e-wallet', 'credit_card', 'investment', 'other')),
    balance DECIMAL(15, 2) DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    icon TEXT DEFAULT '💰',
    color TEXT DEFAULT '#4CAF50',
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    credit_limit DECIMAL(15, 2),
    bank_name TEXT,
    account_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own accounts" ON public.accounts
    FOR ALL USING (auth.uid() = user_id);

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT DEFAULT '📦',
    color TEXT DEFAULT '#607D8B',
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own categories" ON public.categories
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view system categories" ON public.categories
    FOR SELECT USING (is_system = TRUE OR auth.uid() = user_id);

-- Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    notes TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_rule_id INTEGER,
    receipt_scan_id INTEGER,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own transactions" ON public.transactions
    FOR ALL USING (auth.uid() = user_id);

-- Transfers table
CREATE TABLE IF NOT EXISTS public.transfers (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    to_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    amount DECIMAL(15, 2) NOT NULL,
    fee DECIMAL(15, 2) DEFAULT 0,
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own transfers" ON public.transfers
    FOR ALL USING (auth.uid() = user_id);

-- Budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own budgets" ON public.budgets
    FOR ALL USING (auth.uid() = user_id);

-- Recurring rules table
CREATE TABLE IF NOT EXISTS public.recurring_rules (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval_value INTEGER DEFAULT 1,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    next_due_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own recurring rules" ON public.recurring_rules
    FOR ALL USING (auth.uid() = user_id);

-- Goals table
CREATE TABLE IF NOT EXISTS public.goals (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount DECIMAL(15, 2) NOT NULL,
    current_amount DECIMAL(15, 2) DEFAULT 0,
    deadline DATE,
    icon TEXT DEFAULT '🎯',
    color TEXT DEFAULT '#4CAF50',
    notes TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own goals" ON public.goals
    FOR ALL USING (auth.uid() = user_id);

-- Goal contributions table
CREATE TABLE IF NOT EXISTS public.goal_contributions (
    id SERIAL PRIMARY KEY,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own goal contributions" ON public.goal_contributions
    FOR ALL USING (auth.uid() = user_id);

-- Debts table
CREATE TABLE IF NOT EXISTS public.debts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('loan', 'debt', 'credit')),
    creditor TEXT,
    original_amount DECIMAL(15, 2) NOT NULL,
    remaining_amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) DEFAULT 0,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    installment_amount DECIMAL(15, 2),
    installments_count INTEGER,
    installments_paid INTEGER DEFAULT 0,
    is_paid_off BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own debts" ON public.debts
    FOR ALL USING (auth.uid() = user_id);

-- Debt payments table
CREATE TABLE IF NOT EXISTS public.debt_payments (
    id SERIAL PRIMARY KEY,
    debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own debt payments" ON public.debt_payments
    FOR ALL USING (auth.uid() = user_id);

-- Seed default categories
INSERT INTO public.categories (user_id, name, type, icon, color, is_system)
SELECT NULL, name, type, icon, color, TRUE
FROM (VALUES
    ('Gaji', 'income', '💰', '#4CAF50'),
    ('Freelance', 'income', '💻', '#2196F3'),
    ('Investasi', 'income', '📈', '#9C27B0'),
    ('Bonus', 'income', '🎁', '#FF9800'),
    ('Lainnya (Income)', 'income', '📦', '#607D8B'),
    ('Makanan & Minuman', 'expense', '🍔', '#F44336'),
    ('Transportasi', 'expense', '🚗', '#3F51B5'),
    ('Belanja', 'expense', '🛒', '#E91E63'),
    ('Kesehatan', 'expense', '🏥', '#00BCD4'),
    ('Pendidikan', 'expense', '📚', '#795548'),
    ('Hiburan', 'expense', '🎬', '#FF5722'),
    ('Tagihan & Utilitas', 'expense', '📄', '#9E9E9E'),
    ('Investasi & Tabungan', 'expense', '🏦', '#4CAF50'),
    ('Lainnya (Expense)', 'expense', '📦', '#607D8B')
) AS defaults(name, type, icon, color)
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE is_system = TRUE AND name = defaults.name);
