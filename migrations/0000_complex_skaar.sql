CREATE TABLE "ai_agents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"voice_id" varchar,
	"voice_name" text,
	"language" varchar(10) DEFAULT 'en-US' NOT NULL,
	"model" varchar(100) DEFAULT 'gpt-4' NOT NULL,
	"provider" varchar(50) DEFAULT 'openai',
	"system_prompt" text,
	"user_prompt" text,
	"first_message" text,
	"temperature" real DEFAULT 0.7,
	"max_duration" integer DEFAULT 600,
	"max_tokens" integer DEFAULT 150,
	"voice_provider" varchar(50) DEFAULT 'elevenlabs',
	"knowledge_base_ids" text[],
	"assigned_phone_number_id" varchar,
	"call_forwarding_enabled" boolean DEFAULT false,
	"call_forwarding_number" varchar(20),
	"bolna_agent_id" varchar,
	"bolna_config" jsonb,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"avg_rating" real,
	"last_used_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"lead_id" varchar,
	"agent_id" varchar,
	"phone_number_id" varchar,
	"contact_name" text,
	"contact_phone" varchar(20),
	"call_type" varchar(50) DEFAULT 'outbound' NOT NULL,
	"direction" varchar(20) DEFAULT 'outbound' NOT NULL,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"outcome" varchar(50),
	"duration" integer,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"recording_url" text,
	"transcription" text,
	"ai_summary" text,
	"sentiment" varchar(20),
	"bolna_call_id" varchar,
	"exotel_call_sid" varchar,
	"exotel_cost_per_minute" real DEFAULT 0,
	"bolna_cost_per_minute" real DEFAULT 0,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"total_leads" integer DEFAULT 0 NOT NULL,
	"completed_leads" integer DEFAULT 0 NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "channel_partners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"email" varchar,
	"phone" varchar,
	"company" text,
	"category" text,
	"status" varchar(50) DEFAULT 'inactive' NOT NULL,
	"last_interaction_at" timestamp,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"agent_id" varchar,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_type" varchar(50) DEFAULT 'text' NOT NULL,
	"category" varchar(100),
	"description" text,
	"tags" text[],
	"file_url" text,
	"source_url" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"campaign_id" varchar,
	"assigned_agent_id" varchar,
	"name" text NOT NULL,
	"email" varchar,
	"phone" varchar,
	"company" text,
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"source" varchar(100),
	"tags" text[],
	"last_contacted_at" timestamp,
	"next_follow_up_at" timestamp,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"ai_summary" text,
	"custom_fields" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" varchar,
	"company_name" text,
	"logo_url" text,
	"primary_color" varchar(7),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "phone_numbers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"country_code" varchar(5) DEFAULT '+1' NOT NULL,
	"provider" varchar(50) DEFAULT 'exotel',
	"friendly_name" text,
	"capabilities" jsonb,
	"exotel_sid" varchar,
	"exotel_status" varchar(50),
	"exotel_config" jsonb,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"assigned_agent_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_minutes" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"bolna_cost" real DEFAULT 0,
	"exotel_cost" real DEFAULT 0,
	"openai_cost" real DEFAULT 0,
	"total_cost" real DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organization_id" varchar NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar(50) DEFAULT 'agent_manager' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"manager_id" varchar,
	"notes" text,
	"summary" text,
	"transcription" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_ai_agents_org" ON "ai_agents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ai_agents_status" ON "ai_agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_agents_created_by" ON "ai_agents" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_calls_org" ON "calls" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_calls_lead" ON "calls" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_calls_agent" ON "calls" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_calls_status" ON "calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_calls_created_at" ON "calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_calls_started_at" ON "calls" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_campaigns_org" ON "campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_channel_partners_org" ON "channel_partners" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_channel_partners_status" ON "channel_partners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_channel_partners_category" ON "channel_partners" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_org" ON "knowledge_base" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_agent" ON "knowledge_base" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_category" ON "knowledge_base" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_leads_org" ON "leads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_phone" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_leads_email" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_leads_campaign" ON "leads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_leads_assigned_agent" ON "leads" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "idx_phone_numbers_org" ON "phone_numbers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_phone_numbers_number" ON "phone_numbers" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "idx_phone_numbers_agent" ON "phone_numbers" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_usage_tracking_org" ON "usage_tracking" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_usage_tracking_date" ON "usage_tracking" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_users_org" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_visits_org" ON "visits" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_visits_manager" ON "visits" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "idx_visits_status" ON "visits" USING btree ("status");