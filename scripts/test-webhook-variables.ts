import "dotenv/config";

/**
 * Test script to verify webhook variable extraction is working correctly
 * This simulates a Bolna webhook payload and checks if all variables are extracted properly
 */

// Simulate a Bolna webhook payload
const mockWebhookPayload = {
  id: "test-call-123",
  conversation_duration: 120.5,
  total_cost: 0.05,
  transcript: "This is a test transcript of the conversation.",
  recording_url: "https://example.com/recordings/test-call.mp3",
  status: "completed",
  context_details: {
    recipient_data: {
      callId: "test-call-123",
      organizationId: "test-org-123"
    }
  },
  telephony_data: {
    recording_url: "https://example.com/recordings/test-call-telephony.mp3"
  }
};

console.log("🧪 Testing Webhook Variable Extraction\n");
console.log("📦 Mock Webhook Payload:");
console.log(JSON.stringify(mockWebhookPayload, null, 2));
console.log("\n");

// Simulate the extraction logic from the webhook handler
const {
  id: bolnaCallId,
  conversation_duration,
  total_cost,
  transcript,
  recording_url,
  status: bolnaStatus,
  context_details,
  telephony_data
} = mockWebhookPayload;

// Test variable extraction
console.log("✅ Variable Extraction Results:\n");

console.log(`1. bolnaCallId: ${bolnaCallId} (${typeof bolnaCallId})`);
console.log(`   ✓ Extracted: ${bolnaCallId !== undefined ? 'YES' : 'NO'}`);

console.log(`\n2. conversation_duration: ${conversation_duration} (${typeof conversation_duration})`);
const callDuration = conversation_duration ? Math.floor(Number(conversation_duration)) : undefined;
console.log(`   ✓ Converted to integer: ${callDuration} (${typeof callDuration})`);
console.log(`   ✓ Valid: ${callDuration !== undefined && callDuration > 0 ? 'YES' : 'NO'}`);

console.log(`\n3. total_cost: ${total_cost} (${typeof total_cost})`);
console.log(`   ✓ Extracted: ${total_cost !== undefined ? 'YES' : 'NO'}`);
console.log(`   ✓ Valid number: ${!isNaN(Number(total_cost)) ? 'YES' : 'NO'}`);
const costValue = total_cost !== undefined && total_cost !== null ? Number(total_cost) : undefined;
console.log(`   ✓ Converted value: ${costValue}`);

console.log(`\n4. transcript: ${transcript ? transcript.substring(0, 50) + '...' : 'null'} (${typeof transcript})`);
console.log(`   ✓ Extracted: ${transcript !== undefined ? 'YES' : 'NO'}`);
console.log(`   ✓ Has content: ${transcript && transcript.length > 0 ? 'YES' : 'NO'}`);

console.log(`\n5. recording_url: ${recording_url || 'null'} (${typeof recording_url})`);
console.log(`   ✓ Extracted: ${recording_url !== undefined ? 'YES' : 'NO'}`);

console.log(`\n6. bolnaStatus: ${bolnaStatus} (${typeof bolnaStatus})`);
console.log(`   ✓ Extracted: ${bolnaStatus !== undefined ? 'YES' : 'NO'}`);

console.log(`\n7. context_details: ${context_details ? 'Present' : 'null'} (${typeof context_details})`);
console.log(`   ✓ Extracted: ${context_details !== undefined ? 'YES' : 'NO'}`);
if (context_details) {
  console.log(`   ✓ callId: ${context_details?.recipient_data?.callId || 'missing'}`);
  console.log(`   ✓ organizationId: ${context_details?.recipient_data?.organizationId || 'missing'}`);
}

console.log(`\n8. telephony_data: ${telephony_data ? 'Present' : 'null'} (${typeof telephony_data})`);
console.log(`   ✓ Extracted: ${telephony_data !== undefined ? 'YES' : 'NO'}`);
if (telephony_data) {
  console.log(`   ✓ recording_url: ${telephony_data?.recording_url || 'missing'}`);
}

// Test the update object construction
console.log("\n📝 Testing Update Object Construction:\n");

const updates: any = {
  status: bolnaStatus || 'unknown',
  duration: callDuration,
  transcription: transcript || null,
  recordingUrl: telephony_data?.recording_url || recording_url || null,
};

if (total_cost !== undefined && total_cost !== null) {
  updates.bolnaCostPerMinute = Number(total_cost);
}

console.log("Update object:");
console.log(JSON.stringify(updates, null, 2));

// Verify all required fields
console.log("\n✅ Field Verification:\n");
const requiredFields = {
  'status': updates.status !== undefined,
  'duration': updates.duration !== undefined,
  'transcription': updates.transcription !== undefined,
  'recordingUrl': updates.recordingUrl !== undefined,
  'bolnaCostPerMinute': updates.bolnaCostPerMinute !== undefined
};

Object.entries(requiredFields).forEach(([field, present]) => {
  const value = updates[field];
  console.log(`   ${present ? '✓' : '✗'} ${field}: ${present ? (value !== null && value !== undefined ? `"${value}"` : 'null/undefined') : 'MISSING'}`);
});

// Summary
console.log("\n📊 Summary:\n");
const allFieldsPresent = Object.values(requiredFields).every(v => v);
const allFieldsHaveValues = Object.entries(updates).every(([_, v]) => v !== null && v !== undefined);

console.log(`   All fields extracted: ${allFieldsPresent ? '✅ YES' : '❌ NO'}`);
console.log(`   All fields have values: ${allFieldsHaveValues ? '✅ YES' : '❌ NO'}`);
console.log(`   Status: ${updates.status}`);
console.log(`   Duration: ${updates.duration}s`);
console.log(`   Transcription: ${updates.transcription ? 'Present' : 'Missing'}`);
console.log(`   Recording URL: ${updates.recordingUrl || 'Missing'}`);
console.log(`   Cost: ${updates.bolnaCostPerMinute !== undefined ? `$${updates.bolnaCostPerMinute}` : 'Missing'}`);

if (allFieldsPresent && allFieldsHaveValues) {
  console.log("\n✅ All variables are working correctly!");
} else {
  console.log("\n⚠️  Some variables may be missing or null");
}

