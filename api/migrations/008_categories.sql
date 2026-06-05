CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO categories (name, slug) VALUES
  ('Polo', 'polo'),
  ('Pants', 'pants'),
  ('Suits', 'suits'),
  ('Chemise', 'chemise'),
  ('Watches', 'watches'),
  ('Vests', 'vests'),
  ('Boots', 'boots')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products ADD CONSTRAINT fk_products_category
  FOREIGN KEY (category) REFERENCES categories(slug)
  ON DELETE RESTRICT;
