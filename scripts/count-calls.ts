import "dotenv/config";
import { db } from "../server/db";
import { calls, organizations } from "../shared/schema";
import { eq } from "drizzle-orm";

async function countCalls() {
  console.log("📊 Counting calls in database...\n");

  // Get all organizations
  const allOrgs = await db.select().from(organizations);
  
  console.log(`Found ${allOrgs.length} organization(s)\n`);

  for (const org of allOrgs) {
    console.log(`📍 Organization: ${org.name}`);
    console.log(`   ID: ${org.id}`);
    
    // Get calls for this org
    const orgCalls = await db
      .select()
      .from(calls)
      .where(eq(calls.organizationId, org.id));
    
    console.log(`   Total Calls: ${orgCalls.length}`);
    
    // Count by status
    const statusCounts = orgCalls.reduce((acc, call) => {
      acc[call.status] = (acc[call.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`   Status breakdown:`, statusCounts);
    console.log();
  }

  // Get all calls
  const allCalls = await db.select().from(calls);
  console.log(`\n🔢 TOTAL CALLS ACROSS ALL ORGANIZATIONS: ${allCalls.length}`);
  
  process.exit(0);
}

countCalls().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
