/**
 * Script to fetch all previous calls with transcripts and recording URLs
 * Usage: npx tsx scripts/fetch-call-data.ts [organizationId] [outputFile]
 */

import "dotenv/config";
import { db } from "../server/db";
import { calls, organizations } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface CallData {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  transcription: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  bolnaCallId: string | null;
  exotelCallSid: string | null;
  organizationId: string;
  agentId: string | null;
  leadId: string | null;
}

async function fetchCallData() {
  try {
    console.log("🔄 Fetching call data...\n");

    const orgId = process.argv[2];
    const outputFile = process.argv[3] || "call-data-export.json";

    if (!orgId) {
      console.error("❌ Usage: npx tsx scripts/fetch-call-data.ts <organizationId> [outputFile]");
      console.error("\nFetching all organizations:");
      
      const allOrgs = await db.select().from(organizations);
      console.log("\nAvailable organizations:");
      allOrgs.forEach((org) => {
        console.log(`  - ${org.id}: ${org.name}`);
      });
      return;
    }

    // Fetch organization
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

    // Fetch all calls for this organization
    const allCalls = await db
      .select()
      .from(calls)
      .where(eq(calls.organizationId, orgId))
      .orderBy(desc(calls.startedAt));

    console.log(`📞 Found ${allCalls.length} calls\n`);

    if (allCalls.length === 0) {
      console.log("No calls found for this organization.");
      return;
    }

    // Process and export call data
    const exportData: CallData[] = allCalls.map((call) => ({
      id: call.id,
      contactName: call.contactName,
      contactPhone: call.contactPhone,
      status: call.status,
      duration: call.duration,
      recordingUrl: call.recordingUrl,
      transcription: call.transcription,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      bolnaCallId: call.bolnaCallId,
      exotelCallSid: call.exotelCallSid,
      organizationId: call.organizationId,
      agentId: call.agentId,
      leadId: call.leadId,
    }));

    // Save to file
    const outputPath = path.resolve(outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

    console.log(`✅ Data exported to: ${outputPath}`);
    console.log(`📊 Summary:`);
    console.log(`   - Total calls: ${exportData.length}`);
    console.log(`   - Calls with recordings: ${exportData.filter((c) => c.recordingUrl).length}`);
    console.log(`   - Calls with transcriptions: ${exportData.filter((c) => c.transcription).length}`);
    console.log(`   - Completed calls: ${exportData.filter((c) => c.status === "completed").length}`);

    // Print sample of missing data
    const missingRecordings = exportData.filter((c) => c.status === "completed" && !c.recordingUrl);
    const missingTranscripts = exportData.filter((c) => c.status === "completed" && !c.transcription);

    if (missingRecordings.length > 0) {
      console.log(`\n⚠️  ${missingRecordings.length} completed calls missing recordings:`);
      missingRecordings.slice(0, 5).forEach((call) => {
        console.log(`   - ${call.id}: ${call.contactName || call.contactPhone}`);
      });
      if (missingRecordings.length > 5) {
        console.log(`   ... and ${missingRecordings.length - 5} more`);
      }
    }

    if (missingTranscripts.length > 0) {
      console.log(`\n⚠️  ${missingTranscripts.length} completed calls missing transcripts:`);
      missingTranscripts.slice(0, 5).forEach((call) => {
        console.log(`   - ${call.id}: ${call.contactName || call.contactPhone}`);
      });
      if (missingTranscripts.length > 5) {
        console.log(`   ... and ${missingTranscripts.length - 5} more`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fetchCallData();
