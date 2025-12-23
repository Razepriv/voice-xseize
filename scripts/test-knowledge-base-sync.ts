/**
 * Test script to verify knowledge base synchronization with Bolna
 * Checks if knowledge bases created in our platform exist in Bolna
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { BolnaClient } from '../server/bolna.js';
import { db } from '../server/db.js';
import { knowledgeBase } from '@shared/schema';
import { eq } from 'drizzle-orm';

const bolnaClient = new BolnaClient(
  process.env.BOLNA_API_KEY!,
  'https://api.bolna.dev'
);

async function testKnowledgeBaseSync() {
  console.log('🔍 Testing Knowledge Base Synchronization with Bolna\n');
  console.log('='.repeat(70));

  try {
    // Step 1: Get all knowledge bases from our platform
    console.log('\n📊 Step 1: Fetching knowledge bases from platform database...');
    const platformKBs = await db.select().from(knowledgeBase);
    console.log(`   Found ${platformKBs.length} knowledge base entries in platform\n`);

    if (platformKBs.length === 0) {
      console.log('⚠️  No knowledge bases found in platform database');
      console.log('   Please create a knowledge base first via the UI');
      return;
    }

    // Display platform KBs
    console.log('Platform Knowledge Bases:');
    platformKBs.forEach((kb, idx) => {
      console.log(`\n${idx + 1}. ${kb.title || 'Untitled'}`);
      console.log(`   ID: ${kb.id}`);
      console.log(`   Organization: ${kb.organizationId}`);
      console.log(`   Agent: ${kb.agentId || 'None'}`);
      console.log(`   Bolna RAG ID: ${kb.externalId || 'NOT SET'}`);
      console.log(`   Status: ${kb.status}`);
      console.log(`   Created: ${kb.createdAt}`);
    });

    // Step 2: Get all knowledge bases from Bolna
    console.log('\n' + '='.repeat(70));
    console.log('\n🌐 Step 2: Fetching knowledge bases from Bolna API...');
    const bolnaKBs = await bolnaClient.listKnowledgeBases();
    console.log(`   Found ${bolnaKBs.length} knowledge bases in Bolna\n`);

    if (bolnaKBs.length === 0) {
      console.log('⚠️  No knowledge bases found in Bolna');
      console.log('   This could mean:');
      console.log('   - Knowledge bases were not uploaded to Bolna');
      console.log('   - API credentials are incorrect');
      console.log('   - Bolna API is not accessible');
      return;
    }

    // Display Bolna KBs
    console.log('Bolna Knowledge Bases:');
    bolnaKBs.forEach((kb: any, idx) => {
      console.log(`\n${idx + 1}. ${kb.name || kb.fileName || 'Untitled'}`);
      console.log(`   RAG ID: ${kb.rag_id}`);
      console.log(`   Created: ${kb.created_at || kb.createdAt || 'Unknown'}`);
      console.log(`   Status: ${kb.status || 'Unknown'}`);
    });

    // Step 3: Cross-check platform KBs with Bolna
    console.log('\n' + '='.repeat(70));
    console.log('\n🔄 Step 3: Cross-checking synchronization...\n');

    const bolnaRagIds = new Set(bolnaKBs.map((kb: any) => kb.rag_id));
    let syncedCount = 0;
    let missingCount = 0;
    const missingKBs: any[] = [];

    for (const kb of platformKBs) {
      if (kb.externalId && bolnaRagIds.has(kb.externalId)) {
        console.log(`✅ SYNCED: ${kb.title || kb.id}`);
        console.log(`   Platform ID: ${kb.id}`);
        console.log(`   Bolna RAG ID: ${kb.externalId}`);
        syncedCount++;
      } else if (kb.externalId) {
        console.log(`❌ MISSING IN BOLNA: ${kb.title || kb.id}`);
        console.log(`   Platform ID: ${kb.id}`);
        console.log(`   Expected Bolna RAG ID: ${kb.externalId}`);
        console.log(`   Status: ${kb.status}`);
        missingCount++;
        missingKBs.push(kb);
      } else {
        console.log(`⚠️  NO BOLNA ID: ${kb.title || kb.id}`);
        console.log(`   Platform ID: ${kb.id}`);
        console.log(`   This KB was never uploaded to Bolna`);
        missingCount++;
        missingKBs.push(kb);
      }
      console.log('');
    }

    // Step 4: Summary
    console.log('='.repeat(70));
    console.log('\n📈 SUMMARY:\n');
    console.log(`   Platform Knowledge Bases: ${platformKBs.length}`);
    console.log(`   Bolna Knowledge Bases: ${bolnaKBs.length}`);
    console.log(`   ✅ Synced: ${syncedCount}`);
    console.log(`   ❌ Missing/Not Synced: ${missingCount}`);

    if (missingCount > 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   Some knowledge bases are not synced with Bolna.');
      console.log('   Possible reasons:');
      console.log('   1. Upload to Bolna failed during creation');
      console.log('   2. Knowledge base was created without Bolna integration');
      console.log('   3. Bolna RAG ID was not stored correctly');
      console.log('\n   To fix this, you can:');
      console.log('   - Re-upload the knowledge base via the UI');
      console.log('   - Check server logs for upload errors');
      console.log('   - Verify BOLNA_API_KEY is correct');
    } else if (syncedCount === platformKBs.length && platformKBs.length > 0) {
      console.log('\n✅ All knowledge bases are properly synced!');
    }

    // Step 5: Check if agents have KB references
    console.log('\n' + '='.repeat(70));
    console.log('\n🤖 Step 4: Checking agent knowledge base assignments...\n');

    const { aiAgents } = await import('@shared/schema');
    const agents = await db.select().from(aiAgents);

    for (const agent of agents) {
      const kbIds = agent.knowledgeBaseIds || [];
      if (kbIds.length > 0) {
        console.log(`Agent: ${agent.name} (${agent.id})`);
        console.log(`   Assigned Knowledge Base IDs: ${kbIds.length}`);
        kbIds.forEach((kbId: string) => {
          const exists = bolnaRagIds.has(kbId);
          console.log(`   - ${kbId} ${exists ? '✅' : '❌ NOT FOUND IN BOLNA'}`);
        });
        console.log('');
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Knowledge Base Sync Test Complete!\n');

  } catch (error) {
    console.error('\n❌ Error during knowledge base sync test:', error);
    console.error('\nDetails:', (error as Error).message);
    process.exit(1);
  }
}

// Run the test
testKnowledgeBaseSync();
