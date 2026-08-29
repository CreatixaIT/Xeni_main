-- ============================================================
-- XENI AI — Upgrade user to super_admin
-- Run this SQL against the production database
-- ============================================================

-- Upgrade xeniassistant@gmail.com to super_admin
UPDATE users 
SET role = 'super_admin', status = 'active' 
WHERE email = 'xeniassistant@gmail.com';

-- Verify the update
SELECT id, email, full_name, role, status FROM users WHERE email = 'xeniassistant@gmail.com';
