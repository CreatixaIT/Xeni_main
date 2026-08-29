-- ============================================================
-- XENI AI — Database Migration V2
-- Adds missing columns and tables to synchronize with models
-- ============================================================

-- 1. Create missing ENUM types
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movement_type') THEN
        CREATE TYPE stock_movement_type AS ENUM ('sale', 'restock', 'adjustment', 'return');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
        CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- 2. Update PRODUCTS table
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_sold INTEGER NOT NULL DEFAULT 0;

-- 3. Create PRODUCT_VARIANTS table
CREATE TABLE IF NOT EXISTS product_variants (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku           VARCHAR(100) NOT NULL,
    color         VARCHAR(50),
    size          VARCHAR(50),
    price_modifier DECIMAL(12, 2) DEFAULT 0,
    stock         INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- 4. Create INVENTORY_LOGS table
CREATE TABLE IF NOT EXISTS inventory_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id   UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    type         stock_movement_type NOT NULL,
    quantity     INTEGER NOT NULL,
    old_stock    INTEGER NOT NULL,
    new_stock    INTEGER NOT NULL,
    reference_id VARCHAR(255),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_variant_id ON inventory_logs(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at DESC);

-- 5. Update USERS table
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- 6. Update PLANS table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tagline VARCHAR(100);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tagline_bn VARCHAR(200);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS cta_text VARCHAR(50) DEFAULT 'Get Started';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS cta_text_bn VARCHAR(100) DEFAULT 'শুরু করুন';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_most_popular BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- 7. Create CONTENT_SECTIONS table
CREATE TABLE IF NOT EXISTS content_sections (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_key VARCHAR(50) NOT NULL UNIQUE,
    content_en JSONB NOT NULL DEFAULT '{}',
    content_bn JSONB NOT NULL DEFAULT '{}',
    is_active  BOOLEAN DEFAULT TRUE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_sections_key ON content_sections(section_key);

-- 8. Create REVIEWS table
CREATE TABLE IF NOT EXISTS reviews (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_name     VARCHAR(100) NOT NULL,
    reviewer_avatar_url TEXT,
    plan_at_review     VARCHAR(50),
    star_rating       SMALLINT NOT NULL,
    review_text       TEXT NOT NULL,
    status           review_status NOT NULL DEFAULT 'pending',
    display_order     INTEGER DEFAULT 0,
    moderated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    moderated_at      TIMESTAMPTZ,
    admin_note        TEXT,
    show_on_landing    BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Create REVIEW_SETTINGS table
CREATE TABLE IF NOT EXISTS review_settings (
    id                  INTEGER PRIMARY KEY DEFAULT 1,
    auto_approve_premium  BOOLEAN DEFAULT FALSE,
    show_star_rating      BOOLEAN DEFAULT TRUE,
    min_star_to_show       SMALLINT DEFAULT 4,
    max_reviews_on_landing INTEGER DEFAULT 6,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Create PLATFORM_METRICS_CACHE table
CREATE TABLE IF NOT EXISTS platform_metrics_cache (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date           DATE NOT NULL UNIQUE,
    total_users           INTEGER DEFAULT 0,
    new_users_today        INTEGER DEFAULT 0,
    active_subscriptions  INTEGER DEFAULT 0,
    revenue_today         DECIMAL(12, 2) DEFAULT 0,
    revenue_month         DECIMAL(12, 2) DEFAULT 0,
    ai_tasks_today         INTEGER DEFAULT 0,
    messages_replied_today INTEGER DEFAULT 0,
    orders_processed_today INTEGER DEFAULT 0,
    task_success_rate      DECIMAL(5, 2) DEFAULT 0,
    computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Create SYSTEM_SETTINGS table
CREATE TABLE IF NOT EXISTS system_settings (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key   VARCHAR(255) NOT NULL UNIQUE,
    setting_value TEXT,
    description   TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 12. Create AGENT_RULES table
CREATE TABLE IF NOT EXISTS agent_rules (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope     VARCHAR(20) NOT NULL,
    shop_id   UUID REFERENCES shops(id) ON DELETE CASCADE,
    category  VARCHAR(50) NOT NULL,
    title     VARCHAR(255) NOT NULL,
    rule      TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    priority  INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_rules_scope ON agent_rules(scope);
CREATE INDEX IF NOT EXISTS idx_agent_rules_shop_id ON agent_rules(shop_id);

-- 13. Add triggers for updated_at
CREATE TRIGGER set_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_content_sections_updated_at BEFORE UPDATE ON content_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_agent_rules_updated_at BEFORE UPDATE ON agent_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
