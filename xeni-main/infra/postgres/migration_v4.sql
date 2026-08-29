-- ============================================================
-- Migration V4: Facebook Post Comment Moderation
-- ============================================================

CREATE TYPE comment_action AS ENUM ('ignored', 'public_reply', 'private_reply', 'hidden');

ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'comment';

CREATE TABLE post_comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    page_id         VARCHAR(255) NOT NULL,
    post_id         VARCHAR(255) NOT NULL,
    comment_id      VARCHAR(255) NOT NULL UNIQUE,
    customer_psid   VARCHAR(255) NOT NULL,
    customer_name   VARCHAR(255),
    message         TEXT NOT NULL,
    action_taken    comment_action NOT NULL DEFAULT 'ignored',
    ai_response     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_comments_shop_id ON post_comments(shop_id);
CREATE INDEX idx_post_comments_page_id ON post_comments(page_id);
CREATE INDEX idx_post_comments_post_id ON post_comments(post_id);

CREATE TRIGGER set_post_comments_updated_at
    BEFORE UPDATE ON post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
