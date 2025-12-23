import 'dotenv/config';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('Running batches table migration...');
  
  try {
    // Create batches table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS batches (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id VARCHAR NOT NULL,
        batch_id VARCHAR NOT NULL UNIQUE,
        agent_id VARCHAR NOT NULL,
        file_name TEXT NOT NULL,
        valid_contacts INTEGER NOT NULL DEFAULT 0,
        total_contacts INTEGER NOT NULL DEFAULT 0,
        from_phone_number VARCHAR(20),
        status VARCHAR(50) NOT NULL DEFAULT 'created',
        execution_status JSONB,
        scheduled_at TIMESTAMP,
        webhook_url TEXT,
        metadata JSONB,
        created_by VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Batches table created');

    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_batches_org ON batches(organization_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_batches_agent ON batches(agent_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_batches_bolna_id ON batches(batch_id)`);
    console.log('✓ Indexes created');

    // Create agent_templates table if needed
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_templates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id VARCHAR NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        config JSONB,
        created_by VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_templates_org ON agent_templates(organization_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_templates_created_by ON agent_templates(created_by)`);
    console.log('✓ Agent templates table created');

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
