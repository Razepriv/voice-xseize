// Test the exact connection string provided by user
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const password = 'Megna@voice123';
const encodedPassword = 'Megna%40voice123';
const projectRef = 'sdtycpnutctbgbvpbeor';

// Direct connection with URL-encoded password
const directUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;

console.log('🔍 Testing Your Exact Connection String...\n');
console.log('Password provided: Megna@voice123');
console.log('URL-encoded password: Megna%40voice123\n');
console.log('Testing connection...\n');

const pool = new Pool({ 
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  console.log('Attempting to connect...');
  const result = await pool.query('SELECT NOW() as current_time, version() as version');
  console.log('✅ SUCCESS! Connection established!\n');
  console.log('Database time:', result.rows[0].current_time);
  console.log('PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
  console.log('\n✅ Your .env file should contain:');
  console.log(`DATABASE_URL=${directUrl}\n`);
  console.log('Now you can run: npm run db:push\n');
  await pool.end();
  process.exit(0);
} catch (error) {
  console.log('❌ Connection failed:', error.message);
  console.log('\nThis could be due to:');
  console.log('1. IPv4/IPv6 network issue (most common)');
  console.log('2. Project might be paused');
  console.log('3. Network/firewall blocking the connection\n');
  
  if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
    console.log('💡 SOLUTION: Use Session Pooler (IPv4 compatible)\n');
    console.log('1. Go to Supabase Dashboard → Settings → Database');
    console.log('2. Click "Pooler settings" button');
    console.log('3. Copy the Session Pooler connection string');
    console.log('4. Replace [YOUR-PASSWORD] with: Megna%40voice123');
    console.log('5. Update your .env file\n');
    console.log('The pooler URL will look like:');
    console.log(`postgresql://postgres.${projectRef}:Megna%40voice123@aws-0-[REGION].pooler.supabase.com:6543/postgres\n`);
  }
  
  await pool.end();
  process.exit(1);
}


