-- Add unavailable_sizes column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS unavailable_sizes TEXT[] DEFAULT '{}';

-- Create product_promotions table
CREATE TABLE IF NOT EXISTS product_promotions (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_percent INT NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_promotions_product_id ON product_promotions(product_id);
