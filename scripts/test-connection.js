// Quick script to test database connection with URL encoding
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Test with the connection string you provided
const testUrl = 'postgresql://postgres:Megna%40voice123@db.sdtycpnutctbgbvpbeor.supabase.co:5432/postgres';

console.log('Testing database connection...\n');
console.log('Connection URL (password hidden):', testUrl.replace(/:[^:@]+@/, ':****@'));
console.log('');

const pool = new Pool({ 
  connectionString: testUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  const result = await pool.query('SELECT NOW() as current_time, version() as version');
  console.log('✅ Connection successful!');
  console.log('   Database time:', result.rows[0].current_time);
  console.log('   PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
  console.log('\n✅ Your DATABASE_URL should be:');
  console.log('   postgresql://postgres:Megna%40voice123@db.sdtycpnutctbgbvpbeor.supabase.co:5432/postgres');
  console.log('\n   (Note: @ in password is encoded as %40)');
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error('❌ Connection failed:', error.message);
  console.error('\nPossible issues:');
  console.error('1. The Supabase project might not exist or be paused');
  console.error('2. The hostname might be incorrect');
  console.error('3. Network/DNS issue');
  console.error('4. The database password might be incorrect');
  console.error('\nPlease verify:');
  console.error('- Go to Supabase Dashboard → Settings → Database');
  console.error('- Check the connection string format');
  console.error('- Ensure your project is active (not paused)');
  await pool.end();
  process.exit(1);
}


