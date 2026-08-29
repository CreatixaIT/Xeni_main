-- 002_admin_tables_down.sql

ALTER TABLE users DROP COLUMN IF EXISTS admin_note;
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE users DROP COLUMN IF EXISTS suspended_at;
ALTER TABLE users DROP COLUMN IF EXISTS suspended_reason;

ALTER TABLE plans DROP COLUMN IF EXISTS display_order;
ALTER TABLE plans DROP COLUMN IF EXISTS is_most_popular;
ALTER TABLE plans DROP COLUMN IF EXISTS cta_text_bn;
ALTER TABLE plans DROP COLUMN IF EXISTS cta_text;
ALTER TABLE plans DROP COLUMN IF EXISTS tagline_bn;
ALTER TABLE plans DROP COLUMN IF EXISTS tagline;

DROP TABLE IF EXISTS platform_metrics_cache;
DROP TABLE IF EXISTS review_settings;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS content_sections;
