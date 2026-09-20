-- 018_add_checkout_id_index.sql
-- Add checkout_id column to orders table for checkout idempotency
-- This allows duplicate checkout requests to be detected and prevented

-- Add the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'orders'
        AND column_name = 'checkout_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN checkout_id VARCHAR(255);
    END IF;
END $$;

-- Create unique index on checkout_id (allows NULL for backward compatibility)
-- This ensures that two orders cannot have the same checkout_id globally
-- The client is responsible for generating unique checkout_ids (e.g., UUID)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_checkout_id ON orders(checkout_id) WHERE checkout_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN orders.checkout_id IS 'Idempotency key for checkout requests. Ensures duplicate checkout requests return the same order. Client must generate globally unique values (e.g., UUID).';
