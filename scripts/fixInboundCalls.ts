/**
 * Script to fix inbound call records with missing data
 */

import 'dotenv/config';
import { db } from '../server/db';
import { calls, aiAgents } from '../shared/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { bolnaClient } from '../server/bolna';

async function fixInboundCalls() {
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
  
  // Get all inbound calls that need fixing
  const inboundCalls = await db.select().from(calls).where(eq(calls.direction, 'inbound'));
  console.log('\n📞 Found', inboundCalls.length, 'inbound calls');
  
  for (const call of inboundCalls) {
    console.log('\n--- Call ID:', call.id);
    console.log('    Bolna Call ID:', call.bolnaCallId);
    console.log('    Current startTime:', call.startTime);
    console.log('    Current aiAgentId:', call.aiAgentId);
    console.log('    Current cost:', call.cost);
    
    // Get data from bolnaDetails if available
    const bolnaDetails = call.bolnaDetails as any;
    
    if (bolnaDetails) {
      const fromNumber = bolnaDetails.telephony_data?.from_number || bolnaDetails.user_number;
      const toNumber = bolnaDetails.telephony_data?.to_number || bolnaDetails.agent_number;
      const createdAt = bolnaDetails.created_at;
      const updatedAt = bolnaDetails.updated_at;
      const totalCost = bolnaDetails.total_cost;
      const duration = bolnaDetails.conversation_duration || bolnaDetails.telephony_data?.duration;
      const recordingUrl = bolnaDetails.telephony_data?.recording_url;
      const transcript = bolnaDetails.transcript;
      
      console.log('    From bolnaDetails:');
      console.log('      fromNumber:', fromNumber);
      console.log('      toNumber:', toNumber);
      console.log('      createdAt:', createdAt);
      console.log('      totalCost:', totalCost);
      console.log('      duration:', duration);
      console.log('      recordingUrl:', recordingUrl ? 'Yes' : 'No');
      
      // Update the call record
      const updates: any = {};
      
      if (!call.aiAgentId && agent.id) {
        updates.aiAgentId = agent.id;
      }
      
      if (!call.startTime && createdAt) {
        updates.startTime = new Date(createdAt);
      }
      
      if (!call.endTime && updatedAt) {
        updates.endTime = new Date(updatedAt);
      }
      
      if ((!call.cost || call.cost === '0') && totalCost) {
        updates.cost = String(totalCost);
      }
      
      if (!call.duration && duration) {
        updates.duration = Math.round(parseFloat(String(duration)) || 0);
      }
      
      if (!call.recordingUrl && recordingUrl) {
        updates.recordingUrl = recordingUrl;
      }
      
      if (!call.transcription && transcript) {
        updates.transcription = transcript;
      }
      
      // Store caller phone number in metadata or a field
      // For inbound calls, the "from" number is the caller
      if (fromNumber) {
        // We'll store this in bolnaDetails if not already there
        if (!bolnaDetails.caller_phone) {
          updates.bolnaDetails = {
            ...bolnaDetails,
            caller_phone: fromNumber
          };
        }
      }
      
      if (Object.keys(updates).length > 0) {
        console.log('    Updating with:', Object.keys(updates).join(', '));
        await db.update(calls).set(updates).where(eq(calls.id, call.id));
        console.log('    ✅ Updated!');
      } else {
        console.log('    ⏭️ No updates needed');
      }
    } else {
      console.log('    ⚠️ No bolnaDetails available, fetching from API...');
      
      if (call.bolnaCallId) {
        try {
          const details = await bolnaClient.getCallDetails(call.bolnaCallId);
          console.log('    Fetched details:', JSON.stringify(details, null, 2).substring(0, 200));
        } catch (err: any) {
          console.log('    ❌ Failed to fetch:', err.message);
        }
      }
    }
  }
  
  console.log('\n========================================');
  console.log('✅ Fix complete!');
  console.log('========================================');
}

fixInboundCalls()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
