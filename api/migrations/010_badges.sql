CREATE TABLE IF NOT EXISTS badges (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO badges (name) VALUES ('Bestseller'), ('New'), ('FW25'), ('Suits')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_badge_check;
