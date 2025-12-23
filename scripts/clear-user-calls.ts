import "dotenv/config";
import { db } from "../server/db";
import { users, calls } from "../shared/schema";
import { eq } from "drizzle-orm";

async function clearUserCalls(email: string) {
  try {
    console.log(`Finding user with email: ${email}...`);
    
    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }
    
    console.log(`Found user: ${user.id}`);
    console.log(`Organization ID: ${user.organizationId}`);
    
    // Get count of calls before deletion
    const callsBefore = await db.select().from(calls).where(eq(calls.organizationId, user.organizationId));
    console.log(`Found ${callsBefore.length} calls to delete`);
    
    if (callsBefore.length === 0) {
      console.log("No calls found to delete");
      process.exit(0);
    }
    
    // Delete all calls for this organization (this includes transcripts as they're stored in the calls table)
    const deletedCalls = await db
      .delete(calls)
      .where(eq(calls.organizationId, user.organizationId))
      .returning();
    
    console.log(`✅ Successfully deleted ${deletedCalls.length} calls (including transcripts)`);
    console.log(`Deleted call IDs:`, deletedCalls.map(c => c.id).slice(0, 10), deletedCalls.length > 10 ? '...' : '');
    
    process.exit(0);
  } catch (error) {
    console.error("Error clearing user calls:", error);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/clear-user-calls.ts <email>");
  process.exit(1);
}

clearUserCalls(email);


