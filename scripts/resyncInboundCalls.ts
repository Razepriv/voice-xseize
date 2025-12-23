/**
 * Script to delete and resync inbound calls with complete data
 */

import 'dotenv/config';
import { db } from '../server/db';
import { calls, aiAgents } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { bolnaClient } from '../server/bolna';

async function resyncInboundCalls() {
  console.log('Database URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
  
  // Get agent info
  const bolnaAgentId = 'e9e48872-866b-4a21-bbd3-8346b80c304e';
  const agents = await db.select().from(aiAgents).where(eq(aiAgents.bolnaAgentId, bolnaAgentId));
  
  if (agents.length === 0) {
    console.log('❌ Agent not found');
    return;
  }
  
  const agent = agents[0];
  console.log('✅ Agent:', agent.name, '(ID:', agent.id + ')');
  
  // Delete existing inbound calls
  console.log('\n🗑️ Deleting existing inbound calls...');
  const deleted = await db.delete(calls).where(eq(calls.direction, 'inbound')).returning();
  console.log('   Deleted', deleted.length, 'records');
  
  // Fetch fresh data from Bolna
  console.log('\n📞 Fetching executions from Bolna...');
  const executions = await bolnaClient.getAgentExecutions(bolnaAgentId, 1, 100);
  console.log('   Total executions:', executions.Count);
  
  // Filter inbound calls
  const inboundCalls = executions.executions.filter((e: any) =>
    e.telephony_data?.call_type === 'inbound'
  );
  console.log('   Inbound calls:', inboundCalls.length);
  
  // Insert each inbound call with complete data
  for (const exec of inboundCalls) {
    // For inbound: from_number is the caller, to_number is the agent's number
    const callerPhone = exec.telephony_data?.from_number || exec.user_number;
    const toNumber = exec.telephony_data?.to_number || exec.agent_number;
    const createdAt = exec.created_at;
    const updatedAt = exec.updated_at;
    const totalCost = exec.total_cost;
    const conversationDuration = exec.conversation_duration;
    const recordingUrl = exec.telephony_data?.recording_url;
    const transcript = exec.transcript;
    
    console.log('\n📱 Creating call:', exec.id);
    console.log('   Caller (from):', callerPhone);
    console.log('   To:', toNumber);
    console.log('   Created:', createdAt);
    console.log('   Duration:', conversationDuration, 'seconds');
    console.log('   Cost (cents):', totalCost, '=> $' + (totalCost / 100).toFixed(4));
    console.log('   Recording:', recordingUrl ? 'Yes' : 'No');
    
    const duration = Math.round(parseFloat(String(conversationDuration)) || 0);
    
    // Bolna API returns cost in cents, convert to dollars
    const totalCostDollars = (totalCost || 0) / 100;
    // Calculate cost per minute for display
    const costPerMin = duration > 0 ? (totalCostDollars / (duration / 60)) : 0;
    
    const result = await db.insert(calls).values({
      organizationId: agent.organizationId,
      agentId: agent.id,  // Correct field name
      direction: 'inbound',
      callType: 'inbound',
      status: 'completed',
      contactPhone: callerPhone,  // Store the caller's phone number
      startedAt: createdAt ? new Date(createdAt) : new Date(),  // Correct field name
      endedAt: updatedAt ? new Date(updatedAt) : null,
      duration: duration,
      bolnaCostPerMinute: costPerMin,  // Store cost per minute for display
      recordingUrl: recordingUrl || null,
      transcription: transcript || null,
      bolnaCallId: exec.id,
      metadata: exec  // Store full execution data in metadata
    }).returning();
    
    console.log('   ✅ Created:', result[0].id);
  }
  
  console.log('\n========================================');
  console.log('✅ Resync complete!');
  console.log('   Total inbound calls synced:', inboundCalls.length);
  console.log('========================================');
}

resyncInboundCalls()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
