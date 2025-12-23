import "dotenv/config";

async function testWebhookFlow() {
  console.log("\n🧪 WEBHOOK FLOW TEST\n");
  console.log("=".repeat(60));
  
  // 1. Check environment configuration
  console.log("\n1️⃣  Environment Configuration Check");
  console.log("-".repeat(60));
  
  const webhookUrl = process.env.PUBLIC_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("❌ PUBLIC_WEBHOOK_URL is NOT set!");
    console.log("   Action: Add PUBLIC_WEBHOOK_URL to .env file");
    return;
  }
  
  const normalizedUrl = webhookUrl.startsWith('http') 
    ? webhookUrl 
    : `https://${webhookUrl}`;
  
  console.log(`✅ PUBLIC_WEBHOOK_URL: ${webhookUrl}`);
  console.log(`✅ Normalized URL: ${normalizedUrl}`);
  console.log(`✅ Full webhook endpoint: ${normalizedUrl}/api/webhooks/bolna/call-status`);
  
  // 2. Test webhook endpoint accessibility
  console.log("\n2️⃣  Webhook Endpoint Test");
  console.log("-".repeat(60));
  
  const testPayload = {
    id: "test-call-12345",
    status: "completed",
    conversation_duration: 125,
    total_cost: 0.05,
    transcript: "This is a test transcription of the call.",
    recording_url: "https://example.com/recordings/test.mp3",
    context_details: {
      recipient_data: {
        callId: "test-db-call-id",
        organizationId: "test-org-id"
      }
    }
  };
  
  console.log("Test payload prepared:");
  console.log(JSON.stringify(testPayload, null, 2));
  
  try {
    console.log(`\nTesting webhook endpoint: ${normalizedUrl}/api/webhooks/bolna/call-status`);
    
    const response = await fetch(`${normalizedUrl}/api/webhooks/bolna/call-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });
    
    console.log(`\nResponse status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log("Response data:", data);
      
      if (data.received) {
        console.log("\n✅ SUCCESS: Webhook endpoint is accessible and responding!");
        if (!data.matched) {
          console.log("   (Call not found in database - this is expected for test data)");
        }
      }
    } else {
      console.log(`❌ FAILED: Webhook returned ${response.status}`);
      const text = await response.text();
      console.log("Response:", text);
    }
  } catch (error: any) {
    console.log("\n❌ FAILED to reach webhook endpoint:");
    console.log(`   Error: ${error.message}`);
    console.log("\nPossible issues:");
    console.log("   1. Server is not running");
    console.log("   2. Firewall blocking connections");
    console.log("   3. Domain/DNS not configured correctly");
    console.log("   4. HTTPS certificate issues");
    console.log("\nAction: Verify server is accessible at the configured URL");
  }
  
  // 3. Verify what Bolna will receive
  console.log("\n3️⃣  Expected Webhook Data Flow");
  console.log("-".repeat(60));
  console.log("When a call completes, Bolna will send:");
  console.log("  ✅ status - Call status (completed, failed, etc.)");
  console.log("  ✅ conversation_duration - Call duration in seconds");
  console.log("  ✅ transcript - Full call transcription");
  console.log("  ✅ recording_url - URL to call recording");
  console.log("  ✅ total_cost - Cost of the call");
  console.log("  ✅ context_details - Call and organization IDs");
  console.log("  ✅ telephony_data - Additional telephony information");
  
  console.log("\nYour platform will:");
  console.log("  1. Receive webhook POST request");
  console.log("  2. Find call in database");
  console.log("  3. Update call with all data");
  console.log("  4. Emit Socket.IO event to frontend");
  console.log("  5. Update metrics and dashboard");
  console.log("  6. UI updates automatically in real-time");
  
  // 4. Instructions
  console.log("\n4️⃣  How to Test End-to-End");
  console.log("-".repeat(60));
  console.log("1. Create a new agent in your platform");
  console.log("   - Select a voice and voice provider");
  console.log("   - System will automatically set webhook URL");
  console.log("   - Look for log: '✅ Webhook URL configured for agent'");
  console.log("");
  console.log("2. Initiate a test call");
  console.log("   - Go to Call History page");
  console.log("   - Click 'Initiate Call'");
  console.log("   - Watch server logs for polling activity");
  console.log("");
  console.log("3. During the call, monitor logs:");
  console.log("   - [Poll] messages show polling is working");
  console.log("   - [Bolna Webhook] messages show webhooks received");
  console.log("");
  console.log("4. Watch the UI update in real-time:");
  console.log("   - Call status changes: initiated → in_progress → completed");
  console.log("   - Duration appears when call ends");
  console.log("   - Recording URL shows up");
  console.log("   - Transcription becomes available");
  console.log("   - Cost data displayed");
  
  console.log("\n5️⃣  Monitoring Real-Time Updates");
  console.log("-".repeat(60));
  console.log("Open browser console (F12) and look for:");
  console.log("  [CallHistory] Received call:updated");
  console.log("  [Dashboard] Received metrics:updated event");
  console.log("");
  console.log("In server logs, look for:");
  console.log("  [Bolna Webhook] 📊 Data received:");
  console.log("  [Bolna Webhook] 💰 Cost data received:");
  console.log("  [Bolna Webhook] 🚀 Emitting call:updated");
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Test complete\n");
}

testWebhookFlow()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
