/**
 * Script to test webhook and real-time update infrastructure
 * Usage: npx tsx scripts/test-webhook-realtime.ts [organizationId]
 */

import "dotenv/config";
import { db } from "../server/db";
import { calls, organizations, aiAgents } from "../shared/schema";
import { desc, eq } from "drizzle-orm";

async function testWebhookRealtime() {
  console.log("\n🧪 TESTING WEBHOOK & REAL-TIME INFRASTRUCTURE\n");
  console.log("=".repeat(60));
  
  const orgId = process.argv[2];
  const webhookUrl = process.env.PUBLIC_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error("❌ PUBLIC_WEBHOOK_URL not set");
    return;
  }
  
  console.log(`📍 Webhook URL: ${webhookUrl}/api/webhooks/bolna/call-status\n`);
  
  try {
    // Get organization
    let targetOrg;
    if (orgId) {
      const org = await db.select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      targetOrg = org[0];
    } else {
      // Get first org with calls
      const allOrgs = await db.select().from(organizations);
      for (const org of allOrgs) {
        const orgCalls = await db.select()
          .from(calls)
          .where(eq(calls.organizationId, org.id))
          .limit(1);
        if (orgCalls.length > 0) {
          targetOrg = org;
          break;
        }
      }
    }
    
    if (!targetOrg) {
      console.error("❌ No organization found with calls");
      console.log("\n💡 Create a test call first:");
      console.log("   - Log in to platform");
      console.log("   - Go to Call History");
      console.log("   - Click 'New Call'");
      return;
    }
    
    console.log(`🏢 Testing Organization: ${targetOrg.name}`);
    console.log(`   ID: ${targetOrg.id}\n`);
    
    // Get agents for this org
    const orgAgents = await db.select()
      .from(aiAgents)
      .where(eq(aiAgents.organizationId, targetOrg.id));
    
    console.log(`📊 Organization Statistics:`);
    console.log(`   Agents: ${orgAgents.length}`);
    
    const agentsWithBolna = orgAgents.filter(a => a.bolnaAgentId);
    const agentsWithWebhook = orgAgents.filter(a => 
      (a.bolnaConfig as any)?.agent_config?.webhook_url === `${webhookUrl}/api/webhooks/bolna/call-status`
    );
    
    console.log(`   Agents synced to Bolna: ${agentsWithBolna.length}`);
    console.log(`   Agents with webhook: ${agentsWithWebhook.length}\n`);
    
    // Get recent calls
    const recentCalls = await db.select()
      .from(calls)
      .where(eq(calls.organizationId, targetOrg.id))
      .orderBy(desc(calls.startedAt))
      .limit(10);
    
    console.log(`📞 Recent Calls: ${recentCalls.length}\n`);
    
    if (recentCalls.length === 0) {
      console.log("⚠️  No calls found for this organization\n");
      console.log("💡 Create a test call:");
      console.log("   - Go to Call History");
      console.log("   - Click 'New Call' button");
      console.log("   - Select agent and enter phone number");
      console.log("   - Watch server logs for webhook activity\n");
      return;
    }
    
    // Display call status breakdown
    const statusCounts: Record<string, number> = {};
    recentCalls.forEach(call => {
      statusCounts[call.status] = (statusCounts[call.status] || 0) + 1;
    });
    
    console.log("📊 Call Status Breakdown:");
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log();
    
    // Check for stuck calls (in_progress/initiated for > 10 minutes)
    const now = new Date();
    const stuckCalls = recentCalls.filter(call => {
      if (!['in_progress', 'initiated', 'ringing'].includes(call.status)) return false;
      const startedAt = call.startedAt || call.scheduledAt;
      if (!startedAt) return false;
      const ageMinutes = (now.getTime() - new Date(startedAt).getTime()) / (1000 * 60);
      return ageMinutes > 10;
    });
    
    if (stuckCalls.length > 0) {
      console.log(`⚠️  Found ${stuckCalls.length} stuck call(s):\n`);
      stuckCalls.forEach(call => {
        const age = Math.floor((now.getTime() - new Date(call.startedAt || call.scheduledAt!).getTime()) / (1000 * 60));
        console.log(`   - ${call.contactPhone || 'Unknown'} (${call.status}) - ${age} min old`);
      });
      console.log();
      console.log("💡 These calls may have missed webhooks");
      console.log("   - Webhooks might not be configured correctly");
      console.log("   - Or Bolna may not be sending webhooks\n");
    }
    
    // Test webhook endpoint accessibility
    console.log("🔍 Testing webhook endpoint...");
    const webhookEndpoint = `${webhookUrl}/api/webhooks/bolna/call-status`;
    
    const testPayload = {
      id: "test-call-id",
      status: "completed",
      conversation_duration: 60,
      total_cost: 0.05,
      transcript: "This is a test",
      context_details: {
        recipient_data: {
          callId: "test",
          organizationId: targetOrg.id,
        },
      },
    };
    
    try {
      const response = await fetch(webhookEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });
      
      if (response.ok) {
        console.log(`   ✅ Webhook endpoint is accessible`);
        console.log(`   📍 Status: ${response.status} ${response.statusText}`);
      } else {
        console.log(`   ⚠️  Webhook returned ${response.status}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Cannot reach webhook: ${error.message}`);
      console.log(`   💡 Check if server is running`);
    }
    
    console.log();
    console.log("=".repeat(60));
    console.log("\n✅ DIAGNOSTIC COMPLETE\n");
    
    if (agentsWithWebhook.length === 0) {
      console.log("❌ ISSUE: No agents have webhooks configured\n");
      console.log("🔧 FIX:");
      console.log("   1. Run: npx tsx scripts/fix-agent-webhooks.ts");
      console.log("   2. Go to AI Agents page");
      console.log("   3. Click 'Sync to Bolna' on each agent\n");
    } else if (agentsWithWebhook.length < agentsWithBolna.length) {
      console.log("⚠️  ISSUE: Some agents missing webhook URLs\n");
      console.log("🔧 FIX:");
      console.log("   - Re-sync agents from UI");
      console.log("   - Or run: npx tsx scripts/fix-agent-webhooks.ts\n");
    } else {
      console.log("✅ All agents have webhook URLs configured!\n");
    }
    
    console.log("🎯 NEXT STEPS:\n");
    console.log("1. Make a test call:");
    console.log("   - Go to Call History page");
    console.log("   - Click 'New Call'");
    console.log("   - Select an agent with Bolna ID");
    console.log("   - Enter a test phone number");
    console.log("   - Submit\n");
    
    console.log("2. Monitor real-time updates:");
    console.log("   - Open browser console (F12)");
    console.log("   - Look for: [CallHistory] Received call:created");
    console.log("   - Look for: [CallHistory] Received call:updated");
    console.log("   - Status should update automatically\n");
    
    console.log("3. Check server logs:");
    console.log("   - Look for: [Bolna Webhook] Received at");
    console.log("   - Look for: 🚀 Emitting call:updated");
    console.log("   - Look for: Client {id} joined organization room\n");
    
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    throw error;
  }
}

testWebhookRealtime()
  .then(() => {
    console.log("✅ Test complete\n");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
