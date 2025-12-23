import 'dotenv/config';
import { db } from '../server/db';
import { calls, aiAgents } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { bolnaClient } from '../server/bolna';

async function syncInboundForRazeen() {
  const agentId = 'e9e48872-866b-4a21-bbd3-8346b80c304e';
  
  // Find the agent in our database
  const agents = await db.select().from(aiAgents).where(eq(aiAgents.bolnaAgentId, agentId));
  
  if (agents.length === 0) {
    console.log('Agent not found in database');
    return;
  }

  const agent = agents[0];
  console.log('Found agent:', agent.name, 'Org ID:', agent.organizationId);

  // Fetch executions from Bolna
  const executions = await bolnaClient.getAgentExecutions(agentId, 1, 100);
  console.log('Total executions:', executions.Count);

  // Filter inbound
  const inboundCalls = executions.executions.filter((e: any) =>
    e.telephony_data?.call_type === 'inbound'
  );

  console.log('Inbound calls found:', inboundCalls.length);

  for (const exec of inboundCalls) {
    console.log('\nProcessing inbound call:', exec.id);
    console.log('  From:', exec.telephony_data?.from_number);
    console.log('  To:', exec.telephony_data?.to_number);
    console.log('  Duration:', exec.conversation_duration);
    console.log('  Cost:', exec.total_cost);

    // Check if exists
    const existing = await db.select().from(calls).where(eq(calls.bolnaCallId, exec.id));
    if (existing.length > 0) {
      console.log('  Already exists, skipping');
      continue;
    }

    // Insert
    const durationRaw = exec.conversation_duration || exec.telephony_data?.duration || 0;
    const duration = Math.round(parseFloat(String(durationRaw)) || 0);

    const result = await db.insert(calls).values({
      organizationId: agent.organizationId,
      aiAgentId: agent.id,
      direction: 'inbound',
      status: 'completed',
      startTime: new Date(exec.created_at),
      endTime: exec.updated_at ? new Date(exec.updated_at) : null,
      duration: duration,
      cost: String(exec.total_cost || 0),
      recordingUrl: exec.telephony_data?.recording_url || null,
      transcription: exec.transcript || null,
      bolnaCallId: exec.id,
      bolnaDetails: exec
    }).returning();

    console.log('  ✅ Created call:', result[0].id);
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

syncInboundForRazeen().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
