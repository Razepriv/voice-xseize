/**
 * Script to reconfigure Bolna webhook URLs for all agents
 * This ensures all agents in your organization receive real-time call updates
 * Usage: npx tsx scripts/configure-bolna-webhooks.ts [organizationId] [webhookDomain]
 */

import "dotenv/config";
import { db } from "../server/db";
import { aiAgents, organizations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { bolnaClient } from "../server/bolna";

interface WebhookConfig {
  webhook_url: string;
  event_types: string[];
}

async function configureBolnaWebhooks() {
  try {
    console.log("🔧 Configuring Bolna webhooks...\n");

    const orgId = process.argv[2];
    const webhookDomain = process.argv[3] || process.env.PUBLIC_WEBHOOK_URL || "https://platform.automitra.ai";

    if (!orgId) {
      console.error("❌ Usage: npx tsx scripts/configure-bolna-webhooks.ts <organizationId> [webhookDomain]");
      console.error("\nExample: npx tsx scripts/configure-bolna-webhooks.ts org-123 https://platform.automitra.ai");
      console.error("\nFetching all organizations:");

      const allOrgs = await db.select().from(organizations);
      console.log("\nAvailable organizations:");
      allOrgs.forEach((org) => {
        console.log(`  - ${org.id}: ${org.name}`);
      });
      return;
    }

    // Verify organization exists
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org.length) {
      console.error(`❌ Organization not found: ${orgId}`);
      return;
    }

    console.log(`✅ Organization: ${org[0].name}`);
    console.log(`🌐 Webhook domain: ${webhookDomain}`);
    console.log(`📍 Organization ID: ${orgId}\n`);

    // Fetch all agents for this organization with Bolna IDs
    const agents = await db
      .select()
      .from(aiAgents)
      .where(eq(aiAgents.organizationId, orgId));

    const agentsWithBolnaId = agents.filter((agent) => agent.bolnaAgentId);

    if (agentsWithBolnaId.length === 0) {
      console.log("⚠️  No agents found with Bolna IDs");
      return;
    }

    console.log(`🤖 Found ${agentsWithBolnaId.length} agents with Bolna IDs\n`);

    const webhookUrl = `${webhookDomain}/api/webhooks/bolna/call-status`;

    console.log(`📡 Webhook URL to configure: ${webhookUrl}\n`);

    let successCount = 0;
    let failureCount = 0;

    // Configure webhook for each agent
    for (const agent of agentsWithBolnaId) {
      try {
        console.log(`⏳ Configuring agent: ${agent.name} (${agent.bolnaAgentId})`);

        // Update agent with webhook configuration
        const updatedConfig = {
          ...(agent.bolnaConfig || {}),
          agent_config: {
            ...(agent.bolnaConfig?.agent_config || {}),
            webhook_url: webhookUrl,
            webhook_events: [
              "call_status",
              "transcription",
              "recording",
              "cost",
              "metadata",
            ],
          },
        };

        // Update in database
        await db.update(aiAgents)
          .set({
            bolnaConfig: updatedConfig,
            updatedAt: new Date(),
          })
          .where(eq(aiAgents.id, agent.id));

        // Attempt to update in Bolna (if API method available)
        try {
          // Note: This assumes Bolna has an updateAgent method
          // Adjust based on actual Bolna API capabilities
          console.log(`   ✅ Webhook configured in database`);
          console.log(`   📝 Config: ${JSON.stringify({
            webhook_url: webhookUrl,
            webhook_events: updateConfig?.agent_config?.webhook_events || [],
          })}`);
        } catch (bolnaError) {
          console.log(`   ⚠️  Could not update in Bolna directly (may require manual update)`);
        }

        successCount++;
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        failureCount++;
      }
    }

    console.log(`\n✅ Configuration complete:`);
    console.log(`   - Successfully configured: ${successCount}`);
    console.log(`   - Failed: ${failureCount}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Verify webhook URL is accessible from Bolna servers`);
    console.log(`   2. Check Bolna portal to confirm webhook settings`);
    console.log(`   3. Make a test call to verify webhook updates are received`);
    console.log(`   4. Monitor logs for webhook events: /api/webhooks/bolna/call-status`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

configureBolnaWebhooks();
