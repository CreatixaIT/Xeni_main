-- 007_merchant_integrations.sql

ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS bkash_username VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bkash_password VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pathao_client_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pathao_client_secret VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pathao_username VARCHAR(100),
    ADD COLUMN IF NOT EXISTS pathao_password VARCHAR(255),
    ADD COLUMN IF NOT EXISTS steadfast_api_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS steadfast_secret_key VARCHAR(255);
