-- Create separate product_colors table (colors are independent from images)
CREATE TABLE IF NOT EXISTS product_colors (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#1A1A18',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_colors_product_id ON product_colors(product_id);

-- Clean up old color columns from product_images if they exist (from earlier iteration)
ALTER TABLE product_images DROP COLUMN IF EXISTS color_name;
ALTER TABLE product_images DROP COLUMN IF EXISTS color_hex;
