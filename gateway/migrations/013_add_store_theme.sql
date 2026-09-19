-- 013_add_store_theme.sql
-- Add store_theme field to shops table for E-Pic marketplace storefront themes

-- This migration is managed by AutoMigrate in development
-- In production, this should be applied manually only if the column doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'shops'
        AND column_name = 'store_theme'
    ) THEN
        ALTER TABLE shops ADD COLUMN store_theme VARCHAR(20) DEFAULT 'modern' NOT NULL;
        ALTER TABLE shops ADD CONSTRAINT chk_store_theme_valid CHECK (store_theme IN ('modern', 'luxury', 'colorful'));
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN shops.store_theme IS 'E-Pic storefront theme: modern, luxury, or colorful';
