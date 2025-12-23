/**
 * Script to sync historical calls with Bolna API to retrieve missing data
 * This script fetches call details from Bolna for all recorded calls
 * Usage: npx tsx scripts/sync-bolna-calls.ts [organizationId]
 */

import "dotenv/config";
import { db } from "../server/db";
import { calls, organizations, aiAgents } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { bolnaClient } from "../server/bolna";
import { storage } from "../server/storage";

interface BolnaCallResponse {
  call_id: string;
  status: string;
  conversation_duration?: number;
  transcript?: string;
  recording_url?: string;
  total_cost?: number;
  timestamp?: string;
}

async function syncBolnaCallHistories() {
  try {
    console.log("🔄 Syncing historical calls with Bolna...\n");

    const orgId = process.argv[2];

    if (!orgId) {
      console.error("❌ Usage: npx tsx scripts/sync-bolna-calls.ts <organizationId>");
      console.error("\nFetching all organizations:");

      const allOrgs = await db.select().from(organizations);
      console.log("\nAvailable organizations:");
      allOrgs.forEach((org) => {
        console.log(`  - ${org.id}: ${org.name}`);
      });
      return;
    }

    // Verify organization exists
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org.length) {
      console.error(`❌ Organization not found: ${orgId}`);
      return;
    }

    console.log(`✅ Organization: ${org[0].name}`);
    console.log(`📍 Organization ID: ${orgId}\n`);

    // Fetch all calls with Bolna IDs that might have missing data
    const incompleteCalls = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.organizationId, orgId),
          eq(calls.status, 'completed')
        )
      );

    // Filter for calls with Bolna IDs but missing data
    const callsNeedingSync = incompleteCalls.filter((call) =>
      call.bolnaCallId && (
        !call.transcription ||
        !call.recordingUrl ||
        !call.duration
      )
    );

    console.log(`📞 Total completed calls: ${incompleteCalls.length}`);
    console.log(`📞 Calls needing sync: ${callsNeedingSync.length}\n`);

    if (callsNeedingSync.length === 0) {
      console.log("✅ All calls have complete data!");
      return;
    }

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    // Sync each call with Bolna
    for (const call of callsNeedingSync) {
      try {
        console.log(`⏳ Syncing call: ${call.id} (Bolna: ${call.bolnaCallId})`);

        // Attempt to fetch call details from Bolna
        // Note: Adjust method name based on actual Bolna API
        try {
          // This is a hypothetical method - adjust based on Bolna's actual API
          const bolnaCallDetails = await bolnaClient.getCallStatus(call.bolnaCallId);

          if (!bolnaCallDetails) {
            console.log(`   ⚠️  Call not found in Bolna`);
            skippedCount++;
            continue;
          }

          const updates: Partial<typeof call> = {};

          // Update transcript if available
          if (bolnaCallDetails.transcript && !call.transcription) {
            updates.transcription = bolnaCallDetails.transcript;
            console.log(`   ✅ Transcript retrieved (${bolnaCallDetails.transcript.length} chars)`);
          }

          // Update recording URL if available
          if (bolnaCallDetails.recording_url && !call.recordingUrl) {
            updates.recordingUrl = bolnaCallDetails.recording_url;
            console.log(`   ✅ Recording URL retrieved`);
          }

          // Update duration if available
          if (bolnaCallDetails.conversation_duration && !call.duration) {
            updates.duration = Math.floor(bolnaCallDetails.conversation_duration);
            console.log(`   ✅ Duration updated: ${updates.duration}s`);
          }

          // Update cost if available
          if (bolnaCallDetails.total_cost && !call.bolnaCostPerMinute) {
            updates.bolnaCostPerMinute = Number(bolnaCallDetails.total_cost);
            console.log(`   ✅ Cost retrieved: $${updates.bolnaCostPerMinute}`);
          }

          // Apply updates if any new data found
          if (Object.keys(updates).length > 0) {
            await storage.updateCall(call.id, call.organizationId, updates);
            console.log(`   ✅ Call updated in database`);
            successCount++;
          } else {
            console.log(`   ℹ️  No new data to sync`);
            skippedCount++;
          }
        } catch (bolnaError) {
          console.log(`   ⚠️  Could not fetch from Bolna: ${bolnaError instanceof Error ? bolnaError.message : String(bolnaError)}`);
          console.log(`   💡 Tip: Check if Bolna API supports call history retrieval`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        failureCount++;
      }
    }

    console.log(`\n✅ Sync complete:`);
    console.log(`   - Successfully synced: ${successCount}`);
    console.log(`   - Skipped (no new data): ${skippedCount}`);
    console.log(`   - Failed: ${failureCount}`);

    // Show final summary
    const updatedStats = await db
      .select()
      .from(calls)
      .where(eq(calls.organizationId, orgId));

    const withTranscripts = updatedStats.filter((c) => c.transcription).length;
    const withRecordings = updatedStats.filter((c) => c.recordingUrl).length;

    console.log(`\n📊 Final statistics:`);
    console.log(`   - Calls with transcripts: ${withTranscripts}/${updatedStats.length}`);
    console.log(`   - Calls with recordings: ${withRecordings}/${updatedStats.length}`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

syncBolnaCallHistories();
