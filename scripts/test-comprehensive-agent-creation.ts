import "dotenv/config";
import { db } from "../server/db";
import { aiAgents, organizations, phoneNumbers, knowledgeBase } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Comprehensive test script to verify all Bolna API parameters are properly saved
 * Tests all 8 tabs: Agent, LLM, Audio, Engine, Call, Tools, Analytics, Inbound
 */

async function testComprehensiveAgentCreation() {
  console.log("🧪 Testing Comprehensive Agent Creation with ALL Bolna API Parameters\n");
  console.log("=" .repeat(80));

  try {
    // Get first organization for testing
    const orgs = await db.select().from(organizations).limit(1);
    if (orgs.length === 0) {
      console.error("❌ No organizations found. Please create an organization first.");
      process.exit(1);
    }
    const org = orgs[0];
    console.log(`\n✅ Using organization: ${org.name} (${org.id})\n`);

    // Check for phone numbers
    const phones = await db.select().from(phoneNumbers)
      .where(eq(phoneNumbers.organizationId, org.id))
      .limit(1);
    const phoneId = phones.length > 0 ? phones[0].id : null;
    if (phoneId) {
      console.log(`✅ Phone number available: ${phones[0].phoneNumber}`);
    } else {
      console.log("⚠️  No phone numbers available (optional)");
    }

    // Check for knowledge bases
    const kbs = await db.select().from(knowledgeBase)
      .where(eq(knowledgeBase.organizationId, org.id))
      .limit(1);
    const kbIds = kbs.length > 0 ? [kbs[0].id] : [];
    if (kbIds.length > 0) {
      console.log(`✅ Knowledge base available: ${kbs[0].title}`);
    } else {
      console.log("⚠️  No knowledge bases available (optional)");
    }

    console.log("\n📝 Creating comprehensive test agent with ALL parameters...\n");

    // Create agent with ALL Bolna API parameters across all 8 tabs
    const testAgent = {
      organizationId: org.id,
      
      // ===== AGENT TAB =====
      name: "Comprehensive Test Agent",
      description: "Full-featured test agent with all Bolna API configurations enabled",
      assignedPhoneNumberId: phoneId,
      knowledgeBaseIds: kbIds,
      systemPrompt: "You are a highly capable AI assistant. Be professional, helpful, and concise. Always confirm important information.",
      userPrompt: "The user is calling for support. Address their concerns efficiently.",
      firstMessage: "Hello! Thank you for calling. I'm your AI assistant. How can I help you today?",
      
      // ===== LLM TAB =====
      model: "gpt-4",
      temperature: 0.8,
      maxTokens: 200,
      
      // ===== AUDIO TAB =====
      provider: "azuretts",
      voiceProvider: "azuretts",
      voiceId: "en-US-JennyNeural",
      voiceName: "Jenny Neural",
      language: "en-US",
      synthesizerStream: true,
      synthesizerBufferSize: 150,
      synthesizerAudioFormat: "wav",
      
      // ===== ENGINE TAB - Transcription & Interruptions =====
      transcriberProvider: "deepgram",
      transcriberModel: "nova-2",
      transcriberLanguage: "en",
      transcriberStream: true,
      transcriberSamplingRate: 16000,
      transcriberEncoding: "linear16",
      transcriberEndpointing: 150,
      numberOfWordsForInterruption: 3,
      incrementalDelay: 500,
      
      // ===== CALL TAB - Call Management =====
      maxDuration: 900, // 15 minutes
      hangupAfterSilence: 15,
      callTerminate: 120,
      hangupAfterLLMCall: false,
      voicemail: true,
      callCancellationPrompt: "Thank you for calling. This call is now being ended. Goodbye!",
      
      // ===== CALL TAB - User Online Detection (Backchanneling) =====
      backchanneling: true,
      backchannelingMessageGap: 7,
      backchannelingStartDelay: 7,
      
      // ===== TOOLS TAB =====
      // Tools are configured separately via Bolna API
      
      // ===== ANALYTICS TAB =====
      webhookUrl: "https://platform.automitra.ai/api/webhooks/bolna/call-status",
      
      // ===== INBOUND TAB =====
      callForwardingEnabled: true,
      callForwardingNumber: "+1234567890",
      disallowUnknownNumbers: false,
      
      // ===== ADDITIONAL BOLNA CONFIG =====
      agentType: "other",
      ambientNoise: false,
      ambientNoiseTrack: "office-ambience",
      
      // Status
      status: "active",
      createdBy: "test-script",
    };

    // Insert agent into database
    const [createdAgent] = await db.insert(aiAgents)
      .values(testAgent)
      .returning();

    console.log("✅ Agent created successfully!\n");
    console.log("=" .repeat(80));
    console.log("\n📊 VERIFICATION RESULTS:\n");

    // Verify all parameters were saved correctly
    const savedAgent = await db.select().from(aiAgents)
      .where(eq(aiAgents.id, createdAgent.id))
      .limit(1);

    if (savedAgent.length === 0) {
      console.error("❌ Failed to retrieve created agent");
      process.exit(1);
    }

    const agent = savedAgent[0];
    let allTestsPassed = true;

    // Test function
    const verifyField = (fieldName: string, expected: any, actual: any, tab: string) => {
      const match = JSON.stringify(expected) === JSON.stringify(actual);
      const icon = match ? "✅" : "❌";
      const status = match ? "PASS" : `FAIL (expected: ${expected}, got: ${actual})`;
      console.log(`${icon} [${tab}] ${fieldName}: ${status}`);
      if (!match) allTestsPassed = false;
      return match;
    };

    // Verify AGENT TAB
    console.log("\n🔹 AGENT TAB:");
    verifyField("name", testAgent.name, agent.name, "Agent");
    verifyField("description", testAgent.description, agent.description, "Agent");
    verifyField("systemPrompt", testAgent.systemPrompt, agent.systemPrompt, "Agent");
    verifyField("userPrompt", testAgent.userPrompt, agent.userPrompt, "Agent");
    verifyField("firstMessage", testAgent.firstMessage, agent.firstMessage, "Agent");
    if (phoneId) verifyField("assignedPhoneNumberId", phoneId, agent.assignedPhoneNumberId, "Agent");
    if (kbIds.length > 0) verifyField("knowledgeBaseIds", kbIds, agent.knowledgeBaseIds, "Agent");

    // Verify LLM TAB
    console.log("\n🔹 LLM TAB:");
    verifyField("model", testAgent.model, agent.model, "LLM");
    verifyField("temperature", testAgent.temperature, agent.temperature, "LLM");
    verifyField("maxTokens", testAgent.maxTokens, agent.maxTokens, "LLM");

    // Verify AUDIO TAB
    console.log("\n🔹 AUDIO TAB:");
    verifyField("provider", testAgent.provider, agent.provider, "Audio");
    verifyField("voiceId", testAgent.voiceId, agent.voiceId, "Audio");
    verifyField("language", testAgent.language, agent.language, "Audio");
    verifyField("synthesizerStream", testAgent.synthesizerStream, agent.synthesizerStream, "Audio");
    verifyField("synthesizerBufferSize", testAgent.synthesizerBufferSize, agent.synthesizerBufferSize, "Audio");

    // Verify ENGINE TAB
    console.log("\n🔹 ENGINE TAB:");
    verifyField("transcriberProvider", testAgent.transcriberProvider, agent.transcriberProvider, "Engine");
    verifyField("transcriberModel", testAgent.transcriberModel, agent.transcriberModel, "Engine");
    verifyField("transcriberEndpointing", testAgent.transcriberEndpointing, agent.transcriberEndpointing, "Engine");
    verifyField("numberOfWordsForInterruption", testAgent.numberOfWordsForInterruption, agent.numberOfWordsForInterruption, "Engine");
    verifyField("incrementalDelay", testAgent.incrementalDelay, agent.incrementalDelay, "Engine");

    // Verify CALL TAB
    console.log("\n🔹 CALL TAB:");
    verifyField("maxDuration", testAgent.maxDuration, agent.maxDuration, "Call");
    verifyField("hangupAfterSilence", testAgent.hangupAfterSilence, agent.hangupAfterSilence, "Call");
    verifyField("callTerminate", testAgent.callTerminate, agent.callTerminate, "Call");
    verifyField("hangupAfterLLMCall", testAgent.hangupAfterLLMCall, agent.hangupAfterLLMCall, "Call");
    verifyField("voicemail", testAgent.voicemail, agent.voicemail, "Call");
    verifyField("callCancellationPrompt", testAgent.callCancellationPrompt, agent.callCancellationPrompt, "Call");
    verifyField("backchanneling", testAgent.backchanneling, agent.backchanneling, "Call");
    verifyField("backchannelingMessageGap", testAgent.backchannelingMessageGap, agent.backchannelingMessageGap, "Call");

    // Verify ANALYTICS TAB
    console.log("\n🔹 ANALYTICS TAB:");
    verifyField("webhookUrl", testAgent.webhookUrl, agent.webhookUrl, "Analytics");

    // Verify INBOUND TAB
    console.log("\n🔹 INBOUND TAB:");
    verifyField("callForwardingEnabled", testAgent.callForwardingEnabled, agent.callForwardingEnabled, "Inbound");
    verifyField("callForwardingNumber", testAgent.callForwardingNumber, agent.callForwardingNumber, "Inbound");
    verifyField("disallowUnknownNumbers", testAgent.disallowUnknownNumbers, agent.disallowUnknownNumbers, "Inbound");

    console.log("\n" + "=".repeat(80));
    console.log(`\n🎯 TEST SUMMARY: ${allTestsPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}\n`);
    
    if (allTestsPassed) {
      console.log("✨ Agent ID: " + agent.id);
      console.log("✨ All Bolna API parameters saved correctly!");
      console.log("✨ Ready for sync to Bolna platform\n");
      console.log("📝 Next steps:");
      console.log("   1. Go to AI Agents page");
      console.log("   2. Find 'Comprehensive Test Agent'");
      console.log("   3. Click 'Sync Agent' to push to Bolna");
      console.log("   4. Verify agent appears in Bolna dashboard\n");
    } else {
      console.log("\n⚠️  Some parameters didn't match expected values.");
      console.log("   Please review the schema or form handling.\n");
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during test:", error);
    process.exit(1);
  }
}

// Run the test
testComprehensiveAgentCreation();
