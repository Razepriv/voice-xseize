/**
 * Bulk update calls with data from a JSON file
 * 
 * Usage: npx tsx scripts/bulk-update-calls.ts <json-file-path>
 * 
 * JSON file format:
 * [
 *   {
 *     "callId": "uuid-here",
 *     "status": "completed",
 *     "duration": 180,
 *     "transcription": "Full conversation...",
 *     "recordingUrl": "https://..."
 *   }
 * ]
 */

// Load environment variables FIRST before any imports
import { config } from "dotenv";
config();

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in environment");
  process.exit(1);
}

import { db } from "../server/db";
import { calls } from "../shared/schema";
import { eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { resolve } from "path";

interface CallUpdate {
  callId: string;
  status?: string;
  duration?: number;
  transcription?: string;
  recordingUrl?: string;
  outcome?: string;
  notes?: string;
}

async function bulkUpdateCalls(jsonFilePath: string) {
  console.log("🔄 Starting bulk call update...\n");

  // Read and parse JSON file
  let updates: CallUpdate[];
  try {
    const filePath = resolve(process.cwd(), jsonFilePath);
    console.log(`📄 Reading file: ${filePath}`);
    const fileContent = readFileSync(filePath, 'utf-8');
    updates = JSON.parse(fileContent);
    console.log(`✓ Found ${updates.length} calls to update\n`);
  } catch (error: any) {
    console.error("❌ Failed to read JSON file:", error.message);
    console.error("\nMake sure your JSON file is in this format:");
    console.error(`[
  {
    "callId": "uuid-here",
    "status": "completed",
    "duration": 180,
    "transcription": "Full conversation...",
    "recordingUrl": "https://..."
  }
]`);
    process.exit(1);
  }

  let successful = 0;
  let failed = 0;
  let skipped = 0;

  for (const update of updates) {
    try {
      console.log(`\n📞 Updating call ${update.callId}...`);

      if (!update.callId) {
        console.log(`   ⏭️  Skipped: No callId provided`);
        skipped++;
        continue;
      }

      // Get existing call
      const [existingCall] = await db
        .select()
        .from(calls)
        .where(eq(calls.id, update.callId))
        .limit(1);

      if (!existingCall) {
        console.log(`   ❌ Call not found in database`);
        failed++;
        continue;
      }

      // Prepare updates (only include fields that are provided)
      const updateData: any = {};
      let hasUpdates = false;

      if (update.status && update.status !== existingCall.status) {
        updateData.status = update.status;
        hasUpdates = true;
        console.log(`   ✓ Status: ${existingCall.status} → ${update.status}`);
      }

      if (update.duration !== undefined && update.duration !== existingCall.duration) {
        updateData.duration = update.duration;
        hasUpdates = true;
        console.log(`   ✓ Duration: ${existingCall.duration || 0} → ${update.duration} seconds`);
      }

      if (update.transcription && update.transcription !== existingCall.transcription) {
        updateData.transcription = update.transcription;
        hasUpdates = true;
        console.log(`   ✓ Transcription: ${update.transcription.length} characters`);
      }

      if (update.recordingUrl && update.recordingUrl !== existingCall.recordingUrl) {
        updateData.recordingUrl = update.recordingUrl;
        hasUpdates = true;
        console.log(`   ✓ Recording URL: ${update.recordingUrl.substring(0, 50)}...`);
      }

      if (update.outcome && update.outcome !== existingCall.outcome) {
        updateData.outcome = update.outcome;
        hasUpdates = true;
        console.log(`   ✓ Outcome: ${update.outcome}`);
      }

      if (update.notes && update.notes !== existingCall.notes) {
        updateData.notes = update.notes;
        hasUpdates = true;
        console.log(`   ✓ Notes updated`);
      }

      if (!hasUpdates) {
        console.log(`   ⏭️  No updates needed (data already up to date)`);
        skipped++;
        continue;
      }

      // Perform update
      await db
        .update(calls)
        .set(updateData)
        .where(eq(calls.id, update.callId));

      console.log(`   ✅ Successfully updated`);
      successful++;

    } catch (error: any) {
      console.error(`   ❌ Failed:`, error.message);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   ✅ Successfully updated: ${successful}`);
  console.log(`   ⏭️  Skipped (no changes): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📝 Total processed: ${updates.length}`);
  console.log("=".repeat(60) + "\n");
}

// Get filename from command line args
const jsonFile = process.argv[2];

if (!jsonFile) {
  console.error("❌ Please provide a JSON file path");
  console.error("\nUsage: npx tsx scripts/bulk-update-calls.ts <json-file>");
  console.error("\nExample: npx tsx scripts/bulk-update-calls.ts call-updates.json");
  process.exit(1);
}

bulkUpdateCalls(jsonFile)
  .then(() => {
    console.log("✅ Bulk update completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Bulk update failed:", error);
    process.exit(1);
  });
