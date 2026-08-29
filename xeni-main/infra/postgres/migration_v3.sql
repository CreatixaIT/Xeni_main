-- ============================================================
-- XENI AI — Database Migration V3
-- Payment Verification & Shop District/Delivery Config
-- ============================================================

-- 1. Shop owner mobile number (for WhatsApp notifications)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS owner_mobile VARCHAR(20);

-- 2. Shop district (for delivery charge calculation)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- 3. Delivery charges (inside district vs outside)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_charge_inside DECIMAL(8, 2) NOT NULL DEFAULT 60;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_charge_outside DECIMAL(8, 2) NOT NULL DEFAULT 120;

-- 4. Payment verification mode: 'auto' (API) or 'manual' (owner reviews)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS payment_verification_mode VARCHAR(10) NOT NULL DEFAULT 'manual';

-- 5. bKash Tokenized Payment API credentials (per-shop)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS bkash_app_key VARCHAR(255);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS bkash_app_secret VARCHAR(255);

-- 6. Nagad Payment API credentials (per-shop)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS nagad_merchant_id VARCHAR(255);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS nagad_merchant_key VARCHAR(255);
