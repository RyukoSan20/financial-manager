-- ============================================
-- Enterprise Database Migration
-- Financial Manager - Feed & Review System
-- ============================================

-- 1. Extended Users Table (Inbound Email Token)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS inbound_email_token VARCHAR(50) UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'IDR';

-- 2. Extended Transactions Table (Feed Workflow, Source Tracking, Raw Data)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'manual' CHECK (source IN ('camera_scan', 'email_forward', 'whatsapp', 'manual', 'ocr', 'api')),
ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- 3. New Table: Transaction Items (Itemized Receipt Details)
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1,
    unit_price NUMERIC(20, 2) NOT NULL,
    total_price NUMERIC(20, 2) NOT NULL,
    category_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. New Table: Ingestion Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS ingestion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL CHECK (channel IN ('postmark_inbound', 'gemini_vision', 'camera_scan', 'api', 'manual')),
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'processing')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Indexes for Enterprise Performance
-- ============================================

-- Transaction queries by user + status (Feed workflow)
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status);

-- Date range queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

-- User inbound token lookup (Auto-Forwarding)
CREATE INDEX IF NOT EXISTS idx_users_inbound_token ON users(inbound_email_token) WHERE inbound_email_token IS NOT NULL;

-- Transaction items lookup
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);

-- Ingestion logs by user
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_user ON ingestion_logs(user_id, created_at DESC);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_logs ENABLE ROW LEVEL SECURITY;

-- Transaction Items: Users can only see their own
CREATE POLICY "Users can view own transaction items" ON transaction_items
    FOR SELECT USING (
        transaction_id IN (SELECT id FROM transactions WHERE user_id = auth.uid())
    );

CREATE POLICY "System can insert transaction items" ON transaction_items
    FOR INSERT WITH CHECK (true);

-- Ingestion Logs: Users can only see their own logs
CREATE POLICY "Users can view own ingestion logs" ON ingestion_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert ingestion logs" ON ingestion_logs
    FOR INSERT WITH CHECK (true);

-- ============================================
-- Trigger: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE transactions IS 'Main transaction table with Feed/Review workflow support';
COMMENT ON COLUMN transactions.status IS 'Transaction status: pending (needs review), approved, rejected';
COMMENT ON COLUMN transactions.source IS 'Input source: camera_scan, email_forward, whatsapp, manual, ocr, api';
COMMENT ON COLUMN transactions.raw_data IS 'Raw JSON response from Gemini or other parsers';
