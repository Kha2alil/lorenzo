ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE product_images ADD COLUMN IF NOT EXISTS color_id BIGINT REFERENCES product_colors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_product_images_color_id ON product_images(color_id);
