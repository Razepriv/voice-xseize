import "dotenv/config";
import { db } from "../server/db";
import { calls } from "../shared/schema";
import { desc, eq } from "drizzle-orm";

async function diagnoseWebhookIssue() {
  console.log("\n🔍 WEBHOOK DIAGNOSTIC REPORT\n");
  console.log("=" .repeat(60));
  
  // 1. Check environment configuration
  console.log("\n1️⃣  Environment Configuration");
  console.log("-".repeat(60));
  console.log("PUBLIC_WEBHOOK_URL:", process.env.PUBLIC_WEBHOOK_URL || "❌ NOT SET");
  console.log("BOLNA_API_KEY:", process.env.BOLNA_API_KEY ? "✅ SET" : "❌ NOT SET");
  console.log("EXOTEL_API_KEY:", process.env.EXOTEL_API_KEY ? "✅ SET" : "❌ NOT SET");
  
  const webhookUrl = process.env.PUBLIC_WEBHOOK_URL;
  if (webhookUrl) {
    console.log("\n📍 Expected Webhook Endpoints:");
    console.log(`   Bolna:  https://${webhookUrl}/api/webhooks/bolna/call-status`);
    console.log(`   Exotel: https://${webhookUrl}/api/webhooks/exotel/call-status`);
  }
  
  // 2. Check recent calls
  console.log("\n\n2️⃣  Recent Calls Analysis");
  console.log("-".repeat(60));
  
  try {
    const recentCalls = await db
      .select()
      .from(calls)
      .orderBy(desc(calls.createdAt))
      .limit(10);
    
    if (recentCalls.length === 0) {
      console.log("❌ No calls found in database");
    } else {
      console.log(`✅ Found ${recentCalls.length} recent calls\n`);
      
      recentCalls.forEach((call, index) => {
        console.log(`\nCall #${index + 1}:`);
        console.log(`  ID: ${call.id}`);
        console.log(`  Status: ${call.status}`);
        console.log(`  Contact: ${call.contactName || call.contactPhone}`);
        console.log(`  Created: ${call.createdAt}`);
        console.log(`  Started: ${call.startedAt || "Not started"}`);
        console.log(`  Ended: ${call.endedAt || "Not ended"}`);
        console.log(`  Duration: ${call.duration || 0} seconds`);
        console.log(`  Bolna Call ID: ${call.bolnaCallId || "❌ None"}`);
        console.log(`  Exotel SID: ${call.exotelCallSid || "❌ None"}`);
        console.log(`  Recording: ${call.recordingUrl ? "✅ Yes" : "❌ No"}`);
        console.log(`  Transcription: ${call.transcription ? "✅ Yes" : "❌ No"}`);
        
        // Check if call is stuck
        const now = new Date();
        const createdDate = new Date(call.createdAt);
        const minutesAgo = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60));
        
        if (call.status === 'initiated' && minutesAgo > 5) {
          console.log(`  ⚠️  WARNING: Call stuck in 'initiated' status for ${minutesAgo} minutes`);
        }
        if (call.status === 'in_progress' && minutesAgo > 30) {
          console.log(`  ⚠️  WARNING: Call stuck in 'in_progress' status for ${minutesAgo} minutes`);
        }
        if (call.duration === null && call.status === 'completed') {
          console.log(`  ⚠️  WARNING: Call marked completed but no duration`);
        }
      });
    }
  } catch (error) {
    console.error("❌ Error fetching calls:", error);
  }
  
  // 3. Check for webhook-specific issues
  console.log("\n\n3️⃣  Common Webhook Issues");
  console.log("-".repeat(60));
  
  const issues: string[] = [];
  
  if (!webhookUrl) {
    issues.push("❌ PUBLIC_WEBHOOK_URL not configured");
  } else if (!webhookUrl.includes("https://") && !webhookUrl.includes("http://")) {
    issues.push("⚠️  PUBLIC_WEBHOOK_URL missing protocol (https://)");
  }
  
  if (!process.env.BOLNA_API_KEY) {
    issues.push("❌ BOLNA_API_KEY not configured");
  }
  
  try {
    const stuckCalls = await db
      .select()
      .from(calls)
      .where(eq(calls.status, 'initiated'))
      .orderBy(desc(calls.createdAt))
      .limit(5);
    
    if (stuckCalls.length > 0) {
      const oldestStuck = stuckCalls[stuckCalls.length - 1];
      const now = new Date();
      const createdDate = new Date(oldestStuck.createdAt);
      const minutesAgo = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60));
      issues.push(`⚠️  ${stuckCalls.length} calls stuck in 'initiated' status (oldest: ${minutesAgo} min ago)`);
    }
    
    const completedWithoutData = await db
      .select()
      .from(calls)
      .where(eq(calls.status, 'completed'))
      .orderBy(desc(calls.createdAt))
      .limit(10);
    
    const missingData = completedWithoutData.filter(c => !c.duration || !c.recordingUrl);
    if (missingData.length > 0) {
      issues.push(`⚠️  ${missingData.length} completed calls missing duration/recording data`);
    }
  } catch (error) {
    console.error("Error checking for issues:", error);
  }
  
  if (issues.length === 0) {
    console.log("✅ No obvious issues detected");
  } else {
    issues.forEach(issue => console.log(issue));
  }
  
  // 4. Recommendations
  console.log("\n\n4️⃣  Troubleshooting Steps");
  console.log("-".repeat(60));
  console.log(`
1. ✅ Verify webhook URL is publicly accessible:
   Test: curl https://${webhookUrl}/api/webhooks/bolna/call-status
   
2. ✅ Check if Bolna is sending webhooks:
   - Login to https://dashboard.bolna.ai
   - Check call logs for recent calls
   - Look for webhook delivery status
   
3. ✅ Test webhook manually:
   Run: npm run test:webhook
   
4. ✅ Check server logs in real-time:
   Look for "[Bolna Webhook]" and "[Exotel Webhook]" messages
   
5. ✅ Verify agent webhook configuration:
   Run: npm run test:agent-webhook
   
6. ⚠️  If webhooks still not working:
   - Check if ngrok/tunnel is running (if using one)
   - Verify firewall/network settings
   - Check Bolna webhook retry logs
   - Contact Bolna support with agent IDs
`);
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Diagnostic complete\n");
}

diagnoseWebhookIssue()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
