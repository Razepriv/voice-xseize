// Script to verify and configure Supabase Auth setup
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

console.log('🔐 Configuring Supabase Authentication...\n');

// Check environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const basicAuthEnabled = process.env.BASIC_AUTH_ENABLED;
const mockStorage = process.env.MOCK_STORAGE;

console.log('1. Checking configuration...\n');

// Check Supabase credentials
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('   Please set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in your .env file\n');
  process.exit(1);
}

console.log('✅ Supabase credentials found');

// Check auth mode
if (basicAuthEnabled === 'true') {
  console.log('⚠️  BASIC_AUTH_ENABLED is set to "true"');
  console.log('   This means you are using basic testing auth, not Supabase Auth\n');
} else {
  console.log('✅ BASIC_AUTH_ENABLED is disabled (using Supabase Auth)\n');
}

// Check storage mode
if (mockStorage === 'true') {
  console.log('⚠️  MOCK_STORAGE is set to "true"');
  console.log('   This means you are using in-memory storage, not the real database\n');
} else {
  console.log('✅ MOCK_STORAGE is disabled (using real database)\n');
}

// Test Supabase connection
console.log('2. Testing Supabase connection...');
try {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase client created successfully\n');
} catch (error) {
  console.error('❌ Failed to create Supabase client:', error.message);
  process.exit(1);
}

// Check if we need to update .env
const needsUpdate = basicAuthEnabled === 'true' || mockStorage === 'true';

if (needsUpdate) {
  console.log('3. Updating .env file...\n');
  
  try {
    const envPath = join(__dirname, '..', '.env');
    let envContent = readFileSync(envPath, 'utf-8');
    
    // Update BASIC_AUTH_ENABLED
    if (basicAuthEnabled === 'true') {
      envContent = envContent.replace(
        /BASIC_AUTH_ENABLED=.*/,
        'BASIC_AUTH_ENABLED=false'
      );
      console.log('✅ Set BASIC_AUTH_ENABLED=false');
    } else if (!envContent.includes('BASIC_AUTH_ENABLED')) {
      envContent += '\nBASIC_AUTH_ENABLED=false\n';
      console.log('✅ Added BASIC_AUTH_ENABLED=false');
    }
    
    // Update MOCK_STORAGE
    if (mockStorage === 'true') {
      envContent = envContent.replace(
        /MOCK_STORAGE=.*/,
        'MOCK_STORAGE=false'
      );
      console.log('✅ Set MOCK_STORAGE=false');
    } else if (!envContent.includes('MOCK_STORAGE')) {
      envContent += '\nMOCK_STORAGE=false\n';
      console.log('✅ Added MOCK_STORAGE=false');
    }
    
    writeFileSync(envPath, envContent);
    console.log('\n✅ .env file updated successfully!\n');
  } catch (error) {
    console.error('⚠️  Could not automatically update .env file:', error.message);
    console.log('\nPlease manually update your .env file:');
    console.log('BASIC_AUTH_ENABLED=false');
    console.log('MOCK_STORAGE=false\n');
  }
} else {
  console.log('3. Configuration is already correct!\n');
}

console.log('4. Supabase Auth Configuration Checklist:\n');
console.log('   [ ] Email provider is enabled in Supabase Dashboard');
console.log('   [ ] Site URL is set to: http://localhost:5000');
console.log('   [ ] Redirect URLs include: http://localhost:5000/**');
console.log('   [ ] (Optional) Email confirmation is disabled for local dev\n');

console.log('📝 Next steps:');
console.log('   1. Go to Supabase Dashboard → Authentication → Providers');
console.log('   2. Enable Email provider');
console.log('   3. Go to Authentication → URL Configuration');
console.log('   4. Set Site URL: http://localhost:5000');
console.log('   5. Add Redirect URL: http://localhost:5000/**');
console.log('   6. Restart your server: npm run dev');
console.log('   7. Visit: http://localhost:5000/api/signup\n');

console.log('✅ Supabase Auth configuration complete!\n');


