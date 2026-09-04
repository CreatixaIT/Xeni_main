-- Add buyer_id to orders table for buyer commerce support
-- This allows orders to be associated with both buyers and shops

-- Add buyer_id column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for buyer_id to support buyer order listing
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);

-- Add index for combined buyer_id and created_at for efficient buyer order queries
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created ON orders(buyer_id, created_at DESC);
