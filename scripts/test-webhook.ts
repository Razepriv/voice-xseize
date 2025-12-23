/**
 * Script to validate and test webhook endpoint
 * Usage: npx tsx scripts/test-webhook.ts [organizationId] [webhookDomain]
 */

import "dotenv/config";
import { db } from "../server/db";
import { calls, organizations } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

interface WebhookTestPayload {
  id: string;
  conversation_duration: number;
  total_cost: number;
  transcript: string;
  recording_url: string;
  status: string;
  context_details: {
    recipient_data: {
      callId: string;
      organizationId: string;
    };
  };
  telephony_data?: {
    recording_url?: string;
  };
  call_details?: any;
  metadata?: any;
}

async function testWebhook() {
  try {
    console.log("🧪 Testing webhook endpoint...\n");

    const orgId = process.argv[2];
    const webhookDomain = process.argv[3] || process.env.PUBLIC_WEBHOOK_URL || "https://platform.automitra.ai";

    if (!orgId) {
      console.error("❌ Usage: npx tsx scripts/test-webhook.ts <organizationId> [webhookDomain]");
      return;
    }

    // Get a recent completed call
    const recentCall = await db
      .select()
      .from(calls)
      .where(eq(calls.organizationId, orgId))
      .orderBy(desc(calls.startedAt))
      .limit(1);

    if (!recentCall.length) {
      console.error("❌ No calls found for organization");
      return;
    }

    const testCall = recentCall[0];
    console.log(`📞 Test call: ${testCall.id}`);
    console.log(`📞 Contact: ${testCall.contactName || testCall.contactPhone}`);
    console.log(`📞 Status: ${testCall.status}`);
    console.log(`📞 Duration: ${testCall.duration}s\n`);

    // Create webhook test payload
    const testPayload: WebhookTestPayload = {
      id: testCall.bolnaCallId || "test-bolna-id-123",
      conversation_duration: testCall.duration || 120,
      total_cost: 0.50,
      transcript: testCall.transcription || "This is a test transcript of the call.",
      recording_url: testCall.recordingUrl || "https://example.com/recording.mp3",
      status: "completed",
      context_details: {
        recipient_data: {
          callId: testCall.id,
          organizationId: orgId,
        },
      },
      telephony_data: {
        recording_url: testCall.recordingUrl || "https://example.com/recording.mp3",
      },
      call_details: {
        duration: testCall.duration,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    };

    console.log("📡 Sending test webhook payload...\n");
    console.log(JSON.stringify(testPayload, null, 2));

    const webhookUrl = `${webhookDomain}/api/webhooks/bolna/call-status`;
    console.log(`\n🔗 Webhook URL: ${webhookUrl}\n`);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      });

      console.log(`📊 Response status: ${response.status}`);
      const responseData = await response.json();
      console.log(`📊 Response body:`, JSON.stringify(responseData, null, 2));

      if (response.ok) {
        console.log("\n✅ Webhook test successful!");
        console.log("📋 Next steps:");
        console.log("   1. Check server logs for webhook processing logs");
        console.log("   2. Verify call was updated with test data");
        console.log("   3. Check real-time updates are being sent to clients");
      } else {
        console.log("\n❌ Webhook test failed!");
        console.log("📋 Check:");
        console.log("   1. Webhook URL is accessible");
        console.log("   2. Server is running and responding");
        console.log("   3. Payload structure matches expectations");
      }
    } catch (error) {
      console.error("❌ Error sending webhook:", error instanceof Error ? error.message : String(error));
      console.log("\n📋 Troubleshooting:");
      console.log("   1. Verify webhook domain is correct");
      console.log("   2. Check if server is running");
      console.log("   3. Verify firewall/network allows outbound requests");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testWebhook();
