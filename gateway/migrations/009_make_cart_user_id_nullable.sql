-- Make carts.user_id nullable to support guest carts
DO $$
BEGIN
    -- Check if the column is currently NOT NULL
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'carts'
        AND column_name = 'user_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE carts ALTER COLUMN user_id DROP NOT NULL;
    END IF;
END $$;
