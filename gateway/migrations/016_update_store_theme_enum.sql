-- 016_update_store_theme_enum.sql
-- Update store_theme check constraint to include new theme options

-- Drop existing constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'shops_store_theme_check'
    ) THEN
        ALTER TABLE shops DROP CONSTRAINT shops_store_theme_check;
    END IF;
END $$;

-- Add new constraint with all theme options
ALTER TABLE shops 
ADD CONSTRAINT shops_store_theme_check 
CHECK (store_theme IN ('modern', 'fashion', 'luxury', 'futuristic', 'minimal', 'colorful'));

-- Add comment
COMMENT ON COLUMN shops.store_theme IS 'E-Pic storefront theme: modern, fashion, luxury, futuristic, minimal, or colorful';
