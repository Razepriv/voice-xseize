import { storage } from "./storage";
// import { exotelClient } from "./exotel"; // Exotel disabled - using Plivo only
import { bolnaClient } from "./bolna";
import { db } from "./db";
import { organizations, phoneNumbers } from "@shared/schema";
import type { InsertPhoneNumber } from "@shared/schema";
import { eq } from "drizzle-orm";

// Sync configuration
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;

interface SyncStats {
  lastSyncTime: Date | null;
  totalOrganizations: number;
  totalNumbersSynced: number;
  numbersCreated: number;
  numbersUpdated: number;
  errors: number;
}

const syncStats: SyncStats = {
  lastSyncTime: null,
  totalOrganizations: 0,
  totalNumbersSynced: 0,
  numbersCreated: 0,
  numbersUpdated: 0,
  errors: 0,
};

/**
 * Sync phone numbers for a specific organization
 */
export async function syncOrganizationPhoneNumbers(
  organizationId: string,
  emitPhoneNumberUpdate?: (orgId: string, phone: any) => void,
  emitPhoneNumberCreated?: (orgId: string, phone: any) => void
): Promise<{
  created: number;
  updated: number;
  errors: number;
}> {
  const stats = { created: 0, updated: 0, errors: 0 };

  try {
    // Get existing phone numbers for this organization
    const existingNumbers = await storage.getPhoneNumbers(organizationId);
    const existingMap = new Map(existingNumbers.map((n) => [n.phoneNumber, n]));

    // NOTE: Exotel is disabled - using Plivo only via Bolna API
    console.log(`[Phone Sync] Exotel disabled - fetching numbers from Bolna/Plivo only for org ${organizationId}`);

    // Fetch phone numbers from Bolna API (includes Plivo, Twilio, Vonage numbers registered in Bolna)
    let bolnaNumbers: any[] = [];
    try {
      bolnaNumbers = await bolnaClient.listRegisteredPhoneNumbers();
      console.log(`[Phone Sync] Fetched ${bolnaNumbers.length} numbers from Bolna for org ${organizationId}`);
    } catch (error: any) {
      console.warn(`[Phone Sync] Could not fetch from Bolna API for org ${organizationId}:`, error.message);
    }

    // Process Bolna numbers (these can be from Plivo, Twilio, Vonage, etc.)
    for (const bolnaNumber of bolnaNumbers) {
      try {
        // Map Bolna telephony provider to our provider field
        // Bolna uses: twilio, plivo, vonage
        // We store as: exotel, plivo, twilio, vonage
        let provider = bolnaNumber.telephony_provider?.toLowerCase() || 'plivo';
        
        // If it's a Plivo number from Bolna, we still mark it as plivo
        // But we can distinguish it's managed through Bolna
        const phoneData: InsertPhoneNumber = {
          organizationId,
          phoneNumber: bolnaNumber.phone_number,
          provider: provider,
          friendlyName: `Bolna ${provider} Number`,
          capabilities: {
            voice: true,
            sms: true,
          },
          status: 'active',
          // Store Bolna-specific metadata
          exotelConfig: {
            bolnaId: bolnaNumber.id,
            bolnaAgentId: bolnaNumber.agent_id,
            bolnaPrice: bolnaNumber.price,
            bolnaRented: bolnaNumber.rented,
            bolnaTelephonyProvider: bolnaNumber.telephony_provider,
            bolnaCreatedAt: bolnaNumber.created_at,
            bolnaUpdatedAt: bolnaNumber.updated_at,
            bolnaRenewalAt: bolnaNumber.renewal_at,
          },
        };

        const existingNumber = existingMap.get(bolnaNumber.phone_number);

        if (!existingNumber) {
          const created = await storage.createPhoneNumber(phoneData);
          stats.created++;
          console.log(`[Phone Sync] ✅ Created Bolna number: ${bolnaNumber.phone_number} (${provider}) for org ${organizationId}`);
          if (emitPhoneNumberCreated) {
            emitPhoneNumberCreated(organizationId, created);
          }
        } else {
          // Update existing number with Bolna data
          const updated = await storage.updatePhoneNumber(existingNumber.id, organizationId, {
            provider: provider,
            friendlyName: phoneData.friendlyName,
            exotelConfig: phoneData.exotelConfig,
          });
          if (updated) {
            stats.updated++;
            console.log(`[Phone Sync] 🔄 Updated Bolna number: ${bolnaNumber.phone_number} (${provider}) for org ${organizationId}`);
            if (emitPhoneNumberUpdate) {
              emitPhoneNumberUpdate(organizationId, updated);
            }
          }
        }
      } catch (error: any) {
        console.error(`[Phone Sync] ❌ Error processing Bolna number ${bolnaNumber.phone_number}:`, error.message);
        stats.errors++;
      }
    }

    return stats;
  } catch (error: any) {
    console.error(`[Phone Sync] ❌ Error syncing organization ${organizationId}:`, error.message);
    stats.errors++;
    return stats;
  }
}

/**
 * Sync phone numbers for all organizations
 */
export async function syncAllPhoneNumbers(
  emitPhoneNumberUpdate?: (orgId: string, phone: any) => void,
  emitPhoneNumberCreated?: (orgId: string, phone: any) => void
): Promise<SyncStats> {
  if (isSyncing) {
    console.log('[Phone Sync] ⏸️  Sync already in progress, skipping...');
    return syncStats;
  }

  isSyncing = true;
  const startTime = Date.now();

  console.log('\n🔄 [Phone Sync] Starting automatic phone number sync...');

  try {
    // Get all organizations
    const allOrgs = await db.select().from(organizations);
    syncStats.totalOrganizations = allOrgs.length;
    syncStats.numbersCreated = 0;
    syncStats.numbersUpdated = 0;
    syncStats.errors = 0;

    console.log(`[Phone Sync] Found ${allOrgs.length} organization(s) to sync`);

    // Sync phone numbers for each organization
    for (const org of allOrgs) {
      console.log(`[Phone Sync] Syncing organization: ${org.name} (${org.id})`);
      const orgStats = await syncOrganizationPhoneNumbers(org.id, emitPhoneNumberUpdate, emitPhoneNumberCreated);
      syncStats.numbersCreated += orgStats.created;
      syncStats.numbersUpdated += orgStats.updated;
      syncStats.errors += orgStats.errors;
    }

    syncStats.totalNumbersSynced = syncStats.numbersCreated + syncStats.numbersUpdated;
    syncStats.lastSyncTime = new Date();

    const duration = Date.now() - startTime;
    console.log(`\n✅ [Phone Sync] Sync completed in ${duration}ms`);
    console.log(`   Organizations: ${syncStats.totalOrganizations}`);
    console.log(`   Numbers created: ${syncStats.numbersCreated}`);
    console.log(`   Numbers updated: ${syncStats.numbersUpdated}`);
    console.log(`   Errors: ${syncStats.errors}`);
    console.log(`   Next sync in ${SYNC_INTERVAL_MS / 1000 / 60} minutes\n`);

    return { ...syncStats };
  } catch (error: any) {
    console.error('[Phone Sync] ❌ Fatal error during sync:', error);
    syncStats.errors++;
    return { ...syncStats };
  } finally {
    isSyncing = false;
  }
}

/**
 * Start automatic phone number syncing
 */
export function startPhoneNumberSync(
  emitPhoneNumberUpdate?: (orgId: string, phone: any) => void,
  emitPhoneNumberCreated?: (orgId: string, phone: any) => void
): void {
  if (syncInterval) {
    console.log('[Phone Sync] ⚠️  Sync already started');
    return;
  }

  console.log(`[Phone Sync] 🚀 Starting automatic phone number sync (interval: ${SYNC_INTERVAL_MS / 1000 / 60} minutes)`);

  // Run initial sync immediately
  syncAllPhoneNumbers(emitPhoneNumberUpdate, emitPhoneNumberCreated).catch((error) => {
    console.error('[Phone Sync] Error in initial sync:', error);
  });

  // Set up periodic sync
  syncInterval = setInterval(() => {
    syncAllPhoneNumbers(emitPhoneNumberUpdate, emitPhoneNumberCreated).catch((error) => {
      console.error('[Phone Sync] Error in periodic sync:', error);
    });
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop automatic phone number syncing
 */
export function stopPhoneNumberSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Phone Sync] 🛑 Stopped automatic phone number sync');
  }
}

/**
 * Get current sync statistics
 */
export function getSyncStats(): SyncStats {
  return { ...syncStats };
}

/**
 * Manually trigger a sync (useful for API endpoints)
 */
export async function triggerManualSync(
  emitPhoneNumberUpdate?: (orgId: string, phone: any) => void,
  emitPhoneNumberCreated?: (orgId: string, phone: any) => void
): Promise<SyncStats> {
  console.log('[Phone Sync] 🔧 Manual sync triggered');
  return await syncAllPhoneNumbers(emitPhoneNumberUpdate, emitPhoneNumberCreated);
}

