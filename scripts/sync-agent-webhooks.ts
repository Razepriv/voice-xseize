import "dotenv/config";
import { db } from "../server/db";
import { aiAgents } from "../shared/schema";
import { bolnaClient } from "../server/bolna";
import { eq } from "drizzle-orm";

async function syncAgentWebhooks() {
  console.log("\n🔄 SYNCING AGENT WEBHOOKS\n");
  console.log("=".repeat(60));
  
  const webhookUrl = process.env.PUBLIC_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("❌ PUBLIC_WEBHOOK_URL not set in environment");
    return;
  }
  
  const normalizedUrl = webhookUrl.startsWith('http') 
    ? webhookUrl 
    : `https://${webhookUrl}`;
  
  const expectedWebhookUrl = `${normalizedUrl}/api/webhooks/bolna/call-status`;
  
  console.log(`📍 Target webhook URL: ${expectedWebhookUrl}\n`);
  
  try {
    // Get all agents from database
    const agents = await db.select().from(aiAgents);
    
    if (agents.length === 0) {
      console.log("✅ No agents found in database");
      return;
    }
    
    console.log(`Found ${agents.length} agents in database\n`);
    
    let successCount = 0;
    let notFoundCount = 0;
    let noSyncCount = 0;
    const agentsToRecreate: any[] = [];
    
    for (const agent of agents) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📋 Agent: ${agent.name}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Bolna ID: ${agent.bolnaAgentId || '❌ Not synced'}`);
      
      if (!agent.bolnaAgentId) {
        console.log(`   ⏭️  Skipped - Never synced to Bolna`);
        noSyncCount++;
        
        // Check if agent has required fields to sync
        if (agent.voiceId && agent.voiceProvider) {
          console.log(`   💡 This agent CAN be synced (has voice configuration)`);
          agentsToRecreate.push(agent);
        } else {
          console.log(`   ⚠️  Cannot sync - missing voice configuration`);
        }
        continue;
      }
      
      try {
        // Try to get agent from Bolna
        const bolnaAgent = await bolnaClient.getAgent(agent.bolnaAgentId);
        const currentWebhook = bolnaAgent.agent_config?.webhook_url;
        
        console.log(`   Current webhook: ${currentWebhook || "❌ Not set"}`);
        
        if (currentWebhook === expectedWebhookUrl) {
          console.log(`   ✅ Webhook already correct - no update needed`);
          successCount++;
          continue;
        }
        
        // Update the webhook URL
        console.log(`   🔄 Updating webhook URL...`);
        
        const updatedConfig = {
          ...bolnaAgent,
          agent_config: {
            ...bolnaAgent.agent_config,
            webhook_url: expectedWebhookUrl
          }
        };
        
        await bolnaClient.updateAgentRaw(agent.bolnaAgentId, updatedConfig);
        
        console.log(`   ✅ Webhook updated successfully!`);
        successCount++;
        
      } catch (error: any) {
        if (error.status === 404) {
          console.log(`   ❌ Agent not found in Bolna (deleted or expired)`);
          notFoundCount++;
          agentsToRecreate.push(agent);
        } else {
          console.log(`   ❌ Error: ${error.message}`);
        }
      }
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📊 SUMMARY\n`);
    console.log(`✅ Webhooks updated: ${successCount}`);
    console.log(`⏭️  Never synced: ${noSyncCount}`);
    console.log(`❌ Not found in Bolna: ${notFoundCount}`);
    console.log(`📋 Total agents: ${agents.length}`);
    
    // Recommendations
    if (agentsToRecreate.length > 0) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`\n💡 RECOMMENDED ACTIONS\n`);
      console.log(`${agentsToRecreate.length} agent(s) need to be recreated in Bolna:\n`);
      
      agentsToRecreate.forEach(agent => {
        console.log(`📌 ${agent.name}`);
        console.log(`   - Database ID: ${agent.id}`);
        console.log(`   - Status: ${agent.bolnaAgentId ? 'Missing from Bolna' : 'Never synced'}`);
        console.log(`   - Has voice config: ${agent.voiceId && agent.voiceProvider ? 'YES' : 'NO'}`);
      });
      
      console.log(`\n🔧 Options to fix:\n`);
      console.log(`1. Recreate via UI:`);
      console.log(`   - Go to AI Agents page`);
      console.log(`   - Edit each agent and click "Sync to Bolna"`);
      console.log(`   - Webhook will be automatically configured\n`);
      
      console.log(`2. Delete and recreate:`);
      console.log(`   - Delete these agents from UI`);
      console.log(`   - Create new agents with same settings`);
      console.log(`   - Webhooks will be auto-configured\n`);
      
      console.log(`3. Use sync endpoint (if available):`);
      console.log(`   - POST /api/ai-agents/{id}/sync`);
      console.log(`   - This will create agent in Bolna with webhook\n`);
    } else {
      console.log(`\n✅ All agents are properly configured!`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n🎯 NEXT STEPS\n`);
    console.log(`1. Test webhook with new call:`);
    console.log(`   - Create/sync an agent with voice configuration`);
    console.log(`   - Make a test call`);
    console.log(`   - Watch for webhook logs\n`);
    
    console.log(`2. Monitor webhook activity:`);
    console.log(`   - Look for: [Bolna Webhook] Received at...`);
    console.log(`   - Check: 📊 Data received:`);
    console.log(`   - Verify: 🚀 Emitting call:updated\n`);
    
    console.log(`3. From now on, ALL NEW AGENTS will automatically`);
    console.log(`   have webhooks configured - no manual setup needed!\n`);
    
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    throw error;
  }
}

syncAgentWebhooks()
  .then(() => {
    console.log("✅ Sync complete\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
