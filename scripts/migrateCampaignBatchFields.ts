import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ymmxrmeoeigjsyxyudax:Automitra@2026@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function migrate() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  console.log('🚀 Running migration: Add batch calling fields to campaigns...\n');
  
  const queries = [
    { sql: 'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_id VARCHAR', desc: 'Add batch_id column' },
    { sql: 'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS agent_id VARCHAR', desc: 'Add agent_id column' },
    { sql: 'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS from_phone_number VARCHAR', desc: 'Add from_phone_number column' },
    { sql: 'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP', desc: 'Add scheduled_at column' },
    { sql: 'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_status VARCHAR(50)', desc: 'Add batch_status column' },
    { sql: 'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS valid_contacts INTEGER DEFAULT 0', desc: 'Add valid_contacts column' },
    { sql: 'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS execution_status JSONB', desc: 'Add execution_status column' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_campaigns_batch ON campaigns(batch_id)', desc: 'Create batch_id index' },
  ];
  
  let success = 0;
  let errors = 0;
  
  for (const { sql, desc } of queries) {
    try {
      await pool.query(sql);
      console.log(`✅ ${desc}`);
      success++;
    } catch (e: any) {
      console.log(`⚠️  ${desc}: ${e.message}`);
      errors++;
    }
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`   Successful: ${success}`);
  console.log(`   Errors: ${errors}`);
  console.log('\n✨ Migration complete!\n');
  
  await pool.end();
}

migrate().catch(console.error);
