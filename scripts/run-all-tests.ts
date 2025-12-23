/**
 * Master script to run all webhook tests and configurations for all organizations
 * This orchestrates: sync-agent-webhooks, fetch-call-data, configure-bolna-webhooks, test-webhook, sync-bolna-calls
 * Usage: npx tsx scripts/run-all-tests.ts
 */

import "dotenv/config";
import { db } from "../server/db";
import { organizations, calls, aiAgents } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { bolnaClient } from "../server/bolna";
import { storage } from "../server/storage";
import * as fs from "fs";
import * as path from "path";

interface TestResult {
  organizationId: string;
  organizationName: string;
  syncAgents: {
    success: number;
    notFound: number;
    neverSynced: number;
    total: number;
  };
  callData: {
    totalCalls: number;
    callsWithRecordings: number;
    callsWithTranscripts: number;
    completedCalls: number;
  };
  webhookConfig: {
    configured: number;
    failed: number;
  };
  callSync: {
    synced: number;
    skipped: number;
    failed: number;
  };
}

async function runAllTests() {
  const webhookUrl = process.env.PUBLIC_WEBHOOK_URL || "https://platform.automitra.ai";
  const results: TestResult[] = [];

  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║          🚀 MASTER WEBHOOK TEST & CONFIGURATION RUNNER             ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝\n");

  console.log(`🔗 Webhook Domain: ${webhookUrl}`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}\n`);

  // Fetch all organizations
  const allOrgs = await db.select().from(organizations);
  console.log(`📊 Found ${allOrgs.length} organizations\n`);

  // ============ PHASE 1: SYNC ALL AGENTS (Global, not per-org) ============
  console.log("═".repeat(70));
  console.log("PHASE 1: Syncing All Agents");
  console.log("═".repeat(70) + "\n");

  let globalAgentStats = {
    totalAgents: 0,
    successfulSyncs: 0,
    notFoundInBolna: 0,
    neverSynced: 0,
  };

  try {
    const agents = await db.select().from(aiAgents);
    globalAgentStats.totalAgents = agents.length;

    console.log(`🤖 Total agents in database: ${agents.length}\n`);

    for (const agent of agents) {
      const org = allOrgs.find((o) => o.id === agent.organizationId);
      if (!agent.bolnaAgentId) {
        globalAgentStats.neverSynced++;
        console.log(`⏭️  [Never Synced] ${agent.name} (${org?.name})`);
        continue;
      }

      try {
        const bolnaAgent = await bolnaClient.getAgent(agent.bolnaAgentId);
        const currentWebhook = bolnaAgent.agent_config?.webhook_url;
        const expectedWebhook = `${webhookUrl}/api/webhooks/bolna/call-status`;

        if (currentWebhook === expectedWebhook) {
          globalAgentStats.successfulSyncs++;
          console.log(`✅ [Synced] ${agent.name}`);
        } else {
          console.log(`🔄 [Updating] ${agent.name}`);
          const updatedConfig = {
            ...bolnaAgent,
            agent_config: {
              ...bolnaAgent.agent_config,
              webhook_url: expectedWebhook,
            },
          };
          await bolnaClient.updateAgentRaw(agent.bolnaAgentId, updatedConfig);
          globalAgentStats.successfulSyncs++;
          console.log(`✅ [Updated] ${agent.name}`);
        }
      } catch (error: any) {
        if (error.status === 404) {
          globalAgentStats.notFoundInBolna++;
          console.log(`❌ [Not Found] ${agent.name}`);
        } else {
          console.log(`⚠️  [Error] ${agent.name}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error in agent sync phase:", error);
  }

  console.log(`\n📊 Agent Sync Summary:`);
  console.log(`   ✅ Successfully synced: ${globalAgentStats.successfulSyncs}`);
  console.log(`   ❌ Not found in Bolna: ${globalAgentStats.notFoundInBolna}`);
  console.log(`   ⏭️  Never synced: ${globalAgentStats.neverSynced}\n`);

  // ============ PHASE 2-5: Test each organization ============
  for (let i = 0; i < allOrgs.length; i++) {
    const org = allOrgs[i];
    const orgIndex = i + 1;

    console.log("═".repeat(70));
    console.log(`[${orgIndex}/${allOrgs.length}] Testing Organization: ${org.name}`);
    console.log("═".repeat(70));

    const result: TestResult = {
      organizationId: org.id,
      organizationName: org.name,
      syncAgents: { success: 0, notFound: 0, neverSynced: 0, total: 0 },
      callData: { totalCalls: 0, callsWithRecordings: 0, callsWithTranscripts: 0, completedCalls: 0 },
      webhookConfig: { configured: 0, failed: 0 },
      callSync: { synced: 0, skipped: 0, failed: 0 },
    };

    // PHASE 2: Fetch Call Data
    console.log("\n📋 PHASE 2: Fetching Call Data");
    try {
      const orgCalls = await db
        .select()
        .from(calls)
        .where(eq(calls.organizationId, org.id));

      result.callData.totalCalls = orgCalls.length;
      result.callData.callsWithRecordings = orgCalls.filter((c) => c.recordingUrl).length;
      result.callData.callsWithTranscripts = orgCalls.filter((c) => c.transcription).length;
      result.callData.completedCalls = orgCalls.filter((c) => c.status === "completed").length;

      console.log(`   📞 Total calls: ${result.callData.totalCalls}`);
      console.log(`   📹 With recordings: ${result.callData.callsWithRecordings}`);
      console.log(`   📝 With transcripts: ${result.callData.callsWithTranscripts}`);
      console.log(`   ✅ Completed: ${result.callData.completedCalls}`);

      if (result.callData.totalCalls > 0) {
        const fileName = `call-data-${org.name.replace(/\s+/g, "-")}.json`;
        const exportData = orgCalls.map((call) => ({
          id: call.id,
          contactName: call.contactName,
          contactPhone: call.contactPhone,
          status: call.status,
          duration: call.duration,
          recordingUrl: call.recordingUrl,
          transcription: call.transcription ? "✓" : "✗",
          bolnaCallId: call.bolnaCallId,
        }));
        fs.writeFileSync(path.resolve(fileName), JSON.stringify(exportData, null, 2));
        console.log(`   ✅ Exported to: ${fileName}`);
      }
    } catch (error) {
      console.error(`   ❌ Error fetching call data:`, error);
    }

    // PHASE 3: Configure Webhooks
    console.log("\n🔧 PHASE 3: Configuring Webhooks");
    try {
      const orgAgents = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.organizationId, org.id));

      const agentsWithBolnaId = orgAgents.filter((agent) => agent.bolnaAgentId);

      console.log(`   🤖 Agents with Bolna ID: ${agentsWithBolnaId.length}`);

      const expectedWebhookUrl = `${webhookUrl}/api/webhooks/bolna/call-status`;

      for (const agent of agentsWithBolnaId) {
        try {
          const updatedConfig = {
            ...(agent.bolnaConfig || {}),
            agent_config: {
              ...(agent.bolnaConfig?.agent_config || {}),
              webhook_url: expectedWebhookUrl,
              webhook_events: ["call_status", "transcription", "recording", "cost", "metadata"],
            },
          };

          await db.update(aiAgents)
            .set({
              bolnaConfig: updatedConfig,
              updatedAt: new Date(),
            })
            .where(eq(aiAgents.id, agent.id));

          result.webhookConfig.configured++;
          console.log(`   ✅ ${agent.name}`);
        } catch (error) {
          result.webhookConfig.failed++;
          console.log(`   ❌ ${agent.name}`);
        }
      }

      console.log(`   📊 Configured: ${result.webhookConfig.configured}/${agentsWithBolnaId.length}`);
    } catch (error) {
      console.error(`   ❌ Error configuring webhooks:`, error);
    }

    // PHASE 4: Test Webhook Endpoint
    console.log("\n🧪 PHASE 4: Testing Webhook Endpoint");
    try {
      const recentCalls = await db
        .select()
        .from(calls)
        .where(eq(calls.organizationId, org.id));

      if (recentCalls.length === 0) {
        console.log(`   ⏭️  No calls found - skipping webhook test`);
      } else {
        const testCall = recentCalls[0];
        const testPayload = {
          id: testCall.bolnaCallId || "test-id",
          conversation_duration: testCall.duration || 120,
          total_cost: 0.50,
          transcript: testCall.transcription || "Test transcript",
          recording_url: testCall.recordingUrl || "https://example.com/recording.mp3",
          status: "completed",
          context_details: {
            recipient_data: {
              callId: testCall.id,
              organizationId: org.id,
            },
          },
        };

        const webhookEndpoint = `${webhookUrl}/api/webhooks/bolna/call-status`;
        try {
          const response = await fetch(webhookEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testPayload),
          });

          if (response.ok) {
            console.log(`   ✅ Webhook endpoint accessible and responding`);
            console.log(`   📍 Endpoint: ${webhookEndpoint}`);
          } else {
            console.log(`   ⚠️  Webhook returned status ${response.status}`);
          }
        } catch (error: any) {
          console.log(`   ❌ Cannot reach webhook: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Error testing webhook:`, error);
    }

    // PHASE 5: Sync Call Data
    console.log("\n🔄 PHASE 5: Syncing Call Data from Bolna");
    try {
      const incompleteCalls = await db
        .select()
        .from(calls)
        .where(
          and(
            eq(calls.organizationId, org.id),
            eq(calls.status, "completed")
          )
        );

      const callsNeedingSync = incompleteCalls.filter(
        (call) => call.bolnaCallId && (!call.transcription || !call.recordingUrl || !call.duration)
      );

      console.log(`   📞 Completed calls: ${incompleteCalls.length}`);
      console.log(`   🔄 Needing sync: ${callsNeedingSync.length}`);

      for (const call of callsNeedingSync) {
        try {
          const bolnaCallDetails = await bolnaClient.getCallStatus(call.bolnaCallId);

          if (!bolnaCallDetails) {
            result.callSync.skipped++;
            continue;
          }

          const updates: any = {};

          if (bolnaCallDetails.transcript && !call.transcription) {
            updates.transcription = bolnaCallDetails.transcript;
          }
          if (bolnaCallDetails.recording_url && !call.recordingUrl) {
            updates.recordingUrl = bolnaCallDetails.recording_url;
          }
          if (bolnaCallDetails.conversation_duration && !call.duration) {
            updates.duration = Math.floor(bolnaCallDetails.conversation_duration);
          }

          if (Object.keys(updates).length > 0) {
            await storage.updateCall(call.id, call.organizationId, updates);
            result.callSync.synced++;
          } else {
            result.callSync.skipped++;
          }
        } catch (error) {
          result.callSync.failed++;
        }
      }

      console.log(`   ✅ Synced: ${result.callSync.synced}`);
      console.log(`   ⏭️  Skipped: ${result.callSync.skipped}`);
      console.log(`   ❌ Failed: ${result.callSync.failed}`);
    } catch (error) {
      console.error(`   ❌ Error syncing calls:`, error);
    }

    results.push(result);
    console.log();
  }

  // ============ FINAL REPORT ============
  console.log("\n╔════════════════════════════════════════════════════════════════════╗");
  console.log("║                       📊 FINAL REPORT                              ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝\n");

  console.log("📋 ORGANIZATION SUMMARY\n");
  console.log("Organization Name".padEnd(30) + "Calls".padEnd(8) + "Webhooks".padEnd(10) + "Status");
  console.log("─".repeat(70));

  let totalCalls = 0;
  let totalWebhooks = 0;

  for (const result of results) {
    totalCalls += result.callData.totalCalls;
    totalWebhooks += result.webhookConfig.configured;

    const status = result.callData.totalCalls > 0 ? "✅" : "⏭️ ";
    console.log(
      result.organizationName.padEnd(30) +
        String(result.callData.totalCalls).padEnd(8) +
        String(result.webhookConfig.configured).padEnd(10) +
        status
    );
  }

  console.log("\n" + "─".repeat(70));
  console.log(`TOTALS: ${totalCalls} calls | ${totalWebhooks} webhooks configured\n`);

  // Export results to JSON
  const reportFileName = `webhook-test-report-${new Date().toISOString().split("T")[0]}.json`;
  fs.writeFileSync(
    path.resolve(reportFileName),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        webhookDomain: webhookUrl,
        globalAgentStats,
        organizationResults: results,
        summary: {
          totalOrganizations: results.length,
          totalCalls,
          totalWebhooksConfigured: totalWebhooks,
        },
      },
      null,
      2
    )
  );

  console.log(`📄 Detailed report saved to: ${reportFileName}\n`);

  console.log("═".repeat(70));
  console.log("✅ ALL TESTS COMPLETED");
  console.log("═".repeat(70) + "\n");

  console.log("🎯 NEXT STEPS:");
  console.log("   1. Review the report above for any organizations with missing calls");
  console.log("   2. For orgs with calls, verify webhook logs in server output");
  console.log("   3. Check individual .json files for call data details");
  console.log("   4. Monitor production calls for real-time webhook delivery\n");
}

runAllTests()
  .then(() => {
    console.log("✅ Execution completed successfully\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
