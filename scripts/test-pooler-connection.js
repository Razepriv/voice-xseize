// Test both direct and pooler connections to find which works
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const password = 'Magna@voice123';
const encodedPassword = 'Magna%40voice123';
const projectRef = 'sdtycpnutctbgbvpbeor';

// Test direct connection
const directUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;

// Test pooler connection (common regions - user needs to check their actual region)
const regions = ['us-east-1', 'us-west-1', 'eu-west-1', 'ap-southeast-1'];
const poolerUrls = regions.map(region => 
  `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-${region}.pooler.supabase.com:6543/postgres`
);

console.log('🔍 Testing Supabase Database Connections...\n');
console.log('Password: Magna@voice123 (encoded as Magna%40voice123)\n');

// Test direct connection
console.log('1. Testing Direct Connection (IPv6 required)...');
console.log(`   URL: postgresql://postgres:****@db.${projectRef}.supabase.co:5432/postgres`);
try {
  const directPool = new Pool({ 
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  
  const result = await directPool.query('SELECT NOW() as time');
  console.log('   ✅ Direct connection WORKS!');
  console.log(`   Database time: ${result.rows[0].time}\n`);
  console.log('   Use this in your .env:');
  console.log(`   DATABASE_URL=${directUrl}\n`);
  await directPool.end();
  process.exit(0);
} catch (error) {
  console.log(`   ❌ Direct connection failed: ${error.message}\n`);
  console.log('   This is likely because your network is IPv4-only.\n');
  console.log('   Trying Session Pooler connections...\n');
}

// Test pooler connections
console.log('2. Testing Session Pooler Connections (IPv4 compatible)...');
let workingUrl = null;

for (const url of poolerUrls) {
  const region = url.match(/aws-0-([^.]+)/)?.[1] || 'unknown';
  console.log(`   Testing region: ${region}...`);
  
  try {
    const poolerPool = new Pool({ 
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    
    const result = await poolerPool.query('SELECT NOW() as time');
    console.log(`   ✅ Pooler connection WORKS for region: ${region}!`);
    console.log(`   Database time: ${result.rows[0].time}\n`);
    workingUrl = url;
    await poolerPool.end();
    break;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
}

if (workingUrl) {
  console.log('✅ Found working connection!\n');
  console.log('Use this in your .env file:');
  console.log(`DATABASE_URL=${workingUrl}\n`);
  process.exit(0);
} else {
  console.log('\n❌ None of the tested pooler regions worked.\n');
  console.log('📝 Next steps:');
  console.log('1. Go to Supabase Dashboard → Settings → Database');
  console.log('2. Click "Pooler settings" button');
  console.log('3. Copy the Session Pooler connection string');
  console.log('4. Make sure to URL-encode the password (@ → %40)');
  console.log('5. Update your .env file with the correct pooler URL\n');
  process.exit(1);
}


