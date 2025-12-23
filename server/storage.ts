// ...existing code...
// Reference: javascript_log_in_with_replit and javascript_database integrations
import {
  users,
  organizations,
  aiAgents,
  phoneNumbers,
  leads,
  calls,
  knowledgeBase,
  usageTracking,
  campaigns,
  channelPartners,
  visits,
  type User,
  type UpsertUser,
  type AiAgent,
  type InsertAiAgent,
  type CreateAiAgentInput,
  type UpdateAiAgentInput,
  type PhoneNumber,
  type InsertPhoneNumber,
  type Lead,
  type InsertLead,
  type Call,
  type InsertCall,
  type KnowledgeBase,
  type InsertKnowledgeBase,
  type CreateKnowledgeBaseInput,
  type UpdateKnowledgeBaseInput,
  type UsageTracking,
  type InsertUsageTracking,
  type DashboardMetrics,
  type CallMetrics,
  type AgentPerformance,
  type AnalyticsMetrics,
  type BillingMetrics,
  type Campaign,
  type InsertCampaign,
  type ChannelPartner,
  type InsertChannelPartner,
  type Visit,
  type InsertVisit,
  type Organization,
} from "@shared/schema";
import { contacts, campaignContacts } from "@shared/contacts-schema";
import { db } from "./db";
import { eq, and, desc, gte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string, organizationId?: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUsersByOrganization(organizationId: string): Promise<User[]>;

  // Organization operations
  upsertOrganization(org: { name: string; domain: string }): Promise<{ id: string; name: string; domain: string | null }>;
  getOrganization(organizationId: string): Promise<Organization | undefined>;
  updateOrganizationWhitelabel(organizationId: string, whitelabel: { companyName?: string; logoUrl?: string; primaryColor?: string }): Promise<Organization | undefined>;

  // Campaign operations
  getCampaigns(organizationId: string): Promise<Campaign[]>;
  getCampaign(id: string, organizationId: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, organizationId: string, campaign: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string, organizationId: string): Promise<boolean>;
  createAIAgent(agent: InsertAiAgent): Promise<AiAgent>;
  updateAIAgent(id: string, organizationId: string, agent: UpdateAiAgentInput): Promise<AiAgent | undefined>;
  deleteAIAgent(id: string, organizationId: string): Promise<boolean>;
  getPhoneNumber(id: string, organizationId: string): Promise<PhoneNumber | undefined>;
  createPhoneNumber(phone: InsertPhoneNumber): Promise<PhoneNumber>;
  updatePhoneNumber(id: string, organizationId: string, phone: Partial<InsertPhoneNumber>): Promise<PhoneNumber | undefined>;
  getPhoneNumbers(organizationId: string): Promise<PhoneNumber[]>;
  getLeads(organizationId: string): Promise<Lead[]>;
  getLead(id: string, organizationId: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  createLeadsBulk(leads: InsertLead[], organizationId: string): Promise<Lead[]>;
  updateLead(id: string, organizationId: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  getLeadsByAgent(agentId: string, organizationId: string): Promise<Lead[]>;
  getCalls(organizationId: string): Promise<Call[]>;
  getCallsByAgent(agentId: string, organizationId: string): Promise<Call[]>;
  getCall(id: string, organizationId: string): Promise<Call | undefined>;
  getCallByBolnaCallId(bolnaCallId: string): Promise<Call | undefined>;
  getCallByExotelSid(exotelSid: string): Promise<Call | undefined>;
  createCall(call: InsertCall): Promise<Call>;
  updateCall(id: string, organizationId: string, call: Partial<InsertCall>): Promise<Call | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  createLeadsBulk(leads: InsertLead[], organizationId: string): Promise<Lead[]>;
  updateLead(id: string, organizationId: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  getLeadsByAgent(agentId: string, organizationId: string): Promise<Lead[]>;

  // Channel Partner operations
  getChannelPartners(organizationId: string): Promise<ChannelPartner[]>;
  getChannelPartner(id: string, organizationId: string): Promise<ChannelPartner | undefined>;
  createChannelPartner(partner: InsertChannelPartner): Promise<ChannelPartner>;
  createChannelPartnersBulk(partners: InsertChannelPartner[], organizationId: string): Promise<ChannelPartner[]>;
  updateChannelPartner(id: string, organizationId: string, partner: Partial<InsertChannelPartner>): Promise<ChannelPartner | undefined>;

  // Call operations
  getCalls(organizationId: string): Promise<Call[]>;
  getCallsByAgent(agentId: string, organizationId: string): Promise<Call[]>;
  getCall(id: string, organizationId: string): Promise<Call | undefined>;
  getCallByBolnaCallId(bolnaCallId: string): Promise<Call | undefined>;
  getCallByExotelSid(exotelSid: string): Promise<Call | undefined>;
  createCall(call: InsertCall): Promise<Call>;
  updateCall(id: string, organizationId: string, call: Partial<InsertCall>): Promise<Call | undefined>;

  // Visit operations
  getVisits(organizationId: string): Promise<Visit[]>;
  getVisitsByManager(managerId: string, organizationId: string): Promise<Visit[]>;
  createVisit(visit: InsertVisit): Promise<Visit>;
  updateVisit(id: string, organizationId: string, visit: Partial<InsertVisit>): Promise<Visit | undefined>;

  // Knowledge Base operations (tenant-safe types)
  getKnowledgeBase(organizationId: string): Promise<KnowledgeBase[]>;
  getKnowledgeBaseByAgent(agentId: string, organizationId: string): Promise<KnowledgeBase[]>;
  getKnowledgeBaseItem(id: string, organizationId: string): Promise<KnowledgeBase | undefined>;
  createKnowledgeBase(knowledge: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeBase(id: string, organizationId: string, knowledge: UpdateKnowledgeBaseInput): Promise<KnowledgeBase | undefined>;
  deleteKnowledgeBase(id: string, organizationId: string): Promise<boolean>;

  // Usage Tracking operations
  getUsageTracking(organizationId: string, daysAgo?: number): Promise<UsageTracking[]>;
  createUsageTracking(usage: InsertUsageTracking): Promise<UsageTracking>;

  // Analytics operations
  getDashboardMetrics(organizationId: string): Promise<DashboardMetrics>;
  getAnalyticsMetrics(organizationId: string, daysAgo: number): Promise<AnalyticsMetrics>;
  getCallMetrics(organizationId: string, daysAgo: number): Promise<CallMetrics[]>;
  getAgentPerformance(organizationId: string, daysAgo: number): Promise<AgentPerformance[]>;

  // Billing operations
  getBillingMetrics(organizationId: string): Promise<BillingMetrics>;
}

export class DatabaseStorage implements IStorage {
  // AI Agent operations
  async createAIAgent(agent: InsertAiAgent): Promise<AiAgent> {
    const [created] = await db.insert(aiAgents).values(agent).returning();
    return created;
  }
  async updateAIAgent(id: string, organizationId: string, agent: UpdateAiAgentInput): Promise<AiAgent | undefined> {
    const [updated] = await db.update(aiAgents)
      .set({ ...agent, updatedAt: new Date() })
      .where(and(eq(aiAgents.id, id), eq(aiAgents.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }
  async deleteAIAgent(id: string, organizationId: string): Promise<boolean> {
    const result = await db.delete(aiAgents)
      .where(and(eq(aiAgents.id, id), eq(aiAgents.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }
  // Phone Number operations
  async getPhoneNumber(id: string, organizationId: string): Promise<PhoneNumber | undefined> {
    const [phone] = await db.select().from(phoneNumbers)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)));
    return phone || undefined;
  }
  async createPhoneNumber(phone: InsertPhoneNumber): Promise<PhoneNumber> {
    const [created] = await db.insert(phoneNumbers).values(phone).returning();
    return created;
  }
  async updatePhoneNumber(id: string, organizationId: string, phone: Partial<InsertPhoneNumber>): Promise<PhoneNumber | undefined> {
    const [updated] = await db.update(phoneNumbers)
      .set({ ...phone, updatedAt: new Date() })
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }
  // Lead operations
  async getLeads(organizationId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.organizationId, organizationId));
  }
  async getLead(id: string, organizationId: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads)
      .where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)));
    return lead || undefined;
  }
  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }
  async createLeadsBulk(leadsArr: InsertLead[], organizationId: string): Promise<Lead[]> {
    const created = await db.insert(leads).values(leadsArr.map(l => ({ ...l, organizationId }))).returning();
    return created;
  }
  async updateLead(id: string, organizationId: string, lead: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updated] = await db.update(leads)
      .set({ ...lead, updatedAt: new Date() })
      .where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }
  async getLeadsByAgent(agentId: string, organizationId: string): Promise<Lead[]> {
    return await db.select().from(leads)
      .where(and(eq(leads.assignedAgentId, agentId), eq(leads.organizationId, organizationId)));
  }
  // Call operations
  async getCalls(organizationId: string): Promise<Call[]> {
    return await db.select().from(calls)
      .where(eq(calls.organizationId, organizationId))
      .orderBy(desc(calls.createdAt));
  }
  async getCallsByAgent(agentId: string, organizationId: string): Promise<Call[]> {
    return await db.select().from(calls)
      .where(and(eq(calls.agentId, agentId), eq(calls.organizationId, organizationId)))
      .orderBy(desc(calls.createdAt));
  }
  async getCall(id: string, organizationId: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls)
      .where(and(eq(calls.id, id), eq(calls.organizationId, organizationId)));
    return call || undefined;
  }
  async getCallByBolnaCallId(bolnaCallId: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls)
      .where(eq(calls.bolnaCallId, bolnaCallId));
    return call || undefined;
  }
  async getCallByExotelSid(exotelSid: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls)
      .where(eq(calls.exotelCallSid, exotelSid));
    return call || undefined;
  }
  async createCall(call: InsertCall): Promise<Call> {
    const [created] = await db.insert(calls).values(call).returning();
    return created;
  }
  async updateCall(id: string, organizationId: string, call: Partial<InsertCall>): Promise<Call | undefined> {
    const [updated] = await db.update(calls)
      .set({ ...call, updatedAt: new Date() })
      .where(and(eq(calls.id, id), eq(calls.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }
  // Contact operations

  // Phone Number operations
  async getPhoneNumbers(organizationId: string): Promise<PhoneNumber[]> {
    return await db.select().from(phoneNumbers).where(eq(phoneNumbers.organizationId, organizationId));
  }
  async createContact(contactData: { organizationId: string, name: string, email?: string, phone?: string, company?: string }) {
    const [contact] = await db.insert(contacts).values(contactData).returning();
    return contact;
  }

  async getContacts(organizationId: string) {
    // List all contacts for an organization
    return await db.select().from(contacts).where(eq(contacts.organizationId, organizationId));
  }
  // User operations
  async getUser(id: string, organizationId?: string): Promise<User | undefined> {
    if (organizationId) {
      const [user] = await db.select().from(users)
        .where(and(eq(users.id, id), eq(users.organizationId, organizationId)));
      return user || undefined;
    }
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.organizationId, organizationId));
  }

  // Organization operations
  async upsertOrganization(org: { name: string; domain: string }): Promise<{ id: string; name: string; domain: string | null }> {
    const [existingOrg] = await db.select().from(organizations).where(eq(organizations.domain, org.domain));
    if (existingOrg) {
      return existingOrg;
    }
    const [newOrg] = await db.insert(organizations).values(org).returning();
    return newOrg;
  }

  async getOrganization(organizationId: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations)
      .where(eq(organizations.id, organizationId));
    return org || undefined;
  }

  async updateOrganizationWhitelabel(
    organizationId: string,
    whitelabel: { companyName?: string; logoUrl?: string; primaryColor?: string }
  ): Promise<Organization | undefined> {
    const [org] = await db
      .update(organizations)
      .set({ ...whitelabel, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning();
    return org || undefined;
  }

  // Campaign operations
  async getCampaigns(organizationId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns)
      .where(eq(campaigns.organizationId, organizationId))
      .orderBy(desc(campaigns.createdAt));
  }
  async getCampaign(id: string, organizationId: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)));
    return campaign || undefined;
  }

  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(campaignData).returning();
    return campaign;
  }

  async updateCampaign(id: string, organizationId: string, campaignData: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [campaign] = await db
      .update(campaigns)
      .set({ ...campaignData, updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)))
      .returning();
    return campaign || undefined;
  }

  async deleteCampaign(id: string, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }

  async addContactToCampaign(campaignId: string, contactId: string): Promise<boolean> {
    // Add a contact to a campaign (campaign_contacts table)
    try {
      await db.insert(campaignContacts).values({ campaignId, contactId }).onConflictDoNothing();
      return true;
    } catch (e) {
      return false;
    }
  }

  async addContactToGlobalList(_campaignId: string, contactId: string): Promise<boolean> {
    // Add a contact to the global list (set status to active if not already)
    try {
      await db.update(contacts).set({ status: "active" }).where(eq(contacts.id, contactId));
      return true;
    } catch (e) {
      return false;
    }
  }

  // AI Agent operations
  async getAIAgents(organizationId: string): Promise<AiAgent[]> {
    // Return agents only for the specified organization
    return await db.select().from(aiAgents)
      .where(eq(aiAgents.organizationId, organizationId))
      .orderBy(desc(aiAgents.createdAt));
  }

  async getAIAgent(id: string, organizationId: string): Promise<AiAgent | undefined> {
    const [agent] = await db.select().from(aiAgents)
      .where(and(eq(aiAgents.id, id), eq(aiAgents.organizationId, organizationId)));
    return agent || undefined;
  }

  // Implement getDashboardMetrics with real data from database
  async getDashboardMetrics(organizationId: string): Promise<DashboardMetrics> {
    try {
      console.log('[getDashboardMetrics] Called with organizationId:', organizationId);
      
      // Get total calls
      const allCalls = await db.select().from(calls).where(eq(calls.organizationId, organizationId));
      console.log('[getDashboardMetrics] Found calls:', allCalls.length);
      
      const totalCalls = allCalls.length;
      
      // Get total agents and active agents
      const allAgents = await db.select().from(aiAgents).where(eq(aiAgents.organizationId, organizationId));
      console.log('[getDashboardMetrics] Found agents:', allAgents.length);
      
      const totalAgents = allAgents.length;
      const activeAgents = allAgents.filter(a => a.status === 'active').length;
      
      // Calculate success rate (completed calls / total calls)
      const completedCalls = allCalls.filter(c => c.status === 'completed').length;
      const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
      
      // Get conversations today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const conversationsToday = allCalls.filter(c => {
        const callDate = c.createdAt ? new Date(c.createdAt) : null;
        return callDate && callDate >= today;
      }).length;
      
      // Calculate usage cost today
      const usageCostToday = allCalls
        .filter(c => {
          const callDate = c.createdAt ? new Date(c.createdAt) : null;
          return callDate && callDate >= today;
        })
        .reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
      
      // Calculate average call duration (in seconds)
      const callsWithDuration = allCalls.filter(c => c.duration && c.duration > 0);
      const avgCallDuration = callsWithDuration.length > 0 
        ? callsWithDuration.reduce((sum, c) => sum + (Number(c.duration) || 0), 0) / callsWithDuration.length 
        : 0;
      
      return {
        totalCalls,
        totalAgents,
        activeAgents,
        successRate: Math.round(successRate * 10) / 10,
        conversationsToday,
        usageCostToday: Math.round(usageCostToday * 100) / 100,
        avgCallDuration: Math.round(avgCallDuration),
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      return {
        totalCalls: 0,
        totalAgents: 0,
        activeAgents: 0,
        successRate: 0,
        conversationsToday: 0,
        usageCostToday: 0,
        avgCallDuration: 0,
      };
    }
  }

  // --- STUBS for missing IStorage methods ---
  async getChannelPartners(organizationId: string): Promise<ChannelPartner[]> { throw new Error('Not implemented'); }
  async getChannelPartner(id: string, organizationId: string): Promise<ChannelPartner | undefined> { throw new Error('Not implemented'); }
  async createChannelPartner(partner: InsertChannelPartner): Promise<ChannelPartner> { throw new Error('Not implemented'); }
  async createChannelPartnersBulk(partners: InsertChannelPartner[], organizationId: string): Promise<ChannelPartner[]> { throw new Error('Not implemented'); }
  async updateChannelPartner(id: string, organizationId: string, partner: Partial<InsertChannelPartner>): Promise<ChannelPartner | undefined> { throw new Error('Not implemented'); }
  async getVisits(organizationId: string): Promise<Visit[]> { throw new Error('Not implemented'); }
  async getVisitsByManager(managerId: string, organizationId: string): Promise<Visit[]> { throw new Error('Not implemented'); }
  async createVisit(visit: InsertVisit): Promise<Visit> { throw new Error('Not implemented'); }
  async updateVisit(id: string, organizationId: string, visit: Partial<InsertVisit>): Promise<Visit | undefined> { throw new Error('Not implemented'); }
  async getKnowledgeBase(organizationId: string): Promise<KnowledgeBase[]> {
    return await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.organizationId, organizationId))
      .orderBy(desc(knowledgeBase.createdAt));
  }

  async getKnowledgeBaseByAgent(agentId: string, organizationId: string): Promise<KnowledgeBase[]> {
    return await db.select().from(knowledgeBase)
      .where(and(
        eq(knowledgeBase.agentId, agentId),
        eq(knowledgeBase.organizationId, organizationId)
      ))
      .orderBy(desc(knowledgeBase.createdAt));
  }

  async getKnowledgeBaseItem(id: string, organizationId: string): Promise<KnowledgeBase | undefined> {
    const [kb] = await db.select().from(knowledgeBase)
      .where(and(
        eq(knowledgeBase.id, id),
        eq(knowledgeBase.organizationId, organizationId)
      ));
    return kb;
  }

  async createKnowledgeBase(knowledge: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const [kb] = await db.insert(knowledgeBase)
      .values({
        ...knowledge,
        updatedAt: new Date()
      })
      .returning();
    return kb;
  }

  async updateKnowledgeBase(id: string, organizationId: string, knowledge: UpdateKnowledgeBaseInput): Promise<KnowledgeBase | undefined> {
    const [kb] = await db.update(knowledgeBase)
      .set({
        ...knowledge,
        updatedAt: new Date()
      })
      .where(and(
        eq(knowledgeBase.id, id),
        eq(knowledgeBase.organizationId, organizationId)
      ))
      .returning();
    return kb;
  }

  async deleteKnowledgeBase(id: string, organizationId: string): Promise<boolean> {
    const result = await db.delete(knowledgeBase)
      .where(and(
        eq(knowledgeBase.id, id),
        eq(knowledgeBase.organizationId, organizationId)
      ))
      .returning();
    return result.length > 0;
  }
  async getUsageTracking(organizationId: string, daysAgo?: number): Promise<UsageTracking[]> { throw new Error('Not implemented'); }
  async createUsageTracking(usage: InsertUsageTracking): Promise<UsageTracking> { throw new Error('Not implemented'); }

  async getAnalyticsMetrics(organizationId: string, daysAgo: number): Promise<AnalyticsMetrics> {
    try {
      // Get date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0);
      
      // Get all calls within the time range
      const allCalls = await db.select().from(calls).where(eq(calls.organizationId, organizationId));
      const filteredCalls = allCalls.filter(c => {
        const callDate = c.createdAt ? new Date(c.createdAt) : null;
        return callDate && callDate >= startDate;
      });
      
      // Get all leads
      const allLeads = await db.select().from(leads).where(eq(leads.organizationId, organizationId));
      const filteredLeads = allLeads.filter(l => {
        const leadDate = l.createdAt ? new Date(l.createdAt) : null;
        return leadDate && leadDate >= startDate;
      });
      
      const totalCalls = filteredCalls.length;
      const totalLeads = filteredLeads.length;
      
      // Calculate response rate (leads that were contacted / total leads)
      const contactedLeads = filteredLeads.filter(l => l.status !== 'new').length;
      const responseRate = totalLeads > 0 ? (contactedLeads / totalLeads) * 100 : 0;
      
      // Calculate conversion rate (converted leads / total leads)
      const convertedLeads = filteredLeads.filter(l => l.status === 'converted').length;
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
      
      return {
        totalCalls,
        totalLeads,
        responseRate: Math.round(responseRate * 10) / 10,
        conversionRate: Math.round(conversionRate * 10) / 10,
      };
    } catch (error) {
      console.error('Error getting analytics metrics:', error);
      return {
        totalCalls: 0,
        totalLeads: 0,
        responseRate: 0,
        conversionRate: 0,
      };
    }
  }

  async getCallMetrics(organizationId: string, daysAgo: number): Promise<CallMetrics[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0);
      
      const allCalls = await db.select().from(calls).where(eq(calls.organizationId, organizationId));
      
      // Group calls by date
      const callsByDate: Record<string, { calls: number; duration: number; successful: number }> = {};
      
      for (let i = 0; i < daysAgo; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        callsByDate[dateStr] = { calls: 0, duration: 0, successful: 0 };
      }
      
      allCalls.forEach(call => {
        const callDate = call.createdAt ? new Date(call.createdAt) : null;
        if (callDate && callDate >= startDate) {
          const dateStr = callDate.toISOString().split('T')[0];
          if (callsByDate[dateStr]) {
            callsByDate[dateStr].calls++;
            callsByDate[dateStr].duration += Number(call.duration) || 0;
            if (call.status === 'completed') {
              callsByDate[dateStr].successful++;
            }
          }
        }
      });
      
      return Object.entries(callsByDate)
        .map(([date, data]) => ({
          date,
          calls: data.calls,
          duration: data.duration,
          successful: data.successful,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('Error getting call metrics:', error);
      return [];
    }
  }

  async getAgentPerformance(organizationId: string, daysAgo: number): Promise<AgentPerformance[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0);
      
      const allAgents = await db.select().from(aiAgents).where(eq(aiAgents.organizationId, organizationId));
      const allCalls = await db.select().from(calls).where(eq(calls.organizationId, organizationId));
      
      return allAgents.map(agent => {
        const agentCalls = allCalls.filter(c => {
          const callDate = c.createdAt ? new Date(c.createdAt) : null;
          return c.agentId === agent.id && callDate && callDate >= startDate;
        });
        
        const totalCalls = agentCalls.length;
        const successfulCalls = agentCalls.filter(c => c.status === 'completed').length;
        const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
        const totalDuration = agentCalls.reduce((sum, c) => sum + (Number(c.duration) || 0), 0);
        const averageDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
        
        return {
          agentId: agent.id,
          agentName: agent.name,
          totalCalls,
          successfulCalls,
          averageDuration: Math.round(averageDuration),
          successRate: Math.round(successRate * 10) / 10,
          avgRating: 0, // No rating data available yet
        };
      });
    } catch (error) {
      console.error('Error getting agent performance:', error);
      return [];
    }
  }

  async getBillingMetrics(organizationId: string): Promise<BillingMetrics> {
    try {
      const allCalls = await db.select().from(calls).where(eq(calls.organizationId, organizationId));
      
      // Get current month dates
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // Filter calls for current month
      const currentMonthCalls = allCalls.filter(c => {
        const callDate = c.createdAt ? new Date(c.createdAt) : null;
        return callDate && callDate >= currentMonthStart;
      });
      
      // Filter calls for previous month
      const previousMonthCalls = allCalls.filter(c => {
        const callDate = c.createdAt ? new Date(c.createdAt) : null;
        return callDate && callDate >= previousMonthStart && callDate <= previousMonthEnd;
      });
      
      // Calculate current month metrics
      const currentMonthMinutes = Math.round(currentMonthCalls.reduce((sum, c) => sum + (Number(c.duration) || 0), 0) / 60);
      const currentMonthCost = currentMonthCalls.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
      
      // Calculate previous month metrics
      const previousMonthMinutes = Math.round(previousMonthCalls.reduce((sum, c) => sum + (Number(c.duration) || 0), 0) / 60);
      const previousMonthCost = previousMonthCalls.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
      
      // Group calls by date for cost breakdown (last 30 days)
      const costBreakdown: { date: string; exotelCost: number; bolnaCost: number; markupCost: number; totalCost: number; minutes: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayCalls = allCalls.filter(c => {
          const callDate = c.createdAt ? new Date(c.createdAt) : null;
          return callDate && callDate.toISOString().split('T')[0] === dateStr;
        });
        
        const dayMinutes = Math.round(dayCalls.reduce((sum, c) => sum + (Number(c.duration) || 0), 0) / 60);
        const dayCost = dayCalls.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
        
        costBreakdown.push({
          date: dateStr,
          exotelCost: Math.round(dayCost * 0.4 * 100) / 100, // Estimate 40% telephony
          bolnaCost: Math.round(dayCost * 0.4 * 100) / 100,   // Estimate 40% AI
          markupCost: Math.round(dayCost * 0.2 * 100) / 100,  // Estimate 20% markup
          totalCost: Math.round(dayCost * 100) / 100,
          minutes: dayMinutes,
        });
      }
      
      return {
        currentMonth: {
          totalMinutes: currentMonthMinutes,
          totalCalls: currentMonthCalls.length,
          exotelCost: Math.round(currentMonthCost * 0.4 * 100) / 100,
          bolnaCost: Math.round(currentMonthCost * 0.4 * 100) / 100,
          markupCost: Math.round(currentMonthCost * 0.2 * 100) / 100,
          totalCost: Math.round(currentMonthCost * 100) / 100,
        },
        previousMonth: {
          totalMinutes: previousMonthMinutes,
          totalCost: Math.round(previousMonthCost * 100) / 100,
        },
        costBreakdown,
      };
    } catch (error) {
      console.error('Error getting billing metrics:', error);
      return {
        currentMonth: {
          totalMinutes: 0,
          totalCalls: 0,
          exotelCost: 0,
          bolnaCost: 0,
          markupCost: 0,
          totalCost: 0,
        },
        previousMonth: {
          totalMinutes: 0,
          totalCost: 0,
        },
        costBreakdown: [],
      };
    }
  }
}

// Export a singleton instance for use throughout the app
export const storage = new DatabaseStorage();
