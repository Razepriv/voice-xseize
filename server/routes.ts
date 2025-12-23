// Reference: javascript_log_in_with_replit integration
import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import Papa from "papaparse";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, sessionMiddleware } from "./supabaseAuth";
import { generateAISummary, analyzeLeadQualification, generateMeetingSummary, matchLeadsToAgents } from "./openai";
import { bolnaClient } from "./bolna";
// import { exotelClient } from "./exotel"; // Exotel disabled - using Plivo only
import { plivoClient } from "./plivo";
import { startCallPolling, stopCallPolling, stopAllPolling, getPollingStats, startInboundPolling, stopInboundPolling } from "./callPoller";
import { syncAllPhoneNumbers, triggerManualSync, getSyncStats, syncOrganizationPhoneNumbers, startPhoneNumberSync } from "./phoneNumberSync";
import { getAgentTemplatesForUser, createAgentTemplate, updateAgentTemplate, deleteAgentTemplate } from "./agentTemplates";
import { buildBolnaUserData } from "./utils/bolnaUserData.js";
import type { InsertLead, InsertChannelPartner, InsertCampaign, InsertCall, InsertVisit, InsertAiAgent, CreateAiAgentInput, UpdateAiAgentInput, InsertKnowledgeBase, CreateKnowledgeBaseInput, UpdateKnowledgeBaseInput, InsertPhoneNumber } from "@shared/schema";
import { createAiAgentSchema, updateAiAgentSchema, createKnowledgeBaseSchema, updateKnowledgeBaseSchema, batches } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
// @ts-ignore
declare module 'pdfkit';

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Agent Template routes (user-specific)

  app.get('/api/agent-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templates = await getAgentTemplatesForUser(userId);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching agent templates:', error);
      res.status(500).json({ message: 'Failed to fetch agent templates' });
    }
  });

  app.post('/api/agent-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const template = { ...req.body, createdBy: userId, updatedAt: new Date() };
      const created = await createAgentTemplate(template);
      res.json(created);
    } catch (error) {
      console.error('Error creating agent template:', error);
      res.status(500).json({ message: 'Failed to create agent template' });
    }
  });

  app.patch('/api/agent-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await updateAgentTemplate(req.params.id, userId, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating agent template:', error);
      res.status(500).json({ message: 'Failed to update agent template' });
    }
  });

  app.delete('/api/agent-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const success = await deleteAgentTemplate(req.params.id, userId);
      res.json({ success });
    } catch (error) {
      console.error('Error deleting agent template:', error);
      res.status(500).json({ message: 'Failed to delete agent template' });
    }
  });
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User management routes
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const users = await storage.getUsersByOrganization(currentUser.organizationId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // AI Agents routes
  app.get('/api/ai-agents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const agents = await storage.getAIAgents(user.organizationId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching AI agents:", error);
      res.status(500).json({ message: "Failed to fetch AI agents" });
    }
  });

  app.get('/api/ai-agents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const agent = await storage.getAIAgent(req.params.id, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "AI agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching AI agent:", error);
      res.status(500).json({ message: "Failed to fetch AI agent" });
    }
  });

  app.post('/api/ai-agents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Validate request body using strict schema that rejects organizationId
      const clientData: CreateAiAgentInput = createAiAgentSchema.parse(req.body);

      // Append username/email to agent name for Bolna
      const userIdentifier = user.email || user.firstName || user.id;
      const agentData: InsertAiAgent = {
        ...clientData,
        organizationId: user.organizationId,
        name: `${clientData.name.trim()} - ${userIdentifier}`.trim(),
        createdBy: userId,
      };

      // Create agent in database first
      const agent = await storage.createAIAgent(agentData);

      // Emit real-time update
      if ((app as any).emitAgentCreated) {
        (app as any).emitAgentCreated(user.organizationId, agent);
      }

      // Auto-sync to Bolna in background (don't block response)
      if (agentData.voiceId && agentData.voiceProvider && agentData.voiceProvider !== 'all') {
        // Sync to Bolna asynchronously
        bolnaClient.createAgent(agent as any)
          .then(async (bolnaAgent) => {
            console.log(`✅ Agent ${agent.id} synced to Bolna with ID: ${bolnaAgent.agent_id}`);
            console.log(`   Webhook URL configured: ${(bolnaAgent as any).agent_config?.webhook_url || 'MISSING'}`);
            if (!(bolnaAgent as any).agent_config?.webhook_url) {
              console.error(`❌ WARNING: Agent created in Bolna but webhook URL is NOT set!`);
              console.error(`   This means you will NOT receive real-time call updates!`);
            }
            // Update agent with Bolna info
            await storage.updateAIAgent(agent.id, user.organizationId, {
              bolnaAgentId: bolnaAgent.agent_id,
              bolnaConfig: bolnaAgent as any,
            }).catch(err => console.error("Failed to update agent with Bolna ID:", err));

            // Auto-setup inbound call if phone number is assigned
            if (agent.assignedPhoneNumberId) {
              try {
                console.log(`Setting up inbound call for agent ${agent.id} with phone number ${agent.assignedPhoneNumberId}...`);
                const phoneNumber = await storage.getPhoneNumber(agent.assignedPhoneNumberId, user.organizationId);
                if (phoneNumber && phoneNumber.phoneNumber) {
                  // Pass the actual phone number to Bolna with provider
                  await bolnaClient.setupInboundCall(bolnaAgent.agent_id, phoneNumber.phoneNumber);
                  console.log(`Inbound call setup successful for agent ${agent.id} with number ${phoneNumber.phoneNumber}`);
                }
              } catch (inboundError) {
                console.error(`Failed to setup inbound call for agent ${agent.id}:`, inboundError);
              }
            }
          })
          .catch(bolnaError => {
            console.error(`Failed to sync agent ${agent.id} to Bolna:`, bolnaError.message);
          });
      } else {
        console.log("Agent created without voice configuration, skipping Bolna sync");
      }

      res.json(agent);
    } catch (error) {
      console.error("Error creating AI agent:", error);
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ message: "Invalid request data", errors: (error as any).issues });
      }
      res.status(500).json({ message: "Failed to create AI agent" });
    }
  });

  app.patch('/api/ai-agents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Validate using strict update schema that rejects organizationId
      const updateData: UpdateAiAgentInput = updateAiAgentSchema.parse(req.body);

      // Get existing agent to check for Bolna integration
      const existingAgent = await storage.getAIAgent(req.params.id, user.organizationId);
      if (!existingAgent) {
        return res.status(404).json({ message: "AI agent not found" });
      }

      // Sync updates to Bolna if agent has Bolna integration
      if (existingAgent.bolnaAgentId) {
        try {
          const mergedData = { ...existingAgent, ...updateData };
          await bolnaClient.updateAgent(existingAgent.bolnaAgentId, mergedData as any);
        } catch (bolnaError) {
          console.error("Bolna API update error:", bolnaError);
          // Continue with local update even if Bolna sync fails
        }
      }

      // Pass only validated tenant-safe data to storage (organizationId cannot be in updateData)
      const agent = await storage.updateAIAgent(req.params.id, user.organizationId, updateData);
      if (!agent) {
        return res.status(404).json({ message: "AI agent not found" });
      }

      // Emit real-time update
      if ((app as any).emitAgentUpdate) {
        (app as any).emitAgentUpdate(user.organizationId, agent);
      }

      res.json(agent);
    } catch (error) {
      console.error("Error updating AI agent:", error);
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ message: "Invalid request data", errors: (error as any).issues });
      }
      res.status(500).json({ message: "Failed to update AI agent" });
    }
  });

  app.delete('/api/ai-agents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get agent to check for Bolna integration before deleting
      const agent = await storage.getAIAgent(req.params.id, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "AI agent not found" });
      }

      // Delete from Bolna if integrated
      if (agent.bolnaAgentId) {
        try {
          await bolnaClient.deleteAgent(agent.bolnaAgentId);
        } catch (bolnaError) {
          console.error("Bolna API delete error:", bolnaError);
          // Continue with local deletion even if Bolna deletion fails
        }
      }

      const deleted = await storage.deleteAIAgent(req.params.id, user.organizationId);
      if (!deleted) {
        return res.status(404).json({ message: "AI agent not found" });
      }

      // Emit real-time update
      if ((app as any).emitAgentDeleted) {
        (app as any).emitAgentDeleted(user.organizationId, req.params.id);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting AI agent:", error);
      res.status(500).json({ message: "Failed to delete AI agent" });
    }
  });

  // Sync agent with Bolna - retry Bolna integration
  app.post('/api/ai-agents/:id/sync', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agent = await storage.getAIAgent(req.params.id, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "AI agent not found" });
      }

      console.log(`Syncing agent ${agent.id} with Bolna...`);
      console.log(`Agent data:`, JSON.stringify({
        name: agent.name,
        voiceId: agent.voiceId,
        voiceName: agent.voiceName,
        voiceProvider: agent.voiceProvider,
        model: agent.model,
        provider: agent.provider,
        language: agent.language,
      }, null, 2));

      // Validate required fields
      if (!agent.voiceId) {
        return res.status(400).json({
          message: "Voice ID is required",
          error: "Please select a voice for the agent before syncing with Bolna."
        });
      }

      if (!agent.voiceProvider || agent.voiceProvider === 'all') {
        return res.status(400).json({
          message: "Voice provider is required",
          error: "Please select a specific voice provider (ElevenLabs, Polly, etc.) before syncing."
        });
      }

      // If already has Bolna integration, update it
      // If not, create new Bolna agent
      try {
        // Note: Using Plivo through Bolna only (Exotel removed)

        // Determine telephony provider from assigned phone number
        let telephonyProvider = "plivo"; // Default to plivo
        if (agent.assignedPhoneNumberId) {
          const phoneNumber = await storage.getPhoneNumber(agent.assignedPhoneNumberId, user.organizationId);
          if (phoneNumber?.provider) {
            telephonyProvider = phoneNumber.provider;
            console.log(`[Bolna] Using telephony provider: ${telephonyProvider} from phone ${phoneNumber.phoneNumber}`);
          }
        }

        let bolnaAgent;
        if (agent.bolnaAgentId) {
          console.log(`Agent has existing Bolna ID: ${agent.bolnaAgentId}, updating...`);
          bolnaAgent = await bolnaClient.updateAgent(agent.bolnaAgentId, { ...agent, telephonyProvider } as any);
        } else {
          console.log(`Creating new Bolna agent...`);
          bolnaAgent = await bolnaClient.createAgent({ ...agent, telephonyProvider } as any);
          console.log(`Bolna agent created with ID: ${bolnaAgent.agent_id}`);
          await storage.updateAIAgent(req.params.id, user.organizationId, {
            bolnaAgentId: bolnaAgent.agent_id,
            bolnaConfig: bolnaAgent as any,
          });

          // Auto-setup inbound call if phone number is assigned
          if (agent.assignedPhoneNumberId) {
            try {
              console.log(`Setting up inbound call for agent ${agent.id} with phone number ${agent.assignedPhoneNumberId}...`);
              const phoneNumber = await storage.getPhoneNumber(agent.assignedPhoneNumberId, user.organizationId);
              if (phoneNumber && phoneNumber.phoneNumber) {
                // Pass the actual phone number to Bolna with provider
                await bolnaClient.setupInboundCall(bolnaAgent.agent_id, phoneNumber.phoneNumber);
                console.log(`Inbound call setup successful for agent ${agent.id} with number ${phoneNumber.phoneNumber}`);
              }
            } catch (inboundError) {
              console.error(`Failed to setup inbound call for agent ${agent.id}:`, inboundError);
              // Don't fail the sync if inbound setup fails
            }
          }
        }

        const updatedAgent = await storage.getAIAgent(req.params.id, user.organizationId);

        // Emit real-time update
        if ((app as any).emitAgentUpdate && updatedAgent) {
          (app as any).emitAgentUpdate(user.organizationId, updatedAgent);
        }

        res.json(updatedAgent);
      } catch (bolnaError: any) {
        console.error("Bolna sync error:", bolnaError);
        return res.status(500).json({
          message: "Failed to sync with Bolna",
          error: bolnaError.message || String(bolnaError)
        });
      }
    } catch (error: any) {
      console.error("Error syncing AI agent:", error);
      res.status(500).json({
        message: "Failed to sync AI agent",
        error: error.message || String(error)
      });
    }
  });

  // Call initiation route - Use Bolna + Exotel
  app.post('/api/calls/initiate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { agentId, recipientPhone, contactName, fromPhone, leadId } = req.body;

      if (!agentId || !recipientPhone) {
        return res.status(400).json({ message: "agentId and recipientPhone are required" });
      }

      // Get the AI agent
      const agent = await storage.getAIAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "AI agent not found" });
      }

      if (!agent.bolnaAgentId) {
        return res.status(400).json({ message: "Agent is not configured with Bolna" });
      }

      let callerId = fromPhone;
      if (!callerId && agent.assignedPhoneNumberId) {
        const assignedPhone = await storage.getPhoneNumber(agent.assignedPhoneNumberId, user.organizationId);
        callerId = assignedPhone?.phoneNumber || undefined;
        console.log('[Call Initiate] Agent assigned phone:', assignedPhone?.phoneNumber);
        console.log('[Call Initiate] Using caller ID:', callerId);
      } else {
        console.log('[Call Initiate] No assigned phone number for agent');
      }

      // Create call record in database
      const callData: InsertCall = {
        organizationId: user.organizationId,
        leadId: leadId || null,
        agentId,
        contactPhone: recipientPhone,
        contactName: contactName || null,
        callType: 'outbound',
        direction: 'outbound',
        status: 'initiated',
        scheduledAt: new Date(),
      };

      const call = await storage.createCall(callData);

      let bolnaCall;
      try {
        // Use v2 API for call initiation, with reusable user_data builder
        bolnaCall = await bolnaClient.initiateCallV2({
          agent_id: agent.bolnaAgentId,
          recipient_phone_number: recipientPhone,
          from_phone_number: callerId,
          user_data: buildBolnaUserData({
            callId: call.id,
            leadId,
            contactName,
            organizationId: user.organizationId,
          }),
        });

        await storage.updateCall(call.id, user.organizationId, {
          bolnaCallId: bolnaCall.call_id || bolnaCall.execution_id,
        });
      } catch (bolnaError) {
        console.error("Bolna initiate call error:", bolnaError);
        // Fallback to v1 API if v2 fails
        try {
          bolnaCall = await bolnaClient.initiateCall({
            agent_id: agent.bolnaAgentId,
            recipient_phone_number: recipientPhone,
            from: callerId,
            metadata: {
              callId: call.id,
              leadId: leadId,
              contact_name: contactName,  // For {{contact_name}} variable
              contactName: contactName,
              organizationId: user.organizationId,
            },
          });
          await storage.updateCall(call.id, user.organizationId, {
            bolnaCallId: bolnaCall.call_id,
          });
        } catch (fallbackError) {
          console.error("Bolna v1 fallback also failed:", fallbackError);
        }
      }

      // Note: Exotel call initiation removed - using Plivo through Bolna only

      const latestCall = await storage.getCall(call.id, user.organizationId);

      // Emit real-time updates
      if ((app as any).emitCallCreated && latestCall) {
        (app as any).emitCallCreated(user.organizationId, latestCall);
      }

      // Emit metrics update for dashboard
      if ((app as any).emitMetricsUpdate) {
        const metrics = await storage.getDashboardMetrics(user.organizationId);
        (app as any).emitMetricsUpdate(user.organizationId, metrics);
      }

      // Start automatic polling for call status if we have a Bolna call ID
      // This provides a fallback mechanism when webhooks fail or are delayed
      if (latestCall?.bolnaCallId) {
        console.log(`🔄 [Call Initiate] Starting automatic polling for call ${latestCall.bolnaCallId}`);
        startCallPolling(
          latestCall.bolnaCallId,
          latestCall.id,
          user.organizationId,
          (app as any).emitCallUpdate,
          (app as any).emitMetricsUpdate
        );
      }

      res.json({ call: latestCall || call, bolnaCall });
    } catch (error) {
      console.error("Error initiating call:", error);
      res.status(500).json({ message: "Failed to initiate call" });
    }
  });

  // Exotel phone numbers management
  app.get('/api/phone-numbers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get phone numbers from database
      const phoneNumbers = await storage.getPhoneNumbers(user.organizationId);
      res.json(phoneNumbers);
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      res.status(500).json({ message: "Failed to fetch phone numbers" });
    }
  });

  app.get('/api/phone-numbers/sync', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Note: Using Plivo through Bolna only - phone numbers are synced via phoneNumberSync.ts
      const existingNumbers = await storage.getPhoneNumbers(user.organizationId);
      console.log('[Phone Sync] Using Plivo through Bolna - existing numbers:', existingNumbers.map(n => n.phoneNumber));

      res.json({ syncedNumbers: existingNumbers, total: existingNumbers.length });
    } catch (error) {
      console.error("Error syncing phone numbers:", error);
      res.status(500).json({ message: "Failed to sync phone numbers" });
    }
  });

  // Bolna webhook for call status updates
  app.post('/api/webhooks/bolna/call-status', async (req, res) => {
    try {
      // Log ALL incoming webhooks with full payload
      console.log('\n🔔 [Bolna Webhook] Received at:', new Date().toISOString());
      console.log('📦 [Bolna Webhook] Full payload:', JSON.stringify(req.body, null, 2));

      // Bolna webhook payload structure - captures ALL real-time data
      const {
        id: bolnaCallId,
        conversation_duration,
        total_cost,
        transcript,
        recording_url,
        status: bolnaStatus,
        context_details,
        telephony_data,
        call_details,      // Additional call information
        metadata          // Any extra metadata from Bolna
      } = req.body;

      // Ensure conversation_duration is an integer
      const callDuration = conversation_duration ? Math.floor(Number(conversation_duration)) : undefined;
      console.log(`[Bolna Webhook] conversation_duration raw: ${conversation_duration}, type: ${typeof conversation_duration}, converted: ${callDuration}`);

      let call;

      // Method 1: Try to find call using context_details (most reliable)
      if (context_details?.recipient_data?.callId && context_details?.recipient_data?.organizationId) {
        console.log(`[Bolna Webhook] Trying context_details: callId=${context_details.recipient_data.callId}, org=${context_details.recipient_data.organizationId}`);
        call = await storage.getCall(context_details.recipient_data.callId, context_details.recipient_data.organizationId);
      }

      // Method 2: Try to find call by Bolna call ID
      if (!call && bolnaCallId) {
        console.log(`[Bolna Webhook] Trying Bolna ID: ${bolnaCallId}`);
        call = await storage.getCallByBolnaCallId(bolnaCallId);
      }

      if (!call) {
        console.warn(`[Bolna Webhook] ❌ Could not find matching call. Bolna ID: ${bolnaCallId}, Context callId: ${context_details?.recipient_data?.callId}`);
        return res.status(202).json({ received: true, matched: false });
      }

      console.log(`[Bolna Webhook] ✅ Found call ${call.id} for Bolna ID ${bolnaCallId}`);
      console.log(`[Bolna Webhook] Org: ${call.organizationId}`);
      console.log(`[Bolna Webhook] Current status: ${call.status}`);
      console.log(`[Bolna Webhook] Bolna status: ${bolnaStatus}`);

      // Determine status based on Bolna's status field or conversation_duration
      let normalizedStatus = call.status;
      let isVoicemail = false;

      if (bolnaStatus) {
        const statusLower = bolnaStatus.toLowerCase().replace(/[_\s-]/g, ''); // normalize separators

        // Map Bolna status to our internal status
        if (statusLower === 'ringing' || statusLower === 'calling') {
          normalizedStatus = 'ringing';
        }
        else if (statusLower === 'connected' || statusLower === 'answered' ||
          statusLower === 'inprogress' || statusLower === 'ongoing' ||
          statusLower === 'active' || statusLower === 'live') {
          normalizedStatus = 'in_progress';
        }
        else if (statusLower === 'calldisconnected' || statusLower === 'disconnected' ||
          statusLower === 'ended' || statusLower === 'completed' ||
          statusLower === 'hangup') {
          normalizedStatus = 'completed';
        }
        else if (statusLower === 'failed' || statusLower === 'noanswer' ||
          statusLower === 'notconnected' || statusLower === 'busy' ||
          statusLower === 'declined' || statusLower === 'unreachable' ||
          statusLower === 'error' || statusLower === 'timeout') {
          normalizedStatus = 'failed';
        }
        else if (statusLower === 'voicemail' || statusLower === 'vm') {
          // Treat voicemail as completed (call went through to voicemail)
          normalizedStatus = 'completed';
          isVoicemail = true;
        }
        else if (statusLower === 'cancelled' || statusLower === 'canceled') {
          normalizedStatus = 'cancelled';
        }
        else if (statusLower === 'initiated' || statusLower === 'queued') {
          normalizedStatus = 'initiated';
        }

        console.log(`[Bolna Webhook] Status mapped: ${bolnaStatus} -> ${normalizedStatus}${isVoicemail ? ' (voicemail)' : ''}`);
      }

      // If we have conversation_duration > 0, the call is completed
      if (callDuration && callDuration > 0) {
        normalizedStatus = 'completed';
        console.log(`[Bolna Webhook] Call completed with duration: ${callDuration}s`);
      }

      const updates: Partial<InsertCall> = {
        status: normalizedStatus,
      };

      // Only update duration if we have a new value and it's greater than current
      if (callDuration !== undefined && callDuration > 0) {
        if (!call.duration || callDuration > call.duration) {
          updates.duration = callDuration;
        }
      }

      // Only update transcription if we have new content
      if (transcript && transcript.length > 0 && !call.transcription) {
        updates.transcription = transcript;
      }

      // Only update recording URL if we have a new URL
      const newRecordingUrl = telephony_data?.recording_url || recording_url;
      if (newRecordingUrl && !call.recordingUrl) {
        updates.recordingUrl = newRecordingUrl;
      }

      // Only set endedAt if call is truly ending and we haven't already set it
      if (
        (normalizedStatus === 'completed' || normalizedStatus === 'failed' || normalizedStatus === 'cancelled') &&
        !call.endedAt
      ) {
        updates.endedAt = new Date();
      }

      // Add Bolna cost information if available and not already set
      if (total_cost !== undefined && !call.bolnaCostPerMinute) {
        updates.bolnaCostPerMinute = Number(total_cost);
        console.log(`[Bolna Webhook] 💰 Cost data received: $${total_cost}`);
      }

      // Log what data was received for debugging
      console.log(`[Bolna Webhook] 📊 Data received:`);
      console.log(`   - Status: ${bolnaStatus} -> ${normalizedStatus}`);
      console.log(`   - Duration: ${callDuration || 'not yet'} seconds`);
      console.log(`   - Transcription: ${transcript ? 'YES (' + transcript.length + ' chars)' : 'NO'}`);
      console.log(`   - Recording URL: ${updates.recordingUrl ? 'YES' : 'NO'}`);
      console.log(`   - Cost: ${total_cost !== undefined ? '$' + total_cost : 'not provided'}`);

      // Store additional metadata if provided
      if (call_details || metadata || isVoicemail) {
        updates.metadata = {
          ...(call.metadata as any || {}),
          ...(isVoicemail && { isVoicemail: true, originalStatus: bolnaStatus }),
          call_details,
          bolna_metadata: metadata,
        };
      }

      console.log(`[Bolna Webhook] Updating call with:`, JSON.stringify(updates, null, 2));

      const updatedCall = await storage.updateCall(call.id, call.organizationId, updates);

      console.log(`[Bolna Webhook] ✅ Call updated successfully`);
      console.log(`[Bolna Webhook] Checking emitters - emitCallUpdate:`, typeof (app as any).emitCallUpdate);
      console.log(`[Bolna Webhook] Checking emitters - emitMetricsUpdate:`, typeof (app as any).emitMetricsUpdate);

      // Emit real-time updates
      if ((app as any).emitCallUpdate && updatedCall) {
        console.log(`[Bolna Webhook] 🚀 Emitting call:updated to org:${call.organizationId}`);
        (app as any).emitCallUpdate(call.organizationId, updatedCall);
      } else {
        console.warn('[Bolna Webhook] ⚠️ emitCallUpdate not available or call not updated');
      }

      // Emit metrics update for dashboard
      if ((app as any).emitMetricsUpdate) {
        console.log(`[Bolna Webhook] 📊 Fetching and emitting metrics update`);
        const metrics = await storage.getDashboardMetrics(call.organizationId);
        (app as any).emitMetricsUpdate(call.organizationId, metrics);
        console.log(`[Bolna Webhook] ✅ Metrics emitted`);
      }

      // AI-based lead status update after call completion
      if ((normalizedStatus === 'completed' || normalizedStatus === 'failed') && call.leadId) {
        console.log(`[Bolna Webhook] 🤖 Updating lead ${call.leadId} based on call outcome`);

        try {
          const lead = await storage.getLead(call.leadId, call.organizationId);
          if (lead) {
            let newLeadStatus = lead.status;
            let aiSummary = lead.aiSummary || '';

            // Analyze call outcome
            if (normalizedStatus === 'completed' && transcript && transcript.length > 100) {
              // Use AI to analyze the transcript and determine lead status
              try {
                const analysisPrompt = `Analyze this call transcript and determine the lead status:
                
Transcript: ${transcript.substring(0, 2000)}

Based on the conversation, categorize the lead as one of:
- qualified: Customer showed interest, asked questions, discussed pricing/features
- converted: Customer agreed to purchase, scheduled meeting, or expressed strong intent
- lost: Customer declined, not interested, or explicitly rejected
- contacted: Call happened but outcome unclear, need follow-up

Respond with ONLY one of these words: qualified, converted, lost, or contacted`;

                // Call OpenAI for analysis
                const statusAnalysis = await generateAISummary(analysisPrompt);
                const analyzedStatus = statusAnalysis.toLowerCase().trim();

                if (['qualified', 'converted', 'lost', 'contacted'].includes(analyzedStatus)) {
                  newLeadStatus = analyzedStatus;
                }

                // Generate conversation summary
                const summaryPrompt = `Summarize this sales call in 2-3 sentences. Focus on: customer's interest level, key discussion points, and next steps.

Transcript: ${transcript.substring(0, 2000)}`;

                const conversationSummary = await generateAISummary(summaryPrompt);
                aiSummary = conversationSummary;

                console.log(`[Bolna Webhook] AI analyzed lead status: ${lead.status} -> ${newLeadStatus}`);
              } catch (aiError) {
                console.error(`[Bolna Webhook] AI analysis failed:`, (aiError as Error).message);
                // Fallback: mark as contacted if call completed
                newLeadStatus = 'contacted';
              }
            } else if (normalizedStatus === 'failed' || isVoicemail) {
              // Call failed or went to voicemail - keep current status, add note
              aiSummary = (aiSummary || '') + `\n[${new Date().toISOString()}]: ${isVoicemail ? 'Voicemail reached' : 'Call failed to connect'}`;
            } else if (normalizedStatus === 'completed' && (!transcript || transcript.length < 100)) {
              // Short call - likely no answer or quick disconnect
              aiSummary = (aiSummary || '') + `\n[${new Date().toISOString()}]: Brief call (${callDuration || 0}s) - may need follow-up`;
              newLeadStatus = 'contacted';
            }

            // Update lead with new status and AI summary
            const leadUpdates: any = {
              lastContactedAt: new Date(),
              totalCalls: (lead.totalCalls || 0) + 1,
            };

            if (newLeadStatus !== lead.status) {
              leadUpdates.status = newLeadStatus;
            }

            if (aiSummary && aiSummary !== lead.aiSummary) {
              leadUpdates.aiSummary = aiSummary;
            }

            // Add call notes
            leadUpdates.notes = (lead.notes || '') + `\n[Call ${new Date().toISOString()}]: ${normalizedStatus}${callDuration ? ` (${callDuration}s)` : ''}`;

            await storage.updateLead(call.leadId, call.organizationId, leadUpdates);

            console.log(`[Bolna Webhook] ✅ Lead ${call.leadId} updated: status=${newLeadStatus}`);

            // Emit lead update
            if ((app as any).emitLeadUpdate) {
              (app as any).emitLeadUpdate(call.organizationId, { ...lead, ...leadUpdates });
            }
          }
        } catch (leadError) {
          console.error(`[Bolna Webhook] Failed to update lead:`, (leadError as Error).message);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Bolna webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Exotel webhook - deprecated, using Plivo through Bolna only
  app.post('/api/webhooks/exotel/call-status', async (req, res) => {
    console.log('[Exotel Webhook] Deprecated - using Plivo through Bolna only');
    res.json({ received: true, deprecated: true });
  });

  // Call History routes
  app.get('/api/calls', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const calls = await storage.getCalls(user.organizationId);

      // Validate response: ensure all calls belong to user's organization (defensive)
      const validCalls = calls.filter(call => call.organizationId === user.organizationId);
      if (validCalls.length !== calls.length) {
        console.error("WARNING: Storage returned cross-tenant calls data");
      }

      res.json(validCalls);
    } catch (error) {
      console.error("Error fetching calls:", error);
      res.status(500).json({ message: "Failed to fetch calls" });
    }
  });

  app.get('/api/calls/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const call = await storage.getCall(req.params.id, user.organizationId);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      // Validate response: ensure call belongs to user's organization (defensive)
      if (call.organizationId !== user.organizationId) {
        console.error("WARNING: Storage returned cross-tenant call data");
        return res.status(404).json({ message: "Call not found" });
      }

      res.json(call);
    } catch (error) {
      console.error("Error fetching call:", error);
      res.status(500).json({ message: "Failed to fetch call" });
    }
  });

  // Get call transcript and recording from Bolna
  app.get('/api/calls/:id/bolna-details', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const call = await storage.getCall(req.params.id, user.organizationId);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      // Get details from Bolna if we have a bolnaCallId
      if (call.bolnaCallId) {
        const bolnaDetails = await bolnaClient.getCallDetails(call.bolnaCallId);
        res.json(bolnaDetails);
      } else {
        res.json({ message: "No Bolna call ID available" });
      }
    } catch (error) {
      console.error("Error fetching Bolna call details:", error);
      res.status(500).json({ message: "Failed to fetch call details from Bolna" });
    }
  });

  // Get polling statistics
  app.get('/api/calls/polling/stats', isAuthenticated, async (req: any, res) => {
    try {
      const stats = getPollingStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching polling stats:", error);
      res.status(500).json({ message: "Failed to fetch polling stats" });
    }
  });

  // Stop active call
  app.post('/api/calls/:id/stop', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const call = await storage.getCall(req.params.id, user.organizationId);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      // Stop polling if active
      if (call.bolnaCallId) {
        stopCallPolling(call.bolnaCallId);
      }

      // Stop the call in Bolna if it has a Bolna call ID
      if (call.bolnaCallId) {
        try {
          await bolnaClient.stopCall(call.bolnaCallId);
        } catch (bolnaError) {
          console.error("Error stopping Bolna call:", bolnaError);
        }
      }

      // Update call status in database
      const updatedCall = await storage.updateCall(req.params.id, user.organizationId, {
        status: 'cancelled',
        endedAt: new Date(),
      });

      // Emit real-time update
      if ((app as any).emitCallUpdate && updatedCall) {
        (app as any).emitCallUpdate(user.organizationId, updatedCall);
      }

      res.json({ success: true, call: updatedCall });
    } catch (error) {
      console.error("Error stopping call:", error);
      res.status(500).json({ message: "Failed to stop call" });
    }
  });

  // Bolna API routes - Voice & Model configuration
  app.get('/api/bolna/voices', isAuthenticated, async (req: any, res) => {
    try {
      const provider = req.query.provider as string | undefined;
      let voices = await bolnaClient.getAvailableVoices();

      // Filter by provider if specified (and not "all")
      if (provider && provider !== 'all') {
        voices = voices.filter(voice =>
          voice.provider?.toLowerCase() === provider.toLowerCase()
        );
      }

      res.json(voices);
    } catch (error) {
      console.error("Error fetching Bolna voices:", error);
      res.status(500).json({ message: "Failed to fetch available voices", error: (error as Error).message });
    }
  });

  app.get('/api/bolna/models', isAuthenticated, async (req: any, res) => {
    try {
      const models = await bolnaClient.getAvailableModels();
      res.json(models);
    } catch (error) {
      console.error("Error fetching Bolna models:", error);
      res.status(500).json({ message: "Failed to fetch available AI models", error: (error as Error).message });
    }
  });

  // Knowledge Base Management Routes
  // Create/Upload knowledge base to Bolna and sync to platform
  app.post('/api/knowledge-base/upload-to-bolna', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const { agentId, title, category, description } = req.body;
      const user = req.user;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Accept .pdf, .txt, .doc, .docx
      const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
      let pdfBuffer = null;
      let pdfFileName = req.file.originalname;
      let pdfSize = req.file.size;
      let converted = false;

      if (req.file.mimetype === 'application/pdf' || ext === 'pdf') {
        pdfBuffer = req.file.buffer;
      } else if (ext === 'txt') {
        // Convert text to PDF
        const { textToPdfBuffer } = require('./utils/fileToPdf');
        pdfBuffer = await textToPdfBuffer(req.file.buffer);
        pdfFileName = req.file.originalname.replace(/\.[^.]+$/, '') + '.pdf';
        pdfSize = pdfBuffer.length;
        converted = true;
      } else if (ext === 'doc' || ext === 'docx') {
        // Convert doc/docx to PDF
        const { docxToPdfBuffer } = require('./utils/fileToPdf');
        pdfBuffer = await docxToPdfBuffer(req.file.buffer);
        pdfFileName = req.file.originalname.replace(/\.[^.]+$/, '') + '.pdf';
        pdfSize = pdfBuffer.length;
        converted = true;
      } else {
        return res.status(400).json({
          message: "Unsupported file type. Only PDF, TXT, DOC, DOCX are accepted.",
          acceptedFormats: ["PDF", "TXT", "DOC", "DOCX"],
          uploadedFormat: req.file.mimetype
        });
      }

      console.log(`[KB Upload] Uploading ${pdfFileName} to Bolna for agent ${agentId}`);

      // Prepare file object for Bolna upload
      const fileForBolna = {
        ...req.file,
        buffer: pdfBuffer,
        originalname: pdfFileName,
        mimetype: 'application/pdf',
        size: pdfSize,
      };

      // Upload to Bolna
      const bolnaKB = await bolnaClient.createKnowledgeBase(fileForBolna, {
        fileName: pdfFileName,
        chunk_size: 512,
        similarity_top_k: 5,
        overlapping: 20,
      });

      console.log(`[KB Upload] ✅ Bolna KB created with ID: ${bolnaKB.rag_id}`);

      // Store in platform database
      const kbEntry = await storage.createKnowledgeBase({
        organizationId: user.organizationId,
        agentId: agentId || undefined,
        title: title || pdfFileName,
        content: `PDF Document: ${pdfFileName}`,
        contentType: 'pdf',
        category: category || 'document',
        description: description || `Uploaded PDF: ${pdfFileName}` + (converted ? ' (converted from original)' : ''),
        fileUrl: req.file.filename || pdfFileName,
        bolnaKbId: bolnaKB.rag_id, // Store Bolna's knowledge base ID
        status: 'active',
        tags: ['bolna', 'pdf', 'knowledge-base'],
        metadata: {
          bolnaRagId: bolnaKB.rag_id,
          uploadedAt: new Date().toISOString(),
          fileName: pdfFileName,
          fileSize: pdfSize,
          originalFileName: req.file.originalname,
          originalMimeType: req.file.mimetype,
        }
      } as any);

      // Update agent with knowledge base ID
      if (agentId && bolnaKB.rag_id) {
        const agent = await storage.getAIAgent(agentId, user.organizationId);
        if (agent) {
          const existingKBIds = agent.knowledgeBaseIds || [];
          const updatedKBIds = Array.from(new Set([...existingKBIds, bolnaKB.rag_id]));

          await storage.updateAIAgent(agentId, user.organizationId, {
            knowledgeBaseIds: updatedKBIds,
          });

          console.log(`[KB Upload] ✅ Agent ${agentId} updated with KB: ${bolnaKB.rag_id}`);
        }
      }

      res.json({
        success: true,
        message: "Knowledge base uploaded successfully to Bolna",
        platformEntry: kbEntry,
        bolnaKnowledgeBase: bolnaKB,
      });
    } catch (error) {
      console.error("Error uploading knowledge base to Bolna:", error);
      res.status(500).json({
        message: "Failed to upload knowledge base",
        error: (error as Error).message
      });
    }
  });

  // Bulk upload multiple PDFs to knowledge base
  app.post('/api/knowledge-base/upload-batch', isAuthenticated, upload.array('files', 10), async (req: any, res) => {
    try {
      const { agentId, category, description } = req.body;
      const user = req.user;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      console.log(`[KB Batch Upload] Uploading ${req.files.length} files to Bolna for agent ${agentId}`);

      const results = [];
      const errors = [];

      for (const file of req.files) {
        try {
          // Validate each file is PDF
          if (file.mimetype !== 'application/pdf') {
            errors.push({
              fileName: file.originalname,
              error: `Only PDF files accepted. Got ${file.mimetype}`
            });
            continue;
          }

          // Upload to Bolna
          const bolnaKB = await bolnaClient.createKnowledgeBase(file, {
            fileName: file.originalname,
            chunk_size: 512,
            similarity_top_k: 5,
            overlapping: 20,
          });

          // Store in platform database
          const kbEntry = await storage.createKnowledgeBase({
            organizationId: user.organizationId,
            agentId: agentId || undefined,
            title: file.originalname,
            content: `PDF Document: ${file.originalname}`,
            contentType: 'pdf',
            category: category || 'document',
            description: description || `Bulk uploaded PDF: ${file.originalname}`,
            fileUrl: file.filename || file.originalname,
            bolnaKbId: bolnaKB.rag_id,
            status: 'active',
            tags: ['bolna', 'pdf', 'knowledge-base', 'batch-upload'],
            metadata: {
              bolnaRagId: bolnaKB.rag_id,
              uploadedAt: new Date().toISOString(),
              fileName: file.originalname,
              fileSize: file.size,
            } as any
          });

          results.push({
            fileName: file.originalname,
            success: true,
            platformId: kbEntry.id,
            bolnaRagId: bolnaKB.rag_id,
          });
        } catch (err) {
          errors.push({
            fileName: file.originalname,
            error: (err as Error).message
          });
        }
      }

      // Update agent with all knowledge base IDs
      if (agentId && results.length > 0) {
        const agent = await storage.getAIAgent(agentId, user.organizationId);
        if (agent) {
          const newKBIds = results.map(r => r.bolnaRagId);
          const existingKBIds = agent.knowledgeBaseIds || [];
          const updatedKBIds = Array.from(new Set([...existingKBIds, ...newKBIds]));

          await storage.updateAIAgent(agentId, user.organizationId, {
            knowledgeBaseIds: updatedKBIds,
          });
        }
      }

      res.json({
        success: true,
        message: `Uploaded ${results.length} knowledge bases. ${errors.length} failed.`,
        uploaded: results,
        failed: errors,
      });
    } catch (error) {
      console.error("Error bulk uploading knowledge bases:", error);
      res.status(500).json({
        message: "Failed to bulk upload knowledge bases",
        error: (error as Error).message
      });
    }
  });

  // Get all knowledge bases for organization/agent
  app.get('/api/knowledge-base', isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.query;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let kbs;
      if (agentId) {
        kbs = await storage.getKnowledgeBaseByAgent(agentId as string, user.organizationId);
      } else {
        kbs = await storage.getKnowledgeBase(user.organizationId);
      }

      res.json(kbs);
    } catch (error) {
      console.error("Error fetching knowledge bases:", error);
      res.status(500).json({ message: "Failed to fetch knowledge bases", error: (error as Error).message });
    }
  });

  // Get knowledge base details
  app.get('/api/knowledge-base/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const kb = await storage.getKnowledgeBaseItem(req.params.id, user.organizationId);

      if (!kb) {
        return res.status(404).json({ message: "Knowledge base not found" });
      }

      res.json(kb);
    } catch (error) {
      console.error("Error fetching knowledge base:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base", error: (error as Error).message });
    }
  });

  // Update knowledge base
  app.patch('/api/knowledge-base/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { title, description, category, tags, status } = req.body;

      const updates: Partial<InsertKnowledgeBase> = {};
      if (title) updates.title = title;
      if (description) updates.description = description;
      if (category) updates.category = category;
      if (tags) updates.tags = tags;
      if (status) updates.status = status;

      const result = await storage.updateKnowledgeBase(req.params.id, req.user.organizationId, updates);

      if (!result) {
        return res.status(404).json({ message: "Knowledge base not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error updating knowledge base:", error);
      res.status(500).json({ message: "Failed to update knowledge base", error: (error as Error).message });
    }
  });

  // Delete knowledge base
  app.delete('/api/knowledge-base/:id', isAuthenticated, async (req: any, res) => {
    try {
      const kb = await storage.getKnowledgeBaseItem(req.params.id, req.user.organizationId);

      if (!kb) {
        return res.status(404).json({ message: "Knowledge base not found" });
      }

      await storage.deleteKnowledgeBase(req.params.id, req.user.organizationId);

      res.json({ message: "Knowledge base deleted successfully" });
    } catch (error) {
      console.error("Error deleting knowledge base:", error);
      res.status(500).json({ message: "Failed to delete knowledge base", error: (error as Error).message });
    }
  });

  // Sync agent's knowledge bases to Bolna
  app.post('/api/knowledge-base/agent/:agentId/sync-to-bolna', isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const agent = await storage.getAIAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Get all knowledge bases for this agent
      const kbs = await storage.getKnowledgeBaseByAgent(agentId, user.organizationId);

      if (kbs.length === 0) {
        return res.json({
          message: "No knowledge bases found for this agent",
          synced: [],
          failed: [],
          total: 0
        });
      }

      const synced = [];
      const failed = [];

      // Note: Bolna requires actual PDF files, not just text content
      // So we can only sync knowledge bases that have file URLs
      for (const kb of kbs) {
        if (!kb.fileUrl || kb.contentType !== 'pdf') {
          failed.push({
            kbId: kb.id,
            title: kb.title,
            reason: 'Bolna only supports PDF files. Please upload PDF documents.'
          });
          continue;
        }

        try {
          // Verify the knowledge base exists in Bolna
          let bolnaRagId = kb.bolnaKbId;
          if (!bolnaRagId) {
            // If no external ID, try to get from metadata
            const metadata = (kb.metadata || {}) as Record<string, any>;
            bolnaRagId = metadata.bolnaRagId;
          }

          if (bolnaRagId) {
            const bolnaKb = await bolnaClient.getKnowledgeBase(bolnaRagId);
            synced.push({
              kbId: kb.id,
              title: kb.title,
              fileUrl: kb.fileUrl,
              bolnaRagId,
              status: 'synced'
            });
          } else {
            failed.push({
              kbId: kb.id,
              title: kb.title,
              reason: 'No Bolna RAG ID found. Please re-upload the document.'
            });
          }
        } catch (err) {
          failed.push({
            kbId: kb.id,
            title: kb.title,
            reason: (err as Error).message
          });
        }
      }

      // Update agent's knowledge base IDs in Bolna
      const syncedRagIds = synced.map(s => s.bolnaRagId);
      if (syncedRagIds.length > 0) {
        await storage.updateAIAgent(agentId, user.organizationId, {
          knowledgeBaseIds: syncedRagIds,
        });
      }

      res.json({
        message: "Knowledge base sync complete",
        agentId,
        total: kbs.length,
        synced,
        failed,
      });
    } catch (error) {
      console.error("Error syncing knowledge bases to Bolna:", error);
      res.status(500).json({
        message: "Failed to sync knowledge bases",
        error: (error as Error).message
      });
    }
  });

  // Bolna Knowledge Base routes (existing endpoints)
  app.get('/api/bolna/knowledge-bases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get all Bolna knowledge bases
      const allBolnaKBs = await bolnaClient.listKnowledgeBases();
      
      // Get local knowledge base entries for this organization to filter
      const localKBs = await storage.getKnowledgeBase(user.organizationId);
      
      // Find local entries that are linked to Bolna (sourceUrl starts with 'bolna:')
      const bolnaRagIds = new Set<string>();
      for (const kb of localKBs) {
        if (kb.sourceUrl?.startsWith('bolna:')) {
          const ragId = kb.sourceUrl.replace('bolna:', '');
          bolnaRagIds.add(ragId);
        }
      }
      
      // If no local entries linked to Bolna, return empty array (show all for backwards compatibility)
      // This means the org hasn't created any Bolna KBs through our platform yet
      // For now, show all if no mappings exist (for existing data)
      if (bolnaRagIds.size === 0) {
        // Return all Bolna KBs - this is for backwards compatibility
        // In the future, we should only show KBs created by this org
        res.json(allBolnaKBs);
        return;
      }
      
      // Filter to only show KBs created by this organization
      const filteredKBs = allBolnaKBs.filter(kb => bolnaRagIds.has(kb.rag_id));
      
      res.json(filteredKBs);
    } catch (error) {
      console.error("Error fetching Bolna knowledge bases:", error);
      res.status(500).json({ message: "Failed to fetch knowledge bases", error: (error as Error).message });
    }
  });

  app.get('/api/bolna/knowledge-bases/:ragId', isAuthenticated, async (req: any, res) => {
    try {
      const knowledgeBase = await bolnaClient.getKnowledgeBase(req.params.ragId);
      res.json(knowledgeBase);
    } catch (error) {
      console.error("Error fetching Bolna knowledge base:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base", error: (error as Error).message });
    }
  });

  app.post('/api/bolna/knowledge-bases', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validate file is PDF only
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({
          message: "Bolna only accepts PDF files. Please upload a PDF document."
        });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const options = {
        chunk_size: req.body.chunk_size ? parseInt(req.body.chunk_size) : 512,
        similarity_top_k: req.body.similarity_top_k ? parseInt(req.body.similarity_top_k) : 5,
        overlapping: req.body.overlapping ? parseInt(req.body.overlapping) : 20,
        fileName: req.file.originalname,
      };

      const bolnaKB = await bolnaClient.createKnowledgeBase(req.file, options);
      
      // Create a local knowledge base entry to track organization ownership
      try {
        await storage.createKnowledgeBase({
          organizationId: user.organizationId,
          title: bolnaKB.file_name || bolnaKB.name || req.file.originalname,
          content: `Bolna Knowledge Base: ${bolnaKB.rag_id}`,
          contentType: 'bolna_kb',
          category: 'bolna',
          description: `Synced with Bolna AI. RAG ID: ${bolnaKB.rag_id}`,
          sourceUrl: `bolna:${bolnaKB.rag_id}`,
          status: bolnaKB.status || 'processing',
        });
        console.log(`[Bolna KB] Created local entry for organization ${user.organizationId}, rag_id: ${bolnaKB.rag_id}`);
      } catch (localError) {
        console.warn(`[Bolna KB] Could not create local entry:`, (localError as Error).message);
        // Don't fail the request - Bolna KB was created successfully
      }
      
      res.json(bolnaKB);
    } catch (error) {
      console.error("Error creating Bolna knowledge base:", error);
      res.status(500).json({ message: "Failed to create knowledge base", error: (error as Error).message });
    }
  });

  // Delete Bolna Knowledge Base
  app.delete('/api/bolna/knowledge-bases/:ragId', isAuthenticated, async (req: any, res) => {
    try {
      const { ragId } = req.params;
      console.log(`[Bolna KB] Deleting knowledge base: ${ragId}`);
      
      const result = await bolnaClient.deleteKnowledgeBase(ragId);
      
      // Also remove from any agents that have this KB linked
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (user) {
        const agents = await storage.getAIAgents(user.organizationId);
        for (const agent of agents) {
          if (agent.knowledgeBaseIds?.includes(ragId)) {
            const updatedIds = agent.knowledgeBaseIds.filter((id: string) => id !== ragId);
            await storage.updateAIAgent(agent.id, user.organizationId, {
              knowledgeBaseIds: updatedIds,
            });
            console.log(`[Bolna KB] Removed KB ${ragId} from agent ${agent.id}`);
          }
        }
        
        // Also delete the local knowledge base entry
        try {
          const localKBs = await storage.getKnowledgeBase(user.organizationId);
          const matchingKB = localKBs.find(kb => kb.sourceUrl === `bolna:${ragId}`);
          if (matchingKB) {
            await storage.deleteKnowledgeBase(matchingKB.id, user.organizationId);
            console.log(`[Bolna KB] Deleted local entry for rag_id: ${ragId}`);
          }
        } catch (localError) {
          console.warn(`[Bolna KB] Could not delete local entry:`, (localError as Error).message);
        }
      }
      
      res.json({
        success: true,
        message: "Knowledge base deleted successfully",
        ...result,
      });
    } catch (error) {
      console.error("Error deleting Bolna knowledge base:", error);
      res.status(500).json({ message: "Failed to delete knowledge base", error: (error as Error).message });
    }
  });

  // Attach Knowledge Base to Agent (Bolna + Local)
  app.post('/api/bolna/knowledge-bases/:ragId/attach/:agentId', isAuthenticated, async (req: any, res) => {
    try {
      const { ragId, agentId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the agent
      const agent = await storage.getAIAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      console.log(`[Bolna KB] Attaching KB ${ragId} to agent ${agentId}`);

      // Attach to Bolna agent if it has a bolnaAgentId
      if (agent.bolnaAgentId) {
        try {
          await bolnaClient.attachKnowledgeBaseToAgent(agent.bolnaAgentId, ragId);
        } catch (bolnaError) {
          console.warn(`[Bolna KB] Could not attach to Bolna agent: ${(bolnaError as Error).message}`);
        }
      }

      // Update local agent's knowledgeBaseIds
      const existingIds = agent.knowledgeBaseIds || [];
      if (!existingIds.includes(ragId)) {
        await storage.updateAIAgent(agentId, user.organizationId, {
          knowledgeBaseIds: [...existingIds, ragId],
        });
      }

      res.json({
        success: true,
        message: "Knowledge base attached to agent",
        agentId,
        ragId,
        knowledgeBaseIds: [...existingIds, ragId],
      });
    } catch (error) {
      console.error("Error attaching knowledge base to agent:", error);
      res.status(500).json({ message: "Failed to attach knowledge base", error: (error as Error).message });
    }
  });

  // Detach Knowledge Base from Agent (Bolna + Local)
  app.post('/api/bolna/knowledge-bases/:ragId/detach/:agentId', isAuthenticated, async (req: any, res) => {
    try {
      const { ragId, agentId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the agent
      const agent = await storage.getAIAgent(agentId, user.organizationId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      console.log(`[Bolna KB] Detaching KB ${ragId} from agent ${agentId}`);

      // Detach from Bolna agent if it has a bolnaAgentId
      if (agent.bolnaAgentId) {
        try {
          await bolnaClient.detachKnowledgeBaseFromAgent(agent.bolnaAgentId, ragId);
        } catch (bolnaError) {
          console.warn(`[Bolna KB] Could not detach from Bolna agent: ${(bolnaError as Error).message}`);
        }
      }

      // Update local agent's knowledgeBaseIds
      const existingIds = agent.knowledgeBaseIds || [];
      const updatedIds = existingIds.filter((id: string) => id !== ragId);
      await storage.updateAIAgent(agentId, user.organizationId, {
        knowledgeBaseIds: updatedIds,
      });

      res.json({
        success: true,
        message: "Knowledge base detached from agent",
        agentId,
        ragId,
        knowledgeBaseIds: updatedIds,
      });
    } catch (error) {
      console.error("Error detaching knowledge base from agent:", error);
      res.status(500).json({ message: "Failed to detach knowledge base", error: (error as Error).message });
    }
  });

  // Bolna Inbound Setup
  app.post('/api/bolna/inbound/setup', isAuthenticated, async (req: any, res) => {
    try {
      const { agentId, phoneNumberId } = req.body;
      const organizationId = req.user.organizationId;

      if (!agentId || !phoneNumberId) {
        return res.status(400).json({ message: "agentId and phoneNumberId are required" });
      }

      // Call Bolna API to setup inbound
      const result = await bolnaClient.setupInboundCall(agentId, phoneNumberId);

      // Find the local agent by bolnaAgentId and update assignedPhoneNumberId
      const agents = await storage.getAIAgents(organizationId);
      const localAgent = agents.find(a => a.bolnaAgentId === agentId);

      if (localAgent) {
        // Find the phone number record by phone number string or ID
        const phoneNumberRecords = await storage.getPhoneNumbers(organizationId);
        const phone = phoneNumberRecords.find(p =>
          p.phoneNumber === phoneNumberId ||
          p.id === phoneNumberId ||
          p.exotelSid === phoneNumberId
        );

        if (phone) {
          // Update the agent with the phone number assignment
          await storage.updateAIAgent(localAgent.id, organizationId, {
            assignedPhoneNumberId: phone.id
          });

          // Also update the phone number's assigned agent
          await storage.updatePhoneNumber(phone.id, organizationId, {
            assignedAgentId: localAgent.id
          });

          console.log(`[Inbound Setup] Linked agent ${localAgent.id} to phone ${phone.phoneNumber}`);
        }
      }

      res.json({ ...result, success: true });
    } catch (error) {
      console.error("Error setting up inbound call:", error);
      res.status(500).json({ message: "Failed to setup inbound call", error: (error as Error).message });
    }
  });

  // Bolna Inbound Unlink - Remove agent from inbound calls
  app.post('/api/bolna/inbound/unlink', isAuthenticated, async (req: any, res) => {
    try {
      const { phoneNumberId } = req.body;
      const organizationId = req.user.organizationId;

      if (!phoneNumberId) {
        return res.status(400).json({ message: "phoneNumberId is required" });
      }

      // Call Bolna API to unlink inbound
      const result = await bolnaClient.unlinkInboundCall(phoneNumberId);

      // Find the phone number record by phone number string or ID
      const phoneNumberRecords = await storage.getPhoneNumbers(organizationId);
      const phone = phoneNumberRecords.find(p =>
        p.phoneNumber === phoneNumberId ||
        p.id === phoneNumberId ||
        p.exotelSid === phoneNumberId
      );

      if (phone && phone.assignedAgentId) {
        const agentIdToUpdate = phone.assignedAgentId;

        // Clear the agent's assigned phone number
        await storage.updateAIAgent(agentIdToUpdate, organizationId, {
          assignedPhoneNumberId: null
        });

        // Clear the phone number's assigned agent
        await storage.updatePhoneNumber(phone.id, organizationId, {
          assignedAgentId: null
        });

        console.log(`[Inbound Unlink] Unlinked agent ${agentIdToUpdate} from phone ${phone.phoneNumber}`);
      }

      res.json({ ...result, success: true });
    } catch (error) {
      console.error("Error unlinking inbound call:", error);
      res.status(500).json({ message: "Failed to unlink inbound call", error: (error as Error).message });
    }
  });

  // Bolna Call Management
  app.post('/api/bolna/agents/:agentId/stop', isAuthenticated, async (req: any, res) => {
    try {
      const result = await bolnaClient.stopAgentCalls(req.params.agentId);
      res.json(result);
    } catch (error) {
      console.error("Error stopping agent calls:", error);
      res.status(500).json({ message: "Failed to stop agent calls", error: (error as Error).message });
    }
  });

  app.post('/api/bolna/calls/:executionId/stop', isAuthenticated, async (req: any, res) => {
    try {
      const result = await bolnaClient.stopCall(req.params.executionId);
      res.json(result);
    } catch (error) {
      console.error("Error stopping call:", error);
      res.status(500).json({ message: "Failed to stop call", error: (error as Error).message });
    }
  });

  app.get('/api/bolna/agents/:agentId/executions/:executionId', isAuthenticated, async (req: any, res) => {
    try {
      const result = await bolnaClient.getAgentExecution(req.params.agentId, req.params.executionId);
      res.json(result);
    } catch (error) {
      console.error("Error fetching agent execution:", error);
      res.status(500).json({ message: "Failed to fetch agent execution", error: (error as Error).message });
    }
  });

  // Exotel API routes - DEPRECATED (using Plivo through Bolna only)
  // All Exotel routes return deprecated message
  app.all('/api/exotel/*', isAuthenticated, async (req: any, res) => {
    res.status(410).json({
      message: "Exotel integration deprecated - using Plivo through Bolna only",
      deprecated: true
    });
  });

  // Knowledge Base routes
  app.get('/api/knowledge-base', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const knowledge = await storage.getKnowledgeBase(user.organizationId);

      // Defensive validation
      const validKnowledge = knowledge.filter(k => k.organizationId === user.organizationId);
      if (validKnowledge.length !== knowledge.length) {
        console.error("WARNING: Storage returned cross-tenant knowledge base data");
      }

      res.json(validKnowledge);
    } catch (error) {
      console.error("Error fetching knowledge base:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base" });
    }
  });

  app.get('/api/knowledge-base/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const item = await storage.getKnowledgeBaseItem(req.params.id, user.organizationId);
      if (!item) {
        return res.status(404).json({ message: "Knowledge base item not found" });
      }

      // Defensive validation
      if (item.organizationId !== user.organizationId) {
        console.error("WARNING: Storage returned cross-tenant knowledge base item");
        return res.status(404).json({ message: "Knowledge base item not found" });
      }

      res.json(item);
    } catch (error) {
      console.error("Error fetching knowledge base item:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base item" });
    }
  });

  app.post('/api/knowledge-base', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate using schema
      const clientData: CreateKnowledgeBaseInput = createKnowledgeBaseSchema.parse(req.body);

      // Transform null values to undefined for database compatibility
      const sanitizedData = Object.fromEntries(
        Object.entries(clientData).map(([key, value]) => [key, value === null ? undefined : value])
      );

      // Server-side: inject organizationId from authenticated user
      const knowledgeData: InsertKnowledgeBase = {
        ...sanitizedData,
        organizationId: user.organizationId,
      } as InsertKnowledgeBase;

      let item: any;

      // If content is provided and contentType is text/markdown/json, upload to Bolna
      if (knowledgeData.content && ['text', 'markdown', 'json'].includes(knowledgeData.contentType || 'text')) {
        try {
          console.log(`[KB Create] Uploading text-based KB to Bolna: ${knowledgeData.title}`);

          // Create a text document from the knowledge base content
          const textContent = `
${knowledgeData.title || 'Knowledge Base Document'}
${'='.repeat((knowledgeData.title || '').length + 25)}

${knowledgeData.description ? `Description: ${knowledgeData.description}\n\n` : ''}
${knowledgeData.category ? `Category: ${knowledgeData.category}\n\n` : ''}

Content:
--------
${knowledgeData.content}

${knowledgeData.tags?.length ? `\nTags: ${knowledgeData.tags.join(', ')}` : ''}
`;

          // Convert text to PDF buffer
          let PDFDocument;
          try {
            const pdfkitModule = await import('pdfkit');
            PDFDocument = pdfkitModule.default || pdfkitModule;
          } catch (e) {
            console.error('[KB Create] Failed to load pdfkit:', e);
            throw new Error('PDF generation failed: pdfkit not found');
          }

          if (!PDFDocument) {
            throw new Error('PDF generation failed: pdfkit constructor not found');
          }

          // @ts-ignore
          // const PDFDocument = (await import('pdfkit')).default;
          const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
            const doc = new PDFDocument();
            const chunks: Buffer[] = [];

            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Add content to PDF
            doc.fontSize(16).text(knowledgeData.title || 'Knowledge Base Document', { underline: true });
            doc.moveDown();
            doc.fontSize(12).text(textContent);
            doc.end();
          });

          // Upload to Bolna
          const bolnaKB = await bolnaClient.createKnowledgeBase(pdfBuffer, {
            fileName: `${(knowledgeData.title || 'kb').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            chunk_size: 512,
            similarity_top_k: 5,
            overlapping: 20,
          });

          console.log(`[KB Create] ✅ Bolna KB created with RAG ID: ${bolnaKB.rag_id}`);

          // Store with Bolna reference
          knowledgeData.bolnaKbId = bolnaKB.rag_id;
          (knowledgeData as any).metadata = {
            ...(knowledgeData.metadata as object || {}),
            bolnaRagId: bolnaKB.rag_id,
            uploadedToBolna: true,
            uploadedAt: new Date().toISOString(),
          };

          // Update agent if specified
          if (knowledgeData.agentId && bolnaKB.rag_id) {
            const agent = await storage.getAIAgent(knowledgeData.agentId, user.organizationId);
            if (agent) {
              const existingKBIds = agent.knowledgeBaseIds || [];
              const updatedKBIds = Array.from(new Set([...existingKBIds, bolnaKB.rag_id]));

              await storage.updateAIAgent(knowledgeData.agentId, user.organizationId, {
                knowledgeBaseIds: updatedKBIds,
              });

              console.log(`[KB Create] ✅ Agent ${knowledgeData.agentId} updated with KB: ${bolnaKB.rag_id}`);
            }
          }
        } catch (bolnaError) {
          console.error('[KB Create] Failed to upload to Bolna:', bolnaError);
          // Continue creating KB in platform even if Bolna upload fails
          (knowledgeData as any).metadata = {
            ...(knowledgeData.metadata as object || {}),
            bolnaUploadError: (bolnaError as Error).message,
            bolnaUploadAttempted: true,
            uploadedToBolna: false,
          };
        }
      }

      item = await storage.createKnowledgeBase(knowledgeData as any);
      res.json(item);
    } catch (error) {
      console.error("Error creating knowledge base item:", error);
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ message: "Invalid request data", errors: (error as any).issues });
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: `Failed to create knowledge base item: ${errorMessage}` });
    }
  });

  app.patch('/api/knowledge-base/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate using strict update schema that rejects organizationId
      const updateData: UpdateKnowledgeBaseInput = updateKnowledgeBaseSchema.parse(req.body);

      const item = await storage.updateKnowledgeBase(req.params.id, user.organizationId, updateData);
      if (!item) {
        return res.status(404).json({ message: "Knowledge base item not found" });
      }

      // --- Auto-link KB to agent if assigned and has Bolna RAG ID ---
      // Check if agentId and bolnaKbId (Bolna RAG ID) are present
      const agentId = item.agentId;
      const bolnaRagId = typeof item.bolnaKbId === 'string' ? item.bolnaKbId : null;
      if (agentId && bolnaRagId) {
        try {
          const agent = await storage.getAIAgent(agentId, user.organizationId);
          if (agent) {
            const existingKBIds = agent.knowledgeBaseIds || [];
            if (!existingKBIds.includes(bolnaRagId)) {
              const updatedKBIds = [...existingKBIds, bolnaRagId];
              await storage.updateAIAgent(agentId, user.organizationId, {
                knowledgeBaseIds: updatedKBIds,
              });
              console.log(`[KB Update] ✅ Agent ${agentId} updated with KB: ${bolnaRagId}`);
            }
          }
        } catch (err) {
          console.error(`[KB Update] Failed to update agent with KB: ${bolnaRagId}`, err);
        }
      }

      res.json(item);
    } catch (error) {
      console.error("Error updating knowledge base item:", error);
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ message: "Invalid request data", errors: (error as any).issues });
      }
      res.status(500).json({ message: "Failed to update knowledge base item" });
    }
  });

  // Sync/Resync knowledge base to Bolna
  app.post('/api/knowledge-base/:id/sync-to-bolna', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const kb = await storage.getKnowledgeBaseItem(req.params.id, user.organizationId);
      if (!kb) {
        return res.status(404).json({ message: "Knowledge base item not found" });
      }

      console.log(`[KB Sync] Syncing KB ${kb.id} to Bolna...`);

      // Prepare content
      const content = kb.content || kb.description || `Knowledge Base: ${kb.title}`;
      const title = kb.title || 'Untitled Knowledge Base';

      // Convert to PDF
      let PDFDocument;
      try {
        const pdfkitModule = await import('pdfkit');
        PDFDocument = pdfkitModule.default || pdfkitModule;
      } catch (e) {
        console.error('[KB Sync] Failed to load pdfkit:', e);
        throw new Error('PDF generation failed: pdfkit not found');
      }

      const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(20).text(title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(content, { align: 'left', lineGap: 5 });
        doc.end();
      });


      // Wrap buffer in a file-like object for Bolna API
      const fileObject = {
        buffer: pdfBuffer,
        originalname: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        mimetype: 'application/pdf',
        size: pdfBuffer.length
      };

      // Upload to Bolna
      const bolnaKB = await bolnaClient.createKnowledgeBase(fileObject, {
        fileName: fileObject.originalname,
        chunk_size: 512,
        similarity_top_k: 5,
        overlapping: 20,
      });

      console.log(`[KB Sync] ✅ Bolna KB created with RAG ID: ${bolnaKB.rag_id}`);

      // Update platform KB
      const updated = await storage.updateKnowledgeBase(req.params.id, user.organizationId, {
        bolnaKbId: bolnaKB.rag_id,
        metadata: {
          ...(kb.metadata as any || {}),
          bolnaRagId: bolnaKB.rag_id,
          syncedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
        }
      } as any);

      // Update agent if linked
      if (kb.agentId) {
        const agent = await storage.getAIAgent(kb.agentId, user.organizationId);
        if (agent) {
          const existingKBIds = agent.knowledgeBaseIds || [];
          if (!existingKBIds.includes(bolnaKB.rag_id)) {
            const updatedKBIds = [...existingKBIds, bolnaKB.rag_id];
            await storage.updateAIAgent(kb.agentId, user.organizationId, {
              knowledgeBaseIds: updatedKBIds,
            });
            console.log(`[KB Sync] ✅ Updated agent ${agent.name} with KB ID`);
          }
        }
      }

      res.json({
        success: true,
        message: "Knowledge base synced to Bolna successfully",
        knowledgeBase: updated,
        bolnaRagId: bolnaKB.rag_id,
      });
    } catch (error) {
      console.error("Error syncing knowledge base to Bolna:", error);
      res.status(500).json({
        message: "Failed to sync knowledge base to Bolna",
        error: (error as Error).message
      });
    }
  });

  app.delete('/api/knowledge-base/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const deleted = await storage.deleteKnowledgeBase(req.params.id, user.organizationId);
      if (!deleted) {
        return res.status(404).json({ message: "Knowledge base item not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting knowledge base item:", error);
      res.status(500).json({ message: "Failed to delete knowledge base item" });
    }
  });

  // Campaign routes
  app.get('/api/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const campaigns = await storage.getCampaigns(user.organizationId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get('/api/campaigns/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const campaign = await storage.getCampaign(req.params.id, user.organizationId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post('/api/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const campaignData: InsertCampaign = {
        ...req.body,
        organizationId: user.organizationId,
        createdBy: userId,
      };
      const campaign = await storage.createCampaign(campaignData);

      // Emit real-time update
      if ((app as any).emitCampaignCreated) {
        (app as any).emitCampaignCreated(user.organizationId, campaign);
      }

      res.json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.patch('/api/campaigns/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const campaign = await storage.updateCampaign(req.params.id, user.organizationId, req.body);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete('/api/campaigns/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const deleted = await storage.deleteCampaign(req.params.id, user.organizationId);
      if (!deleted) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // ==================== BATCH CALLING ROUTES ====================

  // Create a batch with CSV upload
  app.post('/api/batches', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { agent_id, from_phone_number, retry_config, campaign_id } = req.body;
      
      if (!agent_id) {
        return res.status(400).json({ message: "agent_id is required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }

      // Parse the uploaded CSV
      const csvContent = req.file.buffer.toString('utf-8');
      
      // Validate CSV has required columns (at least phone number)
      const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) {
        return res.status(400).json({ message: "Invalid CSV format", errors: parsed.errors });
      }

      const records = parsed.data as Record<string, string>[];
      if (records.length === 0) {
        return res.status(400).json({ message: "CSV file is empty" });
      }

      // Check for phone_number column (case-insensitive)
      const headers = Object.keys(records[0]);
      const headersLower = headers.map(h => h.toLowerCase());
      if (!headersLower.includes('phone_number') && !headersLower.includes('phone') && !headersLower.includes('recipient_phone_number')) {
        return res.status(400).json({ message: "CSV must contain a 'phone_number', 'phone', or 'recipient_phone_number' column" });
      }

      // Normalize CSV: Add contact_name column from various name fields
      // This allows the agent to use {{contact_name}} variable in prompts
      const normalizedRecords = records.map(record => {
        const normalizedRecord: Record<string, string> = {};
        
        // Find contact name from various possible column names
        let contactName = '';
        const nameFields = ['name', 'contact_name', 'contactname', 'first_name', 'firstname', 'full_name', 'fullname', 'customer_name', 'customername'];
        
        for (const [key, value] of Object.entries(record)) {
          const keyLower = key.toLowerCase().replace(/\s+/g, '_');
          
          // Check if this is a name field
          if (nameFields.includes(keyLower) && value && !contactName) {
            contactName = value;
          }
          
          // Also check for "first name" with space
          if (key.toLowerCase() === 'first name' && value && !contactName) {
            contactName = value;
          }
          
          // Normalize phone number column
          if (keyLower === 'phone' || keyLower === 'phone_number') {
            normalizedRecord['recipient_phone_number'] = value;
          } else {
            normalizedRecord[key] = value;
          }
        }
        
        // Add contact_name if found and not already present
        if (contactName && !normalizedRecord['contact_name']) {
          normalizedRecord['contact_name'] = contactName;
        }
        
        return normalizedRecord;
      });

      // Convert back to CSV
      const normalizedCsv = Papa.unparse(normalizedRecords);

      // Create batch in Bolna
      const retryConfigParsed = retry_config ? JSON.parse(retry_config) : undefined;
      
      const result = await bolnaClient.createBatch({
        agent_id,
        csvContent: normalizedCsv,
        from_phone_number,
        retry_config: retryConfigParsed,
      });

      // Store batch reference in our database (update campaign if provided)
      if (campaign_id) {
        await storage.updateCampaign(campaign_id, user.organizationId, {
          status: 'active',
          totalLeads: records.length,
        });
      }

      console.log(`[Batch] Created batch ${result.batch_id} for agent ${agent_id} with ${records.length} contacts`);
      
      res.json({
        batch_id: result.batch_id,
        state: result.state,
        total_contacts: records.length,
        campaign_id,
      });
    } catch (error: any) {
      console.error("Error creating batch:", error);
      res.status(500).json({ message: error.message || "Failed to create batch" });
    }
  });

  // Get batch details
  app.get('/api/batches/:batchId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const batch = await bolnaClient.getBatch(req.params.batchId);
      res.json(batch);
    } catch (error: any) {
      console.error("Error fetching batch:", error);
      res.status(500).json({ message: error.message || "Failed to fetch batch" });
    }
  });

  // Schedule a batch
  app.post('/api/batches/:batchId/schedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { scheduled_at, bypass_call_guardrails } = req.body;
      
      if (!scheduled_at) {
        return res.status(400).json({ message: "scheduled_at is required (ISO 8601 format)" });
      }

      const result = await bolnaClient.scheduleBatch(
        req.params.batchId,
        scheduled_at,
        bypass_call_guardrails || false
      );

      console.log(`[Batch] Scheduled batch ${req.params.batchId} for ${scheduled_at}`);
      res.json(result);
    } catch (error: any) {
      console.error("Error scheduling batch:", error);
      res.status(500).json({ message: error.message || "Failed to schedule batch" });
    }
  });

  // Stop a running batch
  app.post('/api/batches/:batchId/stop', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const result = await bolnaClient.stopBatch(req.params.batchId);
      console.log(`[Batch] Stopped batch ${req.params.batchId}`);
      res.json(result);
    } catch (error: any) {
      console.error("Error stopping batch:", error);
      res.status(500).json({ message: error.message || "Failed to stop batch" });
    }
  });

  // Delete a batch
  app.delete('/api/batches/:batchId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const result = await bolnaClient.deleteBatch(req.params.batchId);
      console.log(`[Batch] Deleted batch ${req.params.batchId}`);
      res.json(result);
    } catch (error: any) {
      console.error("Error deleting batch:", error);
      res.status(500).json({ message: error.message || "Failed to delete batch" });
    }
  });

  // Lead routes
  app.get('/api/leads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const leads = await storage.getLeads(user.organizationId);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get('/api/leads/my', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const leads = await storage.getLeadsByAgent(userId, user.organizationId);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching my leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get('/api/leads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const lead = await storage.getLead(req.params.id, user.organizationId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.post('/api/leads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const leadData: InsertLead = {
        ...req.body,
        organizationId: user.organizationId,
      };
      const lead = await storage.createLead(leadData);

      // Emit real-time update
      if ((app as any).emitLeadCreated) {
        (app as any).emitLeadCreated(user.organizationId, lead);
      }

      // Generate AI summary if notes exist
      if (lead.notes) {
        const aiSummary = await analyzeLeadQualification({
          name: lead.name,
          company: lead.company || undefined,
          notes: lead.notes,
        });
        await storage.updateLead(lead.id, user.organizationId, { aiSummary });
      }

      res.json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.post('/api/leads/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const { data } = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

      const campaignId = req.body.campaignId;
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      const leadsData: InsertLead[] = (data as any[]).map((row: any) => ({
        organizationId: user.organizationId,
        campaignId,
        name: row.name || row.Name || '',
        email: row.email || row.Email || null,
        phone: row.phone || row.Phone || null,
        company: row.company || row.Company || null,
        status: 'new',
      })).filter(lead => lead.name); // Only include rows with names

      const leads = await storage.createLeadsBulk(leadsData, user.organizationId);

      // Update campaign lead count
      const campaign = await storage.getCampaign(campaignId, user.organizationId);
      if (campaign) {
        await storage.updateCampaign(campaignId, user.organizationId, {
          totalLeads: campaign.totalLeads + leads.length,
        });
      }

      res.json({
        message: "Leads uploaded successfully",
        count: leads.length,
        leads,
      });
    } catch (error) {
      console.error("Error uploading leads:", error);
      res.status(500).json({ message: "Failed to upload leads" });
    }
  });

  // Bulk upload leads with AI assignment and auto-calling
  app.post('/api/leads/bulk-upload-and-call', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const enableAIAssignment = req.body.enableAIAssignment === 'true';
      const enableAutoCalling = req.body.enableAutoCalling === 'true';
      const fromPhoneNumber = req.body.fromPhoneNumber;

      console.log(`[Bulk Lead Upload] Processing file: ${req.file.originalname}`);
      console.log(`[Bulk Lead Upload] AI Assignment: ${enableAIAssignment}, Auto-Calling: ${enableAutoCalling}`);

      // Parse CSV
      const fileContent = req.file.buffer.toString('utf-8');
      const { data } = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

      // Create leads
      const leadsData: InsertLead[] = (data as any[]).map((row: any) => ({
        organizationId: user.organizationId,
        name: row.name || row.Name || '',
        email: row.email || row.Email || null,
        phone: row.phone || row.Phone || row.contact_number || null,
        company: row.company || row.Company || null,
        notes: row.notes || row.Notes || null,
        status: 'new',
        customFields: row, // Store all CSV fields for AI analysis
      })).filter(lead => lead.name && lead.phone); // Require name and phone

      if (leadsData.length === 0) {
        return res.status(400).json({ message: "No valid leads found. Ensure CSV has 'name' and 'phone' columns." });
      }

      const createdLeads = await storage.createLeadsBulk(leadsData, user.organizationId);
      console.log(`[Bulk Lead Upload] Created ${createdLeads.length} leads`);

      // Emit WebSocket event for each lead
      for (const lead of createdLeads) {
        if ((app as any).emitLeadCreated) {
          (app as any).emitLeadCreated(user.organizationId, lead);
        }
      }

      let assignedCount = 0;
      let callsInitiated = 0;

      // AI Assignment
      if (enableAIAssignment) {
        console.log(`[Bulk Lead Upload] Starting AI assignment for ${createdLeads.length} leads`);

        // Get available agents
        const agents = await storage.getAIAgents(user.organizationId);
        const activeAgents = agents.filter(a => a.status === 'active' && a.bolnaAgentId);

        if (activeAgents.length === 0) {
          console.warn(`[Bulk Lead Upload] No active agents with Bolna IDs found`);
        } else {
          // Use AI to match leads to agents - map to expected format
          const leadsForMatching = createdLeads.map(l => ({
            id: l.id,
            name: l.name,
            company: l.company ?? undefined,
            notes: l.notes ?? undefined
          }));
          const agentsForMatching = activeAgents.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description ?? undefined,
            systemPrompt: a.systemPrompt ?? undefined
          }));
          const assignments = await matchLeadsToAgents(leadsForMatching, agentsForMatching);

          for (const lead of createdLeads) {
            const assignedAgentId = assignments[lead.id];
            if (assignedAgentId) {
              const agent = activeAgents.find(a => a.id === assignedAgentId);
              if (agent) {
                // Update lead with assignment
                await storage.updateLead(lead.id, user.organizationId, {
                  assignedAgentId: agent.id,
                  status: 'contacted',
                  aiSummary: `AI-assigned to ${agent.name} based on lead profile analysis.`,
                  notes: (lead.notes || '') + `\n[AI]: Assigned to ${agent.name} at ${new Date().toISOString()}`
                });
                assignedCount++;

                // Emit update
                if ((app as any).emitLeadUpdate) {
                  (app as any).emitLeadUpdate(user.organizationId, { ...lead, assignedAgentId: agent.id, status: 'contacted' });
                }

                // Auto-call if enabled
                if (enableAutoCalling && agent.bolnaAgentId && lead.phone && fromPhoneNumber) {
                  try {
                    console.log(`[Bulk Lead Upload] Initiating call for lead ${lead.name} (${lead.phone}) via agent ${agent.name}`);

                    // Initiate call via Bolna
                    const callResponse = await bolnaClient.initiateCallV2({
                      agent_id: agent.bolnaAgentId,
                      recipient_phone_number: lead.phone,
                      from_phone_number: fromPhoneNumber,
                      user_data: {
                        lead_id: lead.id,
                        lead_name: lead.name,
                        company: lead.company,
                        notes: lead.notes,
                        ...(lead.customFields as object || {}),
                      },
                    });

                    // Create call record
                    const callRecord = await storage.createCall({
                      organizationId: user.organizationId,
                      agentId: agent.id,
                      leadId: lead.id,
                      contactName: lead.name,
                      contactPhone: lead.phone,
                      bolnaCallId: callResponse.execution_id || callResponse.call_id,
                      status: 'initiated',
                      direction: 'outbound',
                      startedAt: new Date(),
                      metadata: {
                        bulkUpload: true,
                        uploadedAt: new Date().toISOString(),
                        fromPhoneNumber,
                      },
                    });

                    // Emit call created
                    if ((app as any).emitCallCreated) {
                      (app as any).emitCallCreated(user.organizationId, callRecord);
                    }

                    // Start automatic polling for call status updates
                    const bolnaId = callResponse.execution_id || callResponse.call_id;
                    if (bolnaId) {
                      console.log(`[Bulk Lead Upload] Starting call poller for ${bolnaId}`);
                      startCallPolling(
                        bolnaId,
                        callRecord.id,
                        user.organizationId,
                        (app as any).emitCallUpdate,
                        (app as any).emitMetricsUpdate
                      );
                    }

                    callsInitiated++;

                    // Update lead status
                    await storage.updateLead(lead.id, user.organizationId, {
                      status: 'contacted',
                      lastContactedAt: new Date(),
                      totalCalls: (lead.totalCalls || 0) + 1,
                    } as any);
                  } catch (callError) {
                    console.error(`[Bulk Lead Upload] Failed to initiate call for ${lead.name}:`, (callError as Error).message);
                  }
                }
              }
            }
          }
        }
      }

      const message = enableAutoCalling
        ? `Uploaded ${createdLeads.length} leads, assigned ${assignedCount} to agents, initiated ${callsInitiated} calls`
        : enableAIAssignment
          ? `Uploaded ${createdLeads.length} leads, assigned ${assignedCount} to agents`
          : `Uploaded ${createdLeads.length} leads`;

      res.json({
        success: true,
        message,
        leadsCreated: createdLeads.length,
        leadsAssigned: assignedCount,
        callsInitiated,
      });
    } catch (error) {
      console.error("[Bulk Lead Upload] Error:", error);
      res.status(500).json({ message: "Failed to process bulk upload", error: (error as Error).message });
    }
  });

  // Bulk upload contacts/leads without campaign requirement
  app.post('/api/contacts/bulk-upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const { data } = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

      const leadsData: InsertLead[] = (data as any[]).map((row: any) => ({
        organizationId: user.organizationId,
        name: row.name || row.Name || row.contact_name || row['Contact Name'] || row.full_name || row['Full Name'] || '',
        email: row.email || row.Email || row.EMAIL || null,
        phone: row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile || row.contact_number || null,
        company: row.company || row.Company || row.organization || row.Organization || null,
        status: row.status || 'new',
        notes: row.notes || row.Notes || null,
      })).filter(lead => lead.name); // Only include rows with names

      if (leadsData.length === 0) {
        return res.status(400).json({ message: "No valid contacts found in the file. Make sure the file has a 'name' column." });
      }

      const leads = await storage.createLeadsBulk(leadsData, user.organizationId);

      res.json({
        message: "Contacts uploaded successfully",
        count: leads.length,
        leads,
      });
    } catch (error) {
      console.error("Error uploading contacts:", error);
      res.status(500).json({ message: "Failed to upload contacts" });
    }
  });

  app.patch('/api/leads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const lead = await storage.updateLead(req.params.id, user.organizationId, req.body);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  // Channel Partner routes
  app.get('/api/channel-partners', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const partners = await storage.getChannelPartners(user.organizationId);
      res.json(partners);
    } catch (error) {
      console.error("Error fetching channel partners:", error);
      res.status(500).json({ message: "Failed to fetch channel partners" });
    }
  });

  app.get('/api/channel-partners/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const partner = await storage.getChannelPartner(req.params.id, user.organizationId);
      if (!partner) {
        return res.status(404).json({ message: "Channel partner not found" });
      }
      res.json(partner);
    } catch (error) {
      console.error("Error fetching channel partner:", error);
      res.status(500).json({ message: "Failed to fetch channel partner" });
    }
  });

  app.post('/api/channel-partners', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const partnerData: InsertChannelPartner = {
        ...req.body,
        organizationId: user.organizationId,
      };
      const partner = await storage.createChannelPartner(partnerData);
      res.json(partner);
    } catch (error) {
      console.error("Error creating channel partner:", error);
      res.status(500).json({ message: "Failed to create channel partner" });
    }
  });

  app.post('/api/channel-partners/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const { data } = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

      const partnersData: InsertChannelPartner[] = (data as any[]).map((row: any) => ({
        organizationId: user.organizationId,
        name: row.name || row.Name || '',
        email: row.email || row.Email || null,
        phone: row.phone || row.Phone || null,
        company: row.company || row.Company || null,
        category: row.category || row.Category || null,
        status: 'inactive',
      })).filter(partner => partner.name);

      const partners = await storage.createChannelPartnersBulk(partnersData, user.organizationId);

      res.json({
        message: "Channel partners uploaded successfully",
        count: partners.length,
        partners,
      });
    } catch (error) {
      console.error("Error uploading channel partners:", error);
      res.status(500).json({ message: "Failed to upload channel partners" });
    }
  });

  app.patch('/api/channel-partners/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const partner = await storage.updateChannelPartner(req.params.id, user.organizationId, req.body);
      if (!partner) {
        return res.status(404).json({ message: "Channel partner not found" });
      }
      res.json(partner);
    } catch (error) {
      console.error("Error updating channel partner:", error);
      res.status(500).json({ message: "Failed to update channel partner" });
    }
  });

  // Call routes
  app.get('/api/calls', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const calls = await storage.getCalls(user.organizationId);
      res.json(calls);
    } catch (error) {
      console.error("Error fetching calls:", error);
      res.status(500).json({ message: "Failed to fetch calls" });
    }
  });

  app.get('/api/calls/my', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const calls = await storage.getCallsByAgent(userId, user.organizationId);
      res.json(calls);
    } catch (error) {
      console.error("Error fetching my calls:", error);
      res.status(500).json({ message: "Failed to fetch calls" });
    }
  });

  app.post('/api/calls', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const callData: InsertCall = {
        ...req.body,
        organizationId: user.organizationId,
      };
      const call = await storage.createCall(callData);

      // Generate AI summary if transcription exists
      if (call.transcription) {
        const aiSummary = await generateAISummary(call.transcription);
        await storage.updateCall(call.id, user.organizationId, { aiSummary });
      }

      // Automatically initiate call if this is an outbound call with an agent
      // This fixes the issue where "Call" button only created a record but didn't trigger the call
      if (call.agentId && call.contactPhone && (call.direction === 'outbound' || !call.direction)) {
        try {
          console.log(`[Calls] Automatically initiating outbound call for ${call.id}`);

          // Get Agent details to get Bolna Agent ID
          const agent = await storage.getAIAgent(call.agentId, user.organizationId);

          if (agent && agent.bolnaAgentId) {
            // Determine allowed caller ID
            let fromPhone = undefined;
            if (agent.assignedPhoneNumberId) {
              const assignedPhone = await storage.getPhoneNumber(agent.assignedPhoneNumberId, user.organizationId);
              if (assignedPhone?.phoneNumber) {
                fromPhone = assignedPhone.phoneNumber;
              }
            }

            // Fallback: If no specific number assigned to agent, pick the first active number for the org
            if (!fromPhone) {
              const numbers = await storage.getPhoneNumbers(user.organizationId);
              const fallback = numbers.find(n => n.status === 'active');
              if (fallback) {
                fromPhone = fallback.phoneNumber;
                console.log(`[Calls] Using fallback caller ID: ${fromPhone} for agent ${agent.id}`);
              } else {
                console.warn(`[Calls] NO active phone number found for organization ${user.organizationId}. Bolna call might fail if agent is not hosted.`);
              }
            }

            // Initiate call via Bolna
            // Use the updated initiateCallV2 which now correctly uses POST /call
            try {
              const bolnaCall = await bolnaClient.initiateCallV2({
                agent_id: agent.bolnaAgentId,
                recipient_phone_number: call.contactPhone,
                from_phone_number: fromPhone,
                user_data: {
                  callId: call.id,
                  contactName: call.contactName,
                  organizationId: user.organizationId,
                }
              });

              console.log(`[Calls] Bolna initiateCallV2 success. Result:`, JSON.stringify(bolnaCall, null, 2));

              if (bolnaCall && (bolnaCall.call_id || bolnaCall.execution_id)) {
                await storage.updateCall(call.id, user.organizationId, {
                  bolnaCallId: bolnaCall.call_id || bolnaCall.execution_id,
                  status: 'initiated',
                  metadata: {
                    ...(call.metadata as object || {}),
                    bolnaInitiationSuccess: true,
                    bolnaResponse: bolnaCall
                  }
                });
                console.log(`[Calls] Updated call ${call.id} with Bolna ID`);
              } else {
                console.warn(`[Calls] Bolna response missing call_id/execution_id:`, bolnaCall);
                await storage.updateCall(call.id, user.organizationId, {
                  metadata: {
                    ...(call.metadata as object || {}),
                    bolnaInitiationError: "Response missing call_id/execution_id",
                    bolnaResponse: bolnaCall
                  }
                });
              }
            } catch (err: any) {
              console.error(`[Calls] Failed to initiate Bolna call:`, err.message, err.response?.data);
              await storage.updateCall(call.id, user.organizationId, {
                metadata: {
                  ...(call.metadata as object || {}),
                  bolnaInitiationError: err.message,
                  bolnaErrorDetails: err.response?.data
                }
              });
            }


          } else {
            console.warn(`[Calls] Cannot initiate call: Agent ${call.agentId} not found or not synced with Bolna`);
            await storage.updateCall(call.id, user.organizationId, {
              metadata: {
                ...(call.metadata as object || {}),
                bolnaInitiationError: "Agent not found or missing Bolna Agent ID",
                agentId: call.agentId,
                agentFound: !!agent,
                bolnaAgentId: agent?.bolnaAgentId
              }
            });
          }
        } catch (initErr) {
          console.error(`[Calls] Failed to auto-initiate call ${call.id}:`, initErr);
          // Don't fail the request, just log the error. The UI will show the call as created.
          // Optionally update status to 'failed'
          await storage.updateCall(call.id, user.organizationId, { status: 'failed' });
        }
      }

      res.json(call);
    } catch (error) {
      console.error("Error creating call:", error);
      res.status(500).json({ message: "Failed to create call" });
    }
  });

  app.patch('/api/calls/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const call = await storage.updateCall(req.params.id, user.organizationId, req.body);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }
      res.json(call);
    } catch (error) {
      console.error("Error updating call:", error);
      res.status(500).json({ message: "Failed to update call" });
    }
  });

  // Visit routes
  app.get('/api/visits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const visits = await storage.getVisits(user.organizationId);
      res.json(visits);
    } catch (error) {
      console.error("Error fetching visits:", error);
      res.status(500).json({ message: "Failed to fetch visits" });
    }
  });

  app.get('/api/visits/my', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const visits = await storage.getVisitsByManager(userId, user.organizationId);
      res.json(visits);
    } catch (error) {
      console.error("Error fetching my visits:", error);
      res.status(500).json({ message: "Failed to fetch visits" });
    }
  });

  app.post('/api/visits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const visitData: InsertVisit = {
        ...req.body,
        organizationId: user.organizationId,
      };
      const visit = await storage.createVisit(visitData);
      res.json(visit);
    } catch (error) {
      console.error("Error creating visit:", error);
      res.status(500).json({ message: "Failed to create visit" });
    }
  });

  app.patch('/api/visits/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const visit = await storage.updateVisit(req.params.id, user.organizationId, req.body);

      // Generate summary if transcription exists
      if (visit && req.body.transcription && !visit.summary) {
        const summary = await generateMeetingSummary(req.body.transcription);
        await storage.updateVisit(req.params.id, user.organizationId, { summary });
      }

      if (!visit) {
        return res.status(404).json({ message: "Visit not found" });
      }
      res.json(visit);
    } catch (error) {
      console.error("Error updating visit:", error);
      res.status(500).json({ message: "Failed to update visit" });
    }
  });

  // Dashboard metrics route (AI Voice Agent platform)
  app.get('/api/dashboard/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const metrics = await storage.getDashboardMetrics(user.organizationId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Analytics routes
  app.get('/api/analytics/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const daysAgo = req.query.timeRange === '90d' ? 90 : req.query.timeRange === '30d' ? 30 : 7;
      const metrics = await storage.getAnalyticsMetrics(user.organizationId, daysAgo);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching analytics metrics:", error);
      res.status(500).json({ message: "Failed to fetch analytics metrics" });
    }
  });

  app.get('/api/analytics/calls', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const daysAgo = req.query.timeRange === '90d' ? 90 : req.query.timeRange === '30d' ? 30 : 7;
      const callMetrics = await storage.getCallMetrics(user.organizationId, daysAgo);
      res.json(callMetrics);
    } catch (error) {
      console.error("Error fetching call metrics:", error);
      res.status(500).json({ message: "Failed to fetch call metrics" });
    }
  });

  app.get('/api/analytics/agents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const daysAgo = req.query.timeRange === '90d' ? 90 : req.query.timeRange === '30d' ? 30 : 7;
      const agentPerformance = await storage.getAgentPerformance(user.organizationId, daysAgo);
      res.json(agentPerformance);
    } catch (error) {
      console.error("Error fetching agent performance:", error);
      res.status(500).json({ message: "Failed to fetch agent performance" });
    }
  });

  // Billing routes
  app.get('/api/billing/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const metrics = await storage.getBillingMetrics(user.organizationId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching billing metrics:", error);
      res.status(500).json({ message: "Failed to fetch billing metrics" });
    }
  });

  // Organization whitelabel routes
  app.get('/api/organization', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const organization = await storage.getOrganization(user.organizationId);
      res.json(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  app.patch('/api/organization/whitelabel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { companyName, logoUrl, primaryColor } = req.body;
      const organization = await storage.updateOrganizationWhitelabel(
        user.organizationId,
        { companyName, logoUrl, primaryColor }
      );

      // Emit real-time update
      if ((app as any).emitOrganizationUpdate && organization) {
        (app as any).emitOrganizationUpdate(user.organizationId, organization);
      }

      res.json(organization);
    } catch (error) {
      console.error("Error updating organization whitelabel:", error);
      res.status(500).json({ message: "Failed to update organization whitelabel" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket setup for real-time updates
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Use session middleware
  io.engine.use(sessionMiddleware());

  // WebSocket connection handler
  io.on('connection', async (socket) => {
    // console.log('Client connected:', socket.id);
    const session = (socket.request as any).session;

    // Join organization-specific room for multi-tenant isolation
    socket.on('join:organization', async (organizationId: string) => {
      // Security Check: Verify user belongs to this organization
      if (session?.user?.claims?.sub) {
        try {
          const user = await storage.getUser(session.user.claims.sub);
          if (user && user.organizationId === organizationId) {
            socket.join(`org:${organizationId}`);
            console.log(`Client ${socket.id} (User: ${user.email}) joined organization room: org:${organizationId}`);
          } else {
            console.warn(`Unauthorized join attempt: User ${session.user.claims.sub} tried to join org ${organizationId}`);
          }
        } catch (err) {
          console.error("Error verifying socket user:", err);
        }
      } else {
        console.warn(`Unauthenticated client ${socket.id} tried to join org ${organizationId}`);
      }
    });

    socket.on('leave:organization', (organizationId: string) => {
      socket.leave(`org:${organizationId}`);
      console.log(`Client ${socket.id} left organization room: org:${organizationId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Helper functions to emit real-time updates
  const emitCallUpdate = (organizationId: string, call: any) => {
    console.log(`📡 [WebSocket] Emitting call:updated to org:${organizationId}, callId: ${call?.id}, status: ${call?.status}`);
    io.to(`org:${organizationId}`).emit('call:updated', call);
  };

  const emitCallCreated = (organizationId: string, call: any) => {
    console.log(`📡 [WebSocket] Emitting call:created to org:${organizationId}, callId: ${call?.id}`);
    io.to(`org:${organizationId}`).emit('call:created', call);
  };

  const emitCallDeleted = (organizationId: string, callId: string) => {
    io.to(`org:${organizationId}`).emit('call:deleted', callId);
  };

  const emitMetricsUpdate = (organizationId: string, metrics: any) => {
    io.to(`org:${organizationId}`).emit('metrics:updated', metrics);
  };

  const emitAgentUpdate = (organizationId: string, agent: any) => {
    io.to(`org:${organizationId}`).emit('agent:updated', agent);
  };

  const emitAgentCreated = (organizationId: string, agent: any) => {
    io.to(`org:${organizationId}`).emit('agent:created', agent);
  };

  const emitAgentDeleted = (organizationId: string, agentId: string) => {
    io.to(`org:${organizationId}`).emit('agent:deleted', agentId);
  };

  const emitLeadUpdate = (organizationId: string, lead: any) => {
    io.to(`org:${organizationId}`).emit('lead:updated', lead);
  };

  const emitLeadCreated = (organizationId: string, lead: any) => {
    io.to(`org:${organizationId}`).emit('lead:created', lead);
  };

  const emitLeadDeleted = (organizationId: string, leadId: string) => {
    io.to(`org:${organizationId}`).emit('lead:deleted', leadId);
  };

  const emitCampaignUpdate = (organizationId: string, campaign: any) => {
    io.to(`org:${organizationId}`).emit('campaign:updated', campaign);
  };

  const emitCampaignCreated = (organizationId: string, campaign: any) => {
    io.to(`org:${organizationId}`).emit('campaign:created', campaign);
  };

  const emitCampaignDeleted = (organizationId: string, campaignId: string) => {
    io.to(`org:${organizationId}`).emit('campaign:deleted', campaignId);
  };

  const emitContactCreated = (organizationId: string, contact: any) => {
    io.to(`org:${organizationId}`).emit('contact:created', contact);
  };

  const emitContactUpdated = (organizationId: string, contact: any) => {
    io.to(`org:${organizationId}`).emit('contact:updated', contact);
  };

  const emitKnowledgeBaseUpdate = (organizationId: string, item: any) => {
    io.to(`org:${organizationId}`).emit('knowledge:updated', item);
  };

  const emitKnowledgeBaseCreated = (organizationId: string, item: any) => {
    io.to(`org:${organizationId}`).emit('knowledge:created', item);
  };

  const emitKnowledgeBaseDeleted = (organizationId: string, itemId: string) => {
    io.to(`org:${organizationId}`).emit('knowledge:deleted', itemId);
  };

  const emitPhoneNumberUpdate = (organizationId: string, phone: any) => {
    io.to(`org:${organizationId}`).emit('phone:updated', phone);
  };

  const emitPhoneNumberCreated = (organizationId: string, phone: any) => {
    io.to(`org:${organizationId}`).emit('phone:created', phone);
  };

  const emitOrganizationUpdate = (organizationId: string, org: any) => {
    io.to(`org:${organizationId}`).emit('organization:updated', org);
  };

  const emitCreditsUpdate = (organizationId: string, credits: number) => {
    io.to(`org:${organizationId}`).emit('credits:updated', { credits });
  };

  // Store io instance and helper functions for use in other parts of the app
  (app as any).io = io;
  (app as any).emitCallUpdate = emitCallUpdate;
  (app as any).emitCallCreated = emitCallCreated;
  (app as any).emitCallDeleted = emitCallDeleted;
  (app as any).emitMetricsUpdate = emitMetricsUpdate;
  (app as any).emitAgentUpdate = emitAgentUpdate;
  (app as any).emitAgentCreated = emitAgentCreated;
  (app as any).emitAgentDeleted = emitAgentDeleted;
  (app as any).emitLeadUpdate = emitLeadUpdate;
  (app as any).emitLeadCreated = emitLeadCreated;
  (app as any).emitLeadDeleted = emitLeadDeleted;
  (app as any).emitCampaignUpdate = emitCampaignUpdate;
  (app as any).emitCampaignCreated = emitCampaignCreated;
  (app as any).emitCampaignDeleted = emitCampaignDeleted;
  (app as any).emitKnowledgeBaseUpdate = emitKnowledgeBaseUpdate;
  (app as any).emitKnowledgeBaseCreated = emitKnowledgeBaseCreated;
  (app as any).emitKnowledgeBaseDeleted = emitKnowledgeBaseDeleted;
  (app as any).emitPhoneNumberUpdate = emitPhoneNumberUpdate;
  (app as any).emitPhoneNumberCreated = emitPhoneNumberCreated;
  (app as any).emitOrganizationUpdate = emitOrganizationUpdate;
  (app as any).emitCreditsUpdate = emitCreditsUpdate;
  (app as any).emitContactCreated = emitContactCreated;
  (app as any).emitContactUpdated = emitContactUpdated;

  // Batch WebSocket emitters
  const emitBatchCreated = (organizationId: string, batch: any) => {
    io.to(`org:${organizationId}`).emit('batch:created', batch);
  };

  const emitBatchUpdated = (organizationId: string, batch: any) => {
    io.to(`org:${organizationId}`).emit('batch:updated', batch);
  };

  // Start sync after a short delay to ensure everything is initialized
  setTimeout(() => {
    startPhoneNumberSync(emitPhoneNumberUpdate, emitPhoneNumberCreated);
    // Start inbound call polling
    startInboundPolling(emitCallUpdate, emitMetricsUpdate);
  }, 2000);

  const emitBatchDeleted = (organizationId: string, data: { batch_id: string }) => {
    io.to(`org:${organizationId}`).emit('batch:deleted', data);
  };

  (app as any).emitBatchCreated = emitBatchCreated;
  (app as any).emitBatchUpdated = emitBatchUpdated;
  (app as any).emitBatchDeleted = emitBatchDeleted;

  // Auto-assign leads using "AI" (Simulated logic for now, or simple round-robin)
  app.post('/api/leads/auto-assign', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Get unassigned leads
      const leads = await storage.getLeads(user.organizationId);
      const unassignedLeads = leads.filter(l => !l.assignedAgentId && l.status === 'new');

      if (unassignedLeads.length === 0) {
        return res.json({ message: "No new unassigned leads found", count: 0 });
      }

      // Get available agents
      const agents = await storage.getAIAgents(user.organizationId);
      if (agents.length === 0) {
        return res.status(400).json({ message: "No AI agents available for assignment" });
      }

      // Use AI to match leads to agents - map to expected format
      const leadsForMatching = unassignedLeads.map(l => ({
        id: l.id,
        name: l.name,
        company: l.company ?? undefined,
        notes: l.notes ?? undefined
      }));
      const agentsForMatching = agents.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description ?? undefined,
        systemPrompt: a.systemPrompt ?? undefined
      }));
      const assignments = await matchLeadsToAgents(leadsForMatching, agentsForMatching);
      let assignedCount = 0;

      for (const lead of unassignedLeads) {
        const assignedAgentId = assignments[lead.id];
        if (assignedAgentId) {
          const agent = agents.find(a => a.id === assignedAgentId);
          if (agent) {
            await storage.updateLead(lead.id, user.organizationId, {
              assignedAgentId: agent.id,
              status: 'contacted',
              aiSummary: `Auto-assigned to ${agent.name} based on AI matching analysis.`,
              notes: (lead.notes || '') + `\n[System]: Auto-assigned to ${agent.name} at ${new Date().toISOString()}`
            });
            assignedCount++;
          }
        }
      }

      res.json({
        message: `Successfully auto-assigned ${assignedCount} leads using AI matching`,
        count: assignedCount
      });
    } catch (error) {
      console.error("Error auto-assigning leads:", error);
      res.status(500).json({ message: "Failed to auto-assign leads" });
    }
  });

  // ============================================
  // BATCH API ROUTES - Bolna Batch Integration
  // ============================================

  // List all batches for organization
  app.get('/api/batches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Get batches from local database
      const localBatches = await db.select().from(batches)
        .where(eq(batches.organizationId, user.organizationId))
        .orderBy(desc(batches.createdAt));

      // Optionally sync with Bolna to get latest status
      try {
        const bolnaBatches = await bolnaClient.listBatches();

        // Update local records with latest Bolna data
        for (const bolnaBatch of bolnaBatches) {
          const localBatch = localBatches.find(b => b.batchId === bolnaBatch.batch_id);
          if (localBatch) {
            // Update status and execution_status from Bolna
            await db.update(batches)
              .set({
                status: bolnaBatch.state,
                executionStatus: bolnaBatch.execution_status,
                updatedAt: new Date(),
              })
              .where(eq(batches.batchId, bolnaBatch.batch_id));
          }
        }
      } catch (syncError) {
        console.warn('[Batches] Could not sync with Bolna:', (syncError as Error).message);
      }

      // Return updated local batches
      const updatedBatches = await db.select().from(batches)
        .where(eq(batches.organizationId, user.organizationId))
        .orderBy(desc(batches.createdAt));

      // Transform to frontend format
      const result = updatedBatches.map(b => ({
        batch_id: b.batchId,
        file_name: b.fileName,
        valid_contacts: b.validContacts,
        total_contacts: b.totalContacts,
        status: b.status,
        execution_status: b.executionStatus,
        scheduled_at: b.scheduledAt?.toISOString(),
        created_at: b.createdAt?.toISOString(),
        from_phone_number: b.fromPhoneNumber,
        agent_id: b.agentId,
      }));

      res.json(result);
    } catch (error) {
      console.error('[Batches] Error listing batches:', error);
      res.status(500).json({ message: "Failed to list batches", error: (error as Error).message });
    }
  });

  // Create a new batch (upload CSV)
  app.post('/api/batches', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { agent_id, from_phone_number } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }

      if (!agent_id) {
        return res.status(400).json({ message: "agent_id is required" });
      }

      if (!from_phone_number) {
        return res.status(400).json({ message: "from_phone_number is required" });
      }

      // Use predefined webhook URL from environment
      let webhookUrl: string | undefined = undefined;
      if (process.env.PUBLIC_WEBHOOK_URL) {
        const baseUrl = process.env.PUBLIC_WEBHOOK_URL.startsWith('http')
          ? process.env.PUBLIC_WEBHOOK_URL
          : `https://${process.env.PUBLIC_WEBHOOK_URL}`;
        webhookUrl = `${baseUrl}/api/webhooks/bolna/call-status`;
      }

      console.log(`[Batches] Creating batch for agent ${agent_id} with ${req.file.originalname}`);
      console.log(`[Batches] Using predefined webhook URL: ${webhookUrl || 'none'}`);

      // Upload to Bolna
      const bolnaResponse = await bolnaClient.createBatch({
        agent_id,
        file: req.file.buffer,
        fileName: req.file.originalname,
        from_phone_number,
        webhook_url: webhookUrl,
      });

      console.log('[Batches] Bolna response:', bolnaResponse);

      // Store in local database
      const [newBatch] = await db.insert(batches).values({
        organizationId: user.organizationId,
        batchId: bolnaResponse.batch_id,
        agentId: agent_id,
        fileName: bolnaResponse.file_name || req.file.originalname,
        validContacts: bolnaResponse.valid_contacts,
        totalContacts: bolnaResponse.total_contacts,
        status: bolnaResponse.state || 'created',
        fromPhoneNumber: from_phone_number,
        webhookUrl: webhookUrl,
        createdBy: userId,
      }).returning();

      // Emit WebSocket event
      const emitBatchCreated = (app as any).emitBatchCreated;
      if (emitBatchCreated) {
        emitBatchCreated(user.organizationId, {
          batch_id: newBatch.batchId,
          file_name: newBatch.fileName,
          valid_contacts: newBatch.validContacts,
          total_contacts: newBatch.totalContacts,
          status: newBatch.status,
        });
      }

      res.json({
        batch_id: newBatch.batchId,
        file_name: newBatch.fileName,
        valid_contacts: newBatch.validContacts,
        total_contacts: newBatch.totalContacts,
        status: newBatch.status,
        created_at: newBatch.createdAt?.toISOString(),
      });
    } catch (error) {
      console.error('[Batches] Error creating batch:', error);
      res.status(500).json({ message: "Failed to create batch", error: (error as Error).message });
    }
  });

  // Get batch details
  app.get('/api/batches/:batch_id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { batch_id } = req.params;

      // Get from local DB first
      const [localBatch] = await db.select().from(batches)
        .where(and(
          eq(batches.batchId, batch_id),
          eq(batches.organizationId, user.organizationId)
        ));

      if (!localBatch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Get latest status from Bolna
      try {
        const bolnaBatch = await bolnaClient.getBatch(batch_id);

        // Update local record
        await db.update(batches)
          .set({
            status: bolnaBatch.state,
            executionStatus: bolnaBatch.execution_status,
            updatedAt: new Date(),
          })
          .where(eq(batches.batchId, batch_id));

        res.json({
          batch_id: bolnaBatch.batch_id,
          file_name: bolnaBatch.file_name,
          valid_contacts: bolnaBatch.valid_contacts,
          total_contacts: bolnaBatch.total_contacts,
          status: bolnaBatch.state,
          execution_status: bolnaBatch.execution_status,
          scheduled_at: bolnaBatch.scheduled_at,
          created_at: bolnaBatch.created_at,
          from_phone_number: bolnaBatch.from_phone_number || localBatch.fromPhoneNumber,
          agent_id: bolnaBatch.agent_id,
        });
      } catch (bolnaError) {
        // Return local data if Bolna fails
        res.json({
          batch_id: localBatch.batchId,
          file_name: localBatch.fileName,
          valid_contacts: localBatch.validContacts,
          total_contacts: localBatch.totalContacts,
          status: localBatch.status,
          execution_status: localBatch.executionStatus,
          scheduled_at: localBatch.scheduledAt?.toISOString(),
          created_at: localBatch.createdAt?.toISOString(),
          from_phone_number: localBatch.fromPhoneNumber,
          agent_id: localBatch.agentId,
        });
      }
    } catch (error) {
      console.error('[Batches] Error getting batch:', error);
      res.status(500).json({ message: "Failed to get batch", error: (error as Error).message });
    }
  });

  // Schedule a batch
  app.post('/api/batches/:batch_id/schedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { batch_id } = req.params;
      const { scheduled_at } = req.body;

      if (!scheduled_at) {
        return res.status(400).json({ message: "scheduled_at is required" });
      }

      // Verify batch belongs to organization
      const [localBatch] = await db.select().from(batches)
        .where(and(
          eq(batches.batchId, batch_id),
          eq(batches.organizationId, user.organizationId)
        ));

      if (!localBatch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      console.log(`[Batches] Scheduling batch ${batch_id} for ${scheduled_at}`);

      // Schedule in Bolna
      const bolnaResponse = await bolnaClient.scheduleBatch(batch_id, scheduled_at);

      // Update local record
      await db.update(batches)
        .set({
          status: bolnaResponse.state || 'scheduled',
          scheduledAt: new Date(scheduled_at),
          updatedAt: new Date(),
        })
        .where(eq(batches.batchId, batch_id));

      // Emit WebSocket event
      io.to(`org:${user.organizationId}`).emit('batch:updated', {
        batch_id,
        status: 'scheduled',
        scheduled_at,
      });

      res.json({
        batch_id: bolnaResponse.batch_id,
        status: bolnaResponse.state || 'scheduled',
        scheduled_at: bolnaResponse.scheduled_at,
      });
    } catch (error) {
      console.error('[Batches] Error scheduling batch:', error);
      res.status(500).json({ message: "Failed to schedule batch", error: (error as Error).message });
    }
  });

  // Run batch now (immediate execution)
  app.post('/api/batches/:batch_id/run', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { batch_id } = req.params;

      // Verify batch belongs to organization
      const [localBatch] = await db.select().from(batches)
        .where(and(
          eq(batches.batchId, batch_id),
          eq(batches.organizationId, user.organizationId)
        ));

      if (!localBatch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      console.log(`[Batches] Running batch ${batch_id} now`);

      // Run immediately via Bolna
      const bolnaResponse = await bolnaClient.runBatchNow(batch_id);

      // Update local record
      await db.update(batches)
        .set({
          status: 'queued',
          scheduledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(batches.batchId, batch_id));

      // Emit WebSocket event
      io.to(`org:${user.organizationId}`).emit('batch:updated', {
        batch_id,
        status: 'queued',
      });

      res.json({
        batch_id,
        status: 'queued',
        message: 'Batch started successfully',
      });
    } catch (error) {
      console.error('[Batches] Error running batch:', error);
      res.status(500).json({ message: "Failed to run batch", error: (error as Error).message });
    }
  });

  // Stop a running batch
  app.post('/api/batches/:batch_id/stop', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { batch_id } = req.params;

      // Verify batch belongs to organization
      const [localBatch] = await db.select().from(batches)
        .where(and(
          eq(batches.batchId, batch_id),
          eq(batches.organizationId, user.organizationId)
        ));

      if (!localBatch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      console.log(`[Batches] Stopping batch ${batch_id}`);

      // Stop in Bolna
      const bolnaResponse = await bolnaClient.stopBatch(batch_id);

      // Update local record
      await db.update(batches)
        .set({
          status: 'stopped',
          updatedAt: new Date(),
        })
        .where(eq(batches.batchId, batch_id));

      // Emit WebSocket event
      io.to(`org:${user.organizationId}`).emit('batch:updated', {
        batch_id,
        status: 'stopped',
      });

      res.json({
        batch_id,
        status: 'stopped',
        message: bolnaResponse.message || 'Batch stopped successfully',
      });
    } catch (error) {
      console.error('[Batches] Error stopping batch:', error);
      res.status(500).json({ message: "Failed to stop batch", error: (error as Error).message });
    }
  });

  // Delete a batch
  app.delete('/api/batches/:batch_id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { batch_id } = req.params;

      // Verify batch belongs to organization
      const [localBatch] = await db.select().from(batches)
        .where(and(
          eq(batches.batchId, batch_id),
          eq(batches.organizationId, user.organizationId)
        ));

      if (!localBatch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      console.log(`[Batches] Deleting batch ${batch_id}`);

      // Delete from local database
      await db.delete(batches)
        .where(eq(batches.batchId, batch_id));

      // Emit WebSocket event
      io.to(`org:${user.organizationId}`).emit('batch:deleted', { batch_id });

      res.json({ message: 'Batch deleted successfully', batch_id });
    } catch (error) {
      console.error('[Batches] Error deleting batch:', error);
      res.status(500).json({ message: "Failed to delete batch", error: (error as Error).message });
    }
  });

  // Get batch call logs
  app.get('/api/batches/:batch_id/calls', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { batch_id } = req.params;

      // Verify batch belongs to organization
      const [localBatch] = await db.select().from(batches)
        .where(and(
          eq(batches.batchId, batch_id),
          eq(batches.organizationId, user.organizationId)
        ));

      if (!localBatch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      // Get call logs from Bolna
      const callLogs = await bolnaClient.getBatchCallLogs(batch_id);

      res.json(callLogs);
    } catch (error) {
      console.error('[Batches] Error getting batch call logs:', error);
      res.status(500).json({ message: "Failed to get batch call logs", error: (error as Error).message });
    }
  });

  return httpServer;
}
