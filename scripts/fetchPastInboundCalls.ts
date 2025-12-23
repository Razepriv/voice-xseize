/**
 * Script to fetch all past inbound calls from Bolna and sync them to the database
 * Run with: npx tsx scripts/fetchPastInboundCalls.ts
 */

import 'dotenv/config';
import { storage } from '../server/storage';
import { bolnaClient } from '../server/bolna';
import { db } from '../server/db';
import { organizations } from '@shared/schema';

async function fetchAllPastInboundCalls() {
  console.log('🔄 Fetching all past inbound calls from Bolna...\n');
  
  // Get all organizations directly from DB
  const orgs = await db.select().from(organizations);
  console.log(`Found ${orgs.length} organizations\n`);
  
  let totalInboundFound = 0;
  let totalSynced = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  for (const org of orgs) {
    console.log(`\n📁 Processing organization: ${org.name} (ID: ${org.id})`);
    
    // Get all AI agents for this org
    const agents = await storage.getAIAgents(org.id);
    console.log(`   Found ${agents.length} AI agents`);
    
    for (const agent of agents) {
      if (!agent.bolnaAgentId) {
        console.log(`   ⏭️ Skipping agent "${agent.name}" - no Bolna ID`);
        continue;
      }
      
      console.log(`\n   🤖 Checking agent: ${agent.name} (Bolna ID: ${agent.bolnaAgentId})`);
      
      try {
        // Fetch executions with pagination - get more pages to capture all historical data
        let page = 1;
        const perPage = 100;
        let hasMore = true;
        let agentInboundCount = 0;
        let agentSyncedCount = 0;
        
        while (hasMore) {
          console.log(`      📄 Fetching page ${page}...`);
          
          const executions = await bolnaClient.getAgentExecutions(agent.bolnaAgentId, page, perPage);
          
          if (!executions || !executions.executions || executions.executions.length === 0) {
            console.log(`      No more executions found on page ${page}`);
            hasMore = false;
            continue;
          }
          
          console.log(`      Found ${executions.executions.length} executions on page ${page}`);
          
          // Log first execution to see structure
          if (page === 1 && executions.executions.length > 0) {
            const sample = executions.executions[0];
            console.log(`      Sample execution structure:`, JSON.stringify({
              id: sample.id,
              direction: sample.direction,
              call_type: sample.telephony_data?.call_type,
              status: sample.status,
              telephony_data: sample.telephony_data ? {
                direction: sample.telephony_data.direction,
                call_type: sample.telephony_data.call_type,
                from_number: sample.telephony_data.from_number,
                to_number: sample.telephony_data.to_number
              } : null
            }, null, 2));
          }
          
          // Filter for inbound calls - check telephony_data.call_type
          const inboundCalls = executions.executions.filter((exec: any) => {
            const isInbound = 
              exec.direction === 'inbound' || 
              exec.call_type === 'inbound' ||
              (exec.telephony_data && exec.telephony_data.call_type === 'inbound') ||
              (exec.telephony_data && exec.telephony_data.direction === 'inbound');
            return isInbound;
          });
          
          console.log(`      Found ${inboundCalls.length} inbound calls on this page`);
          agentInboundCount += inboundCalls.length;
          
          for (const exec of inboundCalls) {
            const executionId = exec.id || exec.execution_id;
            
            try {
              // Check if call already exists
              const existingCall = await storage.getCallByBolnaCallId(executionId);
              if (existingCall) {
                console.log(`      ⏭️ Call already exists: ${executionId}`);
                totalSkipped++;
                continue;
              }
              
              // Create the call record (skip phone number lookup for simplicity)
              const durationRaw = exec.conversation_duration || exec.telephony_data?.duration || 0;
              const duration = Math.round(parseFloat(String(durationRaw)) || 0);
              
              const callData = {
                organizationId: org.id,
                campaignId: null,
                contactId: null,
                phoneNumberId: null,
                aiAgentId: agent.id,
                direction: 'inbound' as const,
                status: mapStatus(exec.status),
                startTime: exec.created_at ? new Date(exec.created_at) : new Date(),
                endTime: exec.updated_at ? new Date(exec.updated_at) : null,
                duration: duration,
                cost: String(exec.total_cost || 0),
                recordingUrl: exec.telephony_data?.recording_url || null,
                transcription: exec.transcript || null,
                transcriptUrl: null,
                bolnaCallId: executionId,
                bolnaDetails: exec
              };
              
              const newCall = await storage.createCall(callData);
              console.log(`      ✅ Created call record: ${newCall.id} (from: ${exec.telephony_data?.from_number || exec.user_number || 'unknown'})`);
              agentSyncedCount++;
              totalSynced++;
            } catch (err: any) {
              console.log(`      ❌ Error syncing call ${executionId}:`, err.message);
              totalErrors++;
            }
          }
          
          // Check if there are more pages
          if (executions.executions.length < perPage) {
            hasMore = false;
          } else {
            page++;
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        totalInboundFound += agentInboundCount;
        console.log(`   📊 Agent "${agent.name}": ${agentInboundCount} inbound calls found, ${agentSyncedCount} synced`);
        
      } catch (err: any) {
        console.log(`   ❌ Error fetching executions for agent:`, err.message);
        totalErrors++;
      }
    }
  }
  
  console.log('\n========================================');
  console.log('📊 Summary:');
  console.log(`   Total inbound calls found: ${totalInboundFound}`);
  console.log(`   New calls synced: ${totalSynced}`);
  console.log(`   Already existing (skipped): ${totalSkipped}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log('========================================');
}

function mapStatus(bolnaStatus: string): 'completed' | 'failed' | 'busy' | 'no-answer' | 'in-progress' | 'queued' {
  const statusMap: Record<string, 'completed' | 'failed' | 'busy' | 'no-answer' | 'in-progress' | 'queued'> = {
    'completed': 'completed',
    'complete': 'completed',
    'finished': 'completed',
    'ended': 'completed',
    'failed': 'failed',
    'error': 'failed',
    'busy': 'busy',
    'no-answer': 'no-answer',
    'noanswer': 'no-answer',
    'in-progress': 'in-progress',
    'inprogress': 'in-progress',
    'ongoing': 'in-progress',
    'ringing': 'in-progress',
    'queued': 'queued',
    'pending': 'queued',
  };
  
  return statusMap[bolnaStatus?.toLowerCase()] || 'completed';
}

// Run the script
fetchAllPastInboundCalls()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });
