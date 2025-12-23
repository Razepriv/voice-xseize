-- Supabase Database Migration
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- This creates all tables, indexes, and constraints for the Megna Voice application

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table (for express-session with connect-pg-simple)
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" VARCHAR NOT NULL PRIMARY KEY,
  "sess" JSONB NOT NULL,
  "expire" TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");

-- Organizations table (multi-tenant isolation)
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "domain" VARCHAR UNIQUE,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" VARCHAR PRIMARY KEY,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "email" VARCHAR UNIQUE,
  "first_name" VARCHAR,
  "last_name" VARCHAR,
  "profile_image_url" VARCHAR,
  "role" VARCHAR(50) NOT NULL DEFAULT 'agent_manager',
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_users_org" ON "users" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" ("role");

-- AI Agents table
CREATE TABLE IF NOT EXISTS "ai_agents" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "voice_id" VARCHAR,
  "voice_name" TEXT,
  "language" VARCHAR(10) NOT NULL DEFAULT 'en-US',
  "model" VARCHAR(100) NOT NULL DEFAULT 'gpt-4',
  "provider" VARCHAR(50) DEFAULT 'openai',
  "system_prompt" TEXT,
  "user_prompt" TEXT,
  "first_message" TEXT,
  "temperature" REAL DEFAULT 0.7,
  "max_duration" INTEGER DEFAULT 600,
  "max_tokens" INTEGER DEFAULT 150,
  "agent_type" VARCHAR(50) DEFAULT 'conversational',
  "voice_provider" VARCHAR(50) DEFAULT 'elevenlabs',
  "voice_type" VARCHAR(50),
  "knowledge_base_ids" TEXT[],
  "assigned_phone_number_id" VARCHAR,
  "call_forwarding_enabled" BOOLEAN DEFAULT false,
  "call_forwarding_number" VARCHAR(20),
  "bolna_agent_id" VARCHAR,
  "bolna_config" JSONB,
  "status" VARCHAR(50) NOT NULL DEFAULT 'active',
  "total_calls" INTEGER NOT NULL DEFAULT 0,
  "total_messages" INTEGER NOT NULL DEFAULT 0,
  "avg_rating" REAL,
  "last_used_at" TIMESTAMP,
  "created_by" VARCHAR REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ai_agents_org" ON "ai_agents" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_ai_agents_status" ON "ai_agents" ("status");
CREATE INDEX IF NOT EXISTS "idx_ai_agents_created_by" ON "ai_agents" ("created_by");

-- Phone Numbers table
CREATE TABLE IF NOT EXISTS "phone_numbers" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "phone_number" VARCHAR(20) NOT NULL,
  "country_code" VARCHAR(5) NOT NULL DEFAULT '+1',
  "provider" VARCHAR(50) DEFAULT 'exotel',
  "friendly_name" TEXT,
  "capabilities" JSONB,
  "exotel_sid" VARCHAR,
  "exotel_status" VARCHAR(50),
  "exotel_config" JSONB,
  "status" VARCHAR(50) NOT NULL DEFAULT 'active',
  "assigned_agent_id" VARCHAR REFERENCES "ai_agents"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_phone_numbers_org" ON "phone_numbers" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_phone_numbers_number" ON "phone_numbers" ("phone_number");
CREATE INDEX IF NOT EXISTS "idx_phone_numbers_agent" ON "phone_numbers" ("assigned_agent_id");

-- Campaigns table
CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
  "start_date" TIMESTAMP,
  "end_date" TIMESTAMP,
  "total_leads" INTEGER NOT NULL DEFAULT 0,
  "completed_leads" INTEGER NOT NULL DEFAULT 0,
  "created_by" VARCHAR REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_campaigns_org" ON "campaigns" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_campaigns_status" ON "campaigns" ("status");

-- Channel Partners table
CREATE TABLE IF NOT EXISTS "channel_partners" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "email" VARCHAR,
  "phone" VARCHAR,
  "company" TEXT,
  "category" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'inactive',
  "last_interaction_at" TIMESTAMP,
  "interaction_count" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_channel_partners_org" ON "channel_partners" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_channel_partners_status" ON "channel_partners" ("status");
CREATE INDEX IF NOT EXISTS "idx_channel_partners_category" ON "channel_partners" ("category");

-- Visits table
CREATE TABLE IF NOT EXISTS "visits" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "location" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  "scheduled_at" TIMESTAMP,
  "started_at" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "manager_id" VARCHAR REFERENCES "users"("id") ON DELETE SET NULL,
  "notes" TEXT,
  "summary" TEXT,
  "transcription" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_visits_org" ON "visits" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_visits_manager" ON "visits" ("manager_id");
CREATE INDEX IF NOT EXISTS "idx_visits_status" ON "visits" ("status");

-- Leads table
CREATE TABLE IF NOT EXISTS "leads" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "campaign_id" VARCHAR REFERENCES "campaigns"("id") ON DELETE SET NULL,
  "assigned_agent_id" VARCHAR REFERENCES "ai_agents"("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "email" VARCHAR,
  "phone" VARCHAR,
  "company" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'new',
  "source" VARCHAR(100),
  "tags" TEXT[],
  "last_contacted_at" TIMESTAMP,
  "next_follow_up_at" TIMESTAMP,
  "total_calls" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "ai_summary" TEXT,
  "custom_fields" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_leads_org" ON "leads" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_leads_status" ON "leads" ("status");
CREATE INDEX IF NOT EXISTS "idx_leads_phone" ON "leads" ("phone");
CREATE INDEX IF NOT EXISTS "idx_leads_email" ON "leads" ("email");
CREATE INDEX IF NOT EXISTS "idx_leads_campaign" ON "leads" ("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_leads_assigned_agent" ON "leads" ("assigned_agent_id");

-- Calls table
CREATE TABLE IF NOT EXISTS "calls" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "lead_id" VARCHAR REFERENCES "leads"("id") ON DELETE SET NULL,
  "agent_id" VARCHAR REFERENCES "ai_agents"("id") ON DELETE SET NULL,
  "phone_number_id" VARCHAR REFERENCES "phone_numbers"("id") ON DELETE SET NULL,
  "contact_name" TEXT,
  "contact_phone" VARCHAR(20),
  "call_type" VARCHAR(50) NOT NULL DEFAULT 'outbound',
  "direction" VARCHAR(20) NOT NULL DEFAULT 'outbound',
  "status" VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  "outcome" VARCHAR(50),
  "duration" INTEGER,
  "scheduled_at" TIMESTAMP,
  "started_at" TIMESTAMP,
  "ended_at" TIMESTAMP,
  "recording_url" TEXT,
  "transcription" TEXT,
  "ai_summary" TEXT,
  "sentiment" VARCHAR(20),
  "bolna_call_id" VARCHAR,
  "exotel_call_sid" VARCHAR,
  "exotel_cost_per_minute" REAL DEFAULT 0,
  "bolna_cost_per_minute" REAL DEFAULT 0,
  "metadata" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_calls_org" ON "calls" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_calls_lead" ON "calls" ("lead_id");
CREATE INDEX IF NOT EXISTS "idx_calls_agent" ON "calls" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_calls_status" ON "calls" ("status");
CREATE INDEX IF NOT EXISTS "idx_calls_created_at" ON "calls" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_calls_started_at" ON "calls" ("started_at");

-- Knowledge Base table
CREATE TABLE IF NOT EXISTS "knowledge_base" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "agent_id" VARCHAR REFERENCES "ai_agents"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "content_type" VARCHAR(50) NOT NULL DEFAULT 'text',
  "category" VARCHAR(100),
  "description" TEXT,
  "tags" TEXT[],
  "file_url" TEXT,
  "source_url" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_knowledge_base_org" ON "knowledge_base" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_agent" ON "knowledge_base" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_category" ON "knowledge_base" ("category");

-- Usage Tracking table
CREATE TABLE IF NOT EXISTS "usage_tracking" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organization_id" VARCHAR NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "date" TIMESTAMP NOT NULL,
  "total_calls" INTEGER NOT NULL DEFAULT 0,
  "total_minutes" INTEGER NOT NULL DEFAULT 0,
  "total_messages" INTEGER NOT NULL DEFAULT 0,
  "bolna_cost" REAL DEFAULT 0,
  "exotel_cost" REAL DEFAULT 0,
  "openai_cost" REAL DEFAULT 0,
  "total_cost" REAL DEFAULT 0,
  "metadata" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_usage_tracking_org" ON "usage_tracking" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_usage_tracking_date" ON "usage_tracking" ("date");

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channel_partners_updated_at BEFORE UPDATE ON channel_partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database migration completed successfully! All tables, indexes, and triggers have been created.';
END $$;


