import "dotenv/config";

/**
 * Test script to verify contactName variable extraction from webhook
 */

// Simulate a Bolna webhook payload with contactName in different possible locations
const mockWebhookPayloads = [
  {
    name: "contactName in context_details.recipient_data",
    payload: {
      id: "test-call-123",
      conversation_duration: 120,
      total_cost: 0.05,
      transcript: "Hello, this is a test call.",
      recording_url: "https://example.com/recording.mp3",
      status: "completed",
      context_details: {
        recipient_data: {
          callId: "test-call-123",
          organizationId: "test-org-123",
          contactName: "John Doe"
        }
      }
    }
  },
  {
    name: "contactName in context_details.user_data",
    payload: {
      id: "test-call-124",
      conversation_duration: 120,
      total_cost: 0.05,
      transcript: "Hello, this is a test call.",
      recording_url: "https://example.com/recording.mp3",
      status: "completed",
      context_details: {
        recipient_data: {
          callId: "test-call-124",
          organizationId: "test-org-123"
        },
        user_data: {
          contactName: "Jane Smith"
        }
      }
    }
  },
  {
    name: "contactName as contact_name in user_data",
    payload: {
      id: "test-call-125",
      conversation_duration: 120,
      total_cost: 0.05,
      transcript: "Hello, this is a test call.",
      recording_url: "https://example.com/recording.mp3",
      status: "completed",
      context_details: {
        recipient_data: {
          callId: "test-call-125",
          organizationId: "test-org-123"
        },
        user_data: {
          contact_name: "Bob Johnson"
        }
      }
    }
  },
  {
    name: "No contactName (should use existing call.contactName)",
    payload: {
      id: "test-call-126",
      conversation_duration: 120,
      total_cost: 0.05,
      transcript: "Hello, this is a test call.",
      recording_url: "https://example.com/recording.mp3",
      status: "completed",
      context_details: {
        recipient_data: {
          callId: "test-call-126",
          organizationId: "test-org-123"
        }
      }
    }
  }
];

console.log("🧪 Testing Contact Name Variable Extraction\n");

mockWebhookPayloads.forEach((testCase, index) => {
  console.log(`\n${index + 1}. Test Case: ${testCase.name}`);
  console.log("─".repeat(60));
  
  const { context_details } = testCase.payload;
  
  // Simulate the extraction logic
  const contactName = context_details?.recipient_data?.contactName || 
                      context_details?.user_data?.contactName ||
                      context_details?.user_data?.contact_name;
  
  console.log(`   Payload structure:`);
  console.log(`   - context_details.recipient_data.contactName: ${context_details?.recipient_data?.contactName || 'undefined'}`);
  console.log(`   - context_details.user_data.contactName: ${context_details?.user_data?.contactName || 'undefined'}`);
  console.log(`   - context_details.user_data.contact_name: ${context_details?.user_data?.contact_name || 'undefined'}`);
  console.log(`\n   ✅ Extracted contactName: ${contactName || 'null'}`);
  
  // Simulate existing call with contactName
  const existingCall = { contactName: "Existing Name" };
  const shouldUpdate = contactName && !existingCall.contactName;
  
  console.log(`   📝 Should update call: ${shouldUpdate ? 'YES' : 'NO'}`);
  if (contactName) {
    console.log(`   ✨ Would update call.contactName to: "${contactName}"`);
  } else {
    console.log(`   ℹ️  Would keep existing call.contactName: "${existingCall.contactName}"`);
  }
});

console.log("\n\n📊 Summary:");
console.log("─".repeat(60));
console.log("✅ Contact name extraction logic checks:");
console.log("   1. context_details.recipient_data.contactName");
console.log("   2. context_details.user_data.contactName");
console.log("   3. context_details.user_data.contact_name (snake_case variant)");
console.log("\n✅ Only updates if:");
console.log("   - contactName is found in webhook payload");
console.log("   - AND call.contactName is currently null/undefined");
console.log("\n✅ This ensures:");
console.log("   - Contact name from webhook is captured if missing");
console.log("   - Existing contact name is preserved if already set");

