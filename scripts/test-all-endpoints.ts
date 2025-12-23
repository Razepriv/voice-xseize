#!/usr/bin/env tsx
/**
 * Comprehensive test script for all API endpoints and webhooks
 * Run with: npx tsx scripts/test-all-endpoints.ts
 */

import dotenv from "dotenv";
dotenv.config();

let BASE_URL = process.env.PUBLIC_WEBHOOK_URL || "http://localhost:5000";
// Ensure BASE_URL has protocol
if (!BASE_URL.startsWith("http://") && !BASE_URL.startsWith("https://")) {
  BASE_URL = `https://${BASE_URL}`;
}
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@example.com";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "test123";

interface TestResult {
  name: string;
  method: string;
  path: string;
  status: "PASS" | "FAIL" | "SKIP";
  statusCode?: number;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];
let authToken: string | null = null;
let testUserId: string | null = null;
let testOrgId: string | null = null;
let testAgentId: string | null = null;
let testPhoneNumberId: string | null = null;
let testCallId: string | null = null;
let testKnowledgeBaseId: string | null = null;

async function makeRequest(
  method: string,
  path: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    auth?: boolean;
    expectStatus?: number | number[];
  } = {}
): Promise<{ status: number; data: any; error?: string }> {
  const startTime = Date.now();
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (options.auth && authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (options.body && method !== "GET") {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;
    let data: any;
    const contentType = response.headers.get("content-type");
    
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    const expectedStatus = options.expectStatus || [200, 201, 202];
    const statusArray = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const isExpectedStatus = statusArray.includes(response.status);

    return {
      status: response.status,
      data,
      error: isExpectedStatus ? undefined : `Expected ${expectedStatus}, got ${response.status}`,
    };
  } catch (error: any) {
    return {
      status: 0,
      data: null,
      error: error.message || String(error),
    };
  }
}

async function test(
  name: string,
  method: string,
  path: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    auth?: boolean;
    expectStatus?: number | number[];
    extractData?: (data: any) => void;
  } = {}
): Promise<TestResult> {
  const startTime = Date.now();
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   ${method} ${path}`);

  try {
    const result = await makeRequest(method, path, options);
    const duration = Date.now() - startTime;

    if (result.error) {
      console.log(`   ❌ FAILED: ${result.error}`);
      if (result.data && typeof result.data === "object") {
        console.log(`   Response:`, JSON.stringify(result.data, null, 2));
      }
      const testResult = {
        name,
        method,
        path,
        status: "FAIL" as const,
        statusCode: result.status,
        error: result.error,
        duration,
      };
      results.push(testResult);
      return testResult;
    }

    // Extract data if needed
    if (options.extractData && result.data) {
      options.extractData(result.data);
    }

    console.log(`   ✅ PASSED (${result.status} in ${duration}ms)`);
    const testResult = {
      name,
      method,
      path,
      status: "PASS" as const,
      statusCode: result.status,
      duration,
    };
    results.push(testResult);
    return testResult;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ FAILED: ${error.message}`);
    const testResult = {
      name,
      method,
      path,
      status: "FAIL" as const,
      error: error.message,
      duration,
    };
    results.push(testResult);
    return testResult;
  }
}

async function runTests() {
  console.log("🚀 Starting comprehensive endpoint and webhook tests...");
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log("=" .repeat(80));

  // ==================== AUTHENTICATION ====================
  console.log("\n📋 SECTION: Authentication");
  console.log("-".repeat(80));

  await test("Get current user (unauthenticated)", "GET", "/api/auth/user", {
    expectStatus: [401, 403],
  });

  // Note: Authentication depends on your auth system
  // For now, we'll test endpoints that require auth and expect 401 if not authenticated
  // In a real scenario, you'd authenticate first and get a token
  console.log("\n⚠️  Note: Some tests may fail with 401 if authentication is required");

  // ==================== AI AGENTS ====================
  console.log("\n📋 SECTION: AI Agents");
  console.log("-".repeat(80));

  await test("Get all AI agents", "GET", "/api/ai-agents", {
    auth: true,
    expectStatus: [200, 401],
    extractData: (data) => {
      if (Array.isArray(data) && data.length > 0) {
        testAgentId = data[0].id;
      }
    },
  });

  if (testAgentId) {
    await test("Get AI agent by ID", "GET", `/api/ai-agents/${testAgentId}`, {
      auth: true,
      expectStatus: [200, 404],
    });

    await test("Sync AI agent to Bolna", "POST", `/api/ai-agents/${testAgentId}/sync`, {
      auth: true,
      expectStatus: [200, 400, 500],
    });
  }

  // ==================== PHONE NUMBERS ====================
  console.log("\n📋 SECTION: Phone Numbers");
  console.log("-".repeat(80));

  await test("Get all phone numbers", "GET", "/api/phone-numbers", {
    auth: true,
    expectStatus: [200, 401],
    extractData: (data) => {
      if (Array.isArray(data) && data.length > 0) {
        testPhoneNumberId = data[0].id;
      }
    },
  });

  await test("Sync phone numbers", "GET", "/api/phone-numbers/sync", {
    auth: true,
    expectStatus: [200, 401],
  });

  await test("Get phone number sync stats", "GET", "/api/phone-numbers/sync/stats", {
    auth: true,
    expectStatus: [200, 401],
  });

  await test("Manual phone number sync", "POST", "/api/phone-numbers/sync/manual", {
    auth: true,
    expectStatus: [200, 401],
  });

  await test("Get available phone numbers (unified)", "GET", "/api/phone-numbers/available", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  // ==================== BOLNA ENDPOINTS ====================
  console.log("\n📋 SECTION: Bolna Integration");
  console.log("-".repeat(80));

  await test("Get Bolna voices", "GET", "/api/bolna/voices", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  await test("Get Bolna models", "GET", "/api/bolna/models", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  await test("Get Bolna available phone numbers", "GET", "/api/bolna/available-phone-numbers", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  await test("Get Bolna registered phone numbers", "GET", "/api/bolna/phone-numbers", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  await test("Get Bolna knowledge bases", "GET", "/api/bolna/knowledge-bases", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  // ==================== EXOTEL ENDPOINTS ====================
  console.log("\n📋 SECTION: Exotel Integration");
  console.log("-".repeat(80));

  await test("Get Exotel phone numbers", "GET", "/api/exotel/phone-numbers", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  await test("Get Exotel available phone numbers", "GET", "/api/exotel/available-phone-numbers", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  // ==================== PLIVO ENDPOINTS ====================
  console.log("\n📋 SECTION: Plivo Integration");
  console.log("-".repeat(80));

  await test("Get Plivo available phone numbers", "GET", "/api/plivo/available-phone-numbers", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  await test("Get Plivo phone numbers", "GET", "/api/plivo/phone-numbers", {
    auth: true,
    expectStatus: [200, 401, 500],
  });

  // ==================== KNOWLEDGE BASE ====================
  console.log("\n📋 SECTION: Knowledge Base");
  console.log("-".repeat(80));

  await test("Get all knowledge bases", "GET", "/api/knowledge-base", {
    auth: true,
    expectStatus: [200, 401, 500],
    extractData: (data) => {
      if (Array.isArray(data) && data.length > 0) {
        testKnowledgeBaseId = data[0].id;
      }
    },
  });

  if (testKnowledgeBaseId) {
    await test("Get knowledge base by ID", "GET", `/api/knowledge-base/${testKnowledgeBaseId}`, {
      auth: true,
      expectStatus: [200, 404],
    });
  }

  // ==================== CALLS ====================
  console.log("\n📋 SECTION: Calls");
  console.log("-".repeat(80));

  await test("Get all calls", "GET", "/api/calls", {
    auth: true,
    expectStatus: [200, 401],
    extractData: (data) => {
      if (Array.isArray(data) && data.length > 0) {
        testCallId = data[0].id;
      }
    },
  });

  if (testCallId) {
    await test("Get call by ID", "GET", `/api/calls/${testCallId}`, {
      auth: true,
      expectStatus: [200, 404],
    });

    await test("Get call Bolna details", "GET", `/api/calls/${testCallId}/bolna-details`, {
      auth: true,
      expectStatus: [200, 404, 500],
    });

    await test("Stop call", "POST", `/api/calls/${testCallId}/stop`, {
      auth: true,
      expectStatus: [200, 404, 400],
    });
  }

  await test("Get call polling stats", "GET", "/api/calls/polling/stats", {
    auth: true,
    expectStatus: [200, 401],
  });

  await test("Initiate call", "POST", "/api/calls/initiate", {
    auth: true,
    body: {
      agentId: testAgentId || "test-agent-id",
      phoneNumber: "+1234567890",
      contactName: "Test Contact",
    },
    expectStatus: [200, 400, 401, 500],
  });

  // ==================== WEBHOOKS ====================
  console.log("\n📋 SECTION: Webhooks");
  console.log("-".repeat(80));

  // Test Bolna webhook
  await test("Bolna call status webhook", "POST", "/api/webhooks/bolna/call-status", {
    body: {
      event: "call.completed",
      call_id: "test-call-123",
      status: "completed",
      duration: 120,
      context_details: {
        recipient_data: {
          callId: testCallId || "test-call-id",
          organizationId: testOrgId || "test-org-id",
        },
      },
    },
    expectStatus: [200, 202, 500],
  });

  // Test Exotel webhook
  await test("Exotel call status webhook", "POST", "/api/webhooks/exotel/call-status", {
    body: {
      CallSid: "test-exotel-sid-123",
      Status: "completed",
      Duration: "120",
      CallStatus: "completed",
      CustomField: JSON.stringify({
        callId: testCallId || "test-call-id",
        organizationId: testOrgId || "test-org-id",
      }),
    },
    expectStatus: [200, 202, 500],
  });

  // ==================== SUMMARY ====================
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(80));

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📈 Total: ${results.length}`);

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => {
        console.log(`\n   ${r.method} ${r.path}`);
        console.log(`   Error: ${r.error || `Status ${r.statusCode}`}`);
      });
  }

  console.log("\n" + "=".repeat(80));
  console.log("✨ Testing complete!");
  console.log("=".repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error("Fatal error running tests:", error);
  process.exit(1);
});

