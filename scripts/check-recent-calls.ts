import "dotenv/config";
import { db } from "../server/db";
import { calls, aiAgents } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

async function checkRecentCall() {
  // Get most recent call
  const recentCalls = await db
    .select()
    .from(calls)
    .orderBy(desc(calls.createdAt))
    .limit(5);

  console.log("\n📞 Recent Calls:");
  console.log("=".repeat(80));
  
  for (const call of recentCalls) {
    console.log(`\nCall ID: ${call.id}`);
    console.log(`Bolna Call ID: ${call.bolnaCallId || 'N/A'}`);
    console.log(`Status: ${call.status}`);
    console.log(`Phone: ${call.phoneNumber}`);
    console.log(`Duration: ${call.duration || 0} seconds`);
    console.log(`Created: ${call.createdAt}`);
    
    if (call.agentId) {
      const agent = await db.select().from(aiAgents).where(eq(aiAgents.id, call.agentId)).limit(1);
      if (agent.length > 0) {
        console.log(`Agent: ${agent[0].name} (Bolna ID: ${agent[0].bolnaAgentId})`);
      }
    }
  }
}

checkRecentCall()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
