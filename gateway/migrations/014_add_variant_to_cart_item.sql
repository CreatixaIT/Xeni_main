-- 014_add_variant_to_cart_item.sql
-- Add variant_id column to cart_items table for E-Pic marketplace variant support

-- This migration is idempotent - checks if column exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'cart_items'
        AND column_name = 'variant_id'
    ) THEN
        ALTER TABLE cart_items ADD COLUMN variant_id UUID;
        CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id);
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN cart_items.variant_id IS 'Product variant ID for variant products, nullable for non-variant products';
