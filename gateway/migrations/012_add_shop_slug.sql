-- 012_add_shop_slug.sql
-- Add shop_slug field to shops table for E-Pic marketplace integration

-- This migration is managed by AutoMigrate in development
-- In production, this should be applied manually only if the column doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'shops'
        AND column_name = 'shop_slug'
    ) THEN
        ALTER TABLE shops ADD COLUMN shop_slug VARCHAR(100);
        CREATE UNIQUE INDEX idx_shops_shop_slug ON shops(shop_slug) WHERE shop_slug IS NOT NULL;
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN shops.shop_slug IS 'URL-friendly shop identifier for E-Pic marketplace integration';
