import { storage } from "./storage";
import { bolnaClient } from "./bolna";
import type { InsertCall } from "@shared/schema";
import { db } from "./db";
import { calls, aiAgents, organizations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Active polling intervals
const activePolls = new Map<string, NodeJS.Timeout>();

// Inbound polling
let inboundPollInterval: NodeJS.Timeout | null = null;
const INBOUND_POLL_INTERVAL_MS = 15000; // 15 seconds for faster inbound detection
const processedInboundIds = new Set<string>();

// Polling configuration
const POLL_INTERVAL_MS = 10000; // 10 seconds
const MAX_POLL_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_POLL_ATTEMPTS = Math.floor(MAX_POLL_DURATION_MS / POLL_INTERVAL_MS);

interface PollStatus {
  attempts: number;
  startTime: number;
  callId: string;
  organizationId: string;
}

const pollStatuses = new Map<string, PollStatus>();

export function startCallPolling(
  bolnaCallId: string,
  callId: string,
  organizationId: string,
  emitCallUpdate?: (orgId: string, call: any) => void,
  emitMetricsUpdate?: (orgId: string, metrics: any) => void
) {
  // Don't start if already polling
  if (activePolls.has(bolnaCallId)) {
    console.log(`[Poll] Already polling call ${bolnaCallId}`);
    return;
  }

  console.log(`🔄 [Poll] Starting status polling for call ${bolnaCallId}`);
  console.log(`[Poll] emitCallUpdate available: ${typeof emitCallUpdate === 'function'}`);
  console.log(`[Poll] emitMetricsUpdate available: ${typeof emitMetricsUpdate === 'function'}`);
  console.log(`[Poll] organizationId: ${organizationId}`);

  pollStatuses.set(bolnaCallId, {
    attempts: 0,
    startTime: Date.now(),
    callId,
    organizationId,
  });

  // Run first poll immediately
  pollCallStatus(
    bolnaCallId,
    callId,
    organizationId,
    emitCallUpdate,
    emitMetricsUpdate
  );

  const pollInterval = setInterval(async () => {
    await pollCallStatus(
      bolnaCallId,
      callId,
      organizationId,
      emitCallUpdate,
      emitMetricsUpdate
    );
  }, POLL_INTERVAL_MS);

  activePolls.set(bolnaCallId, pollInterval);
}

async function pollCallStatus(
  bolnaCallId: string,
  callId: string,
  organizationId: string,
  emitCallUpdate?: (orgId: string, call: any) => void,
  emitMetricsUpdate?: (orgId: string, metrics: any) => void
) {
  const pollStatus = pollStatuses.get(bolnaCallId);
  if (!pollStatus) return;

  pollStatus.attempts++;

  try {
    // Get current call from database
    const currentCall = await storage.getCall(callId, organizationId);
    if (!currentCall) {
      console.log(`[Poll] Call ${callId} not found, stopping poll`);
      stopCallPolling(bolnaCallId);
      return;
    }

    // If call is already in terminal state, stop polling
    if (['completed', 'failed', 'cancelled'].includes(currentCall.status)) {
      console.log(`✅ [Poll] Call ${bolnaCallId} already in terminal state: ${currentCall.status}`);
      stopCallPolling(bolnaCallId);
      return;
    }

    // Fetch details from Bolna
    console.log(`🔍 [Poll] Attempt ${pollStatus.attempts}/${MAX_POLL_ATTEMPTS} for ${bolnaCallId}`);

    const bolnaDetails = await bolnaClient.getCallDetails(bolnaCallId);

    if (!bolnaDetails || Object.keys(bolnaDetails).length === 0) {
      console.log(`[Poll] No details yet for ${bolnaCallId}`);

      // Stop if exceeded max attempts
      if (pollStatus.attempts >= MAX_POLL_ATTEMPTS) {
        console.log(`⏱️ [Poll] Max attempts reached for ${bolnaCallId}, stopping`);
        stopCallPolling(bolnaCallId);
      }
      return;
    }

    // Normalize status
    let normalizedStatus = bolnaDetails.status || currentCall.status;
    if (bolnaDetails.status) {
      const statusLower = bolnaDetails.status.toLowerCase();
      if (statusLower === 'answered' || statusLower === 'in-progress' || statusLower === 'in_progress' || statusLower === 'ongoing') {
        normalizedStatus = 'in_progress';
      } else if (statusLower === 'ended' || statusLower === 'finished' || statusLower === 'completed') {
        normalizedStatus = 'completed';
      } else if (statusLower === 'failed' || statusLower === 'error') {
        normalizedStatus = 'failed';
      } else if (statusLower === 'ringing') {
        normalizedStatus = 'ringing';
      } else if (statusLower === 'initiated' || statusLower === 'queued') {
        normalizedStatus = 'initiated';
      }
    }

    // Check if status changed
    const statusChanged = normalizedStatus !== currentCall.status;
    const hasNewData = bolnaDetails.transcript || bolnaDetails.recording_url || bolnaDetails.duration;

    if (statusChanged || hasNewData) {
      console.log(`📊 [Poll] Update found for ${bolnaCallId}:`);
      console.log(`  Status: ${currentCall.status} → ${normalizedStatus}`);
      if (bolnaDetails.duration) console.log(`  Duration: ${bolnaDetails.duration}s`);
      if (bolnaDetails.transcript) console.log(`  Transcript: ${bolnaDetails.transcript.substring(0, 50)}...`);
      if (bolnaDetails.recording_url) console.log(`  Recording: ${bolnaDetails.recording_url}`);

      const updates: Partial<InsertCall> = {
        status: normalizedStatus,
        duration: bolnaDetails.duration ?? currentCall.duration,
        transcription: bolnaDetails.transcript || currentCall.transcription,
        recordingUrl: bolnaDetails.recording_url || currentCall.recordingUrl,
        endedAt: ['completed', 'failed', 'cancelled'].includes(normalizedStatus)
          ? new Date()
          : currentCall.endedAt,
      };

      const updatedCall = await storage.updateCall(callId, organizationId, updates);

      // Emit real-time updates
      if (emitCallUpdate && updatedCall) {
        console.log(`🚀 [Poll] Emitting call:updated to org:${organizationId}`);
        emitCallUpdate(organizationId, updatedCall);
      } else {
        console.warn(`⚠️ [Poll] Cannot emit - emitCallUpdate: ${!!emitCallUpdate}, updatedCall: ${!!updatedCall}`);
      }

      if (emitMetricsUpdate) {
        console.log(`📊 [Poll] Emitting metrics:updated to org:${organizationId}`);
        const metrics = await storage.getDashboardMetrics(organizationId);
        emitMetricsUpdate(organizationId, metrics);
      }

      // Stop polling if in terminal state
      if (['completed', 'failed', 'cancelled'].includes(normalizedStatus)) {
        console.log(`✅ [Poll] Call ${bolnaCallId} completed, stopping poll`);
        stopCallPolling(bolnaCallId);
      }
    }

    // Stop if exceeded max attempts
    if (pollStatus.attempts >= MAX_POLL_ATTEMPTS) {
      console.log(`⏱️ [Poll] Max attempts reached for ${bolnaCallId}, stopping`);
      stopCallPolling(bolnaCallId);
    }

  } catch (error: any) {
    console.error(`❌ [Poll] Error polling ${bolnaCallId}:`, error.message);

    // Stop polling on persistent errors after multiple attempts
    if (pollStatus.attempts >= 5) {
      console.log(`[Poll] Stopping due to repeated errors for ${bolnaCallId}`);
      stopCallPolling(bolnaCallId);
    }
  }
}

export function stopCallPolling(bolnaCallId: string) {
  const interval = activePolls.get(bolnaCallId);
  if (interval) {
    clearInterval(interval);
    activePolls.delete(bolnaCallId);
    pollStatuses.delete(bolnaCallId);
    console.log(`🛑 [Poll] Stopped polling for ${bolnaCallId}`);
  }
}

export function stopAllPolling() {
  console.log(`🛑 [Poll] Stopping all active polls (${activePolls.size} active)`);
  for (const [bolnaCallId, interval] of Array.from(activePolls.entries())) {
    clearInterval(interval);
    activePolls.delete(bolnaCallId);
    pollStatuses.delete(bolnaCallId);
  }
}

// Get polling statistics
export function getPollingStats() {
  const stats = {
    activePolls: activePolls.size,
    inboundPollingActive: inboundPollInterval !== null,
    processedInboundCount: processedInboundIds.size,
    polls: Array.from(pollStatuses.entries()).map(([bolnaCallId, status]) => ({
      bolnaCallId,
      attempts: status.attempts,
      duration: Math.floor((Date.now() - status.startTime) / 1000),
      callId: status.callId,
    })),
  };
  return stats;
}

// ==================== INBOUND CALL POLLING ====================

/**
 * Start polling for inbound calls across all agents
 */
export function startInboundPolling(
  emitCallUpdate?: (orgId: string, call: any) => void,
  emitMetricsUpdate?: (orgId: string, metrics: any) => void
) {
  if (inboundPollInterval) {
    console.log('[Inbound Poll] Already running');
    return;
  }

  console.log(`📞 [Inbound Poll] Starting inbound call polling (every ${INBOUND_POLL_INTERVAL_MS / 1000}s)`);

  // Run immediately
  pollInboundCalls(emitCallUpdate, emitMetricsUpdate);

  // Then run on interval
  inboundPollInterval = setInterval(() => {
    pollInboundCalls(emitCallUpdate, emitMetricsUpdate);
  }, INBOUND_POLL_INTERVAL_MS);
}

/**
 * Stop inbound call polling
 */
export function stopInboundPolling() {
  if (inboundPollInterval) {
    clearInterval(inboundPollInterval);
    inboundPollInterval = null;
    console.log('🛑 [Inbound Poll] Stopped inbound call polling');
  }
}

/**
 * Poll for inbound calls across all organizations and agents
 */
async function pollInboundCalls(
  emitCallUpdate?: (orgId: string, call: any) => void,
  emitMetricsUpdate?: (orgId: string, metrics: any) => void
) {
  console.log('[Inbound Poll] 📞 Checking for new inbound calls...');

  try {
    // Get all organizations
    const orgs = await db.select().from(organizations);

    for (const org of orgs) {
      // Get all AI agents with Bolna IDs for this org
      const agents = await db.select().from(aiAgents).where(
        and(
          eq(aiAgents.organizationId, org.id),
          // Only agents with bolnaAgentId
        )
      );

      for (const agent of agents) {
        if (!agent.bolnaAgentId) continue;

        try {
          await syncInboundCallsForAgent(agent, org.id, emitCallUpdate, emitMetricsUpdate);
        } catch (err: any) {
          console.error(`[Inbound Poll] Error syncing agent ${agent.name}:`, err.message);
        }
      }
    }
  } catch (err: any) {
    console.error('[Inbound Poll] Error:', err.message);
  }
}

/**
 * Sync inbound calls for a specific agent
 */
async function syncInboundCallsForAgent(
  agent: any,
  organizationId: string,
  emitCallUpdate?: (orgId: string, call: any) => void,
  emitMetricsUpdate?: (orgId: string, metrics: any) => void
) {
  // Fetch executions from Bolna
  const executions = await bolnaClient.getAgentExecutions(agent.bolnaAgentId, 1, 50);

  if (!executions || !executions.executions || executions.executions.length === 0) {
    return;
  }

  // Filter for inbound calls
  const inboundCalls = executions.executions.filter((e: any) =>
    e.telephony_data?.call_type === 'inbound'
  );

  if (inboundCalls.length === 0) {
    return;
  }

  let newCallsCount = 0;

  for (const exec of inboundCalls) {
    const executionId = exec.id;

    // Skip if already processed in this session
    if (processedInboundIds.has(executionId)) {
      continue;
    }

    // Check if call already exists in database
    const existing = await db.select().from(calls).where(eq(calls.bolnaCallId, executionId));
    if (existing.length > 0) {
      processedInboundIds.add(executionId);
      continue;
    }

    // Extract call data
    const callerPhone = exec.telephony_data?.from_number || exec.user_number;
    const createdAt = exec.created_at;
    const updatedAt = exec.updated_at;
    const totalCost = exec.total_cost || 0;
    const conversationDuration = exec.conversation_duration || 0;
    const recordingUrl = exec.telephony_data?.recording_url;
    const transcript = exec.transcript;

    const duration = Math.round(parseFloat(String(conversationDuration)) || 0);
    
    // Bolna API returns cost in cents, convert to dollars
    const totalCostDollars = totalCost / 100;
    // Calculate cost per minute for display
    const costPerMin = duration > 0 ? (totalCostDollars / (duration / 60)) : 0;

    // Insert new call record
    const result = await db.insert(calls).values({
      organizationId: organizationId,
      agentId: agent.id,
      direction: 'inbound',
      callType: 'inbound',
      status: exec.status === 'completed' ? 'completed' : exec.status,
      contactPhone: callerPhone,
      startedAt: createdAt ? new Date(createdAt) : new Date(),
      endedAt: updatedAt ? new Date(updatedAt) : null,
      duration: duration,
      bolnaCostPerMinute: costPerMin,
      recordingUrl: recordingUrl || null,
      transcription: transcript || null,
      bolnaCallId: executionId,
      metadata: exec
    }).returning();

    processedInboundIds.add(executionId);
    newCallsCount++;

    console.log(`[Inbound Poll] ✅ Synced inbound call from ${callerPhone} (${duration}s, $${totalCostDollars.toFixed(4)})`);

    // Emit real-time updates
    if (emitCallUpdate && result[0]) {
      emitCallUpdate(organizationId, result[0]);
    }
  }

  if (newCallsCount > 0) {
    console.log(`[Inbound Poll] 📊 Synced ${newCallsCount} new inbound calls for agent "${agent.name}"`);

    // Update metrics
    if (emitMetricsUpdate) {
      const metrics = await storage.getDashboardMetrics(organizationId);
      emitMetricsUpdate(organizationId, metrics);
    }
  }
}
