import "dotenv/config";
import { bolnaClient } from "../server/bolna";

async function checkAgentWebhook() {
  try {
    const agentId = "20bca256-5a9a-408f-a413-350f3accb142"; // priya agent
    
    console.log(`\n🔍 Checking agent webhook configuration...`);
    console.log(`Agent ID: ${agentId}\n`);
    
    const agent = await bolnaClient.getAgent(agentId);
    
    console.log("Agent Details:");
    console.log(JSON.stringify(agent, null, 2));
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

checkAgentWebhook()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
