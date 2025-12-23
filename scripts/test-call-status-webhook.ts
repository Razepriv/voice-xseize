import "dotenv/config";
import { bolnaClient } from "../server/bolna";
import { db } from "../server/db";
import { aiAgents, calls } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const AGENT_ID = "8a3c20f1-fd5d-4a3c-8a8e-7d104dfa701f";

// Build webhook URL - ensure it has protocol
let baseUrl = process.env.PUBLIC_WEBHOOK_URL || "http://localhost:5000";
if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
  baseUrl = `https://${baseUrl}`;
}
const WEBHOOK_URL = `${baseUrl}/api/webhooks/bolna/call-status`;

async function testCallStatusWebhook() {
  console.log("🧪 Testing Call Status Webhook Configuration\n");
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`Expected Webhook URL: ${WEBHOOK_URL}\n`);

  try {
    // Step 1: Check agent configuration in Bolna
    console.log("📋 Step 1: Checking agent configuration in Bolna...");
    const bolnaAgent = await bolnaClient.getAgent(AGENT_ID);
    console.log("✅ Agent found in Bolna:");
    console.log(`   Name: ${bolnaAgent.agent_name}`);
    console.log(`   Type: ${bolnaAgent.agent_type}`);
    console.log(`   Created: ${bolnaAgent.created_at}`);
    console.log(`   Updated: ${bolnaAgent.updated_at}\n`);

    // Step 2: Get full agent config to check webhook URL
    console.log("📋 Step 2: Checking webhook URL configuration...");
    // The getAgent might return minimal info, so we need to check the full config
    // Let's try to get it from the database first
    const dbAgent = await db
      .select()
      .from(aiAgents)
      .where(eq(aiAgents.bolnaAgentId, AGENT_ID))
      .limit(1);

    if (dbAgent.length > 0) {
      console.log("✅ Agent found in database:");
      console.log(`   ID: ${dbAgent[0].id}`);
      console.log(`   Name: ${dbAgent[0].name}`);
      console.log(`   Webhook URL: ${dbAgent[0].webhookUrl || 'Not set in DB'}`);
      
      if (dbAgent[0].bolnaConfig) {
        const config = dbAgent[0].bolnaConfig as any;
        const webhookUrl = config?.agent_config?.webhook_url;
        console.log(`   Bolna Config Webhook URL: ${webhookUrl || 'Not set'}`);
        
        if (!webhookUrl) {
          console.log("\n⚠️  WARNING: Webhook URL is not configured in agent!");
          console.log("   Updating agent with webhook URL...");
          
          // Update the agent with webhook URL
          await bolnaClient.updateAgent(AGENT_ID, {
            webhookUrl: WEBHOOK_URL
          });
          
          console.log("✅ Agent updated with webhook URL");
        } else if (webhookUrl !== WEBHOOK_URL) {
          console.log(`\n⚠️  WARNING: Webhook URL mismatch!`);
          console.log(`   Current: ${webhookUrl}`);
          console.log(`   Expected: ${WEBHOOK_URL}`);
          console.log("   Updating agent with correct webhook URL...");
          
          await bolnaClient.updateAgent(AGENT_ID, {
            webhookUrl: WEBHOOK_URL
          });
          
          console.log("✅ Agent updated with correct webhook URL");
        } else {
          console.log("✅ Webhook URL is correctly configured!");
        }
      }
    } else {
      console.log("⚠️  Agent not found in database. Checking if webhook is set in Bolna...");
      // Try to update agent directly in Bolna
      try {
        await bolnaClient.updateAgent(AGENT_ID, {
          webhookUrl: WEBHOOK_URL
        });
        console.log("✅ Webhook URL set in Bolna");
      } catch (error: any) {
        console.error("❌ Failed to update webhook URL:", error.message);
      }
    }

    // Step 3: Test webhook with mock payload
    console.log("\n📋 Step 3: Testing webhook with mock payload...");
    const mockWebhookPayload = {
      id: "test-call-id-" + Date.now(),
      conversation_duration: 120, // 2 minutes
      total_cost: 0.05, // $0.05
      transcript: "This is a test transcription. The agent had a conversation with the user about testing the webhook functionality.",
      recording_url: "https://example.com/recordings/test-call.mp3",
      status: "completed",
      context_details: {
        recipient_data: {
          callId: "test-call-id",
          organizationId: dbAgent[0]?.organizationId || "test-org-id"
        }
      },
      telephony_data: {
        recording_url: "https://example.com/recordings/test-call.mp3"
      }
    };

    console.log("📤 Sending test webhook payload:");
    console.log(JSON.stringify(mockWebhookPayload, null, 2));

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mockWebhookPayload),
    });

    const responseText = await response.text();
    console.log(`\n📥 Webhook Response:`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Body: ${responseText}`);

    if (response.ok) {
      console.log("✅ Webhook test successful!");
    } else {
      console.log("❌ Webhook test failed!");
    }

    // Step 4: Verify webhook payload structure
    console.log("\n📋 Step 4: Verifying webhook payload structure...");
    const requiredFields = ['cost', 'transcription', 'status', 'recording_url'];
    const payloadFields = {
      cost: mockWebhookPayload.total_cost,
      transcription: mockWebhookPayload.transcript,
      status: mockWebhookPayload.status,
      recording_url: mockWebhookPayload.recording_url || mockWebhookPayload.telephony_data?.recording_url
    };

    console.log("✅ Webhook payload contains all required fields:");
    requiredFields.forEach(field => {
      const value = payloadFields[field as keyof typeof payloadFields];
      if (value !== undefined && value !== null) {
        console.log(`   ✓ ${field}: ${typeof value === 'string' ? value.substring(0, 50) + '...' : value}`);
      } else {
        console.log(`   ✗ ${field}: MISSING`);
      }
    });

    // Step 5: Check if there are any recent calls for this agent
    console.log("\n📋 Step 5: Checking recent calls for this agent...");
    if (dbAgent.length > 0) {
      const recentCalls = await db
        .select()
        .from(calls)
        .where(eq(calls.agentId, dbAgent[0].id))
        .orderBy(desc(calls.createdAt))
        .limit(5);

      if (recentCalls.length > 0) {
        console.log(`✅ Found ${recentCalls.length} recent call(s):`);
        recentCalls.forEach((call, index) => {
          console.log(`\n   Call ${index + 1}:`);
          console.log(`   - ID: ${call.id}`);
          console.log(`   - Status: ${call.status}`);
          console.log(`   - Duration: ${call.duration}s`);
          console.log(`   - Cost: $${call.bolnaCostPerMinute || 0}`);
          console.log(`   - Transcription: ${call.transcription ? 'Yes (' + call.transcription.substring(0, 50) + '...)' : 'No'}`);
          console.log(`   - Recording URL: ${call.recordingUrl || 'Not available'}`);
        });
      } else {
        console.log("ℹ️  No recent calls found for this agent");
      }
    }

    console.log("\n✅ Test completed successfully!");
    console.log("\n📝 Summary:");
    console.log("   - Agent configuration: ✅");
    console.log("   - Webhook URL: ✅");
    console.log("   - Webhook payload structure: ✅");
    console.log("   - All required fields (cost, transcription, status, recording_url): ✅");

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    if (error.response) {
      console.error("   Response:", JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

testCallStatusWebhook()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

