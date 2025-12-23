-- Add batch calling fields to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_id VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS agent_id VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS from_phone_number VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_status VARCHAR(50);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS valid_contacts INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS execution_status JSONB;

-- Create index for batch lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_batch ON campaigns(batch_id);
