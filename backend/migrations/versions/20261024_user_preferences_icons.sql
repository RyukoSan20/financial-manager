-- The structured appearance settings, and the preferences blob.
--
-- `create_all` makes a missing table but never adds a column to a table
-- that already exists, so the new columns are added here.
--
-- The revision is what keeps two devices from overwriting each other.
-- Each device remembers the revision it last saw and sends it with a
-- change. A change based on an older revision is stale and the server
-- keeps what it has.

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS color_scheme VARCHAR(20) DEFAULT 'emerald';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS font_family VARCHAR(20) DEFAULT 'sans';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS font_scale VARCHAR(10) DEFAULT 'md';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS background_style VARCHAR(20) DEFAULT 'plain';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS preferences TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS revision INTEGER DEFAULT 1;

-- The icon the user picked for a shop or a product.
CREATE TABLE IF NOT EXISTS catalog_icons (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id INTEGER NOT NULL,
    icon VARCHAR(20),
    color VARCHAR(20),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_catalog_icon UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS ix_catalog_icons_user_target
    ON catalog_icons (user_id, target_type);

-- The icon a shop or a product wears, and the link from a product to
-- the shop it was bought at. The catalogue needs the link to say
-- "these three things came from Indomaret".
ALTER TABLE merchant_catalog ADD COLUMN IF NOT EXISTS icon VARCHAR(16);
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS icon VARCHAR(16);
ALTER TABLE user_products ADD COLUMN IF NOT EXISTS merchant_catalog_id INTEGER;
CREATE INDEX IF NOT EXISTS ix_user_products_merchant_catalog_id
    ON user_products (merchant_catalog_id);
