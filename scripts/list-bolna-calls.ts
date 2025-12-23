/**
 * Script to list all available calls from Bolna and show their structure
 * 
 * Usage: npx tsx scripts/list-bolna-calls.ts
 */

// Load environment variables FIRST before any imports
import { config } from "dotenv";
config();

// Verify BOLNA_API_KEY is loaded
if (!process.env.BOLNA_API_KEY) {
  console.error("❌ BOLNA_API_KEY is not set in environment");
  process.exit(1);
}

const BOLNA_API_URL = "https://api.bolna.ai";
const BOLNA_API_KEY = process.env.BOLNA_API_KEY;

async function bolnaRequest(endpoint: string) {
  const url = `${BOLNA_API_URL}${endpoint}`;
  const headers = {
    "Authorization": `Bearer ${BOLNA_API_KEY}`,
    "Content-Type": "application/json",
  };

  console.log(`\n🔍 Trying: ${endpoint}`);
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      console.log(`   ✗ ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`   ✓ Success! Response:`, JSON.stringify(data, null, 2).substring(0, 500));
    return data;
  } catch (error: any) {
    console.log(`   ✗ Error:`, error.message);
    return null;
  }
}

async function listBolnaCalls() {
  console.log("🔄 Attempting to list calls from Bolna API...\n");
  console.log("=" .repeat(60));

  // Try various endpoints that might list calls
  const endpoints = [
    "/calls",
    "/v2/calls",
    "/call",
    "/v2/call",
    "/executions",
    "/agent/executions",
    "/me/calls",
    "/me/executions",
    "/call/history",
    "/calls/history",
  ];

  for (const endpoint of endpoints) {
    await bolnaRequest(endpoint);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n💡 If you see a successful response above, that's the correct endpoint!");
  console.log("💡 You can also check Bolna's API documentation: https://docs.bolna.ai");
  console.log("\n📝 To get call details, you might need:");
  console.log("   - Agent ID + Call/Execution ID");
  console.log("   - Different authentication");
  console.log("   - Access through dashboard export");
}

listBolnaCalls()
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
