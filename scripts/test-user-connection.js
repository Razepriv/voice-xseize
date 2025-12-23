// Test the exact connection string provided by user
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// User's provided connection string
const connectionUrl = 'postgresql://postgres.sdtycpnutctbgbvpbeor:Megnavoice123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';

console.log('🔍 Testing Your Pooler Connection String...\n');
console.log('Connection URL (password hidden): postgresql://postgres.sdtycpnutctbgbvpbeor:****@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres\n');

const pool = new Pool({ 
  connectionString: connectionUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  console.log('Attempting to connect...');
  const result = await pool.query('SELECT NOW() as current_time, version() as version, current_database() as database');
  console.log('✅ SUCCESS! Connection established!\n');
  console.log('Database:', result.rows[0].database);
  console.log('Database time:', result.rows[0].current_time);
  console.log('PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
  console.log('\n✅ Your connection string is correct!');
  console.log('\n📝 Next steps:');
  console.log('1. Update your .env file with this connection string');
  console.log('2. Run: npm run db:verify');
  console.log('3. Run: npm run db:push (to create tables)');
  console.log('4. Run: npm run dev (to start the app)\n');
  await pool.end();
  process.exit(0);
} catch (error) {
  console.log('❌ Connection failed:', error.message);
  console.log('\nPossible issues:');
  
  if (error.message.includes('password authentication failed')) {
    console.log('⚠️  Password authentication failed!');
    console.log('   If your password contains special characters, they need to be URL-encoded:');
    console.log('   - @ → %40');
    console.log('   - : → %3A');
    console.log('   - / → %2F');
    console.log('   - # → %23');
    console.log('\n   If your actual password is "Megna@voice123", use:');
    console.log('   postgresql://postgres.sdtycpnutctbgbvpbeor:Megna%40voice123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres\n');
  } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
    console.log('⚠️  DNS resolution failed');
    console.log('   Check your internet connection');
    console.log('   Verify the hostname is correct\n');
  } else {
    console.log('   Check the connection string format');
    console.log('   Verify your Supabase project is active\n');
  }
  
  await pool.end();
  process.exit(1);
}


