import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum
export type UserRole = 'admin' | 'agent_manager' | 'analyst' | 'developer';

// Organizations table (for multi-tenant isolation)
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  domain: varchar("domain").unique(),

  // Whitelabel configuration
  companyName: text("company_name"),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 7 }),

  // Wallet/Credits
  credits: real("credits").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  aiAgents: many(aiAgents),
  calls: many(calls),
  phoneNumbers: many(phoneNumbers),
}));

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// Users table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 50 }).notNull().default('agent_manager'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_org").on(table.organizationId),
  index("idx_users_role").on(table.role),
]);

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  aiAgents: many(aiAgents),
}));

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// AI Agents table - Core voice AI assistant configurations
export const aiAgents = pgTable("ai_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),

  // Voice configuration
  voiceId: varchar("voice_id"),
  voiceName: text("voice_name"),
  voiceType: varchar("voice_type", { length: 50 }), // Legacy field, kept for data compatibility
  language: varchar("language", { length: 10 }).notNull().default('en-US'),

  // AI model configuration
  model: varchar("model", { length: 100 }).notNull().default('gpt-4'),
  provider: varchar("provider", { length: 50 }).default('openai'),
  agentType: varchar("agent_type", { length: 50 }), // Legacy field, kept for data compatibility
  systemPrompt: text("system_prompt"),
  userPrompt: text("user_prompt"),
  firstMessage: text("first_message"),
  temperature: real("temperature").default(0.7),
  maxDuration: integer("max_duration").default(600), // seconds
  maxTokens: integer("max_tokens").default(150),
  voiceProvider: varchar("voice_provider", { length: 50 }).default('elevenlabs'),

  // Knowledge base integration
  knowledgeBaseIds: text("knowledge_base_ids").array(),

  // Exotel phone number assignment
  assignedPhoneNumberId: varchar("assigned_phone_number_id"),
  callForwardingEnabled: boolean("call_forwarding_enabled").default(false),
  callForwardingNumber: varchar("call_forwarding_number", { length: 20 }),

  // Bolna integration
  bolnaAgentId: varchar("bolna_agent_id"),
  bolnaConfig: jsonb("bolna_config"),

  // Status and metrics
  status: varchar("status", { length: 50 }).notNull().default('active'),
  totalCalls: integer("total_calls").notNull().default(0),
  totalMessages: integer("total_messages").notNull().default(0),
  avgRating: real("avg_rating"),
  lastUsedAt: timestamp("last_used_at"),

  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_agents_org").on(table.organizationId),
  index("idx_ai_agents_status").on(table.status),
  index("idx_ai_agents_created_by").on(table.createdBy),
]);

export const aiAgentsRelations = relations(aiAgents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [aiAgents.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [aiAgents.createdBy],
    references: [users.id],
  }),
  calls: many(calls),
  knowledgeBase: many(knowledgeBase),
}));

export const insertAiAgentSchema = createInsertSchema(aiAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalCalls: true,
  totalMessages: true,
  lastUsedAt: true,
});

export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type AiAgent = typeof aiAgents.$inferSelect;

// API-safe schemas for create/update operations (never accept organizationId from client)
// Note: removed .strict() to allow client-side form to include extra Bolna config fields
// The server will only use the fields it needs
export const createAiAgentSchema = insertAiAgentSchema.omit({ organizationId: true });
export const updateAiAgentSchema = createAiAgentSchema.partial();

// Dedicated types for tenant-safe API inputs (excludes organizationId)
export type CreateAiAgentInput = z.infer<typeof createAiAgentSchema>;
export type UpdateAiAgentInput = z.infer<typeof updateAiAgentSchema>;

// Phone Numbers table - Exotel phone number management
export const phoneNumbers = pgTable("phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  countryCode: varchar("country_code", { length: 5 }).notNull().default('+1'),
  provider: varchar("provider", { length: 50 }).default('exotel'),
  friendlyName: text("friendly_name"),
  capabilities: jsonb("capabilities"),

  // Exotel integration
  exotelSid: varchar("exotel_sid"),
  exotelStatus: varchar("exotel_status", { length: 50 }),
  exotelConfig: jsonb("exotel_config"),

  // Status
  status: varchar("status", { length: 50 }).notNull().default('active'),
  assignedAgentId: varchar("assigned_agent_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_phone_numbers_org").on(table.organizationId),
  index("idx_phone_numbers_number").on(table.phoneNumber),
  index("idx_phone_numbers_agent").on(table.assignedAgentId),
]);

export const phoneNumbersRelations = relations(phoneNumbers, ({ one }) => ({
  organization: one(organizations, {
    fields: [phoneNumbers.organizationId],
    references: [organizations.id],
  }),
  assignedAgent: one(aiAgents, {
    fields: [phoneNumbers.assignedAgentId],
    references: [aiAgents.id],
  }),
}));

export const insertPhoneNumberSchema = createInsertSchema(phoneNumbers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPhoneNumber = z.infer<typeof insertPhoneNumberSchema>;
export type PhoneNumber = typeof phoneNumbers.$inferSelect;

// Campaigns table - marketing/engagement automation
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default('draft'),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  totalLeads: integer("total_leads").notNull().default(0),
  completedLeads: integer("completed_leads").notNull().default(0),
  // Batch calling fields
  batchId: varchar("batch_id"),  // Bolna batch ID
  agentId: varchar("agent_id"),  // AI Agent to use for calls
  fromPhoneNumber: varchar("from_phone_number"),  // Phone number to call from
  scheduledAt: timestamp("scheduled_at"),  // Scheduled execution time
  batchStatus: varchar("batch_status", { length: 50 }),  // created, scheduled, queued, executed, stopped
  validContacts: integer("valid_contacts").default(0),
  executionStatus: jsonb("execution_status"),  // Call status breakdown
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_campaigns_org").on(table.organizationId),
  index("idx_campaigns_status").on(table.status),
  index("idx_campaigns_batch").on(table.batchId),
]);

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// Channel Partners table
export const channelPartners = pgTable("channel_partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  company: text("company"),
  category: text("category"),
  status: varchar("status", { length: 50 }).notNull().default('inactive'),
  lastInteractionAt: timestamp("last_interaction_at"),
  interactionCount: integer("interaction_count").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_channel_partners_org").on(table.organizationId),
  index("idx_channel_partners_status").on(table.status),
  index("idx_channel_partners_category").on(table.category),
]);

export const insertChannelPartnerSchema = createInsertSchema(channelPartners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChannelPartner = z.infer<typeof insertChannelPartnerSchema>;
export type ChannelPartner = typeof channelPartners.$inferSelect;

// Site visits table
export const visits = pgTable("visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  title: text("title").notNull(),
  location: text("location"),
  status: varchar("status", { length: 50 }).notNull().default('scheduled'),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  managerId: varchar("manager_id"),
  notes: text("notes"),
  summary: text("summary"),
  transcription: text("transcription"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_visits_org").on(table.organizationId),
  index("idx_visits_manager").on(table.managerId),
  index("idx_visits_status").on(table.status),
]);

export const insertVisitSchema = createInsertSchema(visits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visits.$inferSelect;

// Leads table - Contact/prospect management
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  campaignId: varchar("campaign_id"),
  assignedAgentId: varchar("assigned_agent_id"),

  // Contact information
  name: text("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  company: text("company"),

  // Lead status
  status: varchar("status", { length: 50 }).notNull().default('new'),
  source: varchar("source", { length: 100 }),
  tags: text("tags").array(),

  // Interaction tracking
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  totalCalls: integer("total_calls").notNull().default(0),

  // Notes and AI insights
  notes: text("notes"),
  aiSummary: text("ai_summary"),
  customFields: jsonb("custom_fields"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_leads_org").on(table.organizationId),
  index("idx_leads_status").on(table.status),
  index("idx_leads_phone").on(table.phone),
  index("idx_leads_email").on(table.email),
  index("idx_leads_campaign").on(table.campaignId),
  index("idx_leads_assigned_agent").on(table.assignedAgentId),
]);

export const leadsRelations = relations(leads, ({ many }) => ({
  calls: many(calls),
}));

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalCalls: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Calls table - Voice call records and transcripts
export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  leadId: varchar("lead_id"),
  agentId: varchar("agent_id"),
  phoneNumberId: varchar("phone_number_id"),

  // Call details
  contactName: text("contact_name"),
  contactPhone: varchar("contact_phone", { length: 20 }),
  callType: varchar("call_type", { length: 50 }).notNull().default('outbound'),
  direction: varchar("direction", { length: 20 }).notNull().default('outbound'),

  // Call status and timing
  status: varchar("status", { length: 50 }).notNull().default('scheduled'),
  outcome: varchar("outcome", { length: 50 }),
  duration: integer("duration"), // seconds
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),

  // Recordings and transcripts
  recordingUrl: text("recording_url"),
  transcription: text("transcription"),
  aiSummary: text("ai_summary"),
  sentiment: varchar("sentiment", { length: 20 }),

  // Integration IDs
  bolnaCallId: varchar("bolna_call_id"),
  exotelCallSid: varchar("exotel_call_sid"),

  // Cost tracking (per minute rates in USD)
  exotelCostPerMinute: real("exotel_cost_per_minute").default(0),
  bolnaCostPerMinute: real("bolna_cost_per_minute").default(0),

  // Metadata
  metadata: jsonb("metadata"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_calls_org").on(table.organizationId),
  index("idx_calls_lead").on(table.leadId),
  index("idx_calls_agent").on(table.agentId),
  index("idx_calls_status").on(table.status),
  index("idx_calls_created_at").on(table.createdAt),
  index("idx_calls_started_at").on(table.startedAt),
]);

export const callsRelations = relations(calls, ({ one }) => ({
  organization: one(organizations, {
    fields: [calls.organizationId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [calls.leadId],
    references: [leads.id],
  }),
  agent: one(aiAgents, {
    fields: [calls.agentId],
    references: [aiAgents.id],
  }),
  phoneNumber: one(phoneNumbers, {
    fields: [calls.phoneNumberId],
    references: [phoneNumbers.id],
  }),
}));

export const insertCallSchema = createInsertSchema(calls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof calls.$inferSelect;

// Knowledge Base table - AI training documents and data
export const knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  agentId: varchar("agent_id"),

  // Document details
  title: text("title").notNull(),
  content: text("content").notNull(),
  contentType: varchar("content_type", { length: 50 }).notNull().default('text'),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  tags: text("tags").array(),

  // File/URL references
  fileUrl: text("file_url"),
  sourceUrl: text("source_url"),

  // Bolna RAG ID
  bolnaKbId: varchar("bolna_kb_id"),

  // Metadata for Bolna integration
  metadata: jsonb("metadata"),

  // Status
  status: varchar("status", { length: 50 }).notNull().default('active'),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_knowledge_base_org").on(table.organizationId),
  index("idx_knowledge_base_agent").on(table.agentId),
  index("idx_knowledge_base_category").on(table.category),
]);

export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
  organization: one(organizations, {
    fields: [knowledgeBase.organizationId],
    references: [organizations.id],
  }),
  agent: one(aiAgents, {
    fields: [knowledgeBase.agentId],
    references: [aiAgents.id],
  }),
}));

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;

// API-safe schemas for knowledge base create/update (never accept organizationId from client)
// Note: We extend with nullable() for optional fields since clients may send null instead of undefined
export const createKnowledgeBaseSchema = insertKnowledgeBaseSchema.omit({ organizationId: true }).extend({
  agentId: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  bolnaKbId: z.string().nullable().optional(),
  metadata: z.any().nullable().optional(),
});
export const updateKnowledgeBaseSchema = createKnowledgeBaseSchema.partial();

export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseSchema>;
export type UpdateKnowledgeBaseInput = z.infer<typeof updateKnowledgeBaseSchema>;

// Analytics and Usage Tracking
export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),

  // Usage metrics
  date: timestamp("date").notNull(),
  totalCalls: integer("total_calls").notNull().default(0),
  totalMinutes: integer("total_minutes").notNull().default(0),
  totalMessages: integer("total_messages").notNull().default(0),

  // Cost tracking
  bolnaCost: real("bolna_cost").default(0),
  exotelCost: real("exotel_cost").default(0),
  openaiCost: real("openai_cost").default(0),
  totalCost: real("total_cost").default(0),

  // Metadata
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_usage_tracking_org").on(table.organizationId),
  index("idx_usage_tracking_date").on(table.date),
]);

export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({
  id: true,
  createdAt: true,
});

export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type UsageTracking = typeof usageTracking.$inferSelect;

// Agent Templates table - stores reusable agent configurations
export const agentTemplates = pgTable("agent_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  config: jsonb("config"), // Store template config as JSON
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_agent_templates_org").on(table.organizationId),
  index("idx_agent_templates_created_by").on(table.createdBy),
]);

export const insertAgentTemplateSchema = createInsertSchema(agentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentTemplate = z.infer<typeof insertAgentTemplateSchema>;
export type AgentTemplate = typeof agentTemplates.$inferSelect;

// Batches table - stores Bolna batch campaign records
export const batches = pgTable("batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  batchId: varchar("batch_id").notNull().unique(), // Bolna batch ID
  agentId: varchar("agent_id").notNull(),

  // Batch details
  fileName: text("file_name").notNull(),
  validContacts: integer("valid_contacts").notNull().default(0),
  totalContacts: integer("total_contacts").notNull().default(0),
  fromPhoneNumber: varchar("from_phone_number", { length: 20 }),

  // Status
  status: varchar("status", { length: 50 }).notNull().default('created'), // created, scheduled, queued, executed, stopped
  executionStatus: jsonb("execution_status"), // { completed: 1, ringing: 10, in_progress: 15 }

  // Scheduling
  scheduledAt: timestamp("scheduled_at"),

  // Metadata
  webhookUrl: text("webhook_url"),
  metadata: jsonb("metadata"),

  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_batches_org").on(table.organizationId),
  index("idx_batches_agent").on(table.agentId),
  index("idx_batches_status").on(table.status),
  index("idx_batches_bolna_id").on(table.batchId),
]);

export const batchesRelations = relations(batches, ({ one }) => ({
  organization: one(organizations, {
    fields: [batches.organizationId],
    references: [organizations.id],
  }),
  agent: one(aiAgents, {
    fields: [batches.agentId],
    references: [aiAgents.id],
  }),
}));

export const insertBatchSchema = createInsertSchema(batches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Batch = typeof batches.$inferSelect;

// Analytics data types
export type DashboardMetrics = {
  totalCalls: number;
  totalAgents: number;
  activeAgents: number;
  successRate: number;
  conversationsToday: number;
  usageCostToday: number;
  avgCallDuration: number;
};

export type CallMetrics = {
  date: string;
  calls: number;
  duration: number;
  successful: number;
};

export type AgentPerformance = {
  agentId: string;
  agentName: string;
  totalCalls: number;
  successfulCalls: number;
  averageDuration: number;
  successRate: number;
  avgRating: number;
};

export type CallHistoryItem = {
  id: string;
  contactName: string;
  contactPhone: string;
  status: string;
  outcome: string | null;
  agentName: string | null;
  dateTime: string;
  duration: number | null;
  transcription: string | null;
};

export type AnalyticsMetrics = {
  totalCalls: number;
  totalLeads: number;
  responseRate: number;
  conversionRate: number;
};

export type BillingMetrics = {
  currentMonth: {
    totalMinutes: number;
    totalCalls: number;
    exotelCost: number;
    bolnaCost: number;
    markupCost: number;
    totalCost: number;
  };
  previousMonth: {
    totalMinutes: number;
    totalCost: number;
  };
  costBreakdown: {
    date: string;
    exotelCost: number;
    bolnaCost: number;
    markupCost: number;
    totalCost: number;
    minutes: number;
  }[];
};

export type UsageSummary = {
  date: string;
  totalCalls: number;
  totalMinutes: number;
  exotelCost: number;
  bolnaCost: number;
  markupCost: number;
  totalCost: number;
};
