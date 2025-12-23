import "dotenv/config";
import { db } from "../server/db";
import { aiAgents, organizations } from "@shared/schema";
import { bolnaClient } from "../server/bolna";
import { eq } from "drizzle-orm";

async function updateAgentWebhooks() {
  console.log("🔄 Starting webhook configuration for existing agents...\n");

  const webhookUrl = process.env.PUBLIC_WEBHOOK_URL 
    ? `${process.env.PUBLIC_WEBHOOK_URL}/api/webhooks/bolna/call-status`
    : null;

  if (!webhookUrl) {
    console.error("❌ PUBLIC_WEBHOOK_URL not set in .env file");
    process.exit(1);
  }

  console.log(`📡 Webhook URL: ${webhookUrl}\n`);

  try {
    // Get all AI agents from database with their organization info
    const allAgents = await db
      .select({
        id: aiAgents.id,
        name: aiAgents.name,
        bolnaAgentId: aiAgents.bolnaAgentId,
        organizationId: aiAgents.organizationId,
        orgName: organizations.name,
      })
      .from(aiAgents)
      .leftJoin(organizations, eq(aiAgents.organizationId, organizations.id));
    
    let totalAgents = allAgents.length;
    let updatedAgents = 0;
    let skippedAgents = 0;
    let failedAgents = 0;

    console.log(`📊 Found ${totalAgents} agents in database\n`);

    for (const agent of allAgents) {
      try {
        console.log(`📝 Processing: ${agent.name}`);
        console.log(`   Organization: ${agent.orgName || 'Unknown'}`);
        console.log(`   Bolna ID: ${agent.bolnaAgentId || 'N/A'}`);

        if (!agent.bolnaAgentId) {
          console.log(`   ⚠️  Skipping - No Bolna Agent ID\n`);
          skippedAgents++;
          continue;
        }

        // Update the agent in Bolna with webhook URL
        const updateConfig = {
          agent_config: {
            webhook_url: webhookUrl,
          }
        };

        await bolnaClient.request(`/v2/agent/${agent.bolnaAgentId}`, {
          method: "PATCH",
          body: JSON.stringify(updateConfig),
        });

        updatedAgents++;
        console.log(`   ✅ Webhook configured successfully\n`);

      } catch (error: any) {
        failedAgents++;
        console.error(`   ❌ Failed: ${error.message}\n`);
      }
    }

    console.log("=".repeat(60));
    console.log("📊 Summary:");
    console.log(`   Total agents: ${totalAgents}`);
    console.log(`   Updated: ${updatedAgents}`);
    console.log(`   Skipped: ${skippedAgents}`);
    console.log(`   Failed: ${failedAgents}`);
    console.log("=".repeat(60));

    if (updatedAgents > 0) {
      console.log("\n✅ Webhook configuration complete!");
      console.log(`   ${updatedAgents} agent(s) will now send updates to:`);
      console.log(`   ${webhookUrl}`);
    } else {
      console.log("\n⚠️  No agents were updated");
    }

  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

// Run the script
updateAgentWebhooks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
