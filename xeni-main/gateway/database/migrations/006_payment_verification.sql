-- 006_payment_verification.sql
-- Adds manual_required to payment status enum and verification tracking columns

-- Step 1: Add 'manual_required' to the order_payment_status enum
ALTER TYPE order_payment_status ADD VALUE IF NOT EXISTS 'manual_required';

-- Step 2: Add verification tracking columns to orders table
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS verified_by VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT NULL;

-- COMMENT: verified_by values: 'ocr', 'manual_trxid', 'api', 'seller'
