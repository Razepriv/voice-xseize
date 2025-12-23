/**
 * Sync existing knowledge bases to Bolna
 * Uploads text-based KBs that don't have a Bolna RAG ID yet
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

import { BolnaClient } from '../server/bolna.js';
import { db } from '../server/db.js';
import { knowledgeBase, aiAgents } from '@shared/schema';
import { eq, isNull, or } from 'drizzle-orm';
import PDFDocument from 'pdfkit';

const bolnaClient = new BolnaClient(
  process.env.BOLNA_API_KEY!,
  'https://api.bolna.dev'
);

async function textToPdfBuffer(text: string, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Add title
    doc.fontSize(20).text(title, { align: 'center' });
    doc.moveDown();

    // Add content
    doc.fontSize(12).text(text, {
      align: 'left',
      lineGap: 5,
    });

    doc.end();
  });
}

async function syncKnowledgeBases() {
  console.log('🔄 Syncing Existing Knowledge Bases to Bolna\n');
  console.log('='.repeat(70));

  try {
    // Get all knowledge bases without Bolna RAG IDs
    console.log('\n📊 Step 1: Finding knowledge bases to sync...');
    const allKBs = await db.select().from(knowledgeBase);
    const kbsToSync = allKBs.filter(kb => !kb.externalId || kb.externalId === '');

    console.log(`   Found ${kbsToSync.length} knowledge bases to sync\n`);

    if (kbsToSync.length === 0) {
      console.log('✅ No knowledge bases need syncing. All are already in Bolna!');
      return;
    }

    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ kb: any; error: string }> = [];

    for (let i = 0; i < kbsToSync.length; i++) {
      const kb = kbsToSync[i];
      console.log(`\n[${i + 1}/${kbsToSync.length}] Processing: ${kb.title || kb.id}`);
      console.log(`   Organization: ${kb.organizationId}`);
      console.log(`   Agent: ${kb.agentId || 'None'}`);

      try {
        // Prepare content for upload
        const content = kb.content || kb.description || `Knowledge Base: ${kb.title}`;
        const title = kb.title || 'Untitled Knowledge Base';

        console.log(`   Converting to PDF...`);
        const pdfBuffer = await textToPdfBuffer(content, title);
        const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

        console.log(`   Uploading to Bolna...`);
        
        // Create a file-like object that matches multer's structure
        const fileObject = {
          buffer: pdfBuffer,
          originalname: fileName,
          mimetype: 'application/pdf',
          size: pdfBuffer.length
        };
        
        const bolnaKB = await bolnaClient.createKnowledgeBase(fileObject, {
          fileName,
          chunk_size: 512,
          similarity_top_k: 5,
          overlapping: 20,
        });

        console.log(`   ✅ Uploaded! Bolna RAG ID: ${bolnaKB.rag_id}`);

        // Update platform KB with Bolna RAG ID
        await db.update(knowledgeBase)
          .set({
            externalId: bolnaKB.rag_id,
            metadata: {
              ...(kb.metadata as any || {}),
              bolnaRagId: bolnaKB.rag_id,
              syncedAt: new Date().toISOString(),
            }
          })
          .where(eq(knowledgeBase.id, kb.id));

        // Update agent if linked
        if (kb.agentId) {
          const [agent] = await db.select().from(aiAgents)
            .where(eq(aiAgents.id, kb.agentId));

          if (agent) {
            const existingKBIds = agent.knowledgeBaseIds || [];
            if (!existingKBIds.includes(bolnaKB.rag_id)) {
              const updatedKBIds = [...existingKBIds, bolnaKB.rag_id];
              await db.update(aiAgents)
                .set({ knowledgeBaseIds: updatedKBIds })
                .where(eq(aiAgents.id, kb.agentId));
              console.log(`   ✅ Updated agent ${agent.name} with KB ID`);
            }
          }
        }

        successCount++;
      } catch (error) {
        console.log(`   ❌ Failed: ${(error as Error).message}`);
        failureCount++;
        failures.push({ kb, error: (error as Error).message });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('\n📈 SYNC SUMMARY:\n');
    console.log(`   Total Knowledge Bases: ${kbsToSync.length}`);
    console.log(`   ✅ Successfully Synced: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);

    if (failures.length > 0) {
      console.log('\n❌ FAILED KNOWLEDGE BASES:\n');
      failures.forEach(({ kb, error }) => {
        console.log(`   - ${kb.title || kb.id}`);
        console.log(`     Error: ${error}\n`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Knowledge Base Sync Complete!\n');

  } catch (error) {
    console.error('\n❌ Error during sync:', error);
    console.error('\nDetails:', (error as Error).message);
    process.exit(1);
  }
}

// Run the sync
syncKnowledgeBases();
