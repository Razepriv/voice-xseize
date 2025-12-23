-- Migration: Add batches table for Bolna batch campaign integration
-- This migration ONLY adds new tables, does NOT modify or delete existing columns

-- Agent Templates table (if not exists)
CREATE TABLE IF NOT EXISTS agent_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_templates_org ON agent_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_created_by ON agent_templates(created_by);

-- Batches table for Bolna batch campaigns
CREATE TABLE IF NOT EXISTS batches (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id VARCHAR NOT NULL,
  batch_id VARCHAR NOT NULL UNIQUE,
  agent_id VARCHAR NOT NULL,
  
  -- Batch details
  file_name TEXT NOT NULL,
  valid_contacts INTEGER NOT NULL DEFAULT 0,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  from_phone_number VARCHAR(20),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'created',
  execution_status JSONB,
  
  -- Scheduling
  scheduled_at TIMESTAMP,
  
  -- Metadata
  webhook_url TEXT,
  metadata JSONB,
  
  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_org ON batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_batches_agent ON batches(agent_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_bolna_id ON batches(batch_id);

-- Add comment for documentation
COMMENT ON TABLE batches IS 'Stores Bolna batch campaign records for bulk calling';
COMMENT ON COLUMN batches.batch_id IS 'Bolna API batch ID';
COMMENT ON COLUMN batches.execution_status IS 'JSON object with call status breakdown: {completed: N, ringing: N, in_progress: N}';
COMMENT ON COLUMN batches.status IS 'Batch status: created, scheduled, queued, executed, stopped';
