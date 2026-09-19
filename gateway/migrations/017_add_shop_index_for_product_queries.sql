-- 017_add_shop_index_for_product_queries.sql
-- Add index to shops.storefront_published to optimize public product queries
-- This improves performance when filtering products by storefront_published

CREATE INDEX IF NOT EXISTS idx_shops_storefront_published ON shops(storefront_published);

-- Comment
COMMENT ON INDEX idx_shops_storefront_published IS 'Index for filtering published stores in public product queries';
