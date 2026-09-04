-- 006_add_seller_role.sql
-- Add SELLER role to user_role enum to support marketplace sellers

-- First, add the new value to the enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'seller' AFTER 'user';

-- The enum is now: 'user', 'seller', 'admin', 'super_admin'
