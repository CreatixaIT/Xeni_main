-- Rollback migration for adding buyer_id to orders table

-- Drop indexes
DROP INDEX IF EXISTS idx_orders_buyer_created;
DROP INDEX IF EXISTS idx_orders_buyer_id;

-- Remove buyer_id column
ALTER TABLE orders DROP COLUMN IF EXISTS buyer_id;
