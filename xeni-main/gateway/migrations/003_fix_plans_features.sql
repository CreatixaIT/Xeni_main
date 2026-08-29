-- 003_fix_plans_features.sql
-- Ensure plans table has the correct feature format (Array instead of Object)

-- 1. Update existing plans to ensure features is an array if it's currently an object
-- We check if the 'features' jsonb starts with '{' (object) and convert to '[]' (array) if so.
UPDATE plans 
SET features = '[]'::jsonb 
WHERE jsonb_typeof(features) = 'object';

-- 2. Seed default plans if they don't exist
INSERT INTO plans (id, name, tier, price_monthly_bdt, features, is_active, tagline, tagline_bn, cta_text, cta_text_bn, is_most_popular, display_order)
VALUES 
(gen_random_uuid(), 'Starter', 'starter', 1000, '["💬 Conversation Agent", "200 orders/month", "1 Facebook Page", "2 GB storage", "Email support"]'::jsonb, true, 'Perfect for new sellers', 'নতুন বিক্রেতাদের জন্য উপযুক্ত', 'Start Free', 'বিনামূল্যে শুরু করুন', false, 1),
(gen_random_uuid(), 'Professional', 'professional', 2500, '["💬 Conversation Agent", "📦 Order Processing Agent", "📊 Inventory Agent", "1,000 orders/month", "3 Facebook Pages", "10 GB storage", "Priority support"]'::jsonb, true, 'Most popular for growing brands', 'ক্রমবর্ধমান ব্যবসার জন্য সেরা', 'Get Professional', 'প্রফেশনাল শুরু করুন', true, 2),
(gen_random_uuid(), 'Premium', 'premium', 5000, '["All 5 AI Agents", "Unlimited orders", "10 Facebook Pages", "50 GB storage", "🎨 AI Image Generation", "🧠 Sales Intelligence", "Dedicated support"]'::jsonb, true, 'Full AI power for large shops', 'বড় শপের জন্য সেরা AI পাওয়ার', 'Get Premium', 'প্রিমিয়াম শুরু করুন', false, 3),
(gen_random_uuid(), 'Enterprise', 'enterprise', 0, '["All 5 AI Agents", "Unlimited everything", "White-label branding", "Custom API access", "ERP Integration", "Dedicated account manager", "SLA guarantee"]'::jsonb, true, 'Custom solutions for high scale', 'বড় স্কেল ব্যবসার কাস্টম সলিউশন', 'Contact Sales', 'সেলসে যোগাযোগ করুন', false, 4)
ON CONFLICT (tier) DO UPDATE SET 
    features = EXCLUDED.features,
    price_monthly_bdt = EXCLUDED.price_monthly_bdt,
    is_active = true;

-- 3. Ensure content_sections are correctly seeded if missing
INSERT INTO content_sections (section_key, content_en, content_bn) VALUES
('hero', '{"headline":"Your Online Shop AI Employee","subheadline":"Automate conversations, orders, and content 24/7","cta_text":"Start Free","badge_text":"Now with AI Image Generation"}', '{"headline":"আপনার অনলাইন শপের AI কর্মী","subheadline":"কথোপকথন, অর্ডার এবং কন্টেন্ট ২৪/৭ স্বয়ংক্রিয় করুন","cta_text":"বিনামূল্যে শুরু করুন","badge_text":"এখন AI ইমেজ জেনারেশনসহ"}')
ON CONFLICT (section_key) DO NOTHING;

INSERT INTO content_sections (section_key, content_en, content_bn) VALUES
('faq', '{"items":[{"q":"What is XENI?","a":"XENI is an AI e-commerce OS."},{"q":"Support?","a":"24/7."}]}', '{"items":[{"q":"XENI কি?","a":"XENI একটি AI ই-কমার্স অপারেটিং সিস্টেম।"},{"q":"সাপোর্ট?","a":"২৪/৭।"}]}')
ON CONFLICT (section_key) DO NOTHING;
