-- Migration: Add Rules Engine Tables
-- 005_add_rules_engine.sql

-- 1. Create system_settings table
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "setting_key" varchar(255) NOT NULL UNIQUE,
    "setting_value" text,
    "description" text,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

-- 2. Insert the Default Global Prompt
INSERT INTO "system_settings" ("setting_key", "setting_value", "description") 
VALUES (
    'global_agent_rules', 
    '1. If the customer has already provided their Delivery Address and Phone Number, do NOT ask for it again. Instead, politely confirm the order and tell them it will be processed shortly. 
2. Be respectful and use proper greetings.', 
    'Global Master Prompt for all AI workers across the platform'
) ON CONFLICT ("setting_key") DO NOTHING;

-- 3. Add custom rules to shops table
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "custom_agent_rules" text;
