import "dotenv/config";
import { bolnaClient } from "../server/bolna";

async function listBolnaAgents() {
  console.log("\n📋 LISTING ALL BOLNA AGENTS\n");
  console.log("=" .repeat(60));
  
  try {
    const agents = await bolnaClient.listAgents();
    
    if (!agents || agents.length === 0) {
      console.log("❌ No agents found in Bolna");
      return;
    }
    
    console.log(`✅ Found ${agents.length} agents in Bolna\n`);
    
    agents.forEach((agent: any, index: number) => {
      console.log(`\nAgent #${index + 1}:`);
      console.log(`  ID: ${agent.agent_id}`);
      console.log(`  Name: ${agent.agent_name}`);
      console.log(`  Type: ${agent.agent_type}`);
      console.log(`  Webhook: ${agent.agent_config?.webhook_url || "❌ Not set"}`);
      console.log(`  Created: ${agent.created_at}`);
      console.log(`  Updated: ${agent.updated_at}`);
    });
    
    console.log("\n" + "=".repeat(60));
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

listBolnaAgents()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
