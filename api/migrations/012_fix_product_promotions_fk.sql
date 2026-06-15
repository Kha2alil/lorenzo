-- Fix incorrect FK type in product_promotions (was UUID, should be BIGINT)
-- Only needed if the table was created with the wrong FK type
ALTER TABLE product_promotions DROP CONSTRAINT IF EXISTS product_promotions_product_id_fkey;

ALTER TABLE product_promotions ALTER COLUMN product_id TYPE BIGINT USING product_id::BIGINT;

ALTER TABLE product_promotions ADD FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
