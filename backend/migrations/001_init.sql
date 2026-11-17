-- 001_init.sql: Core schema for Eneba Marketplace clone

-- Enable necessary PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    cover_image_url TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL, -- e.g., 'Steam', 'PSN', 'Xbox', 'Nintendo Switch'
    region VARCHAR(50) NOT NULL,   -- e.g., 'GLOBAL', 'EUROPE', 'US'
    genre VARCHAR(100) NOT NULL,   -- e.g., 'Action RPG', 'Open World', 'Shooter'
    release_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigram GIN index for fast typo-tolerant fuzzy title search
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON products USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_platform ON products (platform);
CREATE INDEX IF NOT EXISTS idx_products_region ON products (region);
CREATE INDEX IF NOT EXISTS idx_products_genre ON products (genre);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);

-- 3. SELLER OFFERS TABLE
CREATE TABLE IF NOT EXISTS seller_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    seller_name VARCHAR(100) NOT NULL,
    seller_rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00 CHECK (seller_rating >= 0.00 AND seller_rating <= 5.00),
    review_count INT NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    price_cents INT NOT NULL CHECK (price_cents > 0),
    original_price_cents INT NOT NULL CHECK (original_price_cents >= price_cents),
    is_featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_offers_product_id ON seller_offers (product_id);
CREATE INDEX IF NOT EXISTS idx_seller_offers_price_cents ON seller_offers (price_cents);
CREATE INDEX IF NOT EXISTS idx_seller_offers_featured ON seller_offers (is_featured);

-- 4. ORDERS & ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_cents INT NOT NULL CHECK (total_cents >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED')),
    stripe_session_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    seller_offer_id UUID NOT NULL REFERENCES seller_offers(id) ON DELETE RESTRICT,
    unit_price_cents INT NOT NULL CHECK (unit_price_cents > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_offer_id ON order_items (seller_offer_id);

-- 5. DIGITAL KEYS TABLE (Atomic fulfillment pool)
CREATE TABLE IF NOT EXISTS digital_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_offer_id UUID NOT NULL REFERENCES seller_offers(id) ON DELETE CASCADE,
    license_key VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'SOLD')),
    order_item_id UUID NULL REFERENCES order_items(id) ON DELETE SET NULL,
    sold_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digital_keys_lookup ON digital_keys (seller_offer_id, status);
CREATE INDEX IF NOT EXISTS idx_digital_keys_order_item ON digital_keys (order_item_id);

-- 6. DYNAMIC BLOCK-DRIVEN HOMEPAGE TABLE
CREATE TABLE IF NOT EXISTS homepage_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_type VARCHAR(50) NOT NULL CHECK (block_type IN ('hero_banner', 'best_sellers', 'flash_deals', 'recommended')),
    title VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homepage_blocks_active_sort ON homepage_blocks (is_active, sort_order);
