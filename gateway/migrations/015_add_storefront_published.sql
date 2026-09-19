-- 015_add_storefront_published.sql
-- Add storefront_published field to shops table for E-Pic marketplace storefront publication control

-- This migration is idempotent - checks if column exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'shops'
        AND column_name = 'storefront_published'
    ) THEN
        ALTER TABLE shops ADD COLUMN storefront_published BOOLEAN DEFAULT false NOT NULL;
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN shops.storefront_published IS 'Whether the shop is published on E-Pic marketplace (default false for safety)';
