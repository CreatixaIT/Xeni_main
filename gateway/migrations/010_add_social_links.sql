-- 010_add_social_links.sql
-- Add social media links table for shops

CREATE TABLE IF NOT EXISTS social_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    platform VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    handle VARCHAR(255),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_social_links_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_social_links_shop_id ON social_links(shop_id);
CREATE INDEX IF NOT EXISTS idx_social_links_platform ON social_links(platform);

-- Add comment
COMMENT ON TABLE social_links IS 'Social media links for shops to manage their online presence';
