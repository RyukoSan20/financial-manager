-- Merchant catalogue and user products.
--
-- These two tables let the receipt scanner learn. A shop or a product the
-- user has never seen before is created here on first sight instead of
-- being discarded, which is what makes a brand new receipt readable.

CREATE TABLE IF NOT EXISTS merchant_catalog (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255),
    merchant_type VARCHAR(50),
    address TEXT,
    scan_count INTEGER DEFAULT 0,
    total_spent NUMERIC(20,2) DEFAULT 0,
    last_seen_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_merchant_catalog_user_id ON merchant_catalog(user_id);
CREATE INDEX IF NOT EXISTS ix_merchant_catalog_normalized_name ON merchant_catalog(normalized_name);
CREATE INDEX IF NOT EXISTS ix_merchant_catalog_user_name ON merchant_catalog(user_id, normalized_name);

CREATE TABLE IF NOT EXISTS user_products (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255),
    canonical_name VARCHAR(255),
    category VARCHAR(100),
    typical_price NUMERIC(20,2),
    min_price NUMERIC(20,2),
    max_price NUMERIC(20,2),
    purchase_count INTEGER DEFAULT 0,
    last_seen_at TIMESTAMP,
    catalog_id INTEGER REFERENCES product_catalog(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_user_products_user_id ON user_products(user_id);
CREATE INDEX IF NOT EXISTS ix_user_products_normalized_name ON user_products(normalized_name);
CREATE INDEX IF NOT EXISTS ix_user_products_user_name ON user_products(user_id, normalized_name);
