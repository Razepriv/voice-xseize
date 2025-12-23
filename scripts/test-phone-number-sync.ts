import "dotenv/config";
import { exotelClient } from "../server/exotel";
import { bolnaClient } from "../server/bolna";
import { plivoClient } from "../server/plivo";
import { syncOrganizationPhoneNumbers } from "../server/phoneNumberSync";
import { db } from "../server/db";
import { organizations, phoneNumbers } from "../shared/schema";
import { eq } from "drizzle-orm";

async function testPhoneNumberSync() {
  console.log("\n🧪 Testing Phone Number Sync Functionality\n");
  console.log("=".repeat(80));

  // Test 1: Check Exotel API
  console.log("\n1️⃣ Testing Exotel API...");
  try {
    const exotelNumbers = await exotelClient.getPhoneNumbers();
    console.log(`   ✅ Exotel API: Found ${exotelNumbers.length} phone number(s)`);
    if (exotelNumbers.length > 0) {
      exotelNumbers.slice(0, 3).forEach((num: any) => {
        console.log(`      - ${num.PhoneNumber} (${num.FriendlyName || 'No name'})`);
      });
    }
  } catch (error: any) {
    console.log(`   ❌ Exotel API Error: ${error.message}`);
  }

  // Test 2: Check Bolna API
  console.log("\n2️⃣ Testing Bolna API...");
  try {
    const bolnaNumbers = await bolnaClient.listRegisteredPhoneNumbers();
    console.log(`   ✅ Bolna API: Found ${bolnaNumbers.length} phone number(s)`);
    if (bolnaNumbers.length > 0) {
      bolnaNumbers.slice(0, 3).forEach((num: any) => {
        console.log(`      - ${num.phone_number} (${num.telephony_provider || 'unknown provider'})`);
        console.log(`        Agent ID: ${num.agent_id || 'Not assigned'}`);
        console.log(`        Price: ${num.price || 'N/A'}`);
        console.log(`        Rented: ${num.rented ? 'Yes' : 'No'}`);
      });
    }
  } catch (error: any) {
    console.log(`   ❌ Bolna API Error: ${error.message}`);
  }

  // Test 3: Check Plivo API (if configured)
  console.log("\n3️⃣ Testing Plivo API...");
  try {
    const plivoNumbers = await plivoClient.getPhoneNumbers();
    console.log(`   ✅ Plivo API: Found ${plivoNumbers.length} phone number(s)`);
    if (plivoNumbers.length > 0) {
      plivoNumbers.slice(0, 3).forEach((num: any) => {
        console.log(`      - ${num.number} (${num.alias || 'No alias'})`);
        console.log(`        Voice: ${num.voice_enabled ? 'Yes' : 'No'}, SMS: ${num.sms_enabled ? 'Yes' : 'No'}`);
      });
    }
  } catch (error: any) {
    console.log(`   ⚠️  Plivo API: ${error.message} (may not be configured)`);
  }

  // Test 4: Check available numbers from Bolna
  console.log("\n4️⃣ Testing Bolna Available Numbers Search...");
  try {
    const available = await bolnaClient.searchAvailablePhoneNumbers({
      country: "US",
    });
    console.log(`   ✅ Bolna Search: Found available numbers`);
    if (available && Array.isArray(available) && available.length > 0) {
      console.log(`      Showing first 3 results:`);
      available.slice(0, 3).forEach((num: any, idx: number) => {
        console.log(`      ${idx + 1}. ${num.phone_number || num.number || 'N/A'}`);
      });
    } else {
      console.log(`      (No results or different response format)`);
    }
  } catch (error: any) {
    console.log(`   ⚠️  Bolna Search: ${error.message}`);
  }

  // Test 5: Get organizations and test sync
  console.log("\n5️⃣ Testing Phone Number Sync for Organizations...");
  try {
    const orgs = await db.select().from(organizations);
    console.log(`   Found ${orgs.length} organization(s)`);

    if (orgs.length === 0) {
      console.log("   ⚠️  No organizations found. Cannot test sync.");
      return;
    }

    // Test sync for first organization
    const testOrg = orgs[0];
    console.log(`\n   Testing sync for: ${testOrg.name} (${testOrg.id})`);
    
    const syncStats = await syncOrganizationPhoneNumbers(
      testOrg.id,
      (orgId, phone) => {
        console.log(`      📢 WebSocket: phone:updated for org ${orgId}`);
      },
      (orgId, phone) => {
        console.log(`      📢 WebSocket: phone:created for org ${orgId}`);
      }
    );

    console.log(`\n   ✅ Sync Results:`);
    console.log(`      Created: ${syncStats.created}`);
    console.log(`      Updated: ${syncStats.updated}`);
    console.log(`      Errors: ${syncStats.errors}`);

    // Show synced numbers
    const syncedNumbers = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.organizationId, testOrg.id));

    console.log(`\n   📋 Total numbers in database for this org: ${syncedNumbers.length}`);
    if (syncedNumbers.length > 0) {
      console.log(`\n   Phone Numbers:`);
      syncedNumbers.forEach((num, idx) => {
        console.log(`      ${idx + 1}. ${num.phoneNumber}`);
        console.log(`         Provider: ${num.provider || 'N/A'}`);
        console.log(`         Status: ${num.status || 'N/A'}`);
        console.log(`         Friendly Name: ${num.friendlyName || 'N/A'}`);
        if (num.exotelConfig && typeof num.exotelConfig === 'object') {
          const config = num.exotelConfig as any;
          if (config.bolnaTelephonyProvider) {
            console.log(`         Bolna Provider: ${config.bolnaTelephonyProvider}`);
            console.log(`         Bolna Price: ${config.bolnaPrice || 'N/A'}`);
          }
        }
      });
    }
  } catch (error: any) {
    console.log(`   ❌ Sync Error: ${error.message}`);
    console.error(error);
  }

  // Test 6: Check database state
  console.log("\n6️⃣ Database Summary...");
  try {
    const allNumbers = await db.select().from(phoneNumbers);
    const byProvider = new Map<string, number>();
    
    allNumbers.forEach(num => {
      const provider = num.provider || 'unknown';
      byProvider.set(provider, (byProvider.get(provider) || 0) + 1);
    });

    console.log(`   Total phone numbers in database: ${allNumbers.length}`);
    console.log(`   By provider:`);
    byProvider.forEach((count, provider) => {
      console.log(`      ${provider}: ${count}`);
    });
  } catch (error: any) {
    console.log(`   ❌ Database Error: ${error.message}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Testing Complete!\n");
}

testPhoneNumberSync()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Test failed:", err);
    process.exit(1);
  });




