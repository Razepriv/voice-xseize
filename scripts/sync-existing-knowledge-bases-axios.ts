import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createWriteStream, unlinkSync } from 'fs';
import PDFDocument from 'pdfkit';

import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { db } from '../server/db.js';
import { knowledgeBase, aiAgents } from '@shared/schema';
import { eq } from 'drizzle-orm';

dotenv.config({ path: resolve(process.cwd(), '.env') });

async function textToPdfFile(text: string, title: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(20).text(title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(text, { align: 'left', lineGap: 5 });
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function syncKnowledgeBases() {
  console.log('🔄 Syncing Existing Knowledge Bases to Bolna\n');
  console.log('='.repeat(70));

  const allKBs = await db.select().from(knowledgeBase);
  const kbsToSync = allKBs.filter(kb => !kb.externalId || kb.externalId === '');

  for (const kb of kbsToSync) {
    const content = kb.content || kb.description || `Knowledge Base: ${kb.title}`;
    const title = kb.title || 'Untitled Knowledge Base';
    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const filePath = resolve(process.cwd(), `tmp_${kb.id}.pdf`);
    try {
      console.log(`\nSyncing: ${title}`);
      await textToPdfFile(content, title, filePath);

      const form = new FormData();
      form.append('file', createReadStream(filePath), fileName);
      form.append('chunk_size', '512');
      form.append('similarity_top_k', '5');
      form.append('overlapping', '20');

      const response = await axios.post(
        'https://api.bolna.ai/knowledgebase',
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${process.env.BOLNA_API_KEY}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      const bolnaKB = response.data;
      console.log(`✅ Uploaded! Bolna RAG ID: ${bolnaKB.rag_id}`);

      // Update platform KB with Bolna RAG ID
      await db.update(knowledgeBase)
        .set({
          bolnaKbId: bolnaKB.rag_id
        })
        .where(eq(knowledgeBase.id, kb.id));

      // Update agent if linked
      if (kb.agentId) {
        const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, kb.agentId));
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
    } catch (error) {
      console.error(`❌ Failed: ${error.response?.data || error.message}`);
    } finally {
      try { unlinkSync(filePath); } catch {}
    }
  }
  console.log('\n✅ Knowledge Base Sync Complete!\n');
}

syncKnowledgeBases();
