import "dotenv/config";
import { db } from "../server/db";
import { knowledgeBase } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Test script to verify knowledge base creation and retrieval
 */

async function testKnowledgeBase() {
  console.log("🧪 Testing Knowledge Base Creation and Retrieval\n");

  try {
    // Get a sample organization ID (you can modify this)
    const testOrgId = process.env.TEST_ORG_ID || "4c060791-07e4-4555-b57e-c1f16650a7f3";
    
    console.log(`📋 Fetching knowledge bases for organization: ${testOrgId}\n`);
    
    const allKBs = await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.organizationId, testOrgId));

    if (allKBs.length === 0) {
      console.log("ℹ️  No knowledge bases found for this organization");
      console.log("   This is expected if no knowledge bases have been created yet.\n");
    } else {
      console.log(`✅ Found ${allKBs.length} knowledge base(s):\n`);
      
      allKBs.forEach((kb, index) => {
        console.log(`Knowledge Base ${index + 1}:`);
        console.log(`   - ID: ${kb.id}`);
        console.log(`   - Title: ${kb.title}`);
        console.log(`   - Organization ID: ${kb.organizationId}`);
        console.log(`   - Agent ID: ${kb.agentId || 'Not set'}`);
        console.log(`   - Content Type: ${kb.contentType}`);
        console.log(`   - Status: ${kb.status}`);
        console.log(`   - Created At: ${kb.createdAt}`);
        console.log(`   - Updated At: ${kb.updatedAt}`);
        console.log(`   - File URL: ${kb.fileUrl || 'Not set'}`);
        console.log(`   - Source URL: ${kb.sourceUrl || 'Not set'}`);
        console.log(`   - Tags: ${kb.tags ? kb.tags.join(', ') : 'None'}`);
        console.log("");
      });
    }

    // Test organization ID matching
    console.log("🔍 Testing Organization ID Matching:\n");
    console.log(`   Test Org ID: ${testOrgId}`);
    console.log(`   All KBs match org: ${allKBs.every(kb => kb.organizationId === testOrgId)}`);
    
    if (allKBs.some(kb => kb.organizationId !== testOrgId)) {
      console.log("   ⚠️  WARNING: Some knowledge bases have different organization IDs!");
      allKBs.forEach(kb => {
        if (kb.organizationId !== testOrgId) {
          console.log(`      - KB ${kb.id} has org ID: ${kb.organizationId}`);
        }
      });
    }

    // Check for recent knowledge bases
    console.log("\n📅 Recent Knowledge Bases (last 24 hours):\n");
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    const recentKBs = allKBs.filter(kb => {
      const createdAt = kb.createdAt ? new Date(kb.createdAt) : null;
      return createdAt && createdAt > oneDayAgo;
    });

    if (recentKBs.length === 0) {
      console.log("   No knowledge bases created in the last 24 hours");
    } else {
      console.log(`   Found ${recentKBs.length} recent knowledge base(s):`);
      recentKBs.forEach(kb => {
        console.log(`      - ${kb.title} (${kb.id}) - Created: ${kb.createdAt}`);
      });
    }

    console.log("\n✅ Test completed successfully!");

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testKnowledgeBase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

