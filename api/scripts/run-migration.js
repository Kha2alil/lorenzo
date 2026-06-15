const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const migrationFile = process.argv[2] || '011_product_is_active.sql';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const migrationSql = fs.readFileSync(path.join(__dirname, '..', 'migrations', migrationFile), 'utf8');

async function run() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase.rpc('exec_sql', { query: migrationSql });
    if (error) {
      console.log('RPC failed, trying direct REST...');
      const { data: d2, error: e2 } = await supabase.from('_exec_sql').select('*').single();
      if (e2) {
        console.error('Migration error:', e2);
        console.log('\nPlease run this SQL manually:\n');
        console.log(migrationSql);
      } else {
        console.log('Migration result:', d2);
      }
    } else {
      console.log('Migration result:', data);
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.log('\nPlease run this SQL manually:\n');
    console.log(migrationSql);
  }
}

run();
