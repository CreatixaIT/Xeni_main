-- 011_add_personal_xeni_config.sql
-- Add personal AI configuration table for shops

CREATE TABLE IF NOT EXISTS personal_xeni_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL UNIQUE,
    business_description TEXT,
    brand_identity TEXT,
    target_customers TEXT,
    preferred_tone VARCHAR(50) DEFAULT 'friendly' NOT NULL,
    writing_style TEXT,
    words_to_use TEXT,
    words_to_avoid TEXT,
    sales_preferences TEXT,
    customer_service_preferences TEXT,
    social_media_style TEXT,
    product_content_style TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_personal_xeni_configs_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_personal_xeni_configs_shop_id ON personal_xeni_configs(shop_id);

-- Add comment
COMMENT ON TABLE personal_xeni_configs IS 'Personal AI configuration for shops to customize their Xeni assistant';
