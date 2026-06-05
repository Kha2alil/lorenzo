// Run this once to create the product_colors table.
// Usage: node setup-db.js
// Or just run the SQL from migrations/003_product_colors.sql in your Supabase SQL Editor.

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Supabase client can't run DDL directly, so we use the mgmt API.
  // Instead, open your Supabase dashboard → SQL Editor and paste:
  console.log('Open your Supabase dashboard SQL Editor and run:');
  console.log('');
  console.log('CREATE TABLE IF NOT EXISTS product_colors (');
  console.log('  id BIGSERIAL PRIMARY KEY,');
  console.log('  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,');
  console.log('  color_name TEXT NOT NULL,');
  console.log('  color_hex TEXT NOT NULL DEFAULT \'#1A1A18\',');
  console.log('  sort_order INT DEFAULT 0,');
  console.log('  created_at TIMESTAMPTZ DEFAULT NOW()');
  console.log(');');
  console.log('');
  console.log('CREATE INDEX IF NOT EXISTS idx_product_colors_product_id ON product_colors(product_id);');
  console.log('');
  console.log('ALTER TABLE product_images DROP COLUMN IF EXISTS color_name;');
  console.log('ALTER TABLE product_images DROP COLUMN IF EXISTS color_hex;');
}

run();
