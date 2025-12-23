/**
 * Script to update old call logs with status, transcription, and recording from Bolna
 * 
 * Usage: npx tsx scripts/update-call-logs.ts
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
import { bolnaClient } from "../server/bolna";
import { eq, isNotNull, isNull, or } from "drizzle-orm";

async function updateCallLogs() {
  console.log("🔄 Starting to update call logs from Bolna...\n");

  try {
    // Find calls that have Bolna call IDs but missing data
    const callsToUpdate = await db
      .select()
      .from(calls)
      .where(
        isNotNull(calls.bolnaCallId)
      );

    console.log(`📊 Found ${callsToUpdate.length} calls with Bolna call IDs\n`);

    if (callsToUpdate.length === 0) {
      console.log("✅ No calls to update");
      return;
    }

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const call of callsToUpdate) {
      try {
        if (!call.bolnaCallId) {
          skipped++;
          continue;
        }
        
        console.log(`\n📞 Processing call ${call.id} (Bolna ID: ${call.bolnaCallId})...`);
        
        // Get call details from Bolna
        const bolnaDetails = await bolnaClient.getCallDetails(call.bolnaCallId);
        
        if (!bolnaDetails) {
          console.log(`   ⚠️  No details found in Bolna for call ${call.bolnaCallId}`);
          skipped++;
          continue;
        }

        // Prepare updates
        const updates: any = {};
        let hasUpdates = false;

        // Update transcript if available and not already set
        if (bolnaDetails.transcript && !call.transcription) {
          updates.transcription = bolnaDetails.transcript;
          hasUpdates = true;
          console.log(`   ✓ Found transcript (${bolnaDetails.transcript.length} chars)`);
        } else if (call.transcription) {
          console.log(`   ℹ️  Transcript already exists`);
        }

        // Update recording URL if available and not already set
        if (bolnaDetails.recording_url && !call.recordingUrl) {
          updates.recordingUrl = bolnaDetails.recording_url;
          hasUpdates = true;
          console.log(`   ✓ Found recording URL: ${bolnaDetails.recording_url}`);
        } else if (call.recordingUrl) {
          console.log(`   ℹ️  Recording URL already exists`);
        }

        // Update status if it's more informative than current
        if (bolnaDetails.status) {
          // Normalize status
          let normalizedStatus = bolnaDetails.status.toLowerCase();
          if (normalizedStatus === 'answered' || normalizedStatus === 'in-progress' || normalizedStatus === 'in_progress' || normalizedStatus === 'ongoing') {
            normalizedStatus = 'in_progress';
          } else if (normalizedStatus === 'ended' || normalizedStatus === 'finished' || normalizedStatus === 'completed') {
            normalizedStatus = 'completed';
          } else if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
            normalizedStatus = 'failed';
          } else if (normalizedStatus === 'ringing') {
            normalizedStatus = 'ringing';
          } else if (normalizedStatus === 'initiated' || normalizedStatus === 'queued') {
            normalizedStatus = 'initiated';
          }

          // Only update if status has changed and is more "complete"
          const statusPriority: Record<string, number> = {
            'initiated': 1,
            'ringing': 2,
            'in_progress': 3,
            'completed': 4,
            'failed': 4,
            'cancelled': 4,
          };

          const currentPriority = statusPriority[call.status] || 0;
          const newPriority = statusPriority[normalizedStatus] || 0;

          if (newPriority > currentPriority) {
            updates.status = normalizedStatus;
            hasUpdates = true;
            console.log(`   ✓ Updating status: ${call.status} → ${normalizedStatus}`);
          } else {
            console.log(`   ℹ️  Status unchanged: ${call.status}`);
          }
        }

        // Apply updates if any
        if (hasUpdates) {
          await db
            .update(calls)
            .set(updates)
            .where(eq(calls.id, call.id));
          
          updated++;
          console.log(`   ✅ Successfully updated call ${call.id}`);
        } else {
          skipped++;
          console.log(`   ⏭️  No updates needed for call ${call.id}`);
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        failed++;
        console.error(`   ❌ Failed to update call ${call.id}:`, error.message);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Summary:");
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   ⏭️  Skipped (no updates): ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📝 Total processed: ${callsToUpdate.length}`);
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Error updating call logs:", error);
    throw error;
  }
}

// Run the script
updateCallLogs()
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
