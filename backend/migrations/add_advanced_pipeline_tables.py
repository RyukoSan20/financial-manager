"""
Migration: Add Advanced Pipeline Tables
Creates tables for:
- merchant_locations: Merchant location + geofencing
- transaction_locations: Transaction to location linking
- spending_by_location: Aggregated spending by location
- shopping_items: Item-level shopping tracking
- wishlists: User wishlist items
- price_history: Historical prices for items
"""
from sqlalchemy import text
from app.core.database import engine


def run_migration():
    """Create all advanced pipeline tables."""
    
    migrations = [
        # Merchant Locations
        """
        CREATE TABLE IF NOT EXISTS merchant_locations (
            id SERIAL PRIMARY KEY,
            merchant_name_raw VARCHAR(255) NOT NULL,
            merchant_name_normalized VARCHAR(255),
            latitude FLOAT,
            longitude FLOAT,
            address TEXT,
            city VARCHAR(100),
            region VARCHAR(100),
            country VARCHAR(50) DEFAULT 'Indonesia',
            postal_code VARCHAR(10),
            category VARCHAR(50),
            sub_category VARCHAR(100),
            brand_id VARCHAR(50),
            is_verified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_merchant_normalized ON merchant_locations(merchant_name_normalized);
        CREATE INDEX IF NOT EXISTS ix_merchant_city ON merchant_locations(city);
        CREATE INDEX IF NOT EXISTS ix_merchant_category ON merchant_locations(category);
        """,
        
        # Transaction Locations
        """
        CREATE TABLE IF NOT EXISTS transaction_locations (
            id SERIAL PRIMARY KEY,
            transaction_id INTEGER REFERENCES transactions(id),
            merchant_location_id INTEGER REFERENCES merchant_locations(id),
            captured_latitude FLOAT,
            captured_longitude FLOAT,
            captured_address TEXT,
            inside_geofence BOOLEAN DEFAULT FALSE,
            nearest_store_name VARCHAR(255),
            nearest_store_distance_meters FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        
        # Spending by Location
        """
        CREATE TABLE IF NOT EXISTS spending_by_location (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            merchant_location_id INTEGER REFERENCES merchant_locations(id),
            period_month VARCHAR(7),
            total_transactions INTEGER DEFAULT 0,
            total_amount VARCHAR(20),
            average_transaction VARCHAR(20),
            last_visited TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        
        # Shopping Items
        """
        CREATE TABLE IF NOT EXISTS shopping_items (
            id SERIAL PRIMARY KEY,
            transaction_id INTEGER REFERENCES transactions(id),
            user_id INTEGER REFERENCES users(id),
            item_name VARCHAR(255) NOT NULL,
            item_name_normalized VARCHAR(255),
            quantity FLOAT DEFAULT 1,
            unit VARCHAR(50),
            unit_price VARCHAR(20),
            total_price VARCHAR(20),
            discount VARCHAR(20) DEFAULT 0,
            category VARCHAR(100),
            sub_category VARCHAR(100),
            product_type VARCHAR(100),
            brand VARCHAR(100),
            sku VARCHAR(100),
            is_price_tracked INTEGER DEFAULT 0,
            last_seen_price VARCHAR(20),
            price_history TEXT,
            receipt_source VARCHAR(50),
            raw_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_shopping_user ON shopping_items(user_id);
        CREATE INDEX IF NOT EXISTS ix_shopping_transaction ON shopping_items(transaction_id);
        CREATE INDEX IF NOT EXISTS ix_shopping_item_name ON shopping_items(item_name);
        """,
        
        # Wishlists
        """
        CREATE TABLE IF NOT EXISTS wishlists (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            item_name VARCHAR(255) NOT NULL,
            category VARCHAR(100),
            target_price VARCHAR(20),
            current_price VARCHAR(20),
            store_name VARCHAR(255),
            store_url VARCHAR(500),
            priority INTEGER DEFAULT 1,
            is_purchased INTEGER DEFAULT 0,
            purchased_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        
        # Price History
        """
        CREATE TABLE IF NOT EXISTS price_history (
            id SERIAL PRIMARY KEY,
            shopping_item_id INTEGER REFERENCES shopping_items(id),
            price VARCHAR(20) NOT NULL,
            store_name VARCHAR(255),
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        
        # Email Parsing Log (for idempotency)
        """
        CREATE TABLE IF NOT EXISTS email_parse_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            email_id VARCHAR(255) UNIQUE,
            email_subject VARCHAR(500),
            parser_used VARCHAR(100),
            transaction_created BOOLEAN DEFAULT FALSE,
            transaction_id INTEGER,
            parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_email_parse_log_user ON email_parse_log(user_id);
        CREATE INDEX IF NOT EXISTS ix_email_parse_log_email_id ON email_parse_log(email_id);
        """,
    ]
    
    with engine.connect() as conn:
        for i, sql in enumerate(migrations):
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"[{i+1}/{len(migrations)}] OK")
            except Exception as e:
                print(f"[{i+1}/{len(migrations)}] ERROR: {e}")
    
    print("\nMigration complete!")


if __name__ == "__main__":
    run_migration()
