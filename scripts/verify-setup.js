// Script to verify Supabase connection and setup
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

console.log('🔍 Verifying Supabase Setup...\n');

// Check environment variables
console.log('1. Checking environment variables...');
const missing = [];
if (!supabaseUrl) missing.push('SUPABASE_URL');
if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!databaseUrl) missing.push('DATABASE_URL');

if (missing.length > 0) {
  console.error('❌ Missing environment variables:', missing.join(', '));
  console.error('   Please check your .env file and ensure all Supabase credentials are set.');
  process.exit(1);
}
console.log('✅ All environment variables are set\n');

// Test Supabase client connection
console.log('2. Testing Supabase client connection...');
try {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase client created successfully\n');
} catch (error) {
  console.error('❌ Failed to create Supabase client:', error.message);
  process.exit(1);
}

// Test database connection
console.log('3. Testing database connection...');
try {
  const dbPool = new Pool({ 
    connectionString: databaseUrl,
    ssl: databaseUrl?.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  });
  const result = await dbPool.query('SELECT NOW() as current_time');
  console.log('✅ Database connection successful');
  console.log(`   Current database time: ${result.rows[0].current_time}\n`);
  await dbPool.end();
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  console.error('   Please verify your DATABASE_URL is correct.');
  console.error('   Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres');
  process.exit(1);
}

// Check if tables exist
console.log('4. Checking if database tables exist...');
try {
  const dbPool = new Pool({ 
    connectionString: databaseUrl,
    ssl: databaseUrl?.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  });
  const tables = [
    'sessions',
    'organizations',
    'users',
    'ai_agents',
    'phone_numbers',
    'campaigns',
    'channel_partners',
    'visits',
    'leads',
    'calls',
    'knowledge_base',
    'usage_tracking'
  ];

  const results = await dbPool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  `);

  const existingTables = results.rows.map(row => row.table_name);
  const missingTables = tables.filter(table => !existingTables.includes(table));

  if (missingTables.length > 0) {
    console.log('⚠️  Some tables are missing:', missingTables.join(', '));
    console.log('   Please run the SQL migration file (supabase_migration.sql) in your Supabase SQL Editor.');
    console.log('   Or run: npm run db:push\n');
  } else {
    console.log('✅ All required tables exist\n');
  }

  await dbPool.end();
} catch (error) {
  console.error('❌ Failed to check tables:', error.message);
  process.exit(1);
}

console.log('✅ Setup verification complete!');
console.log('\n📝 Next steps:');
console.log('   1. If tables are missing, run supabase_migration.sql in Supabase SQL Editor');
console.log('   2. Or run: npm run db:push');
console.log('   3. Start the dev server: npm run dev');
console.log('   4. Visit http://localhost:5000/api/signup to create an account\n');

