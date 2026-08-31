-- 008_add_category_system.sql
-- Adds category system for marketplace organization

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_bn VARCHAR(100),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);

-- Create product_categories junction table
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    category_id UUID NOT NULL,
    is_primary BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_product_categories_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_product_categories_category 
        FOREIGN KEY (category_id) 
        REFERENCES categories(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT unique_product_category UNIQUE (product_id, category_id)
);

-- Create indexes for product_categories
CREATE INDEX IF NOT EXISTS idx_product_categories_product_id ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category_id ON product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_is_primary ON product_categories(is_primary);

-- Add category_id to products table for backward compatibility (optional primary category)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Seed initial categories based on E-Pic marketplace taxonomy
INSERT INTO categories (slug, name, name_bn, is_active, display_order) VALUES
('fashion', 'Fashion', 'ফ্যাশন', true, 1),
('technology', 'Technology', 'প্রযুক্তি', true, 2),
('home', 'Home', 'ঘর', true, 3),
('beauty', 'Beauty', 'সৌন্দর্য', true, 4),
('lifestyle', 'Lifestyle', 'জীবনধারা', true, 5)
ON CONFLICT (slug) DO NOTHING;