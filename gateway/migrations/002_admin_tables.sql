-- 002_admin_tables.sql

CREATE TABLE IF NOT EXISTS content_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_key VARCHAR(50) UNIQUE NOT NULL,
    content_en JSONB NOT NULL DEFAULT '{}',
    content_bn JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default sections
INSERT INTO content_sections (section_key, content_en, content_bn) VALUES
('hero', '{"headline":"Your Online Shop AI Employee","subheadline":"Automate conversations, orders, and content 24/7","cta_text":"Start Free","badge_text":"Now with AI Image Generation"}', '{"headline":"আপনার অনলাইন শপের AI কর্মী","subheadline":"কথোপকথন, অর্ডার এবং কন্টেন্ট ২৪/৭ স্বয়ংক্রিয় করুন","cta_text":"বিনামূল্যে শুরু করুন","badge_text":"এখন AI ইমেজ জেনারেশনসহ"}')
ON CONFLICT (section_key) DO NOTHING;

INSERT INTO content_sections (section_key, content_en, content_bn) VALUES
('banner', '{"text":"","color":"violet","link":"","is_active":false}', '{"text":"","color":"violet","link":"","is_active":false}')
ON CONFLICT (section_key) DO NOTHING;

INSERT INTO content_sections (section_key, content_en, content_bn) VALUES
('faq', '{"items":[]}', '{"items":[]}')
ON CONFLICT (section_key) DO NOTHING;

INSERT INTO content_sections (section_key, content_en, content_bn) VALUES
('pricing_settings', '{"show_most_popular":true,"most_popular_plan_id":""}', '{}')
ON CONFLICT (section_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_name VARCHAR(100) NOT NULL,
    reviewer_avatar_url VARCHAR(500),
    plan_at_review VARCHAR(50),
    star_rating SMALLINT NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
    review_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    display_order INT DEFAULT 0,
    moderated_by UUID REFERENCES users(id),
    moderated_at TIMESTAMPTZ,
    admin_note TEXT,
    show_on_landing BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_display_order ON reviews(display_order) WHERE show_on_landing = true;

CREATE TABLE IF NOT EXISTS review_settings (
    id INT PRIMARY KEY DEFAULT 1,
    auto_approve_premium BOOLEAN DEFAULT false,
    show_star_rating BOOLEAN DEFAULT true,
    min_star_to_show SMALLINT DEFAULT 4,
    max_reviews_on_landing INT DEFAULT 6,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO review_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_metrics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL UNIQUE,
    total_users INT DEFAULT 0,
    new_users_today INT DEFAULT 0,
    active_subscriptions INT DEFAULT 0,
    revenue_today DECIMAL(12,2) DEFAULT 0,
    revenue_month DECIMAL(12,2) DEFAULT 0,
    ai_tasks_today INT DEFAULT 0,
    messages_replied_today INT DEFAULT 0,
    orders_processed_today INT DEFAULT 0,
    task_success_rate DECIMAL(5,2) DEFAULT 0,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plans ADD COLUMN IF NOT EXISTS tagline VARCHAR(100);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tagline_bn VARCHAR(200);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS cta_text VARCHAR(50) DEFAULT 'Get Started';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS cta_text_bn VARCHAR(100) DEFAULT 'শুরু করুন';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_most_popular BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_note TEXT;
