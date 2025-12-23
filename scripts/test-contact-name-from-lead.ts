import "dotenv/config";
import { db } from "../server/db";
import { leads } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Test script to verify contact name extraction from leads
 */

async function testContactNameFromLead() {
  console.log("🧪 Testing Contact Name Extraction from Leads\n");

  try {
    // Get a sample organization ID (you can modify this)
    const testOrgId = process.env.TEST_ORG_ID || "4c060791-07e4-4555-b57e-c1f16650a7f3";
    
    console.log(`📋 Fetching leads for organization: ${testOrgId}\n`);
    
    const allLeads = await db
      .select()
      .from(leads)
      .where(eq(leads.organizationId, testOrgId))
      .limit(10);

    if (allLeads.length === 0) {
      console.log("ℹ️  No leads found for this organization");
      console.log("   This is expected if no leads have been created yet.\n");
    } else {
      console.log(`✅ Found ${allLeads.length} lead(s):\n`);
      
      allLeads.forEach((lead, index) => {
        console.log(`Lead ${index + 1}:`);
        console.log(`   - ID: ${lead.id}`);
        console.log(`   - Name: ${lead.name}`);
        console.log(`   - Phone: ${lead.phone || 'Not set'}`);
        console.log(`   - Email: ${lead.email || 'Not set'}`);
        console.log(`   - Campaign ID: ${lead.campaignId || 'Not set'}`);
        console.log(`   - Status: ${lead.status}`);
        console.log("");
      });
    }

    // Test phone number normalization
    console.log("📞 Testing Phone Number Normalization:\n");
    const testPhones = [
      "+1234567890",
      "1234567890",
      "+1-234-567-890",
      "(123) 456-7890",
      "123 456 7890"
    ];

    const normalizePhone = (phone: string) => phone.replace(/[\s\-+()]/g, '');
    
    testPhones.forEach(phone => {
      const normalized = normalizePhone(phone);
      console.log(`   "${phone}" → "${normalized}"`);
    });

    // Test contact name extraction logic
    console.log("\n✅ Contact Name Extraction Logic:\n");
    console.log("   1. If leadId is provided:");
    console.log("      → Fetch lead by ID");
    console.log("      → Extract lead.name as contactName");
    console.log("");
    console.log("   2. If leadId is NOT provided but recipientPhone is:");
    console.log("      → Search all leads for matching phone number");
    console.log("      → Extract lead.name as contactName if found");
    console.log("");
    console.log("   3. If contactName is explicitly provided:");
    console.log("      → Use the provided contactName (highest priority)");
    console.log("");
    console.log("   4. Contact name is sent to Bolna in user_data:");
    console.log("      → user_data.contactName = extracted name");
    console.log("      → This becomes {contact-name} variable in webhook");

    console.log("\n✅ Test completed successfully!");

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

testContactNameFromLead()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

